import { useEffect, useState } from "react";
import { supabase, SUPABASE_URL } from "@/integrations/supabase/client";
import type { Product, ProductCategory, ProductType } from "@/data/products";
import { brandImageUrl } from "../../supabase/functions/_shared/brand-images";

// Map DB rows → client Product type expected by existing UI components.
// We expose `slug` as `id` so existing routes (/produit/:id) keep working.
// `uuid` is preserved separately for backend operations.
export interface ProductTier {
  id: string;
  duration: string;
  label: string;
  price: number;
  old_price: number | null;
  is_active: boolean;
}

export interface DbProduct extends Product {
  uuid: string;
  slug: string;
  promo_start_at: string | null;
  promo_end_at: string | null;
  tiers?: ProductTier[];
}

const dbCategoryMap: Record<string, ProductCategory> = {
  windows: "windows",
  adobe: "adobe",
  ai: "ia",
  ia: "ia",
  streaming: "social",
  social: "social",
  formation: "formations",
  formations: "formations",
  other: "social", // graceful fallback for navigation
};

const dbTypeMap: Record<string, ProductType> = {
  license: "CLÉ",
  account: "COMPTE",
  download: "DIGITAL",
};

const deliveryFromType = (t: ProductType): "Compte" | "Clé/Code" =>
  t === "COMPTE" ? "Compte" : "Clé/Code";

export const isPromoActive = (p: {
  promo: boolean;
  promo_start_at: string | null;
  promo_end_at: string | null;
}) => {
  if (!p.promo) return false;
  const now = Date.now();
  if (p.promo_start_at && new Date(p.promo_start_at).getTime() > now) return false;
  if (p.promo_end_at && new Date(p.promo_end_at).getTime() < now) return false;
  return true;
};

export const adaptDbProduct = (
  row: any,
  stock: number,
  tiers: ProductTier[] = [],
): DbProduct => {
  const type = dbTypeMap[row.type] ?? "DIGITAL";
  const cat = dbCategoryMap[row.category] ?? "social";
  const promoActive = isPromoActive({
    promo: !!row.promo,
    promo_start_at: row.promo_start_at,
    promo_end_at: row.promo_end_at,
  });

  // If tiers exist, base displayed price on the cheapest active tier
  const activeTiers = tiers.filter((t) => t.is_active).sort((a, b) => a.price - b.price);
  const cheapestTier = activeTiers[0];

  let displayPrice: number;
  let oldPrice: number;
  if (cheapestTier) {
    displayPrice = cheapestTier.price;
    oldPrice = cheapestTier.old_price ?? Math.round(cheapestTier.price * 1.4);
  } else {
    displayPrice = promoActive || !row.old_price ? row.price : row.old_price;
    oldPrice = row.old_price ?? Math.round(row.price * 1.4);
  }

  return {
    id: row.slug,
    uuid: row.id,
    slug: row.slug,
    name: row.name,
    image: row.image_url || brandImageUrl(SUPABASE_URL, row.name ?? "", row.slug ?? "") || "/placeholder.svg",
    type,
    delivery: row.instant_delivery === false ? "Après traitement fournisseur" : deliveryFromType(type),
    price: displayPrice,
    oldPrice,
    stock,
    category: cat,
    description: row.description ?? "",
    durations: activeTiers.length
      ? activeTiers.map((t) => t.label)
      : row.duration ? [row.duration] : undefined,
    promo: promoActive,
    promo_start_at: row.promo_start_at,
    promo_end_at: row.promo_end_at,
    tiers: activeTiers,
  };
};

interface State {
  products: DbProduct[];
  loading: boolean;
  error: string | null;
}

export const useDbProducts = () => {
  const [state, setState] = useState<State>({
    products: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: rows, error } = await supabase
        .from("products")
        .select(
          "id, slug, name, description, category, type, price, old_price, image_url, duration, promo, promo_start_at, promo_end_at, instant_delivery, stock, display_order, is_active, created_at",
        )
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        setState({ products: [], loading: false, error: error.message });
        return;
      }

      // Stock = available license keys (fallback to row.stock if no keys).
      const ids = (rows ?? []).map((r: any) => r.id);
      const stockMap: Record<string, number> = {};
      const tiersMap: Record<string, ProductTier[]> = {};
      if (ids.length) {
        const { data: keys } = await supabase
          .from("license_keys")
          .select("product_id, status")
          .in("product_id", ids)
          .eq("status", "available");
        keys?.forEach((k: any) => {
          stockMap[k.product_id] = (stockMap[k.product_id] ?? 0) + 1;
        });
        const { data: tierRows } = await supabase
          .from("product_tiers")
          .select("id, product_id, duration, label, price, old_price, is_active, display_order")
          .in("product_id", ids)
          .eq("is_active", true)
          .order("display_order")
          .order("price");
        tierRows?.forEach((t: any) => {
          (tiersMap[t.product_id] ||= []).push(t);
        });
      }

      const products = (rows ?? []).map((r: any) =>
        adaptDbProduct(r, stockMap[r.id] ?? r.stock ?? 0, tiersMap[r.id] ?? []),
      );
      setState({ products, loading: false, error: null });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
};
