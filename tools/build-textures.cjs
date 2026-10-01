/*
 * Renders the procedural textures used by the site (paper, sand, ice, bark, kelp, caustics, frost, grain)
 * from SVG filters (feTurbulence + lighting) using headless Chromium, so no third-party art is needed.
 *
 *   npm i playwright   (once, anywhere on your machine)
 *   node tools/build-textures.cjs
 *
 * Output goes to img/textures/. JPEGs are produced through ImageMagick (`convert`).
 */
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '../img/textures');
fs.mkdirSync(OUT, { recursive: true });

/* helper: colour matrix that paints a flat colour and takes alpha from the red noise channel: a*R + b */
const alphaFromR = (r, g, b, a, off) => `0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  ${a} 0 0 0 ${off}`;

const TEXTURES = [
  /* --- fine paper-grain speckle, tiles seamlessly, laid over every page --- */
  { name: 'grain', w: 256, h: 256, transparent: true, ext: 'png', svg: `
    <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
      <filter id="f" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch"/>
        <feColorMatrix type="matrix" values="${alphaFromR(0.17, 0.13, 0.09, 1.7, -0.62)}"/>
      </filter>
      <rect width="256" height="256" filter="url(#f)"/>
    </svg>` },

  /* --- warm cream paper with fibres and foxing: scraps, type-as-texture, landing backing --- */
  { name: 'paper', w: 900, h: 900, ext: 'jpg', svg: `
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="900">
      <filter id="mot" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.005" numOctaves="4" seed="12"/>
        <feColorMatrix type="matrix" values="${alphaFromR(0.6, 0.45, 0.27, 1.1, -0.38)}"/>
      </filter>
      <filter id="fib" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.4" numOctaves="3" seed="3"/>
        <feColorMatrix type="matrix" values="${alphaFromR(0.45, 0.35, 0.22, 1.5, -0.66)}"/>
      </filter>
      <filter id="spk" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="1" seed="5"/>
        <feColorMatrix type="matrix" values="${alphaFromR(0.3, 0.22, 0.15, 6, -3.7)}"/>
      </filter>
      <rect width="900" height="900" fill="#eee5d0"/>
      <rect width="900" height="900" filter="url(#mot)" opacity=".75"/>
      <rect width="900" height="900" filter="url(#fib)" opacity=".5"/>
      <rect width="900" height="900" filter="url(#spk)" opacity=".4"/>
    </svg>` },

  /* --- rippled dune sand (lit height-map) --- */
  { name: 'sand', w: 1400, h: 900, ext: 'jpg', svg: `
    <svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900">
      <filter id="d" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.0022 0.0095" numOctaves="4" seed="8" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="h"/>
        <feDiffuseLighting in="h" surfaceScale="26" diffuseConstant="1.0" lighting-color="#fff6dc" result="lit">
          <feDistantLight azimuth="235" elevation="38"/>
        </feDiffuseLighting>
        <feFlood flood-color="#e8c685" result="tint"/>
        <feBlend in="lit" in2="tint" mode="multiply" result="sand"/>
        <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="2" seed="2" result="g"/>
        <feColorMatrix in="g" type="matrix" values="${alphaFromR(0.34, 0.24, 0.1, 1.2, -0.5)}" result="gr"/>
        <feComposite in="gr" in2="sand" operator="over"/>
      </filter>
      <rect width="1400" height="900" filter="url(#d)"/>
    </svg>` },

  /* --- wavering caustic light (tiles; drifted in CSS over the sea) --- */
  { name: 'caustics', w: 512, h: 512, transparent: true, ext: 'png', svg: `
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
      <filter id="c" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.0125 0.019" numOctaves="2" seed="21" stitchTiles="stitch" result="t"/>
        <!-- keep only a thin band around the noise mid-value: the iso-contour web that real caustics form -->
        <feColorMatrix in="t" type="matrix" values="0 0 0 0 0.8  0 0 0 0 1  0 0 0 0 1  1 0 0 0 0" result="c"/>
        <feComponentTransfer in="c">
          <feFuncA type="table" tableValues="0 0 0 0 0 0 0 0 0 .4 1 .4 0 0 0 0 0 0 0 0 0"/>
        </feComponentTransfer>
        <feGaussianBlur stdDeviation="0.6"/>
      </filter>
      <rect width="512" height="512" filter="url(#c)"/>
    </svg>` },

  /* --- dark kelp / bioluminescent patch (Water: top-right hidden link) --- */
  { name: 'kelp', w: 800, h: 800, ext: 'jpg', svg: `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
      <filter id="k" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.03 0.0045" numOctaves="4" seed="31" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="h"/>
        <feDiffuseLighting in="h" surfaceScale="12" diffuseConstant="1.15" lighting-color="#a6f3de" result="lit">
          <feDistantLight azimuth="320" elevation="44"/>
        </feDiffuseLighting>
        <feFlood flood-color="#0e5a62" result="tint"/>
        <feBlend in="lit" in2="tint" mode="multiply" result="base"/>
        <feTurbulence type="fractalNoise" baseFrequency="0.14" numOctaves="1" seed="6" result="sp"/>
        <feColorMatrix in="sp" type="matrix" values="${alphaFromR(0.6, 1, 0.95, 14, -9.9)}" result="spark"/>
        <feGaussianBlur in="spark" stdDeviation="1.1" result="spark2"/>
        <feMerge><feMergeNode in="base"/><feMergeNode in="spark2"/></feMerge>
      </filter>
      <radialGradient id="v" cx="50%" cy="50%" r="72%">
        <stop offset="50%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#001a1f" stop-opacity=".7"/>
      </radialGradient>
      <rect width="800" height="800" filter="url(#k)"/>
      <rect width="800" height="800" fill="url(#v)"/>
    </svg>` },

  /* --- frosted ice sheet (Frozen backing) --- */
  { name: 'ice', w: 1400, h: 900, ext: 'jpg', svg: `
    <svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900">
      <filter id="i" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.006 0.011" numOctaves="6" seed="14" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="h"/>
        <feDiffuseLighting in="h" surfaceScale="7" diffuseConstant="1" lighting-color="#f1f8ff" result="lit">
          <feDistantLight azimuth="45" elevation="52"/>
        </feDiffuseLighting>
        <feFlood flood-color="#a9c8de" result="tint"/>
        <feBlend in="lit" in2="tint" mode="multiply" result="ice"/>
        <feSpecularLighting in="h" surfaceScale="6" specularConstant=".8" specularExponent="22" lighting-color="#fff" result="spec">
          <feDistantLight azimuth="45" elevation="62"/>
        </feSpecularLighting>
        <feComposite in="spec" in2="ice" operator="arithmetic" k1="0" k2="1" k3=".55" k4="0" result="shiny"/>
        <feTurbulence type="turbulence" baseFrequency="0.012 0.02" numOctaves="2" seed="5" result="cr"/>
        <feColorMatrix in="cr" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -9 0 0 0 2.0" result="cracks"/>
        <feComposite in="cracks" in2="shiny" operator="over"/>
      </filter>
      <rect width="1400" height="900" filter="url(#i)"/>
    </svg>` },

  /* --- frost sprite: the canvas on the Frozen page paints this over itself while the visitor is idle --- */
  { name: 'frost', w: 512, h: 512, transparent: true, ext: 'png', svg: `
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
      <filter id="fr" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.009" numOctaves="3" seed="9" stitchTiles="stitch" result="cl"/>
        <feColorMatrix in="cl" type="matrix" values="${alphaFromR(0.86, 0.93, 0.99, 1.5, -0.22)}" result="cloud"/>
        <feTurbulence type="turbulence" baseFrequency="0.03" numOctaves="4" seed="3" stitchTiles="stitch" result="ve"/>
        <feColorMatrix in="ve" type="matrix" values="0 0 0 0 0.96  0 0 0 0 0.99  0 0 0 0 1  -5.5 0 0 0 1.9" result="veins"/>
        <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="1" seed="4" stitchTiles="stitch" result="sp"/>
        <feColorMatrix in="sp" type="matrix" values="${alphaFromR(1, 1, 1, 3.4, -1.9)}" result="specks"/>
        <feMerge><feMergeNode in="cloud"/><feMergeNode in="veins"/><feMergeNode in="specks"/></feMerge>
      </filter>
      <rect width="512" height="512" filter="url(#fr)"/>
    </svg>` },

  /* --- furrowed bark with moss (Desert: texture that links on to the Forest) --- */
  { name: 'bark', w: 700, h: 900, ext: 'jpg', svg: `
    <svg xmlns="http://www.w3.org/2000/svg" width="700" height="900">
      <filter id="b" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.022 0.085" numOctaves="5" seed="41" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="h"/>
        <feDiffuseLighting in="h" surfaceScale="9" diffuseConstant="1.15" lighting-color="#fff1d4" result="lit">
          <feDistantLight azimuth="205" elevation="48"/>
        </feDiffuseLighting>
        <feFlood flood-color="#8a6c46" result="tint"/>
        <feBlend in="lit" in2="tint" mode="multiply" result="bark"/>
        <feTurbulence type="fractalNoise" baseFrequency="0.009" numOctaves="3" seed="17" result="m"/>
        <feColorMatrix in="m" type="matrix" values="${alphaFromR(0.43, 0.52, 0.22, 2.4, -1.15)}" result="moss"/>
        <feComposite in="moss" in2="bark" operator="over"/>
      </filter>
      <rect width="700" height="900" filter="url(#b)"/>
    </svg>` },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const only = process.argv.slice(2);
  for (const t of TEXTURES) {
    if (only.length && !only.includes(t.name)) continue;
    await page.setViewportSize({ width: t.w, height: t.h });
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${t.svg}</body></html>`);
    const png = path.join(OUT, `${t.name}.png`);
    await page.screenshot({ path: png, omitBackground: !!t.transparent, clip: { x: 0, y: 0, width: t.w, height: t.h } });
    if (t.ext === 'jpg') {
      execFileSync('convert', [png, '-strip', '-quality', '82', path.join(OUT, `${t.name}.jpg`)]);
      fs.unlinkSync(png);
    }
    console.log('rendered', t.name);
  }
  await browser.close();
})();
