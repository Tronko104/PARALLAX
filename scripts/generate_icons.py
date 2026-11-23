#!/usr/bin/env python3
"""
Generate high-resolution PARALLAX application icons for Windows (.ico),
Linux/Electron (.png), and Android mipmap densities.
"""

import math
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(ROOT, "assets")
os.makedirs(ASSETS_DIR, exist_ok=True)


def render_parallax_icon(size=1024):
    img = Image.new("RGBA", (size, size), (5, 7, 11, 255))
    cx, cy = size * 0.5, size * 0.5

    # 1. Deep radial space nebula glow background
    bg_glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = bg_glow.load()
    for y in range(size):
        dy = (y - cy) / (size * 0.5)
        for x in range(size):
            dx = (x - cx) / (size * 0.5)
            r = math.hypot(dx, dy)
            # Subtle deep navy/cyan/amber cosmic gradient
            c_blue = math.exp(-r * r * 2.4) * 58
            c_amber = math.exp(-((dx - 0.12) ** 2 + (dy + 0.12) ** 2) * 5.2) * 85
            red = int(min(255, 6 + c_blue * 0.35 + c_amber * 1.15))
            green = int(min(255, 10 + c_blue * 0.72 + c_amber * 0.78))
            blue = int(min(255, 18 + c_blue * 1.35 + c_amber * 0.25))
            px[x, y] = (red, green, blue, 255)
    img = Image.alpha_composite(img, bg_glow)

    # 2. Tilted golden-amber orbital ring & gravitational lensing arc
    ring_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    rdraw = ImageDraw.Draw(ring_layer)

    # Outer scientific coordinate reticle ring
    pad_outer = size * 0.11
    rdraw.ellipse(
        [pad_outer, pad_outer, size - pad_outer, size - pad_outer],
        outline=(56, 189, 248, 120),
        width=max(2, size // 180),
    )

    # Secondary precision ticks on outer ring
    for deg in range(0, 360, 15):
        rad = math.radians(deg)
        r1 = size * 0.39
        r2 = size * (0.415 if deg % 45 == 0 else 0.402)
        x1, y1 = cx + math.cos(rad) * r1, cy + math.sin(rad) * r1
        x2, y2 = cx + math.cos(rad) * r2, cy + math.sin(rad) * r2
        col = (229, 169, 60, 210) if deg % 90 == 0 else (148, 163, 184, 120)
        rdraw.line([(x1, y1), (x2, y2)], fill=col, width=max(2, size // 220))

    # Accretion / Orbital ellipses rotated by -28 degrees
    ellipse_canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    edraw = ImageDraw.Draw(ellipse_canvas)
    for k, (rx, ry, col, w) in enumerate([
        (0.41, 0.145, (229, 169, 60, 235), size // 55),
        (0.36, 0.125, (253, 224, 71, 180), size // 110),
        (0.44, 0.165, (56, 189, 248, 150), size // 140),
    ]):
        edraw.ellipse(
            [cx - size * rx, cy - size * ry, cx + size * rx, cy + size * ry],
            outline=col,
            width=max(2, w),
        )

    ellipse_glow = ellipse_canvas.filter(ImageFilter.GaussianBlur(radius=size * 0.015))
    ellipse_rot_glow = ellipse_glow.rotate(26, resample=Image.BICUBIC)
    ellipse_rot = ellipse_canvas.rotate(26, resample=Image.BICUBIC)

    img = Image.alpha_composite(img, ring_layer)
    img = Image.alpha_composite(img, ellipse_rot_glow)
    img = Image.alpha_composite(img, ellipse_rot)

    # 3. Central luminous star / planet sphere with atmospheric rim
    core_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cdraw = ImageDraw.Draw(core_layer)
    sphere_r = size * 0.185

    # Outer cyan/amber corona halo
    cdraw.ellipse(
        [cx - sphere_r * 1.45, cy - sphere_r * 1.45, cx + sphere_r * 1.45, cy + sphere_r * 1.45],
        fill=(229, 169, 60, 95),
    )
    core_layer = core_layer.filter(ImageFilter.GaussianBlur(radius=size * 0.04))
    img = Image.alpha_composite(img, core_layer)

    # Crisp dark-core + bright atmospheric rim planet/horizon sphere
    sphere_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(sphere_layer)
    sdraw.ellipse(
        [cx - sphere_r, cy - sphere_r, cx + sphere_r, cy + sphere_r],
        fill=(9, 15, 28, 255),
        outline=(251, 191, 36, 255),
        width=max(3, size // 110),
    )

    # Crescent sunlit rim
    crescent = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    crdraw = ImageDraw.Draw(crescent)
    crdraw.arc(
        [cx - sphere_r * 0.94, cy - sphere_r * 0.94, cx + sphere_r * 0.94, cy + sphere_r * 0.94],
        start=210,
        end=35,
        fill=(56, 189, 248, 230),
        width=max(4, size // 64),
    )
    crescent_glow = crescent.filter(ImageFilter.GaussianBlur(radius=size * 0.012))

    # Brilliant central star beacon offset on top-right limb
    bx = cx + sphere_r * 0.72
    by = cy - sphere_r * 0.68
    star_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    stdraw = ImageDraw.Draw(star_layer)
    for mult, alpha in [(0.085, 70), (0.045, 165), (0.022, 255)]:
        sr = size * mult
        stdraw.ellipse([bx - sr, by - sr, bx + sr, by + sr], fill=(255, 245, 214, alpha))
    # Subtle anamorphic flare bar
    stdraw.line([(bx - size * 0.18, by), (bx + size * 0.18, by)], fill=(125, 211, 252, 200), width=max(2, size // 180))
    star_layer = star_layer.filter(ImageFilter.GaussianBlur(radius=size * 0.006))

    img = Image.alpha_composite(img, sphere_layer)
    img = Image.alpha_composite(img, crescent_glow)
    img = Image.alpha_composite(img, crescent)
    img = Image.alpha_composite(img, star_layer)

    # Mask into rounded squircle for clean OS icon aesthetics
    mask = Image.new("L", (size, size), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.rounded_rectangle([0, 0, size, size], radius=int(size * 0.20), fill=255)
    final = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    final.paste(img, (0, 0), mask)
    return final


def main():
    master = render_parallax_icon(1024)

    # Save 512x512 PNG for Electron/Linux/Web
    png_512 = master.resize((512, 512), Image.LANCZOS)
    png_512.save(os.path.join(ASSETS_DIR, "icon.png"), "PNG")

    # Save multi-size Windows .ico
    ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    master.save(os.path.join(ASSETS_DIR, "icon.ico"), format="ICO", sizes=ico_sizes)

    # Save Android mipmap launcher icons
    android_res = os.path.join(ROOT, "android", "app", "src", "main", "res")
    densities = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }
    for folder, px_size in densities.items():
        dpath = os.path.join(android_res, folder)
        os.makedirs(dpath, exist_ok=True)
        resized = master.resize((px_size, px_size), Image.LANCZOS)
        resized.save(os.path.join(dpath, "ic_launcher.png"), "PNG")
        resized.save(os.path.join(dpath, "ic_launcher_round.png"), "PNG")

    print("Generated PARALLAX icons in assets/ and android/app/src/main/res/")


if __name__ == "__main__":
    main()
