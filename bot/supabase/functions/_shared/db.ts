import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";
import { env } from "./env.ts";

let client: SupabaseClient | null = null;
/** Client service (contourne RLS) — utilisé uniquement côté serveur. */
export function db(): SupabaseClient {
  client ??= createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  return client;
}

export async function setting<T>(key: string, fallback: T): Promise<T> {
  const { data } = await db().from("settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as T) ?? fallback;
}

export interface Product {
  id: number; supplier_id: string; supplier_product_id: string | null; category: string; name: string;
  description: string; price: number; supplier_stock: number; supplier_available: boolean; instant: boolean; is_active: boolean;
}
export interface Order {
  id: string; ref: string; telegram_id: number; product_id: number; product_name: string; quantity: number;
  unit_price: number; amount: number; pay_method: "flashpay" | "balance"; status: string; delivery_status: string;
  supplier_order_id: string | null; supplier_attempted_at: string | null; delivery_error: string | null;
  created_at: string; paid_at: string | null; delivered_at: string | null;
}
export interface BotUser {
  telegram_id: number; username: string | null; first_name: string | null; balance: number; referral_code: string;
  referrer_id: number | null; is_blocked: boolean; state: string | null; state_data: Record<string, unknown>;
}
