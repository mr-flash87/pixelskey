// Sync Prime Labs catalog into Pixels Key
// - Fetches categories + products from the Prime Labs API (server-side, Bearer key)
// - Imports instant products and reviewed made-to-order manual products
// - Applies the shop's margin settings (usd_rate, margin_percent, margin_fixed)
//   to convert USD cost -> FCFA selling price
// - Upserts into `categories` and `products`, keyed by primestore_id
// - Deactivates primestore products that disappeared or are unsupported
//
// Protected: requires an admin JWT (super_admin / manager).

import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { prime, primeUnitCostUsd, sellPriceFcfa } from "../_shared/primestore.ts";
import { brandImageUrl } from "../_shared/brand-images.ts";
import { primeListingState, primeManualEditorial } from "../_shared/prime-manual-catalog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let runId: string | null = null;
  let finishRun: (patch: Record<string, unknown>) => Promise<void> = async () => {};
  try {
    const baseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!baseUrl || !serviceKey) return json({ error: "Configuration manquante" }, 500);
    const supabase = createClient(baseUrl, serviceKey);

    // ── Admin auth ──────────────────────────────────────────────
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Non authentifié" }, 401);
    const cronToken = Deno.env.get("CART_REMINDER_CRON_TOKEN");
    const isCron = token === serviceKey || (!!cronToken && token === cronToken);
    if (!isCron) {
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Non authentifié" }, 401);
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .in("role", ["super_admin", "manager"])
      .maybeSingle();
    if (!role) return json({ error: "Accès refusé" }, 403);
    }

    const { data: runRow } = await supabase.from("catalog_sync_runs")
      .insert({ trigger: isCron ? "cron" : "admin" }).select("id").maybeSingle();
    runId = runRow?.id ?? null;
    finishRun = async (patch: Record<string, unknown>) => {
      if (runId) await supabase.from("catalog_sync_runs").update({ ...patch, finished_at: new Date().toISOString() }).eq("id", runId);
    };

    // ── Margin settings ─────────────────────────────────────────
    const { data: marginRow } = await supabase
      .from("shop_settings")
      .select("value")
      .eq("key", "primestore.margins")
      .maybeSingle();
    const mv = (marginRow?.value ?? {}) as Record<string, unknown>;
    const num = (v: unknown, fallback: number) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };
    const settings = {
      usd_rate: num(mv.usd_rate, 600) > 0 ? num(mv.usd_rate, 600) : 600,
      margin_percent: num(mv.margin_percent, 100),
      margin_fixed: num(mv.margin_fixed, 0),
    };

    // ── Fetch Prime Labs catalog ────────────────────────────────
    const primeCategories = await prime.listCategories();
    const catList = (Array.isArray(primeCategories)
      ? primeCategories
      : ((primeCategories as { categories?: unknown[]; data?: unknown[] })?.categories ??
        (primeCategories as { data?: unknown[] })?.data ?? [])) as { id: unknown; name?: unknown; slug?: unknown }[];

    const catNameMap = new Map<string, string>(); // prime cat id -> name
    let categoriesUpserted = 0;
    for (const c of catList) {
      const primeId = String(c.id);
      const name = String(c.name ?? "Catégorie");
      const slug = slugify(String(c.slug ?? name)) || `cat-${primeId}`;
      catNameMap.set(primeId, name);
      const { data: existing } = await supabase
        .from("categories")
        .select("id")
        .eq("primestore_id", primeId)
        .maybeSingle();
      if (existing) {
        await supabase.from("categories").update({ name, slug }).eq("id", existing.id);
      } else {
        await supabase
          .from("categories")
          .insert({ name, slug, primestore_id: primeId });
      }
      categoriesUpserted++;
    }

    // ── Fetch all products (paginated) ──────────────────────────
    const allProducts: Awaited<ReturnType<typeof prime.listProducts>> = [];
    let offset = 0;
    for (;;) {
      const batch = await prime.listProducts({ limit: 200, offset });
      const items = Array.isArray(batch)
        ? batch
        : ((batch as { products?: unknown[]; data?: unknown[] })?.products ??
          (batch as { data?: unknown[] })?.data ?? []);
      allProducts.push(...(items as typeof allProducts));
      if (!Array.isArray(items) || items.length < 200) break;
      offset += 200;
       if (offset > 5000) throw new Error("Catalogue incomplet : synchronisation interrompue");
    }

    // Activation services stay excluded: they require a separate customer workflow.
    const eligible = allProducts.filter((p) => primeListingState(p).supported);
    const instant = eligible.filter((p) => primeListingState(p).instant_delivery);

    let productsUpserted = 0;
    let productsCreated = 0;
    let productsUpdated = 0;
    const seenPrimeIds: string[] = [];
    for (const p of eligible) {
      const primeId = String(p.id);
      seenPrimeIds.push(primeId);
      const costUsd = primeUnitCostUsd(p);
      if (costUsd <= 0) continue;
      const priceFcfa = sellPriceFcfa(costUsd, settings);
      const listFcfa =
        typeof p.list_price === "number" && p.list_price > costUsd
          ? sellPriceFcfa(p.list_price, settings)
          : null;
      const editorial = p.delivery_mode === "manual" ? primeManualEditorial[primeId] : null;
      const name = editorial?.name ?? String(p.name ?? "Produit");
      const catName =
        p.category_id != null
          ? (catNameMap.get(String(p.category_id)) ?? null)
          : null;
      const listing = primeListingState(p);
      const cleanDesc =
        typeof p.description === "string"
          ? p.description.replace(/<[^>]+>/g, "").replace(/\r/g, "").trim()
          : "";

      const row = {
        name,
        slug: slugify(name) || `prod-${primeId}`,
        description: editorial?.description ?? cleanDesc,
        price: priceFcfa,
        old_price: listFcfa,
        image_url: brandImageUrl(baseUrl, name) ?? (typeof p.image === "string" ? p.image : null),
         category: catName ?? "other",
        type: "license",
        instant_delivery: listing.instant_delivery,
        stock: listing.stock,
        is_active: listing.instant_delivery ? listing.stock > 0 : true,
        source: "primestore",
        primestore_id: primeId,
        cost_usd: costUsd,
        duration: p.terms?.duration ?? null,
      };

      const { data: existing } = await supabase
        .from("products")
        .select("id, name, slug, image_url")
        .eq("primestore_id", primeId)
        .maybeSingle();
      if (existing) {
        // Keep our own uploaded visuals instead of the supplier's
        const upd: Record<string, unknown> = { ...row };
        if (existing.image_url) delete upd.image_url;
        else upd.image_url = brandImageUrl(baseUrl, existing.name, existing.slug) ?? row.image_url;
        // Keep our French editorial content instead of the supplier's English text
        delete upd.name;
        delete upd.slug;
        delete upd.description;
        const { error } = await supabase.from("products").update(upd).eq("id", existing.id);
         if (error) throw new Error(`Échec de mise à jour du produit ${primeId}: ${error.message}`);
         productsUpserted++;
         productsUpdated++;
      } else {
        const { data: clash } = await supabase.from("products").select("id").eq("slug", row.slug).maybeSingle();
        if (clash) row.slug = `${row.slug}-${primeId}`;
        const { error } = await supabase.from("products").insert(row);
         if (error) throw new Error(`Échec d’import du produit ${primeId}: ${error.message}`);
         productsUpserted++;
         productsCreated++;
      }
    }

    // Deactivate only Prime Labs products no longer in the supported catalog
    if (seenPrimeIds.length > 0) {
      await supabase
        .from("products")
        .update({ is_active: false })
        .eq("source", "primestore")
        .not("primestore_id", "in", `(${seenPrimeIds.map((i) => `"${i}"`).join(",")})`);
    }

    await finishRun({ status: "success", products_total: allProducts.length, products_instant: instant.length, products_created: productsCreated, products_updated: productsUpdated });
    return json({
      ok: true,
      settings,
      categories: categoriesUpserted,
      products_total: allProducts.length,
      products_instant: instant.length,
      products_manual: eligible.length - instant.length,
      products_upserted: productsUpserted,
    });
  } catch (e) {
    await finishRun({ status: "error", error: e instanceof Error ? e.message : String(e) }).catch(() => {});
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
