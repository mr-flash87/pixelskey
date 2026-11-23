import { Search, X, Flame, Tag } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatFCFA } from "@/data/products";
import { useCatalog } from "@/store/catalog";
import { useStock } from "@/store/stock";
import { cn } from "@/lib/utils";

const CATEGORY_SHORTCUTS: { slug: string; label: string; keywords: string[] }[] = [
  { slug: "ia-chatgpt", label: "IA & ChatGPT", keywords: ["ia", "ai", "chatgpt", "gpt", "openai", "claude", "midjourney"] },
  { slug: "cle", label: "Clés & Codes", keywords: ["cle", "clé", "key", "windows", "office", "activation", "licence"] },
  { slug: "digital", label: "Produits Digital", keywords: ["digital", "pack", "template", "pdf", "ebook"] },
  { slug: "formation", label: "Formations", keywords: ["formation", "cours", "tuto", "apprendre"] },
];

interface SearchAutocompleteProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchAutocomplete = ({
  value,
  onChange,
  placeholder = "Rechercher un produit, une licence, une clé...",
  className,
}: SearchAutocompleteProps) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stock = useStock((s) => s.stock);
  const products = useCatalog((s) => s.products);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.type.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [value, products]);

  const matchedCategories = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return CATEGORY_SHORTCUTS.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.includes(q) || q.includes(k))
    ).slice(0, 3);
  }, [value]);

  const showPromoShortcut = useMemo(() => {
    const q = value.trim().toLowerCase();
    return q.length > 0 && ["promo", "promotion", "solde", "reduc", "réduc", "deal"].some((k) => k.includes(q) || q.includes(k));
  }, [value]);

  const hasAny = suggestions.length > 0 || matchedCategories.length > 0 || showPromoShortcut;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full h-10 pl-10 pr-9 rounded-md bg-surface border border-primary/20 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition"
      />
      {value && (
        <button
          onClick={() => {
            onChange("");
            setOpen(false);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-primary"
          aria-label="Effacer"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {open && hasAny && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-xl bg-surface border border-primary/30 shadow-2xl shadow-black/50 z-50 overflow-hidden">
          {(matchedCategories.length > 0 || showPromoShortcut) && (
            <>
              <p className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-primary/10">
                Aller à
              </p>
              <ul className="border-b border-primary/10">
                {showPromoShortcut && (
                  <li>
                    <Link
                      to="/promotions"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-primary/10 transition"
                    >
                      <Flame className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">Toutes les promotions</span>
                    </Link>
                  </li>
                )}
                {matchedCategories.map((c) => (
                  <li key={c.slug}>
                    <Link
                      to={`/c/${c.slug}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-primary/10 transition"
                    >
                      <Tag className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">
                        Catégorie : {c.label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {suggestions.length > 0 && (
            <>
              <p className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-primary/10">
                {suggestions.length} produit{suggestions.length > 1 ? "s" : ""}
              </p>
              <ul className="max-h-80 overflow-y-auto">
                {suggestions.map((p) => {
                  const remaining = stock[p.id] ?? 0;
                  return (
                    <li key={p.id}>
                      <Link
                        to={`/produit/${p.id}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 p-3 hover:bg-primary/10 transition border-b border-primary/5 last:border-0"
                      >
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-12 h-12 rounded-md object-cover shrink-0"
                          loading="lazy"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground line-clamp-1">
                            {p.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-bold text-primary">
                              {formatFCFA(p.price)}
                            </span>
                            <span className="text-[10px] text-muted-foreground line-through">
                              {formatFCFA(p.oldPrice)}
                            </span>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded shrink-0",
                            remaining > 0
                              ? "bg-success/20 text-success"
                              : "bg-destructive/20 text-destructive"
                          )}
                        >
                          {remaining > 0 ? `${remaining} dispo` : "Rupture"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
};
