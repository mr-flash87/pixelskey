import { describe, expect, it } from "vitest";
import { supplierOf, digitrustSellable, digitrustListingState, digitrustOrderable } from "../../supabase/functions/_shared/supplier-routing";

describe("second supplier isolation", () => {
  it("allows customers to order stocked Digitrust products even with an empty wallet", () => {
    expect(digitrustListingState({ delivery: "instant", stock: 71, price: 0.99 }, 0, true)).toEqual({ is_active: true, stock: 71 });
    expect(digitrustListingState({ delivery: "instant", stock: 71, price: 0.99 }, 1, true)).toEqual({ is_active: true, stock: 71 });
  });
  it("still rejects checkout quantities exceeding supplier stock", () => {
    expect(digitrustOrderable({ delivery: "instant", stock: 2, price: 1 }, 2)).toBe(true);
    expect(digitrustOrderable({ delivery: "instant", stock: 2, price: 1 }, 3)).toBe(false);
  });
  it("does not publish unreviewed Digitrust offers", () => {
    expect(digitrustListingState({ delivery: "instant", stock: 71, price: 0.99 }, 100, false)).toEqual({ is_active: false, stock: 0 });
  });
  it("keeps Prime Labs products routed to Prime Labs", () => {
    expect(supplierOf({ primestore_id: "2118", digitrust_id: null })).toBe("primestore");
  });
  it("routes Digitrust products independently without changing local stock products", () => {
    expect(supplierOf({ digitrust_id: "89", primestore_id: null })).toBe("digitrust");
    expect(supplierOf({ primestore_id: null, digitrust_id: null })).toBe("local");
  });
  it("does not sell Digitrust offers with an empty supplier wallet", () => {
    expect(digitrustSellable({ delivery: "instant", stock: 71, price: 0.99 }, 0)).toBe(false);
    expect(digitrustSellable({ delivery: "instant", stock: 71, price: 0.99 }, 1)).toBe(true);
  });
  it("allows reviewed manual offers without wallet funding but requires funding for fulfillment", () => {
    expect(digitrustListingState({ delivery: "manual", stock: 39, price: 1 }, 0, true)).toEqual({ is_active: true, stock: 39 });
    expect(digitrustOrderable({ delivery: "manual", stock: 39, price: 1 })).toBe(true);
    expect(digitrustSellable({ delivery: "manual", stock: 39, price: 1 }, 0)).toBe(false);
    expect(digitrustSellable({ delivery: "manual", stock: 39, price: 1 }, 1)).toBe(true);
  });
  it("excludes unknown delivery modes and expired offers", () => {
    expect(digitrustSellable({ delivery: "unknown", stock: 9, price: 14 }, 100)).toBe(false);
    expect(digitrustSellable({ delivery: "instant", stock: 9, price: 1, time_limited: { expired: true } }, 100)).toBe(false);
  });
});
