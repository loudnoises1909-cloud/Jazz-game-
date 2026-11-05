#!/usr/bin/env bash
# Turns the voice recordings in voice-takes/ into small MP3s the game plays.
#
#   voice-takes/<line-key>.wav   (from studio.html; .m4a/.mp3/.webm/.ogg also work)
#     -> voice/<line-key>.mp3 + voice/voices.json
#
# Needs ffmpeg. Run from anywhere:  bash tools/build-voices.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p voice

# the line keys the game knows, read from index.html
mapfile -t KEYS < <(grep -oE "\{ k: '[A-Za-z0-9_]+'" index.html | sed -E "s/.*'([^']+)'/\1/")

shopt -s nullglob
count=0
for f in voice-takes/*.{wav,m4a,mp3,webm,ogg,aac}; do
  key="$(basename "${f%.*}")"
  if ! printf '%s\n' "${KEYS[@]}" | grep -qx "$key"; then
    echo "skip: $f (no game line called '$key')" >&2
    continue
  fi
  ffmpeg -nostdin -y -loglevel error -i "$f" -ac 1 -ar 44100 \
    -af "loudnorm=I=-16:TP=-1.5:LRA=11" -codec:a libmp3lame -b:a 96k "voice/$key.mp3"
  count=$((count + 1))
done

# manifest of every line that has an mp3
python3 - "${KEYS[@]}" <<'PY'
import json, os, sys
keys = sys.argv[1:]
have = {k: k + '.mp3' for k in keys if os.path.exists(os.path.join('voice', k + '.mp3'))}
json.dump(have, open('voice/voices.json', 'w'), indent=1)
missing = [k for k in keys if k not in have]
print(f"voice/voices.json: {len(have)} of {len(keys)} lines recorded")
if missing:
    print("still using the device voice for: " + ", ".join(missing))
PY
echo "converted $count file(s)"
