# Mise en service du backend Pixels Key

Projet Supabase : **pixelskey** — réf. `uyqjgbbgcyxxdrkuxenn` — https://supabase.com/dashboard/project/uyqjgbbgcyxxdrkuxenn

## Déjà fait

- Toutes les tables, fonctions SQL, règles de sécurité (RLS), file d'e-mails et bucket `product-images`.
- Le site (`.env.example`) pointe vers ce projet.

L'ancienne base (gérée par l'ancienne plateforme) était inaccessible : on repart d'une base vide.
Les catalogues Prime Labs et Digitrust se réimportent par synchronisation ; les clés de licence locales,
codes promo, catégories personnalisées et images sont à ressaisir dans l'administration.

## 1. Déployer les fonctions serveur

1. supabase.com → avatar → **Account → Access Tokens** → créer un jeton.
2. GitHub → dépôt `pixelskey` → **Settings → Secrets and variables → Actions** → `SUPABASE_ACCESS_TOKEN`.
3. Onglet **Actions** → « Déployer les fonctions Supabase » → **Run workflow**.

## 2. Secrets des fonctions

Supabase → **Edge Functions → Secrets** :

| Secret | Obligatoire | Rôle |
| --- | --- | --- |
| `PAYMENT_SETTINGS_ENCRYPTION_KEY` | oui | Longue chaîne aléatoire ; chiffre les clés PayDunya saisies dans l'admin. |
| `BREVO_API_KEY` | oui | Envoi des e-mails. |
| `BREVO_SENDER_EMAIL` | oui | Adresse expéditrice validée dans Brevo. |
| `ADMIN_NOTIFICATION_EMAIL` | conseillé | Reçoit la notification de chaque paiement. |
| `PRIMESTORE_API_KEY` | oui | Fournisseur Prime Labs. |
| `DIGITRUST_API_URL`, `DIGITRUST_API_KEY` | oui | Fournisseur Digitrust (URL de base de l'API v2 + clé). |
| `CART_REMINDER_CRON_TOKEN` | oui | Longue chaîne aléatoire ; protège les tâches planifiées. |
| `AI_API_KEY` | option | Traduction du catalogue (OpenAI ou compatible). |
| `SITE_URL`, `ALLOWED_ORIGINS`, `BREVO_SENDER_NAME`, `DIGITRUST_AUTH_HEADER`, `AI_BASE_URL`, `AI_MODEL` | option | Voir les commentaires dans le code. |
| `SEND_EMAIL_HOOK_SECRET`, `BREVO_WEBHOOK_SECRET` | option | Hook d'e-mails Auth / webhook Brevo. |

## 3. Créer le compte administrateur

1. Supabase → **Authentication → Users → Add user** (e-mail + mot de passe, « Auto confirm »).
2. **SQL Editor** :
   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'super_admin' from auth.users where email = 'VOTRE_EMAIL';
   ```
3. Connectez-vous sur `/admin/login`, puis Paramètres → Paiements (clés PayDunya) et Fournisseurs
   (marges + « Synchroniser le catalogue »).

## 4. Tâches planifiées (SQL Editor)

Remplacez `<SERVICE_ROLE_KEY>` (Settings → API) et `<CRON_TOKEN>` (= `CART_REMINDER_CRON_TOKEN`).
Ne collez jamais ces clés dans un fichier du dépôt.

```sql
select cron.schedule('process-email-queue', '* * * * *', $$
  select net.http_post(url := 'https://uyqjgbbgcyxxdrkuxenn.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <SERVICE_ROLE_KEY>'),
    body := '{}'::jsonb); $$);

select cron.schedule('reconcile-pending-orders', '*/5 * * * *', $$
  select net.http_post(url := 'https://uyqjgbbgcyxxdrkuxenn.supabase.co/functions/v1/reconcile-pending-orders',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <SERVICE_ROLE_KEY>'),
    body := '{"source":"cron"}'::jsonb); $$);

select cron.schedule('retry-failed-deliveries', '*/5 * * * *', $$
  select net.http_post(url := 'https://uyqjgbbgcyxxdrkuxenn.supabase.co/functions/v1/retry-failed-deliveries',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <SERVICE_ROLE_KEY>'),
    body := '{}'::jsonb); $$);

select cron.schedule('send-cart-reminders', '7 * * * *', $$
  select net.http_post(url := 'https://uyqjgbbgcyxxdrkuxenn.supabase.co/functions/v1/send-cart-reminders',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <CRON_TOKEN>'),
    body := '{}'::jsonb); $$);

select cron.schedule('send-activation-reminders', '17 * * * *', $$
  select net.http_post(url := 'https://uyqjgbbgcyxxdrkuxenn.supabase.co/functions/v1/send-activation-reminders',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <SERVICE_ROLE_KEY>'),
    body := '{}'::jsonb); $$);
```

`send-cart-reminders` lance aussi la synchronisation horaire des catalogues fournisseurs.

## 5. PayDunya

URL de notification (IPN) : `https://uyqjgbbgcyxxdrkuxenn.supabase.co/functions/v1/paydunya-webhook`.

## 6. Options

- **E-mails d'authentification personnalisés** : Authentication → Hooks → Send Email Hook (HTTPS) vers
  `.../functions/v1/auth-email-hook`, secret dans `SEND_EMAIL_HOOK_SECRET`.
- **Webhook Brevo** (rebonds, désinscriptions) :
  `.../functions/v1/handle-email-suppression?token=<BREVO_WEBHOOK_SECRET>`.
- **Authentication → URL Configuration** : Site URL = `https://pixelskey.app`.

## Ancien projet

L'ancienne fonction `debug-env` exposait publiquement les clés secrètes de l'ancien projet : elle n'existe
pas dans ce dépôt. Les clés de l'ancien projet ne servent plus et ne doivent plus être réutilisées.
