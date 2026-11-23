// Sends the order confirmation email (with activation keys) after a successful payment.
// Sent directly through the Brevo API.
//
// CRITICAL: This function NEVER throws and ALWAYS returns 200 with a structured
// JSON response. The caller (webhook) must not crash if email fails — keys are
// already assigned in the DB and visible on the order page. Failures are tracked
// on the order itself (delivery_status / delivery_attempts / delivery_error)
// so the retry job can pick them up later.

import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { createElement } from "npm:react@18.3.1";
import { renderToStaticMarkup } from "npm:react-dom@18.3.1/server";
import { TEMPLATES } from "../_shared/transactional-email-templates/registry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SITE_ORIGIN = Deno.env.get("SITE_URL") ?? "https://pixelskey.app";
// Adresse qui reçoit la notification interne de chaque commande.
const ADMIN_NOTIFICATION_EMAIL = Deno.env.get("ADMIN_NOTIFICATION_EMAIL") ?? "cesarapplestore@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey || req.headers.get("authorization") !== `Bearer ${serviceKey}`) return json({ error: "Accès refusé" }, 403);

  let order_id: string | null = null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Helper: persist failure on the order so the retry job can pick it up.
  const recordFailure = async (errMsg: string) => {
    if (!order_id) return;
    try {
      const { data: cur } = await supabase
        .from("orders")
        .select("delivery_attempts")
        .eq("id", order_id)
        .maybeSingle();
      const attempts = (cur?.delivery_attempts ?? 0) + 1;
      await supabase
        .from("orders")
        .update({
          delivery_status: "failed",
          delivery_attempts: attempts,
          delivery_error: errMsg.slice(0, 1000),
          last_delivery_attempt_at: new Date().toISOString(),
        })
        .eq("id", order_id);
    } catch (e) {
      console.error("recordFailure failed:", e);
    }
  };

  try {
    const body = await req.json().catch(() => ({}));
    const { name, reference, keys } = body;
    order_id = body.order_id ?? null;

    if (!order_id) {
      return json({ ok: false, error: "Bad request" }, 400);
    }
    const { data: paidOrder } = await supabase.from("orders").select("customer_email, status").eq("id", order_id).maybeSingle();
    if (!paidOrder || paidOrder.status !== "paid") return json({ ok: false, error: "Commande non payée" }, 400);
    const email = paidOrder.customer_email;

    // Mark "sending" + bump attempt counter immediately.
    const { data: cur } = await supabase
      .from("orders")
      .select("delivery_attempts")
      .eq("id", order_id)
      .maybeSingle();
    const attemptNo = (cur?.delivery_attempts ?? 0) + 1;
    await supabase
      .from("orders")
      .update({
        delivery_status: "sending",
        delivery_attempts: attemptNo,
        last_delivery_attempt_at: new Date().toISOString(),
        delivery_error: null,
      })
      .eq("id", order_id);

    // Load order + items for the recap
    const { data: order } = await supabase
      .from("orders")
      .select("amount, customer_name, reference")
      .eq("id", order_id)
      .maybeSingle();

    const { data: items } = await supabase
      .from("order_items")
      .select("product_name, quantity, unit_price, duration")
      .eq("order_id", order_id);

    // If keys weren't passed in (retry path), fetch them from DB.
    let resolvedKeys = keys as { product_name: string; license_key: string }[] | undefined;
    if (!resolvedKeys || resolvedKeys.length === 0) {
      const { data: lk } = await supabase
        .from("license_keys")
        .select("license_key, products!inner(name)")
        .eq("order_id", order_id);
      resolvedKeys = (lk ?? []).map((k: any) => ({
        product_name: k.products?.name ?? "",
        license_key: k.license_key,
      }));
      const { data: deliveries } = await supabase.from("license_deliveries").select("content, status, order_items(product_name)").eq("order_id", order_id);
      if ((deliveries ?? []).some(d => d.status !== "delivered")) {
        await recordFailure("Livraison fournisseur à traiter avant l’envoi des clés");
        return json({ ok: false, fallback: true, error: "DELIVERY_PENDING" });
      }
      for (const delivery of deliveries ?? []) {
        const item = Array.isArray(delivery.order_items) ? delivery.order_items[0] : delivery.order_items;
        resolvedKeys.push({ product_name: item?.product_name ?? "Produit", license_key: delivery.content });
      }
    }

    const templateData = {
      customer_name: name || order?.customer_name || "",
      reference: reference || order?.reference || "",
      total: order?.amount ?? 0,
      items: (items ?? []).map((it) => ({
        name: it.product_name,
        quantity: it.quantity,
        unit_price: it.unit_price,
        duration: it.duration ?? null,
      })),
      license_keys: resolvedKeys ?? [],
      order_url: `${SITE_ORIGIN}/order/${order_id}`,
    };

    // Send via Brevo: render the React Email template to HTML, then POST to the Brevo API.
    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    if (!BREVO_API_KEY) {
      await recordFailure("BREVO_API_KEY manquante");
      return json({ ok: false, fallback: true, error: "EMAIL_SEND_FAILED", detail: "BREVO_API_KEY manquante" });
    }
    const SENDER = { name: "Pixels Key", email: Deno.env.get("BREVO_SENDER_EMAIL") ?? ADMIN_NOTIFICATION_EMAIL };

    const callTransactional = async (payload: { templateName: string; recipientEmail: string; idempotencyKey?: string; templateData: Record<string, unknown> }) => {
      try {
        const entry = TEMPLATES[payload.templateName];
        if (!entry) return { ok: false, status: 400, body: `Template inconnu: ${payload.templateName}` };
        const Component = entry.component as (props: Record<string, unknown>) => unknown;
        const html = renderToStaticMarkup(createElement(Component, payload.templateData));
        const subject = typeof entry.subject === "function" ? entry.subject(payload.templateData) : entry.subject;
        const r = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": BREVO_API_KEY,
          },
          body: JSON.stringify({
            sender: SENDER,
            to: [{ email: payload.recipientEmail }],
            subject,
            htmlContent: `<!DOCTYPE html>${html}`,
          }),
        });
        const text = await r.text();
        if (!r.ok) {
          console.warn("brevo send", r.status, text);
          return { ok: false, status: r.status, body: text };
        }
        return { ok: true, body: text };
      } catch (e) {
        console.warn("brevo send threw:", e);
        return { ok: false, status: 0, body: String(e) };
      }
    };

    const customerResult = await callTransactional({
      templateName: "order-confirmation",
      recipientEmail: email,
      idempotencyKey: `order-confirm-${order_id}-${attemptNo}`,
      templateData,
    });

    if (!customerResult.ok) {
      await recordFailure(`customer email failed: ${customerResult.body}`);
      // Return 200 with fallback signal so caller doesn't error out.
      return json({
        ok: false,
        fallback: true,
        error: "EMAIL_SEND_FAILED",
        detail: customerResult.body,
      });
    }

    // Internal team notification (best-effort, never block customer flow)
    try {
      const { data: orderFull } = await supabase
        .from("orders")
        .select("customer_email, customer_phone, customer_name, provider, amount, reference")
        .eq("id", order_id)
        .maybeSingle();

      await callTransactional({
        templateName: "internal-order-notification",
        recipientEmail: ADMIN_NOTIFICATION_EMAIL,
        idempotencyKey: `internal-order-${order_id}-${attemptNo}`,
        templateData: {
          reference: orderFull?.reference ?? templateData.reference,
          total: orderFull?.amount ?? templateData.total,
          customer_email: orderFull?.customer_email ?? email,
          customer_name: orderFull?.customer_name ?? name ?? "",
          customer_phone: orderFull?.customer_phone ?? "",
          items: templateData.items,
          order_url: templateData.order_url,
          payment_provider: orderFull?.provider ?? "",
        },
      });
    } catch (e) {
      console.warn("internal notification failed:", e);
    }

    // Mark delivery as sent
    await supabase
      .from("orders")
      .update({
        delivery_status: "sent",
        delivery_error: null,
        last_delivery_attempt_at: new Date().toISOString(),
      })
      .eq("id", order_id);

    return json({ ok: true });
  } catch (e) {
    console.error("send-order-email error:", e);
    await recordFailure(String(e));
    // Always return 200 with fallback so the webhook never crashes
    return json({ ok: false, fallback: true, error: String(e) });
  }
});
