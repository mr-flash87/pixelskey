import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime, formatXOF } from "../lib/format";
import { MessageCircle, Ban } from "lucide-react";

interface Customer {
  email: string; name: string | null; phone: string | null;
  orders_count: number; total_spent: number; last_order: string;
}

export default function ClientsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("orders")
        .select("customer_email, customer_name, customer_phone, amount, created_at, status")
        .order("created_at", { ascending: false }).limit(500);
      const map: Record<string, Customer> = {};
      data?.forEach((o: any) => {
        const e = o.customer_email;
        if (!map[e]) map[e] = { email: e, name: o.customer_name, phone: o.customer_phone, orders_count: 0, total_spent: 0, last_order: o.created_at };
        map[e].orders_count += 1;
        if (o.status === "paid") map[e].total_spent += o.amount;
      });
      setCustomers(Object.values(map).sort((a, b) => b.total_spent - a.total_spent));
    })();
  }, []);

  const openDetail = async (c: Customer) => {
    setSelected(c);
    const { data } = await supabase.from("orders").select("reference, amount, status, created_at").eq("customer_email", c.email).order("created_at", { ascending: false });
    setHistory(data ?? []);
  };

  const initials = (s: string) => s.slice(0, 2).toUpperCase();

  return (
    <div className="space-y-4 md:space-y-5">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
        Clients ({customers.length})
      </h1>

      <Card className="bg-card border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm min-w-[640px]">
            <thead className="bg-muted text-muted-foreground text-xs">
              <tr className="text-left">
                <th className="p-3">Client</th>
                <th className="p-3 hidden md:table-cell">WhatsApp</th>
                <th className="p-3">Commandes</th>
                <th className="p-3">Total dépensé</th>
                <th className="p-3 hidden lg:table-cell">Dernière</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.email} className="border-t border-border hover:bg-muted/50 cursor-pointer" onClick={() => openDetail(c)}>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        {initials(c.name ?? c.email)}
                      </div>
                      <div>
                        <div className="font-medium">{c.name ?? c.email.split("@")[0]}</div>
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground">{c.phone ?? "—"}</td>
                  <td className="p-3">{c.orders_count}</td>
                  <td className="p-3 font-semibold">{formatXOF(c.total_spent)}</td>
                  <td className="p-3 hidden lg:table-cell text-muted-foreground text-xs">{formatDateTime(c.last_order)}</td>
                </tr>
              ))}
              {customers.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground text-sm">Aucun client</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="bg-card border border-border max-w-xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader><DialogTitle>{selected.name ?? selected.email}</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <Card className="p-4 bg-background border-border text-sm">
                  <p>Email : {selected.email}</p>
                  <p>WhatsApp : {selected.phone ?? "—"}</p>
                  <p className="mt-2 text-primary font-bold">LTV : {formatXOF(selected.total_spent)}</p>
                </Card>
                <Card className="p-4 bg-background border-border">
                  <h4 className="font-semibold mb-2 text-sm">Historique</h4>
                  <div className="space-y-1.5">
                    {history.map((h, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="font-mono">{h.reference}</span>
                        <span>{formatXOF(h.amount)}</span>
                        <span className="text-muted-foreground">{formatDateTime(h.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
                <div className="flex gap-2">
                  <Button className="flex-1 bg-success text-success-foreground hover:bg-success/90"><MessageCircle size={14} className="mr-1.5" /> WhatsApp</Button>
                  <Button variant="outline" className="flex-1 text-destructive border-destructive/40"><Ban size={14} className="mr-1.5" /> Bloquer</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
