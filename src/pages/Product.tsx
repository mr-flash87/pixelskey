import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Zap, ShoppingCart, Mail, Check, X, AlertTriangle, MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { formatFCFA, discountPercent } from "@/data/products";
import { useCatalog } from "@/store/catalog";
import { useCart } from "@/store/cart";
import { useStock } from "@/store/stock";
import { useSeo } from "@/lib/useSeo";
import { useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const Product = () => {
  const { id } = useParams<{ id: string }>();
  const { products, load, loaded } = useCatalog();
  useEffect(() => { load(); }, [load]);
  const product = products.find((p) => p.slug === id || p.id === id);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { add } = useCart();
  const remaining = useStock((s) => s.stock[id ?? ""] ?? 0);
  const tiers = product?.tiers ?? [];
  const [selectedTierId, setSelectedTierId] = useState<string | undefined>(
    tiers[0]?.id
  );
  // keep selection in sync once product loads
  useEffect(() => {
    if (tiers.length && !selectedTierId) setSelectedTierId(tiers[0].id);
  }, [tiers, selectedTierId]);
  const selectedTier = tiers.find((t) => t.id === selectedTierId);
  const [duration, setDuration] = useState<string | undefined>(
    product?.durations?.[0]
  );
  const [qty, setQty] = useState(1);

  const productUrl = product ? `https://pixelskey.app/produit/${product.slug ?? product.id}` : undefined;
  const productImage = product
    ? (product.image?.startsWith("http") ? product.image : `https://pixelskey.app${product.image}`)
    : undefined;

  useSeo({
    title: product
      ? `${product.name} — Pixels Key`
      : "Produit — Pixels Key",
    description: product
      ? `${product.description.slice(0, 140)} Achetez ${product.name} à ${product.price.toLocaleString("fr-FR")} FCFA, ${product.delivery === "Après traitement fournisseur" ? "livraison après traitement fournisseur" : "livraison numérique"}.`
      : undefined,
    canonical: product ? `/produit/${product.slug ?? product.id}` : undefined,
    type: product ? "product" : "website",
    jsonLd: product
      ? [
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Accueil", item: "https://pixelskey.app/" },
              ...(product.category
                ? [{
                    "@type": "ListItem",
                    position: 2,
                    name: product.category,
                    item: `https://pixelskey.app/c/${product.category}`,
                  }]
                : []),
              {
                "@type": "ListItem",
                position: product.category ? 3 : 2,
                name: product.name,
                item: productUrl,
              },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.name,
            description: product.description,
            image: productImage ? [productImage] : undefined,
            sku: product.id,
            brand: { "@type": "Brand", name: "Pixels Key" },
            category: product.category,
            offers: {
              "@type": "Offer",
              url: productUrl,
              priceCurrency: "XOF",
              price: product.price,
              availability:
                (remaining ?? 0) > 0
                  ? "https://schema.org/InStock"
                  : "https://schema.org/OutOfStock",
              itemCondition: "https://schema.org/NewCondition",
              seller: { "@type": "Organization", name: "Pixels Key" },
            },
          },
        ]
      : undefined,
  });

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar search={search} onSearch={setSearch} />
        <main className="flex-1 container mx-auto px-4 py-20 text-center">
          <h1 className="font-display text-3xl font-bold mb-4">
            {loaded ? "Produit introuvable" : "Chargement…"}
          </h1>
          <Link to="/" className="text-primary hover:underline">
            ← Retour à la boutique
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const inStock = remaining > 0;
  const lowStock = inStock && remaining <= 3;
  const unitPrice = selectedTier?.price ?? product.price;
  const unitOldPrice = selectedTier?.old_price ?? product.oldPrice;
  const discount = discountPercent(unitPrice, unitOldPrice ?? unitPrice);
  const subtotal = unitPrice * qty;
  const savings = ((unitOldPrice ?? unitPrice) - unitPrice) * qty;
  const cartTier = selectedTier
    ? {
        id: selectedTier.id,
        duration: selectedTier.duration,
        label: selectedTier.label,
        price: selectedTier.price,
        old_price: selectedTier.old_price,
      }
    : undefined;

  const handleAdd = () => {
    if (qty > remaining) {
      toast.error(`Seulement ${remaining} en stock`);
      return;
    }
    const ok = add(product, duration, qty, cartTier);
    if (ok) toast.success("Produit ajouté !", { description: product.name });
  };

  const handleBuy = () => {
    if (qty > remaining) {
      toast.error(`Seulement ${remaining} en stock`);
      return;
    }
    const ok = add(product, duration, qty, cartTier);
    if (ok) navigate("/checkout");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar search={search} onSearch={setSearch} />

      <main className="flex-1 container mx-auto px-4 py-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Retour à la boutique
        </Link>

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="relative rounded-md overflow-hidden border border-primary/20 bg-surface aspect-[4/3]">
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 left-3 flex flex-col gap-2">
              <span className="px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-sm font-extrabold neon-orange">
                -{discount}%
              </span>
              <span className="px-2.5 py-1 rounded-md bg-gold text-gold-foreground text-xs font-bold">
                {product.type}
              </span>
            </div>
          </div>

          <div className="min-w-0 flex flex-col gap-5">
            <div>
              <h1 className="font-display font-extrabold text-3xl md:text-4xl leading-tight">
                {product.name}
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                Livraison : <span className="text-foreground font-semibold">{product.delivery}</span>
              </p>
              {product.delivery === "Après traitement fournisseur" && (
                <p className="mt-3 flex items-start gap-2 border-l-4 border-gold bg-gold/10 p-3 text-sm font-semibold text-foreground">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>La clé est envoyée par notre équipe par e-mail après traitement de votre commande.</span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {inStock ? (
                <span className="px-2.5 py-1 rounded-md bg-success/15 text-success text-xs font-bold inline-flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" /> En stock — {remaining} disponible{remaining > 1 ? "s" : ""}
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-md bg-destructive/15 text-destructive text-xs font-bold inline-flex items-center gap-1">
                  <X className="h-3.5 w-3.5" /> Rupture de stock
                </span>
              )}
              {lowStock && (
                <span className="text-xs text-primary font-semibold inline-flex items-center gap-1 animate-pulse-warning">
                  <AlertTriangle className="h-3.5 w-3.5" /> Stock limité !
                </span>
              )}
            </div>

             <p className="max-w-full whitespace-pre-line [overflow-wrap:anywhere] text-muted-foreground leading-relaxed">{product.description}</p>

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {unitOldPrice && unitOldPrice > unitPrice && (
                <span className="text-base text-muted-foreground line-through">
                  {formatFCFA(unitOldPrice)}
                </span>
              )}
              <span className="text-3xl sm:text-4xl font-extrabold text-primary neon-orange">
                {formatFCFA(unitPrice)}
              </span>
              {selectedTier && (
                <span className="text-xs text-muted-foreground">/ {selectedTier.label}</span>
              )}
            </div>

            {tiers.length > 0 ? (
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                  Choisir la durée
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {tiers.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTierId(t.id)}
                      className={cn(
                        "rounded-lg p-3 border text-left transition",
                        selectedTierId === t.id
                          ? "bg-primary/10 border-primary text-foreground"
                          : "bg-surface border-primary/20 text-muted-foreground hover:border-primary"
                      )}
                    >
                      <div className="text-sm font-bold">{t.label}</div>
                      <div className={cn(
                        "text-base font-extrabold mt-0.5",
                        selectedTierId === t.id ? "text-primary" : "text-foreground"
                      )}>
                        {formatFCFA(t.price)}
                      </div>
                      {t.old_price && t.old_price > t.price && (
                        <div className="text-[10px] text-muted-foreground line-through">
                          {formatFCFA(t.old_price)}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ) : product.durations ? (
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                  Durée
                </label>
                <div className="flex gap-2 flex-wrap">
                  {product.durations.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={cn(
                        "px-4 py-2 rounded-md text-sm border transition",
                        duration === d
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-surface border-primary/20 text-muted-foreground hover:border-primary"
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                Quantité
              </label>
              <div className="inline-flex items-center bg-background border border-primary/20 rounded-md">
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="px-4 py-2 hover:text-primary text-lg"
                >
                  −
                </button>
                <span className="px-4 font-semibold min-w-[2rem] text-center">{qty}</span>
                <button
                  onClick={() => setQty(Math.min(remaining || 1, qty + 1))}
                  className="px-4 py-2 hover:text-primary text-lg"
                >
                  +
                </button>
              </div>
            </div>

            {/* Récapitulatif prix/durée/quantité */}
            <div className="rounded-xl border border-primary/20 bg-surface p-4 space-y-2">
              <h3 className="font-display font-bold text-sm uppercase tracking-wider text-muted-foreground">
                Récapitulatif
              </h3>
              <div className="flex justify-between gap-4 text-sm">
                <span className="shrink-0 text-muted-foreground">Produit</span>
                <span className="min-w-0 text-foreground font-medium text-right">{product.name}</span>
              </div>
              {duration && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Durée</span>
                  <span className="text-foreground font-medium">{duration}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Quantité</span>
                <span className="text-foreground font-medium">× {qty}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Économie</span>
                <span className="text-success font-bold">−{formatFCFA(savings)}</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-primary/10">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-2xl font-extrabold text-primary neon-orange">
                  {formatFCFA(subtotal)}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={handleAdd}
                disabled={!inStock}
                className="flex-1 border-primary/50 text-primary hover:bg-gold hover:text-gold-foreground hover:border-gold h-11"
              >
                <ShoppingCart className="h-4 w-4 mr-2" /> Ajouter au panier
              </Button>
              <Button
                onClick={handleBuy}
                disabled={!inStock}
                className="flex-1 bg-primary text-primary-foreground hover:bg-gold hover:text-gold-foreground font-bold h-11"
              >
                <Zap className="h-4 w-4 mr-2" /> Acheter maintenant
              </Button>
            </div>

            <div className="flex flex-col gap-2 pt-3 border-t border-primary/10">
              <p className="text-xs text-muted-foreground inline-flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-gold" />
                {product.delivery === "Après traitement fournisseur" ? "Envoi par notre équipe après traitement de la commande" : "Clé envoyée par email après paiement"}
              </p>
              <p className="text-xs text-muted-foreground inline-flex items-center gap-2">
                <MessageCircle className="h-3.5 w-3.5 text-success" />
                Confirmation et support sur WhatsApp
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
      <CartDrawer />
      <WhatsAppFab />
    </div>
  );
};

export default Product;
