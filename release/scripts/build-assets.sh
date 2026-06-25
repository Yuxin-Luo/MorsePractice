#!/usr/bin/env bash
# 复制 web 源码到 release/dist/web/，注入版本号
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
VERSION=$(node -p "require('./package.json').version")
DIST="$ROOT/release/dist"

# 1. 清空 + 重建
rm -rf "$DIST/web"
mkdir -p "$DIST/web"

# 2. 复制业务代码
cp -r "$ROOT/index.html" "$ROOT/styles" "$ROOT/src" "$DIST/web/"
cp "$ROOT/manifest.json" "$ROOT/sw.js" "$DIST/web/"

# 3. 复制图标
mkdir -p "$DIST/web/assets"
cp "$ROOT/assets/"*.png "$DIST/web/assets/"

# 4. 注入版本号
sed -i "s/\"version\".*/\"version\": \"$VERSION\",/" "$DIST/web/manifest.json"

echo "✓ Web assets built at $DIST/web/"
echo "  Files:"
find "$DIST/web" -type f | sed "s|$DIST/web/|  - |"