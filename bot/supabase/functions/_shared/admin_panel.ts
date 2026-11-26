// Tableau de bord admin à boutons (callback_data « a:… ») et formulaires guidés
// (état « adm » dans bot_users.state, une question à la fois). Réservé aux ADMIN_CHAT_IDS.
import { db, setting, type BotUser } from "./db.ts";
import { esc, fcfa, tg, type Keyboard } from "./telegram.ts";
import { syncableSuppliers } from "./suppliers/registry.ts";
import { getCommunity } from "./community.ts";
import { LINE } from "./ui.ts";
import { addStock, createManualProduct, creditUser, deliverManually, findOrder, linkOrder, refundOrder, relaunchOrder, runSync } from "./admin.ts";

type Screen = { text: string; keyboard: Keyboard };
type Btn = { text: string; callback_data: string };
const btn = (text: string, data: string): Btn => ({ text, callback_data: data });
const adminRow = () => [btn("🛠️ Tableau de bord", "a:home")];
const cancelRow = () => [btn("❌ Annuler", "a:cancel")];
const short = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s);
const PAGE = 10;
const TODO = ["failed", "uncertain", "supplier_pending", "processing"];

const DELIVERY_LABEL: Record<string, string> = {
  none: "—", processing: "⏳ en cours", delivered: "✅ livrée", supplier_pending: "⏳ chez le fournisseur",
  failed: "❌ bloquée", uncertain: "⚠️ incertaine",
};
const PAY_LABEL: Record<string, string> = { pending: "⏳ en attente", paid: "✅ payée", cancelled: "❌ annulée", expired: "⌛ expirée", refunded: "↩️ remboursée" };

/** État des formulaires admin. */
type AdminState =
  | { kind: "new"; step: "name" | "cat" | "price" | "desc" | "confirm"; name?: string; category?: string; price?: number; description?: string; cats?: string[] }
  | { kind: "pedit"; field: "price" | "name" | "desc" | "cat" | "stock"; id: number }
  | { kind: "order"; field: "find" | "link" | "deliver"; ref?: string }
  | { kind: "user"; field: "find" | "credit" | "debit"; id?: number }
  | { kind: "setting"; key: string }
  | { kind: "margin"; supplier: string };

const setState = (id: number, state: AdminState | null) =>
  db().from("bot_users").update({ state: state ? "adm" : null, state_data: state ?? {} }).eq("telegram_id", id);

// ─────────────────────────── Écrans ───────────────────────────

export async function adminHome(): Promise<Screen> {
  const since = new Date(); since.setUTCHours(0, 0, 0, 0);
  const [{ data: sales }, { count: todo }, { count: users }, { count: newUsers }, { count: active }] = await Promise.all([
    db().from("orders").select("amount").eq("status", "paid").gte("paid_at", since.toISOString()),
    db().from("orders").select("id", { count: "exact", head: true }).eq("status", "paid").in("delivery_status", TODO),
    db().from("bot_users").select("telegram_id", { count: "exact", head: true }),
    db().from("bot_users").select("telegram_id", { count: "exact", head: true }).gte("created_at", since.toISOString()),
    db().from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);
  const total = (sales ?? []).reduce((s, o) => s + o.amount, 0);
  const text = [
    "🛠️ <b>TABLEAU DE BORD</b>",
    LINE,
    "📊 <b>Aujourd'hui</b>",
    `💰 Ventes : <b>${sales?.length ?? 0}</b> · ${fcfa(total)}`,
    `👤 Nouveaux clients : <b>${newUsers ?? 0}</b> (total ${users ?? 0})`,
    `🛍️ Produits en ligne : <b>${active ?? 0}</b>`,
    todo ? `🚨 Livraisons à traiter : <b>${todo}</b>` : "✅ Aucune livraison à traiter",
    LINE,
    "Choisissez une action 👇",
  ].join("\n");
  return {
    text,
    keyboard: [
      [btn(`🚨 À traiter${todo ? ` (${todo})` : ""}`, "a:todo"), btn("📦 Commandes", "a:orders:0")],
      [btn("🛍️ Produits", "a:pc"), btn("➕ Nouveau produit", "a:np")],
      [btn("👤 Clients", "a:users"), btn("🔄 Synchroniser", "a:sync")],
      [btn("🏦 Fournisseurs", "a:sup"), btn("⚙️ Réglages", "a:set")],
      [btn("🏠 Voir la boutique (client)", "home")],
    ],
  };
}

async function todoScreen(): Promise<Screen> {
  const { data } = await db().from("orders").select("ref, product_name, delivery_status").eq("status", "paid").in("delivery_status", TODO).order("paid_at").limit(20);
  if (!data?.length) return { text: "✅ <b>Aucune livraison à traiter.</b>", keyboard: [adminRow()] };
  return {
    text: `🚨 <b>LIVRAISONS À TRAITER</b> (${data.length})\n${LINE}\nTouchez une commande pour agir.`,
    keyboard: [...data.map((o) => [btn(`${DELIVERY_LABEL[o.delivery_status]?.split(" ")[0] ?? "•"} ${o.ref} · ${short(o.product_name, 30)}`, `a:o:${o.ref}`)]), adminRow()],
  };
}

async function ordersScreen(page: number, userId?: number): Promise<Screen> {
  let q = db().from("orders").select("ref, product_name, amount, status, delivery_status").neq("status", "cancelled").order("created_at", { ascending: false });
  if (userId) q = q.eq("telegram_id", userId);
  const { data } = await q.range(page * PAGE, page * PAGE + PAGE);
  const rows = (data ?? []).slice(0, PAGE);
  const nav: Btn[] = [];
  const base = userId ? `a:uo:${userId}` : "a:orders";
  if (page > 0) nav.push(btn("◀️ Précédent", `${base}:${page - 1}`));
  if ((data ?? []).length > PAGE) nav.push(btn("Suivant ▶️", `${base}:${page + 1}`));
  const icon = (o: { status: string; delivery_status: string }) => o.status !== "paid" ? "⏳" : o.delivery_status === "delivered" ? "✅" : TODO.includes(o.delivery_status) ? "🚨" : "•";
  return {
    text: `📦 <b>${userId ? `COMMANDES DU CLIENT ${userId}` : "DERNIÈRES COMMANDES"}</b>\n${LINE}\n${rows.length ? "✅ livrée · 🚨 à traiter · ⏳ non payée" : "Aucune commande."}`,
    keyboard: [
      ...rows.map((o) => [btn(`${icon(o)} ${o.ref} · ${short(o.product_name, 22)} · ${fcfa(o.amount)}`, `a:o:${o.ref}`)]),
      ...(nav.length ? [nav] : []),
      [btn("🔎 Chercher une référence", "a:of")],
      userId ? [btn("⬅️ Client", `a:u:${userId}`), ...adminRow()] : adminRow(),
    ],
  };
}

async function orderScreen(ref: string): Promise<Screen> {
  const o = await findOrder(ref);
  if (!o) return { text: "Commande introuvable.", keyboard: [[btn("🔎 Chercher une autre", "a:of")], adminRow()] };
  const { data: u } = await db().from("bot_users").select("first_name, username").eq("telegram_id", o.telegram_id).maybeSingle();
  const client = `${esc(u?.first_name ?? "Client")}${u?.username ? ` (@${esc(u.username)})` : ""} · <code>${o.telegram_id}</code>`;
  const text = [
    `🧾 <b>${esc(o.ref)}</b>`,
    LINE,
    `📦 ${esc(o.product_name)} ×${o.quantity}`,
    `💵 ${fcfa(o.amount)} · ${o.pay_method === "balance" ? "solde" : "Mobile Money"}`,
    `👤 ${client}`,
    `💳 Paiement : ${PAY_LABEL[o.status] ?? esc(o.status)}`,
    `🚚 Livraison : ${DELIVERY_LABEL[o.delivery_status] ?? esc(o.delivery_status)}`,
    o.supplier_order_id ? `🏷️ Réf. fournisseur : <code>${esc(o.supplier_order_id)}</code>` : o.supplier_attempted_at ? "🏷️ Achat fournisseur tenté, sans réponse connue" : "",
    o.delivery_error ? `\n⚠️ ${esc(o.delivery_error)}` : "",
  ].filter(Boolean).join("\n");
  const kb: Keyboard = [];
  const open = o.status === "paid" && o.delivery_status !== "delivered";
  if (open) {
    kb.push([btn("🔁 Relancer la livraison", `a:rl:${o.ref}`)]);
    if (["failed", "uncertain"].includes(o.delivery_status) && o.supplier_attempted_at && !o.supplier_order_id) kb.push([btn("⚡ Racheter chez le fournisseur", `a:rf:${o.ref}`)]);
    kb.push([btn("🔗 Lier une réf. fournisseur", `a:lk:${o.ref}`), btn("✍️ Livrer à la main", `a:lv:${o.ref}`)]);
    kb.push([btn("↩️ Rembourser sur le solde", `a:rb:${o.ref}`)]);
  }
  kb.push([btn("👤 Voir le client", `a:u:${o.telegram_id}`), btn("🔄 Actualiser", `a:o:${o.ref}`)]);
  kb.push([btn("⬅️ À traiter", "a:todo"), ...adminRow()]);
  return { text, keyboard: kb };
}

/** Catégories de tous les produits (publiés ou non), triées : l'index sert dans les boutons. */
async function allCategories(): Promise<{ name: string; total: number; active: number }[]> {
  const { data } = await db().from("products").select("category, is_active");
  const m = new Map<string, { total: number; active: number }>();
  for (const r of data ?? []) {
    const c = m.get(r.category) ?? { total: 0, active: 0 };
    c.total++; if (r.is_active) c.active++;
    m.set(r.category, c);
  }
  return [...m.entries()].map(([name, c]) => ({ name, ...c })).sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

async function productCatsScreen(): Promise<Screen> {
  const cats = await allCategories();
  return {
    text: `🛍️ <b>PRODUITS</b>\n${LINE}\nChoisissez une catégorie.\n🟢 en ligne / total`,
    keyboard: [
      ...cats.map((c, i) => [btn(`${c.name} · 🟢 ${c.active}/${c.total}`, `a:pl:${i}:0`)]),
      [btn("🔎 Chercher un produit", "a:ps"), btn("➕ Nouveau produit", "a:np")],
      adminRow(),
    ],
  };
}

async function productListScreen(catIndex: number, page: number): Promise<Screen> {
  const cats = await allCategories();
  const cat = cats[catIndex];
  if (!cat) return productCatsScreen();
  const { data } = await db().from("products").select("id, name, price, is_active").eq("category", cat.name).order("is_active", { ascending: false }).order("name").range(page * PAGE, page * PAGE + PAGE);
  const rows = (data ?? []).slice(0, PAGE);
  const nav: Btn[] = [];
  if (page > 0) nav.push(btn("◀️ Précédent", `a:pl:${catIndex}:${page - 1}`));
  if ((data ?? []).length > PAGE) nav.push(btn("Suivant ▶️", `a:pl:${catIndex}:${page + 1}`));
  return {
    text: `🛍️ <b>${esc(cat.name)}</b>\n${LINE}\n🟢 en ligne · ⚪ masqué — touchez un produit pour le modifier.`,
    keyboard: [
      ...rows.map((p) => [btn(`${p.is_active ? "🟢" : "⚪"} ${short(p.name, 30)} · ${fcfa(p.price)}`, `a:p:${p.id}`)]),
      ...(nav.length ? [nav] : []),
      [btn("⬅️ Catégories", "a:pc"), ...adminRow()],
    ],
  };
}

async function productScreen(id: number): Promise<Screen> {
  const { data: p } = await db().from("products").select("*").eq("id", id).maybeSingle();
  if (!p) return { text: "Produit introuvable.", keyboard: [[btn("⬅️ Produits", "a:pc")], adminRow()] };
  const manual = p.supplier_id === "manual";
  let stockLine: string;
  if (manual) {
    const { count } = await db().from("stock_items").select("id", { count: "exact", head: true }).eq("product_id", id).eq("status", "available");
    stockLine = `📥 Stock manuel : <b>${count ?? 0}</b> élément(s)`;
  } else stockLine = `🏷️ ${esc(p.supplier_id)} · ${p.supplier_available ? `stock ${p.supplier_stock}` : "indisponible chez le fournisseur"}`;
  const desc = (p.description ?? "").trim();
  const text = [
    `${p.is_active ? "🟢 <b>En ligne</b>" : "⚪ <b>Masqué</b>"} · produit n° ${p.id}`,
    LINE,
    `📦 <b>${esc(p.name)}</b>`,
    `🗂️ ${esc(p.category)}`,
    `💵 ${fcfa(p.price)}${p.price_locked ? " (prix fixé à la main)" : " (prix automatique selon la marge)"}`,
    stockLine,
    p.dup_group ? `🔀 Groupe d'offres identiques : ${esc(p.dup_group)} (visibilité gérée automatiquement)` : "",
    LINE,
    desc ? esc(short(desc, 600)) : "<i>Pas de description.</i>",
  ].filter(Boolean).join("\n");
  const kb: Keyboard = [
    [btn(p.is_active ? "⚪ Masquer" : "🟢 Publier", `a:pt:${id}`), btn("💵 Prix", `a:pe:${id}:price`)],
    [btn("✏️ Nom", `a:pe:${id}:name`), btn("📝 Description", `a:pe:${id}:desc`)],
    [btn("🗂️ Catégorie", `a:pk:${id}`), ...(manual ? [btn("📥 Ajouter du stock", `a:pe:${id}:stock`)] : [])],
  ];
  if (p.price_locked && !manual) kb.push([btn("🔓 Revenir au prix automatique", `a:pu:${id}`)]);
  kb.push([btn("⬅️ Produits", "a:pc"), ...adminRow()]);
  return { text, keyboard: kb };
}

async function usersScreen(page: number): Promise<Screen> {
  const { data } = await db().from("bot_users").select("telegram_id, first_name, username, balance").order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE);
  const rows = (data ?? []).slice(0, PAGE);
  const nav: Btn[] = [];
  if (page > 0) nav.push(btn("◀️ Précédent", `a:users:${page - 1}`));
  if ((data ?? []).length > PAGE) nav.push(btn("Suivant ▶️", `a:users:${page + 1}`));
  return {
    text: `👤 <b>CLIENTS</b>\n${LINE}\nDerniers inscrits. Touchez un client pour voir sa fiche.`,
    keyboard: [
      [btn("🔎 Chercher un client", "a:uf")],
      ...rows.map((u) => [btn(`${short(u.first_name ?? "Sans nom", 18)}${u.username ? ` @${short(u.username, 14)}` : ""} · ${fcfa(u.balance)}`, `a:u:${u.telegram_id}`)]),
      ...(nav.length ? [nav] : []),
      adminRow(),
    ],
  };
}

async function userScreen(id: number): Promise<Screen> {
  const { data: u } = await db().from("bot_users").select("*").eq("telegram_id", id).maybeSingle();
  if (!u) return { text: "Client introuvable.", keyboard: [[btn("🔎 Chercher", "a:uf")], adminRow()] };
  const [{ data: paid }, { count: referrals }] = await Promise.all([
    db().from("orders").select("amount").eq("telegram_id", id).eq("status", "paid"),
    db().from("bot_users").select("telegram_id", { count: "exact", head: true }).eq("referrer_id", id),
  ]);
  const text = [
    `👤 <b>${esc(u.first_name ?? "Client")}</b>${u.username ? ` · @${esc(u.username)}` : ""}`,
    LINE,
    `🆔 <code>${u.telegram_id}</code>`,
    `💰 Solde : <b>${fcfa(u.balance)}</b>`,
    `🛒 Achats : <b>${paid?.length ?? 0}</b> · ${fcfa((paid ?? []).reduce((s, o) => s + o.amount, 0))}`,
    `🎁 Filleuls : <b>${referrals ?? 0}</b>${u.referrer_id ? ` · parrainé par <code>${u.referrer_id}</code>` : ""}`,
    `📅 Inscrit le ${new Date(u.created_at).toLocaleDateString("fr-FR")}`,
    u.is_blocked ? "🚫 <b>Bloqué</b>" : "",
  ].filter(Boolean).join("\n");
  return {
    text,
    keyboard: [
      [btn("➕ Créditer le solde", `a:uc:${id}`), btn("➖ Retirer du solde", `a:ud:${id}`)],
      [btn("📦 Ses commandes", `a:uo:${id}:0`), btn(u.is_blocked ? "✅ Débloquer" : "🚫 Bloquer", `a:ub:${id}`)],
      [btn("⬅️ Clients", "a:users"), ...adminRow()],
    ],
  };
}

async function suppliersScreen(): Promise<Screen> {
  const { data: rows } = await db().from("suppliers").select("*").order("id");
  const adapters = new Map(syncableSuppliers().map((a) => [a.id, a]));
  const lines = ["🏦 <b>FOURNISSEURS</b>", LINE];
  for (const s of rows ?? []) {
    if (s.id === "manual") continue;
    const a = adapters.get(s.id);
    let bal = "—";
    if (a?.balance) {
      try { const b = await a.balance(); bal = Number.isFinite(b.amount) ? `${b.amount} ${esc(b.currency)}` : "n/d"; }
      catch (e) { bal = `⚠️ ${esc(e instanceof Error ? e.message : "erreur")}`; }
    }
    lines.push(
      `<b>${esc(s.name)}</b>${s.enabled ? "" : " (désactivé)"}`,
      `💳 Solde : ${bal}`,
      `📈 Marge : ${s.margin_percent} %${s.margin_fixed ? ` + ${fcfa(s.margin_fixed)}` : ""} · 1 $ = ${s.usd_rate} F`,
      `🔄 Dernière synchro : ${s.last_sync_at ? new Date(s.last_sync_at).toLocaleString("fr-FR", { timeZone: "Africa/Ouagadougou" }) : "jamais"}${s.last_sync_error ? `\n⚠️ ${esc(short(s.last_sync_error, 200))}` : ""}`,
      "",
    );
  }
  return { text: lines.join("\n").trim(), keyboard: [[btn("🔄 Synchroniser maintenant", "a:sync")], adminRow()] };
}

const SETTINGS: { key: string; label: string; unit: string; fallback: number }[] = [
  { key: "referral_percent", label: "🎁 Bonus de parrainage", unit: "%", fallback: 5 },
  { key: "topup_min", label: "⬇️ Recharge minimum", unit: "F", fallback: 500 },
  { key: "topup_max", label: "⬆️ Recharge maximum", unit: "F", fallback: 200000 },
];

async function settingsScreen(): Promise<Screen> {
  const values = await Promise.all(SETTINGS.map((s) => setting(s.key, s.fallback)));
  const { data: sups } = await db().from("suppliers").select("id, name, margin_percent").neq("id", "manual").order("id");
  const community = await getCommunity();
  const text = [
    "⚙️ <b>RÉGLAGES</b>",
    LINE,
    ...SETTINGS.map((s, i) => `${s.label} : <b>${Number(values[i]).toLocaleString("fr-FR")} ${s.unit}</b>`),
    ...(sups ?? []).map((s) => `📈 Marge ${esc(s.name)} : <b>${s.margin_percent} %</b>`),
    `👥 Groupe officiel : ${community ? `<b>${esc(community.title)}</b>` : "aucun (ajoutez le bot comme admin du groupe)"}`,
    LINE,
    "Touchez un réglage pour le modifier.",
  ].join("\n");
  return {
    text,
    keyboard: [
      ...SETTINGS.map((s) => [btn(s.label, `a:se:${s.key}`)]),
      ...(sups ?? []).map((s) => [btn(`📈 Marge ${s.name}`, `a:sm:${s.id}`)]),
      adminRow(),
    ],
  };
}

// ─────────────── Formulaire « Nouveau produit » ───────────────

function newProductSummary(st: Extract<AdminState, { kind: "new" }>): Screen {
  return {
    text: [
      "➕ <b>NOUVEAU PRODUIT — vérification</b>",
      LINE,
      `📦 Nom : <b>${esc(st.name)}</b>`,
      `🗂️ Catégorie : <b>${esc(st.category)}</b>`,
      `💵 Prix : <b>${fcfa(st.price ?? 0)}</b>`,
      `📝 Description : ${st.description ? esc(short(st.description, 500)) : "<i>aucune</i>"}`,
      LINE,
      "Livraison : depuis le <b>stock que vous ajoutez</b> (clés, comptes, liens). Vous pourrez l'ajouter juste après.",
    ].join("\n"),
    keyboard: [[btn("✅ Créer et mettre en ligne", "a:npok:1")], [btn("💾 Créer sans publier", "a:npok:0")], cancelRow()],
  };
}

async function askCategory(chatId: number, st: Extract<AdminState, { kind: "new" }>, edit?: { mid?: number }) {
  const cats = (await allCategories()).map((c) => c.name).slice(0, 30);
  await setState(chatId, { ...st, step: "cat", cats });
  const s: Screen = {
    text: `➕ <b>NOUVEAU PRODUIT</b> · étape 2/4\n${LINE}\n📦 ${esc(st.name)}\n\n🗂️ Choisissez la <b>catégorie</b> :`,
    keyboard: [...cats.map((c, i) => [btn(c, `a:npc:${i}`)]), [btn("✏️ Nouvelle catégorie", "a:npc:new")], cancelRow()],
  };
  if (edit) await tg.edit(chatId, edit.mid, s.text, s.keyboard); else await tg.send(chatId, s.text, s.keyboard);
}

// ─────────────────────────── Boutons ───────────────────────────

/** Traite un bouton « a:… ». Retourne un éventuel message court (toast). */
export async function handleAdminCallback(chatId: number, mid: number | undefined, data: string, user: BotUser): Promise<string | undefined> {
  const [, act = "home", x = "", y = ""] = data.split(":");
  const show = (s: Screen) => tg.edit(chatId, mid, s.text, s.keyboard);
  const ask = async (state: AdminState, question: string) => {
    await setState(chatId, state);
    await tg.edit(chatId, mid, question, [cancelRow()]);
  };
  switch (act) {
    case "home": await setState(chatId, null); await show(await adminHome()); return;
    case "cancel": await setState(chatId, null); await show(await adminHome()); return "Annulé";

    // Commandes
    case "todo": await show(await todoScreen()); return;
    case "orders": await show(await ordersScreen(Math.max(0, Number(x) || 0))); return;
    case "o": await show(await orderScreen(x)); return;
    case "of": await ask({ kind: "order", field: "find" }, "🔎 Envoyez la <b>référence</b> de la commande, par exemple <code>CMD-03E574E9</code>."); return;
    case "rl": { const r = await relaunchOrder(x); await show(await orderScreen(x)); return r.replace(/<[^>]+>/g, ""); }
    case "rf": {
      await show({
        text: `⚡ <b>Racheter ${esc(x)} chez le fournisseur ?</b>\n\nUn achat a déjà été tenté sans réponse connue. Vérifiez d'abord dans votre espace fournisseur qu'<b>aucune commande n'a été passée</b>, sinon vous paierez deux fois.\n\nSi vous la retrouvez, utilisez plutôt « Lier une réf. fournisseur ».`,
        keyboard: [[btn("✅ Oui, j'ai vérifié : racheter", `a:rfy:${x}`)], [btn("⬅️ Non, retour", `a:o:${x}`)]],
      });
      return;
    }
    case "rfy": { const r = await relaunchOrder(x, true); await show(await orderScreen(x)); return r.replace(/<[^>]+>/g, ""); }
    case "lk": await ask({ kind: "order", field: "link", ref: x }, `🔗 <b>${esc(x)}</b>\nEnvoyez l'<b>identifiant de la commande chez le fournisseur</b> (visible dans votre espace fournisseur).`); return;
    case "lv": await ask({ kind: "order", field: "deliver", ref: x }, `✍️ <b>Livraison manuelle de ${esc(x)}</b>\nEnvoyez les accès à transmettre au client, <b>un élément par ligne</b> (ex. <code>email:motdepasse</code>).`); return;
    case "rb": {
      const o = await findOrder(x);
      await show({
        text: `↩️ <b>Rembourser ${esc(x)} ?</b>\n${o ? `${fcfa(o.amount)} seront crédités sur le solde du client.` : ""}`,
        keyboard: [[btn("✅ Oui, rembourser", `a:rby:${x}`)], [btn("⬅️ Non, retour", `a:o:${x}`)]],
      });
      return;
    }
    case "rby": { const r = await refundOrder(x); await show(await orderScreen(x)); return r.replace(/<[^>]+>/g, ""); }

    // Produits
    case "pc": await show(await productCatsScreen()); return;
    case "pl": await show(await productListScreen(Number(x), Math.max(0, Number(y) || 0))); return;
    case "p": await show(await productScreen(Number(x))); return;
    case "ps": await ask({ kind: "pedit", field: "name", id: -1 }, "🔎 Envoyez le <b>nom</b> (ou une partie) ou le <b>numéro</b> du produit."); return;
    case "pt": {
      const { data: p } = await db().from("products").select("is_active").eq("id", Number(x)).maybeSingle();
      if (!p) return "Produit introuvable";
      await db().from("products").update({ is_active: !p.is_active }).eq("id", Number(x));
      await show(await productScreen(Number(x)));
      return p.is_active ? "Produit masqué" : "Produit publié";
    }
    case "pu": await db().from("products").update({ price_locked: false }).eq("id", Number(x)); await show(await productScreen(Number(x))); return "Prix automatique à la prochaine synchro";
    case "pe": {
      const id = Number(x);
      const q: Record<string, string> = {
        price: "💵 Envoyez le <b>nouveau prix</b> en F CFA (ex. <code>2500</code>).",
        name: "✏️ Envoyez le <b>nouveau nom</b> du produit.",
        desc: "📝 Envoyez la <b>nouvelle description</b> (plusieurs lignes possibles).",
        stock: "📥 Envoyez les <b>accès à ajouter au stock</b>, <b>un par ligne</b> (clé, compte <code>email:motdepasse</code>, lien…). Chaque ligne = une vente.",
      };
      if (!q[y]) return "Action inconnue";
      await ask({ kind: "pedit", field: y as "price" | "name" | "desc" | "stock", id }, q[y]);
      return;
    }
    case "pk": {
      const cats = (await allCategories()).map((c) => c.name).slice(0, 30);
      await setState(chatId, { kind: "pedit", field: "cat", id: Number(x) });
      await show({
        text: "🗂️ Choisissez la <b>nouvelle catégorie</b>, ou envoyez un nouveau nom de catégorie (ex. <code>🎬 Streaming</code>).",
        keyboard: [...cats.map((c, i) => [btn(c, `a:pkc:${x}:${i}`)]), [btn("⬅️ Retour", `a:p:${x}`)]],
      });
      return;
    }
    case "pkc": {
      const cats = (await allCategories()).map((c) => c.name);
      const name = cats[Number(y)];
      if (!name) return "Catégorie introuvable";
      await db().from("products").update({ category: name }).eq("id", Number(x));
      await setState(chatId, null);
      await show(await productScreen(Number(x)));
      return "Catégorie modifiée";
    }

    // Nouveau produit
    case "np": await ask({ kind: "new", step: "name" }, `➕ <b>NOUVEAU PRODUIT</b> · étape 1/4\n${LINE}\n📦 Envoyez le <b>nom du produit</b>, tel que les clients le verront.\nEx. <code>Netflix Premium — 1 mois</code>`); return;
    case "npc": {
      const st = user.state_data as Extract<AdminState, { kind: "new" }>;
      if (st?.kind !== "new") return "Formulaire expiré, recommencez.";
      if (x === "new") { await ask({ ...st, step: "cat" }, `🗂️ Envoyez le <b>nom de la nouvelle catégorie</b>, avec un emoji au début.\nEx. <code>🎬 Streaming</code>`); return; }
      const category = st.cats?.[Number(x)];
      if (!category) return "Catégorie introuvable";
      await ask({ ...st, category, step: "price" }, `➕ <b>NOUVEAU PRODUIT</b> · étape 3/4\n${LINE}\n📦 ${esc(st.name)}\n🗂️ ${esc(category)}\n\n💵 Envoyez le <b>prix de vente</b> en F CFA (ex. <code>2500</code>).`);
      return;
    }
    case "npd": {
      const st = user.state_data as Extract<AdminState, { kind: "new" }>;
      if (st?.kind !== "new") return "Formulaire expiré, recommencez.";
      const next = { ...st, description: "", step: "confirm" as const };
      await setState(chatId, next);
      await show(newProductSummary(next));
      return;
    }
    case "npok": {
      const st = user.state_data as Extract<AdminState, { kind: "new" }>;
      if (st?.kind !== "new" || !st.name || !st.category || !st.price) return "Formulaire expiré, recommencez.";
      const id = await createManualProduct({ name: st.name, category: st.category, price: st.price, description: st.description ?? "", active: x === "1" });
      if (!id) return "Création impossible";
      await setState(chatId, { kind: "pedit", field: "stock", id });
      await tg.edit(chatId, mid, `✅ <b>Produit n° ${id} créé</b>${x === "1" ? " et mis en ligne" : " (masqué)"}.\n\n📥 Envoyez maintenant les <b>accès à mettre en stock</b>, un par ligne (chaque ligne = une vente).\nOu touchez « Plus tard ».`,
        [[btn("⏭️ Plus tard", `a:p:${id}`)]]);
      return "Produit créé";
    }

    // Clients
    case "users": await show(await usersScreen(Math.max(0, Number(x) || 0))); return;
    case "uf": await ask({ kind: "user", field: "find" }, "🔎 Envoyez l'<b>identifiant Telegram</b>, le <b>@pseudo</b> ou le <b>prénom</b> du client."); return;
    case "u": await setState(chatId, null); await show(await userScreen(Number(x))); return;
    case "uo": await show(await ordersScreen(Math.max(0, Number(y) || 0), Number(x))); return;
    case "uc": await ask({ kind: "user", field: "credit", id: Number(x) }, `➕ Envoyez le <b>montant à ajouter</b> au solde de <code>${esc(x)}</code> (ex. <code>1000</code>).`); return;
    case "ud": await ask({ kind: "user", field: "debit", id: Number(x) }, `➖ Envoyez le <b>montant à retirer</b> du solde de <code>${esc(x)}</code> (ex. <code>1000</code>).`); return;
    case "ub": {
      const { data: u } = await db().from("bot_users").select("is_blocked").eq("telegram_id", Number(x)).maybeSingle();
      if (!u) return "Client introuvable";
      if (Number(x) === chatId) return "Vous ne pouvez pas vous bloquer vous-même.";
      await db().from("bot_users").update({ is_blocked: !u.is_blocked }).eq("telegram_id", Number(x));
      await show(await userScreen(Number(x)));
      return u.is_blocked ? "Client débloqué" : "Client bloqué";
    }

    // Catalogue, fournisseurs, réglages
    case "sync": {
      await tg.edit(chatId, mid, "🔄 <b>Synchronisation en cours…</b>\nCela peut prendre une minute.");
      const report = await runSync();
      await tg.edit(chatId, mid, `🔄 <b>Synchronisation terminée</b>\n${LINE}\n${report}`, [[btn("🛍️ Produits", "a:pc")], adminRow()]);
      return;
    }
    case "sup": await show(await suppliersScreen()); return;
    case "set": await setState(chatId, null); await show(await settingsScreen()); return;
    case "se": {
      const s = SETTINGS.find((k) => k.key === x);
      if (!s) return "Réglage inconnu";
      await ask({ kind: "setting", key: s.key }, `${s.label}\nEnvoyez la <b>nouvelle valeur</b> (en ${s.unit}).`);
      return;
    }
    case "sm": await ask({ kind: "margin", supplier: x }, `📈 Envoyez la <b>nouvelle marge</b> en % pour ${esc(x)} (ex. <code>50</code>).\nLes prix seront recalculés à la prochaine synchronisation (sauf prix fixés à la main).`); return;
  }
  return "Action inconnue";
}

// ─────────────────────────── Réponses texte ───────────────────────────

const parseAmount = (text: string) => {
  const n = Number(text.replace(/[\s.,]|f(cfa)?$/gi, ""));
  return Number.isInteger(n) ? n : NaN;
};

/** Traite un message tapé pendant un formulaire admin. */
export async function handleAdminInput(chatId: number, text: string, user: BotUser): Promise<void> {
  const st = user.state_data as AdminState;
  const send = (s: Screen) => tg.send(chatId, s.text, s.keyboard);
  const retry = (msg: string) => tg.send(chatId, `⚠️ ${msg}`, [cancelRow()]);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  switch (st?.kind) {
    case "new": {
      if (st.step === "name") {
        if (text.length < 2) return void await retry("Nom trop court.");
        await askCategory(chatId, { ...st, name: text.slice(0, 120) });
        return;
      }
      if (st.step === "cat") {
        const category = text.slice(0, 40);
        await setState(chatId, { ...st, category, step: "price" });
        await tg.send(chatId, `➕ <b>NOUVEAU PRODUIT</b> · étape 3/4\n${LINE}\n📦 ${esc(st.name)}\n🗂️ ${esc(category)}\n\n💵 Envoyez le <b>prix de vente</b> en F CFA (ex. <code>2500</code>).`, [cancelRow()]);
        return;
      }
      if (st.step === "price") {
        const price = parseAmount(text);
        if (!(price >= 100)) return void await retry("Prix invalide. Envoyez un nombre d'au moins 100, par exemple <code>2500</code>.");
        await setState(chatId, { ...st, price, step: "desc" });
        await tg.send(chatId, `➕ <b>NOUVEAU PRODUIT</b> · étape 4/4\n${LINE}\n📦 ${esc(st.name)} · ${fcfa(price)}\n\n📝 Envoyez la <b>description</b> (durée, conditions, garantie…), ou touchez « Passer ».`, [[btn("⏭️ Passer", "a:npd")], cancelRow()]);
        return;
      }
      if (st.step === "desc") {
        const next = { ...st, description: text.slice(0, 3000), step: "confirm" as const };
        await setState(chatId, next);
        await send(newProductSummary(next));
        return;
      }
      return void await send(newProductSummary(st));
    }
    case "pedit": {
      if (st.id === -1) { // recherche de produit
        const asId = Number(text);
        let q = db().from("products").select("id, name, price, is_active").limit(15);
        q = Number.isInteger(asId) && asId > 0 ? q.eq("id", asId) : q.ilike("name", `%${text.replace(/[%_]/g, "")}%`);
        const { data } = await q;
        await setState(chatId, null);
        if (!data?.length) return void await tg.send(chatId, "Aucun produit trouvé.", [[btn("🔎 Nouvelle recherche", "a:ps")], adminRow()]);
        return void await tg.send(chatId, `🔎 <b>${data.length} résultat(s)</b>`, [...data.map((p) => [btn(`${p.is_active ? "🟢" : "⚪"} ${short(p.name, 30)} · ${fcfa(p.price)}`, `a:p:${p.id}`)]), adminRow()]);
      }
      const upd: Record<string, unknown> = {};
      if (st.field === "price") {
        const price = parseAmount(text);
        if (!(price >= 100)) return void await retry("Prix invalide (minimum 100 F).");
        Object.assign(upd, { price, price_locked: true });
      } else if (st.field === "name") upd.name = text.slice(0, 120);
      else if (st.field === "desc") upd.description = text.slice(0, 3000);
      else if (st.field === "cat") upd.category = text.slice(0, 40);
      else if (st.field === "stock") {
        const msg = await addStock(st.id, lines);
        await setState(chatId, null);
        await tg.send(chatId, msg);
        return void await send(await productScreen(st.id));
      }
      const { error } = await db().from("products").update(upd).eq("id", st.id);
      await setState(chatId, null);
      await tg.send(chatId, error ? "Modification impossible." : "✅ Modifié.");
      return void await send(await productScreen(st.id));
    }
    case "order": {
      await setState(chatId, null);
      if (st.field === "find") return void await send(await orderScreen(text));
      const ref = st.ref ?? "";
      const msg = st.field === "link" ? await linkOrder(ref, text.split(/\s+/)[0]) : await deliverManually(ref, lines);
      await tg.send(chatId, msg);
      return void await send(await orderScreen(ref));
    }
    case "user": {
      if (st.field === "find") {
        await setState(chatId, null);
        const t = text.replace(/^@/, "").trim();
        let q = db().from("bot_users").select("telegram_id, first_name, username, balance").limit(15);
        q = /^\d{4,}$/.test(t) ? q.eq("telegram_id", Number(t)) : q.or(`username.ilike.%${t.replace(/[%_,()]/g, "")}%,first_name.ilike.%${t.replace(/[%_,()]/g, "")}%`);
        const { data } = await q;
        if (!data?.length) return void await tg.send(chatId, "Aucun client trouvé.", [[btn("🔎 Nouvelle recherche", "a:uf")], adminRow()]);
        if (data.length === 1) return void await send(await userScreen(data[0].telegram_id));
        return void await tg.send(chatId, `🔎 <b>${data.length} client(s)</b>`, [...data.map((u) => [btn(`${short(u.first_name ?? "Sans nom", 18)}${u.username ? ` @${u.username}` : ""} · ${fcfa(u.balance)}`, `a:u:${u.telegram_id}`)]), adminRow()]);
      }
      const amount = parseAmount(text);
      if (!(amount > 0)) return void await retry("Montant invalide. Envoyez un nombre positif, par exemple <code>1000</code>.");
      await setState(chatId, null);
      await tg.send(chatId, await creditUser(chatId, st.id!, st.field === "debit" ? -amount : amount));
      return void await send(await userScreen(st.id!));
    }
    case "setting": {
      const v = parseAmount(text);
      if (!(v >= 0) || (st.key === "referral_percent" && v > 50)) return void await retry("Valeur invalide.");
      await db().from("settings").upsert({ key: st.key, value: v });
      await setState(chatId, null);
      await tg.send(chatId, "✅ Réglage enregistré.");
      return void await send(await settingsScreen());
    }
    case "margin": {
      const v = Number(text.replace(",", ".").replace("%", "").trim());
      if (!(v >= 0 && v <= 500)) return void await retry("Marge invalide (entre 0 et 500 %).");
      await db().from("suppliers").update({ margin_percent: v }).eq("id", st.supplier);
      await setState(chatId, null);
      await tg.send(chatId, "✅ Marge enregistrée. Lancez « 🔄 Synchroniser » pour recalculer les prix.");
      return void await send(await settingsScreen());
    }
  }
  await setState(chatId, null);
  await send(await adminHome());
}
