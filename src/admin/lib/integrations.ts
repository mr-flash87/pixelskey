import { supabase } from "@/integrations/supabase/client";

export type SecretState = { set: boolean; source: "admin" | "supabase" | null; value?: string; hint?: string };
export type SecretsState = Record<string, SecretState>;
export type TestTarget = "brevo" | "ai" | "primestore" | "digitrust";

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-settings", { body });
  if (error) {
    let message = "Service indisponible";
    try { message = (await (error as { context?: Response }).context?.json())?.error ?? message; } catch { /* ignore */ }
    throw new Error(message);
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

export const readSecrets = () => call<{ values: SecretsState }>({ action: "read" }).then((r) => r.values);
export const saveSecrets = (values: Record<string, string | null>) =>
  call<{ values: SecretsState }>({ action: "save", values }).then((r) => r.values);
export const testConnection = (target: TestTarget) => call<{ ok: boolean; message: string }>({ action: "test", target });
