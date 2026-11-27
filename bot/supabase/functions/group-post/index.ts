// Publie le catalogue (services publiés + prix) dans le groupe officiel.
// Déclenché à la main (SQL Editor) : net.http_post vers /group-post avec l'en-tête x-cron-token = settings.cron_token.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const env = (k: string) => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`Secret manquant : ${k}`);
  return v;
};
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fcfa = (n: number) => `${Math.round(n).toLocaleString("fr-FR").replace(/[  ]/g, " ")} F`;
const LINE = "━━━━━━━━━━━━━━━━";

async function tg(method: string, payload: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${env("TELEGRAM_BOT_TOKEN")}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram : ${data.description}`);
  return data.result;
}

Deno.serve(async (req) => {
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const setting = async (key: string) => (await db.from("settings").select("value").eq("key", key).maybeSingle()).data?.value;
  const token = String(await setting("cron_token") ?? "");
  if (!token || req.headers.get("x-cron-token") !== token) return new Response("forbidden", { status: 401 });

  const chatId = Number(await setting("community_chat_id") ?? 0);
  if (!chatId) return Response.json({ ok: false, error: "Aucun groupe officiel enregistré" });

  const { data: products } = await db.from("products").select("id, category, name, price, supplier_id, supplier_available").eq("is_active", true).order("category").order("price");
  const { data: avail } = await db.from("product_availability").select("id, manual_stock, supplier_stock");
  const stock = new Map((avail ?? []).map((a) => [a.id, a]));
  const bot = (await tg("getMe", {})).username as string;

  const byCat = new Map<string, string[]>();
  let total = 0;
  for (const p of products ?? []) {
    const a = stock.get(p.id);
    const inStock = (a?.manual_stock ?? 0) + (p.supplier_id !== "manual" && p.supplier_available ? a?.supplier_stock ?? 0 : 0) > 0;
    const line = `${inStock ? "•" : "⛔"} <a href="https://t.me/${bot}?start=p_${p.id}">${esc(p.name)}</a> — <b>${fcfa(p.price)}</b>`;
    byCat.set(p.category, [...(byCat.get(p.category) ?? []), line]);
    total++;
  }

  const blocks = [...byCat.entries()].sort(([a], [b]) => a.localeCompare(b, "fr")).map(([cat, lines]) => `<b>${esc(cat.toUpperCase())}</b>\n${lines.join("\n")}`);
  const intro = `🛍️ <b>CATALOGUE DIGITAL PASS</b>\n${LINE}\n<b>${total}</b> services premium, livrés <b>automatiquement</b> sur Telegram.\n📱 Paiement Orange Money · Moov Money · Wave\n👉 Touchez un service pour le commander.\n⛔ = rupture momentanée`;
  const messages: string[] = [];
  let cur = intro;
  for (const b of blocks) {
    if ((cur + "\n\n" + b).length > 3800) { messages.push(cur); cur = b; } else cur += "\n\n" + b;
  }
  messages.push(cur);

  for (let i = 0; i < messages.length; i++) {
    const last = i === messages.length - 1;
    await tg("sendMessage", {
      chat_id: chatId, text: messages[i], parse_mode: "HTML", link_preview_options: { is_disabled: true },
      ...(last ? { reply_markup: { inline_keyboard: [[{ text: "🛒 Commander sur le bot", url: `https://t.me/${bot}` }]] } } : {}),
    });
  }
  return Response.json({ ok: true, messages: messages.length, services: total });
});
