#!/usr/bin/env bash
# Extracts the 11 bestiary creatures from the ideation PDF (page 3) and prepares them for the site.
#   - photos / paintings   -> optimised JPEG
#   - white-background art -> transparent PNG cut-outs (flood-fill from the edges, feathered)
# Needs: poppler-utils (pdfimages) + ImageMagick 6.  Usage: tools/build-creatures.sh path/to/IdeationResearch.pdf
set -euo pipefail
PDF="${1:?usage: build-creatures.sh <ideation.pdf>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/../images/creatures"
TMP="$(mktemp -d)"
mkdir -p "$OUT"

pdfimages -png -f 3 -l 3 "$PDF" "$TMP/c"
# Page 3 holds 11 creatures plus 3 tiny soft-mask images (c-002, c-004, c-007) that we ignore.
declare -A SRC=( [reaper-leviathan]=000 [watcher-in-the-water]=001 [sando-aqua-monster]=003 [krayt-dragon]=005
                 [le-matya]=006 [ent-treebeard-card]=008 [ungoliant]=009 [velociraptor]=010
                 [wampa]=011 [tauntaun]=012 [ravinak]=013 )

jpg()  { convert "$TMP/c-${SRC[$1]}.png" -strip -quality 84 "$OUT/$1.jpg"; }

# cutout <name> <fuzz>   flood-fill the background from the edges, then feather the alpha slightly
cutout() {
  local name="$1" fuzz="$2"
  convert "$TMP/c-${SRC[$name]}.png" +repage \
    -alpha set -bordercolor white -border 2 -fuzz "$fuzz" -fill none -draw 'color 0,0 floodfill' \
    -shave 2x2 +repage \
    \( +clone -alpha extract -blur 0x0.6 -level 25%,100% \) -alpha off -compose CopyOpacity -composite \
    -trim +repage -strip "$OUT/$name.png"
}

for n in reaper-leviathan watcher-in-the-water krayt-dragon ungoliant wampa tauntaun ravinak; do jpg "$n"; done
cutout sando-aqua-monster 9%
cutout ent-treebeard-card 8%      # TCG card: removes the white rounded corners
cutout velociraptor       8%
# Le-matya: shave the scanner frame, then key out every near-white pixel (it has no real white fur,
# and the tail loop traps a white patch that a flood-fill from the edge cannot reach)
convert "$TMP/c-${SRC[le-matya]}.png" -shave 20x20 +repage -alpha set -fuzz 13% -transparent white \
  \( +clone -alpha extract -blur 0x0.6 -level 25%,100% \) -alpha off -compose CopyOpacity -composite \
  -trim +repage -strip "$OUT/le-matya.png"
rm -rf "$TMP"
ls -la "$OUT"
