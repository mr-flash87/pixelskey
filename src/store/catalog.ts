import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { adaptDbProduct, type DbProduct, type ProductTier } from "@/lib/useDbProducts";
import { useStock } from "./stock";
import { useCart } from "./cart";

interface CatalogState {
  products: DbProduct[];
  bySlug: Record<string, DbProduct>;
  byUuid: Record<string, DbProduct>;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  load: () => Promise<void>;
}

export const useCatalog = create<CatalogState>((set, get) => ({
  products: [],
  bySlug: {},
  byUuid: {},
  loading: false,
  loaded: false,
  error: null,
  load: async () => {
    if (get().loading || get().loaded) return;
    set({ loading: true, error: null });

    const { data: rows, error } = await supabase
      .from("products")
      .select(
        "id, slug, name, description, category, type, price, old_price, image_url, duration, promo, promo_start_at, promo_end_at, instant_delivery, stock, display_order, is_active, created_at",
      )
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      set({ loading: false, loaded: true, error: error.message });
      return;
    }

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
    const bySlug: Record<string, DbProduct> = {};
    const byUuid: Record<string, DbProduct> = {};
    const stockSeed: Record<string, number> = {};
    products.forEach((p) => {
      bySlug[p.slug] = p;
      byUuid[p.uuid] = p;
      stockSeed[p.id] = p.stock;
    });

    // Replace obsolete stock snapshots while preserving actual cart quantities.
    const reserved: Record<string, number> = {};
    useCart.getState().items.forEach((item) => {
      reserved[item.product.id] = (reserved[item.product.id] ?? 0) + item.quantity;
    });
    useStock.getState().seed(stockSeed, reserved);

    set({ products, bySlug, byUuid, loading: false, loaded: true, error: null });
  },
}));
