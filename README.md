# Img.Maze — in-progress prototype

A cross-canon bestiary maze: a multi-page collage website navigated like a maze. No menu, no directing text — the images are the links. Recognisable creatures from canons that never meet (Subnautica, Star Wars, Star Trek, Tolkien, deep time) share four environments, and each environment is a different CSS technique.

## Open it

Open `index.html` in a browser. Double-clicking works; no server or build step is needed. Best on a laptop or desktop, and it also holds up on a phone.

## The maze

Five pages. Every pair is connected once, one-way, so you loop forward rather than backtrack. Each link is a creature (or scrap) from the *destination* intruding on the page you are on.

```
Landing → Water, Desert
Water   → Desert, Frozen
Desert  → Frozen, Forest
Frozen  → Forest, Landing
Forest  → Landing, Water
```

Each biome also has one exit to an outside wiki or encyclopedia (opens in a new tab).

## What each page does

Nothing on the pages says where to click; this table is the key.

| Page | Technique | Interactions |
|---|---|---|
| **Landing** `index.html` | `z-index` cluster / chaos | Hover lifts a piece to the front · drag any piece · press any letter to shuffle the pile · leave it alone and the two doors twitch · the Reaper is a door to Water, the Krayt dragon a door to Desert |
| **Water** `water.html` | `position: fixed` + `position: sticky` | The sea is fixed and darkens as you scroll · the dominant creature is hidden (only murk and ripples show) and surfaces when you hover, focus or tap the corrupted patch · the sticky Wampa stays pinned and leads to Frozen · the GIF at the bottom leads to Desert · the kelp patch is an exit to the Subnautica wiki · the Watcher and Sando drift past as you descend |
| **Desert** `desert.html` | `position: absolute` + scale | One vast anchor image against very small things · hover, focus or tap a speck and it swells to full size · hover or click the still in the top left and it plays as a GIF · ←/→, 1–4 or any letter change the light (noon, dusk, night, eclipse) · three textures are doors (ice → Frozen, bark → Forest, engraving → encyclopedia) · the spare sand texture also shifts the light · the top-right creature is sticky · the Le-matya is `position: relative` |
| **Forest** `forest.html` | `z-index` depth + `position: relative` | Six stacked paper planes · scrolling peels them (nearer planes grow faster, so you walk forward) · creatures peek from between planes or break the one they stand in front of, and lean out on hover · after the peel the Ent (exit) and two doors (Water, back to the start) appear in the clearing |
| **Frozen** `frozen.html` | stillness + thaw | No scroll · frost closes over the page the longer you hold still, edges first · moving the pointer thaws a path through it, and it freezes over again · the highlighted circle (a misplaced Velociraptor) leads to Forest · the unrelated scrap leads back to the start · the starred circle is an exit to a wiki · glints and a ring sit above the frost so the exits stay a promise even when the ice has closed |

## Against the brief

- **At least 3 interlinked pages:** 5, joined by the link graph above.
- **At least 2 working interactions per page:** every page has four or more (listed above).
- **All CSS in an external stylesheet:** everything is in `css/style.css`. There are no `<style>` tags and no `style=""` attributes in any HTML file. The one thing JavaScript does is hand the stylesheet a few numbers as CSS custom properties (`--dx`/`--dy`/`--z`/`--rot` on dragged pieces, `--depth` and `--p` on scroll); what those numbers *look like* is decided in the CSS.
- **Hidden links are still reachable by keyboard:** every link and button is focusable with a visible focus ring, has an accessible name, and every image has alt text (the site is wordless on screen, not for screen readers). `prefers-reduced-motion` is respected.

## Files

```
index.html  water.html  desert.html  forest.html  frozen.html
css/style.css          the only stylesheet, one banner-commented section per page
js/main.js             plain JavaScript, commented; no libraries, no modules
img/creatures/         the 11 creatures (JPEG, or PNG cut-outs where the source had a white background)
img/gifs/              flicker.gif (landing), lematya-swim.gif (water), watcher-writhe.gif + still (desert)
img/textures/          paper, sand, ice, bark, kelp, caustics, frost, grain  (generated)
img/foliage/           forest planes as PNG; the editable SVG originals are in img/foliage/src/
tools/                 scripts that rebuild the assets, and the test script (not needed to run the site)
```

## Image credits

The creature images are the sourced stills from the ideation document (Visual Research, part 2). They are third-party artwork, used here for coursework and critique only; they are not cleared for public publication.

| Creature | Canon | Source noted in the ideation document |
|---|---|---|
| Reaper Leviathan | Subnautica | deviantart.com/adam-the-person |
| Watcher in the Water | LOTR | tolkiengateway.net (artwork © John Howe; his watermark is left visible) |
| Sando aqua monster | Star Wars | fandom.com |
| Krayt dragon | Star Wars | disney.fandom.com |
| Le-matya | Star Trek | deviantart.com/cynomolge |
| Ent / Treebeard (TCG card) | LOTR | wiki.lotrtcgpc.net |
| Ungoliant & the Two Trees | Tolkien | cbr.com |
| Velociraptor | — | dinosaurpictures.org |
| Wampa | Star Wars | kaiju.wikidot.com |
| Tauntaun | Star Wars | happybeeps.net |
| Ravinak | Star Trek | rpggamer.org |

Everything else — textures, foliage, the glitched "corrupted" patch, the animation of the GIFs, the cut-paper edges — was generated or built for this prototype.

## Known limits

- **External links are placeholders.** They point to these pages and were not click-tested: `subnautica.fandom.com/wiki/Reaper_Leviathan`, `en.wikipedia.org/wiki/Sandworm_(Dune)`, `en.wikipedia.org/wiki/Ent`, `starwars.fandom.com/wiki/Wampa`. Swap in whichever wiki or encyclopedia pages you prefer; each is a single `href` in its page.
- **The GIFs are stand-ins** made from the still images (a channel-surf, a wave-warp, a ripple). Replace them with your own animation; the slots are ordinary `<img>` tags.
- **Tested in Chromium only** (all five pages, 102 automated checks, plus screenshots at 1920×1080, 1440×900, 1280×720, 1024×768 and 390×844). Not yet seen in Safari or Firefox.
- **Discoverability is the main risk of the concept.** There is no text to fall back on, so the cursor change on hover, the idle twitch on the Landing, the ripples on Water and the glints on Frozen are the only hints. Worth watching a first-time visitor try it.

## Rebuilding the assets (optional)

`tools/build-creatures.sh <ideation.pdf>` re-extracts the creatures from the PDF, then `tools/build-gifs.sh` makes the GIFs and the corrupted patch. `node tools/build-textures.cjs` and `python3 tools/build-foliage.py` + `node tools/rasterize-foliage.cjs` regenerate the textures and forest planes. `node tools/test-site.cjs` re-runs the checks against a local server (`python3 -m http.server 8731`).
