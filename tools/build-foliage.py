#!/usr/bin/env python3
"""
Generates the paper-cut forest planes for forest.html as SVG (no dependencies, seeded => reproducible).

  img/foliage/src/back.svg         far plane   - pale, hazy trunks
  img/foliage/src/mid.svg          mid plane   - rigid dark trunks with gaps the creatures peek through
  img/foliage/src/front-left.svg   front plane - foliage curtain that peels away to the left
  img/foliage/src/front-right.svg  front plane - foliage curtain that peels away to the right
  img/foliage/src/undergrowth.svg  fern / grass strip along the floor

Run:  python3 tools/build-foliage.py   then   node tools/rasterize-foliage.cjs   (PNGs are what the page uses;
the SVGs in img/foliage/src/ are the editable originals - open them in Illustrator / Figma)
"""
import math
import os
import random

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img', 'foliage', 'src')
os.makedirs(OUT, exist_ok=True)


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
def build_back():
    rng = random.Random(21)
    out = []
    x = -30
    while x < 1640:
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
    out.append('<rect width="1600" height="900" fill="url(#fog)"/>')
    write('back.svg', svg(1600, 900, ''.join(out), defs))


# ------------------------------------------------------------------ mid plane
def build_mid():
    rng = random.Random(5)
    # centre x, width, flare at the foot - chosen to leave readable gaps for the creatures
    spec = [(95, 170, 1.5), (390, 118, 1.25), (640, 92, 1.0), (1070, 126, 1.35), (1352, 104, 1.1), (1560, 150, 1.45)]
    palette = ['#35523a', '#2d4a33', '#3b5b3f', '#2a4430']
    out = []
    for i, (cx, w, flare) in enumerate(spec):
        col = palette[i % len(palette)]
        d, left, right = trunk_polygon(rng, cx, w, -30, 940, lean=rng.uniform(-0.015, 0.015), jitter=3.5, flare=flare)
        # cut-paper shadow, then the trunk
        out.append(f'<path d="{d}" fill="#0b1a10" opacity="0.28" transform="translate(7 9)"/>')
        out.append(f'<path d="{d}" fill="{col}"/>')
        # lit side
        hl = 'M' + ' L'.join(f'{f(a + w * 0.08)},{f(b)}' for a, b in left) + ' ' + \
             ' '.join(f'L{f(a + w * 0.3)},{f(b)}' for a, b in left[::-1]) + 'Z'
        out.append(f'<path d="{hl}" fill="#5c8560" opacity="0.5"/>')
        # bark furrows
        for _ in range(int(w / 14) + 2):
            u = rng.uniform(0.12, 0.88)
            y0 = rng.uniform(0, 600)
            seg = []
            for j in range(rng.randint(5, 9)):
                yy = y0 + j * rng.uniform(26, 48)
                a, b = left[min(len(left) - 1, int(yy / 80))], right[min(len(right) - 1, int(yy / 80))]
                seg.append((a[0] + (b[0] - a[0]) * u + rng.uniform(-3, 3), yy))
            out.append('<path d="M' + ' L'.join(f'{f(a)},{f(b)}' for a, b in seg) +
                       '" stroke="#1b3022" stroke-width="2.4" fill="none" opacity="0.55" stroke-linecap="round"/>')
        # a short broken branch
        if i % 2 == 0:
            by = rng.uniform(180, 420)
            side = 1 if rng.random() > 0.5 else -1
            bx = cx + side * w * 0.45
            out.append(f'<path d="{leaf_path(bx, by, math.radians(-30 if side > 0 else -150), 150, 9)}" fill="{col}"/>')
    # ground
    out.append('<path d="M0,872 Q380,845 800,868 T1600,860 L1600,900 L0,900Z" fill="#1d3524"/>')
    write('mid.svg', svg(1600, 900, ''.join(out)))


# ------------------------------------------------------------------ front curtains
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


# ------------------------------------------------------------------ floor
def build_undergrowth():
    rng = random.Random(77)
    out = []
    greens = ['#1f4a2a', '#2a5c33', '#356b3b', '#26502e', '#3d7a42']
    for layer, (count, lo, hi) in enumerate([(70, 90, 210), (80, 120, 260), (56, 150, 330)]):
        for _ in range(count):
            x = rng.uniform(-20, 1620)
            ang = math.radians(-90 + rng.uniform(-38, 38))
            out.append(f'<path d="{leaf_path(x, 320, ang, rng.uniform(lo, hi), rng.uniform(6, 13), bend=rng.uniform(-0.14, 0.14))}" '
                       f'fill="{greens[(layer * 2 + rng.randint(0, 2)) % len(greens)]}"/>')
    out.append('<rect x="0" y="300" width="1600" height="30" fill="#14301c"/>')
    write('undergrowth.svg', svg(1600, 330, ''.join(out)).replace('xMidYMax slice', 'xMidYMax meet'))


if __name__ == '__main__':
    build_back()
    build_mid()
    curtain('front-left.svg', 301, mirror=False)
    curtain('front-right.svg', 302, mirror=True)
    build_undergrowth()
