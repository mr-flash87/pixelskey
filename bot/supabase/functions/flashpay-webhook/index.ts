// Webhook FlashPay : payment.succeeded / payment.expired / payment.cancelled.
// 1. Signature HMAC vérifiée (et requêtes de plus de 5 minutes refusées).
// 2. Le paiement est RELU via l'API FlashPay : seul ce statut serveur déclenche une livraison.
// 3. Traitement idempotent (événement déjà vu ignoré, confirmation atomique en base).
import { db } from "../_shared/db.ts";
import { env } from "../_shared/env.ts";
import { flashpay, verifyFlashPaySignature } from "../_shared/flashpay.ts";
import { processPaidPayment } from "../_shared/payments.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  const raw = await req.text();
  if (raw.length > 100_000) return json({ error: "Trop volumineux" }, 413);
  const valid = await verifyFlashPaySignature(raw, req.headers.get("x-webhook-timestamp"), req.headers.get("x-webhook-signature"), env("FLASHPAY_WEBHOOK_SECRET"));
  if (!valid) return json({ error: "Signature invalide" }, 401);

  let event: { id?: string; type?: string; data?: { id?: string } };
  try { event = JSON.parse(raw); } catch { return json({ error: "JSON invalide" }, 400); }
  const paymentId = event.data?.id;
  if (!event.id || !paymentId || !/^[A-Za-z0-9_-]{1,64}$/.test(paymentId)) return json({ error: "Événement invalide" }, 400);

  const { data: seen } = await db().from("webhook_events").select("id").eq("id", event.id).maybeSingle();
  if (seen) return json({ ok: true, duplicate: true });

  const work = (async () => {
    const remote = await flashpay.get(paymentId);
    if (remote.status === "paid") await processPaidPayment(remote);
    else if (remote.status === "expired" || remote.status === "cancelled") {
      const { data: p } = await db().from("payments").update({ status: remote.status }).eq("id", paymentId).eq("status", "pending").select("order_id").maybeSingle();
      if (p?.order_id) await db().from("orders").update({ status: remote.status === "expired" ? "expired" : "cancelled" }).eq("id", p.order_id).eq("status", "pending");
    }
    // Marqué traité seulement après succès : en cas d'échec, FlashPay renverra l'événement.
    await db().from("webhook_events").insert({ id: event.id });
  })();

  try {
    // La confirmation du paiement est rapide ; la livraison fournisseur peut être longue.
    // FlashPay attend une réponse en moins de 10 s : au-delà, on termine en arrière-plan.
    const done = await Promise.race([work.then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), 8000))]);
    if (!done && typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work.catch((e) => console.error("flashpay webhook bg", e?.message)));
    return json({ ok: true });
  } catch (e) {
    console.error("flashpay webhook failed", e instanceof Error ? e.message : e);
    return json({ error: "Traitement à reprendre" }, 500);
  }
});
