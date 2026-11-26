# Vidéo promo Digital Pass BF

Motion design vertical 1080×1920, 33 s, sans son, généré à partir de `index.html` (animation déterministe image par image).

- Aperçu dans un navigateur : ouvrir `index.html`, puis dans la console `render(12.5)` pour voir l'image à 12,5 s.
- Export : `node render.cjs` (Playwright + ffmpeg) → `digital-pass-promo.mp4`.
- Images fixes : `node render.cjs --stills 2,12.5,31 --dir /tmp`.

Les écrans du téléphone sont reconstitués avec les vrais textes et boutons du bot (`bot/supabase/functions/_shared/ui.ts`) ;
les identifiants affichés sont fictifs et masqués.
