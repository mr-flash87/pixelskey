import { describe, expect, it } from "vitest";
import { brandImagePath, brandImageUrl } from "../../supabase/functions/_shared/brand-images";

describe("shared brand images", () => {
  it("shares visuals across durations and plans", () => {
    expect(brandImagePath("Replit - 1 mois - Pro")).toBe("brand/replit.jpg");
    expect(brandImagePath("Replit - 12 mois - Core")).toBe("brand/replit.jpg");
    expect(brandImagePath("Lovable Pro - 10 000 crédits")).toBe("brand/lovable.jpg");
  });
  it("prioritizes the product brand over account login providers", () => {
    expect(brandImagePath("Lovable Pro - Connexion Outlook")).toBe("brand/lovable.jpg");
    expect(brandImagePath("Comptes Outlook")).toBe("brand/outlook.jpg");
  });
  it("recognizes aliases and slug fallback", () => {
    expect(brandImagePath("GPT Plus - 4 mois")).toBe("brand/chatgpt.jpg");
    expect(brandImagePath("Offre", "quillbot-premium-1m")).toBe("brand/quillbot.jpg");
    expect(brandImagePath("ElevenReader Ultra")).toBe("brand/eleven.jpg");
    expect(brandImagePath("Microsoft 365 - Admin")).toBe("brand/office.jpg");
  });
  it("does not invent an image for an unknown brand", () => {
    expect(brandImagePath("Autre service")).toBeNull();
    expect(brandImageUrl("https://example.test/", "Replit")).toBe("https://example.test/storage/v1/object/public/product-images/brand/replit.jpg");
  });
  it.each([
    ["Adobe Creative Cloud Pro — 12 mois", "adobe"],
    ["Adobe Express — clé 4 mois", "adobe"],
    ["Bot boutique Telegram — code source complet", "telegram"],
    ["Coursera Premium — 12 mois", "coursera"],
    ["Duolingo Super — lien 12 mois", "duolingo"],
    ["ExpressVPN — 1 mois", "expressvpn"],
    ["Heygen Creator 1 Month", "heygen"],
    ["iLovePDF Premium — 12 mois", "ilovepdf"],
    ["LinkedIn Premium Career — 3 mois", "linkedin"],
    ["Muse AI — compte, 1 milliard de jetons", "muse"],
  ])("resolves missing catalogue brand %s", (name, brand) => {
    expect(brandImagePath(name)).toBe(`brand/${brand}.jpg`);
  });
});
