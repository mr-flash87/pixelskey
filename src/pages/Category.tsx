import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { CartDrawer } from "@/components/CartDrawer";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { useCatalog } from "@/store/catalog";
import { useCategories, type Category as CategoryType } from "@/store/categories";
import { useSeo } from "@/lib/useSeo";
import { supabase } from "@/integrations/supabase/client";
import { useStock } from "@/store/stock";
import { availableFirst } from "@/lib/catalog-order";

const Category = () => {
  const { slug } = useParams<{ slug: string }>();
  const [search, setSearch] = useState("");
  const { products, load } = useCatalog();
  const stock = useStock((s) => s.stock);
  const { categories, load: loadCategories } = useCategories();
  const [fallback, setFallback] = useState<CategoryType | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => { load(); loadCategories(); }, [load, loadCategories]);

  // Lookup category in store; if not present (e.g. inactive but direct URL), fetch directly
  const cat = useMemo<CategoryType | null>(() => {
    return categories.find((c) => c.slug === slug) ?? fallback ?? null;
  }, [categories, slug, fallback]);

  useEffect(() => {
    if (!slug) return;
    if (categories.find((c) => c.slug === slug)) { setResolved(true); return; }
    (async () => {
      const { data } = await supabase
        .from("categories").select("*").eq("slug", slug).maybeSingle();
      setFallback((data ?? null) as CategoryType | null);
      setResolved(true);
    })();
  }, [slug, categories]);

  const filtered = useMemo(() => {
    if (!cat) return [];
    const q = search.trim().toLowerCase();
    return availableFirst(products.filter((p) => {
      // Match by category slug or name (case-insensitive)
      const matchesCat =
        p.category?.toLowerCase() === cat.slug.toLowerCase() ||
        p.category?.toLowerCase() === cat.name.toLowerCase();
      if (!matchesCat) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    }), stock);
  }, [cat, products, search, stock]);

  const categoryUrl = cat ? `https://pixelskey.app/c/${cat.slug}` : undefined;

  useSeo({
    title:
      cat?.meta_title ||
      (cat
        ? `${cat.name} — Licences & Abonnements pas chers | Pixels Key`
        : "Catégorie — Pixels Key"),
    description:
      cat?.meta_description ||
      (cat
        ? `Découvrez tous les produits ${cat.name} sur Pixels Key : prix réduits, livraison instantanée par email & WhatsApp, paiement Mobile Money.`
        : undefined),
    canonical: cat ? `/c/${cat.slug}` : undefined,
    jsonLd: cat
      ? [
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Accueil", item: "https://pixelskey.app/" },
              { "@type": "ListItem", position: 2, name: cat.name, item: categoryUrl },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: cat.name,
            url: categoryUrl,
            description: cat.meta_description || cat.description || undefined,
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: filtered.length,
              itemListElement: filtered.slice(0, 30).map((p, i) => ({
                "@type": "ListItem",
                position: i + 1,
                url: `https://pixelskey.app/produit/${p.slug}`,
                name: p.name,
              })),
            },
          },
        ]
      : undefined,
  });

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

        {!cat && resolved ? (
          <div className="py-20 text-center">
            <h1 className="font-display font-extrabold text-3xl mb-3">Catégorie inconnue</h1>
            <p className="text-muted-foreground mb-4">
              Cette catégorie n'existe pas ou n'est plus active.
            </p>
            <Link to="/" className="text-primary hover:underline">Retour à la boutique</Link>
          </div>
        ) : !cat ? (
          <div className="py-20 text-center text-muted-foreground">Chargement…</div>
        ) : (
          <>
            <header className="mb-8 rounded-md overflow-hidden border border-primary/20 bg-card p-6 md:p-10 relative">
              {cat.image_url && (
                <div
                  className="absolute inset-0 opacity-10 bg-cover bg-center pointer-events-none"
                  style={{ backgroundImage: `url(${cat.image_url})` }}
                />
              )}
              <div className="relative">
                <h1 className="font-display font-extrabold text-3xl md:text-5xl leading-tight">
                  {cat.name}
                </h1>
                {cat.description && (
                  <p className="mt-3 text-muted-foreground text-base md:text-lg max-w-2xl">
                    {cat.description}
                  </p>
                )}
                <div className="mt-3 text-xs text-muted-foreground">
                  {filtered.length} produit{filtered.length > 1 ? "s" : ""} disponible{filtered.length > 1 ? "s" : ""}
                </div>
              </div>
            </header>

            {filtered.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                Aucun produit dans cette catégorie pour le moment.
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
                {filtered.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
      <CartDrawer />
      <WhatsAppFab />
    </div>
  );
};

export default Category;
