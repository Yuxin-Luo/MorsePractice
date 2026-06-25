#!/usr/bin/env python3
"""Tests for build-icons.py. Run: python3 release/scripts/test_build_icons.py"""
import sys
import os
import subprocess
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SCRIPT = REPO / "release" / "scripts" / "build-icons.py"
SOURCE_ICON = REPO / "FrontImages" / "icon.png"

def assert_(cond, msg):
    if not cond:
        print(f"✗ {msg}")
        sys.exit(1)
    print(f"✓ {msg}")

# 前置检查
assert_(SCRIPT.exists(), f"build-icons.py exists at {SCRIPT}")
assert_(SOURCE_ICON.exists(), f"FrontImages/icon.png exists at {SOURCE_ICON}")

# 跑脚本到临时目录
with tempfile.TemporaryDirectory() as tmp:
    out = Path(tmp) / "icons"
    result = subprocess.run(
        ["python3", str(SCRIPT), str(out)],
        capture_output=True, text=True
    )
    assert_(result.returncode == 0, f"script exits 0 (stderr: {result.stderr})")

    for name, size in [
        ("icon-192.png", 192),
        ("icon-256.png", 256),
        ("icon-512.png", 512),
        ("icon-maskable-512.png", 512),
    ]:
        p = out / name
        assert_(p.exists(), f"{name} was created")
        # 验证尺寸
        from PIL import Image
        img = Image.open(p)
        assert_(img.size == (size, size), f"{name} is {size}x{size} (got {img.size})")
        assert_(img.format == "PNG", f"{name} is PNG")

    # 验证 maskable 周围有主题色像素
    from PIL import Image
    maskable = Image.open(out / "icon-maskable-512.png").convert("RGBA")
    corner_pixel = maskable.getpixel((5, 5))  # 左上角 5px 应该是主题色
    # 主题色 #6c5ce7 = (108, 92, 231, 255)
    assert_(corner_pixel[0] > 90 and corner_pixel[0] < 130,
            f"maskable corner is filled with theme color (got {corner_pixel})")

print("\n✅ All build-icons tests passed")