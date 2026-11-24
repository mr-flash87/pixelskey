// Lecture des secrets (Supabase → Edge Functions → Secrets). Jamais exposés au client.
export function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Secret manquant : ${name}`);
  return value;
}
export const optionalEnv = (name: string): string | undefined => Deno.env.get(name) || undefined;

/** Identifiants Telegram des administrateurs (ADMIN_CHAT_IDS="123,456"). */
export function adminIds(): number[] {
  return (optionalEnv("ADMIN_CHAT_IDS") ?? "").split(",").map((s) => Number(s.trim())).filter((n) => Number.isSafeInteger(n) && n !== 0);
}

/** Compare deux chaînes en temps constant. */
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}
