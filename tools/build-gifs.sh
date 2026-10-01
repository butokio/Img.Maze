#!/usr/bin/env bash
# Builds the animated GIFs and the "corrupted texture" from the creature art (run build-creatures.sh first).
#   img/gifs/flicker.gif      Landing: channel-surfing through every canon (the cross-canon collision as a loop)
#   img/gifs/lematya-swim.gif Water:   a desert predator wading through the deep (wave-warped cut-out, transparent)
#   img/gifs/watcher-writhe.gif / watcher-still.png   Desert: still <-> GIF swap on hover/click
#   img/creatures/reaper-glitch.jpg   Water: the datamoshed "corrupted texture" that hides the anchor
# Needs ImageMagick 6. Randomness is seeded so the output is reproducible.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
C="$HERE/../img/creatures"
G="$HERE/../img/gifs"
T="$(mktemp -d)"
mkdir -p "$G"
RANDOM=11

###############################################################################
# 1. flicker.gif — every creature, one frame each, with a couple of glitch jumps
###############################################################################
W=400; H=300
frame_photo()  { convert "$C/$1.jpg" -resize ${W}x${H}^ -gravity center -extent ${W}x${H} "$T/f_$2.png"; }
frame_cutout() { convert -size ${W}x${H} xc:"$3" \( "$C/$1.png" -resize $((W-40))x$((H-30)) \) -gravity center -composite "$T/f_$2.png"; }
frame_photo  reaper    01
frame_cutout raptor    02 '#3d6a3f'
frame_photo  krayt     03
frame_cutout sando     04 '#d9cfb8'
frame_photo  wampa     05
frame_cutout lematya   06 '#b5832f'
frame_photo  ravinak   07
frame_cutout ent       08 '#1f2a22'
frame_photo  ungoliant 09
frame_photo  tauntaun  10
frame_photo  watcher   11
# datamosh two of the frames so the loop stutters like a bad signal
for n in 03 07 09; do
  convert "$T/f_$n.png" \( +clone -crop ${W}x40+0+$((RANDOM%200)) +repage -roll +$((RANDOM%90+20))+0 \) -geometry +0+$((RANDOM%220)) -composite "$T/f_${n}g.png"
done
convert -delay 14 "$T"/f_01.png "$T"/f_02.png "$T"/f_03g.png "$T"/f_03.png "$T"/f_04.png "$T"/f_05.png "$T"/f_06.png \
        "$T"/f_07g.png "$T"/f_07.png "$T"/f_08.png "$T"/f_09g.png "$T"/f_09.png "$T"/f_10.png "$T"/f_11.png \
        -loop 0 -colors 112 -dither FloydSteinberg -layers OptimizePlus "$G/flicker.gif"

###############################################################################
# 2. lematya-swim.gif — travelling sine-wave warp, seamless 14-frame loop, transparent
###############################################################################
BASE="$T/matya.png"
convert "$C/lematya.png" -resize 420x -background none -gravity center -extent 420x230 "$BASE"
STEP=15; N=14
rm -f "$T"/sw_*.png
for k in $(seq 0 $((N-1))); do
  convert "$BASE" -virtual-pixel transparent -background none -roll +$((k*STEP))+0 -wave 7x$((STEP*N)) -roll -$((k*STEP))+0 \
          -gravity center -background none -extent 430x250 -channel A -threshold 55% +channel "$T/sw_$(printf %02d $k).png"
done
convert -dispose Background -delay 8 "$T"/sw_*.png -loop 0 -layers OptimizeTransparency -colors 160 "$G/lematya-swim.gif"

###############################################################################
# 3. watcher-writhe.gif + still — rippling swirl on the painting; the still is frame 0, un-warped
###############################################################################
WB="$T/watch.png"
convert "$C/watcher.jpg" -resize 380x "$WB"
convert "$WB" -shave 10x12 +repage -quality 85 "$G/watcher-still.jpg"
rm -f "$T"/wr_*.png
N=10
for k in $(seq 0 $((N-1))); do
  ang=$(python3 -c "import math;print(round(9*math.sin(2*math.pi*$k/$N),2))")
  convert "$WB" -virtual-pixel edge -roll +$((k*18))+0 -wave 5x$((18*N)) -roll -$((k*18))+0 -swirl $ang \
          -shave 10x17 +repage "$T/wr_$(printf %02d $k).png"
done
convert -delay 10 "$T"/wr_*.png -loop 0 -colors 96 -dither FloydSteinberg -layers OptimizePlus "$G/watcher-writhe.gif"

###############################################################################
# 4. reaper-glitch.jpg — banded horizontal displacement + RGB split + scanlines
###############################################################################
SRC="$T/rg_src.png"
convert "$C/reaper.jpg" -crop 400x400+420+20 +repage "$SRC"
cp "$SRC" "$T/rg.png"
for i in $(seq 1 17); do
  y=$((RANDOM%360)); h=$((RANDOM%34+6)); dx=$((RANDOM%150-75))
  convert "$T/rg.png" \( +clone -crop 400x${h}+0+${y} +repage -roll +${dx}+0 \) -geometry +0+${y} -composite "$T/rg.png"
done
# RGB split
convert "$T/rg.png" -channel R -separate -roll +11+0 "$T/r.png"
convert "$T/rg.png" -channel G -separate "$T/g.png"
convert "$T/rg.png" -channel B -separate -roll -11+0 "$T/b.png"
convert "$T/r.png" "$T/g.png" "$T/b.png" -combine -colorspace sRGB "$T/rg2.png"
# scanlines (drawn directly: IM6 `tile:` yields an opaque layer) + a few corrupted blocks
LINES=()
for y in $(seq 0 4 399); do LINES+=( -draw "line 0,$y 399,$y" -draw "line 0,$((y+1)) 399,$((y+1))" ); done
convert "$T/rg2.png" -fill 'rgba(0,0,0,0.34)' "${LINES[@]}" \
        -fill 'rgba(0,255,230,0.55)'  -draw "rectangle 40,$((RANDOM%300)) $((RANDOM%160+120)),$((RANDOM%10+40+RANDOM%300))" \
        -fill 'rgba(255,40,160,0.45)' -draw "rectangle 220,$((RANDOM%300)) $((RANDOM%130+270)),$((RANDOM%8+30+RANDOM%300))" \
        -modulate 100,120,100 -quality 84 "$C/reaper-glitch.jpg"

rm -rf "$T"
ls -la "$G" "$C/reaper-glitch.jpg" | awk '{print $5, $9}'
