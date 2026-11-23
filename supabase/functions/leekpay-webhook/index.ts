// LeekPay webhook handler
// - Verifies X-LeekPay-Signature using HMAC-SHA256 with the public key as the secret
//   (LeekPay docs: "Utilisez votre clé publique pour la vérifier")
// - On payment.success: marks order paid, atomically assigns license keys, sends email
// - Idempotent: replaying the same event does nothing once the order is already paid
//
// Public endpoint — no JWT verification.

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-leekpay-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Constant-time compare
const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

const hexHmacSha256 = async (key: string, message: string) => {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const rawBody = await req.text();
  const signature = req.headers.get("x-leekpay-signature") ?? "";

  const PUBLIC_KEY = Deno.env.get("LEEKPAY_PUBLIC_KEY");
  if (!PUBLIC_KEY) {
    console.error("LEEKPAY_PUBLIC_KEY missing");
    return json({ error: "Webhook not configured" }, 500);
  }

  // ── Signature verification (HMAC-SHA256, hex digest) ─────────
  const expected = await hexHmacSha256(PUBLIC_KEY, rawBody);
  if (!signature || !safeEqual(signature.trim().toLowerCase(), expected)) {
    console.warn("Invalid LeekPay signature");
    return json({ error: "Invalid signature" }, 401);
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const event = payload?.event as string | undefined;
  const tx = payload?.transaction ?? payload?.data ?? payload ?? {};
  const paymentId = tx?.id
    ? String(tx.id)
    : tx?.payment_id
      ? String(tx.payment_id)
      : tx?.reference
        ? String(tx.reference)
        : null;
  const description: string | undefined = tx?.description ?? payload?.description;

  console.log("Webhook received:", event, "payment_id:", paymentId, "raw:", JSON.stringify(payload).slice(0, 500));

  if (!paymentId && !description) return json({ error: "Missing transaction id" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Try to match the order by payment_id first, then by reference embedded
  // in the LeekPay description (we set "Pixels Key — Commande PK-XXXXXXXX")
  let order: any = null;
  let matchedBy: "payment_id" | "reference" | null = null;
  let matchedReference: string | null = null;

  if (paymentId) {
    const { data } = await supabase
      .from("orders")
      .select("id, status, customer_email, customer_name, amount, reference")
      .eq("payment_id", paymentId)
      .eq("provider", "leekpay")
      .maybeSingle();
    if (data) {
      order = data;
      matchedBy = "payment_id";
    }
  }
  if (!order && description) {
    const refMatch = description.match(/PK-[A-Z0-9]+/);
    if (refMatch) {
      matchedReference = refMatch[0];
      const { data } = await supabase
        .from("orders")
        .select("id, status, customer_email, customer_name, amount, reference")
        .eq("reference", refMatch[0])
        .eq("provider", "leekpay")
        .maybeSingle();
      if (data) {
        order = data;
        matchedBy = "reference";
        // Backfill payment_id so future webhooks match directly
        if (paymentId) {
          await supabase.from("orders").update({ payment_id: paymentId }).eq("id", order.id);
        }
      }
    }
  }

  // Persist the raw payload + matching details on EVERY webhook for audit
  if (order) {
    await supabase
      .from("orders")
      .update({
        leekpay_payload: payload,
        matching_details: {
          matched_by: matchedBy,
          payment_id: paymentId,
          reference: matchedReference,
          event,
          received_at: new Date().toISOString(),
        },
      })
      .eq("id", order.id);
  }

  if (!order) {
    console.warn(`Webhook for unknown payment ${paymentId} / ${description}`);
    // Return 200 so LeekPay doesn't retry forever for an unknown id
    return json({ ok: true, ignored: true });
  }

  // ── Failure events ─────────────────────────────────────────
  if (event === "payment.failed" || event === "payment.cancelled") {
    if (order.status === "pending") {
      await supabase
        .from("orders")
        .update({ status: "failed", failed_reason: event })
        .eq("id", order.id);
    }
    return json({ ok: true });
  }

  // ── Success ────────────────────────────────────────────────
  if (event !== "payment.success" && tx?.status !== "completed") {
    return json({ ok: true, ignored: true });
  }

  // Idempotency: if already paid, just return
  if (order.status === "paid") {
    return json({ ok: true, already_paid: true });
  }

  // ── Assign license keys atomically ─────────────────────────
  // For each order item, lock N available keys and assign them.
  // Products sourced from Prime Labs (primestore_id set) are NOT taken
  // from the local license_keys pool — they are bought from Prime Labs
  // by the fulfill-primestore-order function right after.
  const { data: items, error: iErr } = await supabase
    .from("order_items")
    .select("id, product_id, product_name, quantity, products(primestore_id)")
    .eq("order_id", order.id);

  if (iErr || !items) {
    console.error("Items fetch error:", iErr);
    return json({ error: "DB error" }, 500);
  }

  const assignedKeys: { product_name: string; license_key: string }[] = [];
  let hasPrimestoreItems = false;

  for (const item of items) {
    const prod = Array.isArray(item.products) ? item.products[0] : item.products;
    if (prod?.primestore_id) {
      hasPrimestoreItems = true;
      continue; // fulfilled via Prime Labs below
    }

    // Pick N available keys for this product
    const { data: candidates, error: cErr } = await supabase
      .from("license_keys")
      .select("id, license_key")
      .eq("product_id", item.product_id)
      .eq("status", "available")
      .limit(item.quantity);

    if (cErr || !candidates || candidates.length < item.quantity) {
      console.error(`Stock épuisé pour ${item.product_name}`, cErr);
      await supabase
        .from("orders")
        .update({
          status: "failed",
          failed_reason: `Stock épuisé: ${item.product_name}`,
        })
        .eq("id", order.id);
      return json({ error: "Stock épuisé après paiement" }, 500);
    }

    const keyIds = candidates.map((c) => c.id);
    const { error: uErr } = await supabase
      .from("license_keys")
      .update({
        status: "sold",
        order_id: order.id,
        assigned_at: new Date().toISOString(),
      })
      .in("id", keyIds)
      .eq("status", "available"); // race-protection

    if (uErr) {
      console.error("Key assignment error:", uErr);
      return json({ error: "Attribution échouée" }, 500);
    }

    for (const c of candidates) {
      assignedKeys.push({
        product_name: item.product_name,
        license_key: c.license_key,
      });
    }
  }

  // Mark order as paid (delivery_status starts as 'pending' so the
  // retry job can pick it up if email send fails below).
  await supabase
    .from("orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      delivery_status: "pending",
      metadata: { leekpay_event: event, transaction: tx },
    })
    .eq("id", order.id);

  // ── Prime Labs fulfillment (best-effort, non-blocking) ─────
  // Buys the primestore items from the supplier and stores the
  // delivered credentials in license_deliveries. Failures are
  // recorded per-item and can be retried from the admin.
  if (hasPrimestoreItems) {
    try {
      const { data: fData, error: fErr } = await supabase.functions.invoke(
        "fulfill-primestore-order",
        { body: { order_id: order.id } },
      );
      if (fErr) console.warn("fulfill-primestore-order error:", fErr);
      else console.log("fulfill-primestore-order:", JSON.stringify(fData));
    } catch (e) {
      console.warn("Prime Labs fulfillment failed (non-blocking):", e);
    }

    // Merge Prime Labs deliveries into the email payload
    const { data: deliveries } = await supabase
      .from("license_deliveries")
      .select("content, status, order_items(product_name)")
      .eq("order_id", order.id)
      .eq("status", "delivered");
    for (const d of deliveries ?? []) {
      const oi = Array.isArray(d.order_items) ? d.order_items[0] : d.order_items;
      assignedKeys.push({
        product_name: oi?.product_name ?? "Produit",
        license_key: d.content,
      });
    }
  }

  // ── Best-effort: send email with the keys ──────────────────
  // send-order-email NEVER throws — it returns 200 with { ok, fallback }.
  // If email fails, the order stays in delivery_status='failed' and the
  // retry-failed-deliveries job will re-attempt it. Keys are already
  // assigned in DB and visible on the order page either way.
  let emailOk = false;
  try {
    const { data, error } = await supabase.functions.invoke("send-order-email", {
      body: {
        order_id: order.id,
        email: order.customer_email,
        name: order.customer_name,
        reference: order.reference,
        keys: assignedKeys,
      },
    });
    if (error) {
      console.warn("send-order-email invoke error:", error);
    } else if ((data as any)?.ok) {
      emailOk = true;
    } else {
      console.warn("send-order-email returned fallback:", data);
    }
  } catch (e) {
    console.warn("Email send failed (non-blocking):", e);
  }

  return json({ ok: true, order_id: order.id, email_sent: emailOk });
});
