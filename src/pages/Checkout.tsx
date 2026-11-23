import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { useCart } from "@/store/cart";
import { formatFCFA } from "@/data/products";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchProductIdsBySlugs } from "@/lib/order";

const Checkout = () => {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { items, total, clear } = useCart();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(true);
  useEffect(() => {
    supabase.functions.invoke("payment-status").then(({ data, error }) => {
      setPaymentReady(!error && !!data?.ready);
      setPaymentLoading(false);
    });
  }, []);
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState<{
    code: string;
    discount: number;
    kind?: "percent" | "amount";
    value?: number;
    starts_at?: string | null;
    expires_at?: string | null;
    min_order_amount?: number;
  } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [validatingPromo, setValidatingPromo] = useState(false);

  const subtotal = total();
  const grandTotal = Math.max(0, subtotal - (promoApplied?.discount ?? 0));

  const applyPromo = async () => {
    const code = promoCode.trim();
    if (!code) return;
    setValidatingPromo(true);
    setPromoError(null);
    try {
      const { data, error } = await supabase.functions.invoke("validate-promo", {
        body: { code, subtotal },
      });
      if (error) throw error;
      if (data?.valid) {
        setPromoApplied({
          code: data.code,
          discount: data.discount,
          kind: data.kind,
          value: data.value,
          starts_at: data.starts_at ?? null,
          expires_at: data.expires_at ?? null,
          min_order_amount: data.min_order_amount ?? 0,
        });
        toast.success(`Code ${data.code} appliqué — ${data.discount.toLocaleString()} FCFA`);
      } else {
        setPromoApplied(null);
        setPromoError(data?.reason ?? "Code promo invalide");
        toast.error(data?.reason ?? "Code promo invalide");
      }
    } catch (err: any) {
      setPromoError(err?.message ?? "Validation impossible");
      toast.error("Validation impossible", { description: err?.message });
    } finally {
      setValidatingPromo(false);
    }
  };

  const removePromo = () => {
    setPromoApplied(null);
    setPromoCode("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Email invalide");
      return;
    }
    if (items.length === 0) {
      toast.error("Votre panier est vide");
      return;
    }

    setProcessing(true);
    try {
      // Translate client slugs → DB UUIDs
      const slugs = items.map((i) => i.product.id);
      const slugMap = await fetchProductIdsBySlugs(slugs);
      const cartLines = items.map((i) => {
        const productUuid = slugMap.get(i.product.id);
        if (!productUuid) throw new Error(`Produit indisponible: ${i.product.name}`);
        return {
          product_id: productUuid,
          quantity: i.quantity,
          duration: i.duration ?? null,
          tier_id: i.tier?.id ?? null,
        };
      });

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          email,
          phone,
          name,
          items: cartLines,
          return_origin: window.location.origin,
          promo_code: promoApplied?.code ?? null,
        },
      });

      // Server error responses (4xx/5xx) include a JSON body with `error` field.
      // Extract it for a precise toast message.
      const serverError = (data as any)?.error;
      if (error || serverError) {
        const response = error?.context;
        const errorBody = response instanceof Response ? await response.json().catch(() => null) : null;
        const message = serverError || errorBody?.error || error?.message || "Réessayez dans un instant.";
        throw new Error(message);
      }
      const { payment_url, order_id, free_order } = data ?? {};
      if (!order_id || (!free_order && !payment_url)) {
        throw new Error("Réponse de paiement invalide");
      }

      // Empty the cart (stock will be definitively decremented by the webhook on success)
      clear(false);

      if (free_order) {
        // Promo covered the whole cart: no payment needed, go straight to the order page.
        toast.success("Commande validée — aucun paiement requis 🎉");
        navigate(`/order/${order_id}`);
        return;
      }

      // Redirect to PayDunya hosted checkout
      window.location.href = payment_url;
    } catch (err: any) {
      console.error(err);
      toast.error("Paiement impossible", {
        description: err?.message ?? "Réessayez dans un instant.",
      });
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar search={search} onSearch={setSearch} />

      <main className="flex-1 container mx-auto px-4 py-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Continuer mes achats
        </Link>

        <h1 className="font-display font-extrabold text-3xl md:text-4xl mb-8">
          Finaliser ma commande
        </h1>

        {items.length === 0 ? (
          <div className="rounded-xl border border-primary/15 bg-surface p-12 text-center">
            <p className="text-muted-foreground mb-4">Votre panier est vide.</p>
            <Button
              onClick={() => navigate("/")}
              className="bg-primary text-primary-foreground hover:bg-gold hover:text-gold-foreground"
            >
              Voir les produits
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid lg:grid-cols-[1fr_400px] gap-8">
            <div className="space-y-8 order-2 lg:order-1">
              <section className="rounded-xl border border-primary/15 bg-surface p-5">
                <h2 className="font-display font-bold text-lg mb-1">1. Vos coordonnées</h2>
                <p className="text-xs text-muted-foreground mb-4">
                  Vos clés et la confirmation seront envoyées à cette adresse.
                </p>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nom (optionnel)"
                    className="w-full h-11 px-4 rounded-md bg-background border border-primary/20 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                  />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.com"
                    className="w-full h-11 px-4 rounded-md bg-background border border-primary/20 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                  />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Téléphone WhatsApp (+226...)"
                    className="w-full h-11 px-4 rounded-md bg-background border border-primary/20 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </section>

              <section className="rounded-xl border border-primary/15 bg-surface p-5">
                <h2 className="font-display font-bold text-lg mb-1">2. Paiement sécurisé</h2>
                <p className="text-xs text-muted-foreground mb-4 inline-flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Vous serez redirigé vers PayDunya
                </p>
                <div className="rounded-lg border border-primary/20 bg-background p-4 flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-success shrink-0 mt-0.5" />
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    Choisissez un moyen de paiement disponible sur PayDunya.
                    Confirmation automatique après validation du paiement, puis livraison par email.
                  </div>
                </div>
              </section>

              {!paymentLoading && !paymentReady && <p role="status" className="text-sm text-destructive">Les paiements sont temporairement indisponibles. Vous pouvez conserver votre panier et revenir plus tard.</p>}
              {items.some((item) => item.product.id.startsWith("digitrust-")) && <p role="status" className="text-sm text-muted-foreground">Certaines offres sont livrées après traitement par notre fournisseur. Un délai peut s’appliquer après paiement ; contactez-nous sur WhatsApp pour le suivi.</p>}
              <Button
                type="submit"
                disabled={processing || paymentLoading || (grandTotal > 0 && !paymentReady)}
                className="w-full min-h-12 h-auto py-3 whitespace-normal bg-primary text-primary-foreground hover:bg-gold hover:text-gold-foreground font-bold text-sm sm:text-base disabled:opacity-60"
              >
                {processing ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> {grandTotal === 0 ? "Validation de la commande…" : "Redirection vers PayDunya…"}
                  </span>
                ) : grandTotal === 0 ? (
                  <>Valider ma commande — 0 F</>
                ) : (
                  <>Payer {formatFCFA(grandTotal)} avec PayDunya</>
                )}
              </Button>
            </div>

            {/* Récapitulatif */}
            <aside className="min-w-0 order-1 lg:order-2">
              <div className="rounded-xl border border-primary/20 bg-surface p-5 lg:sticky lg:top-24">
                <h2 className="font-display font-bold text-lg mb-4">Récapitulatif</h2>
                <ul className="space-y-3 max-h-80 overflow-y-auto">
                  {items.map((item) => (
                    <li
                      key={item.product.id + (item.duration ?? "")}
                      className="grid grid-cols-[3.5rem_minmax(0,1fr)] sm:flex gap-3 pb-3 border-b border-primary/10 last:border-0"
                    >
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                        className="w-14 h-14 rounded-md object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold line-clamp-2 leading-tight">
                          {item.product.name}
                        </p>
                        {item.duration && (
                          <p className="text-[11px] text-muted-foreground">{item.duration}</p>
                        )}
                        <p className="text-xs text-muted-foreground">× {item.quantity}</p>
                      </div>
                      <p className="col-start-2 text-sm font-bold text-primary sm:shrink-0">
                        {formatFCFA(item.product.price * item.quantity)}
                      </p>
                    </li>
                  ))}
                </ul>

                <div className="border-t border-primary/15 pt-4 mt-4 space-y-3">
                  {/* Code promo */}
                  <div>
                    {promoApplied ? (
                      <div className="rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-success">{promoApplied.code}</span>
                          <button type="button" onClick={removePromo} className="text-xs text-muted-foreground hover:text-destructive">
                            Retirer
                          </button>
                        </div>
                        <ul className="text-[11px] text-muted-foreground space-y-0.5">
                          {promoApplied.kind && promoApplied.value != null && (
                            <li>
                              Réduction :{" "}
                              <span className="text-foreground font-semibold">
                                {promoApplied.kind === "percent"
                                  ? `${promoApplied.value}%`
                                  : `${promoApplied.value.toLocaleString("fr-FR")} FCFA`}
                              </span>
                            </li>
                          )}
                          {promoApplied.min_order_amount ? (
                            <li>
                              Panier min. :{" "}
                              <span className="text-foreground">
                                {promoApplied.min_order_amount.toLocaleString("fr-FR")} FCFA
                              </span>
                            </li>
                          ) : null}
                          {promoApplied.starts_at && (
                            <li>
                              Valable depuis le{" "}
                              {new Date(promoApplied.starts_at).toLocaleDateString("fr-FR")}
                            </li>
                          )}
                          {promoApplied.expires_at && (
                            <li>
                              Expire le{" "}
                              <span className="text-foreground">
                                {new Date(promoApplied.expires_at).toLocaleDateString("fr-FR")}
                              </span>
                            </li>
                          )}
                        </ul>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex gap-2">
                          <input
                            value={promoCode}
                            onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoError(null); }}
                            placeholder="Code promo"
                            className="min-w-0 w-full flex-1 h-10 px-3 rounded-md bg-background border border-primary/20 text-sm font-mono uppercase placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={validatingPromo || !promoCode.trim()}
                            onClick={applyPromo}
                            className="border-primary/30"
                          >
                            {validatingPromo ? "…" : "Appliquer"}
                          </Button>
                        </div>
                        {promoError && (
                          <p className="text-[11px] text-destructive">⚠ {promoError}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sous-total</span>
                    <span className="text-foreground">{formatFCFA(subtotal)}</span>
                  </div>
                  {promoApplied && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Réduction</span>
                      <span className="text-success font-semibold">−{formatFCFA(promoApplied.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Livraison</span>
                    <span className="text-success font-semibold">Gratuite</span>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-between items-baseline pt-2 border-t border-primary/10">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="text-2xl font-extrabold text-primary neon-orange">
                      {formatFCFA(grandTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          </form>
        )}
      </main>

      <Footer />
      <WhatsAppFab />
    </div>
  );
};

export default Checkout;
