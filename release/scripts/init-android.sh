#!/usr/bin/env bash
# 一次性 init Bubblewrap 项目（在真 TTY 跑一次即可）
#
# 为什么拆出来：
#   - Bubblewrap 1.24.x 的 `init --manifest=URL` 必须交互式填 ~20 个 prompt
#     (Domain / URL path / Name / Package ID / Version code / Display / ... )
#   - inquirer 不读 stdin EOF,直接 pipe 不行
#   - pexpect wrapper (release/scripts/lib/bw_init.py) 在 4.8.0 上还有 pattern 匹配 bug
#   - 拆出来让用户在真 TTY 跑一次 init,后续 build 直接复用 .bubblewrap/
#
# 用法:
#   bash release/scripts/init-android.sh    # 真终端跑一次
#   bash release/scripts/build-android.sh   # 后续构建
#
# 重 init:
#   rm -rf release/.android-project
#   bash release/scripts/init-android.sh
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
TWA_MANIFEST="$ROOT/release/packaging/android/twa-manifest.json"
PROJECT_DIR="$ROOT/release/.android-project"
PORT=8765

# 已 init 过则跳过
if [ -f "$PROJECT_DIR/.bubblewrap/checksum.json" ]; then
  echo "✓ 项目已 init: $PROJECT_DIR"
  echo "  .bubblewrap/checksum.json 已存在,build-android.sh 会直接复用"
  echo ""
  echo "  如要重 init:"
  echo "    rm -rf release/.android-project && bash release/scripts/init-android.sh"
  exit 0
fi

# 准备项目目录 + 拷 manifest
mkdir -p "$PROJECT_DIR"
cp "$TWA_MANIFEST" "$PROJECT_DIR/twa-manifest.json"

# 起 HTTP server 托管 manifest（init 内部用 new URL 解析,必须 http://）
cd "$PROJECT_DIR"
python3 -m http.server "$PORT" > /dev/null 2>&1 &
HTTP_PID=$!
trap "kill '$HTTP_PID' 2>/dev/null || true" EXIT

# 等服务就绪
for i in 1 2 3 4 5; do
  if curl -sf "http://127.0.0.1:$PORT/" > /dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Bubblewrap init (一次性,~20 个 prompt,直接回车接受默认)"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "  预期 prompt + 默认答案:"
echo "    Domain:                  morsepractice.pages.dev  ← 默认可能错（=127.0.0.1:8765）"
echo "                                                       → 改为 morsepractice.pages.dev"
echo "    URL path:                /                         ← 默认可能错（=/）"
echo "                                                       → 改为 /"
echo "    Name:                    摩斯密码练习器"
echo "    Launcher name:           Morse Practice"
echo "    Application ID:          com.github.yuxinluo.morsepractice"
echo "    App version:             0.1.0"
echo "    Version code:            10000"
echo "    Display mode:            standalone"
echo "    Orientation:             portrait"
echo "    Theme color:             #6c5ce7"
echo "    Background color:        #f7f8fc"
echo "    Splash color:            #6c5ce7"
echo "    Icon URL:                (从 manifest 拉,直接回车)"
echo "    Maskable icon URL:       (空,直接回车跳过)"
echo "    Monochrome icon URL:     (空,直接回车跳过)"
echo "    Add shortcuts?:          n"
echo "    Play Billing?:           n"
echo "    Location Delegation?:    n"
echo "    Signing key path:        (随便填,build 时覆盖)"
echo "    Signing key alias:       mykey"
echo "    Key password:            (随便填,build 时覆盖)"
echo ""
echo "  重要: Domain 必须改成 morsepractice.pages.dev（默认值 127.0.0.1:8765 不对）"
echo ""
echo "════════════════════════════════════════════════════════════"
echo ""

# 调 bubblewrap init（用户在真终端,直接交互式填）
bubblewrap init --manifest="http://127.0.0.1:$PORT/twa-manifest.json"

echo ""
echo "✓ Init 完成"
echo "  .bubblewrap/checksum.json 已生成"
echo ""
echo "→ 下一步: bash release/scripts/build-android.sh"
ls -la "$PROJECT_DIR/.bubblewrap/" 2>&1