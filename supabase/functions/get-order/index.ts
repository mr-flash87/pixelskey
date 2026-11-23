// Returns an order with its items and (only if paid) its license keys.
// Public endpoint — security relies on the unguessable UUID of the order id.
// Uses service_role to bypass RLS on license_keys.

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAY_RE = /pay_[A-Za-z0-9]+/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const rawLookup = body?.order_id ?? body?.reference ?? body?.payment_id ?? body?.lookup;
    if (!rawLookup || typeof rawLookup !== "string") {
      return json({ error: "Identifiant de commande invalide" }, 400);
    }
    const lookup = rawLookup.trim();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let orderId = UUID_RE.test(lookup) ? lookup : null;

    if (!orderId) {
      const decoded = decodeURIComponent(lookup);
      const payMatch = decoded.match(PAY_RE);
      const refMatch = decoded.match(/PK-[A-Z0-9]+/i);
      const query = supabase
        .from("orders")
        .select("id")
        .or([
          `reference.eq.${refMatch?.[0]?.toUpperCase() ?? lookup.toUpperCase()}`,
          `payment_id.eq.${payMatch?.[0] ?? lookup}`,
          `payment_url.ilike.%${payMatch?.[0] ?? lookup}%`,
        ].join(","))
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: match, error: matchError } = await query;
      if (matchError) console.error("Order lookup error:", matchError);
      orderId = match?.id ?? null;
    }

    if (!orderId) {
      return json({ error: "Commande introuvable" }, 404);
    }

    const { data, error } = await supabase.rpc("get_order_with_keys", {
      p_order_id: orderId,
    });

    if (error) {
      console.error("RPC error:", error);
      return json({ error: "Erreur de lecture" }, 500);
    }
    if (!data || !(data as any).order) {
      return json({ error: "Commande introuvable" }, 404);
    }

    // Merge Prime Labs deliveries (paid orders only) into the keys list
    if ((data as any).order.status === "paid") {
      const { data: deliveries } = await supabase
        .from("license_deliveries")
        .select("content, status, order_items(product_name)")
        .eq("order_id", orderId)
        .eq("status", "delivered");
      const extra = (deliveries ?? []).map((d: any) => ({
        product_name: Array.isArray(d.order_items)
          ? d.order_items[0]?.product_name
          : d.order_items?.product_name,
        license_key: d.content,
      }));
      if (extra.length) {
        (data as any).keys = [...((data as any).keys ?? []), ...extra];
      }
    }

    return json(data);
  } catch (err) {
    console.error("get-order fatal:", err);
    return json({ error: "Erreur interne" }, 500);
  }
});
