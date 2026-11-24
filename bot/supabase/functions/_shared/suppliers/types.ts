// Interface commune à tous les fournisseurs.
// Pour brancher un nouveau fournisseur : créer un fichier qui exporte un SupplierAdapter,
// l'ajouter dans registry.ts, puis insérer une ligne dans la table `suppliers` avec le même id.

export interface SupplierOffer {
  externalId: string;
  name: string;
  description: string;
  /** Coût unitaire chez le fournisseur, dans `currency`. */
  cost: number;
  currency: "USD" | "XOF" | "EUR";
  stock: number;
  /** Livraison immédiate par l'API (sinon : traitement manuel côté fournisseur). */
  instant: boolean;
  /** Offre vendable (type de livraison pris en charge, non expirée…). */
  available: boolean;
}

export type PurchaseResult =
  | { status: "delivered"; supplierOrderId: string; items: string[] }
  | { status: "pending"; supplierOrderId: string };

/**
 * Erreur d'achat.
 * - certain = true : le fournisseur a refusé (rien n'a été débité) → l'admin peut relancer.
 * - certain = false : résultat inconnu (timeout, 5xx…) → JAMAIS de relance automatique
 *   si le fournisseur n'accepte pas de clé d'idempotence.
 */
export class SupplierError extends Error {
  constructor(message: string, public certain: boolean, public needsFunding = false) { super(message); }
}

export interface PurchaseContext {
  /** Identifiant stable de la commande, utilisé comme clé d'idempotence quand le fournisseur le permet. */
  orderId: string;
  quantity: number;
}

export interface SupplierAdapter {
  id: string;
  /** true si le fournisseur accepte une clé d'idempotence : relancer un achat incertain est alors sans risque. */
  idempotent: boolean;
  listOffers(): Promise<SupplierOffer[]>;
  /** Vérification en direct juste avant de créer une commande. */
  canSell(externalId: string, quantity: number): Promise<boolean>;
  purchase(externalId: string, ctx: PurchaseContext): Promise<PurchaseResult>;
  /** Suivi d'une commande acceptée mais pas encore livrée. */
  getOrder(supplierOrderId: string): Promise<PurchaseResult>;
  balance?(): Promise<{ amount: number; currency: string }>;
}

/** Normalise les éléments livrés (chaînes ou objets) en texte non vide. */
export function normalizeItems(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
  const out: string[] = [];
  for (const it of list) {
    if (typeof it === "string") { if (it.trim()) out.push(it.trim()); }
    else if (it && typeof it === "object" && Object.keys(it).length) {
      out.push(Object.entries(it as Record<string, unknown>).map(([k, v]) => `${k} : ${typeof v === "object" ? JSON.stringify(v) : v}`).join("\n"));
    }
  }
  return out;
}
