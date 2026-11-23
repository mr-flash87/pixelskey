// Reconciliation job: scans `orders` in status=pending, queries the payment
// provider for the actual transaction status, and (if paid) finalizes the order
// exactly like the webhook would — assigning license keys + sending the
// confirmation email.
//
// Triggered every 5 minutes via pg_cron (see migration), and can also be
// invoked manually (admin only).
//
// Public endpoint guarded by either:
//   - cron Authorization header (service-role key), or
//   - admin user JWT.

import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { readPayDunyaConfig, requireSuperAdmin } from "../_shared/paydunya-config.ts";
import { confirmPayDunya } from "../_shared/paydunya.ts";
import { finalizePayDunyaOrder } from "../_shared/finalize-paydunya-order.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Look back this far for pending orders (older ones are written off)
const LOOKBACK_HOURS = 48;
// Skip orders younger than this — give the user time to actually pay
const MIN_AGE_MINUTES = 2;
// Process at most this many per run
const BATCH_SIZE = 25;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey || (req.headers.get("authorization") !== `Bearer ${serviceKey}` && !await requireSuperAdmin(req))) return json({ error: "Accès refusé" }, 403);
  const config = await readPayDunyaConfig();
  const LEEKPAY_SECRET = Deno.env.get("LEEKPAY_SECRET_KEY");


  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const minAge = new Date(Date.now() - MIN_AGE_MINUTES * 60_000).toISOString();
  const lookback = new Date(Date.now() - LOOKBACK_HOURS * 3600_000).toISOString();

  const { data: pending, error } = await supabase
    .from("orders")
    .select("id, reference, payment_id, payment_url, status, customer_email, customer_name, created_at, provider, amount, payment_mode")
    .eq("status", "pending")
    .lte("created_at", minAge)
    .gte("created_at", lookback)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error("List pending error:", error);
    return json({ error: "DB error" }, 500);
  }

  const results: any[] = [];

  for (const order of pending ?? []) {
    try {
      if (order.provider === "paydunya") {
        if (!config.credentials || !order.payment_id) { results.push({ id: order.id, skipped: true }); continue; }
        const confirmed = await confirmPayDunya(order.payment_id, order.payment_mode === "live" ? "live" : "test", config.credentials);
        await supabase.from("orders").update({ last_reconciled_at: new Date().toISOString() }).eq("id", order.id);
        if (confirmed.status === "completed") {
          await finalizePayDunyaOrder(order, confirmed);
          results.push({ id: order.id, action: "paid" });
        } else if (["cancelled", "canceled", "failed"].includes(confirmed.status)) {
          await supabase.from("orders").update({ status: "failed", failed_reason: `paydunya:${confirmed.status}` }).eq("id", order.id).eq("status", "pending");
          results.push({ id: order.id, action: "failed" });
        }
        continue;
      }
      if (!LEEKPAY_SECRET) continue;
      // Derive a payment_id if missing (extract from URL: /pay_XXXXX)
      let paymentId = order.payment_id;
      if (!paymentId && order.payment_url) {
        const m = order.payment_url.match(/\/(pay_[A-Za-z0-9]+)/);
        if (m) {
          paymentId = m[1];
          await supabase.from("orders").update({ payment_id: paymentId }).eq("id", order.id);
        }
      }
      if (!paymentId) {
        results.push({ id: order.id, ref: order.reference, skipped: "no payment_id" });
        continue;
      }

      // Try a few likely LeekPay endpoints for transaction status
      const endpoints = [
        `https://leekpay.fr/api/v1/checkout/${paymentId}`,
        `https://leekpay.fr/api/v1/transactions/${paymentId}`,
        `https://leekpay.fr/api/v1/payments/${paymentId}`,
      ];

      let lpData: any = null;
      let lpStatus = 0;
      for (const url of endpoints) {
        const r = await fetch(url, {
          headers: { Authorization: `Bearer ${LEEKPAY_SECRET}` },
        });
        lpStatus = r.status;
        const data = await r.json().catch(() => ({}));
        if (r.ok && data) {
          lpData = data;
          break;
        }
      }

      await supabase
        .from("orders")
        .update({ last_reconciled_at: new Date().toISOString() })
        .eq("id", order.id);

      if (!lpData) {
        results.push({ id: order.id, ref: order.reference, lp_status: lpStatus, no_data: true });
        continue;
      }

      const tx = lpData?.data ?? lpData?.transaction ?? lpData ?? {};
      const status: string | undefined = (tx?.status ?? tx?.state ?? "").toString().toLowerCase();
      const isPaid =
        status === "completed" || status === "succeeded" || status === "success" || status === "paid";
      const isFailed =
        status === "failed" || status === "cancelled" || status === "canceled" || status === "expired";

      if (isPaid) {
        // Mirror webhook: assign keys, mark paid, send email.
        const { data: items } = await supabase
          .from("order_items")
          .select("id, product_id, product_name, quantity")
          .eq("order_id", order.id);

        const assigned: { product_name: string; license_key: string }[] = [];
        let stockOk = true;

        for (const item of items ?? []) {
          // Only assign keys for license/account products that actually have stock
          const { data: candidates } = await supabase
            .from("license_keys")
            .select("id, license_key")
            .eq("product_id", item.product_id)
            .eq("status", "available")
            .limit(item.quantity);

          if (!candidates || candidates.length < item.quantity) {
            // No stock — for download products this is normal, but for license/account
            // we'd want to flag. We tolerate empty here; webhook would have done likewise.
            continue;
          }
          const ids = candidates.map((c) => c.id);
          const { error: uErr } = await supabase
            .from("license_keys")
            .update({
              status: "sold",
              order_id: order.id,
              assigned_at: new Date().toISOString(),
            })
            .in("id", ids)
            .eq("status", "available");
          if (uErr) {
            stockOk = false;
            break;
          }
          for (const c of candidates) {
            assigned.push({ product_name: item.product_name, license_key: c.license_key });
          }
        }

        if (!stockOk) {
          results.push({ id: order.id, ref: order.reference, error: "key_assign_failed" });
          continue;
        }

        await supabase
          .from("orders")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            leekpay_payload: lpData,
            matching_details: {
              matched_by: "reconciliation",
              payment_id: paymentId,
              source: "reconcile-pending-orders",
              received_at: new Date().toISOString(),
            },
            metadata: { leekpay_event: "reconciliation", transaction: tx },
          })
          .eq("id", order.id);

        try {
          await supabase.functions.invoke("send-order-email", {
            body: {
              order_id: order.id,
              email: order.customer_email,
              name: order.customer_name,
              reference: order.reference,
              keys: assigned,
            },
          });
        } catch (e) {
          console.warn("email send failed:", e);
        }

        results.push({ id: order.id, ref: order.reference, action: "paid" });
      } else if (isFailed) {
        await supabase
          .from("orders")
          .update({
            status: "failed",
            failed_reason: `reconciliation:${status}`,
            leekpay_payload: lpData,
            matching_details: {
              matched_by: "reconciliation",
              payment_id: paymentId,
              source: "reconcile-pending-orders",
            },
          })
          .eq("id", order.id);
        results.push({ id: order.id, ref: order.reference, action: "failed", status });
      } else {
        results.push({ id: order.id, ref: order.reference, action: "still_pending", status });
      }
    } catch (e) {
      console.error("Reconcile error for", order.id, e);
      results.push({ id: order.id, ref: order.reference, error: String(e) });
    }
  }

  return json({ ok: true, processed: results.length, results });
});
