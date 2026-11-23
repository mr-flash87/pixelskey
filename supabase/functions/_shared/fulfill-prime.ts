import { prime } from "./primestore.ts";

// Buys supplier items for a paid order (skips items covered by own stock or already delivered).
// deno-lint-ignore no-explicit-any
export async function fulfillPrimeOrder(supabase: any, order_id: string) {
    const { data: order } = await supabase
      .from("orders")
      .select("id, status, customer_email")
      .eq("id", order_id)
      .single();
    if (!order) return { ok: false, error: "Commande introuvable", results: [] };
    if (order.status !== "paid") return { ok: false, error: "Commande non payée", results: [] };

    const { data: items } = await supabase
      .from("order_items")
      .select("id, product_id, quantity, products(id, name, primestore_id, source)")
      .eq("order_id", order_id);

    const results: Array<{ item_id: string; status: string; detail?: string }> = [];

    for (const item of items ?? []) {
      const product = Array.isArray(item.products) ? item.products[0] : item.products;
      const primeId = product?.primestore_id;
      if (!primeId) {
        results.push({ item_id: item.id, status: "skipped", detail: "produit local" });
        continue;
      }

      // Covered by our own stock?
      const { count: ownCount } = await supabase
        .from("license_keys")
        .select("id", { count: "exact", head: true })
        .eq("order_id", order_id)
        .eq("product_id", item.product_id);
      if ((ownCount ?? 0) >= item.quantity) {
        results.push({ item_id: item.id, status: "own_stock" });
        continue;
      }

      // Already fulfilled?
      const { data: existing } = await supabase
        .from("license_deliveries")
        .select("id, status, primestore_order_id")
        .eq("order_item_id", item.id)
        .in("status", ["delivered", "pending"]);
      if (existing?.some((delivery: { status: string }) => delivery.status === "delivered")) {
        results.push({ item_id: item.id, status: "already_delivered" });
        continue;
      }

      try {
        const idemKey = `pixelskey-${order_id}-${item.id}`;
        const pending = existing?.find((delivery: { status: string; primestore_order_id?: string }) => delivery.status === "pending" && delivery.primestore_order_id);
        const rawOrder = pending
          ? await prime.getOrder(pending.primestore_order_id)
          : await prime.createOrder(primeId, item.quantity, idemKey);
        // deno-lint-ignore no-explicit-any
        const primeOrder: any = (rawOrder as any)?.order ?? rawOrder;

        // Delivered items can be an array of strings or objects
        const rawItems = (primeOrder as { items?: unknown }).items;
        const delivered: string[] = [];
        if (Array.isArray(rawItems)) {
          for (const it of rawItems) {
            if (typeof it === "string" && it.trim()) delivered.push(it);
            else if (it && typeof it === "object" && Object.keys(it).length > 0) delivered.push(JSON.stringify(it));
          }
        } else if (typeof rawItems === "string" && rawItems.trim()) {
          delivered.push(rawItems);
        }

        // Drop previous pending/failed attempts for this item before recording the new outcome.
        await supabase.from("license_deliveries").delete().eq("order_item_id", item.id).neq("status", "delivered");
        if (delivered.length === 0) {
          // Order accepted but items not ready — record pending delivery
          await supabase.from("license_deliveries").insert({
            order_item_id: item.id,
            order_id,
            content: "",
            status: "pending",
            primestore_order_id: String(primeOrder.id ?? primeOrder.order_id ?? ""),
          });
          results.push({ item_id: item.id, status: "pending" });
          continue;
        }

        for (const content of delivered) {
          await supabase.from("license_deliveries").insert({
            order_item_id: item.id,
            order_id,
            content,
            status: "delivered",
            primestore_order_id: String(primeOrder.id ?? primeOrder.order_id ?? ""),
          });
        }
        results.push({ item_id: item.id, status: "delivered", detail: `${delivered.length} élément(s)` });
      } catch (e) {
        const msg = e instanceof Error ? e.message : (typeof e === "object" ? JSON.stringify(e) : String(e));
        await supabase.from("license_deliveries").insert({
          order_item_id: item.id,
          order_id,
          content: "",
          status: "failed",
          error: msg,
        });
        results.push({ item_id: item.id, status: "failed", detail: msg });
      }
    }

    const ok = results.every((r) => r.status !== "failed");
    return { ok, results };
}
