// Create PayDunya checkout — server-side only
// - Creates an `orders` row in status=pending
// - Snapshots cart lines into `order_items`
// - Calls PayDunya with encrypted server-only credentials
// - Returns { order_id, payment_url, payment_id }

import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { readPayDunyaConfig } from "../_shared/paydunya-config.ts";
import { payDunyaBase, payDunyaHeaders } from "../_shared/paydunya.ts";
import { digitrust } from "../_shared/digitrust.ts";
import { supplierOf, digitrustOrderable } from "../_shared/supplier-routing.ts";
import { prime } from "../_shared/primestore.ts";
import { primeListingState } from "../_shared/prime-manual-catalog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Domaines autorisés pour le retour après paiement.
// Ajoutez vos domaines supplémentaires dans le secret ALLOWED_ORIGINS (séparés par des virgules).
const DEFAULT_ORIGINS = ["https://pixelskey.app", "https://www.pixelskey.app", "http://localhost:8080"];
const allowedOrigins = new Set([
  ...DEFAULT_ORIGINS,
  ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((o) => o.trim()).filter(Boolean),
]);

interface CartLine {
  product_id: string;
  quantity: number;
  duration?: string | null;
  tier_id?: string | null;
}

interface CheckoutPayload {
  email: string;
  phone?: string;
  name?: string;
  items: CartLine[];
  return_origin?: string;
  promo_code?: string | null;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json()) as CheckoutPayload;

    // ── Validation ────────────────────────────────────────────────
    if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return json({ error: "Email invalide" }, 400);
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return json({ error: "Panier vide" }, 400);
    }
    if (body.items.length > 50) {
      return json({ error: "Trop d'articles" }, 400);
    }
    for (const it of body.items) {
      if (!it.product_id || !Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > 20) {
        return json({ error: "Article invalide" }, 400);
      }
    }

    const config = await readPayDunyaConfig();
    // PayDunya credentials are only required when the order actually costs
    // something — a promo code can bring the total to 0 F.
    const requestedOrigin = body.return_origin || req.headers.get("origin") || "https://pixelskey.app";
    if (!allowedOrigins.has(requestedOrigin)) return json({ error: "Origine de retour invalide" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Fetch products + prices from DB (never trust client prices) ──
    const productIds = [...new Set(body.items.map((i) => i.product_id))];
    const { data: products, error: pErr } = await supabase
      .from("products")
      .select("id, name, price, is_active")
      .in("id", productIds);

    if (pErr || !products) {
      console.error("Product fetch error:", pErr);
      return json({ error: "Impossible de charger les produits" }, 500);
    }

    // Re-fetch with promo dates + old_price + type
    const { data: productsFull } = await supabase
      .from("products")
      .select("id, name, price, old_price, is_active, promo, promo_start_at, promo_end_at, type, primestore_id,digitrust_id,instant_delivery")
      .in("id", productIds);

    const productMap = new Map((productsFull ?? []).map((p: any) => [p.id, p]));

    // Fetch tiers referenced in the cart
    const tierIds = body.items.map((i) => i.tier_id).filter(Boolean) as string[];
    const tierMap = new Map<string, any>();
    if (tierIds.length) {
      const { data: tiers } = await supabase
        .from("product_tiers")
        .select("id, product_id, duration, label, price, is_active")
        .in("id", tierIds);
      (tiers ?? []).forEach((t: any) => tierMap.set(t.id, t));
    }

    let subtotal = 0;
    const itemsToInsert: {
      product_id: string;
      product_name: string;
      unit_price: number;
      quantity: number;
      duration: string | null;
      tier_id: string | null;
      duration_label: string | null;
    }[] = [];
    const now = Date.now();
    const checkedDigitrust = new Set<string>();
    const checkedPrimeManual = new Set<string>();

    for (const line of body.items) {
      const p: any = productMap.get(line.product_id);
      if (!p || !p.is_active) {
        return json({ error: `Produit indisponible : ${line.product_id}` }, 400);
      }
      // Stock (license keys) — only for local products that use keys.
      // Prime Labs products are bought from the supplier after payment,
      // so they don't need a local key pool.
      const requiresKeys =
        supplierOf(p) === "local" && (p.type === "license" || p.type === "account");
      if (requiresKeys) {
        const { count: available } = await supabase
          .from("license_keys")
          .select("id", { count: "exact", head: true })
          .eq("product_id", p.id)
          .eq("status", "available");

        if ((available ?? 0) < line.quantity) {
          return json({
            error: `Stock épuisé pour « ${p.name} ». L'administrateur doit ajouter des clés/comptes avant l'achat.`,
            available: available ?? 0,
          }, 400);
        }
      }

      if (supplierOf(p) === "digitrust" && !checkedDigitrust.has(p.id)) {
        checkedDigitrust.add(p.id);
        const quantity = body.items.filter((it) => it.product_id === p.id).reduce((sum, it) => sum + it.quantity, 0);
        const { count: localKeys } = await supabase.from("license_keys").select("id", { count: "exact", head: true }).eq("product_id", p.id).eq("status", "available");
        if ((localKeys ?? 0) < quantity) {
          const { product: live } = await digitrust.product(p.digitrust_id);
          if (!digitrustOrderable(live, quantity)) {
            return json({ error: `Produit temporairement indisponible : ${p.name}` }, 409);
          }
        }
      }

      if (supplierOf(p) === "primestore" && p.instant_delivery === false && !checkedPrimeManual.has(p.id)) {
        checkedPrimeManual.add(p.id);
        const quantity = body.items.filter((it) => it.product_id === p.id).reduce((sum, it) => sum + it.quantity, 0);
        const { count: localKeys } = await supabase.from("license_keys").select("id", { count: "exact", head: true }).eq("product_id", p.id).eq("status", "available");
        if ((localKeys ?? 0) < quantity) {
          const response = await prime.getProduct(p.primestore_id);
          const live = (response.product ?? response) as Parameters<typeof primeListingState>[0];
          const listing = primeListingState(live);
          if (!listing.supported || listing.stock < quantity) {
            return json({ error: `Produit temporairement indisponible : ${p.name}` }, 409);
          }
        }
      }

      // Resolve unit price: tier wins over base price
      let unitPrice: number;
      let durationLabel: string | null = line.duration ?? null;
      let tierId: string | null = null;
      if (line.tier_id) {
        const tier = tierMap.get(line.tier_id);
        if (!tier || tier.product_id !== p.id || !tier.is_active) {
          return json({ error: `Palier invalide pour ${p.name}` }, 400);
        }
        unitPrice = tier.price;
        durationLabel = tier.label;
        tierId = tier.id;
      } else {
        const startsOk = !p.promo_start_at || new Date(p.promo_start_at).getTime() <= now;
        const endsOk = !p.promo_end_at || new Date(p.promo_end_at).getTime() >= now;
        const promoActive = startsOk && endsOk && p.promo;
        unitPrice = promoActive ? p.price : (p.old_price ?? p.price);
      }

      subtotal += unitPrice * line.quantity;
      itemsToInsert.push({
        product_id: p.id,
        product_name: p.name,
        unit_price: unitPrice,
        quantity: line.quantity,
        duration: durationLabel,
        tier_id: tierId,
        duration_label: durationLabel,
      });
    }

    if (subtotal <= 0) return json({ error: "Montant invalide" }, 400);

    // ── Promo code (optional) ────────────────────────────────────
    let discount = 0;
    let appliedPromo: string | null = null;
    if (body.promo_code && typeof body.promo_code === "string") {
      const code = body.promo_code.trim();
      if (code) {
        const { data: promoRes, error: promoErr } = await supabase.rpc(
          "validate_promo_code",
          { _code: code, _subtotal: subtotal },
        );
        if (promoErr) {
          console.error("promo rpc error", promoErr);
          return json({ error: "Code promo invalide" }, 400);
        }
        const r: any = promoRes;
        if (!r?.valid) {
          return json({ error: r?.reason ?? "Code promo invalide" }, 400);
        }
        discount = Math.min(Math.round(r.discount ?? 0), subtotal);
        appliedPromo = r.code ?? code.toUpperCase();
      }
    }

    const amount = Math.max(0, subtotal - discount);
    // A 0 F total is only valid when a promo code covers the whole cart.
    if (amount <= 0 && !appliedPromo) return json({ error: "Montant final invalide" }, 400);
    const isFreeOrder = amount === 0;

    // ── Insert order (pending) ───────────────────────────────────
    const { data: order, error: oErr } = await supabase
      .from("orders")
      .insert({
        customer_email: body.email,
        customer_phone: body.phone ?? null,
        customer_name: body.name ?? null,
        amount,
        subtotal_amount: subtotal,
        discount_amount: discount,
        promo_code: appliedPromo,
        currency: "XOF",
        status: "pending",
        provider: isFreeOrder ? "promo" : "paydunya",
        payment_mode: config.mode,
      })
      .select("id, reference")
      .single();

    if (oErr || !order) {
      console.error("Order insert error:", oErr);
      return json({ error: "Impossible de créer la commande" }, 500);
    }

    // Insert items
    const { error: iErr } = await supabase
      .from("order_items")
      .insert(itemsToInsert.map((it) => ({ ...it, order_id: order.id })));

    if (iErr) {
      console.error("Items insert error:", iErr);
      // best-effort cleanup
      await supabase.from("orders").delete().eq("id", order.id);
      return json({ error: "Impossible d'enregistrer les articles" }, 500);
    }

    // Free order (promo covers everything): validate and deliver immediately,
    // without ever contacting PayDunya.
    if (isFreeOrder) {
      const { deliverPaidOrder } = await import("../_shared/finalize-paydunya-order.ts");
      const result = await deliverPaidOrder(order.id);
      return json({
        order_id: order.id,
        reference: order.reference,
        free_order: true,
        ...result,
      });
    }

    if (!config.enabled || !config.credentials) {
      await supabase.from("orders").update({ status: "failed", failed_reason: "PayDunya non configuré" }).eq("id", order.id);
      return json({ error: "Les paiements sont temporairement indisponibles. PayDunya doit être configuré par la boutique." }, 503);
    }

    // PayDunya hosted invoice; prices and the final amount come only from the server.
    const apiUrl = Deno.env.get("SUPABASE_URL");
    const pdResp = await fetch(`${payDunyaBase(config.mode)}/checkout-invoice/create`, {
      method: "POST", headers: payDunyaHeaders(config.credentials), signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        invoice: { total_amount: amount, description: `Pixels Key — Commande ${order.reference}` },
        store: { name: "Pixels Key", website_url: "https://pixelskey.app" },
        actions: {
          return_url: `${requestedOrigin}/order/${order.id}`,
          cancel_url: `${requestedOrigin}/order/${order.id}`,
          callback_url: `${apiUrl}/functions/v1/paydunya-webhook`,
        },
        custom_data: { order_id: order.id, reference: order.reference },
      }),
    });
    const pdData = await pdResp.json().catch(() => ({}));
    const payment_url = typeof pdData.response_text === "string" ? pdData.response_text : "";
    const payment_id = typeof pdData.token === "string" ? pdData.token : "";
    let validUrl = false;
    try { const url = new URL(payment_url); validUrl = url.protocol === "https:" && (url.hostname === "paydunya.com" || url.hostname.endsWith(".paydunya.com")); } catch { /* invalid URL */ }
    if (!pdResp.ok || pdData.response_code !== "00" || !validUrl || !payment_id) {
      await supabase.from("orders").update({ status: "failed", failed_reason: "Création de facture PayDunya impossible" }).eq("id", order.id);
      return json({ error: "PayDunya n’a pas pu créer le paiement. Vérifiez les identifiants et le mode dans les paramètres." }, 502);
    }
    const { error: paymentError } = await supabase.from("orders").update({ payment_id, payment_url }).eq("id", order.id);
    if (paymentError) return json({ error: "Enregistrement du paiement impossible" }, 500);

    return json({
      order_id: order.id,
      reference: order.reference,
      payment_url,
      payment_id,
    });
  } catch (err) {
    console.error("create-checkout fatal:", err);
    return json({ error: "Erreur interne" }, 500);
  }
});
