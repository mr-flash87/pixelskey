// Commandes d'administration (réservées aux ADMIN_CHAT_IDS).
import { db } from "./db.ts";
import { syncCatalogs } from "./catalog.ts";
import { deliverOrder, deliveryMessages } from "./fulfillment.ts";
import { syncableSuppliers } from "./suppliers/registry.ts";
import { esc, fcfa, tg } from "./telegram.ts";
import { getCommunity } from "./community.ts";

export const ADMIN_HELP = `🛠️ <b>Administration</b>

<b>Suivi</b>
/admin — ventes du jour, livraisons bloquées, soldes fournisseurs
/bloquees — commandes à traiter
/commande REF — détail d'une commande

<b>Livraisons</b>
/relancer REF — relancer une livraison bloquée
/relancer REF force — racheter chez le fournisseur (seulement après avoir vérifié qu'aucun achat n'a été fait)
/lier REF IDFOURNISSEUR — rattacher une commande fournisseur retrouvée
/livrer REF — puis, à la ligne, les accès à envoyer (livraison manuelle)
/rembourser REF — rembourser sur le solde du client

<b>Catalogue</b>
/sync — synchroniser les fournisseurs
/produits [page] — liste des produits
/publier ID · /masquer ID
/prix ID MONTANT — prix fixe (la synchro ne le change plus)
/categorie ID Nom de catégorie
/nom ID Nouveau nom
/nouveau PRIX | Catégorie | Nom — produit en stock manuel
/stock ID — puis, une ligne par clé/compte à ajouter

<b>Clients</b>
/crediter TELEGRAM_ID MONTANT — ajouter (ou retirer avec -) du solde
/groupe — groupe officiel (ajoutez le bot comme administrateur du groupe pour l'activer)
/bloquer TELEGRAM_ID · /debloquer TELEGRAM_ID`;

async function findOrder(ref: string) {
  const { data } = await db().from("orders").select("*").eq("ref", ref.toUpperCase()).maybeSingle();
  return data;
}

const reply = (chatId: number, html: string) => tg.send(chatId, html);

/** Retourne true si le message était une commande admin. */
export async function handleAdminCommand(chatId: number, text: string): Promise<boolean> {
  const [firstLine, ...rest] = text.split("\n");
  const [rawCmd, ...args] = firstLine.trim().split(/\s+/);
  const cmd = rawCmd.split("@")[0].toLowerCase();
  const lines = rest.map((l) => l.trim()).filter(Boolean);

  switch (cmd) {
    case "/admin": {
      const since = new Date(); since.setUTCHours(0, 0, 0, 0);
      const [{ data: sales }, { count: blocked }, { count: users }] = await Promise.all([
        db().from("orders").select("amount").eq("status", "paid").gte("paid_at", since.toISOString()),
        db().from("orders").select("id", { count: "exact", head: true }).eq("status", "paid").in("delivery_status", ["failed", "uncertain", "supplier_pending"]),
        db().from("bot_users").select("telegram_id", { count: "exact", head: true }),
      ]);
      const lines = [
        "📊 <b>Aujourd'hui</b>",
        `Ventes : ${sales?.length ?? 0} — ${fcfa((sales ?? []).reduce((s, o) => s + o.amount, 0))}`,
        `Livraisons à traiter : ${blocked ?? 0}${blocked ? " → /bloquees" : ""}`,
        `Clients : ${users ?? 0}`,
        "", "🏦 <b>Fournisseurs</b>",
      ];
      for (const a of syncableSuppliers()) {
        if (!a.balance) continue;
        try { const b = await a.balance(); lines.push(`${esc(a.id)} : ${Number.isFinite(b.amount) ? `${b.amount} ${esc(b.currency)}` : "n/d"}`); }
        catch (e) { lines.push(`${esc(a.id)} : ⚠️ ${esc(e instanceof Error ? e.message : "erreur")}`); }
      }
      lines.push("", "/aideadmin — toutes les commandes");
      await reply(chatId, lines.join("\n"));
      return true;
    }
    case "/aideadmin": await reply(chatId, ADMIN_HELP); return true;
    case "/bloquees": {
      const { data } = await db().from("orders").select("ref, product_name, delivery_status, delivery_error, paid_at").eq("status", "paid")
        .in("delivery_status", ["failed", "uncertain", "supplier_pending", "processing"]).order("paid_at").limit(30);
      if (!data?.length) { await reply(chatId, "✅ Aucune livraison bloquée."); return true; }
      await reply(chatId, data.map((o) => `<b>${esc(o.ref)}</b> · ${esc(o.product_name)} · ${esc(o.delivery_status)}\n${esc(o.delivery_error ?? "")}`).join("\n\n"));
      return true;
    }
    case "/commande": {
      const o = await findOrder(args[0] ?? "");
      if (!o) { await reply(chatId, "Commande introuvable."); return true; }
      await reply(chatId, `<b>${esc(o.ref)}</b>\nClient : <code>${o.telegram_id}</code>\n${esc(o.product_name)} ×${o.quantity} — ${fcfa(o.amount)} (${esc(o.pay_method)})\nPaiement : ${esc(o.status)} · Livraison : ${esc(o.delivery_status)}\nFournisseur : ${esc(o.supplier_order_id ?? "—")}${o.supplier_attempted_at ? " (achat tenté)" : ""}\n${esc(o.delivery_error ?? "")}`);
      return true;
    }
    case "/relancer": {
      const o = await findOrder(args[0] ?? "");
      if (!o) { await reply(chatId, "Commande introuvable."); return true; }
      if (args[1] === "force") {
        await db().from("orders").update({ supplier_attempted_at: null, delivery_status: "failed" }).eq("id", o.id).eq("status", "paid").in("delivery_status", ["failed", "uncertain"]).is("supplier_order_id", null);
      }
      const outcome = await deliverOrder(o.id, ["failed", "supplier_pending"]);
      await reply(chatId, outcome === "skipped" ? `${esc(o.ref)} : rien à relancer (statut ${esc(o.delivery_status)}). Pour une commande « uncertain », vérifiez chez le fournisseur puis /relancer ${esc(o.ref)} force ou /lier.` : `${esc(o.ref)} → ${outcome}`);
      return true;
    }
    case "/lier": {
      const o = await findOrder(args[0] ?? "");
      if (!o || !args[1]) { await reply(chatId, "Usage : /lier REF IDFOURNISSEUR"); return true; }
      await db().from("orders").update({ supplier_order_id: args[1], delivery_status: "supplier_pending" }).eq("id", o.id).eq("status", "paid").neq("delivery_status", "delivered");
      const outcome = await deliverOrder(o.id, ["supplier_pending"]);
      await reply(chatId, `${esc(o.ref)} rattachée à ${esc(args[1])} → ${outcome}`);
      return true;
    }
    case "/livrer": {
      const o = await findOrder(args[0] ?? "");
      if (!o || !lines.length) { await reply(chatId, "Usage : /livrer REF puis, à la ligne, les accès (une ligne par élément)."); return true; }
      if (o.status !== "paid") { await reply(chatId, "Cette commande n'est pas payée."); return true; }
      const { data: ok } = await db().rpc("record_delivery", { _order_id: o.id, _contents: lines, _supplier_order_id: null });
      if (!ok) { await reply(chatId, "Déjà livrée."); return true; }
      for (const m of deliveryMessages(o, lines)) await tg.send(o.telegram_id, m).catch(() => undefined);
      await reply(chatId, `✅ ${esc(o.ref)} livrée manuellement.`);
      return true;
    }
    case "/rembourser": {
      const o = await findOrder(args[0] ?? "");
      if (!o) { await reply(chatId, "Commande introuvable."); return true; }
      const { data: balance, error } = await db().rpc("refund_order_to_balance", { _order_id: o.id });
      if (error || balance == null) { await reply(chatId, "Remboursement impossible (commande non payée, déjà livrée ou déjà remboursée)."); return true; }
      await tg.send(o.telegram_id, `↩️ <b>Commande ${esc(o.ref)} remboursée</b> : ${fcfa(o.amount)} crédités sur votre solde (nouveau solde ${fcfa(balance)}).`).catch(() => undefined);
      await reply(chatId, `✅ ${esc(o.ref)} remboursée sur le solde.`);
      return true;
    }
    case "/sync": {
      await reply(chatId, "🔄 Synchronisation en cours…");
      const reports = await syncCatalogs(args[0]);
      await reply(chatId, reports.map((r) => r.error ? `❌ ${esc(r.supplier)} : ${esc(r.error)}` : `✅ ${esc(r.supplier)} : ${r.created} nouvelle(s), ${r.updated} mise(s) à jour, ${r.unavailable} indisponible(s)`).join("\n") || "Aucun fournisseur actif.");
      return true;
    }
    case "/produits": {
      const page = Math.max(0, Number(args[0] ?? 0) || 0);
      const { data } = await db().from("products").select("id, name, price, is_active, supplier_id, supplier_available, supplier_stock").order("id").range(page * 30, page * 30 + 29);
      await reply(chatId, (data ?? []).map((p) => `${p.is_active ? "🟢" : "⚪"} <b>${p.id}</b> ${esc(p.name)} — ${fcfa(p.price)} · ${esc(p.supplier_id)}${p.supplier_id !== "manual" ? ` (${p.supplier_available ? p.supplier_stock : "indispo"})` : ""}`).join("\n") || "Aucun produit.");
      return true;
    }
    case "/publier": case "/masquer": {
      const { error } = await db().from("products").update({ is_active: cmd === "/publier" }).eq("id", Number(args[0]));
      await reply(chatId, error ? "Produit introuvable." : `Produit ${esc(args[0])} ${cmd === "/publier" ? "publié 🟢" : "masqué ⚪"}.`);
      return true;
    }
    case "/prix": {
      const price = Number(args[1]);
      if (!Number.isInteger(price) || price < 100) { await reply(chatId, "Usage : /prix ID MONTANT (minimum 100 F)"); return true; }
      await db().from("products").update({ price, price_locked: true }).eq("id", Number(args[0]));
      await reply(chatId, `Prix du produit ${esc(args[0])} fixé à ${fcfa(price)}.`);
      return true;
    }
    case "/categorie": {
      const name = args.slice(1).join(" ").trim();
      if (!name) { await reply(chatId, "Usage : /categorie ID Nom"); return true; }
      await db().from("products").update({ category: name.slice(0, 40) }).eq("id", Number(args[0]));
      await reply(chatId, `Catégorie mise à jour.`);
      return true;
    }
    case "/nom": {
      const name = args.slice(1).join(" ").trim();
      if (!Number(args[0]) || !name) { await reply(chatId, "Usage : /nom ID Nouveau nom"); return true; }
      const { error } = await db().from("products").update({ name: name.slice(0, 120) }).eq("id", Number(args[0]));
      await reply(chatId, error ? "Produit introuvable." : `Nom du produit ${esc(args[0])} mis à jour.`);
      return true;
    }
    case "/groupe": {
      const c = await getCommunity();
      await reply(chatId, c
        ? `👥 Groupe officiel : <b>${esc(c.title)}</b>
Lien : ${esc(c.url || "—")}
Adhésion obligatoire et annonces actives.`
        : "Aucun groupe officiel. Ajoutez le bot comme <b>administrateur</b> de votre groupe ou canal pour l'activer.");
      return true;
    }
    case "/nouveau": {
      const [price, category, name] = firstLine.replace(/^\/nouveau(@\S+)?\s*/i, "").split("|").map((s) => s.trim());
      if (!Number.isInteger(Number(price)) || Number(price) < 100 || !category || !name) { await reply(chatId, "Usage : /nouveau 2500 | 🎬 Streaming | Netflix 1 mois"); return true; }
      const { data, error } = await db().from("products").insert({ supplier_id: "manual", name, category, price: Number(price), price_locked: true, is_active: true, description: lines.join("\n") }).select("id").single();
      await reply(chatId, error ? "Création impossible." : `✅ Produit ${data.id} créé. Ajoutez du stock : /stock ${data.id}`);
      return true;
    }
    case "/stock": {
      const id = Number(args[0]);
      if (!id || !lines.length) { await reply(chatId, "Usage : /stock ID puis, à la ligne, une clé/un compte par ligne."); return true; }
      const { error } = await db().from("stock_items").insert(lines.map((content) => ({ product_id: id, content })));
      await reply(chatId, error ? "Ajout impossible (produit introuvable ?)." : `✅ ${lines.length} élément(s) ajouté(s) au produit ${id}.`);
      return true;
    }
    case "/crediter": {
      const target = Number(args[0]); const amount = Number(args[1]);
      if (!Number.isSafeInteger(target) || !Number.isInteger(amount) || amount === 0) { await reply(chatId, "Usage : /crediter TELEGRAM_ID MONTANT"); return true; }
      const { data: balance, error } = await db().rpc("wallet_apply", { _telegram_id: target, _amount: amount, _kind: "admin", _ref: `admin-${chatId}-${Date.now()}` });
      if (error) { await reply(chatId, `Impossible : ${esc(error.message)}`); return true; }
      if (amount > 0) await tg.send(target, `💰 Votre solde a été crédité de ${fcfa(amount)}. Nouveau solde : ${fcfa(balance)}.`).catch(() => undefined);
      await reply(chatId, `✅ Nouveau solde de ${target} : ${fcfa(balance)}.`);
      return true;
    }
    case "/bloquer": case "/debloquer": {
      await db().from("bot_users").update({ is_blocked: cmd === "/bloquer" }).eq("telegram_id", Number(args[0]));
      await reply(chatId, "OK.");
      return true;
    }
  }
  return false;
}
