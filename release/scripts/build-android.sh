#!/usr/bin/env bash
# 构建 Android .apk (Bubblewrap TWA)
# 依赖：
#   - JDK 17+
#   - Bubblewrap CLI (npm install -g @bubblewrap/cli)
#   - 环境变量：KEYSTORE_FILE, KEYSTORE_PASS, KEY_PASS
set -euo pipefail

export PATH="$HOME/.local/go/bin:$PATH"

ROOT=$(git rev-parse --show-toplevel)
VERSION=$(node -p "require('./package.json').version")
TWA_MANIFEST="$ROOT/release/packaging/android/twa-manifest.json"
DIST="$ROOT/release/dist"
TMP_DIR=$(mktemp -d)

# 0. 确保 dist/web 存在
if [ ! -d "$DIST/web" ]; then
  echo "→ 跑 build-assets.sh..."
  bash "$ROOT/release/scripts/build-assets.sh"
fi

# 1. 更新 version + versionCode
# 用 node 算 versionCode（awk 的 %02d 在 major=0 时会产生前导零,JSON 不合法）
# 公式: a*10000 + b*100 + c + 10000,确保 0.1.0 = 10100, 0.2.0 = 10200, 1.0.0 = 20000
VERSION_CODE=$(node -p "const [a,b,c]='$VERSION'.split('.').map(Number); a*10000 + b*100 + c + 10000")
TEMP_MANIFEST="$TMP_DIR/twa-manifest.json"
sed -e "s/\"appVersion\": \".*\"/\"appVersion\": \"$VERSION\"/" \
    -e "s/\"versionCode\": .*/\"versionCode\": $VERSION_CODE/" \
    "$TWA_MANIFEST" > "$TEMP_MANIFEST"

# 2. 检查 keystore 环境变量（缺省用 mykEY/morse-practice.keystore）
KEYSTORE_FILE=${KEYSTORE_FILE:-$ROOT/mykEY/morse-practice.keystore}
: "${KEYSTORE_PASS:?Need KEYSTORE_PASS env var}"
: "${KEY_PASS:?Need KEY_PASS env var}"

# 3. 复制 keystore 到临时位置
cp "$KEYSTORE_FILE" "$TMP_DIR/keystore.jks"

# 4. 调 Bubblewrap 构建
# 必须先 init（创建 .bubblewrap/{config,checksum}.json），
# 否则 build 会卡在 "No checksum file was found" 交互式 prompt
#
# 坑:bubblewrap 1.24.1 init 内部用 `new URL(args.manifest)` 解析路径
# 本地文件路径 (/tmp/...) 没协议 → throw "Invalid URL"
# 修法:本地起 http server 托管 twa-manifest.json,init 用 http:// URL
cd "$TMP_DIR"
echo "→ Starting local HTTP server for TWA manifest..."
python3 -m http.server 8765 > /dev/null 2>&1 &
HTTP_PID=$!
# 等服务就绪
for i in 1 2 3 4 5; do
  if curl -sf "http://127.0.0.1:8765/" > /dev/null 2>&1; then break; fi
  sleep 0.5
done

echo "→ Initializing Bubblewrap project..."
bubblewrap init --manifest="http://127.0.0.1:8765/$(basename "$TEMP_MANIFEST")"

echo "→ Stopping HTTP server..."
kill "$HTTP_PID" 2>/dev/null || true
wait "$HTTP_PID" 2>/dev/null || true

echo "→ Building APK..."
# --skipPwaValidation: init 阶段已下载 web manifest + 验证 icon,build 阶段跳过避免
# "Project is out of date" 重新走 update → 拖时间 + 失败风险
bubblewrap build \
  --keystore="$TMP_DIR/keystore.jks" \
  --keystorePassword="$KEYSTORE_PASS" \
  --keyPassword="$KEY_PASS" \
  --skipPwaValidation

# 5. 移动 apk 到 dist
APK_SRC=$(find "$TMP_DIR" -name "app-release-signed.apk" -type f | head -1)
APK_NAME="morse-practice-$VERSION.apk"
cp "$APK_SRC" "$DIST/$APK_NAME"

# 6. 清理
rm -rf "$TMP_DIR"

echo ""
echo "✓ Built: $DIST/$APK_NAME"
ls -lh "$DIST/$APK_NAME"