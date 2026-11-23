import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

export function DigitrustSettings() {
  const [margins, setMargins] = useState({ usd_rate: 635, margin_percent: 100, margin_fixed: 0 });
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase.from("shop_settings").select("value").eq("key", "digitrust.margins").maybeSingle().then(({ data }) => {
      if (data?.value && typeof data.value === "object") setMargins((m) => ({ ...m, ...data.value as typeof m }));
    });
    supabase.functions.invoke("sync-digitrust-catalog", { body: { action: "status" } }).then(({ data }) => setBalance(data?.balance ?? null));
  }, []);
  const save = async () => {
    if (!Number.isFinite(margins.usd_rate) || margins.usd_rate <= 0 || !Number.isFinite(margins.margin_percent) || margins.margin_percent < 0 || !Number.isFinite(margins.margin_fixed) || margins.margin_fixed < 0) return toast.error("Vérifiez les marges et le taux de conversion");
    setBusy(true);
    const { error } = await supabase.from("shop_settings").upsert({ key: "digitrust.margins", value: margins });
    setBusy(false);
    if (error) toast.error("Enregistrement impossible"); else toast.success("Marges Digitrust enregistrées");
  };
  const sync = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("sync-digitrust-catalog", { body: {} });
    setBusy(false);
    if (error) toast.error("Synchronisation Digitrust échouée — consultez l’historique");
    else { setBalance(data.balance); toast.success(`${data.products_upserted} produits Digitrust synchronisés`); }
  };
  return <section className="mt-6 max-w-2xl space-y-4 border-t border-border pt-6">
    <div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">Fournisseur Digitrust</h2><span className="text-sm text-muted-foreground">Portefeuille : {balance === null ? "—" : `${balance.toFixed(2)} USD`}</span></div>
    {balance === 0 && <p className="text-sm text-destructive">Portefeuille vide : les clients peuvent commander les offres en stock, mais leur livraison attendra le rechargement Digitrust.</p>}
    <div className="grid gap-3 sm:grid-cols-3">
      <div><Label htmlFor="digitrust-rate">Taux USD → FCFA</Label><Input id="digitrust-rate" type="number" min="1" value={margins.usd_rate} onChange={(e) => setMargins({ ...margins, usd_rate: Number(e.target.value) })} /></div>
      <div><Label htmlFor="digitrust-margin">Marge Digitrust (%)</Label><Input id="digitrust-margin" type="number" min="0" value={margins.margin_percent} onChange={(e) => setMargins({ ...margins, margin_percent: Number(e.target.value) })} /></div>
      <div><Label htmlFor="digitrust-fixed">Montant fixe Digitrust (FCFA)</Label><Input id="digitrust-fixed" type="number" min="0" value={margins.margin_fixed} onChange={(e) => setMargins({ ...margins, margin_fixed: Number(e.target.value) })} /></div>
    </div>
    <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={save}><Save className="mr-2 h-4 w-4" />Enregistrer Digitrust</Button><Button disabled={busy} variant="outline" onClick={sync}><RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} />Synchroniser Digitrust</Button></div>
  </section>;
}
