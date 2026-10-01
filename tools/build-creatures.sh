#!/usr/bin/env bash
# Extracts the 11 bestiary creatures from the ideation PDF (page 3) and prepares them for the site.
#   - photos / paintings  -> optimised JPEG
#   - white-background art -> transparent PNG cut-outs (flood-fill from the edges, feathered)
# Needs: poppler-utils (pdfimages) + ImageMagick 6.  Usage: tools/build-creatures.sh path/to/IdeationResearch.pdf
set -euo pipefail
PDF="${1:?usage: build-creatures.sh <ideation.pdf>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/../img/creatures"
TMP="$(mktemp -d)"
mkdir -p "$OUT"

pdfimages -png -f 3 -l 3 "$PDF" "$TMP/c"
# Page 3 holds 11 creatures plus 3 tiny soft-mask images (c-002, c-004, c-007) that we ignore.
# order on the page: reaper watcher sando krayt lematya ent ungoliant raptor wampa tauntaun ravinak
declare -A SRC=( [reaper]=000 [watcher]=001 [sando]=003 [krayt]=005 [lematya]=006 [ent]=008
                 [ungoliant]=009 [raptor]=010 [wampa]=011 [tauntaun]=012 [ravinak]=013 )

jpg()  { convert "$TMP/c-${SRC[$1]}.png" -strip -quality 84 "$OUT/$1.jpg"; }

# cutout <name> <fuzz> [shave]   flood-fill the background from the edges, then feather the alpha slightly
cutout() {
  local name="$1" fuzz="$2" shave="${3:-0}"
  convert "$TMP/c-${SRC[$name]}.png" ${shave:+-shave ${shave}x${shave}} +repage \
    -alpha set -bordercolor white -border 2 -fuzz "$fuzz" -fill none -draw 'color 0,0 floodfill' \
    -shave 2x2 +repage \
    \( +clone -alpha extract -blur 0x0.6 -level 25%,100% \) -alpha off -compose CopyOpacity -composite \
    -trim +repage -strip "$OUT/$name.png"
}

for n in reaper watcher krayt ungoliant wampa tauntaun ravinak; do jpg "$n"; done
cutout sando   9%
# Le-matya: shave the scanner frame, then key out every near-white pixel (it has no real white fur,
# and the tail loop traps a white patch that a flood-fill from the edge cannot reach)
convert "$TMP/c-${SRC[lematya]}.png" -shave 20x20 +repage -alpha set -fuzz 13% -transparent white \
  \( +clone -alpha extract -blur 0x0.6 -level 25%,100% \) -alpha off -compose CopyOpacity -composite \
  -trim +repage -strip "$OUT/lematya.png"
cutout ent     8%            # TCG card: removes the white rounded corners
cutout raptor  8%
rm -rf "$TMP"
ls -la "$OUT"
