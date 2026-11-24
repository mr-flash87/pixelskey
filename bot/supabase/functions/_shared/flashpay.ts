// Client FlashPay (Orange Money, Moov Money, Wave) — serveur uniquement.
// Doc : https://marchand.pixelpub.online/pay/docs
import { env, optionalEnv, safeEqual } from "./env.ts";

const base = () => (optionalEnv("FLASHPAY_API_URL") ?? "https://marchand.pixelpub.online/pay/api/v1").replace(/\/+$/, "");

export interface FlashPayOperator {
  code: string; name: string; merchant_number: string | null; ussd_code: string | null; pay_link: string | null;
  fee_percent: number; amount_to_send: number; instructions: string | null;
}
export interface FlashPayPayment {
  id: string; status: "pending" | "paid" | "expired" | "cancelled"; amount: number; currency: string;
  reference: string | null; checkout_url: string; operators: FlashPayOperator[]; paid_operator: string | null;
  expires_at: string | null; paid_at: string | null; metadata?: Record<string, unknown> | null;
}

export class FlashPayError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

async function request<T>(method: "GET" | "POST", path: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${env("FLASHPAY_API_KEY")}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    const err = data?.error ?? {};
    throw new FlashPayError(res.status, String(err.code ?? "server_error"), String(err.message ?? `FlashPay HTTP ${res.status}`).slice(0, 300));
  }
  return data as T;
}

export const flashpay = {
  create: (p: { amount: number; reference: string; description: string; callback_url: string; return_url?: string; metadata?: Record<string, unknown> }) =>
    request<FlashPayPayment>("POST", "/payments", p),
  get: (id: string) => request<FlashPayPayment>("GET", `/payments/${encodeURIComponent(id)}`),
  cancel: (id: string) => request<FlashPayPayment>("POST", `/payments/${encodeURIComponent(id)}/cancel`, {}),
  account: () => request<Record<string, unknown>>("GET", "/account"),
};

/** Montants acceptés par FlashPay (XOF entiers). */
export const FLASHPAY_MIN = 100;
export const FLASHPAY_MAX = 1_000_000;

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Vérifie un webhook FlashPay : HMAC-SHA256(timestamp + "." + corps_brut, secret) en hex,
 * en-tête "sha256=<hex>", requêtes de plus de 5 minutes refusées.
 */
export async function verifyFlashPaySignature(rawBody: string, timestamp: string | null, signature: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<boolean> {
  if (!timestamp || !signature || !/^\d{1,12}$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > 300) return false;
  const expected = await hmacHex(secret, `${timestamp}.${rawBody}`);
  return safeEqual(expected, signature.replace(/^sha256=/, "").trim().toLowerCase());
}
