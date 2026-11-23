// retry-failed-deliveries
// Scans for paid orders whose key-delivery email failed (or is stuck in
// 'pending'/'sending' for too long) and re-invokes send-order-email.
//
// Usage: invoke manually (admin button) or schedule via cron.
// Public endpoint (no JWT) — protected by an internal token if you want.

import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { fulfillPrimeOrder } from "../_shared/fulfill-prime.ts";
import { fulfillDigitrustOrder } from "../_shared/fulfill-digitrust.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const MAX_ATTEMPTS = 5;
// Don't retry an attempt that started <2min ago (avoid hammering)
const COOLDOWN_MS = 2 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date(Date.now() - COOLDOWN_MS).toISOString();

  // Pick up: paid orders that are pending/failed AND not currently
  // being processed within the cooldown window.
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, customer_email, customer_name, reference, delivery_attempts, delivery_status, last_delivery_attempt_at")
    .eq("status", "paid")
    .in("delivery_status", ["pending", "failed", "sending"])
    .lt("delivery_attempts", MAX_ATTEMPTS)
    .or(`last_delivery_attempt_at.is.null,last_delivery_attempt_at.lt.${cutoff}`)
    .limit(50);

  if (error) {
    console.error("retry-failed-deliveries select error:", error);
    return json({ ok: false, error: error.message }, 500);
  }

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const o of orders ?? []) {
    if (!o.customer_email) {
      await supabase
        .from("orders")
        .update({
          delivery_status: "failed",
          delivery_error: "no customer_email on order",
          last_delivery_attempt_at: new Date().toISOString(),
        })
        .eq("id", o.id);
      results.push({ id: o.id, ok: false, error: "no email" });
      continue;
    }

    try {
      // Re-run supplier fulfillment first (idempotent: skips delivered items / own stock).
      try { await fulfillPrimeOrder(supabase, o.id); } catch (e) { console.error("fulfill retry", o.id, e); }
      const digitrustResult = await fulfillDigitrustOrder(supabase, o.id);
      if (!digitrustResult.ok) { results.push({ id: o.id, ok: false, error: "Livraison Digitrust à vérifier" }); continue; }
      const { data, error: invErr } = await supabase.functions.invoke("send-order-email", {
        body: {
          order_id: o.id,
          email: o.customer_email,
          name: o.customer_name,
          reference: o.reference,
        },
      });
      if (invErr) {
        results.push({ id: o.id, ok: false, error: String(invErr) });
      } else {
        results.push({ id: o.id, ok: !!(data as any)?.ok, error: (data as any)?.error });
      }
    } catch (e) {
      results.push({ id: o.id, ok: false, error: String(e) });
    }
  }

  // Permanently give up after MAX_ATTEMPTS
  await supabase
    .from("orders")
    .update({ delivery_status: "abandoned" })
    .eq("status", "paid")
    .gte("delivery_attempts", MAX_ATTEMPTS)
    .in("delivery_status", ["failed", "pending", "sending"]);

  return json({ ok: true, processed: results.length, results });
});
