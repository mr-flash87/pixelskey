import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatXOF, formatDate } from "../lib/format";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download } from "lucide-react";
import { toast } from "sonner";

export default function FinancesPage() {
  const [stats, setStats] = useState({ month: 0, year: 0, refunds: 0, net: 0 });
  const [chart, setChart] = useState<any[]>([]);
  const [tx, setTx] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: orders } = await supabase.from("orders").select("amount, status, created_at, refunded_at, reference, customer_email, provider").order("created_at", { ascending: false });
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const yearStart = new Date(now.getFullYear(), 0, 1);
      let month = 0, year = 0, refunds = 0;
      const monthly: Record<string, number> = {};
      orders?.forEach((o: any) => {
        const d = new Date(o.created_at);
        if (o.status === "paid") {
          if (d >= monthStart) month += o.amount;
          if (d >= yearStart) year += o.amount;
          const k = d.toLocaleDateString("fr-FR", { month: "short" });
          monthly[k] = (monthly[k] ?? 0) + o.amount;
        }
        if (o.refunded_at) refunds += o.amount;
      });
      setStats({ month, year, refunds, net: year - refunds });
      const months = ["jan", "fév", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
      setChart(months.map((m) => ({ month: m, revenue: monthly[m] ?? 0 })));
      setTx(orders ?? []);
    })();
  }, []);

  const exportCsv = () => {
    const rows = [
      ["Date", "Référence", "Email", "Montant FCFA", "Statut", "Provider"],
      ...tx.map((t) => [formatDate(t.created_at), t.reference, t.customer_email, t.amount, t.status, t.provider]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "transactions.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV ✅");
  };

  return (
    <div className="space-y-4 md:space-y-5">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Finances</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="bg-card border-border p-4">
          <p className="text-xs text-muted-foreground">Revenus du mois</p>
          <p className="text-2xl font-bold mt-1">{formatXOF(stats.month)}</p>
        </Card>
        <Card className="bg-card border-border p-4">
          <p className="text-xs text-muted-foreground">Revenus de l'année</p>
          <p className="text-2xl font-bold mt-1">{formatXOF(stats.year)}</p>
        </Card>
        <Card className="bg-card border-border p-4">
          <p className="text-xs text-muted-foreground">Remboursements</p>
          <p className="text-2xl font-bold mt-1 text-destructive">{formatXOF(stats.refunds)}</p>
        </Card>
        <Card className="bg-card border-border p-4">
          <p className="text-xs text-muted-foreground">Bénéfice net estimé</p>
          <p className="text-2xl font-bold mt-1 text-success">{formatXOF(stats.net)}</p>
        </Card>
      </div>

      <Card className="bg-card border-border p-5">
        <h3 className="font-semibold mb-4">Revenus par mois</h3>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-solid))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))", border: "1px solid hsl(var(--border-solid))", borderRadius: 4 }}
                formatter={(v: any) => [formatXOF(v), "Revenus"]} />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="bg-card border-border overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold">Transactions</h3>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportCsv}><Download size={14} className="mr-1.5" /> CSV</Button>
            <Button size="sm" variant="outline" onClick={() => toast("Export PDF — bientôt disponible")}><Download size={14} className="mr-1.5" /> PDF</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm min-w-[640px]">
            <thead className="bg-muted text-muted-foreground text-xs">
              <tr className="text-left">
                <th className="p-3">Date</th>
                <th className="p-3">Référence</th>
                <th className="p-3 hidden md:table-cell">Email</th>
                <th className="p-3">Montant</th>
                <th className="p-3 hidden lg:table-cell">Mode</th>
                <th className="p-3">Type</th>
              </tr>
            </thead>
            <tbody>
              {tx.slice(0, 50).map((t) => (
                <tr key={t.reference} className="border-t border-border">
                  <td className="p-3 text-muted-foreground text-xs">{formatDate(t.created_at)}</td>
                  <td className="p-3 font-mono text-xs">{t.reference}</td>
                  <td className="p-3 hidden md:table-cell truncate">{t.customer_email}</td>
                  <td className="p-3 font-semibold">{formatXOF(t.amount)}</td>
                  <td className="p-3 hidden lg:table-cell capitalize text-muted-foreground">{t.provider}</td>
                  <td className="p-3 text-xs">{t.refunded_at ? <span className="text-destructive">Remb.</span> : <span className="text-success">Vente</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
