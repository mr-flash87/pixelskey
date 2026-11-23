// Cron-triggered: sends a one-time activation reminder ~24h after a paid order
// when the customer has NOT yet viewed their license keys. Sent via Brevo.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { getSecret } from "../_shared/app-secrets.ts";
import { createElement } from "npm:react@18.3.1";
import { renderToStaticMarkup } from "npm:react-dom@18.3.1/server";
import { TEMPLATES } from "../_shared/transactional-email-templates/registry.ts";

let BREVO_API_KEY: string | undefined;
let SENDER = { name: "Pixels Key", email: "cesarapplestore@gmail.com" };

const sendViaBrevo = async (to: string, templateData: Record<string, unknown>) => {
  const entry = TEMPLATES["activation-reminder"];
  const html = renderToStaticMarkup(createElement(entry.component as any, templateData));
  const subject = typeof entry.subject === "function" ? entry.subject(templateData) : entry.subject;
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": BREVO_API_KEY! },
    body: JSON.stringify({
      sender: SENDER,
      to: [{ email: to }],
      subject,
      htmlContent: `<!DOCTYPE html>${html}`,
    }),
  });
  if (!r.ok) throw new Error(`Brevo ${r.status}: ${await r.text()}`);
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SITE_ORIGIN = Deno.env.get("SITE_URL") ?? "https://pixelskey.app";

Deno.serve(async (req) => {
  BREVO_API_KEY = await getSecret("BREVO_API_KEY");
  SENDER = {
    name: (await getSecret("BREVO_SENDER_NAME")) ?? "Pixels Key",
    email: (await getSecret("BREVO_SENDER_EMAIL")) ?? (await getSecret("ADMIN_NOTIFICATION_EMAIL")) ?? "cesarapplestore@gmail.com",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Orders paid between 26h and 24h ago, keys not viewed, reminder not sent
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, reference, customer_email, customer_name, paid_at, keys_viewed_at, reminder_sent_at, status")
      .eq("status", "paid")
      .is("keys_viewed_at", null)
      .is("reminder_sent_at", null)
      .lte("paid_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .gte("paid_at", new Date(Date.now() - 72 * 3600 * 1000).toISOString())
      .limit(50);

    if (error) throw error;

    const results: { id: string; ok: boolean; err?: string }[] = [];

    for (const o of orders ?? []) {
      try {
        await sendViaBrevo(o.customer_email, {
          customer_name: o.customer_name ?? "",
          reference: o.reference,
          order_url: `${SITE_ORIGIN}/order/${o.id}`,
        });
        await supabase
          .from("orders")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("id", o.id);
        results.push({ id: o.id, ok: true });
      } catch (e) {
        results.push({ id: o.id, ok: false, err: String(e) });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("send-activation-reminders error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
