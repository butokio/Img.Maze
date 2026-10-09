# Changing things: a study guide for the code

Not part of the submission (this folder is left out of the ZIP). It is for reading the code and changing positions, sizes and depth yourself.

The idea: open `stylesheets/mystyles.css`, find the picture's `#id` rule, change **one number**, save, refresh, and see what moved.

## Where each number lives

Open `stylesheets/mystyles.css`. There is one section per page (banners in capitals: `/*LANDING PAGE*/`, `/*WATER PAGE*/`, `/*DESERT PAGE*/`, `/*FOREST PAGE*/`). Each picture has its own `#id` rule, and nearly everything you will want to move is one of these five numbers:

| To change | Edit | Notes |
|---|---|---|
| where it sits | `left` and `top` | `%` of the box it sits in (the pile, the scene, the dragon), or `vw` / `vh` of the window |
| how big it is | `width` | the height follows from the picture |
| how it is tilted | `rotate` | degrees; negative leans left |
| who is in front | `z-index` | the higher number is nearer. On the Landing the numbers are the HTML order, back to front |
| when it appears or moves | `animation` and the `@keyframes` with the same name | the poses are listed in the `@keyframes`; the numbers after the name are seconds |

Where the numbers live:

| Page | Positions | Notes |
|---|---|---|
| Landing | `#paperCream` … `#typeIm` (21 rules, in HTML order) | `width` is in `em`: `#pile` sets `font-size:1vmax`, so 1em is 1% of the window's longer side and the whole pile scales together |
| Landing, the title | `@keyframes gatherIm`, `gatherG`, `gatherMa`, `gatherZe` | the `left` / `top` / `rotate` each scrap ends on |
| Water | `#lair` (where the hidden creature sits), `#lens` (the patch, measured from the lair), `#wiki`, `#stickyWampa`, `#watcherWater`, `#sandoWater`, `#swimMatya` | `#water main { height:460vh }` is how long the dive is. `top` of the creatures is how far down they are |
| Desert | `#colossus` (the dragon), the textures `#iceTex` `#barkTex` `#pageTex` `#sandTex` (`%` of the dragon, so they stay on the right spot), `#watch`, `#sun`, `#leMatya` | `@keyframes prowl` is the Le-matya's path |
| Forest | `#trunk1` … `#trunk9`, `#entCard`, `#twoTrees`, `#curtainL`, `#curtainR`, `#fernRaptor`, `#tauntaunDoor`, `#watcherDoor`, `#clump1`, `#clump2`, `#leaf1`, `#leaf2` | all `%` of **their scene** (each scene is one window wide). The comment "THE DEPTH" in that section lists which `z-index` is which layer |
| Forest, the length of the book | `#strip { width:300vw }` and `.scene { flex:0 0 100vw }` | three scenes of one window each |

A good way to learn it: change **one number**, save, refresh, and see what moved. Some to try:

- Landing: change `#reaperDoor`'s `left` to `60%`; then give it `z-index:+1` and watch it vanish behind the paper.
- Water: change `top:58vh` in `#stickyWampa` to `20vh`: where it sticks.
- Desert: change `scale:3.6` in `#leMatya:hover`; change `78vw` in `@keyframes prowl` to see where it stops.
- Forest: change `#entCard { left:38.5% }` to `50%` (it is no longer hidden); give `#fernRaptor` a `z-index` of `+8` (it is no longer hidden); change the `rgba(...)` numbers in `#shade` to change the mood of the three scenes.
- Anywhere: in `@keyframes`, change `2.4s` after the animation name to `8s`.

## Rebuilding things (optional)

- `python3 tools/make-zip.py` builds the submission ZIP: the four pages, the stylesheet, and only the images they use.
- `node tools/test-site.cjs` runs the checks (needs `npm i playwright` and `python3 -m http.server 8731` running in this folder).
- `tools/build-creatures.sh <ideation.pdf>` then `tools/build-gifs.sh` re-make the creature images, GIFs and the corrupted patch from the PDF. `node tools/build-textures.cjs` re-makes the textures. `python3 tools/build-foliage.py` then `node tools/rasterize-foliage.cjs` re-make the forest pictures (the editable SVG originals are in `tools/foliage-src/`).
