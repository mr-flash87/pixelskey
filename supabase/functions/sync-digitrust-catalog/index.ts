import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { digitrust } from "../_shared/digitrust.ts";
import { sellPriceFcfa } from "../_shared/primestore.ts";
import { brandImageUrl } from "../_shared/brand-images.ts";
import { digitrustListingState } from "../_shared/supplier-routing.ts";
import { digitrustEditorial, digitrustReviewRequired } from "../_shared/digitrust-editorial.ts";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Méthode refusée" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return json({ error: "Configuration manquante" }, 500);
  const client = createClient(url, service);
  let runId: string | undefined;
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const cron = Deno.env.get("CART_REMINDER_CRON_TOKEN");
    const isCron = !!token && !!cron && token === cron;
    if (!isCron) {
      const { data: user, error } = await client.auth.getUser(token);
      if (error || !user.user) return json({ error: "Non authentifié" }, 401);
      const { data: roles } = await client.from("user_roles").select("role").eq("user_id", user.user.id).in("role", ["super_admin", "manager"]);
      if (!roles?.length) return json({ error: "Accès refusé" }, 403);
    }
    const body = await req.json().catch(() => ({}));
    if (body.action && body.action !== "status") return json({ error: "Action invalide" }, 400);
    const wallet = await digitrust.balance();
    if (wallet.currency !== "USD") throw new Error("Devise Digitrust non prise en charge");
    if (body.action === "status") return json({ connected: true, balance: wallet.balance, currency: wallet.currency });
    const { data: run, error: runError } = await client.from("catalog_sync_runs").insert({ supplier: "digitrust", trigger: isCron ? "cron" : "admin" }).select("id").single();
    if (runError) throw new Error("Enregistrement de synchronisation impossible");
    runId = run.id;
    const { data: configured } = await client.from("shop_settings").select("value").eq("key", "digitrust.margins").maybeSingle();
    const { data: prime } = await client.from("shop_settings").select("value").eq("key", "primestore.margins").maybeSingle();
    const settings = { usd_rate: 600, margin_percent: 100, margin_fixed: 0, ...(prime?.value as object ?? {}), ...(configured?.value as object ?? {}) };
    if (![settings.usd_rate, settings.margin_percent, settings.margin_fixed].every(Number.isFinite) || settings.usd_rate <= 0 || settings.margin_percent < 0 || settings.margin_fixed < 0) throw new Error("Marges Digitrust invalides");
    const catalogue = await digitrust.products();
    if (!Array.isArray(catalogue.products) || catalogue.count !== catalogue.products.length) throw new Error("Catalogue Digitrust incomplet");
    const supported = catalogue.products.filter((p) => ["instant", "manual"].includes(p.delivery));
    let created = 0, updated = 0;
    for (const p of supported) {
      if (!Number.isInteger(p.id) || !Number.isFinite(p.price) || p.price <= 0 || !Number.isFinite(p.stock)) continue;
      const id = String(p.id);
      const editorial = digitrustEditorial[id];
      const name = editorial?.name ?? `Service Digitrust ${id} — à vérifier`;
      const { data: existing, error: existingError } = await client.from("products").select("id,image_url,name,slug").eq("digitrust_id", id).maybeSingle();
      if (existingError) throw new Error("Lecture du produit Digitrust impossible");
      const row = {
        price: sellPriceFcfa(p.price, settings), old_price: null,
        ...digitrustListingState(p, wallet.balance, !!editorial && !digitrustReviewRequired.has(id)),
        instant_delivery: p.delivery === "instant", cost_usd: p.price,
      };
      const result = existing
        ? await client.from("products").update({ ...row, ...(existing.image_url ? {} : { image_url: brandImageUrl(url, existing.name, existing.slug) }) }).eq("id", existing.id).eq("source", "digitrust")
        : await client.from("products").insert({ ...row, name, description: editorial?.description ?? "Nouvelle offre fournisseur : détails et conditions à vérifier avant publication.", slug: `digitrust-${id}`, type: "license", category: "other", source: "digitrust", digitrust_id: id, image_url: brandImageUrl(url, name) });
      if (result.error) throw new Error(`Échec d’import Digitrust ${id} : ${result.error.message}`);
      if (existing) updated++; else created++;
    }
    const seen = supported.map((p) => String(p.id));
    let deactivate = client.from("products").update({ is_active: false }).eq("source", "digitrust");
    if (seen.length) deactivate = deactivate.not("digitrust_id", "in", `(${seen.join(",")})`);
    const { error: deactivateError } = await deactivate;
    if (deactivateError) throw new Error("Désactivation des anciennes offres Digitrust impossible");
    const stats = { products_total: catalogue.products.length, products_instant: supported.filter((p) => p.delivery === "instant").length, products_created: created, products_updated: updated };
    const { error: finishError } = await client.from("catalog_sync_runs").update({ ...stats, status: "success", finished_at: new Date().toISOString() }).eq("id", runId);
    if (finishError) throw new Error("Enregistrement du résultat impossible");
    return json({ ok: true, ...stats, products_upserted: created + updated, balance: wallet.balance, settings });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Synchronisation Digitrust échouée";
    if (runId) await client.from("catalog_sync_runs").update({ status: "error", error: message, finished_at: new Date().toISOString() }).eq("id", runId);
    return json({ error: message }, 500);
  }
});
