// Adaptateur Prime Labs. Accepte un en-tête Idempotency-Key : la relance d'un achat incertain est sans risque.
// Secret : PRIMESTORE_API_KEY (et PRIMESTORE_API_URL optionnel).
import { env, optionalEnv } from "../env.ts";
import { normalizeItems, SupplierError, type SupplierAdapter, type PurchaseResult } from "./types.ts";

interface PrimeProduct {
  id: string | number; name: string; description?: string; delivery_mode?: string; list_price?: number;
  price?: number | Record<string, number>; stock?: { available?: number | null; in_stock?: boolean } | null; max_quantity?: number;
}
interface PrimeOrder { id?: string | number; order_id?: string | number; status?: string; items?: unknown; order?: PrimeOrder }

class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = (optionalEnv("PRIMESTORE_API_URL") ?? "https://pirmestore.mylabsstore.com/api/v1").replace(/\/+$/, "");
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env("PRIMESTORE_API_KEY")}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new HttpError(res.status, `Prime Labs ${res.status} : ${String(data?.error ?? data?.message ?? "requête refusée").slice(0, 200)}`);
  return data as T;
}

export function primeCost(p: PrimeProduct): number {
  if (typeof p.price === "number") return p.price;
  if (p.price && typeof p.price === "object") {
    const vals = Object.values(p.price).filter((v): v is number => typeof v === "number");
    if (vals.length) return Math.min(...vals);
  }
  return typeof p.list_price === "number" ? p.list_price : 0;
}

const INSTANT_MODES = ["instant", "instant_delivery", "auto", "limited", "unlimited"];
export function primeState(p: PrimeProduct) {
  const mode = String(p.delivery_mode ?? "").toLowerCase();
  const instant = INSTANT_MODES.includes(mode);
  const manual = mode === "manual";
  const stock = p.stock?.in_stock === false ? 0 : typeof p.stock?.available === "number" ? p.stock.available : (p.max_quantity ?? 999);
  return { instant, available: (instant || manual) && primeCost(p) > 0, stock: Math.max(0, Math.floor(stock)) };
}

const toResult = (raw: PrimeOrder): PurchaseResult => {
  const o = raw.order ?? raw;
  const id = String(o.id ?? o.order_id ?? "");
  if (!id) throw new SupplierError("Prime Labs : référence de commande manquante", false);
  const items = normalizeItems(o.items);
  return items.length ? { status: "delivered", supplierOrderId: id, items } : { status: "pending", supplierOrderId: id };
};

const unwrap = <T>(r: T | { product: T }): T => (r && typeof r === "object" && "product" in r ? (r as { product: T }).product : r as T);

export const primeLabsAdapter: SupplierAdapter = {
  id: "primelabs",
  idempotent: true,
  async listOffers() {
    const offers = [];
    for (let offset = 0; offset < 5000; offset += 200) {
      const page = await request<PrimeProduct[] | { products: PrimeProduct[] }>(`/products?limit=200&offset=${offset}`);
      const list = Array.isArray(page) ? page : page.products ?? [];
      for (const p of list) {
        const s = primeState(p);
        offers.push({ externalId: String(p.id), name: p.name, description: p.description ?? "", cost: primeCost(p), currency: "USD" as const, ...s });
      }
      if (list.length < 200) break;
    }
    return offers;
  },
  async canSell(externalId, quantity) {
    const p = unwrap(await request<PrimeProduct | { product: PrimeProduct }>(`/products/${encodeURIComponent(externalId)}`));
    const s = primeState(p);
    return s.available && s.stock >= quantity;
  },
  async purchase(externalId, ctx) {
    try {
      return toResult(await request<PrimeOrder>("/orders", {
        method: "POST",
        headers: { "Idempotency-Key": `tgbot-${ctx.orderId}` },
        body: JSON.stringify({ product_id: externalId, quantity: ctx.quantity }),
      }));
    } catch (e) {
      if (e instanceof SupplierError) throw e;
      const status = e instanceof HttpError ? e.status : 0;
      const certain = status >= 400 && status < 500 && status !== 408 && status !== 409;
      throw new SupplierError(certain ? `Achat Prime Labs refusé (${status})` : "Prime Labs : réponse incertaine", certain, status === 402);
    }
  },
  async getOrder(id) {
    return toResult(await request<PrimeOrder>(`/orders/${encodeURIComponent(id)}`));
  },
  async balance() {
    const me = await request<Record<string, unknown>>("/me");
    const amount = Number(me.balance ?? (me.wallet as Record<string, unknown> | undefined)?.balance ?? NaN);
    return { amount, currency: String(me.currency ?? "USD") };
  },
};
