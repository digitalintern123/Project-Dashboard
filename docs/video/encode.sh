#!/bin/bash
# Encodes each recorded chapter (.out/rec/chNN/frames.txt) to .out/rec/chNN.mp4 at 1080p30.
set -e
V="$(cd "$(dirname "$0")" && pwd)/.out"
for d in "$V"/rec/*/; do
  d="${d%/}"
  [ -f "$d/frames.txt" ] || continue
  (cd "$d" && ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i frames.txt \
    -vf "fps=30,scale=1920:1080:flags=lanczos,format=yuv420p" -c:v libx264 -crf 18 -preset medium -r 30 "$d.mp4")
done
