# Img.Maze — 3-page prototype

A cross-canon bestiary maze: a collage website you move through like a maze. No menu, no directing text — the pictures are the links.

This version is written like the Week 2 demo: plain HTML pages and one stylesheet (`stylesheets/mystyles.css`). **There is no JavaScript.** Every effect is CSS: `position`, `z-index`, `:hover`, `transition`, `:checked`.

## Open it

Open `index.html` in a browser (double-click is fine; no server needed).

## The three pages

| Page | Technique | What to try (nothing on the page says so) |
|---|---|---|
| **Landing** `index.html` | `z-index` cluster | Hover any piece: it jumps to the front, straightens and grows. Two pieces are doors: the Reaper Leviathan goes to Water, the Krayt dragon to Desert (they wiggle twice, 6 seconds after the page loads). |
| **Water** `water.html` | `position: fixed` + `position: sticky` | Scroll down: the light and the hidden creature stay fixed while the water behind them gets darker. Point at the corrupted patch and the hidden creature surfaces. The Wampa is sticky. The GIF at the very bottom is a door to Desert. The kelp patch (top right) is a link out to a wiki. |
| **Desert** `desert.html` | `position: absolute` + scale | **Click the sun:** the whole desert goes to night (click again for day). The patch of sand at the bottom right does the same. Point at the tiny Le-matya and it swells. Point at the still in the top left and it plays as a GIF. The ice and bark patches are links; the hatched paper is a link out to an encyclopedia. The sun is sticky: scroll down and it stays in the sky. |

The sun is a real button: it is a `<label>` for a hidden checkbox, and CSS reacts to the ticked box with `:checked` and `~` (comments in `mystyles.css` explain it).

## How the pages link

```
Landing → Water, Desert          (both are doors on the Landing pile)
Water   → Desert, and back to the start
Desert  → back to the start, and Water
```

Two of those links are **placeholders** so that no link is a dead end before Forest and Frozen exist. Each is marked `TEMP` in the HTML:

- Water, the sticky Wampa: goes to `index.html`, will go to `frozen.html`
- Desert, the ice patch: goes to `index.html`, will go to `frozen.html`
- Desert, the bark patch: goes to `water.html`, will go to `forest.html`

The full maze (from the site map) is Landing → Water, Desert · Water → Desert, Frozen · Desert → Frozen, Forest · Frozen → Forest, Landing · Forest → Landing, Water.

## Which picture is where

Rule: **a picture appears once on a page.** Creatures sit on their own biome's page. A creature from another biome only appears as a link to that biome (the "wrong-biome creature intruding"). The Landing is the one place where all the canons are mixed.

| Page | Pictures |
|---|---|
| Landing | All 11 creatures, once each (the Watcher is the animated one). One texture per environment (kelp, sand, ice, bark). Two backing papers (cream, kraft). Cut-up type. |
| Water | Home creatures: Reaper Leviathan (hidden), Watcher in the Water, Sando aqua monster. Intruders as links: Le-matya GIF (desert creature, → Desert) and the Wampa (snow creature, TEMP). Kelp (→ wiki). The corrupted patch is a glitched piece of the Reaper image. |
| Desert | Home creatures: Krayt dragon (the big anchor; its mouth is also the still and GIF in the top left, the one deliberate repeat) and Le-matya (tiny). Textures: ice and bark (links), hatched paper (link out), sand (light switch). |

## Against the brief

- **At least 3 interlinked pages:** 3, linked as above.
- **At least 2 working interactions per page:** Landing has hover-lift and two doors; Water has the reveal, the sticky link, the GIF door and the kelp link; Desert has the sun, the sand switch, the swelling Le-matya, the GIF and three links.
- **All CSS external:** everything is in `stylesheets/mystyles.css`. No `<style>` tags, no `style=""` attributes, no JavaScript. (Checked by the test script.)

## Files

```
index.html  water.html  desert.html
stylesheets/mystyles.css     the only stylesheet, one section per page
images/creatures/            the 11 creatures + the corrupted patch
images/gifs/                 le-matya-swim.gif, watcher-writhe.gif, krayt-shimmer.gif + krayt-eye.jpg (its still)
images/textures/             paper, kraft, sand, ice, bark, kelp, caustics, grain  (generated)
learn/                       a small lab: the three ideas behind the pages, plus an exercise (not part of the site or the submission)
tools/                       scripts that rebuild the images, build the ZIP and run the checks (not part of the site)
```

## Image credits

The creature images are the sourced stills from the ideation document (Visual Research, part 2). They are third-party artwork, used here for coursework and critique only, and are not cleared for public publication.

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

Everything else (textures, the glitched patch, the animation of the GIFs, the cut-paper edges) was generated for this prototype.

## Known limits

- **The outside links are placeholders and were not click-tested** (no internet where this was built): `subnautica.fandom.com/wiki/Reaper_Leviathan` and `en.wikipedia.org/wiki/Sandworm_(Dune)`. Each is one `href` in its page.
- **The GIFs are stand-ins** made from the still images. Swap in your own animation; they are ordinary `<img>` tags.
- **Tested in Chromium only** (78 automated checks, plus screenshots at 1920×1080, 1440×900, 1280×720 and 390×844). Not yet seen in Safari or Firefox.
- **Dropped from the first version** because they need JavaScript: dragging pieces on the Landing, shuffling the pile with a key, the idle-twitch timer, the frost canvas, and the scroll-driven forest peel. The first version (five pages, with JavaScript) is in git history at commit `7030b30`; Forest and Frozen will be rebuilt in this style next.

## Rebuilding things (optional)

- `python3 tools/make-zip.py` builds the submission ZIP: the three pages, the stylesheet, and only the images they use.
- `node tools/test-site.cjs` runs the checks (needs `npm i playwright` and `python3 -m http.server 8731` running in this folder).
- `tools/build-creatures.sh <ideation.pdf>` then `tools/build-gifs.sh` re-make the creature images, GIFs and the corrupted patch from the PDF. `node tools/build-textures.cjs` re-makes the textures.
