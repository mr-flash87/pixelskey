// Webhook Brevo (rebonds, plaintes, désabonnements) → liste de suppression.
// Configuration Brevo : Transactionnel > Paramètres > Webhooks, URL :
//   https://<projet>.supabase.co/functions/v1/handle-email-suppression?token=<BREVO_WEBHOOK_SECRET>
// Événements : Hard bounce, Spam (plainte), Désinscription.
// Secret Supabase requis : BREVO_WEBHOOK_SECRET (une longue chaîne aléatoire de votre choix).
import { createClient } from 'npm:@supabase/supabase-js@2'

type Reason = 'bounce' | 'complaint' | 'unsubscribe'

const EVENT_REASONS: Record<string, Reason> = {
  hard_bounce: 'bounce',
  hardBounce: 'bounce',
  invalid_email: 'bounce',
  spam: 'complaint',
  complaint: 'complaint',
  unsubscribed: 'unsubscribe',
  unsubscribe: 'unsubscribe',
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Constant-time compare
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const secret = Deno.env.get('BREVO_WEBHOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!secret || !supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  const provided = new URL(req.url).searchParams.get('token') ?? ''
  if (!safeEqual(provided, secret)) {
    return jsonResponse({ error: 'Invalid token' }, 401)
  }

  let events: Array<Record<string, unknown>>
  try {
    const body = await req.json()
    events = Array.isArray(body) ? body : [body]
  } catch {
    return jsonResponse({ error: 'Invalid payload' }, 400)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  let processed = 0

  for (const event of events) {
    const reason = EVENT_REASONS[String(event.event ?? '')]
    const email = typeof event.email === 'string' ? event.email.toLowerCase() : null
    if (!reason || !email) continue

    // 1. Upsert to suppressed_emails (idempotent — safe for retries)
    const { error: suppressError } = await supabase
      .from('suppressed_emails')
      .upsert(
        { email, reason, metadata: { provider: 'brevo', event: event.event, date: event.date ?? null } },
        { onConflict: 'email' },
      )
    if (suppressError) {
      console.error('Failed to upsert suppressed email', { error: suppressError })
      return jsonResponse({ error: 'Failed to write suppression' }, 500)
    }

    // 2. Append a log entry for the suppression event
    const { error: insertError } = await supabase.from('email_send_log').insert({
      message_id: typeof event['message-id'] === 'string' ? event['message-id'] : null,
      template_name: 'system',
      recipient_email: email,
      status: mapReasonToStatus(reason),
      error_message: mapReasonToMessage(reason),
      metadata: { provider: 'brevo', event: event.event },
    })
    if (insertError) console.warn('Failed to insert email_send_log', { error: insertError })
    processed++
  }

  return jsonResponse({ success: true, processed })
})

function mapReasonToStatus(reason: Reason): 'bounced' | 'complained' | 'suppressed' {
  switch (reason) {
    case 'bounce':
      return 'bounced'
    case 'complaint':
      return 'complained'
    default:
      return 'suppressed'
  }
}

function mapReasonToMessage(reason: Reason): string {
  switch (reason) {
    case 'bounce':
      return 'Permanent bounce — email address is invalid or rejected'
    case 'complaint':
      return 'Spam complaint — recipient marked email as spam'
    default:
      return 'Recipient unsubscribed'
  }
}
