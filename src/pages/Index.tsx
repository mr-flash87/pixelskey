import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { FilterTabs, FilterKey, FilterDef, TypeKey, TypeDef } from "@/components/FilterTabs";
import { ProductCard } from "@/components/ProductCard";
import { CartDrawer } from "@/components/CartDrawer";
import { TrustBanner } from "@/components/TrustBanner";
import { Footer } from "@/components/Footer";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { type Product, formatFCFA, discountPercent } from "@/data/products";
import { useCatalog } from "@/store/catalog";
import { useStock } from "@/store/stock";
import banner from "@/assets/banner-home.jpg";
import { useSeo } from "@/lib/useSeo";
import { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { availableFirst } from "@/lib/catalog-order";

const PAGE_SIZE = 8;

const Index = () => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [typeFilter, setTypeFilter] = useState<TypeKey>("all");
  const [page, setPage] = useState(1);
  const stock = useStock((s) => s.stock);
  const { products, load, loading } = useCatalog();

  useSeo({
    title: "Pixels Key — Licences & Abonnements Premium en Afrique",
    description:
      "Windows, Adobe, ChatGPT Plus, Netflix, Spotify, formations IA jusqu'à -80%. Livraison instantanée par email & WhatsApp. Paiement Mobile Money.",
    canonical: "/",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Pixels Key",
        url: "https://pixelskey.app/",
        logo: "https://pixelskey.app/favicon.png",
        sameAs: ["https://pixelskey.app"],
        contactPoint: [
          {
            "@type": "ContactPoint",
            contactType: "customer support",
            availableLanguage: ["French"],
            areaServed: ["BF", "CI", "SN", "ML", "TG", "BJ", "NE", "CM", "FR"],
          },
        ],
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Pixels Key",
        url: "https://pixelskey.app/",
        potentialAction: {
          "@type": "SearchAction",
          target: "https://pixelskey.app/?q={search_term_string}",
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Accueil",
            item: "https://pixelskey.app/",
          },
        ],
      },
    ],
  });

  useEffect(() => { load(); }, [load]);

  // Match a product against the active type tab.
  const matchType = (p: Product, t: TypeKey) => {
    if (t === "all") return true;
    return p.type === t;
  };

  // Match a product against a category (by slug or name, case-insensitive)
  const matchCategory = (p: Product, key: string) => {
    const c = (p.category ?? "").toLowerCase();
    return c === key.toLowerCase();
  };

  // Filtre combiné : recherche + onglet actif + type
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return availableFirst(products.filter((p) => {
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q);
      if (!matchSearch) return false;
      if (!matchType(p, typeFilter)) return false;
      const remaining = stock[p.id] ?? 0;
      switch (filter) {
        case "all": return true;
        case "stock": return remaining > 0;
        case "promo": return p.promo;
        default: return matchCategory(p, filter);
      }
    }), stock);
  }, [products, search, filter, typeFilter, stock]);

  const filters: FilterDef[] = useMemo(() => {
    const matchSearch = (p: Product) => {
      const q = search.trim().toLowerCase();
      return (
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q)
      );
    };
    const base = products.filter((p) => matchSearch(p) && matchType(p, typeFilter));
    const count = (fn: (p: Product) => boolean) => base.filter(fn).length;
    const baseTabs: FilterDef[] = [
      { key: "all", label: "Tous", count: base.length },
      { key: "stock", label: "En Stock", count: count((p) => (stock[p.id] ?? 0) > 0) },
      { key: "promo", label: "Promotions 🔥", count: count((p) => p.promo) },
    ];
    return baseTabs;
  }, [products, search, stock, typeFilter]);

  const types: TypeDef[] = useMemo(() => {
    const c = (fn: (p: Product) => boolean) => products.filter(fn).length;
    return [
      { key: "all", label: "Tous", count: products.length },
      { key: "DIGITAL", label: "Digital", count: c((p) => p.type === "DIGITAL") },
      { key: "CLÉ", label: "Clé", count: c((p) => p.type === "CLÉ") },
      { key: "COMPTE", label: "Compte", count: c((p) => p.type === "COMPTE") },
    ];
  }, [products]);

  const featured = useMemo(
    () => [...products].filter((p) => (stock[p.id] ?? 0) > 0).sort((a, b) => discountPercent(b.price, b.oldPrice) - discountPercent(a.price, a.oldPrice)).slice(0, 4),
    [products, stock],
  );
  const navigate = useNavigate();

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar search={search} onSearch={(v) => { setSearch(v); setPage(1); }} />
      <FilterTabs
        active={filter}
        onChange={(k) => { setFilter(k); setPage(1); }}
        filters={filters}
        activeType={typeFilter}
        onTypeChange={(k) => { setTypeFilter(k); setPage(1); }}
        types={types}
      />

      <main className="flex-1">
        <section className="container mx-auto px-4 pt-4 sm:pt-6">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold leading-tight mb-4">
            Pixels Key — Licences et abonnements premium en Afrique
          </h1>
          <img src={banner} alt="Pixels Key — Produits digitaux premium : IA, logiciels, abonnements" width={1792} height={1008} className="w-full h-auto rounded-sm" />
        </section>

        <section className="container mx-auto px-4 pt-8 pb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <h2 className="section-title">Abonnements & logiciels</h2>
          <span className="text-sm text-muted-foreground shrink-0">{filtered.length} produits</span>
        </section>

        <section className="container mx-auto px-4 pb-12">
          {loading && products.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              Chargement de la boutique…
            </div>
          ) : paginated.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              Aucun produit trouvé pour votre recherche.
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
              {paginated.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex flex-col items-center gap-3 mt-10">
              <div className="flex flex-wrap justify-center items-center gap-2">
                <button
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    setPage((p) => Math.max(1, p - 1));
                  }}
                  disabled={currentPage === 1}
                  className="p-2 rounded-md border border-foreground/20 disabled:opacity-30 hover:border-primary"
                  aria-label="Page précédente"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: totalPages }).map((_, i) => {
                  const n = i + 1;
                  const active = n === currentPage;
                  return (
                    <button
                      key={n}
                      onClick={() => {
                        window.scrollTo({ top: 0, behavior: "smooth" });
                        setPage(n);
                      }}
                      className={`h-9 w-9 rounded-md text-sm font-bold border transition ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-foreground/20 text-muted-foreground hover:border-foreground hover:text-foreground"
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
                <button
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    setPage((p) => Math.min(totalPages, p + 1));
                  }}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-md border border-foreground/20 disabled:opacity-30 hover:border-primary"
                  aria-label="Page suivante"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Page {currentPage} sur {totalPages} — {filtered.length} produits
              </p>
            </div>
          )}
        </section>

        <TrustBanner />
      </main>

      <Footer />
      <CartDrawer />
      <WhatsAppFab />
    </div>
  );
};

export default Index;
