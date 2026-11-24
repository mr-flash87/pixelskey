// Tâches planifiées (appelées par pg_cron avec Authorization: Bearer CRON_TOKEN).
//   {"action":"tick"}  toutes les 5 min : rattrape paiements et livraisons
//   {"action":"sync"}  toutes les heures : synchronise les catalogues fournisseurs
//   {"action":"setup"} une fois : enregistre le webhook et les commandes du bot
import { db, setting } from "../_shared/db.ts";
import { env, optionalEnv, safeEqual } from "../_shared/env.ts";
import { flashpay } from "../_shared/flashpay.ts";
import { processPaidPayment } from "../_shared/payments.ts";
import { deliverOrder } from "../_shared/fulfillment.ts";
import { syncCatalogs } from "../_shared/catalog.ts";
import { notifyAdmins } from "../_shared/notify.ts";
import { esc, tg } from "../_shared/telegram.ts";
import { announceNewProducts } from "../_shared/community.ts";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

async function tick() {
  const report = { payments_checked: 0, payments_paid: 0, delivered_retry: 0, supplier_polled: 0, stale: 0, announced: 0 };

  // 1) Paiements en attente : un webhook perdu ne doit jamais faire perdre une vente.
  const { data: pending } = await db().from("payments").select("id").eq("status", "pending").gte("created_at", ago(180)).lte("created_at", ago(1)).limit(50);
  for (const p of pending ?? []) {
    report.payments_checked++;
    try {
      const remote = await flashpay.get(p.id);
      if (remote.status === "paid") { await processPaidPayment(remote); report.payments_paid++; }
      else if (remote.status !== "pending") {
        const { data: row } = await db().from("payments").update({ status: remote.status }).eq("id", p.id).eq("status", "pending").select("order_id").maybeSingle();
        if (row?.order_id) await db().from("orders").update({ status: remote.status === "expired" ? "expired" : "cancelled" }).eq("id", row.order_id).eq("status", "pending");
      }
    } catch (e) { console.error("payment check failed", p.id, e instanceof Error ? e.message : e); }
  }
  await db().from("payments").update({ status: "expired" }).eq("status", "pending").lt("created_at", ago(24 * 60));

  // 2) Commandes payées jamais livrées (fonction interrompue juste après le paiement).
  const { data: notStarted } = await db().from("orders").select("id").eq("status", "paid").eq("delivery_status", "none").lte("paid_at", ago(2)).limit(20);
  for (const o of notStarted ?? []) { await deliverOrder(o.id, ["none"]).catch(() => undefined); report.delivered_retry++; }

  // 3) Commandes acceptées par le fournisseur, accès pas encore reçus.
  const { data: waiting } = await db().from("orders").select("id").eq("status", "paid").eq("delivery_status", "supplier_pending").limit(20);
  for (const o of waiting ?? []) { await deliverOrder(o.id, ["supplier_pending"]).catch(() => undefined); report.supplier_polled++; }

  // 4) Livraisons restées "processing" (exécution coupée en plein milieu).
  const { data: stale } = await db().from("orders").select("id, ref, supplier_attempted_at, supplier_order_id").eq("status", "paid").eq("delivery_status", "processing").lt("delivery_claimed_at", ago(10)).limit(20);
  for (const o of stale ?? []) {
    report.stale++;
    if (o.supplier_order_id) await db().from("orders").update({ delivery_status: "supplier_pending" }).eq("id", o.id).eq("delivery_status", "processing");
    else if (!o.supplier_attempted_at) await db().from("orders").update({ delivery_status: "none" }).eq("id", o.id).eq("delivery_status", "processing");
    else {
      await db().from("orders").update({ delivery_status: "uncertain", delivery_error: "Exécution interrompue pendant l'achat fournisseur" }).eq("id", o.id).eq("delivery_status", "processing");
      await notifyAdmins(`⚠️ ${esc(o.ref)} : exécution interrompue pendant l'achat fournisseur. Vérifiez chez le fournisseur, puis /lier ou /relancer ${esc(o.ref)} force.`);
    }
  }
  // 5) Nouveaux services annoncés dans le groupe officiel.
  report.announced = await announceNewProducts().catch(() => 0);
  return report;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  // Jeton : secret CRON_TOKEN, sinon jeton généré en base (settings.cron_token, lu aussi par pg_cron).
  const expected = optionalEnv("CRON_TOKEN") ?? String(await setting("cron_token", ""));
  if (!token || expected.length < 32 || !safeEqual(token, expected)) return json({ error: "Non autorisé" }, 401);
  const { action } = await req.json().catch(() => ({ action: "tick" }));
  try {
    if (action === "sync") {
      const reports = await syncCatalogs();
      const errors = reports.filter((r) => r.error);
      if (errors.length) await notifyAdmins(errors.map((r) => `⚠️ Synchro ${esc(r.supplier)} : ${esc(r.error)}`).join("\n"));
      return json({ ok: true, reports });
    }
    if (action === "setup") {
      const url = `${env("SUPABASE_URL")}/functions/v1/telegram-webhook`;
      await tg.setWebhook(url, env("TELEGRAM_WEBHOOK_SECRET"));
      await tg.setCommands([
        { command: "start", description: "Menu principal" },
        { command: "boutique", description: "Voir les offres" },
        { command: "commandes", description: "Mes commandes et mes accès" },
        { command: "solde", description: "Mon solde et recharge" },
        { command: "parrainage", description: "Inviter des amis" },
        { command: "aide", description: "Comment ça marche" },
      ]);
      const me = await tg.getMe();
      return json({ ok: true, webhook: url, bot: me.username });
    }
    return json({ ok: true, ...await tick() });
  } catch (e) {
    console.error("cron failed", e instanceof Error ? e.message : e);
    return json({ error: e instanceof Error ? e.message : "Erreur" }, 500);
  }
});
