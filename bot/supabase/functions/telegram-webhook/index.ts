// Webhook Telegram : reçoit les messages et les clics sur les boutons.
// Sécurité : Telegram envoie l'en-tête X-Telegram-Bot-Api-Secret-Token défini lors du setWebhook.
import { env, safeEqual } from "../_shared/env.ts";
import { handleUpdate } from "../_shared/bot.ts";
import { tg, type TgUpdate } from "../_shared/telegram.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  if (!safeEqual(req.headers.get("x-telegram-bot-api-secret-token") ?? "", env("TELEGRAM_WEBHOOK_SECRET"))) {
    return new Response("forbidden", { status: 401 });
  }
  const update = await req.json().catch(() => null) as TgUpdate | null;
  if (!update?.update_id) return new Response("ok");
  const work = handleUpdate(update).catch(async (e) => {
    console.error("update failed", update.update_id, e instanceof Error ? e.message : e);
    const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id;
    if (update.callback_query) await tg.answer(update.callback_query.id, "Une erreur est survenue. Réessayez dans un instant.", true);
    else if (chatId) await tg.send(chatId, "⚠️ Une erreur est survenue. Réessayez dans un instant.").catch(() => undefined);
  });
  // Répondre vite à Telegram (sinon il renvoie la mise à jour) et finir le travail en arrière-plan.
  if (typeof EdgeRuntime !== "undefined") { EdgeRuntime.waitUntil(work); return new Response("ok"); }
  await work;
  return new Response("ok");
});
