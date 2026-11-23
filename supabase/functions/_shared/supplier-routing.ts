export function supplierOf(product: { primestore_id?: string | null; digitrust_id?: string | null }): "primestore" | "digitrust" | "local" {
  if (product.digitrust_id) return "digitrust";
  if (product.primestore_id) return "primestore";
  return "local";
}
export function digitrustSellable(product: { delivery: string; stock: number; price: number; time_limited?: { expired?: boolean; ends_on?: string } | null }, balance: number, now = Date.now()): boolean {
  const end = product.time_limited?.ends_on;
  return ["instant", "manual"].includes(product.delivery) && product.stock > 0 && product.price > 0 && balance >= product.price
    && !product.time_limited?.expired && (!end || Date.parse(`${end}T23:59:59Z`) >= now);
}
export function digitrustOrderable(product: Parameters<typeof digitrustSellable>[0], quantity = 1): boolean {
  return Number.isInteger(quantity) && quantity > 0 && product.stock >= quantity && digitrustSellable(product, Number.MAX_VALUE);
}
export function digitrustListingState(product: Parameters<typeof digitrustSellable>[0], _balance: number, reviewed: boolean) {
  return {
    is_active: reviewed && ["instant", "manual"].includes(product.delivery) && Number.isFinite(product.price) && product.price > 0,
    stock: reviewed && digitrustOrderable(product) ? Math.max(0, Math.floor(product.stock)) : 0,
  };
}
