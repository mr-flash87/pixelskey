import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SyncRun {
  id: string;
  supplier: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  trigger: string;
  products_total: number;
  products_instant: number;
  products_created: number;
  products_updated: number;
  error: string | null;
}

const fmt = (d: string) =>
  new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium", timeZone: "UTC" });

const statusBadge = (s: string) =>
  s === "success" ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Réussie</Badge>
  : s === "error" ? <Badge variant="destructive">Échec</Badge>
  : <Badge variant="secondary">En cours</Badge>;

export default function SynchronisationsPage() {
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [supplier, setSupplier] = useState("primestore");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("catalog_sync_runs").select("*").order("started_at", { ascending: false }).limit(100);
    if (error) toast.error("Impossible de charger l’historique");
    setRuns((data as SyncRun[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const runNow = async () => {
    setSyncing(true);
    const { error } = await supabase.functions.invoke(supplier === "digitrust" ? "sync-digitrust-catalog" : "sync-primestore-catalog", { body: {} });
    setSyncing(false);
    if (error) toast.error("La synchronisation a échoué");
    else toast.success("Synchronisation terminée");
    load();
  };

  const last = runs[0];
  const ok = runs.filter((r) => r.status === "success").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Synchronisations fournisseur</h1>
          <p className="text-sm text-muted-foreground">Historique des mises à jour automatiques du catalogue (toutes les heures).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <Select value={supplier} onValueChange={setSupplier}>
          <SelectTrigger className="w-40" aria-label="Fournisseur à synchroniser"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="primestore">Prime Labs</SelectItem><SelectItem value="digitrust">Digitrust</SelectItem></SelectContent>
        </Select>
        <Button onClick={runNow} disabled={syncing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Synchronisation…" : "Synchroniser maintenant"}
        </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Dernière synchro</p><p className="font-semibold">{last ? fmt(last.started_at) : "—"}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Statut</p><div className="mt-1">{last ? statusBadge(last.status) : "—"}</div></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Produits importés (dernière)</p><p className="text-xl font-bold">{last ? last.products_created + last.products_updated : 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Réussites</p><p className="text-xl font-bold">{ok} / {runs.length}</p></Card>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="p-3">Heure (UTC)</th><th className="p-3">Fournisseur</th><th className="p-3">Statut</th><th className="p-3">Origine</th>
              <th className="p-3 text-right">Importés</th><th className="p-3 text-right">Nouveaux</th>
              <th className="p-3 text-right">Mis à jour</th><th className="p-3 text-right">Catalogue fournisseur</th><th className="p-3">Détail</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Chargement…</td></tr>
            ) : runs.length === 0 ? (
              <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Aucune synchronisation enregistrée pour le moment.</td></tr>
            ) : runs.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="whitespace-nowrap p-3">{fmt(r.started_at)}</td>
                <td className="whitespace-nowrap p-3">{r.supplier === "digitrust" ? "Digitrust" : "Prime Labs"}</td>
                <td className="p-3">{statusBadge(r.status)}</td>
                <td className="p-3">{r.trigger === "cron" ? "Automatique" : "Manuelle"}</td>
                <td className="p-3 text-right font-semibold">{r.products_created + r.products_updated}</td>
                <td className="p-3 text-right">{r.products_created}</td>
                <td className="p-3 text-right">{r.products_updated}</td>
                <td className="p-3 text-right">{r.products_total}</td>
                <td className="max-w-xs p-3 text-xs text-destructive">{r.error ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
