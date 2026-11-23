// Reviewed made-to-order offers. Activation requests require a separate workflow.
export const primeManualEditorial: Record<string, { name: string; description: string }> = {
  "54": { name: "Gamma Pro — 12 mois", description: "Gamma Pro pendant 12 mois sur votre compte. Code à utiliser dans les 7 jours suivant l’achat ; aucune garantie après activation du code." },
  "113": { name: "Bolt Pro — 12 mois", description: "Bolt Pro pendant 12 mois sur votre compte. Code promotionnel fourni après traitement. Carte bancaire nécessaire pour l’activation." },
  "123": { name: "ElevenLabs Creator — 12 mois", description: "Formule Creator pendant 12 mois, avec 131 crédits par mois selon le fournisseur. Code et lien d’activation sur votre compte. Carte bancaire nécessaire." },
  "124": { name: "Gemini Pro — 12 mois", description: "Gemini Pro pendant 12 mois sur votre compte, avec un lien d’activation envoyé après traitement. Carte bancaire nécessaire pour l’activation." },
  "125": { name: "Higgsfield Pro — 12 mois", description: "Higgsfield Pro pendant 12 mois, avec 600 crédits par mois. Code à utiliser sur votre compte depuis un ordinateur. Moyen de paiement valide nécessaire ; vérifiez les informations de facturation avant validation." },
  "126": { name: "Lovable Pro — 12 mois", description: "Lovable Pro pendant 12 mois, avec 100 crédits par mois. Code à appliquer sur votre compte à la formule Pro en facturation mensuelle, et non annuelle. Moyen de paiement valide nécessaire." },
  "127": { name: "Replit Core — 12 mois", description: "Replit Core pendant 12 mois sur votre compte. Code à utiliser avec la facturation annuelle. Moyen de paiement valide nécessaire pour l’activation." },
  "128": { name: "Manus Pro — 12 mois", description: "Manus Pro pendant 12 mois, avec 4 000 crédits par mois. Code à appliquer sur votre compte avec la facturation annuelle. Moyen de paiement valide nécessaire." },
  "129": { name: "X Premium — 12 mois", description: "Offre X Premium pendant 12 mois, incluant les accès X, Grok, Cursor, Grok Build et Grok Bot annoncés par le fournisseur. Nouveau compte éligible et carte bancaire nécessaires. Vérifiez la remise et les conditions de renouvellement avant activation." },
  "130": { name: "Supabase Pro — crédits pour jusqu’à 12 mois", description: "Crédit fournisseur équivalent à jusqu’à 12 mois de la formule Pro au tarif de base ; les usages supplémentaires peuvent réduire cette durée. Lien d’activation sur votre organisation. Moyen de paiement valide nécessaire." },
  "131": { name: "Runway Pro — 12 mois", description: "Runway Pro pendant 12 mois sur votre compte. Code à utiliser avec la facturation annuelle. Moyen de paiement valide nécessaire pour l’activation." },
};

export function primeListingState(product: { id: string | number; delivery_mode?: string; max_quantity?: number | null; stock?: unknown }) {
  const mode = String(product.delivery_mode ?? "").toLowerCase();
  const instant = ["instant", "instant_delivery", "auto", "limited", "unlimited"].includes(mode);
  const manual = mode === "manual" && Boolean(primeManualEditorial[String(product.id)]);
  const stock = product.stock as { available?: number | null; in_stock?: boolean } | null;
  // For made-to-order offers this is an order capacity, not a pool of stored keys.
  const capacity = manual ? Math.min(product.max_quantity ?? 100, 100)
    : typeof stock?.available === "number" ? stock.available : 999;
  return {
    supported: instant || manual,
    instant_delivery: instant,
    stock: stock?.in_stock === false ? 0 : Math.max(0, Math.floor(capacity)),
  };
}
