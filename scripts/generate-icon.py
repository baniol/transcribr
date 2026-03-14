#!/usr/bin/env python3
"""Generate app icons for Transcribr.

Creates a 1024x1024 base icon and all sizes needed by Tauri.
Uses a microphone + waveform design with a gradient background.

Usage:
    python3 scripts/generate-icon.py [--preset NAME]

Presets: default, dark, light, blue
"""

import argparse
import math
import os
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Pillow is required: pip install Pillow>=10.0")
    sys.exit(1)

# Tauri icon sizes
TAURI_SIZES = [32, 128, 256, 512]
IOS_SIZES = [120, 152, 167, 180, 1024]

PRESETS = {
    "default": {
        "bg_top": (99, 102, 241),      # Indigo
        "bg_bottom": (139, 92, 246),    # Purple
        "fg": (255, 255, 255),
        "accent": (196, 181, 253),
    },
    "dark": {
        "bg_top": (30, 30, 30),
        "bg_bottom": (50, 50, 50),
        "fg": (99, 102, 241),
        "accent": (139, 92, 246),
    },
    "light": {
        "bg_top": (241, 245, 249),
        "bg_bottom": (226, 232, 240),
        "fg": (99, 102, 241),
        "accent": (139, 92, 246),
    },
    "blue": {
        "bg_top": (37, 99, 235),
        "bg_bottom": (59, 130, 246),
        "fg": (255, 255, 255),
        "accent": (191, 219, 254),
    },
}


def lerp_color(c1, c2, t):
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))


def draw_gradient_bg(draw, size, top_color, bottom_color):
    for y in range(size):
        t = y / size
        color = lerp_color(top_color, bottom_color, t)
        draw.line([(0, y), (size, y)], fill=color)


def draw_rounded_rect(draw, bbox, radius, fill):
    x0, y0, x1, y1 = bbox
    draw.rounded_rectangle(bbox, radius=radius, fill=fill)


def draw_microphone(draw, cx, cy, size, color, accent):
    """Draw a stylized microphone icon."""
    # Mic head (rounded rectangle)
    head_w = size * 0.28
    head_h = size * 0.38
    head_r = head_w * 0.45
    draw.rounded_rectangle(
        [cx - head_w, cy - head_h, cx + head_w, cy + head_h * 0.1],
        radius=head_r,
        fill=color,
    )

    # Mic grille lines
    grille_color = accent
    line_w = max(2, int(size * 0.02))
    for i in range(3):
        ly = cy - head_h * 0.6 + i * head_h * 0.22
        draw.line(
            [cx - head_w * 0.5, ly, cx + head_w * 0.5, ly],
            fill=grille_color,
            width=line_w,
        )

    # Mic arc (U-shape holder)
    arc_w = head_w * 1.5
    arc_top = cy - head_h * 0.15
    arc_bot = cy + head_h * 0.55
    arc_lw = max(3, int(size * 0.03))
    draw.arc(
        [cx - arc_w, arc_top, cx + arc_w, arc_bot + (arc_bot - arc_top)],
        start=0,
        end=180,
        fill=color,
        width=arc_lw,
    )

    # Mic stand (vertical line)
    stand_top = arc_bot
    stand_bot = cy + head_h * 0.85
    draw.line(
        [cx, stand_top, cx, stand_bot],
        fill=color,
        width=arc_lw,
    )

    # Mic base
    base_w = head_w * 0.8
    draw.line(
        [cx - base_w, stand_bot, cx + base_w, stand_bot],
        fill=color,
        width=arc_lw,
    )


def draw_waveform(draw, cx, cy, size, color):
    """Draw sound waveform bars on sides of microphone."""
    bar_w = max(2, int(size * 0.025))
    heights = [0.08, 0.15, 0.22, 0.15, 0.08]
    gap = size * 0.045

    for side in [-1, 1]:
        start_x = cx + side * size * 0.28
        for i, h in enumerate(heights):
            x = start_x + side * (i * gap + gap)
            bar_h = size * h
            alpha = int(255 * (1.0 - i * 0.15))
            bar_color = (*color[:3], alpha)
            draw.rounded_rectangle(
                [x - bar_w, cy - bar_h, x + bar_w, cy + bar_h],
                radius=bar_w,
                fill=bar_color,
            )


def generate_icon(preset_name="default", output_dir=".", sizes=None):
    preset = PRESETS.get(preset_name, PRESETS["default"])
    base_size = 1024

    # Create RGBA image for transparency support
    img = Image.new("RGBA", (base_size, base_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img, "RGBA")

    # Background with rounded corners
    corner_r = base_size * 0.22
    # Draw gradient manually with rounded rect mask
    bg = Image.new("RGBA", (base_size, base_size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg, "RGBA")
    draw_gradient_bg(bg_draw, base_size, preset["bg_top"], preset["bg_bottom"])

    # Create rounded mask
    mask = Image.new("L", (base_size, base_size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle(
        [0, 0, base_size, base_size], radius=int(corner_r), fill=255
    )
    img = Image.composite(bg, img, mask)
    draw = ImageDraw.Draw(img, "RGBA")

    # Draw microphone
    mic_cx = base_size * 0.5
    mic_cy = base_size * 0.45
    draw_microphone(draw, mic_cx, mic_cy, base_size, preset["fg"], preset["accent"])

    # Draw waveform
    draw_waveform(draw, mic_cx, mic_cy * 0.85, base_size, preset["accent"])

    # Save base icon
    base_path = os.path.join(output_dir, "icon_1024.png")
    img.save(base_path, "PNG")
    print(f"  Created {base_path}")

    # Generate Tauri sizes
    if sizes is None:
        sizes = TAURI_SIZES

    icons_dir = os.path.join(output_dir, "icons_generated")
    os.makedirs(icons_dir, exist_ok=True)

    for s in sizes:
        resized = img.resize((s, s), Image.LANCZOS)
        path = os.path.join(icons_dir, f"{s}x{s}.png")
        resized.save(path, "PNG")
        print(f"  Created {path}")

    # Also generate .ico (Windows) from 256px
    ico_img = img.resize((256, 256), Image.LANCZOS)
    ico_path = os.path.join(icons_dir, "icon.ico")
    ico_img.save(ico_path, "ICO", sizes=[(256, 256)])
    print(f"  Created {ico_path}")

    # macOS .icns placeholder note
    print(f"\n  Base icon: {base_path}")
    print(f"  Generated sizes in: {icons_dir}/")
    print("  Copy to src-tauri/icons/ and use `npm run tauri icon` to finalize.")


def list_presets():
    print("Available presets:")
    for name, colors in PRESETS.items():
        top = colors["bg_top"]
        bot = colors["bg_bottom"]
        print(f"  {name:12s}  bg: rgb{top} -> rgb{bot}")


def main():
    parser = argparse.ArgumentParser(description="Generate Transcribr app icons")
    parser.add_argument(
        "--preset", default="default", help="Color preset (default, dark, light, blue)"
    )
    parser.add_argument(
        "--list-presets", action="store_true", help="List available presets"
    )
    parser.add_argument("--output", default=".", help="Output directory")
    args = parser.parse_args()

    if args.list_presets:
        list_presets()
        return

    print(f"Generating Transcribr icon (preset: {args.preset})...")
    generate_icon(args.preset, args.output)


if __name__ == "__main__":
    main()
