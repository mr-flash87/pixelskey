# Bot Telegram — vente d'abonnements premium

Bot Telegram autonome (séparé du site pixelskey) qui vend des abonnements et services numériques :
catalogue en boutons, paiement Orange Money / Moov Money / Wave via **FlashPay**, livraison
**automatique dans le chat** depuis vos fournisseurs (Digitrust, Prime Labs, stock manuel…),
solde rechargeable, parrainage et alertes admin.

## Fonctionnalités

| Client | Admin (dans Telegram) |
| --- | --- |
| 🛍️ Boutique par catégories, fiche produit, stock en direct | 💰 Alerte à chaque vente et recharge |
| 📱 Paiement Mobile Money (page FlashPay ou code USSD) | 🚨 Alerte livraison bloquée / fournisseur à recharger |
| 💰 Paiement en un clic avec le solde | 📊 `/admin` : ventes du jour, soldes fournisseurs |
| ⚡ Accès livrés automatiquement dans le chat | 🔁 `/relancer`, `/lier`, `/livrer`, `/rembourser` |
| 📦 Historique et accès dans « Mes commandes » | 🗂️ `/sync`, `/produits`, `/publier`, `/prix`, `/stock`, `/nouveau` |
| 🎁 Lien de parrainage : % du 1er achat du filleul crédité au parrain | 👤 `/crediter`, `/bloquer` |

Liste complète des commandes admin : `/aideadmin` dans le bot.

## Architecture

```
bot/
├── supabase/
│   ├── config.toml                      fonctions sans JWT (chacune vérifie son propre secret)
│   ├── migrations/…_bot_init.sql        tables + fonctions atomiques (solde, paiement, livraison)
│   └── functions/
│       ├── telegram-webhook/            messages et boutons Telegram
│       ├── flashpay-webhook/            notifications de paiement FlashPay
│       ├── bot-cron/                    rattrapage paiements/livraisons, synchro catalogues, installation
│       └── _shared/
│           ├── bot.ts  ui.ts  admin.ts  parcours client, écrans, commandes admin
│           ├── payments.ts              commandes, FlashPay, solde, parrainage
│           ├── fulfillment.ts           livraison (stock manuel puis fournisseur)
│           ├── catalog.ts  pricing.ts   synchro des catalogues, marges, catégories
│           ├── flashpay.ts  telegram.ts clients API
│           └── suppliers/               un adaptateur par fournisseur + registry.ts
└── tests/                               tests unitaires (Deno) et tests SQL
```

### Règles de sécurité

- **Une livraison ne part qu'après une vérification côté serveur** : la signature HMAC du webhook est vérifiée, puis le paiement est relu via l'API FlashPay et son montant comparé à la commande. La redirection du client ne déclenche jamais rien.
- **Idempotence partout** : événements webhook dédupliqués, `confirm_payment` atomique, `claim_delivery` empêche deux livraisons simultanées, mouvements de solde uniques par `(type, référence)`.
- **Aucun double achat fournisseur** : l'intention d'achat est enregistrée avant l'appel. Si la réponse est incertaine et que le fournisseur n'a pas de clé d'idempotence (Digitrust), la commande passe en « uncertain » et vous êtes alerté. Rien n'est racheté automatiquement.
- **Données réservées au serveur** : RLS activé sans aucune policy, fonctions SQL fermées à `anon`/`authenticated`, `search_path` vide.
- **Webhook Telegram protégé** par `X-Telegram-Bot-Api-Secret-Token`.

## Mise en ligne

### 1. Prérequis

1. Créez le bot avec [@BotFather](https://t.me/BotFather) (`/newbot`) et récupérez son **token**.
2. Récupérez votre **identifiant Telegram** (par exemple via [@userinfobot](https://t.me/userinfobot)) pour recevoir les alertes admin.
3. Créez un **nouveau projet Supabase** dédié au bot, puis indiquez son identifiant dans `supabase/config.toml` (`project_id`).
4. Récupérez votre clé API FlashPay (`fp_live_…`) et votre secret webhook (`fpwh_…`).

### 2. Base de données

```bash
cd bot
supabase link --project-ref VOTRE_PROJET_BOT
supabase db push
```

### 3. Secrets (Supabase → Edge Functions → Secrets)

| Secret | Valeur |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | token donné par BotFather |
| `TELEGRAM_BOT_USERNAME` | nom du bot sans @ (liens de parrainage, retour après paiement) |
| `TELEGRAM_WEBHOOK_SECRET` | chaîne aléatoire longue (`openssl rand -hex 32`) |
| `ADMIN_CHAT_IDS` | vos identifiants Telegram, séparés par des virgules |
| `FLASHPAY_API_KEY` | `fp_live_…` |
| `FLASHPAY_WEBHOOK_SECRET` | `fpwh_…` |
| `CRON_TOKEN` | chaîne aléatoire longue (`openssl rand -hex 32`) |
| `DIGITRUST_API_URL`, `DIGITRUST_API_KEY` | accès Digitrust (optionnel : `DIGITRUST_AUTH_HEADER`) |
| `SUPPLIER_EMAIL` | adresse e-mail exigée par Digitrust pour chaque achat (la vôtre) |
| `PRIMESTORE_API_KEY` | accès Prime Labs |
| `SHOP_NAME`, `SUPPORT_USERNAME` | optionnels : nom affiché, compte support (bouton 💬) |

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement par Supabase.

### 4. Déploiement et installation du webhook

```bash
supabase functions deploy telegram-webhook
supabase functions deploy flashpay-webhook
supabase functions deploy bot-cron

# Enregistre le webhook Telegram et le menu des commandes
curl -X POST https://VOTRE_PROJET_BOT.supabase.co/functions/v1/bot-cron \
  -H "Authorization: Bearer $CRON_TOKEN" -H "Content-Type: application/json" -d '{"action":"setup"}'
```

Dans votre compte FlashPay, l'URL de webhook est envoyée automatiquement avec chaque paiement
(`https://VOTRE_PROJET_BOT.supabase.co/functions/v1/flashpay-webhook`).

### 5. Tâches planifiées (SQL Editor de Supabase)

Activez les extensions `pg_cron` et `pg_net` (Database → Extensions), enregistrez le jeton dans le coffre, puis :

```sql
select vault.create_secret('VOTRE_CRON_TOKEN', 'bot_cron_token');

select cron.schedule('bot-tick', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://VOTRE_PROJET_BOT.supabase.co/functions/v1/bot-cron',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'bot_cron_token')),
    body := '{"action":"tick"}'::jsonb)
$$);

select cron.schedule('bot-sync', '7 * * * *', $$
  select net.http_post(
    url := 'https://VOTRE_PROJET_BOT.supabase.co/functions/v1/bot-cron',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'bot_cron_token')),
    body := '{"action":"sync"}'::jsonb,
    timeout_milliseconds := 120000)
$$);
```

### 6. Premier lancement

1. Dans le bot, envoyez `/sync` : les offres des fournisseurs sont importées **masquées**.
2. Vérifiez la liste avec `/produits`, ajustez si besoin avec `/categorie` et `/prix`, puis rendez chaque offre visible avec `/publier ID`.
   Pour tout publier automatiquement : `update suppliers set auto_publish = true where id = 'digitrust';`
3. Réglez vos marges dans la table `suppliers` (`usd_rate`, `margin_percent`, `margin_fixed`) puis relancez `/sync`.
4. Pour un produit que vous fournissez vous-même : `/nouveau 2500 | 🎬 Streaming | Netflix 1 écran 1 mois`, puis `/stock ID` suivi d'un compte par ligne.
5. Testez avec un petit montant payé depuis votre propre numéro (ou demandez à FlashPay de simuler le SMS).

Les noms, descriptions, catégories et la visibilité que vous modifiez ne sont jamais écrasés par la synchronisation. Le prix suit les marges, sauf s'il a été fixé avec `/prix`.

## Réglages (table `settings`)

| Clé | Défaut | Rôle |
| --- | --- | --- |
| `referral_percent` | `5` | % du 1er achat du filleul versé au parrain |
| `topup_min` / `topup_max` | `500` / `200000` | limites de recharge du solde |

## Brancher un nouveau fournisseur

1. Créez `supabase/functions/_shared/suppliers/monfournisseur.ts`, qui exporte un `SupplierAdapter` (voir `types.ts`) :
   `listOffers`, `canSell`, `purchase`, `getOrder`, et éventuellement `balance`. Indiquez `idempotent: true` seulement si son API accepte une clé d'idempotence.
2. Ajoutez-le dans `suppliers/registry.ts`.
3. `insert into suppliers (id, name) values ('monfournisseur', 'Mon fournisseur');`
4. Ajoutez ses secrets, redéployez les fonctions, puis lancez `/sync`.

En cas d'erreur, levez `SupplierError(message, certain, needsFunding)` :
- `certain = true` si le fournisseur a refusé et que rien n'a été débité ;
- `certain = false` si le résultat est inconnu (délai dépassé, erreur 5xx…) ;
- `needsFunding = true` si le portefeuille fournisseur est à recharger.

## Que faire quand une livraison bloque ?

Vous recevez une alerte 🚨 dans Telegram, et `/bloquees` liste les commandes concernées.

- **Stock épuisé ou portefeuille fournisseur vide** : ajoutez du stock (`/stock`) ou rechargez le fournisseur, puis `/relancer REF`.
- **Commande « uncertain »** : vérifiez d'abord l'historique chez le fournisseur.
  - Si la commande y figure : `/lier REF ID_FOURNISSEUR`, et le bot récupère les accès.
  - Si rien n'a été acheté : `/relancer REF force`.
- **Accès obtenus à la main** : `/livrer REF`, puis les accès à la ligne.
- **Impossible à livrer** : `/rembourser REF` crédite le solde du client.

## Développement

```bash
deno task check   # vérification des types
deno task test    # tests unitaires
# Tests SQL sur une base Postgres vierge :
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261124000000_bot_init.sql -f tests/sql_test.sql
```
