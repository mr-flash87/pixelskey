// Cron-triggered: cart abandonment reminders for pending (unpaid) orders.
// Sends up to 3 reminders via Brevo: ~24h, ~48h, ~72h after order creation.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_TOKEN = Deno.env.get("CART_REMINDER_CRON_TOKEN");
const SENDER = { name: "Pixels Key", email: Deno.env.get("BREVO_SENDER_EMAIL") ?? Deno.env.get("ADMIN_NOTIFICATION_EMAIL") ?? "cesarapplestore@gmail.com" };
const SITE_ORIGIN = Deno.env.get("SITE_URL") ?? "https://pixelskey.app";
const MAX_REMINDERS = 3;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fmt = (n: number) => `${n.toLocaleString("fr-FR").replace(/,/g, " ")} FCFA`;

const buildEmail = (opts: {
  name?: string | null;
  reference: string;
  items: { product_name: string; quantity: number; unit_price: number }[];
  amount: number;
  reminderNo: number;
}) => {
  const greeting = opts.name ? `Bonjour ${escapeHtml(opts.name)}` : "Bonjour";
  const rows = opts.items
    .map(
      (i) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(i.product_name)} × ${i.quantity}</td>` +
        `<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${fmt(i.unit_price * i.quantity)}</td></tr>`,
    )
    .join("");
  const urgency =
    opts.reminderNo >= 3
      ? `<p style="color:#b91c1c;font-weight:bold;">Dernier rappel : votre commande sera automatiquement annulée si elle reste impayée.</p>`
      : "";
  return `<!DOCTYPE html><html lang="fr"><body style="margin:0;background:#ffffff;font-family:Arial,sans-serif;color:#1e293b;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <h1 style="font-size:20px;color:#0f172a;">Pixels Key</h1>
    <p>${greeting},</p>
    <p>Vous avez laissé une commande en attente sur Pixels Key (référence <strong>${escapeHtml(opts.reference)}</strong>). Elle vous attend :</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}
      <tr><td style="padding:10px 12px;font-weight:bold;">Total</td>
      <td style="padding:10px 12px;font-weight:bold;text-align:right;">${fmt(opts.amount)}</td></tr>
    </table>
    ${urgency}
    <p style="text-align:center;margin:28px 0;">
      <a href="${SITE_ORIGIN}/order/${opts.reference}" style="background:#ff4d00;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;display:inline-block;">Finaliser ma commande</a>
    </p>
    <p style="font-size:13px;color:#64748b;">Paiement par Orange Money, Wave, MTN MoMo, Moov Money ou carte bancaire. Livraison instantanée après paiement.</p>
    <p style="font-size:13px;color:#64748b;">Une question ? Répondez à cet email ou contactez-nous sur WhatsApp au +226 68 88 06 72.</p>
  </div></body></html>`;
};

const sendViaBrevo = async (to: string, subject: string, html: string) => {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": BREVO_API_KEY! },
    body: JSON.stringify({
      sender: SENDER,
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!r.ok) throw new Error(`Brevo ${r.status}: ${await r.text()}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Cron-only: shared secret token stored in the database vault
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_TOKEN || auth !== `Bearer ${CRON_TOKEN}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE_ROLE_KEY!);

  // Hourly supplier catalogue sync piggybacks on this working cron token
  // (the legacy service-key cron is rejected since the key format changed).
  const syncPromise = Promise.all(["sync-primestore-catalog", "sync-digitrust-catalog"].map((functionName) => fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/${functionName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CRON_TOKEN}` },
    body: "{}",
  }).then(async (r) => console.log(functionName, r.status, (await r.text()).slice(0, 300)))
    .catch((e) => console.error(functionName, "failed", e))));
  // @ts-ignore EdgeRuntime is available in Supabase edge runtime
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(syncPromise);

  try {
    const now = Date.now();
    // Pending orders created between 24h and 96h ago
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, reference, customer_email, customer_name, amount, created_at, reminder_sent_at, metadata")
      .eq("status", "pending")
      .lte("created_at", new Date(now - 24 * 3600 * 1000).toISOString())
      .gte("created_at", new Date(now - 96 * 3600 * 1000).toISOString())
      .limit(100);

    if (error) throw error;

    const results: { id: string; ok: boolean; skipped?: boolean; err?: string }[] = [];

    for (const o of orders ?? []) {
      const meta = (o.metadata ?? {}) as Record<string, unknown>;
      const count = typeof meta.cart_reminders === "number" ? meta.cart_reminders : 0;
      if (count >= MAX_REMINDERS) {
        results.push({ id: o.id, ok: true, skipped: true });
        continue;
      }
      // Enforce 24h spacing between reminders
      if (o.reminder_sent_at && now - new Date(o.reminder_sent_at).getTime() < 24 * 3600 * 1000) {
        results.push({ id: o.id, ok: true, skipped: true });
        continue;
      }

      try {
        const { data: items } = await supabase
          .from("order_items")
          .select("product_name, quantity, unit_price")
          .eq("order_id", o.id);

        const reminderNo = count + 1;
        const subject =
          reminderNo >= 3
            ? `Dernier rappel : votre commande ${o.reference} vous attend`
            : `Votre commande ${o.reference} vous attend — Pixels Key`;

        await sendViaBrevo(
          o.customer_email,
          subject,
          buildEmail({
            name: o.customer_name,
            reference: o.reference,
            items: items ?? [],
            amount: o.amount,
            reminderNo,
          }),
        );

        await supabase
          .from("orders")
          .update({
            reminder_sent_at: new Date().toISOString(),
            metadata: { ...meta, cart_reminders: reminderNo },
          })
          .eq("id", o.id);

        results.push({ id: o.id, ok: true });
      } catch (e) {
        results.push({ id: o.id, ok: false, err: String(e) });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
