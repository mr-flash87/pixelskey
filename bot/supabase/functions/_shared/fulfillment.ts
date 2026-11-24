// Livraison d'une commande payée.
// Règles :
//  1. Une seule exécution à la fois par commande (claim_delivery).
//  2. Le stock manuel passe avant le fournisseur.
//  3. L'intention d'achat fournisseur est enregistrée AVANT l'appel (supplier_attempted_at).
//     Si le résultat est incertain et que le fournisseur n'a pas de clé d'idempotence,
//     la commande passe en "uncertain" et n'est JAMAIS rachetée automatiquement.
//  4. Les identifiants livrés sont enregistrés de façon atomique (record_delivery) puis envoyés dans le chat.
import { db, type Order } from "./db.ts";
import { adapterFor } from "./suppliers/registry.ts";
import { SupplierError, type PurchaseResult } from "./suppliers/types.ts";
import { notifyAdmins } from "./notify.ts";
import { esc, tg } from "./telegram.ts";

export type DeliveryOutcome = "delivered" | "supplier_pending" | "failed" | "uncertain" | "skipped";

async function loadOrder(id: string) {
  const { data, error } = await db().from("orders").select("*, products(supplier_id, supplier_product_id)").eq("id", id).single();
  if (error || !data) throw new Error("Commande introuvable");
  const product = Array.isArray(data.products) ? data.products[0] : data.products;
  return { order: data as Order, product: product as { supplier_id: string; supplier_product_id: string | null } };
}

async function setStatus(orderId: string, patch: Record<string, unknown>) {
  const { error } = await db().from("orders").update(patch).eq("id", orderId);
  if (error) console.error("order update failed", orderId, error.message);
}

/** Message de livraison découpé pour rester sous la limite Telegram de 4096 caractères. */
export function deliveryMessages(order: Pick<Order, "ref" | "product_name">, items: string[]): string[] {
  const header = `✅ <b>Commande ${esc(order.ref)} livrée</b>\n${esc(order.product_name)}\n\n`;
  const footer = "\n\n🔐 Conservez ces accès en lieu sûr. Retrouvez-les à tout moment dans 📦 Mes commandes.";
  const blocks = items.map((it, i) => `${items.length > 1 ? `<b>#${i + 1}</b>\n` : ""}<code>${esc(it)}</code>`);
  const out: string[] = [];
  let current = header;
  for (const b of blocks) {
    if (current.length + b.length + 2 > 3800) { out.push(current); current = ""; }
    current += (current && current !== header ? "\n\n" : "") + b;
  }
  out.push(current + footer);
  return out;
}

async function finishDelivered(order: Order, items: string[], supplierOrderId: string | null): Promise<DeliveryOutcome> {
  const { data: recorded, error } = await db().rpc("record_delivery", { _order_id: order.id, _contents: items, _supplier_order_id: supplierOrderId });
  if (error) {
    // Achat effectué mais non enregistré : ne surtout pas relancer l'achat.
    await setStatus(order.id, { delivery_status: "uncertain", delivery_error: "Livraison reçue mais enregistrement impossible : vérifier chez le fournisseur" });
    await notifyAdmins(`⚠️ ${order.ref} : livraison reçue du fournisseur mais non enregistrée. Vérifiez la commande ${esc(supplierOrderId ?? "")}.`);
    return "uncertain";
  }
  if (!recorded) return "skipped";
  for (const text of deliveryMessages(order, items)) {
    await tg.send(order.telegram_id, text).catch((e) => console.error("delivery message failed", order.ref, e.message));
  }
  await notifyAdmins(`📦 ${esc(order.ref)} livrée — ${esc(order.product_name)} ×${order.quantity}`);
  return "delivered";
}

async function handleSupplierResult(order: Order, result: PurchaseResult): Promise<DeliveryOutcome> {
  if (result.status === "delivered") {
    if (result.items.length < order.quantity) {
      await setStatus(order.id, { delivery_status: "supplier_pending", supplier_order_id: result.supplierOrderId, delivery_error: "Livraison partielle du fournisseur" });
      await notifyAdmins(`⚠️ ${esc(order.ref)} : le fournisseur a livré ${result.items.length}/${order.quantity} élément(s). Vérification nécessaire.`);
      return "supplier_pending";
    }
    return finishDelivered(order, result.items, result.supplierOrderId);
  }
  const wasPending = order.delivery_status === "supplier_pending" || !!order.supplier_order_id;
  await setStatus(order.id, { delivery_status: "supplier_pending", supplier_order_id: result.supplierOrderId, delivery_error: null });
  if (!wasPending) {
    await tg.send(order.telegram_id, `⏳ <b>Commande ${esc(order.ref)} en préparation</b>\nLe fournisseur traite votre ${esc(order.product_name)}. Vous recevrez vos accès ici automatiquement.`).catch(() => undefined);
  }
  return "supplier_pending";
}

/**
 * Livre une commande payée. `from` : états de livraison à partir desquels on peut démarrer
 * (["none"] après paiement, ["supplier_pending"] pour le suivi, ["failed"] pour une relance admin).
 */
export async function deliverOrder(orderId: string, from: string[] = ["none"]): Promise<DeliveryOutcome> {
  const { data: claimed, error: claimError } = await db().rpc("claim_delivery", { _order_id: orderId, _from: from });
  if (claimError) throw new Error("Réservation de livraison impossible");
  if (!claimed) return "skipped";
  const { order, product } = await loadOrder(orderId);

  try {
    // 1) Suivi d'une commande fournisseur déjà acceptée.
    if (order.supplier_order_id) {
      const adapter = adapterFor(product.supplier_id);
      if (!adapter) throw new SupplierError("Fournisseur non branché", true);
      return await handleSupplierResult(order, await adapter.getOrder(order.supplier_order_id));
    }

    // 2) Stock manuel (prioritaire), tant qu'aucun achat fournisseur n'a été tenté.
    if (!order.supplier_attempted_at) {
      const { data: stock, error: stockError } = await db().rpc("take_manual_stock", { _order_id: order.id, _product_id: order.product_id, _quantity: order.quantity });
      if (stockError) throw new SupplierError("Lecture du stock manuel impossible", true);
      const contents = (stock ?? []).map((r: unknown) => typeof r === "string" ? r : (r as Record<string, string>).take_manual_stock ?? Object.values(r as object)[0]);
      if (contents.length >= order.quantity) return await finishDelivered(order, contents, null);
    }

    const adapter = adapterFor(product.supplier_id);
    if (!adapter || !product.supplier_product_id) {
      await setStatus(order.id, { delivery_status: "failed", delivery_error: "Stock manuel épuisé" });
      await notifyAdmins(`🚨 ${esc(order.ref)} payée mais stock épuisé : ${esc(order.product_name)}.\nAjoutez du stock puis /relancer ${esc(order.ref)}`);
      await tg.send(order.telegram_id, `⏳ <b>Commande ${esc(order.ref)} reçue</b>\nVotre ${esc(order.product_name)} est en cours de préparation. Vous recevrez vos accès ici très bientôt.`).catch(() => undefined);
      return "failed";
    }

    // 3) Achat fournisseur. Achat déjà tenté sans résultat connu → pas de second achat (sauf fournisseur idempotent).
    if (order.supplier_attempted_at && !adapter.idempotent) {
      await setStatus(order.id, { delivery_status: "uncertain", delivery_error: "Achat déjà tenté : vérifier l'historique fournisseur avant toute relance" });
      await notifyAdmins(`⚠️ ${esc(order.ref)} : un achat ${esc(adapter.id)} a déjà été tenté sans résultat connu. Vérifiez chez le fournisseur avant toute action.`);
      return "uncertain";
    }
    const { error: intentError } = await db().from("orders").update({ supplier_attempted_at: new Date().toISOString() }).eq("id", order.id).eq("delivery_status", "processing");
    if (intentError) throw new SupplierError("Enregistrement de l'intention d'achat impossible", true);
    order.supplier_attempted_at = new Date().toISOString();

    return await handleSupplierResult(order, await adapter.purchase(product.supplier_product_id, { orderId: order.id, quantity: order.quantity }));
  } catch (e) {
    const err = e instanceof SupplierError ? e : new SupplierError(e instanceof Error ? e.message : "Erreur de livraison", false);
    if (order.supplier_order_id) {
      // Commande fournisseur connue : on la retrouvera par sa référence au prochain passage, sans racheter.
      await setStatus(order.id, { delivery_status: "supplier_pending", delivery_error: err.message.slice(0, 300) });
      return "supplier_pending";
    }
    const adapter = adapterFor(product.supplier_id);
    const retryable = err.certain || (adapter?.idempotent ?? false);
    const attemptedBefore = !!order.supplier_attempted_at;
    await setStatus(order.id, {
      delivery_status: retryable || !attemptedBefore ? "failed" : "uncertain",
      delivery_error: err.message.slice(0, 300),
      // Refus certain : rien n'a été acheté, une relance pourra racheter.
      ...(err.certain && !order.supplier_order_id ? { supplier_attempted_at: null } : {}),
    });
    const action = err.needsFunding ? "Rechargez le portefeuille fournisseur puis" : retryable ? "Après vérification," : "Vérifiez l'historique fournisseur AVANT toute relance, puis";
    await notifyAdmins(`🚨 Livraison ${esc(order.ref)} bloquée (${esc(product.supplier_id)}) : ${esc(err.message)}\n${action} /relancer ${esc(order.ref)}`);
    if (from.includes("none")) {
      await tg.send(order.telegram_id, `⏳ <b>Commande ${esc(order.ref)} reçue</b>\nVotre ${esc(order.product_name)} est en cours de préparation. Vous recevrez vos accès ici dès qu'ils sont prêts.`).catch(() => undefined);
    }
    return retryable || !attemptedBefore ? "failed" : "uncertain";
  }
}
