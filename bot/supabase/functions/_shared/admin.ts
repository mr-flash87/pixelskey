// Actions d'administration (réservées aux ADMIN_CHAT_IDS), partagées par le tableau de bord
// à boutons (admin_panel.ts) et par les commandes texte (/relancer, /prix…), toujours disponibles.
import { db } from "./db.ts";
import { syncCatalogs } from "./catalog.ts";
import { deliverOrder, deliveryMessages } from "./fulfillment.ts";
import { esc, fcfa, tg } from "./telegram.ts";
import { getCommunity } from "./community.ts";

export const ADMIN_HELP = `🛠️ <b>Administration</b>

Le plus simple : <b>/admin</b> ouvre le tableau de bord à boutons
(commandes à traiter, produits, nouveau produit, clients, réglages).

Les commandes texte restent disponibles :

<b>Suivi</b>
/admin — tableau de bord
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

export async function findOrder(ref: string) {
  const { data } = await db().from("orders").select("*").eq("ref", ref.trim().toUpperCase()).maybeSingle();
  return data;
}

/** Relance une livraison ; `force` autorise un nouvel achat fournisseur (après vérification manuelle). */
export async function relaunchOrder(ref: string, force = false): Promise<string> {
  const o = await findOrder(ref);
  if (!o) return "Commande introuvable.";
  if (force) {
    await db().from("orders").update({ supplier_attempted_at: null, delivery_status: "failed" }).eq("id", o.id).eq("status", "paid").in("delivery_status", ["failed", "uncertain"]).is("supplier_order_id", null);
  }
  const outcome = await deliverOrder(o.id, ["failed", "supplier_pending"]);
  if (outcome === "skipped") {
    return `${esc(o.ref)} : rien à relancer (statut ${esc(o.delivery_status)}).` + (o.delivery_status === "uncertain" ? " Vérifiez chez le fournisseur, puis « Racheter » ou « Lier »." : "");
  }
  const labels: Record<string, string> = { delivered: "✅ livrée", supplier_pending: "⏳ en cours chez le fournisseur", failed: "❌ toujours bloquée", uncertain: "⚠️ résultat incertain" };
  return `${esc(o.ref)} → ${labels[outcome] ?? esc(outcome)}`;
}

export async function linkOrder(ref: string, supplierOrderId: string): Promise<string> {
  const o = await findOrder(ref);
  if (!o || !supplierOrderId.trim()) return "Commande ou identifiant fournisseur manquant.";
  await db().from("orders").update({ supplier_order_id: supplierOrderId.trim(), delivery_status: "supplier_pending" }).eq("id", o.id).eq("status", "paid").neq("delivery_status", "delivered");
  const outcome = await deliverOrder(o.id, ["supplier_pending"]);
  return `${esc(o.ref)} rattachée à ${esc(supplierOrderId.trim())} → ${esc(outcome)}`;
}

export async function deliverManually(ref: string, contents: string[]): Promise<string> {
  const o = await findOrder(ref);
  if (!o) return "Commande introuvable.";
  if (!contents.length) return "Aucun accès à envoyer.";
  if (o.status !== "paid") return "Cette commande n'est pas payée.";
  const { data: ok } = await db().rpc("record_delivery", { _order_id: o.id, _contents: contents, _supplier_order_id: null });
  if (!ok) return "Déjà livrée.";
  for (const m of deliveryMessages(o, contents)) await tg.send(o.telegram_id, m).catch(() => undefined);
  return `✅ ${esc(o.ref)} livrée manuellement.`;
}

export async function refundOrder(ref: string): Promise<string> {
  const o = await findOrder(ref);
  if (!o) return "Commande introuvable.";
  const { data: balance, error } = await db().rpc("refund_order_to_balance", { _order_id: o.id });
  if (error || balance == null) return "Remboursement impossible (commande non payée, déjà livrée ou déjà remboursée).";
  await tg.send(o.telegram_id, `↩️ <b>Commande ${esc(o.ref)} remboursée</b> : ${fcfa(o.amount)} crédités sur votre solde (nouveau solde ${fcfa(balance)}).`).catch(() => undefined);
  return `✅ ${esc(o.ref)} remboursée sur le solde du client.`;
}

export async function runSync(supplier?: string): Promise<string> {
  const reports = await syncCatalogs(supplier);
  return reports.map((r) => r.error ? `❌ ${esc(r.supplier)} : ${esc(r.error)}` : `✅ ${esc(r.supplier)} : ${r.created} nouvelle(s), ${r.updated} mise(s) à jour, ${r.unavailable} indisponible(s)`).join("\n") || "Aucun fournisseur actif.";
}

export async function createManualProduct(p: { name: string; category: string; price: number; description: string; active: boolean }): Promise<number | null> {
  const { data, error } = await db().from("products").insert({
    supplier_id: "manual", name: p.name.slice(0, 120), category: p.category.slice(0, 40), price: p.price, price_locked: true,
    is_active: p.active, description: p.description.slice(0, 3000),
  }).select("id").single();
  return error ? null : data.id;
}

export async function addStock(productId: number, lines: string[]): Promise<string> {
  if (!lines.length) return "Aucun élément à ajouter.";
  const { error } = await db().from("stock_items").insert(lines.map((content) => ({ product_id: productId, content })));
  return error ? "Ajout impossible (produit introuvable ?)." : `✅ ${lines.length} élément(s) ajouté(s) au stock du produit ${productId}.`;
}

/** Ajoute (montant > 0) ou retire (montant < 0) du solde d'un client. */
export async function creditUser(adminId: number, target: number, amount: number): Promise<string> {
  const { data: balance, error } = await db().rpc("wallet_apply", { _telegram_id: target, _amount: amount, _kind: "admin", _ref: `admin-${adminId}-${Date.now()}` });
  if (error) return `Impossible : ${esc(error.message)}`;
  if (amount > 0) await tg.send(target, `💰 Votre solde a été crédité de ${fcfa(amount)}. Nouveau solde : ${fcfa(balance)}.`).catch(() => undefined);
  return `✅ Nouveau solde de ${target} : ${fcfa(balance)}.`;
}

const reply = (chatId: number, html: string) => tg.send(chatId, html);

/** Commandes texte. Retourne true si le message était une commande admin. */
export async function handleAdminCommand(chatId: number, text: string): Promise<boolean> {
  const [firstLine, ...rest] = text.split("\n");
  const [rawCmd, ...args] = firstLine.trim().split(/\s+/);
  const cmd = rawCmd.split("@")[0].toLowerCase();
  const lines = rest.map((l) => l.trim()).filter(Boolean);

  switch (cmd) {
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
    case "/relancer": await reply(chatId, await relaunchOrder(args[0] ?? "", args[1] === "force")); return true;
    case "/lier":
      await reply(chatId, args[1] ? await linkOrder(args[0] ?? "", args[1]) : "Usage : /lier REF IDFOURNISSEUR");
      return true;
    case "/livrer":
      await reply(chatId, lines.length ? await deliverManually(args[0] ?? "", lines) : "Usage : /livrer REF puis, à la ligne, les accès (une ligne par élément).");
      return true;
    case "/rembourser": await reply(chatId, await refundOrder(args[0] ?? "")); return true;
    case "/sync": {
      await reply(chatId, "🔄 Synchronisation en cours…");
      await reply(chatId, await runSync(args[0]));
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
        ? `👥 Groupe officiel : <b>${esc(c.title)}</b>\nLien : ${esc(c.url || "—")}\nAdhésion obligatoire et annonces actives.`
        : "Aucun groupe officiel. Ajoutez le bot comme <b>administrateur</b> de votre groupe ou canal pour l'activer.");
      return true;
    }
    case "/nouveau": {
      const [price, category, name] = firstLine.replace(/^\/nouveau(@\S+)?\s*/i, "").split("|").map((s) => s.trim());
      if (!Number.isInteger(Number(price)) || Number(price) < 100 || !category || !name) { await reply(chatId, "Usage : /nouveau 2500 | 🎬 Streaming | Netflix 1 mois\n(ou plus simple : /admin → ➕ Nouveau produit)"); return true; }
      const id = await createManualProduct({ name, category, price: Number(price), description: lines.join("\n"), active: true });
      await reply(chatId, id ? `✅ Produit ${id} créé. Ajoutez du stock : /stock ${id}` : "Création impossible.");
      return true;
    }
    case "/stock": {
      const id = Number(args[0]);
      if (!id || !lines.length) { await reply(chatId, "Usage : /stock ID puis, à la ligne, une clé/un compte par ligne."); return true; }
      await reply(chatId, await addStock(id, lines));
      return true;
    }
    case "/crediter": {
      const target = Number(args[0]); const amount = Number(args[1]);
      if (!Number.isSafeInteger(target) || !Number.isInteger(amount) || amount === 0) { await reply(chatId, "Usage : /crediter TELEGRAM_ID MONTANT"); return true; }
      await reply(chatId, await creditUser(chatId, target, amount));
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
