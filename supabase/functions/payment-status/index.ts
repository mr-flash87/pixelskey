import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { readPayDunyaConfig } from "../_shared/paydunya-config.ts";
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(null, { status: 405, headers: corsHeaders });
  let ready = false;
  try { const config = await readPayDunyaConfig(); ready = config.enabled && !!config.credentials; } catch { /* fail closed */ }
  return new Response(JSON.stringify({ provider: "paydunya", ready }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
