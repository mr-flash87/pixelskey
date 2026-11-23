import { create } from "zustand";

interface StockState {
  stock: Record<string, number>;
  // Refresh from authoritative stock, subtracting only this customer's cart.
  seed: (incoming: Record<string, number>, reserved?: Record<string, number>) => void;
  decrement: (productId: string, qty: number) => boolean;
  increment: (productId: string, qty: number) => void;
  reset: () => void;
  get: (productId: string) => number;
}

export const useStock = create<StockState>()(
    (set, get) => ({
      stock: {},
      seed: (incoming, reserved = {}) =>
        set(() => {
          const merged: Record<string, number> = {};
          for (const [id, qty] of Object.entries(incoming)) {
            merged[id] = Math.max(0, qty - (reserved[id] ?? 0));
          }
          return { stock: merged };
        }),
      decrement: (id, qty) => {
        const current = get().stock[id] ?? 0;
        if (current < qty) return false;
        set((s) => ({ stock: { ...s.stock, [id]: current - qty } }));
        return true;
      },
      increment: (id, qty) =>
        set((s) => ({
          stock: { ...s.stock, [id]: (s.stock[id] ?? 0) + qty },
        })),
      reset: () => set({ stock: {} }),
      get: (id) => get().stock[id] ?? 0,
    }),
);
