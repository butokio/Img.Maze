#!/usr/bin/env bash
# Builds the animated GIFs and the "corrupted texture" from the creature art (run build-creatures.sh first).
#   images/gifs/le-matya-swim.gif     Water:   a desert predator wading through the deep (wave-warped cut-out, transparent)
#   images/gifs/watcher-writhe.gif    Landing: the Watcher, rippling (its only appearance in the pile)
#   images/gifs/krayt-shimmer.gif     Desert:  heat-haze on the Krayt's mouth ...
#   images/gifs/krayt-eye.jpg         ... and the still of the same crop (top-left pair: hover the still, the GIF plays)
#   images/creatures/reaper-glitch.jpg  Water: the datamoshed "corrupted texture" that hides the anchor
# Needs ImageMagick 6. Randomness is seeded so the output is reproducible.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
C="$HERE/../images/creatures"
G="$HERE/../images/gifs"
T="$(mktemp -d)"
mkdir -p "$G"
RANDOM=11

# wave_loop <base.png> <amplitude> <wavelength> <steps> <outprefix>
# A travelling sine wave: shift the picture, warp it, shift it back. N frames of STEP px = one full wavelength, so it loops cleanly.
wave_loop() {
  local base="$1" amp="$2" len="$3" n="$4" out="$5" step=$(( $3 / $4 )) k
  for k in $(seq 0 $((n-1))); do
    convert "$base" -virtual-pixel edge -background none -roll +$((k*step))+0 -wave ${amp}x${len} -roll -$((k*step))+0 \
            "${out}$(printf %02d $k).png"
  done
}

###############################################################################
# 1. le-matya-swim.gif — transparent, 14-frame loop
###############################################################################
convert "$C/le-matya.png" -resize 420x -background none -gravity center -extent 420x230 "$T/matya.png"
rm -f "$T"/sw_*.png
for k in $(seq 0 13); do
  convert "$T/matya.png" -virtual-pixel transparent -background none -roll +$((k*15))+0 -wave 7x210 -roll -$((k*15))+0 \
          -gravity center -background none -extent 430x250 -channel A -threshold 55% +channel "$T/sw_$(printf %02d $k).png"
done
convert -dispose Background -delay 8 "$T"/sw_*.png -loop 0 -layers OptimizeTransparency -colors 160 "$G/le-matya-swim.gif"

###############################################################################
# 2. watcher-writhe.gif — rippling swirl on the painting
###############################################################################
convert "$C/watcher-in-the-water.jpg" -resize 380x "$T/watch.png"
rm -f "$T"/wr_*.png
N=10
for k in $(seq 0 $((N-1))); do
  ang=$(python3 -c "import math;print(round(9*math.sin(2*math.pi*$k/$N),2))")
  convert "$T/watch.png" -virtual-pixel edge -roll +$((k*18))+0 -wave 5x$((18*N)) -roll -$((k*18))+0 -swirl $ang \
          -shave 10x17 +repage "$T/wr_$(printf %02d $k).png"
done
convert -delay 10 "$T"/wr_*.png -loop 0 -colors 96 -dither FloydSteinberg -layers OptimizePlus "$G/watcher-writhe.gif"

###############################################################################
# 3. krayt-shimmer.gif + krayt-eye.jpg — heat haze over a crop of the mouth
###############################################################################
# crop a little bigger than we need, warp it, then trim the ragged edge the wave leaves behind (same trim for the still)
convert "$C/krayt-dragon.jpg" -crop 218x138+56+31 +repage "$T/eye.png"
convert "$T/eye.png" -gravity center -crop 210x130+0+0 +repage -quality 88 "$G/krayt-eye.jpg"
rm -f "$T"/ks_*.png
wave_loop "$T/eye.png" 3 64 8 "$T/ks_"
for f in "$T"/ks_*.png; do convert "$f" -gravity center -crop 210x130+0+0 +repage "$f"; done
convert -delay 9 "$T"/ks_*.png -loop 0 -colors 128 -dither FloydSteinberg -layers OptimizePlus "$G/krayt-shimmer.gif"

###############################################################################
# 4. reaper-glitch.jpg — banded horizontal displacement + RGB split + scanlines
###############################################################################
convert "$C/reaper-leviathan.jpg" -crop 400x400+420+20 +repage "$T/rg.png"
for i in $(seq 1 17); do
  y=$((RANDOM%360)); h=$((RANDOM%34+6)); dx=$((RANDOM%150-75))
  convert "$T/rg.png" \( +clone -crop 400x${h}+0+${y} +repage -roll +${dx}+0 \) -geometry +0+${y} -composite "$T/rg.png"
done
convert "$T/rg.png" -channel R -separate -roll +11+0 "$T/r.png"
convert "$T/rg.png" -channel G -separate "$T/g.png"
convert "$T/rg.png" -channel B -separate -roll -11+0 "$T/b.png"
convert "$T/r.png" "$T/g.png" "$T/b.png" -combine -colorspace sRGB "$T/rg2.png"
LINES=()
for y in $(seq 0 4 399); do LINES+=( -draw "line 0,$y 399,$y" -draw "line 0,$((y+1)) 399,$((y+1))" ); done
Y1=$((RANDOM%330)); Y2=$((RANDOM%330)); Y3=$((RANDOM%330))
convert "$T/rg2.png" -fill 'rgba(0,0,0,0.34)' "${LINES[@]}" \
        -fill 'rgba(0,255,230,0.5)'  -draw "rectangle 30,$Y1 $((RANDOM%150+170)),$((Y1+RANDOM%10+6))" \
        -fill 'rgba(255,40,160,0.42)' -draw "rectangle 190,$Y2 $((RANDOM%120+280)),$((Y2+RANDOM%12+8))" \
        -fill 'rgba(255,255,255,0.35)' -draw "rectangle 80,$Y3 $((RANDOM%100+200)),$((Y3+RANDOM%5+3))" \
        -modulate 100,120,100 -quality 84 "$C/reaper-glitch.jpg"

rm -rf "$T"
ls -la "$G" "$C/reaper-glitch.jpg" | awk '{print $5, $9}'
