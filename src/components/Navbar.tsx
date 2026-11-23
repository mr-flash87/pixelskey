import { ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import { useCart } from "@/store/cart";
import { SearchAutocomplete } from "./SearchAutocomplete";

interface NavbarProps {
  search: string;
  onSearch: (v: string) => void;
}

export const Navbar = ({ search, onSearch }: NavbarProps) => {
  const { open, count } = useCart();
  const cartCount = count();

  return (
    <header className="sticky top-0 z-40 bg-background shadow-sm">
      <div className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between gap-4 text-[11px] sm:text-xs font-bold uppercase tracking-wide">
          <span className="truncate">Paiement Mobile Money : Orange Money · Wave · MTN · Moov — Livraison instantanée</span>
          <Link to="/admin/login" className="hidden sm:inline shrink-0 hover:underline">Connexion</Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-3 sm:py-5 flex items-center gap-4">
        <Link to="/" className="flex items-center shrink-0" aria-label="Pixels Key — Accueil">
          <img src="/logo.png" alt="Pixels Key" width={200} height={60} className="h-10 sm:h-14 w-auto object-contain" />
        </Link>

        <SearchAutocomplete value={search} onChange={onSearch} placeholder="Rechercher dans la boutique..." className="flex-1 max-w-sm ml-auto hidden md:block" />

        <button onClick={open} className="flex items-center gap-2 ml-auto md:ml-4 text-primary" aria-label="Ouvrir le panier">
          <span className="relative">
            <ShoppingBag className="h-8 w-8" strokeWidth={1.6} />
            {cartCount > 0 && (
              <span key={cartCount} className="absolute -top-1 -right-1.5 bg-promo text-promo-foreground text-[10px] font-bold rounded-full h-5 min-w-5 px-1 flex items-center justify-center animate-in zoom-in duration-200">
                {cartCount}
              </span>
            )}
          </span>
          <span className="hidden sm:flex flex-col text-left leading-tight">
            <span className="text-sm font-bold uppercase">Mon panier</span>
            <span className="text-sm">({cartCount} article{cartCount > 1 ? "s" : ""})</span>
          </span>
        </button>
      </div>

      <div className="container mx-auto px-4 pb-3 md:hidden">
        <SearchAutocomplete value={search} onChange={onSearch} placeholder="Rechercher..." />
      </div>
    </header>
  );
};
