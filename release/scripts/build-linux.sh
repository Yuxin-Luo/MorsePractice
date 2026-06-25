#!/usr/bin/env bash
# 构建 Linux .deb
# 依赖：dpkg-deb、build-assets.sh 已跑过（生成 release/dist/web/）
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
VERSION=$(node -p "require('./package.json').version")
TEMPLATE="$ROOT/release/packaging/linux"
BUILD="$ROOT/release/dist/build"
DIST="$ROOT/release/dist"
PKG="morse-practice_${VERSION}_amd64"

# 0. 确保 dist/web 存在
if [ ! -d "$DIST/web" ]; then
  echo "→ 跑 build-assets.sh..."
  bash "$ROOT/release/scripts/build-assets.sh"
fi

# 1. 准备构建树
rm -rf "$BUILD"
mkdir -p "$BUILD"

# 2. 复制 DEBIAN 控制文件 + 注入版本
mkdir -p "$BUILD/DEBIAN"
sed "s/^Version: .*/Version: $VERSION/" "$TEMPLATE/DEBIAN/control" > "$BUILD/DEBIAN/control"
cp "$TEMPLATE/DEBIAN/postinst" "$BUILD/DEBIAN/postinst"
cp "$TEMPLATE/DEBIAN/prerm"   "$BUILD/DEBIAN/prerm"
chmod 755 "$BUILD/DEBIAN/postinst" "$BUILD/DEBIAN/prerm"

# 3. 复制 web 资源到 /opt/morse-practice/
mkdir -p "$BUILD/opt/morse-practice"
cp -r "$DIST/web/." "$BUILD/opt/morse-practice/"

# 4. 复制启动脚本
mkdir -p "$BUILD/usr/bin"
cp "$TEMPLATE/usr/bin/morse-practice" "$BUILD/usr/bin/morse-practice"
chmod 755 "$BUILD/usr/bin/morse-practice"

# 5. 复制 .desktop
mkdir -p "$BUILD/usr/share/applications"
cp "$TEMPLATE/usr/share/applications/morse-practice.desktop" \
   "$BUILD/usr/share/applications/morse-practice.desktop"

# 6. 复制图标（256x256）
mkdir -p "$BUILD/usr/share/icons/hicolor/256x256/apps"
cp "$ROOT/assets/icon-256.png" "$BUILD/usr/share/icons/hicolor/256x256/apps/morse-practice.png"

# 7. 复制 copyright
mkdir -p "$BUILD/usr/share/doc/morse-practice"
cp "$TEMPLATE/usr/share/doc/morse-practice/copyright" \
   "$BUILD/usr/share/doc/morse-practice/copyright"
gzip -9 -n -f "$BUILD/usr/share/doc/morse-practice/copyright"

# 8. 构建 .deb
cd "$DIST"
dpkg-deb --build --root-owner-group "$BUILD" "${PKG}.deb"

# 9. 清理
rm -rf "$BUILD"

echo ""
echo "✓ Built: $DIST/${PKG}.deb"
ls -lh "$DIST/${PKG}.deb"
echo ""
echo "→ 验证："
dpkg-deb --info "$DIST/${PKG}.deb" | head -10