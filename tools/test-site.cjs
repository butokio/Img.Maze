/*
 * Checks for the 3-page Img.Maze prototype (plain HTML + CSS, no JavaScript).
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
const PAGES = ['index', 'water', 'desert'];
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

/* ---------- static: the brief, the demo's style, and "every picture once" ---------- */
function staticChecks() {
  const allRefs = new Set();
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
  }
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
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
    const page = await ctx.newPage();
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
    page.on('requestfailed', (r) => page.errors.push('failed: ' + r.url()));
    await page.goto(BASE + name + '.html'); await page.waitForTimeout(900);
    return page;
  };
  const scrollFrac = async (page, f) => { await page.evaluate((f) => window.scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * f, behavior: 'instant' }), f); await page.waitForTimeout(350); };
  const css = (page, sel, prop) => page.$eval(sel, (e, p) => getComputedStyle(e)[p], prop);
  const waitClick = async (page, sel, dest, label) => {
    const p2 = await visiblePoint(page, sel);
    if (!p2) { check(label, false, 'no clickable point (covered?)'); return; }
    await page.mouse.click(p2.x, p2.y);
    try { await page.waitForURL('**/' + dest, { timeout: 4000 }); check(label, true); } catch (e) { check(label, false, page.url()); }
  };

  /* ---------- link graph ---------- */
  const expectInternal = { index: ['desert.html', 'water.html'], water: ['desert.html', 'index.html'], desert: ['index.html', 'water.html'] };
  for (const n of PAGES) {
    const page = await newPage(n);
    const internal = await page.$$eval('a[target="_self"]', (as) => [...new Set(as.map((a) => a.getAttribute('href')))].sort());
    const ext = await page.$$eval('a[target="_blank"]', (as) => as.map((a) => ({ href: a.href, rel: a.rel })));
    check(`[links] ${n} → ${expectInternal[n].join(' + ')} (no dead ends)`, JSON.stringify(internal) === JSON.stringify(expectInternal[n]), internal.join(', '));
    if (n === 'index') check('[links] index has no outside links', ext.length === 0);
    else check(`[links] ${n} has one outside link that opens a new tab safely`, ext.length === 1 && /noopener/.test(ext[0].rel), JSON.stringify(ext));
    const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
    check(`[layout] ${n}: no horizontal scrollbar`, overflow <= 1, `overflow ${overflow}px`);
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
    bottoms.push(Math.round(r.bottom)); if (!(r.top >= 0 && r.bottom <= 900)) kept = false;
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
  page = await newPage('water');
  await page.keyboard.press('Tab');
  const focusLens = await page.evaluate(() => document.activeElement.id);
  await page.waitForTimeout(1200);
  check('[water] keyboard: the first Tab lands on the lens and reveals the creature', focusLens === 'lens' && +(await css(page, '#anchor', 'opacity')) > 0.97, `focus on #${focusLens}`);
  await page.context().close();
  page = await newPage('water'); await scrollFrac(page, 0.4); await waitClick(page, '#stickyWampa', 'index.html', '[water] sticky Wampa → index.html (TEMP: frozen.html later)'); await page.context().close();
  page = await newPage('water'); await scrollFrac(page, 1); await waitClick(page, '#swimMatya', 'desert.html', '[water] GIF at the bottom → desert.html'); await page.context().close();

  /* ---------- DESERT ---------- */
  page = await newPage('desert');
  const day = { sky: +(await css(page, '#skyNight', 'opacity')), sand: await css(page, '#sand', 'backgroundColor'), kr: await css(page, '#krayt', 'filter'), checked: await page.$eval('#night', (e) => e.checked) };
  const sunPt = await visiblePoint(page, '#sun');
  await page.mouse.click(sunPt.x, sunPt.y); await page.waitForTimeout(1900);
  const night = { sky: +(await css(page, '#skyNight', 'opacity')), sand: await css(page, '#sand', 'backgroundColor'), kr: await css(page, '#krayt', 'filter'), checked: await page.$eval('#night', (e) => e.checked), moon: +(await page.$eval('#sun', (e) => +getComputedStyle(e, '::after').opacity)) };
  check('[desert] clicking the sun ticks the hidden box and the whole desert goes to night', !day.checked && night.checked && night.sky === 1 && night.sand !== day.sand && night.kr !== day.kr && night.moon === 1, `sky α ${day.sky}→${night.sky}, sand ${day.sand}→${night.sand}, moon α ${night.moon}`);
  await page.mouse.click(sunPt.x, sunPt.y); await page.waitForTimeout(1900);
  check('[desert] clicking again brings the day back', !(await page.$eval('#night', (e) => e.checked)) && +(await css(page, '#skyNight', 'opacity')) === 0 && (await css(page, '#sand', 'backgroundColor')) === day.sand);
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
  for (const [sel, dest] of [['#iceTex', 'index.html'], ['#barkTex', 'water.html']]) {
    page = await newPage('desert'); await waitClick(page, sel, dest, `[desert] ${sel} texture → ${dest} (TEMP)`); await page.context().close();
  }

  /* ---------- the loop: walk the three pages by clicking ---------- */
  page = await newPage('index'); const walked = ['index'];
  const hop = async (sel, file, prep) => { if (prep) await prep(page); const p2 = await visiblePoint(page, sel); if (!p2) { walked.push('✗' + sel); return false; } await page.mouse.click(p2.x, p2.y); try { await page.waitForURL('**/' + file, { timeout: 4000 }); await page.waitForTimeout(800); walked.push(file); return true; } catch (e) { walked.push('✗' + file); return false; } };
  const ok = (await hop('#reaperDoor', 'water.html')) && (await hop('#swimMatya', 'desert.html', (p) => scrollFrac(p, 1))) && (await hop('#iceTex', 'index.html'));
  check('[loop] Landing → Water → Desert → Landing by clicking only', ok, walked.join(' → '));
  await page.context().close();

  /* ---------- opened straight from disk; reduced motion ---------- */
  for (const n of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await pg.goto('file://' + ROOT + '/' + n + '.html'); await pg.waitForTimeout(1200);
    const broken = await pg.evaluate(() => [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.getAttribute('src')));
    check(`[file://] ${n}.html opens from disk with every image and no errors`, broken.length === 0 && errs.length === 0, [...broken, ...errs].join(' | '));
    await ctx.close();
  }
  { const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); const pg = await ctx.newPage(); await pg.goto(BASE + 'index.html'); await pg.waitForTimeout(500);
    check('[a11y] prefers-reduced-motion switches the wiggle off', (await pg.$eval('#kraytDoor', (e) => getComputedStyle(e).animationName)) === 'none');
    await ctx.close(); }

  /* ---------- small screens ---------- */
  for (const n of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const pg = await ctx.newPage(); await pg.goto(BASE + n + '.html'); await pg.waitForTimeout(900);
    const over = await pg.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
    check(`[phone] ${n} at 390px: no sideways scrolling`, over <= 1, `overflow ${over}px`);
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed` + (failed.length ? `, ${failed.length} FAILED:\n  - ` + failed.map((f) => f.name).join('\n  - ') : ''));
  process.exit(failed.length ? 1 : 0);
})();
