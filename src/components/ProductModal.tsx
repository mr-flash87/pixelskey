import { useState, useEffect, useRef } from "react";
import { X, Zap, ShoppingCart, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Product, formatFCFA, discountPercent } from "@/data/products";
import { useCart } from "@/store/cart";
import { toast } from "sonner";

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
}

export const ProductModal = ({ product, onClose }: ProductModalProps) => {
  const { add, open } = useCart();
  const [duration, setDuration] = useState<string | undefined>();
  const [qty, setQty] = useState(1);
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (product) {
      setDuration(product.durations?.[0]);
      setQty(1);
      document.body.style.overflow = "hidden";
      // Reset internal modal scroll to top whenever it opens
      requestAnimationFrame(() => {
        modalRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      });
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [product]);

  if (!product) return null;
  const discount = discountPercent(product.price, product.oldPrice);
  const inStock = product.stock > 0;

  const handleAdd = () => {
    add(product, duration, qty);
    toast.success("Produit ajouté !", { description: product.name });
    onClose();
  };

  const handleBuy = () => {
    add(product, duration, qty);
    onClose();
    open();
  };

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative min-w-0 shrink-0 bg-surface border border-primary/30 rounded-md max-w-4xl w-full grid md:grid-cols-2 gap-0 overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-background/80 backdrop-blur hover:bg-primary hover:text-primary-foreground"
          aria-label="Fermer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="aspect-[4/3] md:aspect-auto bg-surface">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="min-w-0 p-4 sm:p-6 md:p-8 flex flex-col gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-1 rounded-md bg-gold text-gold-foreground text-xs font-bold">
              {product.type}
            </span>
            <span className="px-2 py-1 rounded-md bg-primary text-primary-foreground text-xs font-extrabold neon-orange">
              -{discount}% économisés
            </span>
          </div>

          <h2 className="font-display font-bold text-2xl md:text-3xl leading-tight">
            {product.name}
          </h2>

          <p className="max-w-full whitespace-pre-line [overflow-wrap:anywhere] text-muted-foreground text-sm leading-relaxed">
            {product.description}
          </p>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-sm text-muted-foreground line-through">
              {formatFCFA(product.oldPrice)}
            </span>
            <span className="text-3xl font-extrabold text-primary neon-orange">
              {formatFCFA(product.price)}
            </span>
          </div>

          {product.durations && (
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                Durée
              </label>
              <div className="flex gap-2 flex-wrap">
                {product.durations.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`px-3 py-1.5 rounded-md text-sm border transition ${
                      duration === d
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-surface border-primary/20 text-muted-foreground hover:border-primary"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
              Quantité
            </label>
            <div className="inline-flex items-center bg-background border border-primary/20 rounded-md">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="px-3 py-2 hover:text-primary"
              >
                −
              </button>
              <span className="px-4 font-semibold">{qty}</span>
              <button
                onClick={() => setQty(qty + 1)}
                className="px-3 py-2 hover:text-primary"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <Button
              variant="outline"
              onClick={handleAdd}
              disabled={!inStock}
              className="flex-1 border-primary/50 text-primary hover:bg-gold hover:text-gold-foreground hover:border-gold"
            >
              <ShoppingCart className="h-4 w-4 mr-2" /> Ajouter au panier
            </Button>
            <Button
              onClick={handleBuy}
              disabled={!inStock}
              className="flex-1 bg-primary text-primary-foreground hover:bg-gold hover:text-gold-foreground font-bold"
            >
              <Zap className="h-4 w-4 mr-2" /> Acheter maintenant
            </Button>
          </div>

          <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5 pt-2 border-t border-primary/10">
            <Mail className="h-3.5 w-3.5 text-gold" />
            Clé envoyée par email et WhatsApp en quelques minutes
          </p>
        </div>
      </div>
    </div>
  );
};
