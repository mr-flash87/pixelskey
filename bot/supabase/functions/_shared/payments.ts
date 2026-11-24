// Commandes, paiements FlashPay, solde et parrainage.
import { db, setting, type Order, type Product } from "./db.ts";
import { env, optionalEnv } from "./env.ts";
import { flashpay, FLASHPAY_MAX, FLASHPAY_MIN, type FlashPayPayment } from "./flashpay.ts";
import { adapterFor } from "./suppliers/registry.ts";
import { deliverOrder } from "./fulfillment.ts";
import { notifyAdmins } from "./notify.ts";
import { esc, fcfa, tg } from "./telegram.ts";

export class UserError extends Error {}

const callbackUrl = () => `${env("SUPABASE_URL")}/functions/v1/flashpay-webhook`;

/** Vérifie que le produit peut être vendu maintenant (stock manuel, sinon stock fournisseur en direct). */
export async function assertSellable(product: Product, quantity: number) {
  if (!product.is_active) throw new UserError("Ce produit n'est plus disponible.");
  const { count } = await db().from("stock_items").select("id", { count: "exact", head: true }).eq("product_id", product.id).eq("status", "available");
  if ((count ?? 0) >= quantity) return;
  const adapter = adapterFor(product.supplier_id);
  if (!adapter || !product.supplier_product_id || !product.supplier_available) throw new UserError("Rupture de stock pour ce produit. Revenez bientôt !");
  let ok = false;
  try { ok = await adapter.canSell(product.supplier_product_id, quantity); } catch { throw new UserError("Vérification du stock impossible pour le moment. Réessayez dans un instant."); }
  if (!ok) {
    await db().from("products").update({ supplier_available: false }).eq("id", product.id);
    throw new UserError("Rupture de stock pour ce produit. Revenez bientôt !");
  }
}

/** Annule les paiements FlashPay encore en attente de l'utilisateur (FlashPay interdit deux paiements en attente du même montant). */
async function cancelPendingPayments(telegramId: number) {
  const { data } = await db().from("payments").select("id").eq("telegram_id", telegramId).eq("status", "pending");
  for (const p of data ?? []) {
    // Lu ou annulé chez FlashPay : un paiement finalement payé est traité, jamais perdu.
    await cancelPayment(telegramId, p.id).catch(() => undefined);
  }
}

async function createFlashPayPayment(kind: "order" | "topup", telegramId: number, amount: number, reference: string, description: string, orderId: string | null) {
  if (amount < FLASHPAY_MIN || amount > FLASHPAY_MAX) throw new UserError(`Montant hors limites (${fcfa(FLASHPAY_MIN)} – ${fcfa(FLASHPAY_MAX)}).`);
  await cancelPendingPayments(telegramId);
  const botUser = optionalEnv("TELEGRAM_BOT_USERNAME");
  let payment: FlashPayPayment;
  try {
    payment = await flashpay.create({
      amount, reference, description, callback_url: callbackUrl(),
      ...(botUser ? { return_url: `https://t.me/${botUser}` } : {}),
      metadata: { kind, telegram_id: telegramId, ...(orderId ? { order_id: orderId } : {}) },
    });
  } catch (e) {
    console.error("flashpay create failed", e instanceof Error ? e.message : e);
    throw new UserError("Le paiement est momentanément indisponible. Réessayez dans quelques minutes.");
  }
  if (payment.amount !== amount || !payment.checkout_url?.startsWith("https://")) throw new UserError("Réponse de paiement invalide. Réessayez.");
  const { error } = await db().from("payments").insert({
    id: payment.id, kind, order_id: orderId, telegram_id: telegramId, amount, status: "pending",
    checkout_url: payment.checkout_url, expires_at: payment.expires_at,
  });
  if (error) throw new UserError("Enregistrement du paiement impossible. Réessayez.");
  return payment;
}

async function loadProduct(productId: number): Promise<Product> {
  const { data } = await db().from("products").select("*").eq("id", productId).maybeSingle();
  if (!data) throw new UserError("Produit introuvable.");
  return data as Product;
}

async function insertOrder(telegramId: number, product: Product, quantity: number, payMethod: "flashpay" | "balance"): Promise<Order> {
  const { data, error } = await db().from("orders").insert({
    telegram_id: telegramId, product_id: product.id, product_name: product.name, quantity,
    unit_price: product.price, amount: product.price * quantity, pay_method: payMethod,
  }).select("*").single();
  if (error || !data) throw new UserError("Création de la commande impossible. Réessayez.");
  return data as Order;
}

/** Commande payée par Mobile Money : crée la commande + le paiement FlashPay. */
export async function checkoutWithFlashPay(telegramId: number, productId: number, quantity = 1) {
  const product = await loadProduct(productId);
  await assertSellable(product, quantity);
  const order = await insertOrder(telegramId, product, quantity, "flashpay");
  try {
    const payment = await createFlashPayPayment("order", telegramId, order.amount, order.ref, `${product.name} ×${quantity}`, order.id);
    return { order, payment };
  } catch (e) {
    await db().from("orders").update({ status: "cancelled" }).eq("id", order.id);
    throw e;
  }
}

/** Commande payée avec le solde : débit atomique puis livraison immédiate. */
export async function checkoutWithBalance(telegramId: number, productId: number, quantity = 1) {
  const product = await loadProduct(productId);
  await assertSellable(product, quantity);
  const order = await insertOrder(telegramId, product, quantity, "balance");
  const { data: paid, error } = await db().rpc("pay_order_with_balance", { _order_id: order.id });
  if (error || !paid) {
    await db().from("orders").update({ status: "cancelled" }).eq("id", order.id);
    throw new UserError(error?.message.includes("solde insuffisant") ? "Solde insuffisant. Rechargez votre solde ou payez par Mobile Money." : "Paiement par solde impossible. Réessayez.");
  }
  await afterOrderPaid({ ...order, status: "paid" });
  return order;
}

/** Recharge de solde via FlashPay. */
export async function createTopup(telegramId: number, amount: number) {
  const min = Number(await setting("topup_min", 500));
  const max = Number(await setting("topup_max", 200000));
  if (!Number.isInteger(amount) || amount < min || amount > max) throw new UserError(`Montant de recharge entre ${fcfa(min)} et ${fcfa(max)}.`);
  return createFlashPayPayment("topup", telegramId, amount, `RECH-${telegramId}-${Date.now().toString(36).toUpperCase()}`, "Recharge de solde", null);
}

/** Bonus versé au parrain, une seule fois par filleul (sur son premier achat payé). */
async function grantReferralBonus(order: Order) {
  const { data: user } = await db().from("bot_users").select("referrer_id").eq("telegram_id", order.telegram_id).maybeSingle();
  if (!user?.referrer_id || order.amount <= 0) return;
  const percent = Number(await setting("referral_percent", 5));
  const bonus = Math.floor(order.amount * percent / 100);
  if (bonus <= 0) return;
  const { data: balance, error } = await db().rpc("wallet_apply", { _telegram_id: user.referrer_id, _amount: bonus, _kind: "referral_bonus", _ref: String(order.telegram_id) });
  if (error || balance == null) return; // déjà versé
  await tg.send(user.referrer_id, `🎁 <b>Bonus de parrainage : +${fcfa(bonus)}</b>\nUn ami invité vient de faire son premier achat. Nouveau solde : ${fcfa(balance)}.`).catch(() => undefined);
}

async function afterOrderPaid(order: Order) {
  await notifyAdmins(`💰 Vente ${esc(order.ref)} — ${esc(order.product_name)} ×${order.quantity} — ${fcfa(order.amount)} (${order.pay_method === "balance" ? "solde" : "Mobile Money"}) — client ${order.telegram_id}`);
  await grantReferralBonus(order).catch((e) => console.error("referral bonus failed", e.message));
  await deliverOrder(order.id, ["none"]);
}

/**
 * Traite un paiement FlashPay relu depuis l'API (jamais depuis le seul corps du webhook ou une redirection).
 * Idempotent : un paiement déjà confirmé ne livre rien une seconde fois.
 */
export async function processPaidPayment(remote: FlashPayPayment) {
  if (remote.status !== "paid") return { confirmed: false };
  const { data: local } = await db().from("payments").select("amount").eq("id", remote.id).maybeSingle();
  if (!local) return { confirmed: false };
  if (Number(remote.amount) !== Number(local.amount)) {
    await notifyAdmins(`🚨 Paiement ${esc(remote.id)} : montant FlashPay ${remote.amount} différent du montant attendu ${local.amount}. Rien n'a été livré.`);
    return { confirmed: false };
  }
  const { data: rows, error } = await db().rpc("confirm_payment", { _payment_id: remote.id, _amount: local.amount });
  if (error) throw new Error("Confirmation du paiement impossible");
  const row = (rows ?? [])[0] as { kind: string; order_id: string | null; telegram_id: number; amount: number } | undefined;
  if (!row) return { confirmed: true, already: true };
  if (row.kind === "topup") {
    const { data: u } = await db().from("bot_users").select("balance").eq("telegram_id", row.telegram_id).single();
    await tg.send(row.telegram_id, `✅ <b>Recharge reçue : +${fcfa(row.amount)}</b>\nNouveau solde : ${fcfa(u?.balance ?? 0)}.`).catch(() => undefined);
    await notifyAdmins(`💳 Recharge ${fcfa(row.amount)} — client ${row.telegram_id}`);
    return { confirmed: true };
  }
  const { data: order } = await db().from("orders").select("*").eq("id", row.order_id).single();
  if (order) {
    await tg.send(row.telegram_id, `✅ <b>Paiement reçu pour ${esc(order.ref)}</b>\nLivraison en cours…`).catch(() => undefined);
    await afterOrderPaid(order as Order);
  }
  return { confirmed: true };
}

/** Bouton « J'ai payé » : relit le paiement chez FlashPay. */
export async function refreshPayment(telegramId: number, paymentId: string) {
  const { data: p } = await db().from("payments").select("id, status, telegram_id").eq("id", paymentId).maybeSingle();
  if (!p || p.telegram_id !== telegramId) throw new UserError("Paiement introuvable.");
  if (p.status === "paid") return "paid" as const;
  const remote = await flashpay.get(paymentId);
  if (remote.status === "paid") { await processPaidPayment(remote); return "paid" as const; }
  if (remote.status !== "pending") await db().from("payments").update({ status: remote.status }).eq("id", paymentId).eq("status", "pending");
  return remote.status;
}

export async function cancelPayment(telegramId: number, paymentId: string) {
  const { data: p } = await db().from("payments").select("id, telegram_id, status, order_id").eq("id", paymentId).maybeSingle();
  if (!p || p.telegram_id !== telegramId || p.status !== "pending") return;
  const remote = await flashpay.cancel(paymentId).catch(() => flashpay.get(paymentId));
  if (remote.status === "paid") { await processPaidPayment(remote); return; }
  await db().from("payments").update({ status: "cancelled" }).eq("id", paymentId).eq("status", "pending");
  if (p.order_id) await db().from("orders").update({ status: "cancelled" }).eq("id", p.order_id).eq("status", "pending");
}
