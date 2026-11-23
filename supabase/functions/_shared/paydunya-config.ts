import { createClient } from "npm:@supabase/supabase-js@2";
import { decryptText, encryptText } from "./app-secrets.ts";

export type PaymentMode = "test" | "live";
export type PayDunyaCredentials = { master_key: string; private_key: string; token: string };

export function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Configuration serveur indisponible");
  return createClient(url, key);
}

export async function encryptCredentials(credentials: PayDunyaCredentials) {
  return encryptText(JSON.stringify(credentials));
}

export async function readPayDunyaConfig() {
  const { data, error } = await serviceClient().from("payment_provider_settings").select("mode, enabled, credentials_ciphertext").eq("provider", "paydunya").maybeSingle();
  if (error) throw new Error("Configuration de paiement indisponible");
  let credentials: PayDunyaCredentials | null = null;
  if (data?.credentials_ciphertext) {
    credentials = JSON.parse(await decryptText(data.credentials_ciphertext));
  }
  return { mode: (data?.mode ?? "test") as PaymentMode, enabled: data?.enabled ?? false, credentials };
}

export async function requireSuperAdmin(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) return false;
  const client = createClient(url, key);
  const { data, error } = await client.auth.getClaims(auth.slice(7));
  if (error || !data?.claims?.sub) return false;
  const { data: role, error: roleError } = await serviceClient().from("user_roles").select("role").eq("user_id", data.claims.sub).eq("role", "super_admin").maybeSingle();
  return !roleError && !!role;
}
