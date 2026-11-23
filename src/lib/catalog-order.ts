// Available offers first, then ascending displayed price; equal prices retain their order.
export function availableFirst<T extends { id: string; price?: number }>(products: readonly T[], stock: Readonly<Record<string, number>>): T[] {
  return [...products].sort((a, b) =>
    Number((stock[b.id] ?? 0) > 0) - Number((stock[a.id] ?? 0) > 0)
    || (a.price ?? 0) - (b.price ?? 0)
  );
}
