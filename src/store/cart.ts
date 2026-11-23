import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/data/products";
import { useStock } from "./stock";

export interface CartTier {
  id: string;
  duration: string;
  label: string;
  price: number;
  old_price?: number | null;
}

export interface CartItem {
  product: Product;
  quantity: number;
  duration?: string;        // human label kept for display compatibility
  tier?: CartTier;          // selected tier (optional — only for tiered products)
  unitPrice?: number;       // resolved unit price (tier price if any, else product.price)
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  add: (product: Product, duration?: string, quantity?: number, tier?: CartTier) => boolean;
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clear: (restoreStock?: boolean) => void;
  total: () => number;
  count: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      add: (product, duration, quantity = 1, tier) => {
        const ok = useStock.getState().decrement(product.id, quantity);
        if (!ok) return false;
        const unitPrice = tier?.price ?? product.price;
        const dur = tier?.label ?? duration;
        const key = tier?.id ?? duration;
        set((s) => {
          const existing = s.items.find(
            (i) => i.product.id === product.id && (i.tier?.id ?? i.duration) === key
          );
          if (existing) {
            return {
              items: s.items.map((i) =>
                i === existing ? { ...i, quantity: i.quantity + quantity } : i
              ),
            };
          }
          return { items: [...s.items, { product, quantity, duration: dur, tier, unitPrice }] };
        });
        return true;
      },
      remove: (id) => {
        const item = get().items.find((i) => i.product.id === id);
        if (item) useStock.getState().increment(id, item.quantity);
        set((s) => ({ items: s.items.filter((i) => i.product.id !== id) }));
      },
      setQty: (id, qty) => {
        const item = get().items.find((i) => i.product.id === id);
        if (!item) return;
        const diff = qty - item.quantity;
        if (diff > 0) {
          const ok = useStock.getState().decrement(id, diff);
          if (!ok) return;
        } else if (diff < 0) {
          useStock.getState().increment(id, -diff);
        }
        set((s) => ({
          items: s.items
            .map((i) => (i.product.id === id ? { ...i, quantity: qty } : i))
            .filter((i) => i.quantity > 0),
        }));
      },
      clear: (restoreStock = false) => {
        if (restoreStock) {
          get().items.forEach((i) =>
            useStock.getState().increment(i.product.id, i.quantity)
          );
        }
        set({ items: [] });
      },
      total: () =>
        get().items.reduce((sum, i) => sum + (i.unitPrice ?? i.product.price) * i.quantity, 0),
      count: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: "pixels-key-cart", partialize: (s) => ({ items: s.items }) }
  )
);
