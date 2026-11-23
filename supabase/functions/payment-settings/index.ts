import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { encryptCredentials, readPayDunyaConfig, requireSuperAdmin, serviceClient } from "../_shared/paydunya-config.ts";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const keySchema = z.string().trim().min(1).max(2048);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("read") }),
  z.object({ action: z.literal("save"), mode: z.enum(["test", "live"]), enabled: z.boolean(), credentials: z.object({ master_key: keySchema, private_key: keySchema, token: keySchema }).optional() }),
]);

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  try {
    if (!await requireSuperAdmin(req)) return json({ error: "Accès réservé au super administrateur" }, 403);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: "Paramètres PayDunya invalides" }, 400);
    const config = await readPayDunyaConfig();
    if (parsed.data.action === "save") {
      const input = parsed.data;
      if (input.enabled && !input.credentials && !config.credentials) return json({ error: "Renseignez les trois identifiants PayDunya avant d’activer les paiements." }, 400);
      if (config.credentials && input.mode !== config.mode && !input.credentials) return json({ error: "Renseignez les identifiants correspondant au nouveau mode." }, 400);
      const update: Record<string, unknown> = { provider: "paydunya", mode: input.mode, enabled: input.enabled, updated_at: new Date().toISOString() };
      if (input.credentials) update.credentials_ciphertext = await encryptCredentials(input.credentials);
      const { error } = await serviceClient().from("payment_provider_settings").upsert(update);
      if (error) throw new Error("Enregistrement impossible");
      return json({ configured: !!(input.credentials || config.credentials), mode: input.mode, enabled: input.enabled, provider: "paydunya" });
    }
    return json({ configured: !!config.credentials, mode: config.mode, enabled: config.enabled, provider: "paydunya" });
  } catch {
    return json({ error: "Configuration de paiement indisponible" }, 500);
  }
});
