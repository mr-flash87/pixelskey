// Registre des fournisseurs : id (table `suppliers`) → adaptateur.
// Le fournisseur "manual" n'a pas d'adaptateur : il ne livre que depuis la table stock_items.
import type { SupplierAdapter } from "./types.ts";
import { digitrustAdapter } from "./digitrust.ts";
import { primeLabsAdapter } from "./primelabs.ts";

const adapters: Record<string, SupplierAdapter> = {
  [digitrustAdapter.id]: digitrustAdapter,
  [primeLabsAdapter.id]: primeLabsAdapter,
  // Nouveau fournisseur : [monFournisseurAdapter.id]: monFournisseurAdapter,
};

export function adapterFor(supplierId: string): SupplierAdapter | null {
  return adapters[supplierId] ?? null;
}
export const syncableSuppliers = () => Object.values(adapters);
