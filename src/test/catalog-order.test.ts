import { describe, expect, it } from "vitest";
import { availableFirst } from "../lib/catalog-order";

describe("catalogue availability ordering", () => {
  it("sorts displayed prices from cheapest to most expensive while keeping unavailable offers last", () => {
    const products = [{ id: "expensive", price: 5000 }, { id: "empty", price: 100 }, { id: "cheap", price: 500 }, { id: "middle", price: 1250 }];
    expect(availableFirst(products, { expensive: 1, cheap: 2, middle: 3, empty: 0 }).map((p) => p.price)).toEqual([500, 1250, 5000, 100]);
  });
  it("retains existing order for equal prices", () => {
    expect(availableFirst([{ id: "a", price: 500 }, { id: "b", price: 500 }], { a: 1, b: 1 }).map((p) => p.id)).toEqual(["a", "b"]);
  });
  it("puts available products before out-of-stock products before pagination", () => {
    const products = [{ id: "empty-a" }, { id: "available-a" }, { id: "empty-b" }, { id: "available-b" }];
    const result = availableFirst(products, { "empty-a": 0, "available-a": 2, "empty-b": 0, "available-b": 1 });
    expect(result.slice(0, 2).map((p) => p.id)).toEqual(["available-a", "available-b"]);
    expect(result.slice(2).map((p) => p.id)).toEqual(["empty-a", "empty-b"]);
    expect(products[0].id).toBe("empty-a");
  });
  it("reorders when a product sells out without losing products", () => {
    expect(availableFirst([{ id: "a" }, { id: "b" }], { a: 0, b: 1 }).map((p) => p.id)).toEqual(["b", "a"]);
    expect(availableFirst([{ id: "a" }, { id: "b" }], { a: 1, b: 0 }).map((p) => p.id)).toEqual(["a", "b"]);
  });
});
