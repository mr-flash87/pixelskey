// Textes et claviers du bot (HTML Telegram). Aucune logique métier ici.
import type { Order, Product } from "./db.ts";
import type { FlashPayOperator, FlashPayPayment } from "./flashpay.ts";
import { esc, fcfa, type Keyboard } from "./telegram.ts";
import { optionalEnv } from "./env.ts";

export const SHOP_NAME = () => optionalEnv("SHOP_NAME") ?? "Digital Pass BF";
export const PAGE_SIZE = 8;
export const LINE = "━━━━━━━━━━━━━━━━";

export const back = (data: string, label = "⬅️ Retour") => [{ text: label, callback_data: data }];
export const homeRow = () => [{ text: "🏠 Accueil", callback_data: "home" }];

/** Emoji de tête d'une catégorie (« 🤖 IA » → « 🤖 »). */
const categoryEmoji = (category: string) => category.match(/^\p{Extended_Pictographic}\uFE0F?/u)?.[0] ?? "📦";
/** Raccourcit un libellé de bouton (Telegram coupe les boutons trop longs). */
const short = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s);

export function homeScreen(firstName: string | undefined, balance: number) {
  const text = [
    `✨ <b>${esc(SHOP_NAME().toUpperCase())}</b> ✨`,
    "<i>Vos abonnements premium, livrés en quelques minutes</i>",
    LINE,
    `👋 Salut${firstName ? ` <b>${esc(firstName)}</b>` : ""} !`,
    "",
    "⚡ Livraison <b>automatique</b> 24 h/24",
    "📱 Paiement <b>Orange Money · Moov Money · Wave</b>",
    "🔐 Vos accès gardés dans <b>Mes commandes</b>",
    "🎁 Parrainez vos amis et gagnez du solde",
    LINE,
    `💰 Votre solde : <b>${fcfa(balance)}</b>`,
  ].join("\n");
  const support = optionalEnv("SUPPORT_USERNAME");
  const keyboard: Keyboard = [
    [{ text: "🛍️ Voir la boutique", callback_data: "cats" }],
    [{ text: "📦 Mes commandes", callback_data: "orders:0" }, { text: "💰 Mon solde", callback_data: "wallet" }],
    [{ text: "🎁 Parrainage", callback_data: "ref" }, { text: "❓ Aide", callback_data: "help" }],
  ];
  if (support) keyboard.push([{ text: "💬 Contacter le support", url: `https://t.me/${support.replace(/^@/, "")}` }]);
  return { text, keyboard };
}

export function categoriesScreen(categories: { name: string; count: number }[]) {
  if (!categories.length) return { text: "🛍️ La boutique est en cours de réapprovisionnement.\nRevenez très bientôt !", keyboard: [homeRow()] };
  const total = categories.reduce((s, c) => s + c.count, 0);
  const keyboard: Keyboard = categories.map((c, i) => [{ text: `${c.name}  ·  ${c.count} offre${c.count > 1 ? "s" : ""}`, callback_data: `cat:${i}:0` }]);
  keyboard.push(homeRow());
  return { text: `🛍️ <b>BOUTIQUE</b>\n${LINE}\n<b>${total}</b> services disponibles.\nChoisissez une catégorie 👇`, keyboard };
}

export function productListScreen(category: string, catIndex: number, products: (Product & { stock: number })[], page: number, total: number) {
  const keyboard: Keyboard = products.map((p) => [{
    text: p.stock > 0 ? `${short(p.name, 38)}  ·  ${fcfa(p.price)}` : `⛔ ${short(p.name, 38)}`,
    callback_data: `p:${p.id}`,
  }]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages > 1) {
    keyboard.push([
      page > 0 ? { text: "◀️ Précédent", callback_data: `cat:${catIndex}:${page - 1}` } : { text: "·", callback_data: "noop" },
      { text: `${page + 1} / ${pages}`, callback_data: "noop" },
      (page + 1) * PAGE_SIZE < total ? { text: "Suivant ▶️", callback_data: `cat:${catIndex}:${page + 1}` } : { text: "·", callback_data: "noop" },
    ]);
  }
  keyboard.push([...back("cats", "⬅️ Catégories"), ...homeRow()]);
  return { text: `<b>${esc(category.toUpperCase())}</b>\n${LINE}\nTouchez une offre pour voir le détail.\n<i>⛔ = rupture de stock momentanée</i>`, keyboard };
}

export function productScreen(p: Product, stock: number, balance: number, catIndex: number | null) {
  const available = stock > 0;
  const lines = [
    `${categoryEmoji(p.category)} <b>${esc(p.name)}</b>`,
    LINE,
    p.description ? esc(p.description.slice(0, 900)) : "",
    p.description ? LINE : "",
    `💵 Prix : <b>${fcfa(p.price)}</b>`,
    available ? "✅ Disponible" : "⛔ Rupture de stock momentanée",
    available ? (p.instant ? "⚡ Livraison automatique, en quelques minutes" : "⏳ Livraison après traitement par le fournisseur") : "🔔 Revenez bientôt, le stock est mis à jour chaque heure",
  ].filter(Boolean);
  const keyboard: Keyboard = [];
  if (available) {
    keyboard.push([{ text: `🛒 Acheter · ${fcfa(p.price)}`, callback_data: `buy:${p.id}` }]);
    if (balance >= p.price) keyboard.push([{ text: `💰 Payer avec mon solde (${fcfa(balance)})`, callback_data: `bal:${p.id}` }]);
  }
  keyboard.push([...back(catIndex == null ? "cats" : `cat:${catIndex}:0`), ...homeRow()]);
  return { text: lines.join("\n"), keyboard };
}

export function confirmBalanceScreen(p: Product, balance: number) {
  return {
    text: [
      "🧾 <b>CONFIRMATION</b>",
      LINE,
      `📦 ${esc(p.name)}`,
      `💵 Prix : <b>${fcfa(p.price)}</b>`,
      `💰 Solde actuel : ${fcfa(balance)}`,
      `➡️ Solde après achat : <b>${fcfa(balance - p.price)}</b>`,
    ].join("\n"),
    keyboard: [[{ text: "✅ Confirmer l'achat", callback_data: `balok:${p.id}` }], back(`p:${p.id}`, "❌ Annuler")],
  };
}

const OP_EMOJI: Record<string, string> = { orange: "🟠", moov: "🔵", wave: "🌊" };
const paymentFooter = (paymentId: string): Keyboard => [
  [{ text: "🔄 J'ai payé — vérifier", callback_data: `chk:${paymentId}` }],
  [{ text: "❌ Annuler", callback_data: `cxl:${paymentId}` }],
];

/** Étape 1 : choix du moyen de paiement (liste fournie par FlashPay à chaque paiement). */
export function paymentScreen(title: string, payment: FlashPayPayment) {
  const lines = [
    "💳 <b>PAIEMENT</b>",
    LINE,
    `🧾 ${esc(title)}`,
    `💵 Montant : <b>${fcfa(payment.amount)}</b>`,
    LINE,
    "Choisissez votre moyen de paiement 👇",
    "",
    "⏱️ Ce paiement expire dans <b>15 minutes</b>.",
  ];
  const keyboard: Keyboard = (payment.operators ?? []).map((op) => [{ text: `${OP_EMOJI[op.code] ?? "📱"} ${op.name}`, callback_data: `op:${payment.id}:${op.code}` }]);
  keyboard.push(...paymentFooter(payment.id));
  return { text: lines.join("\n"), keyboard };
}

/** Étape 2 : numéro qui va payer (FlashPay s'en sert pour reconnaître le paiement). */
export function askPayerPhoneScreen(op: FlashPayOperator, paymentId: string) {
  return {
    text: `${OP_EMOJI[op.code] ?? "📱"} <b>${esc(op.name)}</b>\n\n`
      + `Envoyez le <b>numéro ${esc(op.name)} qui va payer</b> (8 chiffres), par exemple <code>70123456</code>.\n\n`
      + "Ce numéro permet de reconnaître automatiquement votre paiement : payez bien depuis ce numéro.",
    keyboard: [[{ text: "↩️ Changer de moyen de paiement", callback_data: `pay:${paymentId}` }], ...paymentFooter(paymentId)],
  };
}

/** Étape 3 : consignes de paiement pour l'opérateur choisi. */
export function operatorInstructionsScreen(payment: FlashPayPayment, op: FlashPayOperator, payerPhone: string) {
  const amountToSend = op.fee_percent > 0 ? op.amount_to_send : payment.amount;
  const lines = [
    `${OP_EMOJI[op.code] ?? "📱"} <b>PAIEMENT ${esc(op.name.toUpperCase())}</b>`,
    LINE,
    `📞 Votre numéro : <b>${esc(payerPhone)}</b>`,
    `💵 Montant : <b>${fcfa(payment.amount)}</b>`,
  ];
  if (op.merchant_number) lines.push(`🏪 Numéro marchand : <code>${esc(op.merchant_number)}</code>`);
  lines.push(LINE, "<b>Comment payer :</b>");
  const ussd = op.ussd_code?.replace(/^.*?:\s*/, "");
  if (ussd) {
    lines.push(
      "1️⃣ Touchez <b>📋 Copier le code</b> ci-dessous",
      `2️⃣ Ouvrez l'appli <b>Téléphone</b> du <b>${esc(payerPhone)}</b>, collez le code et appelez`,
      `<code>${esc(ussd)}</code>`,
      "3️⃣ Confirmez avec votre code secret",
    );
  } else if (op.code === "wave") {
    lines.push(
      `1️⃣ Ouvrez l'application <b>Wave</b> du <b>${esc(payerPhone)}</b>.`,
      `2️⃣ Touchez « Envoyer de l'argent » et collez le numéro <code>${esc(op.merchant_number ?? "")}</code> (bouton 📋 ci-dessous).`,
      `3️⃣ Dans « <b>Montant reçu</b> », saisissez <b>${payment.amount}</b> (et non dans « Montant envoyé »).`,
    );
  } else if (op.merchant_number) {
    lines.push(`1️⃣ Depuis le <b>${esc(payerPhone)}</b>, envoyez <b>${fcfa(amountToSend)}</b> au <code>${esc(op.merchant_number)}</code>.`);
  }
  if (op.fee_percent > 0) {
    lines.push("", `Montant à faire recevoir : <b>${fcfa(payment.amount)}</b>`, `Vous paierez environ : ${fcfa(op.amount_to_send)} (frais ${String(op.fee_percent).replace(".", ",")} % inclus)`);
    if (op.code === "wave") lines.push("⚠️ Saisissez le montant dans « <b>Montant reçu</b> », sinon le paiement ne sera pas reconnu.");
  }
  if (op.instructions && op.code !== "wave") lines.push("", esc(op.instructions));
  lines.push(LINE, "✅ Dès que votre paiement est reçu, vos accès arrivent automatiquement ici.", "⏱️ Ce paiement expire dans <b>15 minutes</b>.");
  const keyboard: Keyboard = [];
  // Boutons de copie : un appui met le code (ou le numéro) dans le presse-papiers du téléphone.
  if (ussd && ussd.length <= 256) keyboard.push([{ text: "📋 Copier le code à composer", copy_text: { text: ussd } }]);
  if (op.merchant_number && !ussd) keyboard.push([{ text: "📋 Copier le numéro marchand", copy_text: { text: op.merchant_number } }]);
  if (op.code === "wave") keyboard.push([{ text: `📋 Copier le montant (${payment.amount})`, copy_text: { text: String(payment.amount) } }]);
  if (op.pay_link?.startsWith("https://")) keyboard.push([{ text: `💳 Ouvrir ${op.name}`, url: op.pay_link }]);
  if (payment.checkout_url?.startsWith("https://")) keyboard.push([{ text: "🌐 Page de paiement (appel direct)", url: payment.checkout_url }]);
  keyboard.push(
    [{ text: "📞 Changer de numéro", callback_data: `op:${payment.id}:${op.code}` }, { text: "↩️ Autre moyen", callback_data: `pay:${payment.id}` }],
    ...paymentFooter(payment.id),
  );
  return { text: lines.join("\n"), keyboard };
}

const ORDER_STATUS: Record<string, string> = {
  pending: "⏳ En attente de paiement", cancelled: "❌ Annulée", expired: "⌛ Expirée", refunded: "↩️ Remboursée sur le solde",
};
const DELIVERY_STATUS: Record<string, string> = {
  none: "⏳ Livraison en cours", processing: "⏳ Livraison en cours", supplier_pending: "⏳ En préparation chez le fournisseur",
  failed: "⏳ En cours de traitement", uncertain: "⏳ En cours de vérification", delivered: "✅ Livrée",
};
export const orderStatusLabel = (o: Pick<Order, "status" | "delivery_status">) =>
  o.status === "paid" ? DELIVERY_STATUS[o.delivery_status] ?? o.delivery_status : ORDER_STATUS[o.status] ?? o.status;

export function ordersScreen(orders: Order[], page: number, hasMore: boolean) {
  if (!orders.length && page === 0) return { text: "📦 Vous n'avez pas encore de commande.", keyboard: [[{ text: "🛍️ Boutique", callback_data: "cats" }], homeRow()] };
  const keyboard: Keyboard = orders.map((o) => [{ text: `${o.ref} · ${o.product_name.slice(0, 28)} · ${orderStatusLabel(o).split(" ")[0]}`, callback_data: `o:${o.ref}` }]);
  const nav = [];
  if (page > 0) nav.push({ text: "◀️", callback_data: `orders:${page - 1}` });
  if (hasMore) nav.push({ text: "▶️", callback_data: `orders:${page + 1}` });
  if (nav.length) keyboard.push(nav);
  keyboard.push(homeRow());
  return { text: `📦 <b>MES COMMANDES</b>\n${LINE}\nTouchez une commande pour voir son détail et vos accès.\n✅ livrée · ⏳ en cours · ❌ annulée`, keyboard };
}

export function orderScreen(o: Order, contents: string[]) {
  const date = new Date(o.created_at).toLocaleString("fr-FR", { timeZone: "Africa/Abidjan", dateStyle: "short", timeStyle: "short" });
  const lines = [
    `🧾 <b>COMMANDE ${esc(o.ref)}</b>`,
    LINE,
    `📅 ${date}`,
    `${esc(o.product_name)} ×${o.quantity}`,
    `Montant : ${fcfa(o.amount)} (${o.pay_method === "balance" ? "solde" : "Mobile Money"})`,
    `Statut : ${orderStatusLabel(o)}`,
  ];
  if (contents.length) {
    lines.push(LINE, "🔐 <b>Vos accès :</b>");
    contents.forEach((c, i) => lines.push(`${contents.length > 1 ? `<b>#${i + 1}</b> ` : ""}<code>${esc(c)}</code>`));
  }
  const text = lines.join("\n");
  return { text: text.length > 4000 ? text.slice(0, 3990) + "…" : text, keyboard: [back("orders:0", "⬅️ Mes commandes")] };
}

export function walletScreen(balance: number, history: { amount: number; kind: string; created_at: string }[]) {
  const labels: Record<string, string> = { topup: "Recharge", purchase: "Achat", referral_bonus: "Bonus parrainage", refund: "Remboursement", admin: "Ajustement" };
  const lines = ["💰 <b>MON SOLDE</b>", LINE, `Solde disponible : <b>${fcfa(balance)}</b>`, "", "Rechargez par Mobile Money, puis achetez en un clic sans repasser par le paiement."];
  if (history.length) {
    lines.push(LINE, "<b>Derniers mouvements</b>");
    for (const h of history) lines.push(`${h.amount > 0 ? "➕" : "➖"} ${fcfa(Math.abs(h.amount))} · ${labels[h.kind] ?? h.kind} · ${new Date(h.created_at).toLocaleDateString("fr-FR")}`);
  }
  return { text: lines.join("\n"), keyboard: [[{ text: "➕ Recharger mon solde", callback_data: "topup" }], homeRow()] };
}

export function topupScreen(amounts: number[]) {
  const keyboard: Keyboard = [];
  for (let i = 0; i < amounts.length; i += 3) keyboard.push(amounts.slice(i, i + 3).map((a) => ({ text: fcfa(a), callback_data: `topup:${a}` })));
  keyboard.push([{ text: "✏️ Autre montant", callback_data: "topupc" }], back("wallet"));
  return { text: `➕ <b>RECHARGER MON SOLDE</b>\n${LINE}\nChoisissez un montant, ou « Autre montant » (dès 200 F) 👇`, keyboard };
}

export function referralScreen(link: string, percent: number, referrals: number, earned: number) {
  return {
    text: `🎁 <b>PARRAINAGE</b>\n${LINE}\n`
      + `Invitez vos amis avec votre lien : vous recevez <b>${percent} %</b> de leur premier achat, crédités directement sur votre solde.\n\n`
      + `🔗 Votre lien :\n<code>${esc(link)}</code>\n\n`
      + `👥 Filleuls : <b>${referrals}</b>\n💰 Gains : <b>${fcfa(earned)}</b>`,
    keyboard: [[{ text: "📤 Partager mon lien", url: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(`Abonnements premium livrés automatiquement sur ${SHOP_NAME()} 👇`)}` }], homeRow()],
  };
}

export const helpText = () => [
  "❓ <b>COMMENT ÇA MARCHE ?</b>",
  LINE,
  "1️⃣ Ouvrez la 🛍️ <b>Boutique</b> et choisissez une offre",
  "2️⃣ Touchez <b>Acheter</b>, choisissez Orange Money, Moov Money ou Wave",
  "3️⃣ Indiquez le numéro qui paie, puis suivez les instructions",
  "4️⃣ Vos accès arrivent <b>automatiquement</b> ici, en quelques minutes",
  "",
  "💡 Rechargez votre <b>solde</b> pour acheter ensuite en un clic.",
  "🔐 Tous vos accès restent dans 📦 <b>Mes commandes</b>.",
  "",
  "<b>Commandes rapides</b>",
  "/start · /boutique · /commandes · /solde · /parrainage",
].join("\n");
