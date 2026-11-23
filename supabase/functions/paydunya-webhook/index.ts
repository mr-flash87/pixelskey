import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { readPayDunyaConfig, serviceClient } from "../_shared/paydunya-config.ts";
import { confirmPayDunya, parsePayDunyaNotification, verifyPayDunyaHash } from "../_shared/paydunya.ts";
import { finalizePayDunyaOrder } from "../_shared/finalize-paydunya-order.ts";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const schema = z.object({ hash: z.string().regex(/^[a-fA-F0-9]{128}$/), token: z.string().min(1).max(200).regex(/^[a-zA-Z0-9_-]+$/) });
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  try {
    const raw = await req.text();
    if (raw.length > 100000) return json({ error: "Notification trop volumineuse" }, 413);
    const parsed = schema.safeParse(parsePayDunyaNotification(raw, req.headers.get("content-type") ?? ""));
    if (!parsed.success) return json({ error: "Notification invalide" }, 400);
    const config = await readPayDunyaConfig();
    if (!config.credentials) return json({ error: "PayDunya non configuré" }, 503);
    if (!await verifyPayDunyaHash(parsed.data.hash, config.credentials.master_key)) return json({ error: "Signature invalide" }, 401);
    const client = serviceClient();
    const { data: order, error } = await client.from("orders").select("id, status, amount, payment_id, payment_mode").eq("provider", "paydunya").eq("payment_id", parsed.data.token).maybeSingle();
    if (error) return json({ error: "Recherche de commande impossible" }, 500);
    if (!order) return json({ error: "Facture non encore associée" }, 409);
    if (order.status === "paid") return json({ ok: true, already_paid: true });
    const confirmed = await confirmPayDunya(parsed.data.token, order.payment_mode === "live" ? "live" : "test", config.credentials);
    if (confirmed.status === "completed") return json({ ok: true, ...await finalizePayDunyaOrder(order, confirmed) });
    if (["cancelled", "canceled", "failed"].includes(confirmed.status)) {
      await client.from("orders").update({ status: "failed", failed_reason: `paydunya:${confirmed.status}` }).eq("id", order.id).eq("status", "pending");
    }
    return json({ ok: true });
  } catch {
    return json({ error: "Confirmation PayDunya à reprendre" }, 500);
  }
});
