// Textes et claviers du bot (HTML Telegram). Aucune logique métier ici.
import type { Order, Product } from "./db.ts";
import type { FlashPayOperator, FlashPayPayment } from "./flashpay.ts";
import { esc, fcfa, type Keyboard } from "./telegram.ts";
import { optionalEnv } from "./env.ts";

export const SHOP_NAME = () => optionalEnv("SHOP_NAME") ?? "Pixels Premium";
export const PAGE_SIZE = 8;

export const back = (data: string, label = "⬅️ Retour") => [{ text: label, callback_data: data }];
export const homeRow = () => [{ text: "🏠 Menu principal", callback_data: "home" }];

export function homeScreen(firstName: string | undefined, balance: number) {
  const text = `👋 Bienvenue${firstName ? ` <b>${esc(firstName)}</b>` : ""} sur <b>${esc(SHOP_NAME())}</b> !\n\n`
    + "Abonnements et services premium livrés <b>automatiquement</b>, ici même, en quelques secondes après le paiement.\n\n"
    + "💳 Paiement : Orange Money, Moov Money, Wave ou votre solde\n"
    + `💰 Votre solde : <b>${fcfa(balance)}</b>`;
  const support = optionalEnv("SUPPORT_USERNAME");
  const keyboard: Keyboard = [
    [{ text: "🛍️ Boutique", callback_data: "cats" }],
    [{ text: "📦 Mes commandes", callback_data: "orders:0" }, { text: "💰 Mon solde", callback_data: "wallet" }],
    [{ text: "🎁 Parrainage", callback_data: "ref" }, support ? { text: "💬 Support", url: `https://t.me/${support.replace(/^@/, "")}` } : { text: "❓ Aide", callback_data: "help" }],
  ];
  return { text, keyboard };
}

export function categoriesScreen(categories: { name: string; count: number }[]) {
  if (!categories.length) return { text: "🛍️ La boutique est en cours de réapprovisionnement. Revenez très bientôt !", keyboard: [homeRow()] };
  const keyboard: Keyboard = [];
  for (let i = 0; i < categories.length; i += 2) {
    keyboard.push(categories.slice(i, i + 2).map((c, j) => ({ text: `${c.name} (${c.count})`, callback_data: `cat:${i + j}:0` })));
  }
  keyboard.push(homeRow());
  return { text: "🛍️ <b>Boutique</b>\nChoisissez une catégorie :", keyboard };
}

export function productListScreen(category: string, catIndex: number, products: (Product & { stock: number })[], page: number, total: number) {
  const keyboard: Keyboard = products.map((p) => [{ text: `${p.stock > 0 ? "" : "⛔ "}${p.name} — ${fcfa(p.price)}`, callback_data: `p:${p.id}` }]);
  const nav = [];
  if (page > 0) nav.push({ text: "◀️", callback_data: `cat:${catIndex}:${page - 1}` });
  if ((page + 1) * PAGE_SIZE < total) nav.push({ text: "▶️", callback_data: `cat:${catIndex}:${page + 1}` });
  if (nav.length) keyboard.push(nav);
  keyboard.push(back("cats", "⬅️ Catégories"));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return { text: `<b>${esc(category)}</b>${pages > 1 ? ` — page ${page + 1}/${pages}` : ""}\nChoisissez une offre :`, keyboard };
}

export function productScreen(p: Product, stock: number, balance: number, catIndex: number | null) {
  const lines = [
    `<b>${esc(p.name)}</b>`,
    "",
    p.description ? esc(p.description.slice(0, 900)) : "",
    "",
    `💵 Prix : <b>${fcfa(p.price)}</b>`,
    stock > 0 ? (p.instant ? "⚡ Livraison automatique immédiate" : "⏳ Livraison après traitement par le fournisseur") : "⛔ Rupture de stock",
  ].filter((l, i, a) => l !== "" || (a[i - 1] ?? "") !== "");
  const keyboard: Keyboard = [];
  if (stock > 0) {
    keyboard.push([{ text: `📱 Payer ${fcfa(p.price)} par Mobile Money`, callback_data: `buy:${p.id}` }]);
    if (balance >= p.price) keyboard.push([{ text: `💰 Payer avec mon solde (${fcfa(balance)})`, callback_data: `bal:${p.id}` }]);
  }
  keyboard.push(back(catIndex == null ? "cats" : `cat:${catIndex}:0`));
  return { text: lines.join("\n"), keyboard };
}

export function confirmBalanceScreen(p: Product, balance: number) {
  return {
    text: `Confirmer l'achat de <b>${esc(p.name)}</b> pour <b>${fcfa(p.price)}</b> ?\nSolde après achat : ${fcfa(balance - p.price)}.`,
    keyboard: [[{ text: "✅ Confirmer", callback_data: `balok:${p.id}` }], back(`p:${p.id}`, "❌ Annuler")],
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
    `🧾 <b>${esc(title)}</b>`,
    `Montant : <b>${fcfa(payment.amount)}</b>`,
    "",
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
    `${OP_EMOJI[op.code] ?? "📱"} <b>Paiement ${esc(op.name)}</b>`,
    "",
    `📞 Votre numéro : <b>${esc(payerPhone)}</b>`,
    `💵 Montant : <b>${fcfa(payment.amount)}</b>`,
  ];
  if (op.merchant_number) lines.push(`🏪 Numéro marchand : <code>${esc(op.merchant_number)}</code>`);
  lines.push("", "<b>Comment payer :</b>");
  const ussd = op.ussd_code?.replace(/^.*?:\s*/, "");
  if (ussd) {
    lines.push(`1️⃣ Depuis le <b>${esc(payerPhone)}</b>, composez :`, `<code>${esc(ussd)}</code>`, "<i>(touchez le code pour le copier)</i>", "2️⃣ Confirmez avec votre code secret.");
  } else if (op.code === "wave") {
    lines.push(
      `1️⃣ Ouvrez l'application <b>Wave</b> du <b>${esc(payerPhone)}</b>.`,
      `2️⃣ Touchez « Envoyer de l'argent » et saisissez le numéro <code>${esc(op.merchant_number ?? "")}</code>.`,
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
  lines.push("", "✅ Dès que votre paiement est reçu, vos accès arrivent automatiquement ici.", "⏱️ Ce paiement expire dans <b>15 minutes</b>.");
  const keyboard: Keyboard = [];
  if (op.pay_link?.startsWith("https://")) keyboard.push([{ text: `💳 Ouvrir ${op.name}`, url: op.pay_link }]);
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
  return { text: "📦 <b>Mes commandes</b>\nTouchez une commande pour voir son détail et vos accès :", keyboard };
}

export function orderScreen(o: Order, contents: string[]) {
  const date = new Date(o.created_at).toLocaleString("fr-FR", { timeZone: "Africa/Abidjan", dateStyle: "short", timeStyle: "short" });
  const lines = [
    `🧾 <b>${esc(o.ref)}</b> — ${date}`,
    `${esc(o.product_name)} ×${o.quantity}`,
    `Montant : ${fcfa(o.amount)} (${o.pay_method === "balance" ? "solde" : "Mobile Money"})`,
    `Statut : ${orderStatusLabel(o)}`,
  ];
  if (contents.length) {
    lines.push("", "🔐 <b>Vos accès :</b>");
    contents.forEach((c, i) => lines.push(`${contents.length > 1 ? `<b>#${i + 1}</b> ` : ""}<code>${esc(c)}</code>`));
  }
  const text = lines.join("\n");
  return { text: text.length > 4000 ? text.slice(0, 3990) + "…" : text, keyboard: [back("orders:0", "⬅️ Mes commandes")] };
}

export function walletScreen(balance: number, history: { amount: number; kind: string; created_at: string }[]) {
  const labels: Record<string, string> = { topup: "Recharge", purchase: "Achat", referral_bonus: "Bonus parrainage", refund: "Remboursement", admin: "Ajustement" };
  const lines = [`💰 <b>Mon solde : ${fcfa(balance)}</b>`, "", "Rechargez votre solde par Mobile Money puis achetez en un clic, sans repasser par le paiement."];
  if (history.length) {
    lines.push("", "<b>Derniers mouvements :</b>");
    for (const h of history) lines.push(`${h.amount > 0 ? "➕" : "➖"} ${fcfa(Math.abs(h.amount))} · ${labels[h.kind] ?? h.kind} · ${new Date(h.created_at).toLocaleDateString("fr-FR")}`);
  }
  return { text: lines.join("\n"), keyboard: [[{ text: "➕ Recharger mon solde", callback_data: "topup" }], homeRow()] };
}

export function topupScreen(amounts: number[]) {
  const keyboard: Keyboard = [];
  for (let i = 0; i < amounts.length; i += 3) keyboard.push(amounts.slice(i, i + 3).map((a) => ({ text: fcfa(a), callback_data: `topup:${a}` })));
  keyboard.push([{ text: "✏️ Autre montant", callback_data: "topupc" }], back("wallet"));
  return { text: "➕ <b>Recharger mon solde</b>\nChoisissez un montant :", keyboard };
}

export function referralScreen(link: string, percent: number, referrals: number, earned: number) {
  return {
    text: "🎁 <b>Parrainage</b>\n\n"
      + `Invitez vos amis avec votre lien : vous recevez <b>${percent} %</b> de leur premier achat, crédités directement sur votre solde.\n\n`
      + `🔗 Votre lien :\n<code>${esc(link)}</code>\n\n`
      + `👥 Filleuls : <b>${referrals}</b>\n💰 Gains : <b>${fcfa(earned)}</b>`,
    keyboard: [[{ text: "📤 Partager mon lien", url: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(`Abonnements premium livrés automatiquement sur ${SHOP_NAME()} 👇`)}` }], homeRow()],
  };
}

export const helpText = () => "❓ <b>Comment ça marche ?</b>\n\n"
  + "1️⃣ Ouvrez la 🛍️ Boutique et choisissez une offre\n"
  + "2️⃣ Payez par Orange Money, Moov Money, Wave ou avec votre solde\n"
  + "3️⃣ Vos accès arrivent automatiquement dans ce chat\n\n"
  + "Retrouvez tous vos accès dans 📦 Mes commandes.\n\n"
  + "Commandes : /start menu · /boutique · /commandes · /solde · /parrainage";
