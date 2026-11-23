// Server-only client for the Digitrust supplier API. Never log purchase responses: they contain credentials.
// Secrets Supabase requis :
//   DIGITRUST_API_URL  — URL de base de l'API Digitrust v2 (ex. https://<domaine-digitrust>/api/v2)
//   DIGITRUST_API_KEY  — clé API Digitrust (anciennement UDC_DIGITRUST_API_KEY)
// Optionnel : DIGITRUST_AUTH_HEADER (par défaut "Authorization", valeur envoyée "Bearer <clé>")
//             — si votre documentation Digitrust indique un autre en-tête (ex. "X-API-Key"), mettez-le ici.
declare const Deno: { env: { get(name: string): string | undefined } };
export interface DigitrustProduct {
  id: number; title: string; description?: string; price: number; stock: number;
  delivery: string; requires_email?: boolean; duration_days?: number | null;
  time_limited?: { expired?: boolean; ends_on?: string } | null;
}
export class DigitrustError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function digitrustRequest<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const key = Deno.env.get("DIGITRUST_API_KEY") ?? Deno.env.get("UDC_DIGITRUST_API_KEY");
  const baseUrl = Deno.env.get("DIGITRUST_API_URL");
  if (!key || !baseUrl) throw new Error("Connexion Digitrust manquante");
  const authHeader = Deno.env.get("DIGITRUST_AUTH_HEADER") ?? "Authorization";
  const authValue = authHeader.toLowerCase() === "authorization" ? `Bearer ${key}` : key;
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}${path}`, {
    method: body ? "POST" : "GET",
    headers: { [authHeader]: authValue, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new DigitrustError(response.status, "Réponse Digitrust illisible"); }
  if (!response.ok || data?.success === false) {
    // Error bodies only; successful order bodies must never enter logs or history.
    throw new DigitrustError(response.status, `Digitrust ${response.status} : ${String(data?.error ?? data?.message ?? "Requête refusée").slice(0, 500)}`);
  }
  return data as T;
}
export const digitrust = {
  products: () => digitrustRequest<{ success: boolean; count: number; products: DigitrustProduct[] }>("/products"),
  product: (id: string) => digitrustRequest<{ product: DigitrustProduct }>(`/product/${encodeURIComponent(id)}`),
  balance: () => digitrustRequest<{ balance: number; currency: string }>("/balance"),
  purchase: (id: string, quantity: number, email: string) => digitrustRequest<{ order: { id: number; status: string; items: string[] } }>("/purchase", { product_id: Number(id), quantity, email }),
  order: (id: string) => digitrustRequest<{ order: { id: number; status: string; items: string[] } }>(`/order/${encodeURIComponent(id)}`),
};
