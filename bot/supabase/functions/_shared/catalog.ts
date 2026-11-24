// Synchronisation des catalogues fournisseurs vers la table products.
// - Nouvelles offres : importées masquées (sauf auto_publish), catégorie devinée.
// - Offres existantes : prix (sauf price_locked), stock et disponibilité mis à jour ;
//   nom, description, catégorie et visibilité choisis par l'admin ne sont jamais écrasés.
import { db } from "./db.ts";
import { sellPrice, guessCategory } from "./pricing.ts";
import { syncableSuppliers } from "./suppliers/registry.ts";

export interface SyncReport { supplier: string; created: number; updated: number; unavailable: number; error?: string }

export async function syncCatalogs(only?: string): Promise<SyncReport[]> {
  const { data: suppliers, error } = await db().from("suppliers").select("*").eq("enabled", true);
  if (error) throw new Error("Lecture des fournisseurs impossible");
  const reports: SyncReport[] = [];
  for (const adapter of syncableSuppliers()) {
    const s = suppliers?.find((x) => x.id === adapter.id);
    if (!s || (only && only !== adapter.id)) continue;
    const report: SyncReport = { supplier: adapter.id, created: 0, updated: 0, unavailable: 0 };
    try {
      const offers = await adapter.listOffers();
      const { data: existing, error: exErr } = await db().from("products").select("id, supplier_product_id, price_locked").eq("supplier_id", adapter.id);
      if (exErr) throw new Error("Lecture des produits impossible");
      const byExt = new Map((existing ?? []).map((p) => [p.supplier_product_id, p]));
      const seen = new Set<string>();
      for (const o of offers) {
        seen.add(o.externalId);
        const price = sellPrice(o.cost, o.currency, s);
        const live = { cost: o.cost, supplier_stock: o.stock, supplier_available: o.available && price > 0, instant: o.instant, updated_at: new Date().toISOString() };
        const row = byExt.get(o.externalId);
        if (row) {
          const { error: e } = await db().from("products").update({ ...live, ...(row.price_locked ? {} : { price }) }).eq("id", row.id);
          if (e) throw new Error(`Mise à jour ${o.externalId} impossible`);
          report.updated++;
        } else {
          if (!o.available || price <= 0) continue;
          const { error: e } = await db().from("products").insert({
            ...live, price, supplier_id: adapter.id, supplier_product_id: o.externalId, name: o.name.slice(0, 120),
            description: o.description.slice(0, 2000), category: guessCategory(o.name), is_active: s.auto_publish,
          });
          if (e) throw new Error(`Import ${o.externalId} impossible`);
          report.created++;
        }
        if (!live.supplier_available) report.unavailable++;
      }
      // Offres disparues chez le fournisseur : indisponibles (le stock manuel éventuel reste vendable).
      const gone = (existing ?? []).filter((p) => !seen.has(p.supplier_product_id)).map((p) => p.id);
      if (gone.length) await db().from("products").update({ supplier_available: false, supplier_stock: 0 }).in("id", gone);
      await db().from("suppliers").update({ last_sync_at: new Date().toISOString(), last_sync_error: null }).eq("id", adapter.id);
    } catch (e) {
      report.error = e instanceof Error ? e.message : "Synchronisation échouée";
      await db().from("suppliers").update({ last_sync_error: report.error }).eq("id", adapter.id);
    }
    reports.push(report);
  }
  return reports;
}

/** Quantité vendable maintenant (stock manuel + fournisseur), sans appel réseau. */
export async function displayedStock(productIds: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (!productIds.length) return out;
  const { data } = await db().from("product_availability").select("id, manual_stock, supplier_stock").in("id", productIds);
  const { data: products } = await db().from("products").select("id, supplier_available, supplier_id").in("id", productIds);
  const avail = new Map((products ?? []).map((p) => [p.id, p.supplier_id !== "manual" && p.supplier_available]));
  for (const r of data ?? []) out.set(r.id, r.manual_stock + (avail.get(r.id) ? r.supplier_stock : 0));
  return out;
}
