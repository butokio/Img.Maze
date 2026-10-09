#!/usr/bin/env python3
"""
Generates the paper-cut forest pieces for forest.html as SVG (no dependencies, seeded => reproducible).

  tools/foliage-src/far.svg           4800x900  far plane: pale, hazy trunks behind all three scenes
  tools/foliage-src/trunk-1..9.svg    one dark trunk each (the mid plane), so every trunk can be moved on its own
  tools/foliage-src/front-left.svg    foliage curtain on the left of scene 2 (peels away to the left)
  tools/foliage-src/front-right.svg   foliage curtain on the right of scene 2 (peels away to the right)
  tools/foliage-src/corner-1.svg      foliage clump for the corner of scene 1
  tools/foliage-src/corner-2.svg      foliage clump for the corner of scene 3
  tools/foliage-src/undergrowth.svg   4800x330  fern and grass strip along the floor of all three scenes
  tools/foliage-src/leaf-1.svg        a fern frond: the "turn the page" link at the end of scene 1
  tools/foliage-src/leaf-2.svg        ... and the one at the end of scene 2

Run:  python3 tools/build-foliage.py   then   node tools/rasterize-foliage.cjs
(the PNGs in images/foliage/ are what the page uses; the SVGs in tools/foliage-src/ are the editable originals,
 open them in Illustrator / Figma)
"""
import math
import os
import random
import re

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'foliage-src')
os.makedirs(OUT, exist_ok=True)

STRIP_W = 4800  # three scenes of 1600 wide


# ------------------------------------------------------------------ primitives
def f(n):
    return f'{n:.1f}'


def leaf_path(x, y, ang, length, width, bend=0.0):
    """Pointed, lens-shaped leaf: base (x,y) -> tip, two quadratic curves."""
    ca, sa = math.cos(ang), math.sin(ang)
    px, py = -sa, ca
    mx, my = x + 0.5 * length * ca + bend * length * px, y + 0.5 * length * sa + bend * length * py
    tx, ty = x + length * ca + bend * length * 1.4 * px, y + length * sa + bend * length * 1.4 * py
    c1 = (mx + width * px, my + width * py)
    c2 = (mx - width * px, my - width * py)
    return f'M{f(x)},{f(y)}Q{f(c1[0])},{f(c1[1])} {f(tx)},{f(ty)}Q{f(c2[0])},{f(c2[1])} {f(x)},{f(y)}Z'


def frond(rng, x0, y0, ang0, length, curl, leaflet, n=34):
    """A fern frond: curved rachis with leaflets either side that shrink toward the tip.
    Returns (list of leaf paths, rachis path)."""
    x, y, ang = x0, y0, ang0
    step = length / n
    leaves, pts = [], []
    for i in range(n):
        t = i / n
        pts.append((x, y))
        size = leaflet * (1 - t) ** 0.62 * (0.55 + 0.45 * math.sin(math.pi * min(1, t * 0.85 + 0.15)))
        spread = math.radians(64 - 26 * t)
        if i > 1:
            for sgn in (1, -1):
                a = ang + sgn * spread + rng.uniform(-0.12, 0.12)
                leaves.append(leaf_path(x, y, a, size, size * 0.2, bend=sgn * 0.05))
        x += step * math.cos(ang)
        y += step * math.sin(ang)
        ang += curl * step
    rachis = 'M' + ' L'.join(f'{f(px)},{f(py)}' for px, py in pts)
    return leaves, rachis


def broad_leaf(rng, x, y, ang, length):
    return leaf_path(x, y, ang, length, length * rng.uniform(0.2, 0.3), bend=rng.uniform(-0.12, 0.12))


def trunk_polygon(rng, cx, width, top, bottom, lean=0.0, jitter=3.0, flare=1.0, taper=0.12):
    n = 12
    ys = [top + (bottom - top) * i / (n - 1) for i in range(n)]
    left, right = [], []
    for y in ys:
        t = (y - top) / (bottom - top)
        w = width * (1 + taper * (0.5 - t)) * (1 + (flare - 1) * max(0, t - 0.82) / 0.18)
        c = cx + lean * (y - (top + bottom) / 2)
        left.append((c - w / 2 + rng.uniform(-jitter, jitter), y))
        right.append((c + w / 2 + rng.uniform(-jitter, jitter), y))
    pts = left + right[::-1]
    return 'M' + ' L'.join(f'{f(a)},{f(b)}' for a, b in pts) + 'Z', left, right


def svg(w, h, body, defs=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
            f'preserveAspectRatio="xMidYMax slice">{defs}{body}</svg>')


def write(name, content):
    path = os.path.join(OUT, name)
    with open(path, 'w') as fh:
        fh.write(content)
    print(f'{name:22s} {len(content) / 1024:6.1f} KB')


# ------------------------------------------------------------------ far plane
def build_far():
    rng = random.Random(21)
    W, H = STRIP_W, 900
    out = []
    x = -30
    while x < W + 40:
        w = rng.uniform(16, 46)
        d, left, right = trunk_polygon(rng, x, w, -20, 930, lean=rng.uniform(-0.012, 0.012), jitter=1.6)
        shade = rng.choice(['#7e9d78', '#86a47e', '#73926f', '#8fab84'])
        out.append(f'<path d="{d}" fill="{shade}" opacity="{rng.uniform(0.45, 0.8):.2f}"/>')
        # a soft highlight stripe down the lit side
        hl = 'M' + ' L'.join(f'{f(a + w * 0.12)},{f(b)}' for a, b in left) + ' ' + \
             ' '.join(f'L{f(a + w * 0.34)},{f(b)}' for a, b in left[::-1]) + 'Z'
        out.append(f'<path d="{hl}" fill="#c4d8b2" opacity="0.28"/>')
        x += rng.uniform(70, 190)
    defs = ('<defs><linearGradient id="fog" x1="0" y1="0" x2="0" y2="1">'
            '<stop offset="0.35" stop-color="#cfe2bf" stop-opacity="0"/>'
            '<stop offset="1" stop-color="#c3d9b0" stop-opacity="0.85"/></linearGradient></defs>')
    out.append(f'<rect width="{W}" height="{H}" fill="url(#fog)"/>')
    write('far.svg', svg(W, H, ''.join(out), defs))


# ------------------------------------------------------------------ mid plane: one trunk per file
def build_trunks(count=9):
    rng = random.Random(5)
    palette = ['#35523a', '#2d4a33', '#3b5b3f', '#2a4430']
    for i in range(count):
        width = rng.uniform(95, 175)
        flare = rng.uniform(1.0, 1.5)
        W, H = int(width * flare) + 70, 960
        cx = W / 2
        col = palette[i % len(palette)]
        d, left, right = trunk_polygon(rng, cx, width, -30, 940, lean=rng.uniform(-0.015, 0.015), jitter=3.5, flare=flare)
        out = [f'<path d="{d}" fill="{col}"/>']
        # lit side
        hl = 'M' + ' L'.join(f'{f(a + width * 0.08)},{f(b)}' for a, b in left) + ' ' + \
             ' '.join(f'L{f(a + width * 0.3)},{f(b)}' for a, b in left[::-1]) + 'Z'
        out.append(f'<path d="{hl}" fill="#5c8560" opacity="0.5"/>')
        # bark furrows
        for _ in range(int(width / 14) + 2):
            u = rng.uniform(0.12, 0.88)
            y0 = rng.uniform(0, 600)
            seg = []
            for j in range(rng.randint(5, 9)):
                yy = y0 + j * rng.uniform(26, 48)
                a, b = left[min(len(left) - 1, int(yy / 80))], right[min(len(right) - 1, int(yy / 80))]
                seg.append((a[0] + (b[0] - a[0]) * u + rng.uniform(-3, 3), yy))
            out.append('<path d="M' + ' L'.join(f'{f(a)},{f(b)}' for a, b in seg) +
                       '" stroke="#1b3022" stroke-width="2.4" fill="none" opacity="0.55" stroke-linecap="round"/>')
        write(f'trunk-{i + 1}.svg', svg(W, H, ''.join(out)))


# ------------------------------------------------------------------ foliage clumps and curtains
def curtain(name, seed, mirror):
    rng = random.Random(seed)
    W, H = 1000, 900
    palette = ['#10261a', '#143020', '#193a26', '#102a1c']
    hl = '#2f5f39'
    out = []

    def mx(x):  # mirror helper: the right curtain is the left one flipped
        return W - x if mirror else x

    def mang(a):
        return math.pi - a if mirror else a

    origins = [  # (x, y, angle range, count, length range) - fronds enter from the lower and upper outer corners
        (-60, 960, (-85, -8), 8, (620, 1000)),
        (-70, 420, (-48, 35), 5, (520, 820)),
        (-40, -50, (12, 82), 7, (560, 980)),
        (260, -60, (60, 118), 3, (300, 620)),
        (180, 980, (-110, -62), 4, (320, 640)),
    ]
    shadow, body = [], []
    for ox, oy, (a0, a1), count, (l0, l1) in origins:
        for k in range(count):
            ang = math.radians(rng.uniform(a0, a1))
            length = rng.uniform(l0, l1)
            curl = rng.uniform(-0.0016, 0.0016)
            leaves, rachis = frond(rng, mx(ox), oy, mang(ang), length, -curl if mirror else curl, rng.uniform(95, 150))
            col = rng.choice(palette)
            shadow.append(''.join(f'<path d="{d}"/>' for d in leaves))
            body.append(f'<g fill="{col}" stroke="{col}" stroke-width="1">' + ''.join(f'<path d="{d}"/>' for d in leaves) + '</g>')
            body.append(f'<path d="{rachis}" fill="none" stroke="{hl}" stroke-width="3" opacity="0.5" stroke-linecap="round"/>')
    # a few broad leaves for variety of silhouette
    for _ in range(7):
        ox = rng.uniform(-30, 220)
        oy = rng.choice([rng.uniform(40, 220), rng.uniform(700, 940)])
        ang = math.radians(rng.uniform(-70, 70) if oy < 400 else rng.uniform(-100, -40))
        d = broad_leaf(rng, mx(ox), oy, mang(ang), rng.uniform(260, 460))
        shadow.append(f'<path d="{d}"/>')
        col = rng.choice(palette)
        body.append(f'<path d="{d}" fill="{col}"/>')
        body.append(f'<path d="{d}" fill="none" stroke="{hl}" stroke-width="2.4" opacity="0.35"/>')
    out.append('<g fill="#04100a" opacity="0.3" transform="translate(6 9)">' + ''.join(shadow) + '</g>')
    out.extend(body)
    write(name, svg(W, H, ''.join(out)))


def clump(name, seed, mirror):
    """A tuft of ferns and broad leaves growing up from the bottom corner of a scene. Nothing is cut off except at the bottom
    and on the outer side, so the top of the picture is all natural leaf tips."""
    rng = random.Random(seed)
    W, H = 900, 760
    palette = ['#10261a', '#143020', '#193a26', '#102a1c']
    hl = '#2f5f39'

    def mx(x):
        return W - x if mirror else x

    def mang(a):
        return math.pi - a if mirror else a

    origins = [  # (x, y, angle range in degrees (negative = up), count, length range)
        (-40, H + 40, (-82, -20), 7, (420, 700)),
        (60, H + 60, (-120, -55), 6, (360, 620)),
        (-60, H - 220, (-60, 10), 4, (300, 520)),
        (170, H + 50, (-140, -95), 3, (300, 500)),
    ]
    shadow, body, all_d = [], [], []
    for ox, oy, (a0, a1), count, (l0, l1) in origins:
        for _ in range(count):
            ang = math.radians(rng.uniform(a0, a1))
            curl = rng.uniform(-0.0016, 0.0016)
            leaves, rachis = frond(rng, mx(ox), oy, mang(ang), rng.uniform(l0, l1), -curl if mirror else curl, rng.uniform(95, 150))
            col = rng.choice(palette)
            all_d += leaves + [rachis]
            shadow.append(''.join(f'<path d="{d}"/>' for d in leaves))
            body.append(f'<g fill="{col}" stroke="{col}" stroke-width="1">' + ''.join(f'<path d="{d}"/>' for d in leaves) + '</g>')
            body.append(f'<path d="{rachis}" fill="none" stroke="{hl}" stroke-width="3" opacity="0.5" stroke-linecap="round"/>')
    for _ in range(6):  # a few broad leaves for a different silhouette
        ox = rng.uniform(-20, 260)
        ang = math.radians(rng.uniform(-115, -35))
        d = broad_leaf(rng, mx(ox), H + 20, mang(ang), rng.uniform(260, 430))
        all_d.append(d)
        shadow.append(f'<path d="{d}"/>')
        col = rng.choice(palette)
        body.append(f'<path d="{d}" fill="{col}"/>')
        body.append(f'<path d="{d}" fill="none" stroke="{hl}" stroke-width="2.4" opacity="0.35"/>')
    # crop the picture to the tuft: flush with the bottom and the outer side, snug at the top and the inner side
    nums = [float(v) for d in all_d for v in re.findall(r'-?\d+\.?\d*', d)]
    xs, ys = nums[0::2], nums[1::2]
    pad = 16
    y0 = min(ys) - pad
    x0 = 0 if not mirror else min(xs) - pad
    cw = int((max(xs) + pad) if not mirror else (W - x0))
    ch = int(H - y0)
    out = [f'<g transform="translate({f(-x0)} {f(-y0)})">'
           '<g fill="#04100a" opacity="0.3" transform="translate(6 9)">' + ''.join(shadow) + '</g>'] + body + ['</g>']
    write(name, svg(cw, ch, ''.join(out)))


# ------------------------------------------------------------------ the "turn the page" leaves
def build_leaf(name, seed, tilt, curl, length=760):
    """One big fern frond (a link, so it is a little lighter than the curtains). The picture is cropped to the frond
    itself, so nothing is cut off; the root of the frond is at the top of the picture."""
    rng = random.Random(seed)
    palette = ['#1d4a2b', '#25562f', '#2a5c33', '#1f4f2c']
    leaves, rachis = frond(rng, 0, 0, math.radians(tilt), length, curl, 140, n=30)
    nums = [float(v) for d in leaves + [rachis] for v in re.findall(r'-?\d+\.?\d*', d)]
    xs, ys = nums[0::2], nums[1::2]
    pad = 24
    minx, miny = min(xs) - pad, min(ys) - pad
    W, H = int(max(xs) - minx + pad + 8), int(max(ys) - miny + pad + 10)  # extra room on the right/bottom for the shadow
    col = rng.choice(palette)
    shape = ''.join(f'<path d="{d}"/>' for d in leaves)
    body = (f'<g transform="translate({f(-minx)} {f(-miny)})">'
            f'<g fill="#04100a" opacity="0.28" transform="translate(6 9)">{shape}</g>'
            f'<g fill="{col}" stroke="{col}" stroke-width="1">{shape}</g>'
            f'<path d="{rachis}" fill="none" stroke="#4f8a55" stroke-width="4" opacity="0.6" stroke-linecap="round"/></g>')
    write(name, svg(W, H, body))


# ------------------------------------------------------------------ floor
def build_undergrowth():
    rng = random.Random(77)
    W, H = STRIP_W, 330
    out = []
    greens = ['#1f4a2a', '#2a5c33', '#356b3b', '#26502e', '#3d7a42']
    for layer, (count, lo, hi) in enumerate([(210, 90, 210), (240, 120, 260), (168, 150, 330)]):
        for _ in range(count):
            x = rng.uniform(-20, W + 20)
            ang = math.radians(-90 + rng.uniform(-38, 38))
            out.append(f'<path d="{leaf_path(x, 320, ang, rng.uniform(lo, hi), rng.uniform(6, 13), bend=rng.uniform(-0.14, 0.14))}" '
                       f'fill="{greens[(layer * 2 + rng.randint(0, 2)) % len(greens)]}"/>')
    out.append(f'<rect x="0" y="300" width="{W}" height="30" fill="#14301c"/>')
    write('undergrowth.svg', svg(W, H, ''.join(out)).replace('xMidYMax slice', 'xMidYMax meet'))


if __name__ == '__main__':
    build_far()
    build_trunks()
    curtain('front-left.svg', 301, mirror=False)
    curtain('front-right.svg', 302, mirror=True)
    clump('corner-1.svg', 303, mirror=False)
    clump('corner-2.svg', 304, mirror=True)
    build_leaf('leaf-1.svg', 401, tilt=112, curl=-0.0006)
    build_leaf('leaf-2.svg', 402, tilt=70, curl=0.0006)
    build_undergrowth()
