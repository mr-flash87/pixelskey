import { describe, expect, it } from "vitest";
import { translationPatch } from "../../supabase/functions/_shared/catalog-translation";
describe("catalogue translation safeguards", () => {
  it("updates only the name and description, retaining all other offer fields", () => {
    const original = { id: "offer", name: "Creator 3M", description: "Private account", price: 1250, stock: 2, slug: "creator-3m" };
    const result = { ...original, ...translationPatch(original, { id: "offer", name: "Creator 3 mois", description: "Compte privé" }) };
    expect(result.price).toBe(1250);
    expect(result.stock).toBe(2);
    expect(result.slug).toBe("creator-3m");
  });
  it("rejects changed duration numbers", () => {
    expect(() => translationPatch({ id: "offer", name: "Creator 3M", description: "" }, { id: "offer", name: "Creator 12 mois", description: "" })).toThrow();
  });
  it("rejects translations targeting another offer", () => {
    expect(() => translationPatch({ id: "offer", name: "Creator", description: "" }, { id: "other", name: "Creator", description: "" })).toThrow();
  });
});
