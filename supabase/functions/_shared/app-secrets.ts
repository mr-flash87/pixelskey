// Clés d'intégration saisies depuis l'admin (Paramètres → Intégrations, page Fournisseurs).
// Stockées chiffrées dans public.app_secrets ; repli sur les secrets Supabase (Deno.env) s'ils existent.
// @ts-ignore — spécificateur npm: résolu par Deno (fonctions Supabase), pas par le TypeScript du site.
import { createClient } from "npm:@supabase/supabase-js@2";
declare const Deno: { env: { get(name: string): string | undefined } };

export const SECRET_NAMES = [
  "BREVO_API_KEY", "BREVO_SENDER_EMAIL", "BREVO_SENDER_NAME", "ADMIN_NOTIFICATION_EMAIL",
  "AI_API_KEY", "AI_BASE_URL", "AI_MODEL",
  "PRIMESTORE_API_KEY",
  "DIGITRUST_API_URL", "DIGITRUST_API_KEY", "DIGITRUST_AUTH_HEADER",
] as const;
export type SecretName = typeof SECRET_NAMES[number];
// Valeurs sensibles : jamais renvoyées au navigateur (seulement « configurée » + 4 derniers caractères).
export const SENSITIVE = new Set<SecretName>(["BREVO_API_KEY", "AI_API_KEY", "PRIMESTORE_API_KEY", "DIGITRUST_API_KEY"]);

function admin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Configuration serveur indisponible");
  return createClient(url, key);
}

// Clé de chiffrement : PAYMENT_SETTINGS_ENCRYPTION_KEY si défini, sinon la clé de service du projet
// (toujours présente). Si cette clé change, ressaisissez les clés dans l'admin.
export async function encryptionKey() {
  const secret = Deno.env.get("PAYMENT_SETTINGS_ENCRYPTION_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) throw new Error("Chiffrement indisponible");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptText(plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), new TextEncoder().encode(plain));
  const bytes = new Uint8Array(iv.length + encrypted.byteLength);
  bytes.set(iv); bytes.set(new Uint8Array(encrypted), iv.length);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export async function decryptText(cipher: string) {
  const bytes = Uint8Array.from(atob(cipher), (c) => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, await encryptionKey(), bytes.slice(12));
  return new TextDecoder().decode(decrypted);
}

let cache: { at: number; values: Map<string, string> } | null = null;
const TTL_MS = 30_000;

export async function loadStoredSecrets(force = false): Promise<Map<string, string>> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.values;
  const values = new Map<string, string>();
  const { data, error } = await admin().from("app_secrets").select("name, ciphertext");
  if (!error) {
    for (const row of data ?? []) {
      try { values.set(row.name, await decryptText(row.ciphertext)); } catch { /* clé illisible : ignorée */ }
    }
  }
  cache = { at: Date.now(), values };
  return values;
}

/** Valeur d'une clé : d'abord celle saisie dans l'admin, sinon le secret Supabase du même nom. */
export async function getSecret(name: SecretName): Promise<string | undefined> {
  const stored = (await loadStoredSecrets()).get(name);
  if (stored && stored.trim()) return stored.trim();
  const env = Deno.env.get(name);
  return env && env.trim() ? env.trim() : undefined;
}

export async function saveSecrets(values: Partial<Record<SecretName, string | null>>, userId?: string) {
  const db = admin();
  for (const [name, value] of Object.entries(values)) {
    if (!(SECRET_NAMES as readonly string[]).includes(name) || value === undefined) continue;
    if (value === null || value.trim() === "") {
      const { error } = await db.from("app_secrets").delete().eq("name", name);
      if (error) throw new Error("Suppression impossible");
    } else {
      const { error } = await db.from("app_secrets").upsert({ name, ciphertext: await encryptText(value.trim()), updated_at: new Date().toISOString(), updated_by: userId ?? null });
      if (error) throw new Error("Enregistrement impossible");
    }
  }
  cache = null;
}
