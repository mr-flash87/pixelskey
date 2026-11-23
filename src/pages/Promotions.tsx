import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Flame, Clock } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { CartDrawer } from "@/components/CartDrawer";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { useCatalog } from "@/store/catalog";
import { useCategories } from "@/store/categories";
import { useSeo } from "@/lib/useSeo";
import { Button } from "@/components/ui/button";
import { useStock } from "@/store/stock";
import { availableFirst } from "@/lib/catalog-order";

const formatRemaining = (endIso: string | null) => {
  if (!endIso) return "Promo permanente";
  const ms = new Date(endIso).getTime() - Date.now();
  if (ms <= 0) return "Terminée";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  if (d > 0) return `${d}j ${h}h restantes`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m restantes`;
};

const Promotions = () => {
  const [search, setSearch] = useState("");
  const { products, load, loading } = useCatalog();
  const stock = useStock((s) => s.stock);
  const { categories, load: loadCategories } = useCategories();
  useEffect(() => { load(); loadCategories(); }, [load, loadCategories]);

  useSeo({
    title: "Promos Pixels Key — Licences & Abonnements jusqu'à -80%",
    description:
      "Profitez de promos limitées sur ChatGPT Plus, Adobe, Windows, Netflix, Spotify et formations IA. Livraison instantanée par email & WhatsApp.",
    canonical: "/promotions",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: "https://pixelskey.app/" },
        { "@type": "ListItem", position: 2, name: "Promotions", item: "https://pixelskey.app/promotions" },
      ],
    },
  });

  // Sort: ending soonest first; permanent promos last.
  const promos = useMemo(() => {
    return availableFirst(products
      .filter((p) => p.promo)
      .sort((a, b) => {
        const ae = a.promo_end_at ? new Date(a.promo_end_at).getTime() : Infinity;
        const be = b.promo_end_at ? new Date(b.promo_end_at).getTime() : Infinity;
        return ae - be;
      }), stock);
  }, [products, stock]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar search={search} onSearch={setSearch} />

      <main className="flex-1 container mx-auto px-4 py-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Retour à la boutique
        </Link>

        <header className="mb-8 rounded-md overflow-hidden border border-primary/20 bg-card p-6 md:p-10 relative">
          <div className="absolute inset-0 opacity-50 pointer-events-none"
               style={{ background: "var(--gradient-glow)" }} />
          <div className="relative max-w-3xl">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary neon-orange mb-3">
              <Flame className="h-4 w-4" /> Promotions en cours
            </span>
            <h1 className="font-display font-extrabold text-3xl md:text-5xl leading-tight">
              Jusqu'à <span className="text-gradient-brand">-80%</span> sur les meilleures licences
            </h1>
            <p className="mt-3 text-muted-foreground text-base md:text-lg max-w-xl">
              Profitez des offres disponibles avant qu'elles expirent.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild className="bg-primary text-primary-foreground hover:bg-gold hover:text-gold-foreground">
                <Link to="/?filter=promo">Voir avec les filtres complets</Link>
              </Button>
              {categories.slice(0, 3).map((c) => (
                <Button key={c.slug} asChild variant="outline" className="border-primary/30">
                  <Link to={`/c/${c.slug}`}>{c.name}</Link>
                </Button>
              ))}
            </div>
          </div>
        </header>

        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Offres disponibles en premier, puis par fin de promotion.
        </div>

        {loading && promos.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">Chargement…</div>
        ) : promos.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            Aucune promotion active pour le moment. Revenez bientôt 🔥
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
            {promos.map((p) => (
              <div key={p.id} className="flex flex-col">
                <ProductCard product={p} />
                <p className="text-[11px] text-center mt-1 text-primary/80 font-semibold">
                  {formatRemaining(p.promo_end_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
      <CartDrawer />
      <WhatsAppFab />
    </div>
  );
};

export default Promotions;
