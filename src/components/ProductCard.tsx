import { ShoppingCart, Check, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Product, formatFCFA, discountPercent } from "@/data/products";
import { useCart } from "@/store/cart";
import { useStock } from "@/store/stock";
import { toast } from "sonner";

interface ProductCardProps {
  product: Product;
}

export const ProductCard = ({ product }: ProductCardProps) => {
  const { add, open } = useCart();
  const remaining = useStock((s) => s.stock[product.id] ?? 0);
  const navigate = useNavigate();
  const discount = discountPercent(product.price, product.oldPrice);
  const inStock = remaining > 0;
  const lowStock = inStock && remaining <= 3;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!inStock) return;
    const ok = add(product);
    if (ok) {
      toast.success("Produit ajouté au panier !", { description: product.name });
    } else {
      toast.error("Stock insuffisant");
    }
  };

  const handleBuy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!inStock) return;
    const ok = add(product);
    if (ok) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      navigate("/checkout");
    }
  };

  return (
    <Link
      to={`/produit/${product.id}`}
      className="product-card group min-w-0 flex flex-col overflow-hidden cursor-pointer shadow-sm hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          width={800}
          height={600}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {discount > 0 && (
          <span className="absolute top-0 left-0 px-2 py-1 bg-promo text-promo-foreground text-xs font-bold">
            -{discount}%
          </span>
        )}
        {!inStock && (
          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
            <span className="kicker text-foreground">Épuisé</span>
          </div>
        )}
      </div>

      <div className="p-3 sm:p-4 flex flex-col flex-1 gap-2">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 kicker text-[10px] text-muted-foreground">
          <span>{product.type}</span>
          {inStock ? (
            lowStock ? (
              <span className="text-promo animate-pulse-warning">Plus que {remaining}</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-success"><Check className="h-3 w-3" /> {remaining} en stock</span>
            )
          ) : (
            <span className="inline-flex items-center gap-1 text-destructive"><X className="h-3 w-3" /> Rupture</span>
          )}
        </div>
        <h3 className="font-display font-bold text-foreground line-clamp-2 leading-tight min-h-[2.5rem] text-[15px] sm:text-base">
          {product.name}
        </h3>
        {product.delivery === "Après traitement fournisseur" && <p className="text-xs text-muted-foreground">Après traitement fournisseur</p>}

        <div className="flex items-baseline gap-2 flex-wrap mt-1">
          <span className="text-lg sm:text-xl font-extrabold text-foreground">
            {formatFCFA(product.price)}
          </span>
          {product.oldPrice > product.price && (
            <span className="text-xs text-muted-foreground line-through">
              {formatFCFA(product.oldPrice)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-[auto_1fr] gap-2 mt-auto pt-2">
          <Button
            onClick={handleAdd}
            disabled={!inStock}
            variant="outline"
            size="icon"
            aria-label="Ajouter au panier"
            className="border-foreground/30 bg-transparent hover:bg-foreground hover:text-background"
          >
            <ShoppingCart className="h-4 w-4" />
          </Button>
          <Button
            onClick={handleBuy}
            disabled={!inStock}
            className="min-w-0 w-full px-2 sm:px-4 bg-primary text-primary-foreground hover:bg-promo hover:text-promo-foreground font-bold uppercase text-xs"
          >
            Acheter
          </Button>
        </div>
      </div>
    </Link>
  );
};
