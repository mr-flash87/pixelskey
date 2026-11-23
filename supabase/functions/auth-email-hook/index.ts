// Supabase Auth "Send Email Hook" : rend les emails d'authentification (React Email)
// puis les met en file pour process-email-queue (envoi via Brevo).
// Configuration : Supabase > Authentication > Hooks > Send Email Hook (HTTPS) vers cette fonction,
// et définir le secret SEND_EMAIL_HOOK_SECRET (valeur "v1,whsec_..." fournie par Supabase).
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { Webhook } from 'npm:standardwebhooks@1.0.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature',
}

const EMAIL_SUBJECTS: Record<string, string> = {
  signup: 'Confirm your email',
  invite: "You've been invited",
  magiclink: 'Your login link',
  recovery: 'Reset your password',
  email_change: 'Confirm your new email',
  reauthentication: 'Your verification code',
}

// Template mapping
const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

// Configuration
const SITE_NAME = "Pixels Key"
const ROOT_DOMAIN = "pixelskey.app"
const FROM_DOMAIN = "pixelskey.app" // Domain shown in From address

// Preview data (admin-only preview endpoint)
const SAMPLE_PROJECT_URL = `https://${ROOT_DOMAIN}`
const SAMPLE_EMAIL = "user@example.test"
const SAMPLE_DATA: Record<string, object> = {
  signup: { siteName: SITE_NAME, siteUrl: SAMPLE_PROJECT_URL, recipient: SAMPLE_EMAIL, confirmationUrl: SAMPLE_PROJECT_URL },
  magiclink: { siteName: SITE_NAME, confirmationUrl: SAMPLE_PROJECT_URL },
  recovery: { siteName: SITE_NAME, confirmationUrl: SAMPLE_PROJECT_URL },
  invite: { siteName: SITE_NAME, siteUrl: SAMPLE_PROJECT_URL, confirmationUrl: SAMPLE_PROJECT_URL },
  email_change: { siteName: SITE_NAME, email: SAMPLE_EMAIL, newEmail: SAMPLE_EMAIL, confirmationUrl: SAMPLE_PROJECT_URL },
  reauthentication: { token: '123456' },
}

const json = (data: unknown, status = 200, headers: Record<string, string> = corsHeaders) =>
  new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json' } })

// Preview endpoint handler - returns rendered HTML without sending email (service role only)
async function handlePreview(req: Request): Promise<Response> {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceKey || req.headers.get('Authorization') !== `Bearer ${serviceKey}`) {
    return json({ error: 'Unauthorized' }, 401)
  }
  let type: string
  try {
    type = (await req.json()).type
  } catch {
    return json({ error: 'Invalid JSON in request body' }, 400)
  }
  const EmailTemplate = EMAIL_TEMPLATES[type]
  if (!EmailTemplate) return json({ error: `Unknown email type: ${type}` }, 400)
  const html = await renderAsync(React.createElement(EmailTemplate, SAMPLE_DATA[type] || {}))
  return new Response(html, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } })
}

// Webhook handler - verifies the Supabase hook signature and enqueues the email
async function handleWebhook(req: Request): Promise<Response> {
  const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET')
  if (!hookSecret) {
    console.error('SEND_EMAIL_HOOK_SECRET not configured')
    return json({ error: 'Server configuration error' }, 500)
  }

  const raw = await req.text()
  let payload: {
    user: { email: string; new_email?: string }
    email_data: { token: string; token_hash: string; redirect_to: string; email_action_type: string; site_url: string; token_new?: string; token_hash_new?: string }
  }
  try {
    const wh = new Webhook(hookSecret.replace(/^v1,whsec_/, ''))
    payload = wh.verify(raw, Object.fromEntries(req.headers)) as typeof payload
  } catch (error) {
    console.error('Invalid webhook signature', { error: error instanceof Error ? error.message : String(error) })
    return json({ error: 'Invalid signature' }, 401)
  }

  const emailType = payload.email_data.email_action_type
  const EmailTemplate = EMAIL_TEMPLATES[emailType]
  if (!EmailTemplate) {
    console.error('Unknown email type', { emailType })
    return json({ error: `Unknown email type: ${emailType}` }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const { token, token_hash, redirect_to } = payload.email_data
  const confirmationUrl = `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(token_hash)}&type=${encodeURIComponent(emailType)}&redirect_to=${encodeURIComponent(redirect_to || `https://${ROOT_DOMAIN}`)}`
  const recipient = payload.user.email

  const templateProps = {
    siteName: SITE_NAME,
    siteUrl: `https://${ROOT_DOMAIN}`,
    recipient,
    confirmationUrl,
    token,
    email: recipient,
    newEmail: payload.user.new_email,
  }

  const html = await renderAsync(React.createElement(EmailTemplate, templateProps))
  const text = await renderAsync(React.createElement(EmailTemplate, templateProps), { plainText: true })

  const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const messageId = crypto.randomUUID()

  // Log pending BEFORE enqueue so we have a record even if enqueue crashes
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: emailType,
    recipient_email: recipient,
    status: 'pending',
  })

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'auth_emails',
    payload: {
      message_id: messageId,
      to: recipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      subject: EMAIL_SUBJECTS[emailType] || 'Notification',
      html,
      text,
      purpose: 'transactional',
      label: emailType,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('Failed to enqueue auth email', { error: enqueueError, emailType })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: emailType,
      recipient_email: recipient,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    })
    return json({ error: 'Failed to enqueue email' }, 500)
  }

  return json({})
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (url.pathname.endsWith('/preview')) return handlePreview(req)
  try {
    return await handleWebhook(req)
  } catch (error) {
    console.error('Webhook handler error:', error)
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})
