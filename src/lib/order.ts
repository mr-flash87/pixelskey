// Helpers to bridge the client product slugs with the server-side product UUIDs.
import { supabase } from "@/integrations/supabase/client";

export async function fetchProductIdsBySlugs(slugs: string[]) {
  const unique = [...new Set(slugs)];
  const { data, error } = await supabase
    .from("products")
    .select("id, slug")
    .in("slug", unique);
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data ?? []) map.set(row.slug, row.id);
  return map;
}

export type OrderStatus = "pending" | "paid" | "failed" | "expired" | "refunded";

export interface OrderItemRow {
  id: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  duration: string | null;
}

export interface OrderRow {
  id: string;
  reference: string;
  customer_email: string;
  customer_phone: string | null;
  customer_name: string | null;
  amount: number;
  currency: string;
  status: OrderStatus;
  payment_id: string | null;
  payment_url: string | null;
  paid_at: string | null;
  failed_reason: string | null;
  created_at: string;
}

export interface OrderLicenseKey {
  product_id: string;
  license_key: string;
  assigned_at: string;
}

export interface OrderResponse {
  order: OrderRow;
  items: OrderItemRow[];
  license_keys: OrderLicenseKey[];
}

export async function fetchOrder(orderId: string): Promise<OrderResponse> {
  const { data, error } = await supabase.functions.invoke("get-order", {
    body: { order_id: orderId },
  });
  if (error) throw error;
  return data as OrderResponse;
}
