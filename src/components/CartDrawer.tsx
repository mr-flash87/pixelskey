import { X, Minus, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useCart } from "@/store/cart";
import { formatFCFA } from "@/data/products";
import { useEffect, useRef } from "react";
import orangeMoney from "@/assets/payments/orange_money.svg.asset.json";
import wave from "@/assets/payments/wave.png.asset.json";
import mtnMomo from "@/assets/payments/mtn_momo.svg.asset.json";
import moovMoney from "@/assets/payments/moov-money-bf.png.asset.json";

const PAYMENT_METHODS = [
  { name: "Orange Money", logo: orangeMoney.url },
  { name: "Wave", logo: wave.url },
  { name: "MTN MoMo", logo: mtnMomo.url },
  { name: "Moov Money", logo: moovMoney.url },
];

export const CartDrawer = () => {
  const { items, isOpen, close, remove, setQty, total } = useCart();
  const navigate = useNavigate();
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    if (isOpen) {
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCheckout = () => {
    close();
    navigate("/checkout");
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50"
        onClick={close}
      />
      <aside className="fixed top-0 right-0 h-full w-full sm:w-[380px] bg-surface border-l border-primary/20 z-50 flex flex-col animate-slide-in shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-primary/15">
          <h2 className="font-display font-bold text-lg">Mon Panier ({items.length})</h2>
          <button
            onClick={close}
            className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-foreground"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-20">
              <p className="text-base">Votre panier est vide</p>
              <p className="text-xs mt-2">Ajoutez vos licences préférées 🔥</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.product.id + (item.duration ?? "")}
                className="flex gap-3 p-3 rounded-lg bg-background border border-primary/10"
              >
                <img
                  src={item.product.image}
                  alt={item.product.name}
                  className="w-16 h-16 object-cover rounded-md shrink-0"
                  loading="lazy"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold line-clamp-2 leading-tight">
                    {item.product.name}
                  </p>
                  {item.duration && (
                    <p className="text-[11px] text-muted-foreground">{item.duration}</p>
                  )}
                  <p className="text-primary font-bold text-sm mt-1">
                    {formatFCFA(item.product.price)}
                  </p>
                </div>
                <div className="flex flex-col items-end justify-between">
                  <button
                    onClick={() => remove(item.product.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Retirer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className="flex items-center gap-1 bg-surface rounded-md border border-primary/15">
                    <button
                      onClick={() => setQty(item.product.id, item.quantity - 1)}
                      className="p-1 hover:text-primary"
                      aria-label="Diminuer"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-xs w-5 text-center">{item.quantity}</span>
                    <button
                      onClick={() => setQty(item.product.id, item.quantity + 1)}
                      className="p-1 hover:text-primary"
                      aria-label="Augmenter"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-primary/15 p-4 space-y-3">
          <div className="flex flex-wrap gap-2 justify-between items-baseline">
            <span className="text-muted-foreground text-sm">Total</span>
            <span className="text-2xl font-extrabold text-primary neon-orange">
              {formatFCFA(total())}
            </span>
          </div>
          <Button
            onClick={handleCheckout}
            disabled={items.length === 0}
            className="w-full bg-primary text-primary-foreground hover:bg-gold hover:text-gold-foreground font-bold h-11"
          >
            Passer la commande
          </Button>
          <div className="pt-2">
            <p className="text-[10px] text-muted-foreground text-center mb-2 uppercase tracking-wider">
              Paiements acceptés
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <span key={m.name} className="flex h-9 items-center justify-center rounded-md border border-border bg-card p-1">
                  <img src={m.logo} alt={m.name} className="h-full w-full object-contain" loading="lazy" />
                </span>
              ))}
              <span className="flex h-9 items-center justify-center rounded-md border border-border bg-card text-[10px] font-bold text-foreground">
                Carte
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
