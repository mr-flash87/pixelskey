import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type Settings = { configured: boolean; mode: "test" | "live"; enabled: boolean };
const emptyKeys = { master_key: "", private_key: "", token: "" };
export function PayDunyaSettings() {
  const [settings, setSettings] = useState<Settings>({ configured: false, mode: "test", enabled: false });
  const [keys, setKeys] = useState(emptyKeys);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  useEffect(() => {
    let active = true;
    supabase.functions.invoke("payment-settings", { body: { action: "read" } }).then(({ data, error }) => {
      if (!active) return;
      if (error || data?.error) setErrorMessage(data?.error ?? "Impossible de charger les réglages PayDunya.");
      else setSettings(data);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const save = async () => {
    const credentials = Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, v.trim()]));
    const hasInput = Object.values(credentials).some(Boolean);
    if (hasInput && !Object.values(credentials).every(Boolean)) return toast.error("Renseignez les trois identifiants PayDunya.");
    if (settings.enabled && !settings.configured && !hasInput) return toast.error("Ajoutez vos identifiants avant d’activer PayDunya.");
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("payment-settings", { body: { action: "save", mode: settings.mode, enabled: settings.enabled, ...(hasInput ? { credentials } : {}) } });
      if (error) {
        const response = error.context;
        const body = response instanceof Response ? await response.json().catch(() => null) : null;
        throw new Error(body?.error ?? "Enregistrement impossible.");
      }
      if (data?.error) throw new Error(data.error);
      setSettings(data); setKeys(emptyKeys); setErrorMessage("");
      toast.success("Réglages PayDunya enregistrés.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Enregistrement impossible."); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div><h3 className="font-semibold text-lg">PayDunya</h3><p className="text-sm text-muted-foreground">LeekPay désactivé pour les nouveaux achats.</p></div>
        <ShieldCheck className="h-6 w-6 text-primary shrink-0" />
      </div>
      {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <>
        <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          {settings.configured ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertCircle className="h-4 w-4 text-promo" />}
          {settings.configured ? "Identifiants enregistrés" : "En attente des identifiants PayDunya"}
        </div>
        {errorMessage && <p role="alert" className="text-sm text-destructive">{errorMessage}</p>}
        <div><Label htmlFor="paydunya-mode">Mode de paiement</Label><Select value={settings.mode} onValueChange={(mode: "test" | "live") => setSettings({ ...settings, mode })}><SelectTrigger id="paydunya-mode" className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="test">Test — sans argent réel</SelectItem><SelectItem value="live">Réel</SelectItem></SelectContent></Select></div>
        <div className="space-y-3">
          {([{ key: "master_key", label: "Clé principale (Master Key)" }, { key: "private_key", label: "Clé privée (Private Key)" }, { key: "token", label: "Token" }] as const).map(field => <div key={field.key}><Label htmlFor={`paydunya-${field.key}`}>{field.label}</Label><Input id={`paydunya-${field.key}`} type="password" autoComplete="new-password" maxLength={2048} value={keys[field.key]} onChange={e => setKeys({ ...keys, [field.key]: e.target.value })} placeholder={settings.configured ? "Laisser vide pour conserver" : field.label} className="mt-1.5" /></div>)}
        </div>
        <p className="text-xs text-muted-foreground">Identifiants de votre application PayDunya, correspondant au mode choisi. Ils sont chiffrés et ne sont jamais réaffichés.</p>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4"><Label htmlFor="paydunya-enabled">Activer les paiements PayDunya</Label><Switch id="paydunya-enabled" checked={settings.enabled} onCheckedChange={enabled => setSettings({ ...settings, enabled })} /></div>
        <Button onClick={save} disabled={saving || !!errorMessage} className="w-full sm:w-auto">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Enregistrer PayDunya</Button>
      </>}
    </div>
  );
}
