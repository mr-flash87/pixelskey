import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime, formatXOF } from "../lib/format";
import { Eye, Send, Undo2, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function CommandesPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "paid" | "pending" | "failed">("all");
  const [selected, setSelected] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [keys, setKeys] = useState<any[]>([]);
  const [revealKey, setRevealKey] = useState<Record<string, boolean>>({});

  const load = async () => {
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200);
    setOrders(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const openDetail = async (o: any) => {
    setSelected(o);
    const [{ data: it }, { data: k }] = await Promise.all([
      supabase.from("order_items").select("*").eq("order_id", o.id),
      supabase.from("license_keys").select("*").eq("order_id", o.id),
    ]);
    setItems(it ?? []); setKeys(k ?? []);
  };

  const refund = async (o: any) => {
    if (!confirm("Marquer comme remboursée ?")) return;
    await supabase.from("orders").update({ status: "failed", refunded_at: new Date().toISOString(), failed_reason: "refunded" }).eq("id", o.id);
    toast.success("Commande remboursée ✅");
    setSelected(null); load();
  };

  const filtered = orders.filter((o) => filter === "all" || o.status === filter);

  const statusBadge = (s: string) => {
    if (s === "paid") return <Badge className="bg-success/10 text-success border-0">Livré ✅</Badge>;
    if (s === "pending") return <Badge className="bg-gold/20 text-gold-foreground border-0">En attente ⏳</Badge>;
    return <Badge className="bg-destructive/15 text-destructive border-0">Échoué ❌</Badge>;
  };

  return (
    <div className="space-y-4 md:space-y-5">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Commandes</h1>

      <div className="flex flex-wrap gap-2">
        {[
          { k: "all", l: "Toutes" }, { k: "paid", l: "Livrées" },
          { k: "pending", l: "En attente" }, { k: "failed", l: "Échec" },
        ].map((f) => (
          <button key={f.k} onClick={() => setFilter(f.k as any)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              filter === f.k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}>{f.l}</button>
        ))}
      </div>

      <Card className="bg-card border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm min-w-[640px]">
            <thead className="bg-muted text-muted-foreground text-xs">
              <tr className="text-left">
                <th className="p-3"># Commande</th>
                <th className="p-3 hidden md:table-cell">Date</th>
                <th className="p-3">Client</th>
                <th className="p-3">Montant</th>
                <th className="p-3 hidden lg:table-cell">Paiement</th>
                <th className="p-3">Statut</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-t border-border hover:bg-muted/50 cursor-pointer" onClick={() => openDetail(o)}>
                  <td className="p-3 font-mono text-xs">{o.reference}</td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground text-xs">{formatDateTime(o.created_at)}</td>
                  <td className="p-3 truncate max-w-[180px]">{o.customer_email}</td>
                  <td className="p-3 font-semibold">{formatXOF(o.amount)}</td>
                  <td className="p-3 hidden lg:table-cell text-muted-foreground capitalize">{o.provider}</td>
                  <td className="p-3">{statusBadge(o.status)}</td>
                  <td className="p-3 text-right">
                    <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openDetail(o); }}><Eye size={14} /></Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">Aucune commande</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="bg-card border border-border max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>Commande {selected.reference}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2 text-sm">
                <Card className="p-4 bg-background border-border">
                  <h4 className="font-semibold mb-2">Client</h4>
                  <p>{selected.customer_name ?? "—"}</p>
                  <p className="text-muted-foreground">{selected.customer_email}</p>
                  <p className="text-muted-foreground">{selected.customer_phone ?? ""}</p>
                </Card>

                <Card className="p-4 bg-background border-border">
                  <h4 className="font-semibold mb-2">Produits</h4>
                  {items.map((it) => (
                    <div key={it.id} className="flex justify-between py-1">
                      <span>{it.product_name} ×{it.quantity}</span>
                      <span className="font-semibold">{formatXOF(it.unit_price * it.quantity)}</span>
                    </div>
                  ))}
                  <div className="border-t border-border mt-2 pt-2 flex justify-between font-bold">
                    <span>Total</span><span>{formatXOF(selected.amount)}</span>
                  </div>
                </Card>

                {keys.length > 0 && (
                  <Card className="p-4 bg-background border-border">
                    <h4 className="font-semibold mb-2">Clés livrées</h4>
                    {keys.map((k) => (
                      <div key={k.id} className="flex items-center gap-2 py-1">
                        <code className="font-mono text-xs flex-1 truncate">
                          {revealKey[k.id] ? k.license_key : k.license_key.replace(/./g, "•").slice(0, 24)}
                        </code>
                        <button onClick={() => setRevealKey((s) => ({ ...s, [k.id]: !s[k.id] }))} className="text-muted-foreground">
                          {revealKey[k.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    ))}
                  </Card>
                )}

                <Card className="p-4 bg-background border-border">
                  <h4 className="font-semibold mb-2">Timeline</h4>
                  <ol className="space-y-1.5 text-xs text-muted-foreground">
                    <li>✅ Commande créée — {formatDateTime(selected.created_at)}</li>
                    {selected.paid_at && <li>✅ Paiement confirmé — {formatDateTime(selected.paid_at)}</li>}
                    {keys.length > 0 && <li>✅ Clés attribuées</li>}
                    {selected.refunded_at && <li className="text-destructive">↩️ Remboursée — {formatDateTime(selected.refunded_at)}</li>}
                  </ol>
                </Card>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="flex-1 min-w-[140px]"><Send size={14} className="mr-1.5" /> Renvoyer la clé</Button>
                  <Button variant="outline" className="flex-1 min-w-[140px] text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => refund(selected)}>
                    <Undo2 size={14} className="mr-1.5" /> Rembourser
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
