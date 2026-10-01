/*
 * End-to-end checks for the Img.Maze prototype (assignment constraints, link graph, every interaction on every page).
 *   npm i playwright                      (once)
 *   python3 -m http.server 8731           (in the project folder, in another terminal)
 *   node tools/test-site.cjs              (takes ~3 minutes: it waits for the frost to creep and the idle hint to fire)
 * Set BASE=http://host:port/ to use a different server.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASE = process.env.BASE || 'http://127.0.0.1:8731/';
const PAGES = ['index', 'water', 'desert', 'forest', 'frozen'];
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

/* ---------- static: assignment constraints ---------- */
function staticChecks() {
  for (const n of PAGES) {
    const html = fs.readFileSync(path.join(ROOT, n + '.html'), 'utf8');
    check(`[static] ${n}.html has no <style> tag`, !/<style[\s>]/i.test(html));
    check(`[static] ${n}.html has no inline style="" attribute`, !/\sstyle\s*=/i.test(html));
    check(`[static] ${n}.html has no inline <script> body`, !/<script(?![^>]*\ssrc=)[^>]*>/i.test(html));
    check(`[static] ${n}.html links the external stylesheet`, /<link[^>]+rel="stylesheet"[^>]+href="css\/style\.css"/.test(html));
    // every local reference resolves to a real file
    const refs = [...html.matchAll(/(?:href|src)="([^"#]+)"/g)].map((m) => m[1]).filter((u) => !/^(https?:|data:|mailto:)/.test(u));
    const missing = refs.filter((u) => !fs.existsSync(path.join(ROOT, u)));
    check(`[static] ${n}.html: all ${refs.length} local hrefs/srcs exist`, missing.length === 0, missing.join(', '));
  }
  const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
  const urls = [...css.matchAll(/url\("?([^")]+)"?\)/g)].map((m) => m[1]).filter((u) => !u.startsWith('data:'));
  const missing = urls.filter((u) => !fs.existsSync(path.join(ROOT, 'css', u)));
  check(`[static] style.css: all ${urls.length} url() assets exist`, missing.length === 0, missing.join(', '));
  const js = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
  const jsRefs = [...js.matchAll(/'(img\/[^']+)'/g)].map((m) => m[1]);
  check('[static] main.js: referenced assets exist', jsRefs.every((u) => fs.existsSync(path.join(ROOT, u))), jsRefs.join(', '));
}

/* a point inside el's box where el (or a child) is really the topmost thing, so a click lands on it */
async function visiblePoint(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel); if (!el) return null;
    const r = el.getBoundingClientRect();
    for (let fy = 0.5; fy <= 0.95; fy += 0.1) for (let fx = 0.2; fx <= 0.8; fx += 0.1) {
      const x = r.left + r.width * fx, y = r.top + r.height * fy;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
      const top = document.elementFromPoint(x, y);
      if (top && (top === el || el.contains(top))) return { x, y };
    }
    return null;
  }, selector);
}
const num = (v) => parseFloat(v);

(async () => {
  staticChecks();
  const browser = await chromium.launch();
  const newPage = async (name, opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
    const page = await ctx.newPage();
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
    await page.goto(BASE + name + '.html'); await page.waitForTimeout(1100);
    return page;
  };
  const scrollFrac = async (page, f) => { await page.evaluate((f) => window.scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * f, behavior: 'instant' }), f); await page.waitForTimeout(350); };

  /* ---------- link graph: the one-way pentagon from the site map ---------- */
  const expectInternal = { index: ['water.html', 'desert.html'], water: ['frozen.html', 'desert.html'], desert: ['frozen.html', 'forest.html'], forest: ['water.html', 'index.html'], frozen: ['forest.html', 'index.html'] };
  for (const n of PAGES) {
    const page = await newPage(n);
    const internal = await page.$$eval('a[data-door]', (as) => [...new Set(as.map((a) => a.getAttribute('href')))].sort());
    const ext = await page.$$eval('a.out', (as) => as.map((a) => ({ href: a.href, target: a.target, rel: a.rel })));
    check(`[links] ${n} → exactly ${expectInternal[n].sort().join(' + ')}`, JSON.stringify(internal) === JSON.stringify([...expectInternal[n]].sort()), internal.join(', '));
    if (n === 'index') check('[links] index has no external links (landing links only to biomes)', ext.length === 0);
    else check(`[links] ${n} has one external exit that opens a new tab safely`, ext.length === 1 && ext[0].target === '_blank' && /noopener/.test(ext[0].rel), JSON.stringify(ext));
    const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
    check(`[layout] ${n}: no horizontal scrollbar`, overflow <= 1, `overflow ${overflow}px`);
    check(`[console] ${n}: no errors`, page.errors.length === 0, page.errors.join(' | '));
    await page.context().close();
  }

  /* ---------- LANDING ---------- */
  let page = await newPage('index');
  const nPieces = await page.$$eval('.piece', (e) => e.length);
  check('[landing] dense pile (≥ 20 pieces)', nPieces >= 20, nPieces + ' pieces');
  // 1. hover lifts
  let pt = await visiblePoint(page, '.p-wampa');
  await page.mouse.move(pt.x, pt.y); await page.waitForTimeout(500);
  const zHover = await page.$eval('.p-wampa', (e) => +getComputedStyle(e).zIndex);
  check('[landing] hover lifts a piece to the front (z-index ≥ 1000)', zHover >= 1000, 'z=' + zHover);
  // 2. drag moves a piece, keeps it on top
  pt = await visiblePoint(page, '.p-lematya');
  const before = await page.$eval('.p-lematya', (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top }; });
  await page.mouse.move(pt.x, pt.y); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(pt.x + i * 15, pt.y - i * 8);
  await page.mouse.up(); await page.waitForTimeout(900);
  const after = await page.$eval('.p-lematya', (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, dx: e.style.getPropertyValue('--dx'), z: e.style.getPropertyValue('--z') }; });
  check('[landing] dragging moves the piece by the pointer delta', Math.abs(after.x - before.x - 150) < 30 && Math.abs(after.y - before.y + 80) < 30, `moved (${(after.x - before.x).toFixed(0)}, ${(after.y - before.y).toFixed(0)}), --z=${after.z}`);
  // 3. dragging a door must not walk through it
  pt = await visiblePoint(page, '.p-reaper');
  await page.mouse.move(pt.x, pt.y); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(pt.x + i * 12, pt.y + i * 6);
  await page.mouse.up(); await page.waitForTimeout(1200);
  check('[landing] dragging a door does not navigate', page.url().endsWith('index.html') || page.url().endsWith('/'), page.url());
  // 4. keyboard shuffle
  await page.keyboard.press('x'); await page.waitForTimeout(300);
  const moved = await page.$$eval('.piece', (els) => els.filter((e) => e.style.getPropertyValue('--dx') && e.style.getPropertyValue('--dx') !== '0px').length);
  check('[landing] any letter shuffles the pile', moved >= 15, moved + ' pieces moved');
  // 5. idle hint on the doors
  await page.mouse.move(5, 5); await page.waitForTimeout(7600);
  const idle = await page.evaluate(() => document.body.classList.contains('is-idle'));
  const animName = await page.$eval('.p-krayt', (e) => getComputedStyle(e).animationName);
  check('[landing] doors twitch after ~6.5s of stillness', idle && animName === 'nudge', `is-idle=${idle}, animation=${animName}`);
  await page.mouse.move(300, 300); await page.waitForTimeout(100);
  check('[landing] …and stop as soon as you move', !(await page.evaluate(() => document.body.classList.contains('is-idle'))));
  await page.context().close();
  // 6. both doors lead on
  for (const [sel, dest] of [['.p-reaper', 'water.html'], ['.p-krayt', 'desert.html']]) {
    page = await newPage('index');
    const p2 = await visiblePoint(page, sel);
    await page.mouse.click(p2.x, p2.y);
    try { await page.waitForURL('**/' + dest, { timeout: 4000 }); check(`[landing] clicking the ${sel.slice(3)} door goes to ${dest}`, true); }
    catch (e) { check(`[landing] clicking the ${sel.slice(3)} door goes to ${dest}`, false, page.url()); }
    await page.context().close();
  }

  /* ---------- WATER ---------- */
  page = await newPage('water');
  const d0 = await page.evaluate(() => +getComputedStyle(document.documentElement).getPropertyValue('--depth'));
  await scrollFrac(page, 1);
  const d1 = await page.evaluate(() => +getComputedStyle(document.documentElement).getPropertyValue('--depth'));
  check('[water] --depth runs 0 → 1 with scroll', d0 === 0 && d1 > 0.99, `${d0} → ${d1}`);
  const seaTop = await page.$eval('.sea', (e) => ({ top: e.getBoundingClientRect().top, pos: getComputedStyle(e).position }));
  check('[water] the sea is position:fixed and does not scroll', seaTop.pos === 'fixed' && seaTop.top === 0, JSON.stringify(seaTop));
  let stuck = true, rects = [];
  for (const f of [0.1, 0.3, 0.55, 0.8, 0.97]) {
    await scrollFrac(page, f);
    const r = await page.$eval('.sticky-link', (e) => { const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, right: b.right }; });
    rects.push(Math.round(r.bottom)); if (!(r.bottom <= 900 && r.top >= 0)) stuck = false;
  }
  check('[water] the sticky link stays in view for the whole dive', stuck, 'bottom edge at ' + rects.join(', '));
  await scrollFrac(page, 0);
  const op0 = await page.$eval('.lair > .anchor', (e) => +getComputedStyle(e).opacity);
  const lensPt = await visiblePoint(page, '.lens');
  await page.mouse.move(lensPt.x, lensPt.y); await page.waitForTimeout(1300);
  const op1 = await page.$eval('.lair > .anchor', (e) => +getComputedStyle(e).opacity);
  const flt = await page.$eval('.lair > .anchor', (e) => getComputedStyle(e).filter);
  check('[water] hovering the corrupted lens reveals the anchor', op0 < 0.7 && op1 > 0.97 && flt === 'none', `opacity ${op0} → ${op1}, filter ${flt}`);
  await page.mouse.move(700, 800); await page.waitForTimeout(4200);
  const op2 = await page.$eval('.lair > .anchor', (e) => +getComputedStyle(e).opacity);
  check('[water] …and it sinks back into the murk after a delay', op2 < 0.7, 'opacity ' + op2);
  await page.mouse.click(lensPt.x, lensPt.y); await page.mouse.move(700, 800); await page.waitForTimeout(300);
  let st = await page.evaluate(() => ({ r: document.getElementById('reef').classList.contains('is-revealed'), a: document.querySelector('.lens').getAttribute('aria-pressed') }));
  await page.waitForTimeout(3500);
  const op3 = await page.$eval('.lair > .anchor', (e) => +getComputedStyle(e).opacity);
  check('[water] clicking the lens keeps the anchor revealed (touch / keyboard)', st.r && st.a === 'true' && op3 > 0.97, `${JSON.stringify(st)}, opacity ${op3}`);
  // keyboard
  const page2 = await newPage('water');
  await page2.keyboard.press('Tab'); const focusIsLens = await page2.evaluate(() => document.activeElement.classList.contains('lens'));
  await page2.waitForTimeout(1300);
  const opk = await page2.$eval('.lair > .anchor', (e) => +getComputedStyle(e).opacity);
  check('[water] keyboard: first Tab lands on the lens and reveals the anchor', focusIsLens && opk > 0.97, `lens focused=${focusIsLens}, opacity ${opk}`);
  await page2.context().close();
  // doors
  await scrollFrac(page, 0.4);
  let pw = await visiblePoint(page, '.sticky-link');
  await page.mouse.click(pw.x, pw.y);
  try { await page.waitForURL('**/frozen.html', { timeout: 4000 }); check('[water] sticky Wampa link → frozen.html', true); } catch (e) { check('[water] sticky Wampa link → frozen.html', false, page.url()); }
  await page.context().close();
  page = await newPage('water'); await scrollFrac(page, 1);
  pw = await visiblePoint(page, '.gif-link');
  await page.mouse.click(pw.x, pw.y);
  try { await page.waitForURL('**/desert.html', { timeout: 4000 }); check('[water] GIF link at the bottom → desert.html', true); } catch (e) { check('[water] GIF link at the bottom → desert.html', false, page.url() + ' pt=' + JSON.stringify(pw)); }
  await page.context().close();

  /* ---------- DESERT ---------- */
  page = await newPage('desert');
  const times = [];
  for (const k of ['2', 'ArrowRight', 'ArrowLeft', 'q', '1', '4']) { await page.keyboard.press(k); times.push(await page.evaluate(() => document.body.dataset.time)); }
  check('[desert] keyboard changes the light (2, →, ←, letter, 1, 4)', JSON.stringify(times) === JSON.stringify(['dusk', 'night', 'dusk', 'night', 'noon', 'eclipse']), times.join(' > '));
  await page.keyboard.press('1'); await page.waitForTimeout(1700);
  const sandNoon = await page.$eval('.sand', (e) => getComputedStyle(e).backgroundColor);
  await page.keyboard.press('3'); await page.waitForTimeout(1700);
  const sandNight = await page.$eval('.sand', (e) => getComputedStyle(e).backgroundColor);
  check('[desert] the palette actually changes (and cross-fades)', sandNoon !== sandNight, `${sandNoon} → ${sandNight}`);
  await page.keyboard.press('1'); await page.waitForTimeout(300);
  const sp = await visiblePoint(page, '.speck--wampa');
  const s0 = await page.$eval('.speck--wampa', (e) => getComputedStyle(e).scale);
  await page.mouse.move(sp.x, sp.y); await page.waitForTimeout(900);
  const s1 = await page.$eval('.speck--wampa', (e) => getComputedStyle(e).scale);
  check('[desert] hovering a speck swells it (scale 1 → 8)', num(s0) === 1 && num(s1) >= 7.9, `${s0} → ${s1}`);
  await page.mouse.move(5, 500); await page.waitForTimeout(800);
  await page.$eval('.speck--ent', (e) => e.click());
  const grown = await page.$eval('.speck--ent', (e) => e.classList.contains('is-grown'));
  check('[desert] clicking a speck keeps it grown (touch / keyboard)', grown);
  const mp = await visiblePoint(page, '.motion');
  const g0 = await page.$eval('.motion__gif', (e) => +getComputedStyle(e).opacity);
  await page.mouse.move(mp.x, mp.y); await page.waitForTimeout(500);
  const g1 = await page.$eval('.motion__gif', (e) => +getComputedStyle(e).opacity);
  check('[desert] hovering the still starts the GIF', g0 === 0 && g1 === 1, `${g0} → ${g1}`);
  await page.mouse.move(5, 500); await page.waitForTimeout(500);
  await page.$eval('.motion', (e) => e.click());
  check('[desert] clicking the still keeps the GIF playing', await page.$eval('.motion', (e) => e.classList.contains('is-playing')));
  const t0 = await page.$eval('.sticky', (e) => e.getBoundingClientRect().top);
  await page.evaluate(() => window.scrollTo({ top: 420, behavior: 'instant' })); await page.waitForTimeout(300);
  const t1 = await page.$eval('.sticky', (e) => e.getBoundingClientRect().top);
  check('[desert] the top-right creature is sticky (holds its place while the sand scrolls 420px)', t1 >= 0 && Math.abs(t1 - t0) < 6, `top ${t0.toFixed(0)} → ${t1.toFixed(0)} after 420px scroll`);
  await page.$eval('.tex--spare', (e) => e.click());
  const afterSpare = await page.evaluate(() => document.body.dataset.time);
  check('[desert] the spare sand texture also shifts the light', afterSpare !== 'noon', 'now ' + afterSpare);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await page.waitForTimeout(300);
  const anchorW = await page.$eval('.colossus > .anchor', (e) => e.getBoundingClientRect().width);
  const speckW = await page.$$eval('.speck', (els) => els.reduce((a, e) => a + e.offsetWidth, 0) / els.length);
  check('[desert] extreme scale contrast (anchor ≥ 40× the average speck)', anchorW / speckW >= 40, `anchor ${anchorW.toFixed(0)}px vs average speck ${speckW.toFixed(0)}px = ${(anchorW / speckW).toFixed(0)}×`);
  await page.context().close();
  for (const [sel, dest] of [['.tex--ice', 'frozen.html'], ['.tex--bark', 'forest.html']]) {
    page = await newPage('desert');
    const p2 = await visiblePoint(page, sel);
    if (!p2) { check(`[desert] ${sel} texture → ${dest}`, false, 'no clickable point (covered?)'); await page.context().close(); continue; }
    await page.mouse.click(p2.x, p2.y);
    try { await page.waitForURL('**/' + dest, { timeout: 4000 }); check(`[desert] ${sel} texture → ${dest}`, true); } catch (e) { check(`[desert] ${sel} texture → ${dest}`, false, page.url()); }
    await page.context().close();
  }

  /* ---------- FOREST ---------- */
  page = await newPage('forest');
  const p0 = await page.$eval('#forest', (e) => ({ p: +getComputedStyle(e).getPropertyValue('--p'), open: e.classList.contains('is-open'), pe: getComputedStyle(document.querySelector('.f-door--water')).pointerEvents, op: +getComputedStyle(document.querySelector('.f-door--water')).opacity }));
  await scrollFrac(page, 0.5);
  const pHalf = await page.$eval('#forest', (e) => +getComputedStyle(e).getPropertyValue('--p'));
  await scrollFrac(page, 1);
  const p1 = await page.$eval('#forest', (e) => ({ p: +getComputedStyle(e).getPropertyValue('--p'), open: e.classList.contains('is-open'), pe: getComputedStyle(document.querySelector('.f-door--water')).pointerEvents, op: +getComputedStyle(document.querySelector('.f-door--water')).opacity }));
  check('[forest] scrolling peels: --p 0 → ~0.5 → 1', p0.p === 0 && pHalf > 0.3 && pHalf < 0.7 && p1.p > 0.99, `${p0.p} → ${pHalf} → ${p1.p}`);
  check('[forest] doors are hidden and inert before the peel', p0.op === 0 && p0.pe === 'none' && !p0.open, JSON.stringify(p0));
  check('[forest] doors appear and take clicks after the peel', p1.op > 0.98 && p1.pe === 'auto' && p1.open, JSON.stringify(p1));
  const zs = await page.$$eval('.plane', (ps) => ps.map((p) => [p.className.replace('plane ', '').replace('plane--', ''), +getComputedStyle(p).zIndex]));
  check('[forest] six stacked planes, z-index back→front increasing', zs.every((z, i) => i === 0 || z[1] >= zs[i - 1][1]) && zs.length >= 6, zs.map((z) => z.join(':')).join(' '));
  const scales = await page.$$eval('.plane--back,.plane--between,.plane--mid', (ps) => ps.map((p) => +getComputedStyle(p).scale));
  check('[forest] nearer planes grow more (back < between < mid)', scales[0] < scales[1] && scales[1] < scales[2], scales.map((s) => s.toFixed(2)).join(' < '));
  for (const [sel, dest] of [['.f-door--water', 'water.html'], ['.f-door--landing', 'index.html']]) {
    const pf = await visiblePoint(page, sel);
    if (!pf) { check(`[forest] ${sel} → ${dest}`, false, 'no clickable point'); continue; }
    await page.mouse.click(pf.x, pf.y);
    try { await page.waitForURL('**/' + dest, { timeout: 4000 }); check(`[forest] ${sel} → ${dest}`, true); } catch (e) { check(`[forest] ${sel} → ${dest}`, false, page.url()); }
    await page.goBack().catch(() => {}); await page.waitForTimeout(900); await scrollFrac(page, 1);
  }
  await page.context().close();
  page = await newPage('forest');
  const tabbed = [];
  for (let i = 0; i < 5; i++) { await page.keyboard.press('Tab'); tabbed.push(await page.evaluate(() => document.activeElement.className || document.activeElement.tagName)); }
  check('[forest] before the peel, Tab cannot land on the hidden doors', !tabbed.some((c) => /f-door|f-anchor/.test(c)), tabbed.join(' | '));
  await scrollFrac(page, 1);
  const tabbed2 = [];
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Tab'); tabbed2.push(await page.evaluate(() => document.activeElement.className || document.activeElement.tagName)); }
  check('[forest] after the peel, Tab reaches the Ent and both doors', ['f-anchor', 'f-door--water', 'f-door--landing'].every((k) => tabbed2.some((c) => c.includes(k))), tabbed2.join(' | '));
  await page.context().close();
  page = await newPage('forest');
  const rp = await visiblePoint(page, '.peek--raptor');
  const tr0 = await page.$eval('.peek--raptor', (e) => getComputedStyle(e).translate);
  if (rp) { await page.mouse.move(rp.x, rp.y); await page.waitForTimeout(800); }
  const tr1 = await page.$eval('.peek--raptor', (e) => getComputedStyle(e).translate);
  check('[forest] hovering the peeking raptor makes it lean out', rp && tr0 !== tr1, `${tr0} → ${tr1}`);
  await page.context().close();

  /* ---------- FROZEN ---------- */
  page = await newPage('frozen');
  const alphaAt = (x, y, r = 6) => page.evaluate(([x, y, r]) => {
    const c = document.querySelector('.frost'); const s = c.width / innerWidth;
    const d = c.getContext('2d').getImageData(Math.max(0, x * s - r), Math.max(0, y * s - r), r * 2, r * 2).data; let t = 0;
    for (let i = 3; i < d.length; i += 4) t += d[i]; return t / (d.length / 4);
  }, [x, y, r]);
  const cA = await alphaAt(720, 450), eA = await alphaAt(30, 30);
  check('[frozen] starts frosted at the edges and clear in the middle', eA > cA + 60, `edge α=${eA.toFixed(0)}, centre α=${cA.toFixed(0)}`);
  await page.waitForTimeout(20000);
  const cB = await alphaAt(720, 450);
  check('[frozen] holding still lets the frost creep over the middle', cB > cA + 70, `centre α ${cA.toFixed(0)} → ${cB.toFixed(0)} after 20s`);
  for (let i = 0; i <= 30; i++) await page.mouse.move(300 + i * 14, 450);
  await page.waitForTimeout(150);
  const cC = await alphaAt(500, 450);
  check('[frozen] moving the pointer thaws a path through it', cC < cB - 60 && cC < 80, `α on the path = ${cC.toFixed(0)} (was ${cB.toFixed(0)})`);
  const cD = await alphaAt(500, 150);
  check('[frozen] …and leaves the rest of the ice alone', cD > cC + 60, `α off the path = ${cD.toFixed(0)}`);
  await page.waitForTimeout(13000);
  const cE = await alphaAt(500, 450);
  check('[frozen] the cleared path freezes over again', cE > cC + 50, `α ${cC.toFixed(0)} → ${cE.toFixed(0)}`);
  const zc = await page.evaluate(() => ({ frost: +getComputedStyle(document.querySelector('.frost')).zIndex, glint: +getComputedStyle(document.querySelector('.glint--a')).zIndex, ring: +getComputedStyle(document.querySelector('.ring')).zIndex, pe: getComputedStyle(document.querySelector('.frost')).pointerEvents }));
  check('[frozen] glints + ring sit above the frost; frost lets clicks through', zc.glint > zc.frost && zc.ring > zc.frost && zc.pe === 'none', JSON.stringify(zc));
  // keyboard thaw
  const pageK = await newPage('frozen'); await pageK.waitForTimeout(16000);
  const before2 = await pageK.evaluate(() => { const r = document.querySelector('.f-star').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const a0 = await pageK.evaluate(([x, y]) => { const c = document.querySelector('.frost'); const s = c.width / innerWidth; const d = c.getContext('2d').getImageData(x * s - 5, y * s - 5, 10, 10).data; let t = 0; for (let i = 3; i < d.length; i += 4) t += d[i]; return t / 100; }, before2);
  await pageK.keyboard.press('Tab'); await pageK.keyboard.press('Tab');   // porthole, then the starred exit
  const focused = await pageK.evaluate(() => document.activeElement.className);
  await pageK.waitForTimeout(200);
  const a1 = await pageK.evaluate(([x, y]) => { const c = document.querySelector('.frost'); const s = c.width / innerWidth; const d = c.getContext('2d').getImageData(x * s - 5, y * s - 5, 10, 10).data; let t = 0; for (let i = 3; i < d.length; i += 4) t += d[i]; return t / 100; }, before2);
  check('[frozen] keyboard: tabbing to the starred exit thaws the ice around it', /f-star/.test(focused) && a1 < a0 - 40, `focused "${focused}", α ${a0.toFixed(0)} → ${a1.toFixed(0)}`);
  await pageK.context().close();
  await page.context().close();
  for (const [sel, dest] of [['.f-porthole', 'forest.html'], ['.f-scrap', 'index.html']]) {
    page = await newPage('frozen');
    await page.waitForTimeout(500);
    const bb = await page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await page.mouse.move(bb[0], bb[1]);                 // hover first (this also thaws)
    await page.mouse.click(bb[0], bb[1]);
    try { await page.waitForURL('**/' + dest, { timeout: 4000 }); check(`[frozen] ${sel} → ${dest} (click passes through the frost canvas)`, true); } catch (e) { check(`[frozen] ${sel} → ${dest}`, false, page.url()); }
    await page.context().close();
  }

  /* ---------- the loop: walk the whole pentagon by clicking ---------- */
  page = await newPage('index');
  const path1 = [];
  const hop = async (sel, expectFile, prep) => {
    if (prep) await prep(page);
    const p2 = await visiblePoint(page, sel);
    if (!p2) { path1.push(`✗(${sel})`); return false; }
    await page.mouse.click(p2.x, p2.y);
    try { await page.waitForURL('**/' + expectFile, { timeout: 4000 }); await page.waitForTimeout(1000); path1.push(expectFile); return true; } catch (e) { path1.push('✗' + expectFile); return false; }
  };
  const ok = (await hop('.p-reaper', 'water.html')) &&
    (await hop('.sticky-link', 'frozen.html', (p) => scrollFrac(p, 0.4))) &&
    (await hop('.f-porthole', 'forest.html', async (p) => { await p.waitForTimeout(300); const bb = await p.$eval('.f-porthole', (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); await p.mouse.move(bb[0], bb[1]); })) &&
    (await hop('.f-door--landing', 'index.html', (p) => scrollFrac(p, 1)));
  check('[loop] Landing → Water → Frozen → Forest → Landing, by clicking only', ok, 'index.html → ' + path1.join(' → '));
  await page.context().close();

  /* ---------- opened straight from disk (the way a marker may open it) ---------- */
  for (const n of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await pg.goto('file://' + ROOT + '/' + n + '.html'); await pg.waitForTimeout(1200);
    const imgs = await pg.evaluate(() => [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.getAttribute('src')));
    check(`[file://] ${n}.html loads with every image and no errors`, imgs.length === 0 && errs.length === 0, [...imgs, ...errs].join(' | '));
    await ctx.close();
  }

  /* ---------- reduced motion ---------- */
  { const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); const pg = await ctx.newPage(); await pg.goto(BASE + 'index.html'); await pg.waitForTimeout(500);
    const p2 = await visiblePoint(pg, '.p-reaper'); const t = Date.now(); await pg.mouse.click(p2.x, p2.y);
    await pg.waitForURL('**/water.html', { timeout: 3000 }).catch(() => {});
    check('[a11y] prefers-reduced-motion: doors open without the exit animation delay', pg.url().endsWith('water.html') && Date.now() - t < 900, `${Date.now() - t}ms`);
    await ctx.close(); }

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed` + (failed.length ? `, ${failed.length} FAILED:\n  - ` + failed.map((f) => f.name).join('\n  - ') : ''));
})();
