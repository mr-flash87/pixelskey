// Prime Labs (Pirmestore) API client — server-side only.
// Docs: https://pirmestore.mylabsstore.com/docs
// Auth: Authorization: Bearer <PRIMESTORE_API_KEY> (secret, never exposed client-side)
declare const Deno: { env: { get(name: string): string | undefined } };

const BASE_URL = "https://pirmestore.mylabsstore.com/api/v1";

const apiKey = () => {
  const key = Deno.env.get("PRIMESTORE_API_KEY");
  if (!key) throw new Error("PRIMESTORE_API_KEY non configurée");
  return key;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg =
      (data as { error?: string; message?: string })?.error ??
      (data as { message?: string })?.message ??
      `Prime Labs HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export interface PrimeCategory {
  id: string | number;
  name: string;
  slug?: string;
  [k: string]: unknown;
}

export interface PrimeProduct {
  id: string | number;
  name: string;
  description?: string;
  category_id?: string | number;
  delivery_mode?: string; // "instant" | "activation" | ...
  list_price?: number;
  price?: number | { [k: string]: number };
  stock?: unknown;
  terms?: { duration?: string; warranty?: string };
  max_quantity?: number;
  image?: string;
  [k: string]: unknown;
}

export interface PrimeOrderResult {
  id?: string | number;
  order_id?: string | number;
  status?: string;
  items?: unknown;
  [k: string]: unknown;
}

export const prime = {
  listCategories: () => request<PrimeCategory[]>("/categories"),
  listProducts: (params: { category_id?: string | number; limit?: number; offset?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.category_id != null) q.set("category_id", String(params.category_id));
    q.set("limit", String(params.limit ?? 200));
    q.set("offset", String(params.offset ?? 0));
    return request<PrimeProduct[]>(`/products?${q.toString()}`);
  },
  getProduct: (id: string | number) => request<PrimeProduct>(`/products/${id}`),
  quote: (product_id: string | number, quantity: number) =>
    request<Record<string, unknown>>("/quote", {
      method: "POST",
      body: JSON.stringify({ product_id, quantity }),
    }),
  createOrder: (product_id: string | number, quantity: number, idempotencyKey: string) =>
    request<PrimeOrderResult>("/orders", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ product_id, quantity }),
    }),
  getOrder: (id: string | number) => request<PrimeOrderResult>(`/orders/${id}`),
  me: () => request<Record<string, unknown>>("/me"),
};

// Extract the unit cost (USD) from a Prime product, whatever shape `price` has.
export function primeUnitCostUsd(p: PrimeProduct): number {
  if (typeof p.price === "number") return p.price;
  if (p.price && typeof p.price === "object") {
    const vals = Object.values(p.price).filter((v): v is number => typeof v === "number");
    if (vals.length) return Math.min(...vals);
  }
  if (typeof p.list_price === "number") return p.list_price;
  return 0;
}

// Selling price in FCFA from a USD cost, given margin settings.
export function sellPriceFcfa(
  costUsd: number,
  settings: { usd_rate: number; margin_percent: number; margin_fixed: number },
): number {
  const base = costUsd * settings.usd_rate;
  const withMargin = base * (1 + settings.margin_percent / 100) + settings.margin_fixed;
  // Round to a clean FCFA amount (nearest 50)
  return Math.max(0, Math.round(withMargin / 50) * 50);
}
