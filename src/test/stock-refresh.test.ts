import { beforeEach, describe, expect, it } from "vitest";
import { useStock } from "../store/stock";

describe("catalogue stock refresh", () => {
  beforeEach(() => useStock.getState().reset());
  it("replaces a sold-out snapshot when the supplier replenishes stock", () => {
    useStock.getState().seed({ "bolt-pro-12-mois": 0 });
    useStock.getState().seed({ "bolt-pro-12-mois": 100 });
    expect(useStock.getState().get("bolt-pro-12-mois")).toBe(100);
  });
  it("replaces previously available stock when the supplier sells out", () => {
    useStock.getState().seed({ product: 39 });
    useStock.getState().seed({ product: 0 });
    expect(useStock.getState().get("product")).toBe(0);
  });
  it("subtracts restored cart quantities exactly once on every refresh", () => {
    useStock.getState().seed({ product: 39 }, { product: 2 });
    expect(useStock.getState().get("product")).toBe(37);
    useStock.getState().seed({ product: 39 }, { product: 2 });
    expect(useStock.getState().get("product")).toBe(37);
  });
  it("never shows negative stock when a saved cart exceeds the new stock", () => {
    useStock.getState().seed({ product: 1 }, { product: 2 });
    expect(useStock.getState().get("product")).toBe(0);
  });
});
