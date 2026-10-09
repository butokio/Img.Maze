/*
 * Checks for the 4-page Img.Maze site (plain HTML + CSS, no JavaScript).
 *   npm i playwright                      (once)
 *   python3 -m http.server 8731           (in the project folder, in another terminal)
 *   node tools/test-site.cjs
 * Set BASE=http://host:port/ to use a different server. ImageMagick (`convert`) is used to sample screenshot pixels.
 */
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASE = process.env.BASE || 'http://127.0.0.1:8731/';
const PAGES = ['index', 'water', 'desert', 'forest'];
const VW = 1440, VH = 900;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

/* ---------- static: the brief, the demo's style, and "every picture once" ---------- */
function staticChecks() {
  const allRefs = new Set();
  const idsSeen = {};
  for (const n of PAGES) {
    const html = fs.readFileSync(path.join(ROOT, n + '.html'), 'utf8');
    check(`[static] ${n}.html has no <style> tag`, !/<style[\s>]/i.test(html));
    check(`[static] ${n}.html has no inline style="" attribute`, !/\sstyle\s*=/i.test(html));
    check(`[static] ${n}.html has no JavaScript at all`, !/<script[\s>]/i.test(html) && !/\son[a-z]+\s*=/i.test(html));
    check(`[static] ${n}.html links stylesheets/mystyles.css`, /<link[^>]+href="stylesheets\/mystyles\.css"/.test(html));
    check(`[static] ${n}.html has a <title>`, /<title>[^<]+<\/title>/.test(html));
    const refs = [...html.matchAll(/(?:href|src)="([^"#]+)"/g)].map((m) => m[1]).filter((u) => !/^(https?:|data:|mailto:)/.test(u));
    refs.forEach((r) => allRefs.add(r));
    const missing = refs.filter((u) => !fs.existsSync(path.join(ROOT, u)));
    check(`[static] ${n}.html: all ${refs.length} local hrefs/srcs exist`, missing.length === 0, missing.join(', '));
    const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    const srcs = imgs.map((t) => (t.match(/\ssrc="([^"]+)"/) || [])[1]);
    const dupes = srcs.filter((s, i) => srcs.indexOf(s) !== i);
    check(`[static] ${n}.html: every picture appears once (no repeats on the page)`, dupes.length === 0, [...new Set(dupes)].join(', '));
    check(`[static] ${n}.html: every <img> has an alt attribute`, imgs.every((t) => /\salt="/.test(t)));
    check(`[static] ${n}.html: pieces with real content have alt text`, imgs.filter((t) => /creatures\//.test(t) && !/reaper-glitch/.test(t)).every((t) => /\salt="[^"]{8,}"/.test(t)));
    // the hidden checkboxes: first thing in the <body> (so ~ can reach everything after them) and named for screen readers
    const body = html.replace(/<!--[\s\S]*?-->/g, '').match(/<body[^>]*>([\s\S]*)<\/body>/)[1].trim();
    const switches = [...body.matchAll(/<input\b[^>]*class="switch"[^>]*>/g)].map((m) => m[0]);
    check(`[static] ${n}.html: ${switches.length} hidden switch(es), all before everything they change`, switches.length > 0 && /^(<input\b[^>]*class="switch"[^>]*>\s*)+<(main|div|section)\b/.test(body));
    check(`[static] ${n}.html: every hidden switch has an aria-label`, switches.every((t) => /aria-label="[^"]{3,}"/.test(t)));
    for (const m of html.matchAll(/\sid="([^"]+)"/g)) (idsSeen[m[1]] = idsSeen[m[1]] || new Set()).add(n);
  }
  // one stylesheet serves every page, so an id used on two pages would pick up the other page's rules
  const clash = Object.entries(idsSeen).filter(([id, pg]) => pg.size > 1 && id !== 'grain').map(([id, pg]) => `#${id} (${[...pg].join(' + ')})`);
  check('[static] no id is used on two pages (the stylesheet is shared)', clash.length === 0, clash.join(', '));
  const css = fs.readFileSync(path.join(ROOT, 'stylesheets/mystyles.css'), 'utf8');
  const urls = [...css.matchAll(/url\("?([^")]+)"?\)/g)].map((m) => m[1]).filter((u) => !u.startsWith('data:'));
  const missing = urls.filter((u) => !fs.existsSync(path.join(ROOT, 'stylesheets', u)));
  check(`[static] mystyles.css: all ${urls.length} url() assets exist`, missing.length === 0, missing.join(', '));
  check('[static] mystyles.css uses no custom properties or JS-fed values (plain CSS)', !/var\(--|--[a-z]+\s*:/.test(css));
  check('[static] no .js files in the project', !fs.readdirSync(ROOT, { recursive: true }).some((f) => /\.js$/.test(f) && !/^tools[\\/]/.test(f) && !/node_modules/.test(f)));
  // everything in images/ is used by a page or the stylesheet (nothing stray in the submission)
  const used = new Set([...allRefs].filter((r) => r.startsWith('images/')).concat(urls.map((u) => 'images/' + u.replace(/^\.\.\/images\//, ''))));
  const onDisk = fs.readdirSync(path.join(ROOT, 'images'), { recursive: true }).filter((f) => /\.[a-z]+$/i.test(f)).map((f) => 'images/' + f.replace(/\\/g, '/'));
  const stray = onDisk.filter((f) => !used.has(f) && f !== 'images/favicon.svg');
  check('[static] every file in images/ is used by a page', stray.length === 0, 'unused: ' + stray.join(', '));
}

/* a point inside el where el (or a child) is really the topmost thing, so a click lands on it */
async function visiblePoint(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel); if (!el) return null;
    const r = el.getBoundingClientRect();
    for (let fy = 0.5; fy <= 0.95; fy += 0.05) for (let fx = 0.15; fx <= 0.85; fx += 0.05) {
      const x = r.left + r.width * fx, y = r.top + r.height * fy;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
      const top = document.elementFromPoint(x, y);
      if (top && (top === el || el.contains(top))) return { x, y };
    }
    return null;
  }, selector);
}
const brightness = (file, x, y) => parseFloat(execFileSync('convert', [file, '-crop', '30x30+' + x + '+' + y, '+repage', '-format', '%[fx:mean]', 'info:']).toString());

(async () => {
  staticChecks();
  const browser = await chromium.launch();
  const newPage = async (name, opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, ...opts });
    const page = await ctx.newPage();
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
    page.on('requestfailed', (r) => page.errors.push('failed: ' + r.url()));
    await page.goto(BASE + name + '.html'); await page.waitForTimeout(900);
    return page;
  };
  const scrollFrac = async (page, f) => { await page.evaluate((f) => window.scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * f, behavior: 'instant' }), f); await page.waitForTimeout(350); };
  const goScene = async (page, n) => { await page.evaluate((n) => document.getElementById('book').scrollTo({ left: innerWidth * n, behavior: 'instant' }), n); await page.waitForTimeout(450); };
  const css = (page, sel, prop) => page.$eval(sel, (e, p) => getComputedStyle(e)[p], prop);
  const rectOf = (page, sel) => page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; });
  const finish = (page, name) => page.evaluate((n) => document.getAnimations().filter((a) => a.animationName === n).forEach((a) => a.finish()), name);
  const click = async (page, sel) => { const p = await visiblePoint(page, sel); if (!p) return false; await page.mouse.click(p.x, p.y); return true; };
  const waitClick = async (page, sel, dest, label) => {
    const p2 = await visiblePoint(page, sel);
    if (!p2) { check(label, false, 'no clickable point (covered?)'); return; }
    await page.mouse.click(p2.x, p2.y);
    try { await page.waitForURL('**/' + dest, { timeout: 4000 }); check(label, true); } catch (e) { check(label, false, page.url()); }
  };

  /* ---------- link graph ---------- */
  const expectInternal = { index: ['desert.html', 'water.html'], water: ['desert.html', 'forest.html'], desert: ['forest.html', 'index.html'], forest: ['index.html', 'water.html'] };
  for (const n of PAGES) {
    const page = await newPage(n);
    const internal = await page.$$eval('a[target="_self"]', (as) => [...new Set(as.map((a) => a.getAttribute('href')))].sort());
    const ext = await page.$$eval('a[target="_blank"]', (as) => as.map((a) => ({ href: a.href, rel: a.rel })));
    check(`[links] ${n} → ${expectInternal[n].join(' + ')} (no dead ends, no placeholders)`, JSON.stringify(internal) === JSON.stringify(expectInternal[n]), internal.join(', '));
    if (n === 'index') check('[links] index has no outside links', ext.length === 0);
    else check(`[links] ${n} has one outside link that opens a new tab safely`, ext.length === 1 && /noopener/.test(ext[0].rel), JSON.stringify(ext));
    const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
    check(`[layout] ${n}: no horizontal scrollbar on the page`, overflow <= 1, `overflow ${overflow}px`);
    check(`[console] ${n}: no errors`, page.errors.length === 0, page.errors.join(' | '));
    await page.context().close();
  }

  /* ---------- LANDING ---------- */
  let page = await newPage('index');
  const zs = await page.$$eval('#pile .piece', (els) => els.map((e) => +getComputedStyle(e).zIndex));
  check('[landing] 21 pieces, z-index rises by one in HTML order (the order you read = the order they stack)', zs.length === 21 && zs.every((z, i) => z === i + 1), zs.join(','));
  const backingPE = await page.$$eval('.backing', (els) => els.map((e) => getComputedStyle(e).pointerEvents));
  check('[landing] the backing paper ignores the mouse', backingPE.length === 2 && backingPE.every((p) => p === 'none'), backingPE.join(','));
  let pt = await visiblePoint(page, '#wampa');
  const rot0 = await css(page, '#wampa', 'rotate');
  await page.mouse.move(pt.x, pt.y); await page.waitForTimeout(700);
  const hov = { z: +(await css(page, '#wampa', 'zIndex')), rot: await css(page, '#wampa', 'rotate'), scale: await css(page, '#wampa', 'scale') };
  check('[landing] hover: the piece jumps to the front, straightens and grows', hov.z === 100 && /^(none|0deg)$/.test(hov.rot) && parseFloat(hov.scale) > 1.03, `z=${hov.z}, rotate ${rot0} → ${hov.rot}, scale ${hov.scale}`);
  await page.mouse.move(5, 5); await page.waitForTimeout(700);
  check('[landing] …and settles back when you move away', (await css(page, '#wampa', 'zIndex')) === '16' && (await css(page, '#wampa', 'rotate')) === rot0);
  const door = await page.$$eval('.door', (els) => els.map((e) => ({ id: e.id, tag: e.tagName, anim: getComputedStyle(e).animationName, delay: getComputedStyle(e).animationDelay, count: getComputedStyle(e).animationIterationCount })));
  check('[landing] two doors, both <a>, both wiggle twice after 6s as the only hint', door.length === 2 && door.every((d) => d.tag === 'A' && d.anim === 'wiggle' && d.delay === '6s' && d.count === '2'), JSON.stringify(door));
  await page.waitForTimeout(6500);
  const wig = await page.$eval('#kraytDoor', (e) => e.getAnimations().map((a) => a.animationName + ':' + a.playState).join());
  check('[landing] the wiggle is really running at ~7s', /wiggle:running/.test(wig), wig);
  await page.context().close();
  for (const [sel, dest] of [['#reaperDoor', 'water.html'], ['#kraytDoor', 'desert.html']]) {
    page = await newPage('index'); await waitClick(page, sel, dest, `[landing] ${sel} door → ${dest}`); await page.context().close();
  }
  // THE TITLE: click a scrap of lettering, the four gather in a row and spell the name
  page = await newPage('index');
  const letters = ['typeIm', 'typeG', 'typeMa', 'typeZe'];
  const pile0 = {}; for (const id of letters) pile0[id] = await rectOf(page, '#' + id);
  const type0 = parseFloat(await css(page, '#typeIm .scrap', 'fontSize'));
  check('[landing] the four lettering scraps are labels for one hidden box', (await page.$$eval('label.letter[for="spell"]', (e) => e.length)) === 4);
  await click(page, '#typeIm'); await page.waitForTimeout(500);
  const anims = await page.$$eval('.letter', (els) => els.map((e) => getComputedStyle(e).animationName).sort().join());
  check('[landing] click a scrap: the box ticks and each of the four plays its own animation', (await page.$eval('#spell', (e) => e.checked)) && anims === 'gatherG,gatherIm,gatherMa,gatherZe', anims);
  await page.waitForTimeout(2300); await page.mouse.move(5, 5); await page.waitForTimeout(500);
  const row = {}; for (const id of letters) row[id] = await rectOf(page, '#' + id);
  const inOrder = row.typeIm.l < row.typeG.l && row.typeG.l < row.typeMa.l && row.typeMa.l < row.typeZe.l;
  const tops = letters.map((id) => row[id].t), bandOk = Math.max(...tops) - Math.min(...tops) < VH * 0.1;
  const type1 = parseFloat(await css(page, '#typeIm .scrap', 'fontSize'));
  check('[landing] …they end in a row, in reading order (Im g. Ma ze), and the lettering shrinks so every letter shows', inOrder && bandOk && type1 < type0 * 0.65, `lefts ${letters.map((id) => Math.round(row[id].l)).join(' < ')}, type ${type0.toFixed(0)}px → ${type1.toFixed(0)}px`);
  check('[landing] the row is in front of everything (z-index 300)', (await css(page, '#typeMa', 'zIndex')) === '300');
  await click(page, '#typeMa'); await page.mouse.move(5, 5); await page.waitForTimeout(1500);
  const back = await rectOf(page, '#typeIm');
  check('[landing] click again: the scraps scatter back to the pile', !(await page.$eval('#spell', (e) => e.checked)) && Math.abs(back.l - pile0.typeIm.l) < 3, `Im left ${Math.round(pile0.typeIm.l)} → ${Math.round(row.typeIm.l)} → ${Math.round(back.l)}`);
  await page.context().close();
  page = await newPage('index');
  await page.keyboard.press('Tab');
  const lFocus = await page.evaluate(() => document.activeElement.id);
  await page.keyboard.press('Space'); await page.waitForTimeout(200);
  const lOn = await page.$eval('#spell', (e) => e.checked);
  await page.keyboard.press('Space'); await page.waitForTimeout(200);
  check('[landing] keyboard: Tab reaches the hidden box, Space puts the title together and apart', lFocus === 'spell' && lOn && !(await page.$eval('#spell', (e) => e.checked)), `focus on #${lFocus}`);
  await page.context().close();

  /* ---------- WATER ---------- */
  page = await newPage('water');
  await scrollFrac(page, 1);
  const fixedInfo = await page.$$eval('#lightWebs, #snow, #reef', (els) => els.map((e) => [e.id, getComputedStyle(e).position, Math.round(e.getBoundingClientRect().top)]));
  check('[water] the light, the snow and the reef are position:fixed (still at top:0 after scrolling to the bottom)', fixedInfo.length === 3 && fixedInfo.every((f) => f[1] === 'fixed' && f[2] === 0), JSON.stringify(fixedInfo));
  const shotTop = path.join(os.tmpdir(), 'w-top.png'), shotBot = path.join(os.tmpdir(), 'w-bot.png');
  await scrollFrac(page, 0); await page.mouse.move(700, 880); await page.screenshot({ path: shotTop });
  await scrollFrac(page, 1); await page.screenshot({ path: shotBot });
  const bTop = brightness(shotTop, 760, 700), bBot = brightness(shotBot, 760, 500);
  check('[water] the page behind scrolls and gets darker (water → deep water)', bBot < bTop - 0.25, `brightness ${bTop.toFixed(2)} → ${bBot.toFixed(2)}`);
  let kept = true, bottoms = [];
  for (const f of [0.1, 0.3, 0.55, 0.8, 0.97]) {
    await scrollFrac(page, f);
    const r = await page.$eval('#stickyWampa', (e) => { const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom }; });
    bottoms.push(Math.round(r.bottom)); if (!(r.top >= 0 && r.bottom <= VH)) kept = false;
  }
  check('[water] the sticky Wampa stays in view for the whole dive', kept && (await css(page, '#stickyWampa', 'position')) === 'sticky', 'bottom edge at ' + bottoms.join(', '));
  await scrollFrac(page, 0);
  const op0 = +(await css(page, '#anchor', 'opacity'));
  const lensPt = await visiblePoint(page, '#lens');
  await page.mouse.move(lensPt.x, lensPt.y); await page.waitForTimeout(1200);
  const op1 = +(await css(page, '#anchor', 'opacity')), flt = await css(page, '#anchor', 'filter');
  check('[water] hover the corrupted lens: the hidden creature comes out of the murk', op0 < 0.5 && op1 > 0.97 && flt === 'none', `opacity ${op0} → ${op1}, filter ${flt}`);
  await page.mouse.move(700, 880); await page.waitForTimeout(4600);
  check('[water] …and sinks back after a delay', +(await css(page, '#anchor', 'opacity')) < 0.5);
  await page.context().close();
  // THE SUMMONING: click the lens
  page = await newPage('water');
  const lp = await visiblePoint(page, '#lens'); await page.mouse.click(lp.x, lp.y); await page.waitForTimeout(450);
  const names = { anchor: await css(page, '#anchor', 'animationName'), lair: await css(page, '#lair', 'animationName') };
  const midScale = parseFloat(await css(page, '#anchor', 'scale'));
  check('[water] click the glitch patch: the box ticks, the creature lunges and the reef shudders (two animations from one click)', (await page.$eval('#summon', (e) => e.checked)) && names.anchor === 'lunge' && names.lair === 'tremor' && midScale > 1.05, `${JSON.stringify(names)}, scale ${midScale.toFixed(2)} at 0.45s`);
  await page.mouse.move(700, 880); await page.waitForTimeout(2600);
  check('[water] …and it stays out of the murk after you move away (scale 1.12, fully visible)', Math.abs(parseFloat(await css(page, '#anchor', 'scale')) - 1.12) < 0.01 && +(await css(page, '#anchor', 'opacity')) > 0.97);
  await page.mouse.click(lp.x, lp.y); await page.mouse.move(700, 880); await page.waitForTimeout(5200);
  check('[water] click again: it sinks back into the murk', !(await page.$eval('#summon', (e) => e.checked)) && +(await css(page, '#anchor', 'opacity')) < 0.5);
  await page.context().close();
  page = await newPage('water');
  await page.keyboard.press('Tab');
  const focusSummon = await page.evaluate(() => document.activeElement.id);
  await page.waitForTimeout(1200);
  const kOp = +(await css(page, '#anchor', 'opacity'));
  await page.keyboard.press('Space'); await page.waitForTimeout(300);
  check('[water] keyboard: the first Tab reaches the hidden box and reveals the creature; Space makes it lunge', focusSummon === 'summon' && kOp > 0.97 && (await css(page, '#anchor', 'animationName')) === 'lunge', `focus on #${focusSummon}`);
  await page.context().close();
  page = await newPage('water'); await scrollFrac(page, 0.4); await waitClick(page, '#stickyWampa', 'forest.html', '[water] sticky Wampa → forest.html'); await page.context().close();
  page = await newPage('water'); await scrollFrac(page, 1); await waitClick(page, '#swimMatya', 'desert.html', '[water] GIF at the bottom → desert.html'); await page.context().close();

  /* ---------- DESERT ---------- */
  page = await newPage('desert');
  const day = { sky: +(await css(page, '#skyNight', 'opacity')), sand: await css(page, '#sand', 'backgroundColor'), kr: await css(page, '#krayt', 'filter'), checked: await page.$eval('#night', (e) => e.checked) };
  const lmStart = (await rectOf(page, '#leMatya')).l;
  const sunPt = await visiblePoint(page, '#sun');
  await page.mouse.click(sunPt.x, sunPt.y); await page.waitForTimeout(1900);
  const night = { sky: +(await css(page, '#skyNight', 'opacity')), sand: await css(page, '#sand', 'backgroundColor'), kr: await css(page, '#krayt', 'filter'), checked: await page.$eval('#night', (e) => e.checked), moon: +(await page.$eval('#sun', (e) => +getComputedStyle(e, '::after').opacity)) };
  check('[desert] clicking the sun ticks the hidden box and the whole desert goes to night', !day.checked && night.checked && night.sky === 1 && night.sand !== day.sand && night.kr !== day.kr && night.moon === 1, `sky α ${day.sky}→${night.sky}, sand ${day.sand}→${night.sand}, moon α ${night.moon}`);
  const prowlName = await css(page, '#leMatya', 'animationName');
  const lmMid = (await rectOf(page, '#leMatya')).l;
  check('[desert] the same click sends the Le-matya prowling across the dunes (animation "prowl")', prowlName === 'prowl' && lmMid > lmStart + 20, `left ${Math.round(lmStart)} → ${Math.round(lmMid)}px after 1.9s`);
  await finish(page, 'prowl');
  const lmEnd = (await rectOf(page, '#leMatya')).l;
  check('[desert] …and it ends on the far side of the dunes (78vw), where it stays while it is night', Math.abs(lmEnd - VW * 0.78) < 3, `left ${Math.round(lmEnd)}px`);
  await page.mouse.click(sunPt.x, sunPt.y); await page.waitForTimeout(1900);
  check('[desert] clicking again brings the day back (and the Le-matya goes home)', !(await page.$eval('#night', (e) => e.checked)) && +(await css(page, '#skyNight', 'opacity')) === 0 && (await css(page, '#sand', 'backgroundColor')) === day.sand && Math.abs((await rectOf(page, '#leMatya')).l - lmStart) < 3);
  const sandPt = await visiblePoint(page, '#sandTex');
  await page.mouse.click(sandPt.x, sandPt.y); await page.waitForTimeout(300);
  check('[desert] the patch of sand is a second switch', await page.$eval('#night', (e) => e.checked));
  await page.mouse.click(sandPt.x, sandPt.y); await page.waitForTimeout(300);
  await page.context().close();
  // keyboard on a fresh page: the hidden box is the first thing Tab reaches
  page = await newPage('desert');
  await page.keyboard.press('Tab');
  const focusId = await page.evaluate(() => document.activeElement.id);
  await page.keyboard.press('Space'); await page.waitForTimeout(200);
  const kbOn = await page.$eval('#night', (e) => e.checked);
  await page.keyboard.press('Space'); await page.waitForTimeout(200);
  const kbOff = !(await page.$eval('#night', (e) => e.checked));
  check('[desert] keyboard: Tab reaches the hidden box, Space switches the light on and off', focusId === 'night' && kbOn && kbOff, `focus on #${focusId}`);
  await page.context().close();
  // hovers and scrolling on another fresh page
  page = await newPage('desert');
  const lm0 = await css(page, '#leMatya', 'scale');
  const lmPt = await visiblePoint(page, '#leMatya');
  await page.mouse.move(lmPt.x, lmPt.y); await page.waitForTimeout(1100);
  const lm1 = await css(page, '#leMatya', 'scale');
  check('[desert] hover the tiny Le-matya: it swells (scale 1 → 3.6)', parseFloat(lm1) > 3.5 && (lm0 === 'none' || parseFloat(lm0) === 1), `${lm0} → ${lm1}`);
  await page.mouse.move(5, 5); await page.waitForTimeout(900);
  const g0 = +(await css(page, '#eyeGif', 'opacity'));
  const wPt = await visiblePoint(page, '#watch');
  await page.mouse.move(wPt.x, wPt.y); await page.waitForTimeout(500);
  const g1 = +(await css(page, '#eyeGif', 'opacity'));
  check('[desert] hover the still in the top left: the GIF plays', g0 === 0 && g1 === 1, `${g0} → ${g1}`);
  await page.mouse.move(5, 5);
  const t0 = await page.$eval('#sun', (e) => e.getBoundingClientRect().top);
  await page.evaluate(() => window.scrollTo({ top: 420, behavior: 'instant' })); await page.waitForTimeout(300);
  const t1 = await page.$eval('#sun', (e) => e.getBoundingClientRect().top);
  check('[desert] the sun is sticky: it holds its place while the sand scrolls 420px', (await css(page, '#sun', 'position')) === 'sticky' && t1 >= 0 && Math.abs(t1 - t0) < 6, `top ${t0.toFixed(0)} → ${t1.toFixed(0)}`);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  const kw = await page.$eval('#krayt', (e) => e.getBoundingClientRect().width), mw = await page.$eval('#leMatya', (e) => e.offsetWidth);
  check('[desert] extreme scale contrast: the dragon is at least 10× the Le-matya', kw / mw >= 10, `${kw.toFixed(0)}px vs ${mw}px = ${(kw / mw).toFixed(0)}×`);
  const pos = await page.$$eval('#colossus, #krayt, #leMatya, #iceTex, #sandTex', (els) => els.map((e) => e.id + ':' + getComputedStyle(e).position));
  check('[desert] absolute (colossus, textures) and relative (Le-matya) positioning', /colossus:absolute/.test(pos) && /iceTex:absolute/.test(pos) && /leMatya:relative/.test(pos), pos.join(' '));
  await page.context().close();
  for (const [sel, dest] of [['#iceTex', 'index.html'], ['#barkTex', 'forest.html']]) {
    page = await newPage('desert'); await waitClick(page, sel, dest, `[desert] ${sel} texture → ${dest}`); await page.context().close();
  }

  /* ---------- FOREST ---------- */
  page = await newPage('forest');
  const dims = await page.$eval('#book', (e) => ({ sw: e.scrollWidth, cw: e.clientWidth, pos: getComputedStyle(e).position, ox: getComputedStyle(e).overflowX, snap: getComputedStyle(e).scrollSnapType }));
  check('[forest] the book is three windows wide and scrolls sideways inside a fixed box (the page itself does not scroll)', dims.sw === dims.cw * 3 && dims.pos === 'fixed' && dims.ox === 'auto' && (await page.evaluate(() => document.scrollingElement.scrollHeight <= innerHeight)), JSON.stringify(dims));
  const scenes = await page.$$eval('.scene', (els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
  check('[forest] three scenes sit side by side, one window apart', scenes.length === 3 && scenes[1] - scenes[0] === VW && scenes[2] - scenes[1] === VW, scenes.join(', '));
  const zOf = async (sel) => +(await css(page, sel, 'zIndex'));
  const z = { far: await zOf('#far'), shade: await zOf('#shade'), ent: await zOf('#entCard'), trunk: await zOf('#trunk2'), raptor: await zOf('#fernRaptor'), grass: await zOf('#grass'), curtain: await zOf('#curtainL'), near: await zOf('#trunk1'), leaf: await zOf('#leaf1') };
  check('[forest] depth by z-index: far trees < colour wash < creatures behind trunks < trunks < creatures in front < grass < leaves < ferns', z.far < z.shade && z.shade < z.ent && z.ent < z.trunk && z.trunk < z.raptor && z.raptor < z.grass && z.grass < z.curtain && z.curtain <= z.near && z.near < z.leaf, JSON.stringify(z));
  check('[forest] the scenes are the positioned boxes (position:relative) that everything inside is measured from', (await css(page, '#scene2', 'position')) === 'relative' && (await css(page, '#twoTrees', 'position')) === 'absolute');
  // the Ent peeks from behind a trunk and leans out when pointed at
  const ent0 = await rectOf(page, '#entCard');
  const entPt = { x: ent0.r - 30, y: (ent0.t + ent0.b) / 2 };
  await page.mouse.move(entPt.x, entPt.y); await page.waitForTimeout(900);
  const ent1 = await rectOf(page, '#entCard');
  check('[forest] hover the Ent card (half hidden behind a trunk): it leans out', ent1.l > ent0.l + 20, `left ${Math.round(ent0.l)} → ${Math.round(ent1.l)}px`);
  await page.mouse.move(5, 5);
  // the fern turns the page
  await click(page, '#leaf1');
  await page.waitForFunction((w) => document.getElementById('book').scrollLeft >= w - 2, VW, { timeout: 4000 }).catch(() => {});
  const s2 = await page.$eval('#book', (e) => e.scrollLeft);
  check('[forest] click the fern at the end of scene 1: the book glides to scene 2', Math.abs(s2 - VW) < 3 && (await page.evaluate(() => location.hash)) === '#scene2', `scrollLeft ${Math.round(s2)}, hash ${await page.evaluate(() => location.hash)}`);
  await click(page, '#leaf2');
  await page.waitForFunction((w) => document.getElementById('book').scrollLeft >= 2 * w - 2, VW, { timeout: 4000 }).catch(() => {});
  const s3 = await page.$eval('#book', (e) => e.scrollLeft);
  check('[forest] …and the fern at the end of scene 2 turns to scene 3', Math.abs(s3 - 2 * VW) < 3 && (await page.evaluate(() => location.hash)) === '#scene3', `scrollLeft ${Math.round(s3)}`);
  await page.evaluate((w) => document.getElementById('book').scrollTo({ left: w * 0.4, behavior: 'instant' }), VW); await page.waitForTimeout(1000);
  const snapped = await page.$eval('#book', (e) => e.scrollLeft);
  check('[forest] scroll-snap: a half-way scroll settles on a whole scene', snapped % VW < 3 || VW - (snapped % VW) < 3, `scrollLeft ${Math.round(snapped)}`);
  await page.context().close();
  // the peel
  page = await newPage('forest'); await goScene(page, 1);
  const cl0 = await rectOf(page, '#curtainL'), cr0 = await rectOf(page, '#curtainR');
  const glow0 = await css(page, '#twoTrees', 'filter');
  await page.mouse.click(VW * 0.1, VH * 0.5); await page.waitForTimeout(500);
  const pn = { l: await css(page, '#curtainL', 'animationName'), r: await css(page, '#curtainR', 'animationName') };
  check('[forest] click the leaves: the box ticks and both curtains play their animation', (await page.$eval('#peel', (e) => e.checked)) && pn.l === 'partsLeft' && pn.r === 'partsRight', JSON.stringify(pn));
  await finish(page, 'partsLeft'); await finish(page, 'partsRight'); await page.waitForTimeout(2600);
  const cl1 = await rectOf(page, '#curtainL'), cr1 = await rectOf(page, '#curtainR');
  check('[forest] …the curtains end outside the scene (left one off the left edge, right one off the right edge)', cl1.r <= 2 && cr1.l >= VW - 2 && cl1.r < cl0.r - 200 && cr1.l > cr0.l + 200, `left curtain right edge ${Math.round(cl0.r)} → ${Math.round(cl1.r)}; right curtain left edge ${Math.round(cr0.l)} → ${Math.round(cr1.l)}`);
  check('[forest] …and the light of the two trees spills out (a golden glow on the picture: a second change from the same click)', !/255, 214, 120/.test(glow0) && /255, 214, 120/.test(await css(page, '#twoTrees', 'filter')), await css(page, '#twoTrees', 'filter'));
  const tp = await visiblePoint(page, '#twoTrees'); await page.mouse.click(tp.x, tp.y); await page.mouse.move(5, 5); await page.waitForTimeout(500);
  check('[forest] click the picture: the leaves close again', !(await page.$eval('#peel', (e) => e.checked)) && Math.abs((await rectOf(page, '#curtainL')).l - cl0.l) < 3);
  await page.context().close();
  // the raptor
  page = await newPage('forest'); await goScene(page, 2);
  const r0 = await rectOf(page, '#fernRaptor');
  check('[forest] the raptor hides: in front of the trunks (z-index 5) but behind the grass (6)', (await zOf('#fernRaptor')) === 5 && (await zOf('#grass')) === 6);
  const rp = { x: r0.l + r0.w * 0.5, y: r0.t + r0.h * 0.3 };
  await page.mouse.click(rp.x, rp.y); await page.waitForTimeout(500);
  check('[forest] click the raptor: the box ticks, it jumps in front of the grass (z-index 8) and starts to run', (await page.$eval('#dash', (e) => e.checked)) && (await css(page, '#fernRaptor', 'animationName')) === 'dash' && (await zOf('#fernRaptor')) === 8);
  await finish(page, 'dash'); await page.waitForTimeout(300);
  const r1 = await rectOf(page, '#fernRaptor');
  check('[forest] …and it ends on the far side of the scene (about 60vw further on)', Math.abs(r1.l - r0.l - VW * 0.6) < 8, `left ${Math.round(r0.l)} → ${Math.round(r1.l)}px`);
  await page.context().close();
  // keyboard
  page = await newPage('forest');
  await page.keyboard.press('Tab'); const f1 = await page.evaluate(() => document.activeElement.id);
  await page.keyboard.press('Space'); await page.waitForTimeout(150);
  const peelOn = await page.$eval('#peel', (e) => e.checked);
  await page.keyboard.press('Tab'); const f2 = await page.evaluate(() => document.activeElement.id);
  await page.keyboard.press('Space'); await page.waitForTimeout(150);
  check('[forest] keyboard: Tab reaches the two hidden boxes, Space ticks them', f1 === 'peel' && f2 === 'dash' && peelOn && (await page.$eval('#dash', (e) => e.checked)), `focus on #${f1}, then #${f2}`);
  await page.context().close();
  // exits and the outside link
  page = await newPage('forest'); await goScene(page, 2); await waitClick(page, '#tauntaunDoor', 'index.html', '[forest] the Tauntaun (a snow creature among the trees) → index.html'); await page.context().close();
  page = await newPage('forest'); await goScene(page, 2); await waitClick(page, '#watcherDoor', 'water.html', '[forest] the Watcher (a lake creature in the roots) → water.html'); await page.context().close();

  /* ---------- the loop: walk all four pages by clicking ---------- */
  page = await newPage('index'); const walked = ['index'];
  const hop = async (sel, file, prep) => { if (prep) await prep(page); const p2 = await visiblePoint(page, sel); if (!p2) { walked.push('✗' + sel); return false; } await page.mouse.click(p2.x, p2.y); try { await page.waitForURL('**/' + file, { timeout: 4000 }); await page.waitForTimeout(800); walked.push(file.replace('.html', '')); return true; } catch (e) { walked.push('✗' + file); return false; } };
  const ok = (await hop('#reaperDoor', 'water.html')) && (await hop('#stickyWampa', 'forest.html', (p) => scrollFrac(p, 0.4)))
    && (await hop('#tauntaunDoor', 'index.html', (p) => goScene(p, 2))) && (await hop('#kraytDoor', 'desert.html'))
    && (await hop('#barkTex', 'forest.html')) && (await hop('#watcherDoor', 'water.html', (p) => goScene(p, 2)))
    && (await hop('#swimMatya', 'desert.html', (p) => scrollFrac(p, 1))) && (await hop('#iceTex', 'index.html'));
  check('[loop] Landing → Water → Forest → Landing → Desert → Forest → Water → Desert → Landing by clicking only', ok, walked.join(' → '));
  await page.context().close();

  /* ---------- opened straight from disk; reduced motion ---------- */
  for (const n of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: VW, height: VH } }); const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await pg.goto('file://' + ROOT + '/' + n + '.html'); await pg.waitForTimeout(1200);
    const broken = await pg.evaluate(() => [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.getAttribute('src')));
    check(`[file://] ${n}.html opens from disk with every image and no errors`, broken.length === 0 && errs.length === 0, [...broken, ...errs].join(' | '));
    await ctx.close();
  }
  { const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, reducedMotion: 'reduce' }); const pg = await ctx.newPage(); await pg.goto(BASE + 'index.html'); await pg.waitForTimeout(500);
    check('[a11y] prefers-reduced-motion cuts the wiggle to a blink', parseFloat(await pg.$eval('#kraytDoor', (e) => getComputedStyle(e).animationDuration)) < 0.001);
    await click(pg, '#typeIm'); await pg.waitForTimeout(500); await pg.mouse.move(5, 5);
    const rr = await pg.$eval('#typeIm', (e) => e.getBoundingClientRect().left);
    check('[a11y] …but a click still ends where it should (the title is spelled, instantly)', Math.abs(rr - VW * 0.19) < 40, `Im left ${Math.round(rr)}px, expected about ${Math.round(VW * 0.19)}`);
    await ctx.close(); }
  { const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, reducedMotion: 'reduce' }); const pg = await ctx.newPage(); await pg.goto(BASE + 'forest.html'); await pg.waitForTimeout(500);
    await pg.evaluate(() => document.getElementById('book').scrollTo({ left: innerWidth, behavior: 'instant' })); await pg.waitForTimeout(400);
    await pg.mouse.click(VW * 0.1, VH * 0.5); await pg.waitForTimeout(400);
    const cr = await pg.$eval('#curtainL', (e) => e.getBoundingClientRect().right);
    check('[a11y] reduced motion: the leaves still part (they just do not glide)', cr < 5, `left curtain right edge ${Math.round(cr)}px`);
    await ctx.close(); }

  /* ---------- small screens ---------- */
  for (const n of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const pg = await ctx.newPage(); await pg.goto(BASE + n + '.html'); await pg.waitForTimeout(900);
    const over = await pg.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
    check(`[phone] ${n} at 390px: no sideways scrolling of the page`, over <= 1, `overflow ${over}px`);
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed` + (failed.length ? `, ${failed.length} FAILED:\n  - ` + failed.map((f) => f.name).join('\n  - ') : ''));
  process.exit(failed.length ? 1 : 0);
})();
