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
VERSION_CODE=$(echo "$VERSION" | awk -F. '{ printf "%d%02d%02d", $1, $2, $3 }')
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
cd "$TMP_DIR"
bubblewrap build \
  --manifest="$TEMP_MANIFEST" \
  --keystore="$TMP_DIR/keystore.jks" \
  --keystorePassword="$KEYSTORE_PASS" \
  --keyPassword="$KEY_PASS"

# 5. 移动 apk 到 dist
APK_SRC=$(find "$TMP_DIR" -name "app-release-signed.apk" -type f | head -1)
APK_NAME="morse-practice-$VERSION.apk"
cp "$APK_SRC" "$DIST/$APK_NAME"

# 6. 清理
rm -rf "$TMP_DIR"

echo ""
echo "✓ Built: $DIST/$APK_NAME"
ls -lh "$DIST/$APK_NAME"