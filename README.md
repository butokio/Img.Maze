# Img.Maze: 4-page prototype

A cross-canon bestiary maze: a collage website you move through like a maze. No menu, no directing text: the pictures are the links.

This version is written like the Week 2 demo: plain HTML pages and one stylesheet (`stylesheets/mystyles.css`). **There is no JavaScript.** Every effect is CSS: `position`, `z-index`, `:hover`, `transition`, and (new) `@keyframes` started by a click on a hidden checkbox.

## Open it

Open `index.html` in a browser (double-click is fine; no server needed). Open it from the unzipped folder, not from a GitHub download: the creature pictures are not in git (see "Image credits").

## The four pages

| Page | Technique | What to try (nothing on the page says so) |
|---|---|---|
| **Landing** `index.html` | `z-index` cluster | Hover any piece: it jumps to the front, straightens and grows. Two pieces are doors: the Reaper Leviathan goes to Water, the Krayt dragon to Desert (they wiggle twice, 6 seconds after the page loads). **Click any scrap of lettering:** the four slide together and spell the name (click again and they scatter). |
| **Water** `water.html` | `position: fixed` + `position: sticky` | Scroll down: the light and the hidden creature stay fixed while the water behind them gets darker. Point at the corrupted patch and the hidden creature surfaces. **Click it:** the creature lunges at you, the whole reef shudders, and it stays out until you click again. The Wampa is sticky and is a door to the Forest. The GIF at the very bottom is a door to Desert. The kelp patch (top right) is a link out to a wiki. |
| **Desert** `desert.html` | `position: absolute` + scale | **Click the sun:** the whole desert goes to night and the tiny Le-matya prowls across the dunes (click again for day). The patch of sand at the bottom right does the same. Point at the Le-matya and it swells. Point at the still in the top left and it plays as a GIF. The bark patch is a door to the Forest, the ice patch a door back to the start, and the hatched paper is a link out to an encyclopedia. The sun is sticky: scroll down and it stays in the sky. |
| **Forest** `forest.html` | `z-index` depth + `position: relative`, as a storybook that scrolls **left to right** | Swipe sideways (or use the scroll bar, or the arrow keys) through three scenes. The ferns hanging at the end of scene 1 and scene 2 turn the page. Point at the Ent card hiding behind a trunk and it leans out (it is also a link out to an encyclopedia). In scene 2 the big picture hides behind leaves: **click them** and they part, the light of the two trees spills out (click the picture and they close). In scene 3 **click the raptor** and it bolts out of the grass. The Tauntaun is a door back to the start, the Watcher a door to Water. |

Click-triggered animations, all the same trick (a hidden checkbox, `:checked` and `~`, then `@keyframes`):

| Click | Hidden box | What plays |
|---|---|---|
| a scrap of lettering (Landing) | `#spell` | `gatherIm`, `gatherG`, `gatherMa`, `gatherZe`: each scrap slides to its place in the row |
| the glitch patch (Water) | `#summon` | `lunge` on the creature and `tremor` on the whole reef |
| the sun or the sand patch (Desert) | `#night` | `prowl` on the Le-matya (and the day / night fades, which are `transition`s) |
| the leaves (Forest scene 2) | `#peel` | `partsLeft` and `partsRight` on the two curtains (and a glow on the picture) |
| the raptor (Forest scene 3) | `#dash` | `dash` on the raptor |

## How the pages link

```
Landing → Water, Desert
Water   → Desert, Forest        (and the kelp, out to a wiki)
Desert  → Forest, Landing       (and the hatched paper, out to an encyclopedia)
Forest  → Landing, Water        (and the Ent card, out to an encyclopedia)
```

Every page has two ways out, none is a dead end, and each way out is a **piece of another place pasted onto the page**: the Reaper and the Krayt dragon on the Landing, the Wampa and the Le-matya GIF on Water, the bark and ice patches on Desert, the Tauntaun and the Watcher on Forest. The Frozen page from the plan was not built: its creatures (Wampa, Tauntaun, Ravinak) appear on the other pages as the intruders.

## How to change things (positions, sizes, depth)

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

## Which picture is where

Rule: **a picture appears once on a page.** Creatures sit on their own biome's page. A creature from another biome only appears as a link to somewhere else (the "wrong-biome creature intruding"). The Landing is the one place where all the canons are mixed.

| Page | Pictures |
|---|---|
| Landing | All 11 creatures, once each (the Watcher is the animated one). One texture per environment (kelp, sand, ice, bark). Two backing papers (cream, kraft). Cut-up type. |
| Water | Home creatures: Reaper Leviathan (hidden), Watcher in the Water, Sando aqua monster. Intruders as links: Le-matya GIF (desert creature, to Desert) and the Wampa (snow creature, to Forest). Kelp (to a wiki). The corrupted patch is a glitched piece of the Reaper image. |
| Desert | Home creatures: Krayt dragon (the big anchor; its mouth is also the still and GIF in the top left, the one deliberate repeat) and Le-matya (tiny). Textures: ice (to the start) and bark (to Forest), hatched paper (to an encyclopedia), sand (light switch). |
| Forest | Home creatures: Ent (Treebeard card), Ungoliant & the Two Trees (the big picture), Velociraptor. Intruders as links: the Tauntaun (snow creature, to the start) and the Watcher GIF (lake creature, to Water). The trees, ferns and grass are generated paper-cut pictures. |

## Against the brief

- **At least 3 interlinked pages:** 4, linked as above.
- **At least 2 working interactions per page:** Landing has hover-lift, the title and two doors; Water has the reveal, the summoning, the sticky link, the GIF door and the kelp link; Desert has the sun, the sand switch, the prowling and swelling Le-matya, the GIF and three links; Forest has the swipe, the ferns, the Ent, the leaves, the raptor and three links.
- **All CSS external:** everything is in `stylesheets/mystyles.css`. No `<style>` tags, no `style=""` attributes, no JavaScript. (Checked by the test script.)
- **From the feedback:** animation started by clicking another element (five of them, see the table above) and a layout that unfolds from left to right with interactive parts (the Forest).

## Files

```
index.html  water.html  desert.html  forest.html
stylesheets/mystyles.css     the only stylesheet, one section per page
images/creatures/            the 11 creatures + the corrupted patch
images/gifs/                 le-matya-swim.gif, watcher-writhe.gif, krayt-shimmer.gif + krayt-eye.jpg (its still)
images/textures/             paper, kraft, sand, ice, bark, kelp, caustics, grain  (generated)
images/foliage/              the far trees, nine trunks, curtains, tufts, ferns and grass of the Forest  (generated)
learn/                       a small lab: the three ideas behind the pages, plus an exercise (not part of the site or the submission)
tools/                       scripts that rebuild the images, build the ZIP and run the checks (not part of the site)
```

## Image credits

The creature images are the sourced stills from the ideation document (Visual Research, part 2). They are third-party artwork, used here for coursework and critique only, and are not cleared for public publication. For that reason `images/creatures/` and `images/gifs/` are **not in the git repository**; they are in the submission ZIP.

| Creature | Canon | Source noted in the ideation document |
|---|---|---|
| Reaper Leviathan | Subnautica | deviantart.com/adam-the-person |
| Watcher in the Water | LOTR | tolkiengateway.net (artwork © John Howe; his watermark is left visible) |
| Sando aqua monster | Star Wars | fandom.com |
| Krayt dragon | Star Wars | disney.fandom.com |
| Le-matya | Star Trek | deviantart.com/cynomolge |
| Ent / Treebeard (TCG card) | LOTR | wiki.lotrtcgpc.net |
| Ungoliant & the Two Trees | Tolkien | cbr.com |
| Velociraptor | none | dinosaurpictures.org |
| Wampa | Star Wars | kaiju.wikidot.com |
| Tauntaun | Star Wars | happybeeps.net |
| Ravinak | Star Trek | rpggamer.org |

Everything else (textures, the forest's trees, ferns and grass, the glitched patch, the animation of the GIFs, the cut-paper edges) was generated for this prototype.

## Known limits

- **No outside link was click-tested** (no internet where this was built): `subnautica.fandom.com/wiki/Reaper_Leviathan`, `en.wikipedia.org/wiki/Sandworm_(Dune)` and `en.wikipedia.org/wiki/Ent`. Each is one `href` in its page.
- **The GIFs are stand-ins** made from the still images. Swap in your own animation; they are ordinary `<img>` tags.
- **Tested in Chromium only** (133 automated checks, plus screenshots at 1920×1080, 1440×900, 1280×720, 1024×768 and 390×844). Not yet seen in Safari or Firefox. The CSS needs roughly Safari 16 or newer.
- **Clicking a switch again snaps things back** (the Landing scraps, the Le-matya, the leaves, the raptor) rather than animating backwards. The fades on the Desert and the Water do ease back.
- **On a phone** the Forest is a panorama you pan across; the other pages were laid out for a laptop first.
- **Dropped from the first version** because they need JavaScript: dragging pieces on the Landing, shuffling the pile with a key, the idle-twitch timer, the frost canvas, and the scroll-driven forest peel (replaced by the click-driven one). The first version (five pages, with JavaScript) is in git history at commit `7030b30`.

## Rebuilding things (optional)

- `python3 tools/make-zip.py` builds the submission ZIP: the four pages, the stylesheet, and only the images they use.
- `node tools/test-site.cjs` runs the checks (needs `npm i playwright` and `python3 -m http.server 8731` running in this folder).
- `tools/build-creatures.sh <ideation.pdf>` then `tools/build-gifs.sh` re-make the creature images, GIFs and the corrupted patch from the PDF. `node tools/build-textures.cjs` re-makes the textures. `python3 tools/build-foliage.py` then `node tools/rasterize-foliage.cjs` re-make the forest pictures (the editable SVG originals are in `tools/foliage-src/`).
