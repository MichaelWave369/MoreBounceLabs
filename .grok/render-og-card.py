#!/usr/bin/env python3
"""Brand share card for MicTek House. Exact 2x canvas, downscaled to 1200x630."""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 2400, 1260
OUT = Path("/workspace/.grok/og-render.png")
FONTS = Path("/workspace/.grok/fonts")


def rgb(hex_color: str) -> np.ndarray:
    h = hex_color.lstrip("#")
    return np.array([int(h[i : i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


AMBER = rgb("E4A04A")
HEAT = rgb("FF5C33")
CREAM = rgb("F4EFE6")
BLACK = rgb("100E0C")

xs = np.arange(W, dtype=np.float32)[None, :]
ys = np.arange(H, dtype=np.float32)[:, None]


def add_glow(arr, cx, cy, rx, ry, color, amount, power=2.0):
    dx = (xs - cx) / rx
    dy = (ys - cy) / ry
    mask = np.clip(1.0 - (dx * dx + dy * dy), 0, 1) ** power
    m = mask * amount
    return arr * (1 - m[..., None]) + (color / 255.0) * m[..., None]


def main() -> None:
    arr = np.zeros((H, W, 3), dtype=np.float32)
    arr[:] = BLACK / 255.0

    # Late-night listening room: amber pool left, heat ember right, cream haze up top.
    arr = add_glow(arr, 760, 680, 980, 820, AMBER, 0.62, 1.6)
    arr = add_glow(arr, 1880, 860, 760, 560, HEAT, 0.34, 1.8)
    arr = add_glow(arr, 1280, 180, 1500, 480, CREAM, 0.10, 2.2)
    arr = add_glow(arr, 430, 220, 420, 280, AMBER, 0.18, 2.0)

    dx = (xs - W / 2) / (W * 0.62)
    dy = (ys - H / 2) / (H * 0.72)
    vig = np.clip(dx * dx + dy * dy, 0, 1) ** 1.15
    arr = arr * (1 - 0.62 * vig[..., None])

    rng = np.random.default_rng(369)
    star = rng.random((H, W))
    bright = (star > 0.9986).astype(np.float32)
    dim = ((star > 0.9968) & (star <= 0.9986)).astype(np.float32) * 0.45
    spark = (bright + dim) * (0.55 + 0.45 * rng.random((H, W)))
    arr = np.clip(arr + spark[..., None] * (CREAM / 255.0), 0, 1)

    base = Image.fromarray((arr * 255).astype(np.uint8), "RGB").convert("RGBA")

    # Vinyl
    cx, cy, r = 690, 650, 500
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse(
        [cx - r - 20, cy - r + 50, cx + r + 40, cy + r + 90], fill=(0, 0, 0, 160)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(46))
    base = Image.alpha_composite(base, shadow)

    vinyl = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vinyl)
    vd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(18, 14, 12, 255))
    vd.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(0xE4, 0xA0, 0x4A, 255), width=16)
    for i, rad in enumerate(range(int(r * 0.36), r - 22, 8)):
        if i % 3 == 0:
            col = (0xE4, 0xA0, 0x4A, 90)
            width = 2
        elif i % 2 == 0:
            col = (42, 32, 26, 255)
            width = 4
        else:
            col = (78, 58, 40, 210)
            width = 3
        vd.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], outline=col, width=width)

    sheen = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sheen).pieslice(
        [cx - r + 24, cy - r + 24, cx + r - 24, cy + r - 24],
        start=206,
        end=248,
        fill=(244, 239, 230, 46),
    )
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).ellipse([cx - r + 20, cy - r + 20, cx + r - 20, cy + r - 20], fill=255)
    sheen_a = np.array(sheen)
    sheen_a[..., 3] = (sheen_a[..., 3].astype(np.float32) * (np.array(mask) / 255.0)).astype(np.uint8)
    vinyl = Image.alpha_composite(vinyl, Image.fromarray(sheen_a, "RGBA"))

    vd = ImageDraw.Draw(vinyl)
    lr = int(r * 0.32)
    vd.ellipse([cx - lr, cy - lr, cx + lr, cy + lr], fill=(0xFF, 0x5C, 0x33, 255))
    vd.ellipse([cx - lr + 10, cy - lr + 10, cx + lr - 10, cy + lr - 10], outline=(0x10, 0x0E, 0x0C, 90), width=8)
    vd.ellipse([cx - lr, cy - lr, cx + lr, cy + lr], outline=(0xF4, 0xEF, 0xE6, 235), width=7)
    ir = int(lr * 0.62)
    vd.ellipse([cx - ir, cy - ir, cx + ir, cy + ir], outline=(0xF4, 0xEF, 0xE6, 80), width=3)
    vd.ellipse([cx - 18, cy - 18, cx + 18, cy + 18], fill=(0xF4, 0xEF, 0xE6, 255))
    vd.ellipse([cx - 7, cy - 7, cx + 7, cy + 7], fill=(0x10, 0x0E, 0x0C, 255))
    base = Image.alpha_composite(base, vinyl)

    # Speaker cone, cropped by the right edge so it frames rather than competes.
    spk = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(spk)
    scx, scy, sr = 2550, 800, 340
    sd.ellipse([scx - sr, scy - sr, scx + sr, scy + sr], fill=(14, 11, 10, 235))
    rings = [
        (sr - 10, (0xFF, 0x5C, 0x33, 255), 12),
        (sr - 48, (0xE4, 0xA0, 0x4A, 160), 5),
        (int(sr * 0.66), (0xE4, 0xA0, 0x4A, 190), 7),
        (int(sr * 0.46), (0xFF, 0x5C, 0x33, 210), 9),
        (int(sr * 0.28), (0xF4, 0xEF, 0xE6, 220), 6),
        (int(sr * 0.12), (0xFF, 0x5C, 0x33, 255), 8),
    ]
    for rad, col, width in rings:
        sd.ellipse([scx - rad, scy - rad, scx + rad, scy + rad], outline=col, width=width)
    base = Image.alpha_composite(base, spk)

    # Bass line along the floor, kept clear of the lower margin.
    wave = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    wd = ImageDraw.Draw(wave)
    pts = []
    for x in range(180, W - 180, 5):
        t = (x - 180) / (W - 360)
        env = np.sin(np.pi * t) ** 1.15
        y = 1168 + env * (np.sin(t * 42) * 16 + np.sin(t * 15.5 + 0.6) * 10 + np.sin(t * 7) * 6)
        pts.append((x, float(y)))
    wd.line(pts, fill=(0xE4, 0xA0, 0x4A, 150), width=5, joint="curve")
    glow_line = wave.filter(ImageFilter.GaussianBlur(6))
    base = Image.alpha_composite(base, glow_line)
    base = Image.alpha_composite(base, wave)

    # Soft scrim behind the lockup so cream type stays readable over the glow.
    scrim = np.zeros((H, W), dtype=np.float32)
    sdx = (xs - 1560) / 860
    sdy = (ys - 560) / 460
    sm = np.clip(1 - (sdx * sdx + sdy * sdy), 0, 1) ** 1.35
    scrim_img = np.zeros((H, W, 4), dtype=np.uint8)
    scrim_img[..., 3] = (sm * 150).astype(np.uint8)
    base = Image.alpha_composite(base, Image.fromarray(scrim_img, "RGBA"))

    draw = ImageDraw.Draw(base)
    title_font = ImageFont.truetype(str(FONTS / "LilitaOne-Regular.ttf"), 228)
    house_font = ImageFont.truetype(str(FONTS / "LilitaOne-Regular.ttf"), 248)
    tag_font = ImageFont.truetype(str(FONTS / "outfit-latin-500-normal.ttf"), 46)
    kicker_font = ImageFont.truetype(str(FONTS / "outfit-latin-600-normal.ttf"), 28)
    credit_font = ImageFont.truetype(str(FONTS / "outfit-latin-500-normal.ttf"), 30)

    def measure(font, text):
        box = draw.textbbox((0, 0), text, font=font)
        return box[2] - box[0], box[3] - box[1], box

    def tracked_width(font, text, tracking):
        total = 0
        for i, ch in enumerate(text):
            w, _, _ = measure(font, ch)
            total += w + (tracking if i < len(text) - 1 else 0)
        return total

    def draw_tracked(text, font, y, fill, tracking, center_x):
        total = tracked_width(font, text, tracking)
        x = center_x - total / 2
        for ch in text:
            box = draw.textbbox((0, 0), ch, font=font)
            draw.text((x - box[0], y - box[1]), ch, font=font, fill=fill)
            x += (box[2] - box[0]) + tracking

    def draw_centered(text, font, y, fill, center_x):
        w, _, box = measure(font, text)
        draw.text((center_x - w / 2 - box[0], y - box[1]), text, font=font, fill=fill)
        return w

    # Lockup lives right of the vinyl, vertically centered, inside a wide margin.
    lock_cx = 1580
    cream = (0xF4, 0xEF, 0xE6, 255)
    amber = (0xE4, 0xA0, 0x4A, 255)
    heat = (0xFF, 0x5C, 0x33, 255)

    draw_tracked("MORE BOUNCE LABS", kicker_font, 268, amber, 8, lock_cx)

    # Hairline under the kicker
    kick_w = tracked_width(kicker_font, "MORE BOUNCE LABS", 8)
    draw.line(
        [(lock_cx - kick_w / 2, 318), (lock_cx + kick_w / 2, 318)],
        fill=(0xE4, 0xA0, 0x4A, 140),
        width=2,
    )

    w1 = draw_centered("MicTek", title_font, 360, cream, lock_cx)
    w2 = draw_centered("House", house_font, 580, heat, lock_cx)

    # Amber rule between title and tagline, shorter than the wider line.
    rule = min(w1, w2) * 0.42
    draw.rounded_rectangle(
        [lock_cx - rule / 2, 800, lock_cx + rule / 2, 810],
        radius=5,
        fill=(0xE4, 0xA0, 0x4A, 255),
    )

    draw_centered("Making music to make you feel good, baby.", tag_font, 848, cream, lock_cx)
    draw_tracked("MIKEY MORE BOUNCE", credit_font, 930, amber, 6, lock_cx)

    # Fine grain over the finished plate so the gradients don't band in JPEG.
    plate = np.array(base).astype(np.float32)
    grain = rng.normal(0, 3.2, (H, W, 1))
    plate[..., :3] = np.clip(plate[..., :3] + grain, 0, 255)
    final = Image.fromarray(plate.astype(np.uint8), "RGBA").convert("RGB")
    final = final.resize((1200, 630), Image.Resampling.LANCZOS)
    final.save(OUT, "PNG", optimize=True)
    print("wrote", OUT, final.size)


if __name__ == "__main__":
    main()
