import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Check,
  Clock,
  XCircle,
  Loader2,
  Mail,
  Hash,
  Copy,
  Download,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { fetchOrder, OrderResponse, OrderStatus } from "@/lib/order";
import { formatFCFA } from "@/data/products";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { WHATSAPP_LINK } from "@/lib/contact";

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; icon: typeof Check }
> = {
  pending: { label: "En attente de paiement", color: "text-gold border-gold/40 bg-gold/10", icon: Clock },
  paid: { label: "Paiement confirmé", color: "text-success border-success/40 bg-success/10", icon: Check },
  failed: { label: "Paiement échoué", color: "text-destructive border-destructive/40 bg-destructive/10", icon: XCircle },
  expired: { label: "Commande expirée", color: "text-muted-foreground border-primary/20 bg-surface", icon: XCircle },
  refunded: { label: "Remboursée", color: "text-muted-foreground border-primary/20 bg-surface", icon: RefreshCw },
};

const OrderPage = () => {
  const { id } = useParams<{ id: string }>();
  const [search, setSearch] = useState("");
  const [data, setData] = useState<OrderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    try {
      const result = await fetchOrder(id);
      setData(result);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Auto-refresh while pending (in case the webhook arrives a few seconds after redirect)
    const interval = setInterval(() => {
      if (data?.order.status === "pending") load();
    }, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, data?.order.status]);

  // Mark keys as viewed once the page shows a paid order with at least one key
  useEffect(() => {
    if (!id || !data) return;
    if (data.order.status !== "paid") return;
    if (!data.license_keys?.length) return;
    supabase.rpc("mark_keys_viewed", { p_order_id: id }).then(({ error }) => {
      if (error) console.warn("mark_keys_viewed:", error.message);
    });
  }, [id, data?.order.status, data?.license_keys?.length]);

  const status = data?.order.status ?? "pending";
  const StatusBlock = useMemo(() => {
    const cfg = STATUS_CONFIG[status];
    const Icon = cfg.icon;
    return (
      <div className={cn("rounded-xl border p-5 flex items-center gap-4", cfg.color)}>
        <div className="h-12 w-12 rounded-full bg-background/40 flex items-center justify-center shrink-0">
          {status === "pending" ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Icon className="h-6 w-6" />
          )}
        </div>
        <div className="flex-1">
          <p className="font-display font-bold text-lg">{cfg.label}</p>
          {status === "pending" && (
            <p className="text-xs opacity-80 mt-0.5">
              Cette page se met à jour automatiquement…
            </p>
          )}
          {status === "failed" && data?.order.failed_reason && (
            <p className="text-xs opacity-80 mt-0.5">{data.order.failed_reason}</p>
          )}
        </div>
      </div>
    );
  }, [status, data]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copié !");
  };

  const handleDownloadAll = () => {
    if (!data) return;
    const lines = [
      `Pixels Key — Commande ${data.order.reference}`,
      `Email: ${data.order.customer_email}`,
      `Date: ${new Date(data.order.created_at).toLocaleString("fr-FR")}`,
      "",
      "─── Vos clés d'activation ───",
      "",
      ...data.license_keys.map((k) => {
        const item = data.items.find((i) => i.product_id === k.product_id);
        return `${item?.product_name ?? "Produit"} :  ${k.license_key}`;
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pixels-key-${data.order.reference}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar search={search} onSearch={setSearch} />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Retour à la boutique
        </Link>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Chargement de votre commande…
          </div>
        ) : error || !data ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <XCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <h1 className="font-display font-bold text-xl mb-2">Commande introuvable</h1>
            <p className="text-sm text-muted-foreground mb-4">
              {error ?? "Le lien est peut-être incorrect ou expiré."}
            </p>
            <Button asChild className="bg-primary text-primary-foreground">
              <Link to="/">Retour à l'accueil</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h1 className="font-display font-extrabold text-3xl md:text-4xl mb-2">
                Commande{" "}
                <span className="text-gradient-brand">{data.order.reference}</span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Passée le {new Date(data.order.created_at).toLocaleString("fr-FR")}
              </p>
            </div>

            {StatusBlock}

            {/* Identifiants */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-primary/15 bg-surface p-4 flex items-center gap-3">
                <Mail className="h-5 w-5 text-gold shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Email</p>
                  <p className="text-sm font-semibold truncate">{data.order.customer_email}</p>
                </div>
              </div>
              {data.order.payment_id && (
                <div className="rounded-xl border border-primary/15 bg-surface p-4 flex items-center gap-3">
                  <Hash className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Référence de paiement
                    </p>
                    <p className="text-sm font-mono truncate">{data.order.payment_id}</p>
                  </div>
                  <button
                    onClick={() => handleCopy(data.order.payment_id ?? "")}
                    className="text-muted-foreground hover:text-primary"
                    aria-label="Copier"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Pending: pay button */}
            {status === "pending" && data.order.payment_url && (
              <a
                href={data.order.payment_url}
                className="block rounded-xl bg-primary text-primary-foreground hover:bg-gold hover:text-gold-foreground text-center font-bold py-3 transition"
              >
                Reprendre le paiement →
              </a>
            )}

            {/* License keys (only when paid) */}
            {status === "paid" && data.license_keys.length > 0 && (
              <section className="rounded-xl border border-success/30 bg-surface p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display font-bold text-lg">
                    🎁 Vos clés d'activation
                  </h2>
                  <Button
                    onClick={handleDownloadAll}
                    variant="outline"
                    size="sm"
                    className="border-success/40 text-success hover:bg-success hover:text-success-foreground"
                  >
                    <Download className="h-4 w-4 mr-1.5" />
                    Tout télécharger
                  </Button>
                </div>
                <ul className="space-y-2">
                  {data.license_keys.map((k, idx) => {
                    const item = data.items.find((i) => i.product_id === k.product_id);
                    return (
                      <li
                        key={idx}
                        className="flex items-center gap-3 p-3 rounded-lg bg-background border border-primary/15"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground truncate">
                            {item?.product_name ?? "Produit"}
                          </p>
                          <p className="font-mono text-sm font-bold text-foreground truncate">
                            {k.license_key}
                          </p>
                        </div>
                        <button
                          onClick={() => handleCopy(k.license_key)}
                          className="p-2 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition"
                          aria-label="Copier la clé"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
                  💡 Conservez ces clés en lieu sûr. Elles vous ont également été envoyées par email à{" "}
                  <strong className="text-foreground">{data.order.customer_email}</strong>.
                </p>
              </section>
            )}

            {/* Récap items */}
            <section className="rounded-xl border border-primary/15 bg-surface p-5">
              <h2 className="font-display font-bold text-lg mb-4">Détail de la commande</h2>
              <ul className="space-y-3">
                {data.items.map((it) => (
                  <li
                    key={it.id}
                    className="flex items-baseline justify-between gap-3 pb-3 border-b border-primary/10 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{it.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {it.duration ? `${it.duration} · ` : ""}× {it.quantity}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-primary shrink-0">
                      {formatFCFA(it.unit_price * it.quantity)}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="border-t border-primary/15 pt-4 mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sous-total</span>
                  <span>{formatFCFA(data.order.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxes</span>
                  <span className="text-muted-foreground">Incluses</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Livraison digitale</span>
                  <span className="text-success font-semibold">Gratuite</span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-primary/10">
                  <span className="text-sm text-muted-foreground">Total payé</span>
                  <span className="text-2xl font-extrabold text-primary neon-orange">
                    {formatFCFA(data.order.amount)}
                  </span>
                </div>
              </div>
            </section>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button asChild className="flex-1 bg-primary text-primary-foreground hover:bg-gold hover:text-gold-foreground">
                <Link to="/">Continuer mes achats</Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(WHATSAPP_LINK, "_blank")}
                className="flex-1 border-success/40 text-success hover:bg-success hover:text-success-foreground"
              >
                Aide WhatsApp
              </Button>
            </div>
          </div>
        )}
      </main>

      <Footer />
      <WhatsAppFab />
    </div>
  );
};

export default OrderPage;
