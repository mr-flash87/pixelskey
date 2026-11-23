import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("../../supabase/functions/_shared/digitrust.ts", () => ({
  digitrust: { product: vi.fn(), balance: vi.fn(), purchase: vi.fn(), order: vi.fn() },
  DigitrustError: class extends Error { status = 500; },
}));
import { digitrust } from "../../supabase/functions/_shared/digitrust";
import { fulfillDigitrustOrder } from "../../supabase/functions/_shared/fulfill-digitrust";

function client(attempt: unknown, own = 0, assigned = false) {
  const from = vi.fn((table: string) => {
    const value = table === "orders" ? { data: { status: "paid", customer_email: "test@example.com" } }
      : table === "order_items" ? { data: [{ id: "item", product_id: "product", quantity: 1, products: { digitrust_id: "89" } }] }
      : table === "license_keys" ? { count: own }
      : table === "license_deliveries" ? { count: 0 }
      : { data: attempt };
    const query: any = { then: (resolve: any) => Promise.resolve(value).then(resolve) };
    for (const key of ["select", "eq", "single", "maybeSingle", "update"]) query[key] = () => query;
    return query;
  });
  return { from, rpc: vi.fn(async () => ({ data: assigned, error: null })) };
}
describe("Digitrust stock and recovery safeguards", () => {
  beforeEach(() => vi.clearAllMocks());
  it("does not buy when the order already has a local key", async () => {
    expect(await fulfillDigitrustOrder(client(null, 1), "order")).toEqual({ ok: true });
    expect(digitrust.purchase).not.toHaveBeenCalled();
    expect(digitrust.product).not.toHaveBeenCalled();
  });
  it("uses replenished local stock before a supplier purchase", async () => {
    const db = client(null, 0, true);
    expect(await fulfillDigitrustOrder(db, "order")).toEqual({ ok: true });
    expect(db.rpc).toHaveBeenCalledWith("assign_paid_order_keys", { _order_id: "order", _product_id: "product", _quantity: 1 });
    expect(digitrust.purchase).not.toHaveBeenCalled();
  });
  it("never repeats an uncertain supplier purchase", async () => {
    const db = client({ status: "uncertain", supplier_order_id: null });
    expect(await fulfillDigitrustOrder(db, "order")).toEqual({ ok: false });
    expect(digitrust.purchase).not.toHaveBeenCalled();
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("keeps accepted manual orders pending without another purchase or fabricated delivery", async () => {
    vi.mocked(digitrust.order).mockResolvedValue({ order: { id: 65, status: "pending", items: [] } });
    const db = client({ status: "purchased", supplier_order_id: "65" });
    expect(await fulfillDigitrustOrder(db, "order")).toEqual({ ok: false });
    expect(digitrust.order).toHaveBeenCalledWith("65");
    expect(digitrust.purchase).not.toHaveBeenCalled();
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("does not turn a completed invitation without contents into a fake key", async () => {
    vi.mocked(digitrust.order).mockResolvedValue({ order: { id: 65, status: "delivered", items: [] } });
    const db = client({ status: "purchased", supplier_order_id: "65" });
    expect(await fulfillDigitrustOrder(db, "order")).toEqual({ ok: false });
    expect(db.rpc).not.toHaveBeenCalled();
    expect(digitrust.purchase).not.toHaveBeenCalled();
  });
});
