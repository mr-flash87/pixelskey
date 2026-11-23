import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, PlugZap, Save } from "lucide-react";
import { toast } from "sonner";
import { SecretField } from "./SecretField";
import { saveSecrets, testConnection, type SecretsState, type TestTarget } from "../lib/integrations";

export interface FieldDef {
  name: string;
  label: string;
  sensitive?: boolean;
  placeholder?: string;
  help?: string;
}

/** Bloc de saisie de clés d'intégration, enregistrées chiffrées côté serveur. */
export function IntegrationBlock({
  fields, secrets, onSaved, testTarget, saveLabel = "Enregistrer",
}: {
  fields: FieldDef[];
  secrets: SecretsState | null;
  onSaved: (values: SecretsState) => void;
  testTarget?: TestTarget;
  saveLabel?: string;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!secrets) return;
    const next: Record<string, string> = {};
    for (const f of fields) next[f.name] = f.sensitive ? "" : secrets[f.name]?.source === "admin" ? secrets[f.name]?.value ?? "" : "";
    setForm(next);
  }, [secrets, fields]);

  const save = async () => {
    const values: Record<string, string | null> = {};
    for (const f of fields) {
      const v = (form[f.name] ?? "").trim();
      if (f.sensitive) {
        if (v) values[f.name] = v;
      } else if (v) {
        values[f.name] = v;
      } else if (secrets?.[f.name]?.source === "admin") {
        values[f.name] = null;
      }
    }
    if (!Object.keys(values).length) return toast.info("Rien à enregistrer");
    setSaving(true);
    try {
      onSaved(await saveSecrets(values));
      setResult(null);
      toast.success("Enregistré ✅ (stocké chiffré sur le serveur)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  };

  const clearKey = async (name: string) => {
    if (!confirm("Supprimer cette clé ?")) return;
    try {
      onSaved(await saveSecrets({ [name]: null }));
      toast.success("Clé supprimée");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suppression impossible");
    }
  };

  const test = async () => {
    if (!testTarget) return;
    setTesting(true);
    try {
      setResult(await testConnection(testTarget));
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : "Test impossible" });
    } finally {
      setTesting(false);
    }
  };

  if (!secrets) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.name} className={f.sensitive ? "sm:col-span-2" : ""}>
            <SecretField
              id={`field-${f.name}`}
              label={f.label}
              state={secrets[f.name]}
              value={form[f.name] ?? ""}
              onChange={(v) => setForm((s) => ({ ...s, [f.name]: v }))}
              sensitive={f.sensitive}
              placeholder={f.placeholder}
              help={f.help}
            />
            {f.sensitive && secrets[f.name]?.source === "admin" && (
              <button type="button" onClick={() => clearKey(f.name)} className="mt-1 text-[11px] text-destructive hover:underline">
                Supprimer cette clé
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary/90">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {saveLabel}
        </Button>
        {testTarget && (
          <Button variant="outline" onClick={test} disabled={testing}>
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
            Tester la connexion
          </Button>
        )}
      </div>
      {result && (
        <p className={`text-sm ${result.ok ? "text-emerald-600" : "text-destructive"}`}>
          {result.ok ? "✓ " : "✗ "}{result.message}
        </p>
      )}
    </div>
  );
}
