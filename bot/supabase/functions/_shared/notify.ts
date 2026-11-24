import { adminIds } from "./env.ts";
import { tg } from "./telegram.ts";

/** Alerte envoyée à chaque administrateur (ADMIN_CHAT_IDS). Ne fait jamais échouer l'appelant. */
export async function notifyAdmins(html: string) {
  await Promise.all(adminIds().map((id) => tg.send(id, html).catch((e) => console.error("admin alert failed", e.message))));
}
