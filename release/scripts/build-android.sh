#!/usr/bin/env bash
# 构建 Android .apk (Bubblewrap TWA)
#
# 前置（首次需要，之后可跳）:
#   bash release/scripts/init-android.sh   # 真终端跑,生成 release/.android-project/
#
# 每次发布:
#   bash release/scripts/build-android.sh
#
# 依赖:
#   - JDK 17+ (JAVA_HOME)
#   - Bubblewrap CLI (npm install -g @bubblewrap/cli)
#   - Android SDK (ANDROID_HOME)
#   - 环境变量: KEYSTORE_FILE, KEYSTORE_PASS, KEY_PASS
set -euo pipefail

export PATH="$HOME/.local/go/bin:$PATH"

ROOT=$(git rev-parse --show-toplevel)
VERSION=$(node -p "require('./package.json').version")
TWA_MANIFEST="$ROOT/release/packaging/android/twa-manifest.json"
DIST="$ROOT/release/dist"
PROJECT_DIR="$ROOT/release/.android-project"
PORT=8765

# 0. 确保 release/.android-project 已 init
if [ ! -f "$PROJECT_DIR/.bubblewrap/checksum.json" ]; then
  echo "✗ Bubblewrap 项目未 init: $PROJECT_DIR/.bubblewrap/checksum.json 不存在"
  echo ""
  echo "→ 先跑一次 init（在真 TTY 跑,约 20 个 prompt 直接回车接受默认）:"
  echo "    bash release/scripts/init-android.sh"
  echo ""
  echo "  init 只需跑一次,生成的 .bubblewrap/ 可被所有后续 build 复用"
  exit 1
fi

# 1. 确保 dist/web 存在
if [ ! -d "$DIST/web" ]; then
  echo "→ 跑 build-assets.sh..."
  bash "$ROOT/release/scripts/build-assets.sh"
fi

# 2. 检查 keystore 环境变量（缺省用 mykEY/morse-practice.keystore）
KEYSTORE_FILE=${KEYSTORE_FILE:-$ROOT/mykEY/morse-practice.keystore}
: "${KEYSTORE_PASS:?Need KEYSTORE_PASS env var}"
: "${KEY_PASS:?Need KEY_PASS env var}"

# 3. 更新 version + versionCode（写到 PROJECT_DIR/twa-manifest.json）
# 用 node 算 versionCode（awk 的 %02d 在 major=0 时会产生前导零,JSON 不合法）
# 公式: a*10000 + b*100 + c + 10000,确保 0.1.0 = 10100, 0.2.0 = 10200, 1.0.0 = 20000
VERSION_CODE=$(node -p "const [a,b,c]='$VERSION'.split('.').map(Number); a*10000 + b*100 + c + 10000")
sed -e "s/\"appVersion\": \".*\"/\"appVersion\": \"$VERSION\"/" \
    -e "s/\"versionCode\": .*/\"versionCode\": $VERSION_CODE/" \
    "$TWA_MANIFEST" > "$PROJECT_DIR/twa-manifest.json"

# 4. 起 HTTP server 托管 manifest（update 内部用 new URL 解析,必须 http://）
cd "$PROJECT_DIR"
echo "→ Starting local HTTP server for TWA manifest..."
python3 -m http.server "$PORT" > /dev/null 2>&1 &
HTTP_PID=$!
trap "kill '$HTTP_PID' 2>/dev/null || true" EXIT
# 等服务就绪
for i in 1 2 3 4 5; do
  if curl -sf "http://127.0.0.1:$PORT/" > /dev/null 2>&1; then break; fi
  sleep 0.5
done

# 5. bubblewrap update（同步 twa-manifest.json → Android 项目）
# 这次是非交互的,因为 .bubblewrap/checksum.json 已存在
echo "→ Updating Bubblewrap project with new version..."
bubblewrap update --manifest="http://127.0.0.1:$PORT/twa-manifest.json" || true

# 6. 拷 keystore 到项目目录（build 用）
cp "$KEYSTORE_FILE" "$PROJECT_DIR/keystore.jks"

# 7. 调 Bubblewrap 构建
# --skipPwaValidation: init/update 阶段已下载 web manifest + 验证 icon,build 阶段跳过避免
# "Project is out of date" 重新走 update → 拖时间 + 失败风险
echo "→ Building APK..."
bubblewrap build \
  --keystore="$PROJECT_DIR/keystore.jks" \
  --keystorePassword="$KEYSTORE_PASS" \
  --keyPassword="$KEY_PASS" \
  --skipPwaValidation

# 8. 移动 apk 到 dist
APK_SRC=$(find "$PROJECT_DIR" -name "app-release-signed.apk" -type f | head -1)
APK_NAME="morse-practice-$VERSION.apk"
mkdir -p "$DIST"
cp "$APK_SRC" "$DIST/$APK_NAME"

echo ""
echo "✓ Built: $DIST/$APK_NAME"
ls -lh "$DIST/$APK_NAME"