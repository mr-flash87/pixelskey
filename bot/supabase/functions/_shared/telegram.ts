// Client minimal de l'API Bot Telegram (HTML parse_mode).
import { env } from "./env.ts";

export type InlineButton = { text: string; callback_data?: string; url?: string };
export type Keyboard = InlineButton[][];

export interface TgUser { id: number; username?: string; first_name?: string; language_code?: string }
export interface TgChat { id: number; type: string; title?: string; username?: string }
export interface TgMessage { message_id: number; chat: TgChat; from?: TgUser; text?: string }
export interface TgChatMemberUpdate { chat: TgChat; from: TgUser; new_chat_member: { status: string; user: TgUser } }
export interface TgCallback { id: string; from: TgUser; message?: TgMessage; data?: string }
export interface TgUpdate { update_id: number; message?: TgMessage; callback_query?: TgCallback; my_chat_member?: TgChatMemberUpdate }

export class TelegramError extends Error {
  constructor(public code: number, message: string) { super(message); }
}

async function call<T = unknown>(method: string, payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${env("TELEGRAM_BOT_TOKEN")}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new TelegramError(data.error_code ?? res.status, String(data.description ?? "Erreur Telegram"));
  return data.result as T;
}

const markup = (keyboard?: Keyboard) => keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {};

export const tg = {
  send: (chatId: number, text: string, keyboard?: Keyboard) =>
    call<TgMessage>("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", link_preview_options: { is_disabled: true }, ...markup(keyboard) }),
  /** Modifie le message du menu ; si impossible (trop ancien, identique…), envoie un nouveau message. */
  async edit(chatId: number, messageId: number | undefined, text: string, keyboard?: Keyboard) {
    if (messageId) {
      try {
        return await call("editMessageText", { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML", link_preview_options: { is_disabled: true }, ...markup(keyboard) });
      } catch (e) {
        if (e instanceof TelegramError && e.message.includes("message is not modified")) return;
      }
    }
    return tg.send(chatId, text, keyboard);
  },
  answer: (callbackId: string, text?: string, alert = false) =>
    call("answerCallbackQuery", { callback_query_id: callbackId, ...(text ? { text, show_alert: alert } : {}) }).catch(() => undefined),
  setWebhook: (url: string, secret: string) =>
    call("setWebhook", { url, secret_token: secret, allowed_updates: ["message", "callback_query", "my_chat_member"], drop_pending_updates: false }),
  setCommands: (commands: { command: string; description: string }[]) => call("setMyCommands", { commands }),
  getMe: () => call<{ id: number; username: string }>("getMe", {}),
  getChatMember: (chatId: number | string, userId: number) =>
    call<{ status: string; is_member?: boolean }>("getChatMember", { chat_id: chatId, user_id: userId }),
  exportInviteLink: (chatId: number | string) => call<string>("exportChatInviteLink", { chat_id: chatId }),
};

let cachedUsername: string | null = null;
/** Nom réel du bot, demandé à Telegram (jamais un réglage saisi à la main, qui pourrait être faux). */
export async function botUsername(): Promise<string> {
  cachedUsername ??= (await tg.getMe()).username;
  return cachedUsername;
}

/** Échappe le texte pour parse_mode HTML. */
export const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Montant XOF lisible : 5000 → "5 000 F". */
export const fcfa = (n: number) => `${Math.round(n).toLocaleString("fr-FR").replace(/[\u202f\u00a0]/g, " ")} F`;
