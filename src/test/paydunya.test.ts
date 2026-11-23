import { describe, expect, it } from "vitest";
import { payDunyaBase, parsePayDunyaNotification, verifyPayDunyaHash } from "../../supabase/functions/_shared/paydunya";

describe("PayDunya notification validation", () => {
  it("uses distinct test and live endpoints", () => {
    expect(payDunyaBase("test")).toBe("https://app.paydunya.com/sandbox-api/v1");
    expect(payDunyaBase("live")).toBe("https://app.paydunya.com/api/v1");
  });
  it("reads the provider's nested form payload", () => {
    const params = new URLSearchParams({ "data[hash]": "abc", "data[invoice][token]": "test_invoice" });
    expect(parsePayDunyaNotification(params.toString(), "application/x-www-form-urlencoded")).toEqual({ hash: "abc", token: "test_invoice" });
  });
  it("supports a JSON data envelope", () => {
    expect(parsePayDunyaNotification(JSON.stringify({ data: { hash: "abc", invoice: { token: "invoice" } } }), "application/json")).toEqual({ hash: "abc", token: "invoice" });
  });
  it("verifies SHA512 of the master key alone, not the notification data", async () => {
    const hash = "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f";
    expect(await verifyPayDunyaHash(hash, "abc")).toBe(true);
    expect(await verifyPayDunyaHash(hash, "wrong")).toBe(false);
    expect(await verifyPayDunyaHash("", "abc")).toBe(false);
  });
});
