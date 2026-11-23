# Pixels Key

Boutique de licences, abonnements et outils digitaux (React + Vite + Tailwind + Supabase).

## Démarrer en local

```bash
npm install
cp .env.example .env      # déjà rempli avec la clé publique Supabase
npm run dev               # http://localhost:8080
npm test                  # 49 tests
```

## Déployer sur Hostinger

1. `npm run build` → le site est généré dans `dist/`.
2. Dans hPanel → **Gestionnaire de fichiers**, ouvrez `public_html/` du domaine `pixelskey.app`.
3. Envoyez **le contenu** de `dist/` (pas le dossier lui‑même), y compris le fichier caché `.htaccess`.
4. Activez le SSL (hPanel → Sécurité → SSL) et pointez le DNS du domaine vers Hostinger.

Le fichier `.htaccess` redirige toutes les routes (`/produit/...`, `/admin`, `/order/...`) vers `index.html`.

Option automatique : hPanel → **Git** → connecter ce dépôt GitHub, puis ajouter un déploiement qui
copie `dist/` après `npm run build` (ou utiliser l'action GitHub `.github/workflows/deploy.yml` si vous l'ajoutez).

## Backend (Supabase)

Le site utilise le projet Supabase `ixxfdkoqaudrszzvdemb` (base de données, authentification admin,
stockage des images, fonctions serveur). Voir **docs/MIGRATION.md** pour :

- récupérer la propriété du projet Supabase (ou migrer vers votre propre projet) ;
- les secrets à définir (Brevo, IA, Digitrust, Prime Labs, PayDunya) ;
- le redéploiement des fonctions (`supabase functions deploy`) ;
- les tâches planifiées (cron) à recréer.

## Images à remplacer

Ces fichiers sont provisoires (le site publié était inaccessible au moment de la copie) :

| Fichier | Contenu attendu |
| --- | --- |
| `public/logo.png` | Logo Pixels Key en haute résolution (actuellement extrait d'une capture, flou) |
| `public/favicon.png` | Icône du site |
| `public/payments/*.svg/.png` | Logos officiels Orange Money, MTN MoMo, Wave, Moov Money (sources : `src/assets/payments/SOURCES.md`) |

`src/assets/banner-home.jpg` et `public/og-image.jpg` ont été récupérés depuis la capture du site.
Les images des produits sont stockées dans Supabase Storage (bucket `product-images`) et ne changent pas.
