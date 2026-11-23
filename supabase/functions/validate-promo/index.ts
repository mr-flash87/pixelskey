// Validate a promo code against a subtotal — server-side rules only.
// Returns { valid, discount, code, reason? }
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({} as any));
    const code = String(body?.code ?? "").trim();
    const subtotal = Number(body?.subtotal);

    if (!code || code.length > 64) return json({ valid: false, reason: "Code invalide" }, 200);
    if (!Number.isFinite(subtotal) || subtotal <= 0)
      return json({ valid: false, reason: "Sous-total invalide" }, 200);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase.rpc("validate_promo_code", {
      _code: code,
      _subtotal: Math.round(subtotal),
    });
    if (error) {
      console.error("validate_promo_code rpc error", error);
      return json({ valid: false, reason: "Erreur de validation" }, 200);
    }
    // Enrich with display-only rules (dates, min order amount).
    const { data: meta } = await supabase
      .from("promo_codes")
      .select("starts_at, expires_at, min_order_amount, kind, value")
      .ilike("code", code)
      .maybeSingle();
    return json({ ...(data as any), ...(meta ?? {}) }, 200);
  } catch (err) {
    console.error("validate-promo fatal:", err);
    return json({ valid: false, reason: "Erreur interne" }, 500);
  }
});
