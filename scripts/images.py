#!/usr/bin/env python3
"""Draws the namepicker's link-preview image (og.png, 1200x630, the page's og:image)
and its app icons in icons/.

Run from the repo root after changing the look: python3 scripts/images.py
Needs Pillow and a light sans-serif font (Ubuntu Sans by default; pass another
.ttf with --font). The PNGs are committed, so this only runs when they change.
Preview services cache og:image for up to 30 days, so a changed preview image is
best given a new file name (and the og:image tag in index.html updated).
"""
import argparse
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / 'icons'
ICON_SIZES = [180, 192, 512]  # apple-touch-icon, then the manifest's two
W, H = 1200, 630
S = 2  # drawn at twice the size, then scaled down for smooth edges
# The site's colours (the dark site theme) and the wheel's slices
BG, FG, MUTED, FAINT = '#111111', '#ffffff', '#999999', '#555555'
WHEEL_COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff9f1c', '#e040fb', '#00bcd4', '#f06292']


def font(path, size, weight):
    f = ImageFont.truetype(path, size * S)
    try:
        axes = f.get_variation_axes()
    except OSError:
        return f  # not a variable font
    names = [a['name'].decode() if isinstance(a['name'], bytes) else a['name'] for a in axes]
    f.set_variation_by_axes([weight if n == 'Weight' else a['default'] for n, a in zip(names, axes)])
    return f


def spaced(draw, xy, text, f, fill, spacing):
    """Text with extra letter spacing (like the site's uppercase labels)."""
    x, y = xy[0] * S, xy[1] * S
    for ch in text:
        draw.text((x, y), ch, font=f, fill=fill, anchor='ls')
        x += draw.textlength(ch, font=f) + spacing * S


def preview_image(path):
    img = Image.new('RGB', (W * S, H * S), BG)
    d = ImageDraw.Draw(img)
    names = ['Anna', 'Bo', 'Cecilia', 'David', 'Erik', 'Frida', 'Gustav', 'Hanna']
    cx, cy, r = 330 * S, 315 * S, 230 * S
    step = 360 / len(names)
    label = font(path, 22, 500)
    for i, n in enumerate(names):
        start = -90 + i * step - step / 2
        d.pieslice((cx - r, cy - r, cx + r, cy + r), start, start + step, fill=WHEEL_COLORS[i], outline=BG, width=3 * S)
        a = math.radians(start + step / 2)
        tx, ty = cx + math.cos(a) * r * 0.62, cy + math.sin(a) * r * 0.62
        txt = Image.new('RGBA', (int(r * 0.7), 40 * S), (0, 0, 0, 0))
        ImageDraw.Draw(txt).text((txt.width / 2, txt.height / 2), n, font=label, fill='#111111', anchor='mm')
        # Along the radius, turned so no name on the left half is upside down
        turn = -math.degrees(a) + (180 if math.cos(a) < -1e-9 else 0)
        txt = txt.rotate(turn, resample=Image.BICUBIC, expand=True)
        img.paste(txt, (int(tx - txt.width / 2), int(ty - txt.height / 2)), txt)
    hub = 28 * S
    d.ellipse((cx - hub, cy - hub, cx + hub, cy + hub), fill=BG, outline=FG, width=3 * S)
    # The pointer at the top, pointing down into the wheel
    p = 26 * S
    d.polygon([(cx - p * 0.7, cy - r - p * 0.9), (cx + p * 0.7, cy - r - p * 0.9), (cx, cy - r + p * 0.6)], fill=FG)

    x = 640
    spaced(d, (x, 270), 'NAMNVÄLJARE', font(path, 52, 300), FG, 8)
    body = font(path, 28, 300)
    d.text((x * S, 330 * S), 'Slumpa vem som är på tur', font=body, fill=MUTED, anchor='ls')
    d.text((x * S, 372 * S), 'med lyckohjul, hatt, enarmad bandit', font=body, fill=MUTED, anchor='ls')
    d.text((x * S, 414 * S), 'eller fjärrkontroll.', font=body, fill=MUTED, anchor='ls')
    spaced(d, (x, 560), 'jakobmarkgren.se', font(path, 20, 300), FAINT, 2)
    img.resize((W, H), Image.LANCZOS).save(ROOT / 'og.png', optimize=True)
    print('wrote', ROOT / 'og.png')


def icons():
    """The wheel without names, kept inside the middle 80 % so the icon also works
    masked to a circle or rounded square (the manifest's "maskable")."""
    n = 512 * S
    img = Image.new('RGB', (n, n), BG)
    d = ImageDraw.Draw(img)
    cx, cy, r = n / 2, n * 0.53, n * 0.3
    step = 360 / len(WHEEL_COLORS)
    for i, color in enumerate(WHEEL_COLORS):
        start = -90 + i * step - step / 2
        d.pieslice((cx - r, cy - r, cx + r, cy + r), start, start + step, fill=color, outline=BG, width=4 * S)
    hub = n * 0.05
    d.ellipse((cx - hub, cy - hub, cx + hub, cy + hub), fill=BG, outline=FG, width=5 * S)
    p = n * 0.06
    d.polygon([(cx - p * 0.7, cy - r - p * 0.9), (cx + p * 0.7, cy - r - p * 0.9), (cx, cy - r + p * 0.6)], fill=FG)
    ICONS.mkdir(exist_ok=True)
    for size in ICON_SIZES:
        img.resize((size, size), Image.LANCZOS).save(ICONS / f'icon-{size}.png', optimize=True)
        print('wrote', ICONS / f'icon-{size}.png')


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--font', default='/usr/share/fonts/truetype/ubuntu/UbuntuSans[wdth,wght].ttf')
    args = ap.parse_args()
    preview_image(args.font)
    icons()
