import { serviceClient } from "./paydunya-config.ts";
import { fulfillPrimeOrder } from "./fulfill-prime.ts";
import { fulfillDigitrustOrder } from "./fulfill-digitrust.ts";
import { supplierOf } from "./supplier-routing.ts";

// Delivers a paid order: assigns license keys, fulfills supplier products,
// sends the confirmation email. Idempotent via claim_paydunya_order.
export async function deliverPaidOrder(orderId: string) {
  const client = serviceClient();
  const { data: claimed, error } = await client.rpc("claim_paydunya_order", { _order_id: orderId });
  if (error) throw new Error("Confirmation de commande impossible");
  if (!claimed) return { paid: true, already_paid: true };
  const { data: items, error: itemsError } = await client.from("order_items").select("id, product_id, product_name, quantity, products(primestore_id,digitrust_id)").eq("order_id", orderId);
  if (itemsError) throw new Error("Chargement des articles impossible");
  let hasPrime = false;
  let hasDigitrust = false;
  for (const item of items ?? []) {
    const product = Array.isArray(item.products) ? item.products[0] : item.products;
    // Own stock first (keys, accounts, links entered in the admin), supplier only as fallback.
    const { data: assigned, error: assignError } = await client.rpc("assign_paid_order_keys", { _order_id: orderId, _product_id: item.product_id, _quantity: item.quantity });
    const supplier = supplierOf(product ?? {});
    if (supplier === "primestore") { if (assignError || !assigned) hasPrime = true; continue; }
    if (supplier === "digitrust") { if (assignError || !assigned) hasDigitrust = true; continue; }
    if (assignError || !assigned) {
      await client.from("orders").update({ delivery_status: "failed", delivery_error: `Livraison à traiter : ${item.product_name}` }).eq("id", orderId);
      return { paid: true, email_sent: false, delivery_pending: true };
    }
  }
  if (hasPrime) {
    let fulfillmentError: unknown = null;
    try { const r = await fulfillPrimeOrder(client, orderId); if (!r.ok) fulfillmentError = r.results; } catch (e) { fulfillmentError = e; }
    if (fulfillmentError) {
      console.error("fulfill-primestore-order failed", orderId, fulfillmentError);
      await client.from("orders").update({ delivery_status: "failed", delivery_error: "Livraison fournisseur à reprendre" }).eq("id", orderId);
    }
  }
  if (hasDigitrust) {
    const result = await fulfillDigitrustOrder(client, orderId);
    if (!result.ok) return { paid: true, email_sent: false, delivery_pending: true };
  }
  // The existing email function loads purchased keys and records retry state.
  const { data, error: emailError } = await client.functions.invoke("send-order-email", { body: { order_id: orderId } });
  if (emailError) await client.from("orders").update({ delivery_status: "failed", delivery_error: "Envoi de confirmation à reprendre" }).eq("id", orderId);
  return { paid: true, email_sent: !emailError && !!data?.ok };
}

export async function finalizePayDunyaOrder(order: { id: string; amount: number; payment_id: string; payment_mode: string | null }, confirmed: Record<string, any>) {
  if (confirmed.status !== "completed") return { paid: false };
  if (Number(confirmed.invoice?.total_amount) !== Number(order.amount)) throw new Error("Montant PayDunya différent de la commande");
  if (confirmed.custom_data?.order_id !== order.id) throw new Error("Référence PayDunya différente de la commande");
  if (confirmed.invoice?.token && confirmed.invoice.token !== order.payment_id) throw new Error("Facture PayDunya différente de la commande");
  if (confirmed.mode && confirmed.mode !== order.payment_mode) throw new Error("Mode PayDunya différent de la commande");
  return deliverPaidOrder(order.id);
}
