import { createClient } from "npm:@supabase/supabase-js@2";

export type PaymentMode = "test" | "live";
export type PayDunyaCredentials = { master_key: string; private_key: string; token: string };

export function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Configuration serveur indisponible");
  return createClient(url, key);
}

async function encryptionKey() {
  const secret = Deno.env.get("PAYMENT_SETTINGS_ENCRYPTION_KEY");
  if (!secret) throw new Error("Chiffrement indisponible");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptCredentials(credentials: PayDunyaCredentials) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), new TextEncoder().encode(JSON.stringify(credentials)));
  const bytes = new Uint8Array(iv.length + encrypted.byteLength);
  bytes.set(iv); bytes.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...bytes));
}

export async function readPayDunyaConfig() {
  const { data, error } = await serviceClient().from("payment_provider_settings").select("mode, enabled, credentials_ciphertext").eq("provider", "paydunya").maybeSingle();
  if (error) throw new Error("Configuration de paiement indisponible");
  let credentials: PayDunyaCredentials | null = null;
  if (data?.credentials_ciphertext) {
    const bytes = Uint8Array.from(atob(data.credentials_ciphertext), c => c.charCodeAt(0));
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, await encryptionKey(), bytes.slice(12));
    credentials = JSON.parse(new TextDecoder().decode(decrypted));
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
