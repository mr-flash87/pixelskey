import { describe, expect, it, vi, beforeEach } from "vitest";
import { primeListingState } from "../../supabase/functions/_shared/prime-manual-catalog";
vi.mock("../../supabase/functions/_shared/primestore.ts", () => ({ prime: { createOrder: vi.fn(), getOrder: vi.fn() } }));
import { prime } from "../../supabase/functions/_shared/primestore";
import { fulfillPrimeOrder } from "../../supabase/functions/_shared/fulfill-prime";

describe("Prime Labs manual offers", () => {
  it("publishes reviewed manual offers without claiming instant delivery", () => {
    expect(primeListingState({ id: 126, delivery_mode: "manual", stock: { available: null, in_stock: true } })).toEqual({ supported: true, instant_delivery: false, stock: 100 });
  });
  it("keeps unavailable manual offers unorderable", () => {
    expect(primeListingState({ id: 126, delivery_mode: "manual", stock: { in_stock: false } }).stock).toBe(0);
  });
  it("does not import activation requests as ordinary manual keys", () => {
    expect(primeListingState({ id: 141, delivery_mode: "activation" }).supported).toBe(false);
  });
});

describe("Prime Labs manual reconciliation", () => {
  beforeEach(() => vi.clearAllMocks());
  it("reads the accepted supplier order without repurchasing or fabricating keys", async () => {
    vi.mocked(prime.getOrder).mockResolvedValue({ order: { id: "supplier-order", items: [] } });
    const writes: unknown[] = [];
    const db = { from: (table: string) => {
      const value = table === "orders" ? { data: { status: "paid" } }
        : table === "order_items" ? { data: [{ id: "item", product_id: "product", quantity: 1, products: { primestore_id: "126" } }] }
        : table === "license_keys" ? { count: 0 }
        : { data: [{ id: "delivery", status: "pending", primestore_order_id: "supplier-order" }] };
      const query: any = { then: (resolve: any) => Promise.resolve(value).then(resolve) };
      for (const key of ["select", "eq", "in", "single", "delete", "neq"]) query[key] = () => query;
      query.insert = (row: unknown) => { writes.push(row); return query; };
      return query;
    } };
    const result = await fulfillPrimeOrder(db, "order");
    expect(prime.getOrder).toHaveBeenCalledWith("supplier-order");
    expect(prime.createOrder).not.toHaveBeenCalled();
    expect(result.results).toEqual([{ item_id: "item", status: "pending" }]);
    expect(writes).toEqual([{ order_item_id: "item", order_id: "order", content: "", status: "pending", primestore_order_id: "supplier-order" }]);
  });
});
