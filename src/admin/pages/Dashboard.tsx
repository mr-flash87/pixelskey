import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "../components/KpiCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatXOF, timeAgo } from "../lib/format";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Cell, Pie, PieChart, Legend,
} from "recharts";

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--gold))",
  "hsl(var(--success))",
  "hsl(var(--promo))",
  "hsl(var(--foreground))",
  "hsl(var(--muted-foreground))",
];

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

interface KpiState {
  revenueToday: number;
  revenueYesterday: number;
  ordersToday: number;
  ordersYesterday: number;
  customersTotal: number;
  customersThisMonth: number;
  conversion: number | null;
}

export default function Dashboard() {
  const [kpi, setKpi] = useState<KpiState>({
    revenueToday: 0, revenueYesterday: 0,
    ordersToday: 0, ordersYesterday: 0,
    customersTotal: 0, customersThisMonth: 0,
    conversion: null,
  });
  const [revenueSeries, setRevenueSeries] = useState<{ date: string; revenue: number; orders: number }[]>([]);
  const [revenueSpark, setRevenueSpark] = useState<{ v: number }[]>([]);
  const [ordersSpark, setOrdersSpark] = useState<{ v: number }[]>([]);
  const [categoryData, setCategoryData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [activity, setActivity] = useState<{ text: string; at: string }[]>([]);

  useEffect(() => {
    (async () => {
      const today = startOfDay(new Date());
      const yesterday = startOfDay(new Date(today.getTime() - 86_400_000));
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const start30 = new Date(today.getTime() - 29 * 86_400_000);

      const [
        { data: paidToday },
        { data: paidYesterday },
        { data: paid30 },
        { data: recent },
        { data: items },
        { data: products },
        { data: keys },
      ] = await Promise.all([
        supabase.from("orders").select("amount, customer_email")
          .eq("status", "paid").gte("created_at", today.toISOString()),
        supabase.from("orders").select("amount, customer_email")
          .eq("status", "paid")
          .gte("created_at", yesterday.toISOString())
          .lt("created_at", today.toISOString()),
        supabase.from("orders").select("amount, status, created_at, customer_email")
          .gte("created_at", start30.toISOString()),
        supabase.from("orders").select("id, reference, customer_email, amount, status, created_at, paid_at, refunded_at")
          .order("created_at", { ascending: false }).limit(10),
        supabase.from("order_items")
          .select("product_name, unit_price, quantity, product_id, created_at"),
        supabase.from("products").select("id, name, image_url, category, stock"),
        supabase.from("license_keys").select("product_id, status, created_at, assigned_at, order_id"),
      ]);

      // KPIs
      const revToday = (paidToday ?? []).reduce((s, o: any) => s + (o.amount ?? 0), 0);
      const revYesterday = (paidYesterday ?? []).reduce((s, o: any) => s + (o.amount ?? 0), 0);
      const ordersTodayCount = paidToday?.length ?? 0;
      const ordersYesterdayCount = paidYesterday?.length ?? 0;

      // Customers (distinct emails ever / this month)
      const allEmails = new Set<string>();
      const monthEmails = new Set<string>();
      (paid30 ?? []).forEach((o: any) => {
        if (o.customer_email) allEmails.add(o.customer_email);
        if (o.customer_email && new Date(o.created_at) >= monthStart) {
          monthEmails.add(o.customer_email);
        }
      });

      // 30j series + sparks
      const series: { date: string; revenue: number; orders: number }[] = [];
      for (let i = 0; i < 30; i++) {
        const d = new Date(start30.getTime() + i * 86_400_000);
        const next = new Date(d.getTime() + 86_400_000);
        const dayPaid = (paid30 ?? []).filter((o: any) =>
          o.status === "paid" && new Date(o.created_at) >= d && new Date(o.created_at) < next
        );
        series.push({
          date: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
          revenue: dayPaid.reduce((s, o: any) => s + o.amount, 0),
          orders: dayPaid.length,
        });
      }
      setRevenueSeries(series);
      setRevenueSpark(series.slice(-14).map((s) => ({ v: s.revenue })));
      setOrdersSpark(series.slice(-14).map((s) => ({ v: s.orders })));

      // Conversion : commandes payées / commandes totales sur 30j
      const total30 = paid30?.length ?? 0;
      const paid30Count = (paid30 ?? []).filter((o: any) => o.status === "paid").length;
      const conversion = total30 > 0 ? +((paid30Count / total30) * 100).toFixed(1) : null;

      // Top produits par ventes
      const top: Record<string, { name: string; sold: number; revenue: number }> = {};
      (items ?? []).forEach((it: any) => {
        const k = it.product_name;
        if (!top[k]) top[k] = { name: k, sold: 0, revenue: 0 };
        top[k].sold += it.quantity;
        top[k].revenue += it.unit_price * it.quantity;
      });
      const topArr = Object.values(top).sort((a, b) => b.sold - a.sold).slice(0, 5);

      // Catégories : ventes par catégorie
      const productMap: Record<string, { name: string; category: string }> = {};
      (products ?? []).forEach((p: any) => { productMap[p.id] = { name: p.name, category: p.category }; });
      const catTotals: Record<string, number> = {};
      (items ?? []).forEach((it: any) => {
        const cat = productMap[it.product_id]?.category ?? "autre";
        catTotals[cat] = (catTotals[cat] ?? 0) + it.quantity;
      });
      const catEntries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 6);
      setCategoryData(catEntries.map(([name, value], i) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value, color: PIE_COLORS[i % PIE_COLORS.length],
      })));

      // Stock bas (combinant table products.stock + clés disponibles)
      const stockFromKeys: Record<string, number> = {};
      (keys ?? []).forEach((k: any) => {
        if (k.status === "available") stockFromKeys[k.product_id] = (stockFromKeys[k.product_id] ?? 0) + 1;
      });
      const low = (products ?? [])
        .map((p: any) => {
          const ks = stockFromKeys[p.id] ?? 0;
          const stock = Math.max(p.stock ?? 0, ks);
          return { ...p, stock };
        })
        .filter((p) => p.stock < 5)
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 5);
      setLowStock(low);

      // Activité réelle : combine commandes récentes + clés livrées
      const acts: { text: string; at: string }[] = [];
      (recent ?? []).slice(0, 5).forEach((o: any) => {
        if (o.status === "paid") {
          acts.push({
            text: `Commande ${o.reference} payée — ${formatXOF(o.amount)} (${o.customer_email})`,
            at: o.paid_at ?? o.created_at,
          });
        } else if (o.status === "pending") {
          acts.push({
            text: `Nouvelle commande ${o.reference} — ${formatXOF(o.amount)} en attente`,
            at: o.created_at,
          });
        } else {
          acts.push({
            text: `Commande ${o.reference} échouée — ${o.customer_email}`,
            at: o.created_at,
          });
        }
      });
      const assignedKeys = (keys ?? [])
        .filter((k: any) => k.assigned_at)
        .sort((a: any, b: any) => +new Date(b.assigned_at) - +new Date(a.assigned_at))
        .slice(0, 3);
      assignedKeys.forEach((k: any) => {
        const pname = productMap[k.product_id]?.name ?? "Produit";
        acts.push({ text: `Clé livrée : ${pname}`, at: k.assigned_at });
      });
      low.slice(0, 2).forEach((p) => {
        acts.push({ text: `Stock faible : ${p.name} (${p.stock} restantes)`, at: new Date().toISOString() });
      });
      acts.sort((a, b) => +new Date(b.at) - +new Date(a.at));
      setActivity(acts.slice(0, 8));

      setKpi({
        revenueToday: revToday,
        revenueYesterday: revYesterday,
        ordersToday: ordersTodayCount,
        ordersYesterday: ordersYesterdayCount,
        customersTotal: allEmails.size,
        customersThisMonth: monthEmails.size,
        conversion,
      });
      setRecentOrders((recent ?? []).slice(0, 5));
      setTopProducts(topArr);
    })();
  }, []);

  const variation = (current: number, previous: number) => {
    if (previous === 0) {
      if (current === 0) return { value: "—", positive: true };
      return { value: "Nouveau", positive: true };
    }
    const pct = Math.round(((current - previous) / previous) * 100);
    return { value: `${pct >= 0 ? "+" : ""}${pct}% vs hier`, positive: pct >= 0 };
  };

  const statusBadge = (s: string) => {
    if (s === "paid") return <Badge className="bg-success/10 text-success border-0">Livré</Badge>;
    if (s === "pending") return <Badge className="bg-gold/20 text-gold-foreground border-0">En attente</Badge>;
    return <Badge className="bg-destructive/15 text-destructive border-0">Échoué</Badge>;
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
          Dashboard
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">Vue d'ensemble de la boutique</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          title="Revenus du jour"
          value={formatXOF(kpi.revenueToday)}
          variation={variation(kpi.revenueToday, kpi.revenueYesterday)}
          icon="💰"
          spark={revenueSpark}
        />
        <KpiCard
          title="Commandes du jour"
          value={kpi.ordersToday}
          variation={variation(kpi.ordersToday, kpi.ordersYesterday)}
          icon="📦"
          spark={ordersSpark}
        />
        <KpiCard
          title="Clients uniques (30j)"
          value={kpi.customersTotal.toLocaleString("fr-FR")}
          variation={{
            value: `${kpi.customersThisMonth} ce mois`,
            positive: kpi.customersThisMonth > 0,
          }}
          icon="👥"
        />
        <KpiCard
          title="Taux de conversion"
          value={kpi.conversion != null ? `${kpi.conversion}%` : "—"}
          variation={kpi.conversion != null
            ? { value: "30 derniers jours", positive: true }
            : undefined}
          icon="📈"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card className="lg:col-span-2 bg-card border-border p-3 sm:p-5">
          <h3 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Revenus — 30 derniers jours</h3>
          <div className="h-56 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueSeries}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-solid))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tick={{ fill: "hsl(var(--muted-foreground))" }} interval={4} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tick={{ fill: "hsl(var(--muted-foreground))" }} width={50} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))", border: "1px solid hsl(var(--border-solid))", borderRadius: 4 }}
                  formatter={(value: any, name: string) => name === "revenue" ? [formatXOF(value), "Revenus"] : [value, "Commandes"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="bg-card border-border p-3 sm:p-5">
          <h3 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Top Catégories</h3>
          <div className="h-56 sm:h-72">
            {categoryData.length === 0 ? (
              <p className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center h-full">
                Aucune vente pour l'instant.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} dataKey="value" innerRadius={40} outerRadius={75} paddingAngle={3}>
                    {categoryData.map((c, i) => <Cell key={i} fill={c.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))", border: "1px solid hsl(var(--border-solid))", borderRadius: 4 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <Card className="bg-card border-border p-3 sm:p-5">
          <h3 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Dernières commandes</h3>
          <div className="space-y-2">
            {recentOrders.length === 0 && <p className="text-sm text-muted-foreground">Aucune commande pour l'instant.</p>}
            {recentOrders.map((o) => (
              <div key={o.id} className="flex items-center gap-2 sm:gap-3 p-2 rounded-lg hover:bg-accent">
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-mono truncate">{o.reference}</div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{o.customer_email}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs sm:text-sm font-semibold whitespace-nowrap">{formatXOF(o.amount)}</div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">{timeAgo(o.created_at)}</div>
                </div>
                <div className="shrink-0">{statusBadge(o.status)}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="bg-card border-border p-3 sm:p-5">
          <h3 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Produits les plus vendus</h3>
          <div className="space-y-3">
            {topProducts.length === 0 && <p className="text-sm text-muted-foreground">Pas encore de ventes.</p>}
            {topProducts.map((p, i) => {
              const max = topProducts[0]?.sold || 1;
              return (
                <div key={i}>
                  <div className="flex justify-between gap-2 text-xs sm:text-sm mb-1">
                    <span className="truncate">{p.name}</span>
                    <span className="text-muted-foreground text-[10px] sm:text-xs whitespace-nowrap">
                      {p.sold} ventes · {formatXOF(p.revenue)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${(p.sold / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Alerts + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <Card className="bg-card border-border p-3 sm:p-5">
          <h3 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">⚠️ Alertes stock</h3>
          <div className="space-y-2">
            {lowStock.length === 0 && <p className="text-sm text-muted-foreground">Tous les stocks sont sains 👍</p>}
            {lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted">
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-medium truncate">{p.name}</div>
                  <div className="text-[10px] sm:text-xs text-destructive">{p.stock} restantes</div>
                </div>
                <Button size="sm" variant="outline" className="border-primary/40 text-primary hover:bg-primary/10 shrink-0 text-xs">
                  Réappro.
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="bg-card border-border p-3 sm:p-5">
          <h3 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Activité récente</h3>
          <div className="space-y-3">
            {activity.length === 0 && <p className="text-sm text-muted-foreground">Aucune activité récente.</p>}
            {activity.map((a, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm break-words">{a.text}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{timeAgo(a.at)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
