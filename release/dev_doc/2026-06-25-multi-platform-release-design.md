# 摩斯密码练习器 · 多平台发布方案设计

> **状态**：✅ 设计完成，待用户审阅
> **作者**：Claude (brainstorming session 2026-06-25)
> **目标仓库**：`git@github.com:Yuxin-Luo/MorsePractice.git`
> **线上站点**：`https://morsepractice.pages.dev/`

---

## 1. 目标与背景

为摩斯密码练习器（一个纯 ESM + Vanilla JS 静态站，已部署到 Cloudflare Pages）提供 **Windows `.exe` / Android `.apk` / Linux `.deb`** 三种可安装包，发布到 GitHub Releases，让用户可以"安装到本地"使用。

**核心约束（沿用项目现状）**：
- 业务代码无构建工具，**不引入打包器**
- 站点部署在 `morsepractice.pages.dev`（`*.pages.dev` 子域，**无自定义域**）
- 保持"零构建"哲学；新增工具仅限 CI 侧

---

## 2. 关键决策摘要

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 包装器形态 | **混合方案** | Win/Linux 走 B（嵌入资源+迷你服务器，真离线），Android 走 A（TWA+强SW，首次需网）|
| 发布触发 | **git tag 推送** | 严格控制发布节奏 |
| Changelog | **git-cliff 自动生成** | 项目已用 Conventional Commits |
| 图标管理 | **提交到 `release/assets/`** | 跨平台可重现、PR 可预览 |
| 资源存放 | **全部放 `release/`** | 隔离发布相关代码与业务代码 |
| 构建产物 | **`.gitignore` `release/dist/`** | 避免二进制污染 PR diff |
| Android 签名 | **自签名 keystore 存 GitHub Secret** | 个人项目、避免上传 keystore |

---

## 3. 整体架构

**两层分离**：

```
┌─────────────────────────────────────────────────────────┐
│  站点层（业务代码，原仓库结构）                          │
│  index.html · src/ · styles/ · manifest.json · sw.js    │
│  ↓ 部署到 morsepractice.pages.dev                       │
├─────────────────────────────────────────────────────────┤
│  包装层（新增 release/ 目录）                           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                  │
│  │Win .exe │  │Linux .deb│ │Android  │                  │
│  │ Go 嵌入 │  │ bash+py3 │ │  TWA    │                  │
│  │ 资源+启动│ │ 资源+启动│ │ URL+SW  │                  │
│  └─────────┘  └─────────┘  └─────────┘                  │
│       ↑            ↑            ↑                       │
│       └────────────┴────────────┘                       │
│            共享 release/dist/web/ 资源                  │
└─────────────────────────────────────────────────────────┘
```

**关键特性**：
- 三个平台的产物**互相独立**，可单独失败
- Win/Linux 包装器自带完整 web 资源 → **真离线可用**
- Android 包装器是 TWA → **首次启动需联网拉资源**（之后靠 SW 永久离线）
- 业务代码升级 → 仅需 `wrangler pages deploy`，Android 端无需重打包

---

## 4. PWA 改造（站点层改动）

### 4.1 新增文件

| 路径 | 用途 |
|------|------|
| `manifest.json` | Web App Manifest |
| `sw.js` | Service Worker（cache-first + 版本化） |
| `assets/icon-192.png` | PWA 标准图标（192×192）|
| `assets/icon-512.png` | PWA 标准图标（512×512）|
| `assets/icon-maskable-512.png` | TWA / Android 安装图标（带安全区）|
| `assets/icon-256.png` | Linux .deb 桌面图标 |
| `.well-known/assetlinks.json` | TWA 数字资产链接 |

### 4.2 `manifest.json` 模板

```json
{
  "name": "摩斯密码练习器",
  "short_name": "Morse Practice",
  "description": "一个支持字母/单词/句子三档练习、双向听打、键盘拍码的摩斯码练习工具",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#6c5ce7",
  "background_color": "#f7f8fc",
  "lang": "zh-CN",
  "icons": [
    { "src": "/assets/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/assets/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/assets/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

> `theme_color: #6c5ce7` 取自 `styles/main.css` 的 `--accent` 变量。
> `background_color: #f7f8fc` 取自 `--bg`。

### 4.3 `sw.js`（Service Worker）

**策略**：
- HTML 入口（`/`, `/index.html`）→ **network-first**（保证升级能拿到新版本）
- 其他静态资源（JS/CSS/图标/manifest）→ **cache-first**
- 版本号常量（`morse-cache-v1`）→ 升级时手动 +1，`activate` 事件里清旧 cache

**预缓存白名单**（写在 `sw.js` 顶部数组）：

```js
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/styles/main.css',
  '/src/main.js',
  '/src/core/morse-table.js',
  '/src/core/encoder.js',
  '/src/core/audio.js',
  '/src/modes/forward.js',
  '/src/modes/listen.js',
  '/src/modes/straightkey.js',
  '/src/modes/translator.js',
  '/src/storage/progress.js',
  '/src/i18n/index.js',
  '/src/i18n/zh.js',
  '/src/i18n/en.js',
  '/src/data/words.js',
  '/src/data/sentences.js',
  '/src/ui/app.js',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/icon-maskable-512.png'
];
```

> 业务代码新增静态文件时**必须**手动加进 `PRECACHE`，否则 SW 不会缓存。

### 4.4 `.well-known/assetlinks.json`

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.github.yuxinluo.morsepractice",
    "sha256_cert_fingerprints": [
      "<由 keystore 生成时填入>"
    ]
  }
}]
```

`package_name` 与 TWA `twa-manifest.json` 的 `packageId` 一致。
`sha256_cert_fingerprints` 通过 `keytool -list -v -keystore morse-practice.keystore` 获取，**首次发布前填入**。

### 4.5 `index.html` 改动

**新增**（`<head>` 内）：
```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#6c5ce7">
<link rel="apple-touch-icon" href="/assets/icon-192.png">
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js');
    });
  }
</script>
```

**删除**（会与 SW 冲突）：
```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" "0">
```

> 这三行原本是为开发期避免浏览器缓存加的，部署后反而不利（SW 已接管缓存策略）。开发期改用 `dev-server.py` 的 no-cache 头即可。

---

## 5. 平台打包（包装层）

### 5.1 Windows `.exe` —— Go 启动器

**位置**：`release/cmd/windows-launcher/main.go`（~150 行）

**核心逻辑**：
```go
//go:embed all:dist
var assets embed.FS

func main() {
    ln, _ := net.Listen("tcp", "127.0.0.1:0")
    port := ln.Addr().(*net.TCPAddr).Port

    sub, _ := fs.Sub(assets, "dist")
    go http.Serve(ln, http.FileServer(http.FS(sub)))

    url := fmt.Sprintf("http://127.0.0.1:%d/", port)
    exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()

    select {} // 阻塞，用户关闭窗口即结束进程
}
```

**关键设计**：
- `embed.FS`：Go 编译时把 `release/dist/web/` 整个目录嵌入二进制 → **单文件交付**
- 端口 0 = OS 自动分配空闲端口 → 避免冲突
- 启动时在终端打印 URL → 用户看到"安装位置"和"如何停止"
- 关闭启动器窗口 = 服务停止 = 浏览器下次刷新会失败

**构建命令**（CI 在 ubuntu-latest 上交叉编译）：
```bash
cd release/cmd/windows-launcher
GOOS=windows GOARCH=amd64 go build \
  -ldflags="-H windowsgui -X main.version=$VERSION" \
  -o ../../dist/Morse-Practice-$VERSION.exe
```

- `windowsgui`：编译为 GUI 子系统（不弹黑色控制台窗口）
- CI runner 是 Linux，用 `mingw-w64` 即可交叉编译 Go

**产物**：`Morse-Practice-0.2.0.exe`（~5MB，含 150KB 资源）

### 5.2 Linux `.deb` —— bash + python3

**位置**：`release/packaging/linux/`（模板）+ `release/scripts/build-linux.sh`

**启动脚本** `/usr/bin/morse-practice`：
```bash
#!/bin/bash
set -e
ASSETS=/opt/morse-practice
PORT=${MORSE_PORT:-18765}
URL="http://127.0.0.1:$PORT/"

cd "$ASSETS"
python3 -m http.server $PORT --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null" EXIT
sleep 0.3

xdg-open "$URL" >/dev/null 2>&1 &
echo "Morse Practice running on $URL"
echo "Press Enter to stop..."
read _
kill $SERVER_PID 2>/dev/null
```

**`.deb` 目录树**（脚本组装）：
```
morse-practice_0.2.0_amd64.deb
└── /
    ├── usr/bin/morse-practice
    ├── opt/morse-practice/                  # 全部 web 资源
    │   ├── index.html
    │   ├── manifest.json
    │   ├── sw.js
    │   ├── assets/...
    │   ├── src/...
    │   └── styles/...
    ├── usr/share/applications/morse-practice.desktop
    ├── usr/share/icons/hicolor/256x256/apps/morse-practice.png
    ├── usr/share/doc/morse-practice/copyright
    └── DEBIAN/{control,postinst,prerm}
```

**`morse-practice.desktop`**（XDG 菜单项）：
```ini
[Desktop Entry]
Type=Application
Name=摩斯密码练习器
Name[en]=Morse Practice
Comment=Practice Morse code in your browser, offline
Exec=morse-practice
Icon=morse-practice
Terminal=true
Categories=Education;
StartupNotify=true
```

**`DEBIAN/control`**：
```
Package: morse-practice
Version: 0.2.0
Section: education
Priority: optional
Architecture: amd64
Depends: python3, xdg-utils
Recommends: chromium | google-chrome | firefox
Maintainer: Yuxin Luo <your-email@example.com>
Description: 摩斯密码练习器 (Morse Practice)
 一个支持字母/单词/句子三档练习、双向听打、键盘拍码的摩斯码练习工具。
 纯前端实现，可离线使用。
```

**构建命令**：
```bash
bash release/scripts/build-linux.sh
# 内部：
#   1. 复制 release/dist/web/ → build/opt/morse-practice/
#   2. 复制启动脚本 → build/usr/bin/morse-practice
#   3. chmod +x
#   4. dpkg-deb --build --root-owner-group build morse-practice_0.2.0_amd64.deb
```

**产物**：`morse-practice_0.2.0_amd64.deb`（~150KB）

**系统依赖**：
- `python3`（Debian/Ubuntu 预装）
- `xdg-utils`（几乎所有 Linux 桌面预装）
- 推荐 `chromium` / `google-chrome` / `firefox`（启动器会按优先级探测）

### 5.3 Android `.apk` —— Bubblewrap TWA

**位置**：`release/packaging/android/twa-manifest.json`

**`twa-manifest.json`**：
```json
{
  "packageId": "com.github.yuxinluo.morsepractice",
  "host": "morsepractice.pages.dev",
  "name": "摩斯密码练习器",
  "launcherName": "Morse Practice",
  "display": "standalone",
  "orientation": "portrait",
  "themeColor": "#6c5ce7",
  "backgroundColor": "#f7f8fc",
  "enableNotifications": false,
  "startUrl": "/",
  "iconUrl": "https://morsepractice.pages.dev/assets/icon-512.png",
  "splashColor": "#6c5ce7",
  "webManifestUrl": "https://morsepractice.pages.dev/manifest.json",
  "fallbackType": "customtabs",
  "appVersion": "0.2.0",
  "versionCode": 20000
}
```

> `*.pages.dev` 子域的 TWA 不能 100% 全屏（无严格 DAL 验证）。
> Bubblewrap 会生成**社区共享签名** manifest。偶尔会回落到 Custom Tab —— 这是已知的子域限制，可接受。

**构建命令**：
```bash
bubblewrap build \
  --manifest=release/packaging/android/twa-manifest.json \
  --keystore=$KEYSTORE_FILE \
  --keystorePassword=$KEYSTORE_PASS \
  --keyPassword=$KEY_PASS
# 产出 app-release-signed.apk → 重命名 morse-practice-0.2.0.apk
```

**产物**：`morse-practice-0.2.0.apk`（~50KB）

**首次安装**：
- 用户从 GitHub Release 下载 APK
- 需开启"未知来源应用"权限（标准 sideload 流程）
- 启动后第一次访问 URL → SW 在后台缓存所有资源
- 第二次起完全离线

---

## 6. 资源构建流水线

**`release/scripts/build-assets.sh`** —— 每次构建前必跑：

```bash
#!/bin/bash
set -e
VERSION=$(node -p "require('./package.json').version")
ROOT=$(git rev-parse --show-toplevel)
DIST=$ROOT/release/dist

# 1. 复制 web 源码到 dist/
rm -rf "$DIST/web"
mkdir -p "$DIST/web"
cp -r "$ROOT/index.html" "$ROOT/styles" "$ROOT/src" "$DIST/web/"
cp "$ROOT/manifest.json" "$ROOT/sw.js" "$DIST/web/" 2>/dev/null || true

# 2. 复制图标
mkdir -p "$DIST/web/assets"
cp "$ROOT/release/assets/"*.png "$DIST/web/assets/"

# 3. 注入版本号到 manifest.json
sed -i "s/\"version\".*/\"version\": \"$VERSION\",/" "$DIST/web/manifest.json"

echo "✓ Web assets built at $DIST/web/"
```

**`release/scripts/build-icons.py`** —— 从 `FrontImages/icon.png` 切图标：

```python
#!/usr/bin/env python3
"""
从 FrontImages/icon.png 中心裁剪 + 缩放到多种尺寸。
输入：628×625（接近正方形但差 3px）
输出：192/256/512/maskable-512 PNG
"""
from PIL import Image
import sys, os
from pathlib import Path

SRC = Path("FrontImages/icon.png")
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("release/assets")
OUT.mkdir(parents=True, exist_ok=True)

# 中心裁剪到正方形
img = Image.open(SRC).convert("RGBA")
w, h = img.size
side = min(w, h)
left, top = (w - side) // 2, (h - side) // 2
sq = img.crop((left, top, left + side, top + side))

# maskable 安全区配色（用主题色填充）
THEME = (108, 92, 231, 255)  # #6c5ce7

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
```

**首次跑法**：
```bash
# 本地
python3 release/scripts/build-icons.py
git add release/assets/*.png
git commit -m "chore(release): generate app icons from FrontImages/icon.png"
```

---

## 7. `release/` 目录结构

```
release/
├── README.md                          # 打包 + 发布流程说明（中文）
├── dev_doc/                           # 设计 / 规划文档
│   └── 2026-06-25-multi-platform-release-design.md  # 本文件
├── cliff.toml                         # git-cliff 配置
├── assets/                            # 生成的图标（commit）
│   ├── icon-192.png
│   ├── icon-256.png
│   ├── icon-512.png
│   └── icon-maskable-512.png
├── cmd/
│   └── windows-launcher/
│       └── main.go                    # Go 启动器源码
├── packaging/
│   ├── linux/                         # .deb 模板（commit）
│   │   ├── DEBIAN/control
│   │   ├── DEBIAN/postinst            # chmod +x
│   │   ├── DEBIAN/prerm               # 清理
│   │   ├── usr/bin/morse-practice     # 启动脚本
│   │   └── usr/share/applications/morse-practice.desktop
│   └── android/
│       └── twa-manifest.json          # Bubblewrap 配置
├── scripts/                           # 全部打包脚本
│   ├── build-assets.sh                # 复制 + 注入版本
│   ├── build-icons.py                 # icon 处理
│   ├── build-windows.sh               # go build
│   ├── build-linux.sh                 # dpkg-deb
│   ├── build-android.sh               # bubblewrap build
│   └── release.sh                     # 一键本地构建（可选）
└── dist/                              # 构建产物（gitignore）
    ├── web/                           # 中间产物
    ├── Morse-Practice-0.2.0.exe
    ├── morse-practice_0.2.0_amd64.deb
    └── morse-practice-0.2.0.apk
```

**根 `.gitignore` 追加**（`release/dist/` 已被现有 `dist/` 模式覆盖，无需重复）：
```gitignore
# 追加到根 .gitignore
*.keystore
*.keystore.b64
```

---

## 8. GitHub Actions Workflow

**`.github/workflows/release.yml`**：

```yaml
name: Release

on:
  push:
    tags: ['v*.*.*']

permissions:
  contents: write

jobs:
  build-assets:
    name: Build web assets
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - name: Build web assets
        run: bash release/scripts/build-assets.sh
      - uses: actions/upload-artifact@v4
        with:
          name: web-assets
          path: release/dist/web/
          retention-days: 1

  build-linux:
    name: Build Linux .deb
    needs: build-assets
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with: { name: web-assets, path: release/dist/web }
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - name: Build .deb
        run: bash release/scripts/build-linux.sh
      - uses: actions/upload-artifact@v4
        with:
          name: morse-practice-linux-deb
          path: release/dist/*.deb

  build-windows:
    name: Build Windows .exe
    needs: build-assets
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with: { name: web-assets, path: release/dist/web }
      - uses: actions/setup-go@v5
        with: { go-version: '1.22' }
      - name: Build .exe
        run: bash release/scripts/build-windows.sh
      - uses: actions/upload-artifact@v4
        with:
          name: morse-practice-windows-exe
          path: release/dist/*.exe

  build-android:
    name: Build Android .apk
    needs: build-assets
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with: { name: web-assets, path: release/dist/web }
      - uses: actions/setup-java@v4
        with: { distribution: 'temurin', java-version: '17' }
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - name: Decode keystore
        run: echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 -d > /tmp/keystore.jks
      - name: Build .apk
        env:
          KEYSTORE_FILE: /tmp/keystore.jks
          KEYSTORE_PASS: ${{ secrets.ANDROID_KEYSTORE_PASS }}
          KEY_PASS: ${{ secrets.ANDROID_KEY_PASS }}
        run: bash release/scripts/build-android.sh
      - uses: actions/upload-artifact@v4
        with:
          name: morse-practice-android-apk
          path: release/dist/*.apk

  release:
    name: Create GitHub Release
    needs: [build-linux, build-windows, build-android]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: release/dist/
          pattern: morse-practice-*
          merge-multiple: true
      - name: Generate changelog
        uses: orhunp/git-cliff-action@v3
        with:
          config: release/cliff.toml
      - name: Create release
        uses: softprops/action-gh-release@v2
        with:
          name: ${{ github.ref_name }}
          body: ${{ env.CHANGELOG }}
          files: |
            release/dist/*.deb
            release/dist/*.exe
            release/dist/*.apk
          draft: false
          prerelease: ${{ contains(github.ref_name, '-rc') }}
```

**`release/cliff.toml`**（关键部分，完整配置会随实现展开）：

```toml
[changelog]
header = """
# Changelog\n
"""
body = """
{% if version %}\
    ## [{{ version }}] - {{ timestamp | date(format="%Y-%m-%d") }}
{% else %}\
    ## [Unreleased]
{% endif %}\
{% for group, commits in commits | filter(attribute="merge_commit", value=false) | group_by(attribute="group") %}
    ### {{ group | upper_first }}
    {% for commit in commits | filter(attribute="merge_commit", value=false) | sort(attribute="message") %}
    - {{ commit.message | split(pat="\n") | first | trim }}\
    {% endfor %}
{% endfor %}\n
"""

trim = true
postprocessors = []

[git]
conventional_commits = true
filter_unconventional = true
```

---

## 9. 必填 Secrets

首次设置（一次性）：

| Secret | 用途 | 生成方式 |
|--------|------|---------|
| `ANDROID_KEYSTORE_BASE64` | TWA 签名 keystore | 见 §11 |
| `ANDROID_KEYSTORE_PASS` | keystore 解锁密码 | 自定 |
| `ANDROID_KEY_PASS` | 签名 key 密码 | 自定 |

> `GITHUB_TOKEN` 不用配置 —— Actions 自带 + workflow 顶部 `permissions: contents: write` 已声明。

---

## 10. 测试策略

| 层 | 内容 | 工具 | 触发 |
|----|------|------|------|
| **单元**（已有）| 80+ 测试覆盖 `src/core/*`、`src/modes/*`、`src/storage/*`、`src/i18n/*` | vitest | 每次 push |
| **PWA 资源完整性**（新增）| `manifest.json` 字段、`sw.js` PRECACHE 数组的文件都存在、`.well-known/assetlinks.json` 合法 | vitest | 每次 push |
| **构建冒烟**（CI 跑）| `build-assets.sh` 跑通、`dist/web/` 包含 7+ 必需文件 | shell assert | PR 到 main |
| **产物类型**（CI 跑）| `file *.exe` 应该是 PE32+；`dpkg-deb --info` 验证元数据 | shell | release job |
| **手动 E2E** | 首次 release 在本地装三个包验证可启动 | 人 | v0.2.0 前 |

**新增测试文件**：`tests/pwa-manifest.test.js`（~50 行）：

```js
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

describe('PWA manifest', () => {
  const manifest = read('manifest.json');
  it('has required fields', () => {
    for (const k of ['name', 'short_name', 'start_url', 'display', 'theme_color', 'background_color', 'icons']) {
      expect(manifest, `manifest.${k}`).toHaveProperty(k);
    }
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  });
  it('every icon src exists', () => {
    for (const icon of manifest.icons) {
      expect(existsSync(join(root, 'public', icon.src).replace(/^\//, '')))
        .toBe(true);
    }
  });
});

describe('Service Worker PRECACHE', () => {
  it('references existing files', () => {
    const sw = readFileSync(join(root, 'sw.js'), 'utf8');
    const match = sw.match(/const PRECACHE = \[([^\]]+)\]/);
    expect(match).toBeTruthy();
    const urls = match[1].match(/'([^']+)'/g).map(s => s.slice(1, -1));
    expect(urls.length).toBeGreaterThan(5);
    for (const url of urls) {
      const path = join(root, 'public', url).replace(/^\//, '');
      expect(existsSync(path), `PRECACHE url ${url}`).toBe(true);
    }
  });
});
```

---

## 11. Android Keystore 首次生成（一次性本地操作）

```bash
# 1. 生成 keystore
keytool -genkey -v \
  -keystore morse-practice.keystore \
  -alias morse-practice \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass <KEYSTORE_PASS> -keypass <KEY_PASS> \
  -dname "CN=Yuxin Luo, OU=Personal, O=MorsePractice, L=City, S=State, C=CN"

# 2. 获取 SHA-256（用于 assetlinks.json）
keytool -list -v -keystore morse-practice.keystore -storepass <KEYSTORE_PASS> \
  | grep SHA256
# 把指纹填到 release/packaging/android/assetlinks.json（其实填到仓库的 .well-known/assetlinks.json）

# 3. 编码 keystore 备用
base64 -w 0 morse-practice.keystore > keystore.b64

# 4. 存为 GitHub Secrets（在 repo Settings → Secrets → Actions）
#   ANDROID_KEYSTORE_BASE64 = (keystore.b64 内容)
#   ANDROID_KEYSTORE_PASS   = <KEYSTORE_PASS>
#   ANDROID_KEY_PASS        = <KEY_PASS>

# 5. 妥善保管 morse-practice.keystore 到密码管理器 / 加密备份
#    丢失 = 无法升级已发布版本（用户必须卸载重装）
```

---

## 12. 改动清单

### 新增（commit）

| 路径 | 来源 |
|------|------|
| `manifest.json` | §4.2 |
| `sw.js` | §4.3 |
| `.well-known/assetlinks.json` | §4.4 |
| `release/README.md` | 流程说明 |
| `release/dev_doc/2026-06-25-multi-platform-release-design.md` | 本文件 |
| `release/cliff.toml` | §8 |
| `release/assets/icon-{192,256,512,maskable-512}.png` | §6 |
| `release/cmd/windows-launcher/main.go` | §5.1 |
| `release/cmd/windows-launcher/go.mod` | Go 模块定义 |
| `release/packaging/linux/DEBIAN/{control,postinst,prerm}` | §5.2 |
| `release/packaging/linux/usr/bin/morse-practice` | §5.2 |
| `release/packaging/linux/usr/share/applications/morse-practice.desktop` | §5.2 |
| `release/packaging/android/twa-manifest.json` | §5.3 |
| `release/scripts/build-assets.sh` | §6 |
| `release/scripts/build-icons.py` | §6 |
| `release/scripts/build-windows.sh` | §5.1 |
| `release/scripts/build-linux.sh` | §5.2 |
| `release/scripts/build-android.sh` | §5.3 |
| `tests/pwa-manifest.test.js` | §10 |
| `.github/workflows/release.yml` | §8 |

### 修改

| 路径 | 改动 |
|------|------|
| `index.html` | 加 `<link rel="manifest">` 等 PWA 标签；删 3 个 no-cache meta |
| `.gitignore` | 追加 `*.keystore`、`*.keystore.b64`（`release/dist/` 已被现有 `dist/` 模式覆盖） |

### 不动

- `src/`、`styles/`、`package.json`（除了现有 devDependencies）
- `dev-docs/`、`docs/`、`tests/`（除了新增 pwa-manifest.test.js）

---

## 13. 首次发布 Checklist

> 第一次打 tag 前的预备工作（每台机器只做一次）

- [ ] **站点改造**
  - [ ] 添加 `manifest.json` / `sw.js` / `.well-known/assetlinks.json`
  - [ ] 修改 `index.html`（PWA 标签、删 no-cache meta）
  - [ ] 本地 `python3 dev-server.py` → Chrome DevTools 验证 PWA 状态
  - [ ] Lighthouse PWA 审计 100 分
  - [ ] `wrangler pages deploy .` 上线
- [ ] **图标生成**
  - [ ] `python3 release/scripts/build-icons.py` 生成 4 个尺寸
  - [ ] `git add release/assets/ && git commit -m "chore(release): generate app icons"`
- [ ] **Android Keystore**
  - [ ] 按 §11 生成 keystore → 存到本地安全位置
  - [ ] 把 SHA-256 填到 `.well-known/assetlinks.json`
  - [ ] GitHub Secrets 配 3 个 ANDROID_* 变量
- [ ] **CI 首次跑通**
  - [ ] 合并 PR → 检查 Actions 在 push 事件下不触发 release（因为没 tag）
  - [ ] （可选）打一个 `v0.2.0-rc.1` tag 试跑 release
  - [ ] 下载三个产物、本地安装验证
- [ ] **正式发布**
  - [ ] 更新 `package.json` version → 0.2.0
  - [ ] 合并到 main → `git tag v0.2.0 && git push origin v0.2.0`
  - [ ] GitHub Actions 自动构建 + 创建 Release

---

## 14. 已知限制与未来改进

| 限制 | 当前方案 | 未来改进 |
|------|---------|---------|
| Android 偶发回落 Custom Tab | `*.pages.dev` 子域无严格 DAL 验证 | 绑自定义域（如 `morse.yuxinluo.com`）|
| Win 启动器无优雅退出 | 关闭控制台窗口即停止 | 加系统托盘 + Quit 菜单（`getlantern/systray`）|
| Win 无安装/卸载 UI | 纯单文件 exe | 用 NSIS 包装一层加安装向导 |
| Linux 启动需手动关终端 | bash 启动器 | 加系统托盘或 systemd user service |
| 无 macOS 包 | 用户未要求 | Tauri / electron-builder 跨平台扩展 |
| 业务代码改动时 SW cache 不会自动失效 | 靠手动 +1 版本号 | 加版本探测 + 提示用户刷新 |
| `.exe` 未签名 | 用户运行需点"仍要运行" | 申请代码签名证书（年费 ~$200）|
| 无 macOS 通知 / 系统集成 | 不在范围 | Tauri 扩展 |

---

## 附录 A：参考链接

- [Bubblewrap TWA](https://github.com/GoogleChromeLabs/bubblewrap) — Android TWA 构建工具
- [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) — Win 启动器内嵌方案（本设计不直接用，但作为 Tauri 备选）
- [git-cliff](https://git-cliff.org/) — 自动 changelog
- [Conventional Commits](https://www.conventionalcommits.org/) — 提交规范
- [PWA Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest) — MDN 参考
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) — MDN 参考
- [Digital Asset Links](https://developers.google.com/digital-asset-links/v1/getting-started) — TWA 验证机制
- [dpkg-deb 手册](https://manpages.debian.org/dpkg-deb) — Linux 打包
