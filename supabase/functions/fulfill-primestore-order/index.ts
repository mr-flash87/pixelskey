// Fulfill a paid order by buying the items from Prime Labs.
// Called internally (service role) after payment success, or by a super admin.
// For each order_item whose product has a primestore_id:
//   - POST /orders on Prime Labs with an Idempotency-Key derived from the order
//   - Stores the delivered items (email:password, keys, links) into license_deliveries
// Safe to retry: Prime Labs dedupes on the idempotency key.

import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { fulfillPrimeOrder } from "../_shared/fulfill-prime.ts";
import { requireSuperAdmin } from "../_shared/paydunya-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // Internal call only — must carry the service role key
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "");
    let secretKeys: string[] = [];
    try { secretKeys = Object.values(JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}")).map(String); } catch { /* ignore */ }
    const serviceOk = !!token && (token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || secretKeys.includes(token));
    let jwtService = false;
    if (!serviceOk && token.split(".").length === 3) {
      const c = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data } = await c.auth.getClaims(token);
      jwtService = data?.claims?.role === "service_role";
    }
    if (!serviceOk && !jwtService && !await requireSuperAdmin(req)) {
      return json({ error: "Accès refusé" }, 403);
    }

    const { order_id } = (await req.json()) as { order_id?: string };
    if (!order_id) return json({ error: "order_id requis" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const r = await fulfillPrimeOrder(supabase, order_id);
    return json(r, r.ok ? 200 : 500);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
