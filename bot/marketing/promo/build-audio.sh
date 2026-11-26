#!/usr/bin/env bash
# Place chaque phrase de la voix off (ElevenLabs, voix « Tony ») au bon moment de la vidéo,
# puis l'assemble avec l'image : ./build-audio.sh [video.mp4] [sortie.mp4]
set -euo pipefail
cd "$(dirname "$0")"
IN="${1:-digital-pass-promo.mp4}"; OUT="${2:-digital-pass-promo-voix.mp4}"
# [début, fin] dans voix-off.mp3  →  instant dans la vidéo
SEGS="0:2.78:0.3 2.80:8.27:3.6 8.27:11.57:9.25 11.57:12.40:14.0 12.40:13.18:16.6 13.18:16.31:20.45 16.31:19.33:24.2 19.33:22.96:27.5"
filter=""; mix=""; n=0
for s in $SEGS; do
  IFS=: read -r a b at <<<"$s"
  ms=$(awk "BEGIN{printf \"%d\", $at*1000}")
  filter+="[1:a]atrim=$a:$b,asetpts=PTS-STARTPTS,afade=t=in:d=0.03,adelay=${ms}|${ms}[v$n];"
  mix+="[v$n]"; n=$((n+1))
done
filter+="${mix}amix=inputs=$n:normalize=0,loudnorm=I=-14:TP=-1.5,apad[a]"
ffmpeg -y -loglevel error -i "$IN" -i audio/voix-off.mp3 -filter_complex "$filter" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart "$OUT"
echo "vidéo avec voix off : $OUT"
