#!/usr/bin/env python3
"""Build Android adaptive-icon foreground + monochrome from the HD logo mark.

Source: assets/images/icon.png (1024² isolated knight + orange waves on navy).
Output: assets/icon/android-adaptive-{foreground,monochrome}.png at 1024².
Does not touch splash, menu, or expo.icon.
"""
from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "images" / "icon.png"
OUT_DIR = ROOT / "assets" / "icon"
FOREGROUND = OUT_DIR / "android-adaptive-foreground.png"
MONOCHROME = OUT_DIR / "android-adaptive-monochrome.png"

CANVAS = 1024
# Occupy ~58% of the 1024 canvas so the mark sits inside Android's ~66% safe zone.
TARGET_FRACTION = 0.58
FLOOD_THRESH = 38.0
EDGE_FEATHER_PX = 1.2


def flood_background(dist: np.ndarray, thresh: float) -> np.ndarray:
    h, w = dist.shape
    visited = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        q.append((0, x))
        q.append((h - 1, x))
    for y in range(h):
        q.append((y, 0))
        q.append((y, w - 1))
    while q:
        y, x = q.popleft()
        if not (0 <= y < h and 0 <= x < w) or visited[y, x]:
            continue
        if dist[y, x] > thresh:
            continue
        visited[y, x] = True
        q.append((y - 1, x))
        q.append((y + 1, x))
        q.append((y, x - 1))
        q.append((y, x + 1))
        q.append((y - 1, x - 1))
        q.append((y - 1, x + 1))
        q.append((y + 1, x - 1))
        q.append((y + 1, x + 1))
    return visited


def extract_mark(src: Image.Image) -> Image.Image:
    rgba = np.array(src.convert("RGBA"))
    rgb = rgba[:, :, :3].astype(np.float32)
    bg = rgb[0:16, :].reshape(-1, 3).mean(axis=0)
    dist = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    background = flood_background(dist, FLOOD_THRESH)

    hard = np.where(background, 0, 255).astype(np.uint8)
    alpha_img = Image.fromarray(hard, mode="L").filter(
        ImageFilter.GaussianBlur(radius=EDGE_FEATHER_PX)
    )
    alpha = np.array(alpha_img)
    eroded = np.array(Image.fromarray(hard, mode="L").filter(ImageFilter.MinFilter(3)))
    alpha[eroded == 255] = 255
    alpha[hard == 0] = np.minimum(alpha[hard == 0], 80)

    # Re-zero far background so navy never remains as a square plate.
    alpha[background & (dist < FLOOD_THRESH * 0.55)] = 0

    a = alpha.astype(np.float32) / 255.0
    out = rgba.copy()
    edge = (a > 0.02) & (a < 0.98)
    denom = np.maximum(a[edge], 1e-4)[:, None]
    cleaned = (rgb[edge] - bg * (1.0 - a[edge])[:, None]) / denom
    out[:, :, :3][edge] = np.clip(cleaned, 0, 255).astype(np.uint8)
    out[:, :, 3] = alpha
    out[alpha == 0] = (0, 0, 0, 0)
    return Image.fromarray(out, mode="RGBA")


def crop_content(im: Image.Image) -> Image.Image:
    alpha = np.array(im.split()[-1])
    ys, xs = np.where(alpha > 8)
    if xs.size == 0:
        raise SystemExit("adaptive icon extraction produced an empty mark")
    pad = 2
    left = max(0, int(xs.min()) - pad)
    top = max(0, int(ys.min()) - pad)
    right = min(im.width, int(xs.max()) + 1 + pad)
    bottom = min(im.height, int(ys.max()) + 1 + pad)
    return im.crop((left, top, right, bottom))


def fit_on_canvas(mark: Image.Image) -> Image.Image:
    target = int(round(CANVAS * TARGET_FRACTION))
    w, h = mark.size
    scale = target / max(w, h)
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))
    scaled = mark.resize((new_w, new_h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.paste(scaled, ((CANVAS - new_w) // 2, (CANVAS - new_h) // 2), scaled)
    return canvas


def to_monochrome(im: Image.Image) -> Image.Image:
    _, _, _, alpha = im.split()
    white = Image.new("L", im.size, 255)
    out = Image.merge("RGBA", (white, white, white, alpha))
    return out


def main() -> None:
    src = Image.open(SOURCE)
    mark = fit_on_canvas(crop_content(extract_mark(src)))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    mark.save(FOREGROUND, format="PNG", optimize=True)
    to_monochrome(mark).save(MONOCHROME, format="PNG", optimize=True)
    fg = Image.open(FOREGROUND)
    print(f"wrote {FOREGROUND.relative_to(ROOT)} {fg.size} {fg.mode}")
    print(f"wrote {MONOCHROME.relative_to(ROOT)} {Image.open(MONOCHROME).size}")


if __name__ == "__main__":
    main()
