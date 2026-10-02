#!/usr/bin/env python3
"""
Builds the submission ZIP: ONE folder (Img.Maze/) holding the pages, the stylesheet, README.md and
only the images those files actually use. tools/, .git and anything unused are left out.

    python3 tools/make-zip.py                 -> ../Img.Maze-prototype.zip (next to the project folder)
    python3 tools/make-zip.py some/where.zip  -> that file

It stops with an error if a page or the stylesheet points at a file that does not exist.
"""
import os
import re
import sys
import zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
FOLDER = 'Img.Maze'
PAGES = ['index.html', 'water.html', 'desert.html']
CSS = 'stylesheets/mystyles.css'
OUT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'Img.Maze-prototype.zip')


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as fh:
        return fh.read()


files = set(PAGES + [CSS, 'README.md'])
for page in PAGES:
    for url in re.findall(r'(?:href|src)="([^"#]+)"', read(page)):
        if not re.match(r'(https?:|data:|mailto:)', url):
            files.add(url)
for url in re.findall(r'url\("?([^")]+)"?\)', read(CSS)):
    if not url.startswith('data:'):
        files.add(os.path.normpath(os.path.join(os.path.dirname(CSS), url)).replace(os.sep, '/'))

missing = sorted(f for f in files if not os.path.isfile(os.path.join(ROOT, f)))
if missing:
    sys.exit('Missing files (a page or the stylesheet points at them):\n  ' + '\n  '.join(missing))

with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in sorted(files):
        z.write(os.path.join(ROOT, f), f'{FOLDER}/{f}')

size = os.path.getsize(OUT) / 1048576
print(f'{len(files)} files, {size:.1f} MB -> {OUT}')
