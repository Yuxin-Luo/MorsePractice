#!/usr/bin/env python3
"""
从 FrontImages/icon.png 中心裁剪 + 缩放到多种尺寸。

输入：628×625（接近正方形但差 3px）
输出：192/256/512/maskable-512 PNG
"""
from PIL import Image
import sys
from pathlib import Path

SRC = Path("FrontImages/icon.png")
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("release/assets")
OUT.mkdir(parents=True, exist_ok=True)

# 主题色 #6c5ce7（maskable 安全区填充）
THEME = (108, 92, 231, 255)

# 读取并中心裁剪到正方形
img = Image.open(SRC).convert("RGBA")
w, h = img.size
side = min(w, h)
left = (w - side) // 2
top = (h - side) // 2
sq = img.crop((left, top, left + side, top + side))

sizes = [
    ("icon-192.png",         192, 192, "any"),
    ("icon-256.png",         256, 256, "any"),
    ("icon-512.png",         512, 512, "any"),
    ("icon-maskable-512.png", 512, 512, "maskable"),
]

for name, w, h, kind in sizes:
    if kind == "maskable":
        # maskable: 图标占 80%，外圈 10% 安全区用主题色填充
        inner = sq.resize((int(w * 0.8), int(h * 0.8)), Image.LANCZOS)
        canvas = Image.new("RGBA", (w, h), THEME)
        canvas.paste(inner, ((w - inner.width) // 2, (h - inner.height) // 2), inner)
        canvas.save(OUT / name, "PNG", optimize=True)
    else:
        sq.resize((w, h), Image.LANCZOS).save(OUT / name, "PNG", optimize=True)
    print(f"✓ {name} ({w}x{h}, {kind})")

print(f"\n→ 输出目录: {OUT}")