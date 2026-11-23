import { digitrust, DigitrustError } from "./digitrust.ts";
import { digitrustSellable } from "./supplier-routing.ts";

// Digitrust has no documented idempotency key: persist intent before spending.
// An uncertain response MUST NOT trigger another purchase automatically.
export async function fulfillDigitrustOrder(client: any, orderId: string) {
  const { data: order, error: orderError } = await client.from("orders").select("status, customer_email").eq("id", orderId).single();
  if (orderError || order?.status !== "paid") return { ok: false };
  const { data: items, error } = await client.from("order_items").select("id, product_id, quantity, products(digitrust_id)").eq("order_id", orderId);
  if (error) throw new Error("Lecture des articles Digitrust impossible");
  let ok = true;
  for (const item of items ?? []) {
    const product = Array.isArray(item.products) ? item.products[0] : item.products;
    if (!product?.digitrust_id) continue;
    const { count: own, error: ownError } = await client.from("license_keys").select("id", { count: "exact", head: true }).eq("order_id", orderId).eq("product_id", item.product_id);
    const { count: sent, error: sentError } = await client.from("license_deliveries").select("id", { count: "exact", head: true }).eq("order_item_id", item.id).eq("status", "delivered");
    if (ownError || sentError) throw new Error("Vérification du stock impossible");
    const missing = item.quantity - (own ?? 0) - (sent ?? 0);
    if (missing <= 0) continue;
    const { data: attempt, error: attemptError } = await client.from("digitrust_purchase_attempts").select("status, supplier_order_id").eq("order_item_id", item.id).maybeSingle();
    if (attemptError) throw new Error("Lecture de la tentative impossible");
    // Do not allocate new local keys after an accepted or uncertain supplier purchase.
    if (!sent && !attempt?.supplier_order_id && (!attempt || attempt.status === "failed")) {
      const { data: assigned, error: assignError } = await client.rpc("assign_paid_order_keys", { _order_id: orderId, _product_id: item.product_id, _quantity: item.quantity });
      if (assignError) throw new Error("Attribution du stock local impossible");
      if (assigned) continue;
    }
    let supplierOrder;
    try {
      if (attempt?.supplier_order_id) {
        supplierOrder = (await digitrust.order(attempt.supplier_order_id)).order;
      } else {
        if (attempt && attempt.status !== "failed") { ok = false; continue; }
        const { product: live } = await digitrust.product(product.digitrust_id);
        const wallet = await digitrust.balance();
        if (wallet.currency !== "USD" || !digitrustSellable(live, wallet.balance) || live.stock < missing || wallet.balance < live.price * missing) {
          ok = false;
          await client.from("orders").update({ delivery_status: "failed", delivery_error: "Digitrust : vérifier le stock et recharger le portefeuille fournisseur" }).eq("id", orderId);
          continue;
        }
        const { data: claimed, error: claimError } = await client.rpc("claim_digitrust_purchase", { _item_id: item.id });
        if (claimError || !claimed) { ok = false; continue; }
        try {
          supplierOrder = (await digitrust.purchase(product.digitrust_id, missing, order.customer_email)).order;
        } catch (e) {
          const certainFailure = e instanceof DigitrustError && [400, 401, 402, 403, 404, 429].includes(e.status);
          const message = certainFailure ? `Achat Digitrust refusé (${e.status}) : vérifier le compte fournisseur` : "Réponse incertaine : vérifier l’historique Digitrust avant tout nouvel achat";
          await client.from("digitrust_purchase_attempts").update({ status: certainFailure ? "failed" : "uncertain", error: message, updated_at: new Date().toISOString() }).eq("order_item_id", item.id);
          throw new Error(message);
        }
        if (!supplierOrder?.id) throw new Error("Référence Digitrust manquante : vérification manuelle nécessaire");
        const { error: saveError } = await client.from("digitrust_purchase_attempts").update({ supplier_order_id: String(supplierOrder.id), status: "purchased", updated_at: new Date().toISOString() }).eq("order_item_id", item.id);
        if (saveError) throw new Error("Achat accepté : sauvegarde à vérifier avant toute relance");
      }
      const contents = supplierOrder.items;
      if ((supplierOrder.status && supplierOrder.status !== "delivered") || !Array.isArray(contents) || contents.length !== missing || contents.some((v) => typeof v !== "string" || !v.trim())) {
        ok = false;
        await client.from("orders").update({ delivery_status: "pending", delivery_error: "Commande acceptée par Digitrust : accès en attente de traitement fournisseur" }).eq("id", orderId);
        continue;
      }
      const { error: deliveryError } = await client.rpc("record_digitrust_delivery", { _item_id: item.id, _supplier_order_id: String(supplierOrder.id), _contents: contents });
      if (deliveryError) throw new Error("Enregistrement de livraison Digitrust à reprendre");
    } catch (e) {
      ok = false;
      await client.from("orders").update({ delivery_status: "failed", delivery_error: "Livraison Digitrust à vérifier dans l’administration" }).eq("id", orderId);
    }
  }
  return { ok };
}
