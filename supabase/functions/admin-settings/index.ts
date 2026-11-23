// Clés d'intégration gérées depuis l'admin (super administrateur uniquement).
//   { action: "read" }                         → état de chaque clé (les clés sensibles ne sont jamais renvoyées)
//   { action: "save", values: { NOM: "valeur" | null } }  → enregistre (null ou "" = supprimer)
//   { action: "test", target: "brevo" | "ai" | "primestore" | "digitrust" } → vérifie la connexion
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireSuperAdmin } from "../_shared/paydunya-config.ts";
import { getSecret, loadStoredSecrets, saveSecrets, SECRET_NAMES, SENSITIVE, type SecretName } from "../_shared/app-secrets.ts";
import { prime } from "../_shared/primestore.ts";
import { digitrust } from "../_shared/digitrust.ts";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function test(target: string): Promise<string> {
  if (target === "brevo") {
    const key = await getSecret("BREVO_API_KEY");
    if (!key) throw new Error("Clé API Brevo non renseignée");
    const r = await fetch("https://api.brevo.com/v3/account", { headers: { "api-key": key, accept: "application/json" } });
    if (!r.ok) throw new Error(r.status === 401 ? "Clé API Brevo refusée" : `Brevo a répondu ${r.status}`);
    const account = await r.json();
    return `Connecté à Brevo (${account?.email ?? "compte OK"})`;
  }
  if (target === "ai") {
    const key = await getSecret("AI_API_KEY");
    if (!key) throw new Error("Clé API IA non renseignée");
    const base = (await getSecret("AI_BASE_URL")) ?? "https://api.openai.com/v1";
    const r = await fetch(`${base.replace(/\/+$/, "")}/models`, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) throw new Error(r.status === 401 ? "Clé API IA refusée" : `Le fournisseur IA a répondu ${r.status}`);
    return "Connexion IA OK";
  }
  if (target === "primestore") {
    await prime.me();
    return "Connecté à Prime Labs";
  }
  if (target === "digitrust") {
    const wallet = await digitrust.balance();
    return `Connecté à Digitrust — solde ${wallet.balance} ${wallet.currency}`;
  }
  throw new Error("Cible inconnue");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  if (!await requireSuperAdmin(req)) return json({ error: "Accès réservé au super administrateur" }, 403);
  const body = await req.json().catch(() => null) as { action?: string; values?: Record<string, unknown>; target?: string } | null;
  try {
    if (body?.action === "save") {
      const values: Partial<Record<SecretName, string | null>> = {};
      for (const [name, value] of Object.entries(body.values ?? {})) {
        if (!(SECRET_NAMES as readonly string[]).includes(name)) return json({ error: `Clé inconnue : ${name}` }, 400);
        if (value !== null && typeof value !== "string") return json({ error: `Valeur invalide : ${name}` }, 400);
        if (typeof value === "string" && value.length > 4096) return json({ error: `Valeur trop longue : ${name}` }, 400);
        values[name as SecretName] = value as string | null;
      }
      await saveSecrets(values);
    } else if (body?.action === "test") {
      try {
        return json({ ok: true, message: await test(String(body.target ?? "")) });
      } catch (e) {
        return json({ ok: false, message: e instanceof Error ? e.message.slice(0, 300) : "Échec de connexion" });
      }
    } else if (body?.action !== "read") {
      return json({ error: "Action invalide" }, 400);
    }
    const stored = await loadStoredSecrets(true);
    const state: Record<string, { set: boolean; source: "admin" | "supabase" | null; value?: string; hint?: string }> = {};
    for (const name of SECRET_NAMES) {
      const own = stored.get(name);
      const env = Deno.env.get(name);
      const value = own ?? env;
      const source = own ? "admin" : env ? "supabase" : null;
      state[name] = SENSITIVE.has(name)
        ? { set: !!value, source, ...(value ? { hint: `••••${value.slice(-4)}` } : {}) }
        : { set: !!value, source, ...(value ? { value } : {}) };
    }
    return json({ values: state });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erreur serveur" }, 500);
  }
});
