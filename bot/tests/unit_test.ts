import { assert, assertEquals, assertFalse, assertStringIncludes } from "jsr:@std/assert@1";
import { verifyFlashPaySignature, type FlashPayPayment } from "../supabase/functions/_shared/flashpay.ts";
import { guessCategory, sellPrice } from "../supabase/functions/_shared/pricing.ts";
import { normalizeItems } from "../supabase/functions/_shared/suppliers/types.ts";
import { digitrustAvailable } from "../supabase/functions/_shared/suppliers/digitrust.ts";
import { primeState } from "../supabase/functions/_shared/suppliers/primelabs.ts";
import { deliveryMessages } from "../supabase/functions/_shared/fulfillment.ts";
import { paymentScreen, productScreen } from "../supabase/functions/_shared/ui.ts";
import { esc, fcfa } from "../supabase/functions/_shared/telegram.ts";
import { safeEqual } from "../supabase/functions/_shared/env.ts";

async function sign(secret: string, ts: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ts}.${body}`)));
  return "sha256=" + Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.test("signature FlashPay valide acceptée", async () => {
  const body = '{"id":"evt_1","type":"payment.succeeded","data":{"id":"PAY-1"}}';
  const sig = await sign("fpwh_secret", "1763200000", body);
  assert(await verifyFlashPaySignature(body, "1763200000", sig, "fpwh_secret", 1763200100));
});

Deno.test("signature FlashPay refusée : corps modifié, mauvais secret, trop ancienne, absente", async () => {
  const body = '{"id":"evt_1"}';
  const sig = await sign("fpwh_secret", "1763200000", body);
  assertFalse(await verifyFlashPaySignature(body + " ", "1763200000", sig, "fpwh_secret", 1763200000));
  assertFalse(await verifyFlashPaySignature(body, "1763200000", sig, "autre", 1763200000));
  assertFalse(await verifyFlashPaySignature(body, "1763200000", sig, "fpwh_secret", 1763200000 + 301));
  assertFalse(await verifyFlashPaySignature(body, null, sig, "fpwh_secret", 1763200000));
  assertFalse(await verifyFlashPaySignature(body, "abc", sig, "fpwh_secret", 1763200000));
});

Deno.test("prix : marge appliquée et arrondi supérieur aux 50 F", () => {
  assertEquals(sellPrice(5, "USD", { usd_rate: 600, margin_percent: 30, margin_fixed: 0 }), 3900);
  assertEquals(sellPrice(1.01, "USD", { usd_rate: 600, margin_percent: 0, margin_fixed: 0 }), 650); // 606 → 650, jamais en dessous du coût
  assertEquals(sellPrice(1000, "XOF", { usd_rate: 600, margin_percent: 10, margin_fixed: 200 }), 1300);
  assertEquals(sellPrice(0, "USD", { usd_rate: 600, margin_percent: 30, margin_fixed: 0 }), 0);
});

Deno.test("catégories devinées", () => {
  assertEquals(guessCategory("Netflix Premium 1 mois"), "🎬 Streaming");
  assertEquals(guessCategory("ChatGPT Plus"), "🤖 IA");
  assertEquals(guessCategory("Spotify Family"), "🎵 Musique");
  assertEquals(guessCategory("Produit mystère"), "📦 Autres");
});

Deno.test("éléments livrés normalisés (texte vide ignoré, objets lisibles)", () => {
  assertEquals(normalizeItems(["a@b.com:pass", " ", ""]), ["a@b.com:pass"]);
  assertEquals(normalizeItems([{ email: "x@y.z", password: "p" }]), ["email : x@y.z\npassword : p"]);
  assertEquals(normalizeItems("CODE-123"), ["CODE-123"]);
  assertEquals(normalizeItems(null), []);
});

Deno.test("Digitrust : offre expirée ou type de livraison non pris en charge refusés", () => {
  const base = { id: 1, title: "x", price: 2, stock: 3, delivery: "instant" };
  assert(digitrustAvailable(base));
  assertFalse(digitrustAvailable({ ...base, delivery: "activation" }));
  assertFalse(digitrustAvailable({ ...base, time_limited: { ends_on: "2020-01-01" } }));
  assertFalse(digitrustAvailable({ ...base, price: 0 }));
});

Deno.test("Prime Labs : état de l'offre", () => {
  assertEquals(primeState({ id: 1, name: "x", delivery_mode: "instant", price: 3, stock: { available: 4 } }), { instant: true, available: true, stock: 4 });
  assertEquals(primeState({ id: 1, name: "x", delivery_mode: "instant", price: 3, stock: { in_stock: false } }).stock, 0);
  assertFalse(primeState({ id: 1, name: "x", delivery_mode: "activation", price: 3 }).available);
});

Deno.test("message de livraison : HTML échappé et découpé sous 4096 caractères", () => {
  const items = Array.from({ length: 40 }, (_, i) => `compte${i}@mail.com:<motdepasse>${"x".repeat(150)}`);
  const msgs = deliveryMessages({ ref: "CMD-1", product_name: "Netflix <4K>" }, items);
  assert(msgs.length > 1);
  for (const m of msgs) assert(m.length < 4096, `message trop long : ${m.length}`);
  assertStringIncludes(msgs[0], "Netflix &lt;4K&gt;");
  assert(msgs.join("").includes("&lt;motdepasse&gt;"));
  assertEquals(msgs.join("").match(/<code>/g)?.length, 40);
});

Deno.test("écran de paiement : consigne Wave « Montant reçu » quand il y a des frais", () => {
  const payment = {
    id: "PAY-1", status: "pending", amount: 5000, currency: "XOF", reference: "CMD-1", checkout_url: "https://marchand.pixelpub.online/pay/pay/PAY-1",
    paid_operator: null, expires_at: null, paid_at: null,
    operators: [
      { code: "orange", name: "Orange Money", merchant_number: "67608599", ussd_code: "*144*2*1*67608599*5000#", pay_link: null, fee_percent: 0, amount_to_send: 5000, instructions: null },
      { code: "moov", name: "Moov Money", merchant_number: "62360277", ussd_code: "Paiement : *555*2*1*62360277*5000#", pay_link: null, fee_percent: 0, amount_to_send: 5000, instructions: null },
      { code: "wave", name: "Wave", merchant_number: "02247701", ussd_code: null, pay_link: null, fee_percent: 0.5, amount_to_send: 5025, instructions: "Ouvrez l'application Wave" },
    ],
  } satisfies FlashPayPayment;
  const s = paymentScreen("Commande CMD-1", payment);
  assertStringIncludes(s.text, "<code>*555*2*1*62360277*5000#</code>");
  assertStringIncludes(s.text, "Montant reçu");
  assertStringIncludes(s.text, "5 025 F");
  assertEquals(s.keyboard[0][0].url, payment.checkout_url);
  for (const row of s.keyboard) for (const b of row) if (b.callback_data) assert(new TextEncoder().encode(b.callback_data).length <= 64);
});

Deno.test("fiche produit : bouton solde seulement si le solde suffit, pas d'achat en rupture", () => {
  const p = { id: 7, supplier_id: "manual", supplier_product_id: null, category: "IA", name: "ChatGPT", description: "", price: 3000, supplier_stock: 0, supplier_available: true, instant: true, is_active: true };
  assertEquals(productScreen(p, 2, 1000, 0).keyboard.flat().filter((b) => b.callback_data?.startsWith("bal:")).length, 0);
  assertEquals(productScreen(p, 2, 3000, 0).keyboard.flat().filter((b) => b.callback_data?.startsWith("bal:")).length, 1);
  assertEquals(productScreen(p, 0, 9000, 0).keyboard.flat().filter((b) => b.callback_data?.startsWith("buy:")).length, 0);
});

Deno.test("utilitaires", () => {
  assertEquals(fcfa(1000000), "1 000 000 F");
  assertEquals(esc("<b>&"), "&lt;b&gt;&amp;");
  assert(safeEqual("abc", "abc"));
  assertFalse(safeEqual("abc", "abd"));
  assertFalse(safeEqual("abc", "abcd"));
});
