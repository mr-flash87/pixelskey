# Vidéos promo Digital Pass BF

Motion design vertical 1080×1920, généré image par image à partir de pages HTML (animation déterministe `render(t)`).

| Version | Page | Durée | Son |
| --- | --- | --- | --- |
| v2 (style « kinetic » violet/blanc, parcours complet) | `promo-v2.html` | 47,5 s | voix off + musique (`build-audio-v2.sh`) |
| v1 | `index.html` | 32,5 s | voix off (`build-audio.sh`) |

La v2 montre tout le parcours : recherche du bot dans Telegram, « Démarrer », adhésion au groupe officiel,
boutique → catégorie → service, paiement Mobile Money (numéro, copie du code, composition, code secret),
puis livraison automatique dans le chat.

## Export

```bash
node render.cjs --page promo-v2.html --out /tmp/v2-muette.mp4   # images (Playwright + ffmpeg)
./build-audio-v2.sh /tmp/v2-muette.mp4                           # → digital-pass-promo-v2.mp4
```

- Aperçu : ouvrir la page dans un navigateur, puis `render(12.5)` dans la console.
- Images fixes : `node render.cjs --page promo-v2.html --stills 2,12.5,31 --dir /tmp`.

## Audio (`audio/`)

- `voix-off-v2.mp3` : ElevenLabs, voix « Tony – Punchy Ad & Social Voice », modèle eleven_v4.
  Les animations sont calées sur sa transcription mot par mot (temps dans `promo-v2.html`, décalage `OFF` = 0,5 s).
  Pour changer de voix, il faut regénérer le texte puis recaler les temps.
- `musique.mp3` : Eleven Music, instrumental Afro-pop 60 s, baissée automatiquement sous la voix.
- `voix-off.mp3` : voix off de la v1.

## Visuels

`assets/logo-mark-t.png` et `assets/logo-word-t.png` sont détourés de `assets/logo-poster.png`.
Police : Plus Jakarta Sans (SIL Open Font License), dans `assets/fonts/`.
Les écrans du téléphone reprennent les vrais textes et boutons du bot (`bot/supabase/functions/_shared/ui.ts`) ;
les identifiants affichés sont fictifs et masqués.
