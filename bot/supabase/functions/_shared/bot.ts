// Traitement d'une mise à jour Telegram (message ou bouton).
import { db, setting, type BotUser, type Order, type Product } from "./db.ts";
import { adminIds, optionalEnv } from "./env.ts";
import { displayedStock } from "./catalog.ts";
import { cancelPayment, checkoutWithBalance, checkoutWithFlashPay, createTopup, findOperator, loadPendingPayment, refreshPayment, submitPayer, UserError } from "./payments.ts";
import { normalizePayerPhone } from "./flashpay.ts";
import { botUsername, esc, tg, type TgUpdate, type TgUser } from "./telegram.ts";
import * as ui from "./ui.ts";
import { handleAdminCommand } from "./admin.ts";
import { handleMyChatMember, isCommunityMember, joinScreen } from "./community.ts";

type Screen = { text: string; keyboard: import("./telegram.ts").Keyboard };

/** Crée l'utilisateur au premier contact ; rattache le parrain seulement à ce moment-là. */
export async function upsertUser(from: TgUser, referralCode?: string): Promise<BotUser> {
  const { data: existing } = await db().from("bot_users").select("*").eq("telegram_id", from.id).maybeSingle();
  if (existing) {
    if (existing.username !== (from.username ?? null) || existing.first_name !== (from.first_name ?? null)) {
      await db().from("bot_users").update({ username: from.username ?? null, first_name: from.first_name ?? null }).eq("telegram_id", from.id);
    }
    return existing as BotUser;
  }
  let referrerId: number | null = null;
  if (referralCode && /^[a-f0-9]{8}$/.test(referralCode)) {
    const { data: ref } = await db().from("bot_users").select("telegram_id").eq("referral_code", referralCode).maybeSingle();
    if (ref && ref.telegram_id !== from.id) referrerId = ref.telegram_id;
  }
  const { data, error } = await db().from("bot_users")
    .upsert({ telegram_id: from.id, username: from.username ?? null, first_name: from.first_name ?? null, referrer_id: referrerId }, { onConflict: "telegram_id", ignoreDuplicates: true })
    .select("*").maybeSingle();
  if (error) throw new Error("Création du compte impossible");
  if (!data) return (await db().from("bot_users").select("*").eq("telegram_id", from.id).single()).data as BotUser;
  if (referrerId) {
    await tg.send(referrerId, `🎉 <b>${esc(from.first_name ?? "Un ami")}</b> a rejoint la boutique grâce à votre lien. Vous recevrez votre bonus à son premier achat.`).catch(() => undefined);
  }
  return data as BotUser;
}

const setState = (id: number, state: string | null, data: Record<string, unknown> = {}) =>
  db().from("bot_users").update({ state, state_data: data }).eq("telegram_id", id);

async function categories(): Promise<{ name: string; count: number }[]> {
  const { data } = await db().from("products").select("category").eq("is_active", true);
  const counts = new Map<string, number>();
  for (const r of data ?? []) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

async function categoryScreen(index: number, page: number): Promise<Screen> {
  const cats = await categories();
  const cat = cats[index];
  if (!cat) return ui.categoriesScreen(cats);
  const { data } = await db().from("products").select("*").eq("is_active", true).eq("category", cat.name).order("position").order("price");
  const all = (data ?? []) as Product[];
  const stock = await displayedStock(all.map((p) => p.id));
  // Disponibles d'abord, ordre stable à l'intérieur de chaque groupe.
  const sorted = all.map((p) => ({ ...p, stock: stock.get(p.id) ?? 0 })).sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0));
  const safePage = Math.min(Math.max(0, page), Math.max(0, Math.ceil(sorted.length / ui.PAGE_SIZE) - 1));
  return ui.productListScreen(cat.name, index, sorted.slice(safePage * ui.PAGE_SIZE, (safePage + 1) * ui.PAGE_SIZE), safePage, sorted.length);
}

async function productScreen(productId: number, user: BotUser): Promise<Screen> {
  const { data: p } = await db().from("products").select("*").eq("id", productId).eq("is_active", true).maybeSingle();
  if (!p) return { text: "Ce produit n'est plus disponible.", keyboard: [ui.back("cats", "⬅️ Catégories")] };
  const cats = await categories();
  const catIndex = cats.findIndex((c) => c.name === p.category);
  const stock = (await displayedStock([p.id])).get(p.id) ?? 0;
  return ui.productScreen(p as Product, stock, user.balance, catIndex >= 0 ? catIndex : null);
}

async function ordersScreen(user: BotUser, page: number): Promise<Screen> {
  const size = 8;
  const { data } = await db().from("orders").select("*").eq("telegram_id", user.telegram_id).neq("status", "cancelled")
    .order("created_at", { ascending: false }).range(page * size, page * size + size);
  const rows = (data ?? []) as Order[];
  return ui.ordersScreen(rows.slice(0, size), page, rows.length > size);
}

async function orderScreen(user: BotUser, ref: string): Promise<Screen> {
  const { data: o } = await db().from("orders").select("*").eq("ref", ref).eq("telegram_id", user.telegram_id).maybeSingle();
  if (!o) return { text: "Commande introuvable.", keyboard: [ui.back("orders:0")] };
  const { data: d } = await db().from("deliveries").select("content").eq("order_id", o.id).order("id");
  return ui.orderScreen(o as Order, (d ?? []).map((r) => r.content));
}

async function walletScreen(user: BotUser): Promise<Screen> {
  const { data } = await db().from("wallet_transactions").select("amount, kind, created_at").eq("telegram_id", user.telegram_id).order("created_at", { ascending: false }).limit(5);
  return ui.walletScreen(user.balance, data ?? []);
}

async function referralScreen(user: BotUser): Promise<Screen> {
  const username = await botUsername();
  const [{ count }, { data: bonuses }, percent] = await Promise.all([
    db().from("bot_users").select("telegram_id", { count: "exact", head: true }).eq("referrer_id", user.telegram_id),
    db().from("wallet_transactions").select("amount").eq("telegram_id", user.telegram_id).eq("kind", "referral_bonus"),
    setting("referral_percent", 5),
  ]);
  const earned = (bonuses ?? []).reduce((s, b) => s + b.amount, 0);
  return ui.referralScreen(`https://t.me/${username}?start=ref_${user.referral_code}`, Number(percent), count ?? 0, earned);
}

async function sendPayment(chatId: number, messageId: number | undefined, title: string, payment: Awaited<ReturnType<typeof createTopup>>) {
  const s = ui.paymentScreen(title, payment);
  await tg.edit(chatId, messageId, s.text, s.keyboard);
}

async function startTopup(chatId: number, messageId: number | undefined, user: BotUser, amount: number) {
  const payment = await createTopup(user.telegram_id, amount);
  await sendPayment(chatId, messageId, "Recharge de solde", payment);
}

async function handleCallback(update: NonNullable<TgUpdate["callback_query"]>, user: BotUser) {
  const chatId = update.message?.chat.id ?? update.from.id;
  const mid = update.message?.message_id;
  const [action, a = "", b = ""] = (update.data ?? "").split(":");
  const show = async (s: Screen) => { await tg.edit(chatId, mid, s.text, s.keyboard); };
  let toast: string | undefined;
  try {
    switch (action) {
      case "joined": {
        if (!(await isCommunityMember(user.telegram_id, true))) {
          await tg.answer(update.id, "Vous n'êtes pas encore membre du groupe. Rejoignez-le puis réessayez.", true);
          return;
        }
        toast = "✅ Bienvenue !";
        await show(ui.homeScreen(update.from.first_name, user.balance));
        break;
      }
      case "noop": break;
      case "home": { const s = ui.homeScreen(update.from.first_name, user.balance); await show(s); break; }
      case "help": await show({ text: ui.helpText(), keyboard: [ui.homeRow()] }); break;
      case "cats": await show(ui.categoriesScreen(await categories())); break;
      case "cat": await show(await categoryScreen(Number(a), Number(b))); break;
      case "p": await show(await productScreen(Number(a), user)); break;
      case "buy": {
        const { order, payment } = await checkoutWithFlashPay(user.telegram_id, Number(a));
        await sendPayment(chatId, mid, `Commande ${order.ref} — ${order.product_name}`, payment);
        break;
      }
      case "bal": {
        const { data: p } = await db().from("products").select("*").eq("id", Number(a)).maybeSingle();
        if (!p) throw new UserError("Produit introuvable.");
        if (user.balance < p.price) throw new UserError("Solde insuffisant.");
        await show(ui.confirmBalanceScreen(p as Product, user.balance));
        break;
      }
      case "balok": {
        const order = await checkoutWithBalance(user.telegram_id, Number(a));
        await tg.edit(chatId, mid, `✅ <b>Commande ${esc(order.ref)} payée avec votre solde.</b>`, [[{ text: "📦 Mes commandes", callback_data: "orders:0" }], ui.homeRow()]);
        break;
      }
      case "pay": {
        await setState(user.telegram_id, null);
        const { payment, title } = await loadPendingPayment(user.telegram_id, a);
        await show(ui.paymentScreen(title, payment));
        break;
      }
      case "op": {
        const { payment } = await loadPendingPayment(user.telegram_id, a);
        const op = findOperator(payment, b);
        await setState(user.telegram_id, "payer_phone", { payment_id: a, operator: b });
        await show(ui.askPayerPhoneScreen(op, a));
        break;
      }
      case "chk": {
        const status = await refreshPayment(user.telegram_id, a);
        if (status === "paid") { toast = "✅ Paiement reçu !"; await show({ text: "✅ <b>Paiement reçu.</b> Vos accès vous sont envoyés dans ce chat.", keyboard: [[{ text: "📦 Mes commandes", callback_data: "orders:0" }], ui.homeRow()] }); }
        else if (status === "pending") toast = "⏳ Paiement pas encore reçu. Si vous venez de payer, patientez quelques secondes puis réessayez.";
        else { toast = "Ce paiement a expiré ou a été annulé."; await show({ text: "⌛ Ce paiement a expiré ou a été annulé. Vous pouvez recommencer depuis la boutique.", keyboard: [[{ text: "🛍️ Boutique", callback_data: "cats" }], ui.homeRow()] }); }
        await tg.answer(update.id, toast, status === "pending");
        return;
      }
      case "cxl": await cancelPayment(user.telegram_id, a); await show({ text: "❌ Paiement annulé.", keyboard: [[{ text: "🛍️ Boutique", callback_data: "cats" }], ui.homeRow()] }); break;
      case "orders": await show(await ordersScreen(user, Math.max(0, Number(a) || 0))); break;
      case "o": await show(await orderScreen(user, a)); break;
      case "wallet": await show(await walletScreen(user)); break;
      case "topup":
        if (a) { await startTopup(chatId, mid, user, Number(a)); break; }
        await show(ui.topupScreen([1000, 2000, 5000, 10000, 20000, 50000]));
        break;
      case "topupc":
        await setState(user.telegram_id, "topup_amount");
        await show({ text: "✏️ Envoyez le montant à recharger (en F CFA), par exemple <code>7500</code>.", keyboard: [ui.back("wallet", "❌ Annuler")] });
        break;
      case "ref": await show(await referralScreen(user)); break;
      default: toast = "Action inconnue.";
    }
  } catch (e) {
    if (e instanceof UserError) { await tg.answer(update.id, e.message, true); return; }
    throw e;
  }
  await tg.answer(update.id, toast);
}

async function handleMessage(msg: NonNullable<TgUpdate["message"]>, user: BotUser) {
  const chatId = msg.chat.id;
  const text = (msg.text ?? "").trim();
  if (msg.chat.type !== "private") return;

  if (text.startsWith("/") && adminIds().includes(user.telegram_id)) {
    if (await handleAdminCommand(chatId, text)) return;
  }
  const command = text.split(/\s+/)[0].split("@")[0].toLowerCase();
  const reply = (s: Screen) => tg.send(chatId, s.text, s.keyboard);
  try {
    switch (command) {
      case "/start": {
        await setState(user.telegram_id, null);
        const productId = text.match(/^\/start\s+p_(\d+)$/)?.[1];
        await reply(productId ? await productScreen(Number(productId), user) : ui.homeScreen(msg.from?.first_name, user.balance));
        return;
      }
      case "/boutique": await reply(ui.categoriesScreen(await categories())); return;
      case "/commandes": await reply(await ordersScreen(user, 0)); return;
      case "/solde": await reply(await walletScreen(user)); return;
      case "/parrainage": await reply(await referralScreen(user)); return;
      case "/aide": case "/help": await reply({ text: ui.helpText(), keyboard: [ui.homeRow()] }); return;
    }
    if (user.state === "payer_phone") {
      const { payment_id, operator } = user.state_data as { payment_id?: string; operator?: string };
      const phone = normalizePayerPhone(text);
      if (!phone) { await tg.send(chatId, "Numéro invalide. Envoyez les <b>8 chiffres</b> du numéro qui va payer, par exemple <code>70123456</code>."); return; }
      if (!payment_id || !operator) { await setState(user.telegram_id, null); await reply(ui.homeScreen(msg.from?.first_name, user.balance)); return; }
      const { payment, operator: op } = await submitPayer(user.telegram_id, payment_id, operator, phone);
      await setState(user.telegram_id, null);
      await reply(ui.operatorInstructionsScreen(payment, op, phone));
      return;
    }
    if (user.state === "topup_amount") {
      const amount = Number(text.replace(/[\s.,F]/gi, ""));
      if (!Number.isInteger(amount) || amount <= 0) { await tg.send(chatId, "Montant invalide. Envoyez un nombre, par exemple <code>7500</code>."); return; }
      await setState(user.telegram_id, null);
      await startTopup(chatId, undefined, user, amount);
      return;
    }
    await reply(ui.homeScreen(msg.from?.first_name, user.balance));
  } catch (e) {
    if (e instanceof UserError) { await tg.send(chatId, `⚠️ ${esc(e.message)}`); return; }
    throw e;
  }
}

export async function handleUpdate(update: TgUpdate) {
  if (update.my_chat_member) return handleMyChatMember(update.my_chat_member);
  const from = update.message?.from ?? update.callback_query?.from;
  if (!from || (from as { is_bot?: boolean }).is_bot) return;
  if (update.message && update.message.chat.type !== "private") return;
  const startArg = update.message?.text?.match(/^\/start\s+ref_([a-f0-9]{8})$/)?.[1];
  const user = await upsertUser(from, startArg);
  if (user.is_blocked) return;
  // Adhésion au groupe officiel obligatoire (le parrainage est enregistré avant).
  if (update.callback_query?.data !== "joined" && !(await isCommunityMember(user.telegram_id))) {
    const s = await joinScreen();
    if (update.callback_query) {
      await tg.answer(update.callback_query.id, "Rejoignez d'abord notre groupe.", true);
      await tg.edit(update.callback_query.from.id, update.callback_query.message?.message_id, s.text, s.keyboard);
    } else await tg.send(from.id, s.text, s.keyboard);
    return;
  }
  if (update.callback_query) return handleCallback(update.callback_query, user);
  if (update.message) return handleMessage(update.message, user);
}
