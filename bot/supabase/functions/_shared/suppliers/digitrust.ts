// Adaptateur Digitrust (API v2). Pas de clé d'idempotence documentée :
// un achat au résultat incertain n'est jamais relancé automatiquement.
// Secrets : DIGITRUST_API_URL, DIGITRUST_API_KEY, DIGITRUST_AUTH_HEADER (optionnel), SUPPLIER_EMAIL.
import { env, optionalEnv } from "../env.ts";
import { normalizeItems, SupplierError, type SupplierAdapter, type SupplierOffer, type PurchaseResult } from "./types.ts";

interface DtProduct {
  id: number; title: string; description?: string; price: number; stock: number; delivery: string;
  time_limited?: { expired?: boolean; ends_on?: string } | null;
}
interface DtOrder { id: number; status: string; items: unknown }

class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }

async function request<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const header = optionalEnv("DIGITRUST_AUTH_HEADER") ?? "Authorization";
  const key = env("DIGITRUST_API_KEY");
  const res = await fetch(`${env("DIGITRUST_API_URL").replace(/\/+$/, "")}${path}`, {
    method: body ? "POST" : "GET",
    headers: { [header]: header.toLowerCase() === "authorization" ? `Bearer ${key}` : key, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.success === false) {
    // Corps d'erreur seulement : un corps de commande réussie contient des identifiants et ne doit jamais être journalisé.
    throw new HttpError(res.status, `Digitrust ${res.status} : ${String(data?.error ?? data?.message ?? "requête refusée").slice(0, 200)}`);
  }
  return data as T;
}

export function digitrustAvailable(p: DtProduct, now = Date.now()): boolean {
  const end = p.time_limited?.ends_on;
  return ["instant", "manual"].includes(p.delivery) && p.price > 0 && !p.time_limited?.expired && (!end || Date.parse(`${end}T23:59:59Z`) >= now);
}

const toResult = (o: DtOrder): PurchaseResult => {
  const items = normalizeItems(o.items);
  return o.status === "delivered" && items.length ? { status: "delivered", supplierOrderId: String(o.id), items } : { status: "pending", supplierOrderId: String(o.id) };
};

export const digitrustAdapter: SupplierAdapter = {
  id: "digitrust",
  idempotent: false,
  async listOffers(): Promise<SupplierOffer[]> {
    const data = await request<{ products: DtProduct[] }>("/products");
    if (!Array.isArray(data.products)) throw new Error("Catalogue Digitrust illisible");
    return data.products.filter((p) => Number.isInteger(p.id) && Number.isFinite(p.price)).map((p) => ({
      externalId: String(p.id), name: p.title, description: p.description ?? "", cost: p.price, currency: "USD",
      stock: Math.max(0, Math.floor(p.stock ?? 0)), instant: p.delivery === "instant", available: digitrustAvailable(p),
    }));
  },
  async canSell(externalId, quantity) {
    const { product } = await request<{ product: DtProduct }>(`/product/${encodeURIComponent(externalId)}`);
    return digitrustAvailable(product) && product.stock >= quantity;
  },
  async purchase(externalId, ctx) {
    const [{ product }, wallet] = await Promise.all([
      request<{ product: DtProduct }>(`/product/${encodeURIComponent(externalId)}`),
      request<{ balance: number; currency: string }>("/balance"),
    ]).catch((e) => { throw new SupplierError(e.message, true); });
    if (!digitrustAvailable(product) || product.stock < ctx.quantity) throw new SupplierError("Digitrust : rupture de stock", true);
    if (wallet.balance < product.price * ctx.quantity) throw new SupplierError("Digitrust : portefeuille fournisseur à recharger", true, true);
    try {
      const { order } = await request<{ order: DtOrder }>("/purchase", { product_id: Number(externalId), quantity: ctx.quantity, email: env("SUPPLIER_EMAIL") });
      if (!order?.id) throw new SupplierError("Digitrust : référence de commande manquante, vérifier l'historique fournisseur", false);
      return toResult(order);
    } catch (e) {
      if (e instanceof SupplierError) throw e;
      const status = e instanceof HttpError ? e.status : 0;
      const certain = [400, 401, 402, 403, 404, 422, 429].includes(status);
      throw new SupplierError(certain ? `Achat Digitrust refusé (${status})` : "Digitrust : réponse incertaine, vérifier l'historique fournisseur avant toute relance", certain, status === 402);
    }
  },
  async getOrder(id) {
    const { order } = await request<{ order: DtOrder }>(`/order/${encodeURIComponent(id)}`);
    return toResult(order);
  },
  async balance() {
    const w = await request<{ balance: number; currency: string }>("/balance");
    return { amount: w.balance, currency: w.currency };
  },
};
