#!/usr/bin/env bash
# Mixe la voix off (ElevenLabs, voix « Tony ») et la musique (Eleven Music) sur la vidéo v2 :
#   ./build-audio-v2.sh video-muette.mp4 [sortie.mp4]
# La voix démarre à 0,5 s (OFF dans promo-v2.html) ; la musique baisse quand la voix parle.
set -euo pipefail
cd "$(dirname "$0")"
IN="${1:?vidéo muette (node render.cjs --page promo-v2.html --out …)}"; OUT="${2:-digital-pass-promo-v2.mp4}"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")
FADE=$(awk "BEGIN{print $DUR-1.6}")
ffmpeg -y -loglevel error -i "$IN" -i audio/voix-off-v2.mp3 -i audio/musique.mp3 -filter_complex "
  [1:a]aresample=48000,adelay=500|500,apad,asplit=2[vo][key];
  [2:a]aresample=48000,volume=0.55,atrim=0:$DUR,afade=t=in:d=0.3,afade=t=out:st=$FADE:d=1.6[mus];
  [mus][key]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=400[duck];
  [vo][duck]amix=inputs=2:normalize=0:duration=longest,atrim=0:$DUR,loudnorm=I=-14:TP=-1.5[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -ar 48000 -movflags +faststart "$OUT"
echo "vidéo finale : $OUT"
