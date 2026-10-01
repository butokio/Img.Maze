/* =============================================================================
   IMG.MAZE — prototype behaviour
   Plain JavaScript: no libraries, no modules (so every page also works opened straight from disk).

   The rule of thumb: JS decides WHEN and WHERE (it hands a few numbers to the stylesheet),
   CSS decides what that LOOKS like. Nothing here writes colours, sizes or layout.

     shared   internal links get a short exit animation
     landing  drag pieces · shuffle on keypress · idle hint on the two doors
     water    scroll → --depth (the fixed sea darkens) · tap the lens to keep the anchor revealed
     desert   keyboard changes the light · tap specks / GIF / sticky to keep them "on"
     forest   scroll → --p (how far the planes have peeled)
     frozen   a canvas of frost that creeps over the page and thaws under the pointer
   ============================================================================= */
(() => {
  'use strict';

  const root = document.documentElement;
  const body = document.body;
  const page = body.dataset.page;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const num = (el, prop) => parseFloat(el.style.getPropertyValue(prop)) || 0;

  /* run fn at most once per animation frame (scroll and resize fire far more often than we can paint) */
  const perFrame = (fn) => {
    let queued = false;
    return () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; fn(); });
    };
  };


  /* ---------------------------------------------------------------------------
     SHARED — internal links (the "doors") leave with a short animation.
     External links, ctrl/cmd-clicks and middle-clicks are left alone.
     --------------------------------------------------------------------------- */
  function wireDoors() {
    document.addEventListener('click', (e) => {
      const door = e.target.closest('a[data-door]');
      if (!door || e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      e.preventDefault();
      const piece = door.closest('.piece');
      if (piece && !reduceMotion) swell(piece);
      body.classList.add('is-leaving');
      window.setTimeout(() => { window.location.href = door.href; }, reduceMotion ? 0 : 560);
    });

    // coming back with the browser's Back button should not show a half-faded page
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) body.classList.remove('is-leaving');
    });
  }

  /* the chosen door slides to the middle of the screen and swells (the CSS does the swelling) */
  function swell(piece) {
    const r = piece.getBoundingClientRect();
    piece.style.setProperty('--dx', num(piece, '--dx') + (window.innerWidth / 2 - (r.left + r.width / 2)) + 'px');
    piece.style.setProperty('--dy', num(piece, '--dy') + (window.innerHeight / 2 - (r.top + r.height / 2)) + 'px');
    piece.classList.add('is-chosen');
  }


  /* ---------------------------------------------------------------------------
     LANDING — z-index cluster / chaos
     --------------------------------------------------------------------------- */
  function landing() {
    const pile = document.getElementById('pile');
    const pieces = [...pile.querySelectorAll('.piece')].filter((p) => getComputedStyle(p).pointerEvents !== 'none');
    let top = 100;                       // z-index counter: whatever you touched last stays on top

    /* 1 · drag any piece (pointer events cover mouse, pen and touch) */
    pieces.forEach((piece) => {
      let grab = null;

      piece.addEventListener('dragstart', (e) => e.preventDefault());   // no native image/link drag ghosts

      piece.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        grab = { x: e.clientX, y: e.clientY, dx: num(piece, '--dx'), dy: num(piece, '--dy'), moved: false };
        piece.setPointerCapture(e.pointerId);
        piece.style.setProperty('--z', ++top);
      });

      piece.addEventListener('pointermove', (e) => {
        if (!grab) return;
        const mx = e.clientX - grab.x;
        const my = e.clientY - grab.y;
        if (!grab.moved && Math.hypot(mx, my) < 5) return;          // a wobble is still a click
        grab.moved = true;
        piece.classList.add('is-dragging');
        piece.style.setProperty('--dx', grab.dx + mx + 'px');
        piece.style.setProperty('--dy', grab.dy + my + 'px');
      });

      const drop = () => {
        if (!grab) return;
        piece.classList.remove('is-dragging');
        if (grab.moved) piece.dataset.dragged = '1';                // remembered so the click after a drag can be ignored
        grab = null;
      };
      piece.addEventListener('pointerup', drop);
      piece.addEventListener('pointercancel', drop);
    });

    /* a drag that ends on a door must not walk through it */
    pile.addEventListener('click', (e) => {
      const piece = e.target.closest('.piece');
      if (piece && piece.dataset.dragged) {
        e.preventDefault();
        e.stopPropagation();
        delete piece.dataset.dragged;
      }
    }, true);

    /* 2 · hidden keyboard feature: any letter shuffles the whole pile */
    let lastShuffle = 0;
    document.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
      const now = performance.now();
      if (now - lastShuffle < 450) return;                          // ignore key-repeat
      lastShuffle = now;
      pieces.forEach((piece) => {
        piece.style.setProperty('--dx', ((Math.random() - 0.5) * window.innerWidth * 0.34).toFixed(0) + 'px');
        piece.style.setProperty('--dy', ((Math.random() - 0.5) * window.innerHeight * 0.34).toFixed(0) + 'px');
        piece.style.setProperty('--rot', ((Math.random() - 0.5) * 26).toFixed(1) + 'deg');
        piece.style.setProperty('--z', 2 + Math.floor(Math.random() * 60));
      });
      top = 100;
    });

    /* 3 · the hint: leave it alone and the two doors twitch, again every so often until you move */
    if (!reduceMotion) {
      let idle = 0;
      const rest = () => {
        body.classList.remove('is-idle');
        window.clearTimeout(idle);
        idle = window.setTimeout(twitch, 6500);
      };
      const twitch = () => {
        body.classList.remove('is-idle');
        void body.offsetWidth;                                       // restart the CSS animation
        body.classList.add('is-idle');
        idle = window.setTimeout(twitch, 9000);
      };
      ['pointermove', 'pointerdown', 'keydown'].forEach((t) => window.addEventListener(t, rest, { passive: true }));
      rest();
    }
  }


  /* ---------------------------------------------------------------------------
     WATER — fixed + sticky
     --------------------------------------------------------------------------- */
  function water() {
    const reef = document.getElementById('reef');

    /* --depth is 0 at the surface and 1 at the bottom of the page; the CSS turns it into colour, light and drift */
    const setDepth = perFrame(() => {
      const max = root.scrollHeight - window.innerHeight;
      root.style.setProperty('--depth', (max > 0 ? clamp(window.scrollY / max, 0, 1) : 0).toFixed(4));
    });
    window.addEventListener('scroll', setDepth, { passive: true });
    window.addEventListener('resize', setDepth);
    setDepth();

    /* hover and keyboard focus reveal the anchor in CSS alone; a click keeps it revealed (touch screens have no hover) */
    const lens = reef.querySelector('.lens');
    lens.addEventListener('click', () => {
      const on = reef.classList.toggle('is-revealed');
      lens.setAttribute('aria-pressed', String(on));
    });
  }


  /* ---------------------------------------------------------------------------
     DESERT — absolute + scale
     --------------------------------------------------------------------------- */
  function desert() {
    /* hidden keyboard feature: the light changes. CSS holds the four palettes; we only name which one. */
    const light = ['noon', 'dusk', 'night', 'eclipse'];
    const at = () => Math.max(0, light.indexOf(body.dataset.time));
    const shift = (i) => { body.dataset.time = light[(i + light.length) % light.length]; };

    document.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight') shift(at() + 1);
      else if (e.key === 'ArrowLeft') shift(at() - 1);
      else if (/^[1-4]$/.test(e.key)) shift(Number(e.key) - 1);
      else if (/^[a-z]$/i.test(e.key)) shift(at() + 1);
    });

    /* the spare texture does the same job with a click */
    document.querySelector('.tex--spare').addEventListener('click', () => shift(at() + 1));

    /* specks and the sticky creature swell on hover in CSS; a click keeps them swollen (touch, keyboard) */
    document.querySelectorAll('.speck, .sticky').forEach((el) => {
      el.addEventListener('click', () => el.classList.toggle('is-grown'));
    });

    /* the GIF/still plays on hover in CSS; a click keeps it playing */
    const motion = document.querySelector('.motion');
    motion.addEventListener('click', () => motion.classList.toggle('is-playing'));
  }


  /* ---------------------------------------------------------------------------
     FOREST — z-index depth + relative
     --------------------------------------------------------------------------- */
  function forest() {
    const el = document.getElementById('forest');

    /* --p is how far through the forest you are (0 → 1). Every plane scales by its own multiple of it. */
    const peel = perFrame(() => {
      const r = el.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      const p = span > 0 ? clamp(-r.top / span, 0, 1) : 0;
      el.style.setProperty('--p', p.toFixed(4));
      el.classList.toggle('is-open', p > 0.5);                       // the doors exist (visible, clickable, tabbable) only after the peel begins to open the clearing
    });
    window.addEventListener('scroll', peel, { passive: true });
    window.addEventListener('resize', peel);
    peel();
  }


  /* ---------------------------------------------------------------------------
     FROZEN — stillness + thaw
     A canvas, painted at half resolution (cheaper, and softer like real frost).
       · every half second a thin coat of frost is painted over the whole thing, edges thickest
       · moving the pointer erases a soft circle along its path
     Hold still and the page closes over; the exits only stay findable if you keep moving.
     --------------------------------------------------------------------------- */
  function frozen() {
    const canvas = document.querySelector('.frost');
    const ctx = canvas.getContext('2d');
    const SCALE = 0.5;
    const CREEP_EVERY = 500;             // ms between coats
    const CREEP_ALPHA = 0.06;            // strength of one coat
    let w = 0;
    let h = 0;
    let pattern = null;
    let last = null;

    const tile = new Image();
    tile.src = 'img/textures/frost.png';

    function coat(alpha) {
      if (!pattern) return;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    /* start frosted round the edges and clear in the middle, so the first view is never a blank white wall */
    function seed() {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) coat(0.7);
      ctx.globalCompositeOperation = 'destination-out';
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.12, w / 2, h / 2, Math.max(w, h) * 0.62);
      g.addColorStop(0, 'rgba(0,0,0,.95)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }

    function resize() {
      w = Math.ceil(window.innerWidth * SCALE);
      h = Math.ceil(window.innerHeight * SCALE);
      canvas.width = w;
      canvas.height = h;
      seed();
    }

    tile.onload = () => {
      pattern = ctx.createPattern(tile, 'repeat');
      if (pattern && pattern.setTransform && window.DOMMatrix) pattern.setTransform(new DOMMatrix([0.6, 0, 0, 0.6, 0, 0]));
      resize();
    };
    window.addEventListener('resize', perFrame(resize));
    resize();

    /* thaw a soft circle (x, y, radius in CSS pixels) */
    function thaw(x, y, r) {
      const cx = x * SCALE;
      const cy = y * SCALE;
      const rr = r * SCALE;
      const g = ctx.createRadialGradient(cx, cy, rr * 0.25, cx, cy, rr);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    const radius = () => Math.max(70, Math.min(window.innerWidth, window.innerHeight) * 0.11);

    window.addEventListener('pointermove', (e) => {
      const r = radius();
      if (last) {                        // fill in between events so a fast sweep leaves one continuous clear path
        const dx = e.clientX - last.x;
        const dy = e.clientY - last.y;
        const steps = Math.ceil(Math.hypot(dx, dy) / (r * 0.35));
        for (let i = 1; i <= steps; i++) thaw(last.x + (dx * i) / steps, last.y + (dy * i) / steps, r);
      } else {
        thaw(e.clientX, e.clientY, r);
      }
      last = { x: e.clientX, y: e.clientY };
    }, { passive: true });
    document.addEventListener('pointerleave', () => { last = null; });
    window.addEventListener('pointerdown', (e) => thaw(e.clientX, e.clientY, radius() * 1.2), { passive: true });

    /* keyboard users: focusing a link thaws the ice around it */
    document.addEventListener('focusin', (e) => {
      const b = e.target.getBoundingClientRect();
      thaw(b.left + b.width / 2, b.top + b.height / 2, Math.max(b.width, b.height) * 0.95);
    });

    /* the creep: a thin coat everywhere, plus a little extra at the edges so the frost closes in from the sides */
    if (!reduceMotion) {
      window.setInterval(() => {
        if (document.hidden) return;                                  // frost does not build while you are away
        coat(CREEP_ALPHA);
        const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.7);
        g.addColorStop(0, 'rgba(226,240,250,0)');
        g.addColorStop(1, 'rgba(226,240,250,.05)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }, CREEP_EVERY);
    }
  }


  /* ---------------------------------------------------------------------------
     go
     --------------------------------------------------------------------------- */
  wireDoors();
  const pages = { landing, water, desert, forest, frozen };
  if (pages[page]) pages[page]();
})();
