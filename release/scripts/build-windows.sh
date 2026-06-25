#!/usr/bin/env bash
# 构建 Windows .exe（Go 启动器 + 嵌入的 web 资源）
# 依赖：Go 1.22+ 工具链，build-assets.sh 已跑过
# 注意：Go 的 //go:embed 不跟随 symlink，所以这里用 copy 而非 symlink
set -euo pipefail

# 确保本地 Go 工具链在 PATH 中（如果用户在 ~/.local/go 安装了 Go）
export PATH="$HOME/.local/go/bin:$PATH"

ROOT=$(git rev-parse --show-toplevel)
VERSION=$(node -p "require('./package.json').version")
DIST="$ROOT/release/dist"
LAUNCHER="$ROOT/release/cmd/windows-launcher"

# 0. 确保 dist/web 存在
if [ ! -d "$DIST/web" ]; then
  echo "→ 跑 build-assets.sh..."
  bash "$ROOT/release/scripts/build-assets.sh"
fi

# 1. 把 web 资源 copy 到 launcher/dist（go:embed 需要真实目录）
echo "→ Copy web 资源到 launcher/dist/ ..."
rm -rf "$LAUNCHER/dist"
mkdir -p "$LAUNCHER/dist"
cp -r "$DIST/web/." "$LAUNCHER/dist/"

# 2. 编译
echo "→ 编译 Windows .exe ..."
cd "$LAUNCHER"
GOOS=windows GOARCH=amd64 go build \
  -ldflags="-H windowsgui -X main.version=$VERSION" \
  -o "$DIST/Morse-Practice-$VERSION.exe" .

# 3. 清理 launcher/dist
rm -rf "$LAUNCHER/dist"

echo ""
echo "✓ Built: $DIST/Morse-Practice-$VERSION.exe"
ls -lh "$DIST/Morse-Practice-$VERSION.exe"