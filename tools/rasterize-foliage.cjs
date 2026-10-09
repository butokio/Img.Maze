/*
 * Rasterises tools/foliage-src/*.svg to transparent PNGs in images/foliage/ at 1.25x, so they stay sharp on a big screen
 * and the browser does not have to draw ~1000 vector paths every time it repaints.
 *   node tools/rasterize-foliage.cjs        (needs `npm i playwright` and ImageMagick)
 */
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, 'foliage-src');
const OUT = path.resolve(__dirname, '../images/foliage');
const DSF = 1.25;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const file of fs.readdirSync(SRC).filter((f) => f.endsWith('.svg'))) {
    const svg = fs.readFileSync(path.join(SRC, file), 'utf8');
    const m = svg.match(/width="(\d+)" height="(\d+)"/);
    const [w, h] = [+m[1], +m[2]];
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: DSF });
    const page = await ctx.newPage();
    // a real file URL (not setContent) so the SVG renders exactly as it would in an <img>
    const tmp = path.join(SRC, `.tmp-${file}.html`);
    fs.writeFileSync(tmp, `<!doctype html><body style="margin:0;background:transparent">${svg.replace(/preserveAspectRatio="[^"]*"/, '')}</body>`);
    await page.goto('file://' + tmp);
    const png = path.join(OUT, file.replace('.svg', '.png'));
    await page.screenshot({ path: png, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
    fs.unlinkSync(tmp);
    execFileSync('convert', [png, '-strip', '-define', 'png:compression-level=9', png]);
    console.log(file.padEnd(20), (fs.statSync(png).size / 1024).toFixed(0).padStart(5), 'KB');
    await ctx.close();
  }
  await browser.close();
})();
