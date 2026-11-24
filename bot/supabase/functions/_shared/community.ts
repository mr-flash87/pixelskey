// Groupe (ou canal) communautaire : adhésion obligatoire pour utiliser le bot + annonces des nouveaux services.
// Activation : un administrateur du bot (ADMIN_CHAT_IDS) ajoute le bot comme administrateur du groupe.
import { db, setting } from "./db.ts";
import { adminIds, optionalEnv } from "./env.ts";
import { notifyAdmins } from "./notify.ts";
import { esc, fcfa, tg, type TgChatMemberUpdate } from "./telegram.ts";

export interface Community { chatId: number; url: string; title: string }

export async function getCommunity(): Promise<Community | null> {
  const chatId = Number(await setting("community_chat_id", 0));
  if (!chatId) return null;
  return { chatId, url: String(await setting("community_url", "")), title: String(await setting("community_title", "notre groupe")) };
}

async function saveSetting(key: string, value: unknown) {
  await db().from("settings").upsert({ key, value });
}

/** Le bot a été ajouté / retiré d'un groupe : active ou désactive la communauté. */
export async function handleMyChatMember(u: TgChatMemberUpdate) {
  if (!["group", "supergroup", "channel"].includes(u.chat.type)) return;
  const status = u.new_chat_member.status;
  const current = await getCommunity();
  if (status === "administrator") {
    if (!adminIds().includes(u.from.id)) return; // seul un admin du bot peut désigner le groupe officiel
    let url = u.chat.username ? `https://t.me/${u.chat.username}` : "";
    if (!url) url = await tg.exportInviteLink(u.chat.id).catch(() => "");
    await saveSetting("community_chat_id", u.chat.id);
    await saveSetting("community_url", url);
    await saveSetting("community_title", u.chat.title ?? "notre groupe");
    await notifyAdmins(
      `✅ <b>Groupe officiel activé : ${esc(u.chat.title ?? u.chat.id)}</b>\n`
      + "• Les clients devront le rejoindre pour utiliser le bot.\n"
      + "• Les nouveaux services y seront annoncés automatiquement.\n"
      + (url ? `Lien : ${esc(url)}` : "⚠️ Lien d'invitation impossible à créer : donnez au bot le droit « Inviter des utilisateurs », puis retirez-le et remettez-le administrateur."),
    );
    return;
  }
  if (current?.chatId === u.chat.id && ["left", "kicked", "member", "restricted"].includes(status)) {
    await saveSetting("community_chat_id", 0);
    await notifyAdmins(`⚠️ Le bot n'est plus administrateur de ${esc(u.chat.title ?? u.chat.id)} : l'adhésion obligatoire et les annonces sont désactivées.`);
  }
}

const MEMBER_STATUSES = ["creator", "administrator", "member"];

/**
 * Vérifie que l'utilisateur est membre du groupe officiel (résultat positif mis en cache 30 min).
 * Retourne true si aucun groupe n'est configuré, ou en cas d'erreur Telegram (on ne bloque pas les ventes pour une panne).
 */
export async function isCommunityMember(telegramId: number, force = false): Promise<boolean> {
  if (adminIds().includes(telegramId)) return true;
  const community = await getCommunity();
  if (!community) return true;
  if (!force) {
    const { data } = await db().from("bot_users").select("member_until").eq("telegram_id", telegramId).maybeSingle();
    if (data?.member_until && Date.parse(data.member_until) > Date.now()) return true;
  }
  let member: boolean;
  try {
    const m = await tg.getChatMember(community.chatId, telegramId);
    member = MEMBER_STATUSES.includes(m.status) || (m.status === "restricted" && m.is_member === true);
  } catch (e) {
    console.error("getChatMember failed", e instanceof Error ? e.message : e);
    return true;
  }
  await db().from("bot_users").update({ member_until: member ? new Date(Date.now() + 30 * 60_000).toISOString() : null }).eq("telegram_id", telegramId);
  return member;
}

export async function joinScreen() {
  const c = await getCommunity();
  return {
    text: "👋 <b>Bienvenue !</b>\n\n"
      + `Pour utiliser le bot, rejoignez d'abord <b>${esc(c?.title ?? "notre groupe")}</b> : nouveautés, promos et disponibilités y sont annoncées en premier.\n\n`
      + "Une fois membre, touchez <b>« ✅ J'ai rejoint »</b>.",
    keyboard: [
      ...(c?.url ? [[{ text: "👉 Rejoindre le groupe", url: c.url }]] : []),
      [{ text: "✅ J'ai rejoint", callback_data: "joined" }],
    ],
  };
}

/**
 * Annonce dans le groupe les services nouvellement publiés et en stock (une seule fois par service).
 * Pour les offres en double (dup_group), le changement de fournisseur n'est pas une nouveauté.
 */
export async function announceNewProducts(): Promise<number> {
  const community = await getCommunity();
  if (!community) return 0;
  const { data: rows, error } = await db().rpc("pending_announcements", { _limit: 10 });
  if (error || !rows?.length) return 0;
  const botUser = optionalEnv("TELEGRAM_BOT_USERNAME") ?? (await tg.getMe()).username;
  let sent = 0;
  for (const p of rows as { id: number; name: string; price: number; category: string; instant: boolean }[]) {
    try {
      await tg.send(community.chatId,
        `🆕 <b>Nouveau service disponible</b>\n\n${esc(p.category)}\n<b>${esc(p.name)}</b>\n💵 <b>${fcfa(p.price)}</b>${p.instant ? "\n⚡ Livraison automatique" : ""}`,
        [[{ text: "🛒 Commander", url: `https://t.me/${botUser}?start=p_${p.id}` }]]);
      await db().rpc("mark_announced", { _product_id: p.id });
      sent++;
    } catch (e) {
      console.error("announce failed", p.id, e instanceof Error ? e.message : e);
      break; // groupe inaccessible ou limite Telegram : on réessaiera au prochain passage
    }
  }
  return sent;
}
