# Migration du backend (Supabase) hors de l'ancienne plateforme

Le front (ce dépôt) est 100 % indépendant : il se compile avec `npm run build` et s'héberge sur Hostinger.
Le **backend** reste un projet Supabase (`ixxfdkoqaudrszzvdemb`). Deux cas :

## Cas A — le projet Supabase est dans VOTRE compte supabase.com

Rien à migrer : connectez-vous sur https://supabase.com/dashboard, ouvrez le projet, puis suivez
« Secrets » et « Redéployer les fonctions » ci-dessous.

## Cas B — le projet était géré par la plateforme (vous n'avez pas accès au tableau de bord Supabase)

Il faut créer votre propre projet et y transférer les données :

1. Créez un projet sur https://supabase.com (région Europe, ex. `eu-west-3` Paris).
2. Appliquez la structure : installez la CLI (`npm i -g supabase`), puis
   ```bash
   supabase link --project-ref <NOUVEAU_REF>
   supabase db push                       # applique supabase/migrations/*
   psql "$DATABASE_URL" -f drizzle/migrations/0000_primestore_integration.sql   # puis 0001 → 0007, dans l'ordre
   ```
3. Transférez les données (produits, catégories, clés de licence, commandes, réglages) avec un export CSV
   de chaque table depuis l'ancien backend si vous y avez encore accès, puis import dans le nouveau projet.
   **Faites-le avant que l'ancien backend ne soit supprimé.**
4. Recopiez les images du bucket `product-images` (Storage) vers le nouveau projet.
5. Mettez à jour `.env` (URL + clé publique « anon » du nouveau projet), `supabase/config.toml` (`project_id`),
   les URLs `ixxfdkoqaudrszzvdemb` dans `public/sitemap-images.xml`, puis recompilez le site.
6. Recréez votre compte administrateur (Authentication → Users) et ajoutez-lui le rôle :
   ```sql
   insert into public.user_roles (user_id, role) values ('<UUID_UTILISATEUR>', 'super_admin');
   ```

## Secrets des fonctions (Supabase → Edge Functions → Secrets)

| Secret | Obligatoire | Rôle |
| --- | --- | --- |
| `PAYMENT_SETTINGS_ENCRYPTION_KEY` | oui | Chiffre les clés PayDunya enregistrées dans l'admin. Si vous en mettez une nouvelle, ressaisissez les clés PayDunya dans Admin → Paramètres → Paiements. |
| `BREVO_API_KEY` | oui | Envoi de tous les e-mails (commande, rappels, connexion admin). |
| `BREVO_SENDER_EMAIL` | oui | Adresse expéditrice validée dans Brevo (ex. `noreply@pixelskey.app`). |
| `BREVO_SENDER_NAME` | non | Nom d'expéditeur (défaut « Pixels Key »). |
| `ADMIN_NOTIFICATION_EMAIL` | non | Reçoit la notification de chaque paiement. |
| `SITE_URL` | non | `https://pixelskey.app` par défaut. |
| `ALLOWED_ORIGINS` | non | Domaines supplémentaires autorisés au retour de paiement, séparés par des virgules. |
| `PRIMESTORE_API_KEY` | oui | Fournisseur Prime Labs. |
| `DIGITRUST_API_URL` | oui | URL de base de l'API Digitrust v2 (à demander à Digitrust / dans leur documentation). |
| `DIGITRUST_API_KEY` | oui | Clé API Digitrust (anciennement `UDC_DIGITRUST_API_KEY`). |
| `DIGITRUST_AUTH_HEADER` | non | En-tête d'authentification si ce n'est pas `Authorization: Bearer`. |
| `AI_API_KEY` | pour la traduction | Clé d'un fournisseur IA compatible OpenAI. |
| `AI_BASE_URL` / `AI_MODEL` | non | Par défaut `https://api.openai.com/v1` et `gpt-4o-mini`. |
| `CART_REMINDER_CRON_TOKEN` | oui | Jeton secret des tâches planifiées (relances panier + synchro catalogue). |
| `SEND_EMAIL_HOOK_SECRET` | si hook activé | Secret du « Send Email Hook » Supabase Auth. |
| `BREVO_WEBHOOK_SECRET` | si webhook activé | Protège le webhook Brevo des rebonds/désabonnements. |
| `LEEKPAY_PUBLIC_KEY` / `LEEKPAY_SECRET_KEY` | anciennes commandes | Uniquement pour les commandes LeekPay créées avant PayDunya. |

`LOVABLE_API_KEY` n'est plus utilisé : vous pouvez le supprimer.

## Redéployer les fonctions

```bash
supabase functions deploy --project-ref <REF>
```

**Supprimez la fonction `debug-env`** si elle existe encore : elle renvoyait publiquement les clés secrètes
du projet. Elle n'est volontairement pas incluse dans ce dépôt.
```bash
supabase functions delete debug-env --project-ref <REF>
```
Par précaution, régénérez ensuite les clés secrètes du projet (Settings → API).

## E-mails de connexion admin (optionnel)

Supabase envoie déjà ses propres e-mails d'authentification. Pour utiliser les modèles Pixels Key via Brevo :
Authentication → Hooks → **Send Email Hook** → type HTTPS → URL
`https://<REF>.supabase.co/functions/v1/auth-email-hook`, puis copiez le secret généré dans `SEND_EMAIL_HOOK_SECRET`.

## Webhook Brevo (optionnel)

Brevo → Transactionnel → Paramètres → Webhooks → URL
`https://<REF>.supabase.co/functions/v1/handle-email-suppression?token=<BREVO_WEBHOOK_SECRET>`
(événements : hard bounce, spam, désinscription).

## Tâches planifiées (SQL Editor)

Remplacez `<REF>`, `<SERVICE_ROLE_KEY>` et `<CRON_TOKEN>` :

```sql
-- File d'e-mails (toutes les minutes)
select cron.schedule('process-email-queue', '* * * * *', $$
  select net.http_post(
    url := 'https://<REF>.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <SERVICE_ROLE_KEY>'),
    body := '{}'::jsonb);
$$);

-- Rapprochement des paiements en attente (toutes les 5 min)
select cron.schedule('reconcile-pending-orders', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://<REF>.supabase.co/functions/v1/reconcile-pending-orders',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <SERVICE_ROLE_KEY>'),
    body := '{"source":"cron"}'::jsonb);
$$);

-- Relance des livraisons échouées (toutes les 5 min)
select cron.schedule('retry-failed-deliveries', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://<REF>.supabase.co/functions/v1/retry-failed-deliveries',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <SERVICE_ROLE_KEY>'),
    body := '{}'::jsonb);
$$);

-- Relances panier + synchronisation des catalogues fournisseurs (toutes les heures)
select cron.schedule('send-cart-reminders', '7 * * * *', $$
  select net.http_post(
    url := 'https://<REF>.supabase.co/functions/v1/send-cart-reminders',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <CRON_TOKEN>'),
    body := '{}'::jsonb);
$$);

-- Rappel « vos clés vous attendent » (toutes les heures)
select cron.schedule('send-activation-reminders', '17 * * * *', $$
  select net.http_post(
    url := 'https://<REF>.supabase.co/functions/v1/send-activation-reminders',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <SERVICE_ROLE_KEY>'),
    body := '{}'::jsonb);
$$);
```

Ne collez jamais ces clés dans un fichier du dépôt : uniquement dans le SQL Editor de Supabase.

## PayDunya

Dans le tableau de bord PayDunya, l'URL de notification (IPN) doit être
`https://<REF>.supabase.co/functions/v1/paydunya-webhook` (elle est aussi envoyée automatiquement à chaque facture).

## Ce qui a changé par rapport à l'ancienne plateforme

- Passerelle IA → fournisseur compatible OpenAI (`AI_API_KEY`).
- E-mails de la file d'attente → API Brevo directe (les e-mails de commande l'utilisaient déjà).
- Hook d'e-mails d'authentification → format standard Supabase (`SEND_EMAIL_HOOK_SECRET`).
- Connecteur Digitrust → appel direct de l'API Digitrust (`DIGITRUST_API_URL`, `DIGITRUST_API_KEY`).
- Session admin → stockage navigateur standard (plus de pont avec l'éditeur).
- Logos de paiement → fichiers locaux dans `public/payments/`.
- Fonction `debug-env` retirée (fuite de secrets).
