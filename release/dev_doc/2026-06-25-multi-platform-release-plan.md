# 摩斯密码练习器 · 多平台发布实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为摩斯密码练习器添加 .exe / .apk / .deb 三平台发布能力，由 git tag 触发 GitHub Actions 自动构建 + 上传 GitHub Release。

**Architecture:** 站点层（现有代码 + PWA 改造）+ 包装层（`release/` 目录下的脚本和模板）双层分离。Windows / Linux 走 B 方案（嵌入资源 + 迷你静态服务器，真离线），Android 走 A 方案（TWA + 强 SW 缓存）。所有构建由 `release/scripts/*.sh` 驱动，CI 跑相同的脚本。

**Tech Stack:** Bash, Python 3 (PIL), Go 1.22+ (Windows launcher), Bubblewrap (TWA), JDK 17, dpkg-deb, GitHub Actions, git-cliff, vitest.

---

## 全局约束

- 业务代码不引入打包器/构建工具 — **零构建哲学延续**
- 所有发布相关代码放 `release/` 目录
- GitHub 仓库：`git@github.com:Yuxin-Luo/MorsePractice.git`
- 线上域名：`morsepractice.pages.dev`
- 主题色：`#6c5ce7`，背景色：`#f7f8fc`
- Android 包名：`com.github.yuxinluo.morsepractice`
- 所有提交遵循 Conventional Commits（feat/fix/chore/docs/test/ci）
- Conventional Commits 类别：feat（功能）· fix（修复）· docs（文档）· style（格式）· refactor（重构）· perf（性能）· test（测试）· chore（构建/工具）· ci（CI 配置）
- TDD 适用范围：PWA 资源完整性、Go 启动器、build-icons.py。其他配置文件（DEBIAN/control、twa-manifest.json、GitHub Actions YAML）通过冒烟测试验证。

---

## Phase 0：环境准备

### Task 0.1：检查本地工具链

**Files:** 不涉及文件改动

**Prerequisites：** 本地已安装 Git、Node.js（v18+）

- [ ] **Step 1：检查必备工具**

```bash
# 全部应返回版本号（非空、exit code 0）
git --version
node --version
npm --version
python3 --version
# 下面 3 个是可选的 — 缺失会在对应 Phase 提示安装
go version || echo "⚠️  Go 未安装（Phase 3 之前装好）"
keytool -help 2>&1 | head -1 || echo "⚠️  JDK 未安装（Phase 5 之前装好）"
dpkg-deb --version || echo "⚠️  dpkg-deb 未安装（Phase 4 之前装好，sudo apt install dpkg-dev）"
```

- [ ] **Step 2：检查 PIL**

```bash
python3 -c "from PIL import Image; print('PIL OK', Image.__version__)" || \
  echo "⚠️  PIL 未安装（Phase 2 之前装好，pip install Pillow）"
```

- [ ] **Step 3：检查 Bubblewrap CLI（Phase 5 之前装好）**

```bash
npx --no-install @bubblewrap/cli --version 2>/dev/null || \
  echo "⚠️  Bubblewrap 未安装（Phase 5 之前装好，npm install -g @bubblewrap/cli）"
```

- [ ] **Step 4：确认 .gitignore 当前状态**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
git status --short
# 预期：无未跟踪的 release/ 目录内容冲突
```

- [ ] **Step 5：创建 release/ 骨架**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
mkdir -p release/{assets,cmd/windows-launcher,packaging/linux/DEBIAN,packaging/android,scripts,dev_doc}
# 验证
ls -la release/
# 预期：看到 5 个子目录
```

- [ ] **Step 6：提交骨架**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
git add release/
git commit -m "chore(release): scaffold release/ directory structure"
# 预期：[main xxxxxx] chore(release): scaffold release/ directory structure
```

---

## Phase 1：站点 PWA 改造

### Task 1.1：创建 manifest.json

**Files:**
- Create: `manifest.json`

**Interfaces:**
- Produces: 标准 PWA manifest，后续 sw.js 和 .well-known/assetlinks.json 引用相同的 app identity

- [ ] **Step 1：写入 manifest.json**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
```

写入 `/home/ruo/Desktop/LYX/VibeCoding/MorsePractice/manifest.json`：

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
    { "src": "/assets/icon-192.png",         "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/assets/icon-512.png",         "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/assets/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 2：JSON 语法验证**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
python3 -c "import json; json.load(open('manifest.json')); print('✓ JSON valid')"
# 预期：✓ JSON valid
```

- [ ] **Step 3：先不提交（等所有 PWA 资源到齐再一起提交）**

> manifest.json 引用了 `assets/icon-192.png` 等还不存在的文件，单独提交会破坏 TWA 验证。统一在 Task 1.4 之后一起提交。

---

### Task 1.2：创建 sw.js（Service Worker）

**Files:**
- Create: `sw.js`

**Interfaces:**
- Consumes: `manifest.json`（同目录读取）
- Produces: 注册到浏览器后接管 fetch，缓存所有静态资源

- [ ] **Step 1：写入 sw.js**

写入 `/home/ruo/Desktop/LYX/VibeCoding/MorsePractice/sw.js`：

```js
// Morse Practice · Service Worker
// 策略：HTML 入口 network-first（保证升级），静态资源 cache-first
// 升级：手动把下方 CACHE_VERSION 从 v1 改为 v2、v3... 即可触发旧 cache 清理

const CACHE_VERSION = 'morse-cache-v1';
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

// 安装：预缓存所有资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE))
  );
  // 立即激活新 SW（不等旧 SW 退出）
  self.skipWaiting();
});

// 激活：清旧版本 cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// fetch 拦截
self.addEventListener('fetch', (event) => {
  const req = event.request;
  // 只处理 GET
  if (req.method !== 'GET') return;
  // 只处理同源
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // HTML 入口 → network-first
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/')))
    );
    return;
  }

  // 其他静态资源 → cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // 只缓存成功响应
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        return res;
      });
    })
  );
});
```

- [ ] **Step 2：JS 语法检查**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
node --check sw.js && echo "✓ sw.js syntax OK"
# 预期：✓ sw.js syntax OK
```

- [ ] **Step 3：不提交（PRECACHE 引用了不存在的图标，等 Phase 2 生成）**

---

### Task 1.3：创建 .well-known/assetlinks.json

**Files:**
- Create: `.well-known/assetlinks.json`

- [ ] **Step 1：写入占位 assetlinks.json**

写入 `/home/ruo/Desktop/LYX/VibeCoding/MorsePractice/.well-known/assetlinks.json`：

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.github.yuxinluo.morsepractice",
    "sha256_cert_fingerprints": [
      "REPLACE_WITH_REAL_SHA256_AFTER_KEYSTORE_GENERATION"
    ]
  }
}]
```

- [ ] **Step 2：JSON 验证**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
python3 -c "import json; json.load(open('.well-known/assetlinks.json')); print('✓ JSON valid')"
# 预期：✓ JSON valid
```

- [ ] **Step 3：不提交（SHA-256 是占位符，Phase 5 生成 keystore 后填入真实值再提交）**

---

### Task 1.4：修改 index.html（加 PWA 标签、删 no-cache）

**Files:**
- Modify: `index.html:1-12`（`<head>` 区域）

- [ ] **Step 1：读取当前 index.html 头部**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
sed -n '1,12p' index.html
# 预期看到 3 个 Cache-Control / Pragma / Expires 的 <meta> 标签
```

- [ ] **Step 2：删除 3 个 no-cache meta 标签**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
sed -i '/<meta http-equiv="Cache-Control"/d' index.html
sed -i '/<meta http-equiv="Pragma"/d' index.html
sed -i '/<meta http-equiv="Expires"/d' index.html
```

- [ ] **Step 3：验证删除成功**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
sed -n '1,12p' index.html
# 预期：3 个 no-cache meta 已消失
```

- [ ] **Step 4：在 `</head>` 前添加 PWA 标签**

使用 Edit 工具：

- `old_string`:
  ```
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E📡%3C/text%3E%3C/svg%3E">
    <link rel="stylesheet" href="./styles/main.css?v=3">
  </head>
  ```
- `new_string`:
  ```
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E📡%3C/text%3E%3C/svg%3E">
    <link rel="stylesheet" href="./styles/main.css?v=3">
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
  </head>
  ```

- [ ] **Step 5：本地起服务，浏览器验证 PWA 注册**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
python3 dev-server.py 8765 &
DEV_PID=$!
sleep 1
# 用 curl 确认 PWA 资源能访问
curl -s -o /dev/null -w "manifest.json: %{http_code}\n" http://localhost:8765/manifest.json
curl -s -o /dev/null -w "sw.js: %{http_code}\n" http://localhost:8765/sw.js
# 预期：两个都是 200
kill $DEV_PID
```

- [ ] **Step 6：手动浏览器验证（重要）**

```
浏览器打开 http://localhost:8765
→ DevTools → Application 标签
→ Manifest 区域应该显示 app name、theme_color、icons（icon 资源 404 是预期的，Phase 2 后会好）
→ Service Workers 区域显示 sw.js 已注册
```

- [ ] **Step 7：暂不提交（等所有 PWA 资源齐 + 图标生成后统一提交）**

---

### Task 1.5：编写 PWA 资源完整性测试（TDD）

**Files:**
- Create: `tests/pwa-manifest.test.js`

**Interfaces:**
- Consumes: `manifest.json`（根目录）、`sw.js`（根目录）
- Produces: 失败时阻止 Phase 1 提交

- [ ] **Step 1：先写失败测试**

写入 `/home/ruo/Desktop/LYX/VibeCoding/MorsePractice/tests/pwa-manifest.test.js`：

```js
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';

const root = resolve(__dirname, '..');

describe('PWA manifest.json', () => {
  let manifest;
  beforeAll(() => {
    manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  });

  it('has required fields', () => {
    for (const k of ['name', 'short_name', 'start_url', 'display', 'theme_color', 'background_color', 'icons']) {
      expect(manifest, `manifest.${k}`).toHaveProperty(k);
    }
  });

  it('display is standalone', () => {
    expect(manifest.display).toBe('standalone');
  });

  it('has at least 2 icons including maskable', () => {
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    const maskable = manifest.icons.find((i) => i.purpose === 'maskable');
    expect(maskable, 'no maskable icon').toBeTruthy();
  });

  it('every icon src exists on disk', () => {
    for (const icon of manifest.icons) {
      const path = join(root, icon.src.replace(/^\//, ''));
      expect(existsSync(path), `icon missing: ${icon.src}`).toBe(true);
    }
  });
});

describe('Service Worker PRECACHE', () => {
  let urls;
  beforeAll(() => {
    const sw = readFileSync(join(root, 'sw.js'), 'utf8');
    const match = sw.match(/const PRECACHE = \[([\s\S]*?)\];/);
    expect(match, 'PRECACHE array not found in sw.js').toBeTruthy();
    urls = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  });

  it('has at least 10 precached urls', () => {
    expect(urls.length).toBeGreaterThanOrEqual(10);
  });

  it('every precached url exists on disk', () => {
    for (const url of urls) {
      // '/' 映射到 index.html
      const rel = url === '/' ? 'index.html' : url.replace(/^\//, '');
      const path = join(root, rel);
      expect(existsSync(path), `PRECACHE url missing: ${url}`).toBe(true);
    }
  });

  it('has cache version constant', () => {
    const sw = readFileSync(join(root, 'sw.js'), 'utf8');
    expect(sw).toMatch(/CACHE_VERSION\s*=\s*['"]morse-cache-v\d+['"]/);
  });
});

describe('assetlinks.json', () => {
  it('is valid JSON array', () => {
    const data = JSON.parse(readFileSync(join(root, '.well-known/assetlinks.json'), 'utf8'));
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
  });

  it('targets the expected Android package', () => {
    const data = JSON.parse(readFileSync(join(root, '.well-known/assetlinks.json'), 'utf8'));
    const target = data[0].target;
    expect(target.namespace).toBe('android_app');
    expect(target.package_name).toBe('com.github.yuxinluo.morsepractice');
    expect(Array.isArray(target.sha256_cert_fingerprints)).toBe(true);
  });
});
```

- [ ] **Step 2：跑测试（应部分失败：icon 不存在）**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
npm test -- tests/pwa-manifest.test.js
# 预期：FAIL — "icon missing: /assets/icon-192.png" 等图标相关 assertion
# 这是预期失败，因为我们还没生成图标
```

- [ ] **Step 3：暂存测试文件（不提交，等 Phase 2 图标生成后一起跑）**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
git add tests/pwa-manifest.test.js
# 不要 commit
```

---

## Phase 2：图标生成

### Task 2.1：编写 build-icons.py（TDD）

**Files:**
- Create: `release/scripts/build-icons.py`

- [ ] **Step 1：先写测试**

写入 `/home/ruo/Desktop/LYX/VibeCoding/MorsePractice/release/scripts/test_build_icons.py`：

```python
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
```

- [ ] **Step 2：跑测试（应失败 — 脚本不存在）**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
python3 release/scripts/test_build_icons.py
# 预期：✗ build-icons.py exists at ...
```

- [ ] **Step 3：写脚本**

写入 `/home/ruo/Desktop/LYX/VibeCoding/MorsePractice/release/scripts/build-icons.py`：

```python
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
```

- [ ] **Step 4：跑测试（应通过）**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
python3 release/scripts/test_build_icons.py
# 预期：✅ All build-icons tests passed
```

- [ ] **Step 5：生成正式图标到 release/assets/**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
python3 release/scripts/build-icons.py
# 预期：输出 4 个 PNG 到 release/assets/
ls -la release/assets/
# 预期：icon-192.png  icon-256.png  icon-512.png  icon-maskable-512.png
```

- [ ] **Step 6：把图标同步到 public assets 目录（供 TWA 引用）**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
mkdir -p assets
cp release/assets/*.png assets/
ls -la assets/
# 预期：4 个 PNG 都在
```

- [ ] **Step 7：重新跑 PWA 测试（这次应全过）**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
npm test -- tests/pwa-manifest.test.js
# 预期：PASS — 所有 icon 资源都存在了
```

- [ ] **Step 8：浏览器复验 PWA**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
python3 dev-server.py 8765 &
DEV_PID=$!
sleep 1
echo "open http://localhost:8765 in browser"
echo "DevTools → Application → Manifest should show 3 icons, no 404"
read -p "Press Enter to stop..."
kill $DEV_PID
```

- [ ] **Step 9：提交 PWA + 图标**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
git add manifest.json sw.js .well-known/assetlinks.json index.html
git add release/scripts/build-icons.py release/scripts/test_build_icons.py
git add release/assets/ assets/
git add tests/pwa-manifest.test.js
git status --short
# 预期：M index.html, A manifest.json, A sw.js, A .well-known/assetlinks.json,
#       A release/scripts/build-icons.py, A release/scripts/test_build_icons.py,
#       A release/assets/*.png, A assets/*.png, A tests/pwa-manifest.test.js
git commit -m "feat(pwa): add manifest, service worker, and app icons

- manifest.json: PWA app metadata with zh-CN locale
- sw.js: cache-first for static, network-first for HTML
- .well-known/assetlinks.json: TWA digital asset links (SHA-256 placeholder)
- assets/: 4 generated icons (192/256/512/maskable-512)
- index.html: link manifest, register SW, remove dev no-cache metas
- build-icons.py: PIL script to crop+resize from FrontImages/icon.png
- pwa-manifest.test.js: vitest coverage for PWA resource integrity

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Phase 3：Windows 启动器（Go）

### Task 3.1：编写 Go 启动器（TDD）

**Files:**
- Create: `release/cmd/windows-launcher/main.go`
- Create: `release/cmd/windows-launcher/go.mod`
- Create: `release/cmd/windows-launcher/main_test.go`

**Prerequisites:** `go version` 返回 1.22+

- [ ] **Step 1：先写失败的测试**

写入 `/home/ruo/Desktop/LYX/VibeCoding/MorsePractice/release/cmd/windows-launcher/main_test.go`：

```go
package main

import (
	"net"
	"strings"
	"testing"
)

// 验证 pickPort 能选到可用端口
func TestPickPort(t *testing.T) {
	ln, err := pickPort()
	if err != nil {
		t.Fatalf("pickPort failed: %v", err)
	}
	defer ln.Close()
	addr := ln.Addr().(*net.TCPAddr)
	if addr.Port == 0 {
		t.Fatal("expected non-zero port")
	}
	if !strings.HasPrefix(addr.IP.String(), "127.") {
		t.Fatalf("expected loopback, got %s", addr.IP)
	}
}

// 验证 buildURL 拼接正确
func TestBuildURL(t *testing.T) {
	url := buildURL(18765)
	if !strings.HasPrefix(url, "http://127.0.0.1:") {
		t.Fatalf("expected http://127.0.0.1:..., got %s", url)
	}
	if !strings.HasSuffix(url, "/") {
		t.Fatalf("expected trailing /, got %s", url)
	}
	if !strings.Contains(url, "18765") {
		t.Fatalf("expected port 18765, got %s", url)
	}
}
```

- [ ] **Step 2：跑测试（应失败 — 函数未定义）**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice/release/cmd/windows-launcher
go test ./...
# 预期：FAIL — undefined: pickPort, undefined: buildURL
```

- [ ] **Step 3：初始化 Go module**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice/release/cmd/windows-launcher
go mod init release/cmd/windows-launcher
# 预期：创建 go.mod 文件
cat go.mod
# 预期：module release/cmd/windows-launcher / go 1.22
```

- [ ] **Step 4：写 main.go**

写入 `/home/ruo/Desktop/LYX/VibeCoding/MorsePractice/release/cmd/windows-launcher/main.go`：

```go
// Morse Practice · Windows 启动器
// 启动本地静态服务器（嵌入的 web 资源）并打开默认浏览器。
// 关闭控制台窗口 = 停止服务。
package main

import (
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"runtime"
)

//go:embed all:dist
var assets embed.FS

var (
	version = "dev"
	showVer = flag.Bool("version", false, "print version and exit")
	headless = flag.Bool("headless", false, "start server without opening browser")
	port = flag.Int("port", 0, "port to listen on (0 = auto-assign)")
)

func main() {
	flag.Parse()
	if *showVer {
		fmt.Printf("morse-practice %s\n", version)
		return
	}

	// 1. 找端口
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", *port))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to listen: %v\n", err)
		os.Exit(1)
	}
	port := ln.Addr().(*net.TCPAddr).Port

	// 2. 启动静态服务器
	sub, err := fs.Sub(assets, "dist")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to access embedded assets: %v\n", err)
		os.Exit(1)
	}
	go func() {
		server := &http.Server{Handler: http.FileServer(http.FS(sub))}
		if err := server.Serve(ln); err != nil {
			fmt.Fprintf(os.Stderr, "Server stopped: %v\n", err)
		}
	}()

	// 3. 打开浏览器
	url := buildURL(port)
	fmt.Printf("Morse Practice %s 已启动：%s\n", version, url)
	fmt.Println("关闭此窗口即停止。")

	if !*headless {
		openBrowser(url)
	}

	// 4. 阻塞
	select {}
}

// pickPort 找一个可用端口（测试可见）
func pickPort() (net.Listener, error) {
	return net.Listen("tcp", "127.0.0.1:0")
}

// buildURL 拼装访问 URL（测试可见）
func buildURL(port int) string {
	return fmt.Sprintf("http://127.0.0.1:%d/", port)
}

// openBrowser 跨平台打开默认浏览器
func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default: // linux, freebsd, etc.
		cmd = exec.Command("xdg-open", url)
	}
	cmd.Start()
}
```

- [ ] **Step 5：跑测试（应通过）**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice/release/cmd/windows-launcher
go test ./...
# 预期：PASS
```

- [ ] **Step 6：暂存（不 commit，等 build-windows.sh 完成一起提交）**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
git add release/cmd/windows-launcher/
# 不要 commit
```

---

### Task 3.2：编写 build-windows.sh

**Files:**
- Create: `release/scripts/build-windows.sh`

- [ ] **Step 1：先写 build-assets.sh 准备 dist/（在 Phase 4 Task 4.1 写，但 windows 需要 dist 存在才能 build）**

> 临时复用 build-assets.sh 的逻辑到本 Task 的内联：
```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
# 临时创建 dist/web 供 Go 嵌入使用
VERSION=$(node -p "require('./package.json').version")
mkdir -p release/dist/web
cp -r index.html styles/ src/ release/dist/web/
cp manifest.json sw.js release/dist/web/
mkdir -p release/dist/web/assets
cp assets/*.png release/dist/web/assets/
# 注入版本号
sed -i "s/\"version\".*/\"version\": \"$VERSION\",/" release/dist/web/manifest.json
ls release/dist/web/
# 预期：index.html manifest.json sw.js styles/ src/ assets/ 都在
```

- [ ] **Step 2：把 dist/ 软链到 Go 启动器的 embed 目录**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice/release/cmd/windows-launcher
ln -sf ../../dist dist
ls -la dist
# 预期：dist → ../../dist 软链
```

- [ ] **Step 3：本地交叉编译测试（Linux 编译 Windows 二进制）**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice/release/cmd/windows-launcher
GOOS=windows GOARCH=amd64 go build \
  -ldflags="-H windowsgui -X main.version=$(node -p "require('./package.json').version")" \
  -o /tmp/morse-practice-test.exe .
ls -la /tmp/morse-practice-test.exe
# 预期：~5MB 的 PE32+ 可执行文件
file /tmp/morse-practice-test.exe
# 预期：PE32+ executable (GUI) x86-64, for MS Windows
```

- [ ] **Step 4：写正式 build-windows.sh**

写入 `/home/ruo/Desktop/LYX/VibeCoding/MorsePractice/release/scripts/build-windows.sh`：

```bash
#!/usr/bin/env bash
# 构建 Windows .exe（Go 启动器 + 嵌入的 web 资源）
# 依赖：Go 1.22+ 工具链
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
VERSION=$(node -p "require('./package.json').version")
DIST="$ROOT/release/dist"
LAUNCHER="$ROOT/release/cmd/windows-launcher"

# 1. 准备 embed 用的 dist 目录
mkdir -p "$DIST/web"
# 2. 链接 launcher 内的 embed 路径到 dist/
rm -f "$LAUNCHER/dist"
ln -sf "$DIST" "$LAUNCHER/dist"

# 3. 编译
cd "$LAUNCHER"
GOOS=windows GOARCH=amd64 go build \
  -ldflags="-H windowsgui -X main.version=$VERSION" \
  -o "$DIST/Morse-Practice-$VERSION.exe" .

# 4. 清理软链
rm -f "$LAUNCHER/dist"

echo "✓ Built: $DIST/Morse-Practice-$VERSION.exe"
ls -lh "$DIST/Morse-Practice-$VERSION.exe"
```

- [ ] **Step 5：跑脚本（用 Phase 4 Task 4.1 写的 build-assets.sh 复制资源）**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
chmod +x release/scripts/build-windows.sh
# 跑 build-assets.sh（Phase 4 会写，这里手动跑一次临时逻辑）
VERSION=$(node -p "require('./package.json').version")
rm -rf release/dist/web
mkdir -p release/dist/web
cp -r index.html styles/ src/ release/dist/web/
cp manifest.json sw.js release/dist/web/
mkdir -p release/dist/web/assets
cp assets/*.png release/dist/web/assets/
sed -i "s/\"version\".*/\"version\": \"$VERSION\",/" release/dist/web/manifest.json
# 跑 build-windows.sh
bash release/scripts/build-windows.sh
# 预期：✓ Built: .../release/dist/Morse-Practice-0.1.0.exe
```

- [ ] **Step 6：提交 Windows launcher 全部文件**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
git add release/cmd/windows-launcher/main.go
git add release/cmd/windows-launcher/main_test.go
git add release/cmd/windows-launcher/go.mod
git add release/cmd/windows-launcher/go.sum  # 如果存在
git add release/scripts/build-windows.sh
git commit -m "feat(release): add Windows launcher (Go + embed.FS)

- main.go: HTTP server on 127.0.0.1:0 + browser launch
- main_test.go: TDD coverage for port picking and URL building
- go.mod: Go 1.22 module declaration
- build-windows.sh: cross-compile from Linux via GOOS=windows

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Phase 4：资源构建流水线 + Linux 打包

### Task 4.1：编写 build-assets.sh

**Files:**
- Create: `release/scripts/build-assets.sh`

- [ ] **Step 1：写脚本**

写入 `/home/ruo/Desktop/LYX/VibeCoding/MorsePractice/release/scripts/build-assets.sh`：

```bash
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
```

- [ ] **Step 2：测试脚本**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
chmod +x release/scripts/build-assets.sh
bash release/scripts/build-assets.sh
# 预期：列出 ~20+ 个文件（HTML、manifest、sw.js、所有 src/ 文件、assets/ 图标）
# 验证关键文件
test -f release/dist/web/index.html && echo "✓ index.html"
test -f release/dist/web/manifest.json && echo "✓ manifest.json"
test -f release/dist/web/sw.js && echo "✓ sw.js"
test -f release/dist/web/assets/icon-192.png && echo "✓ icon-192.png"
```

- [ ] **Step 3：清理 + 暂存（不 commit，跟 Phase 4 后续一起）**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
rm -rf release/dist
git add release/scripts/build-assets.sh
# 不要 commit
```

---

### Task 4.2：创建 Linux .deb 模板文件

**Files:**
- Create: `release/packaging/linux/DEBIAN/control`
- Create: `release/packaging/linux/DEBIAN/postinst`
- Create: `release/packaging/linux/DEBIAN/prerm`
- Create: `release/packaging/linux/usr/bin/morse-practice`
- Create: `release/packaging/linux/usr/share/applications/morse-practice.desktop`
- Create: `release/packaging/linux/usr/share/doc/morse-practice/copyright`

- [ ] **Step 1：写 DEBIAN/control**

写入 `/home/ruo/Desktop/LYX/VibeCoding/MorsePractice/release/packaging/linux/DEBIAN/control`：

```
Package: morse-practice
Version: 0.2.0
Section: education
Priority: optional
Architecture: amd64
Depends: python3, xdg-utils
Recommends: chromium | google-chrome | firefox
Maintainer: Yuxin Luo <your-email@example.com>
Homepage: https://morsepractice.pages.dev/
Description: 摩斯密码练习器 (Morse Practice)
 一个支持字母/单词/句子三档练习、双向听打、键盘拍码的摩斯码练习工具。
 纯前端实现，可离线使用。
```

- [ ] **Step 2：写 DEBIAN/postinst（设置可执行权限）**

写入 `/home/ruo/Desktop/LYX/VibeCoding/MorsePractice/release/packaging/linux/DEBIAN/postinst`：

```bash
#!/bin/sh
set -e
chmod 755 /usr/bin/morse-practice
chmod -R a+rX /opt/morse-practice
# Update desktop database
if [ -x /usr/bin/update-desktop-database ]; then
  update-desktop-database /usr/share/applications 2>/dev/null || true
fi
exit 0
```

- [ ] **Step 3：写 DEBIAN/prerm（卸载前清理）**

写入 `/home/ruo/Desktop/LYX/VibeCoding/MorsePractice/release/packaging/linux/DEBIAN/prerm`：

```bash
#!/bin/sh
set -e
exit 0
```

- [ ] **Step 4：写 /usr/bin/morse-practice 启动脚本**

写入 `/home/ruo/Desktop/LYX/VibeCoding/MorsePractice/release/packaging/linux/usr/bin/morse-practice`：

```bash
#!/usr/bin/env bash
# Morse Practice · Linux 启动器
# 启动本地静态服务器并打开浏览器
set -e
ASSETS=/opt/morse-practice
PORT=${MORSE_PORT:-18765}
URL="http://127.0.0.1:$PORT/"

# 检查资源目录
if [ ! -d "$ASSETS" ]; then
  echo "错误：找不到资源目录 $ASSETS" >&2
  echo "请尝试重新安装本软件包" >&2
  exit 1
fi

# 启动后台服务器
cd "$ASSETS"
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null" EXIT

# 等服务器就绪
sleep 0.3

# 探测并打开浏览器
if command -v chromium >/dev/null 2>&1; then
  chromium --app="$URL" >/dev/null 2>&1 &
elif command -v google-chrome >/dev/null 2>&1; then
  google-chrome --app="$URL" >/dev/null 2>&1 &
elif command -v firefox >/dev/null 2>&1; then
  firefox --new-window "$URL" >/dev/null 2>&1 &
else
  xdg-open "$URL" >/dev/null 2>&1 &
fi

# 提示并等待
echo "Morse Practice 已启动：$URL"
echo "关闭此窗口或按 Enter 停止服务..."
read -r _
kill $SERVER_PID 2>/dev/null
```

- [ ] **Step 5：写 .desktop 文件**

写入 `/home/ruo/Desktop/LYX/VibeCoding/MorsePractice/release/packaging/linux/usr/share/applications/morse-practice.desktop`：

```ini
[Desktop Entry]
Type=Application
Name=摩斯密码练习器
Name[en]=Morse Practice
GenericName=Morse Code Practice Tool
Comment=Practice Morse code in your browser, offline
Exec=morse-practice
Icon=morse-practice
Terminal=true
Categories=Education;Languages;
StartupNotify=true
StartupWMClass=Morse Practice
```

- [ ] **Step 6：写 copyright**

写入 `/home/ruo/Desktop/LYX/VibeCoding/MorsePractice/release/packaging/linux/usr/share/doc/morse-practice/copyright`：

```
Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: morse-practice
Upstream-Contact: Yuxin Luo <your-email@example.com>
Source: https://github.com/Yuxin-Luo/MorsePractice

Files: *
Copyright: 2026 Yuxin Luo
License: MIT
 Permission is hereby granted, free of charge, to any person obtaining a
 copy of this software and associated documentation files (the "Software"),
 to deal in the Software without restriction, including without limitation
 the rights to use, copy, modify, merge, publish, distribute, sublicense,
 and/or sell copies of the Software, and to permit persons to whom the
 Software is furnished to do so, subject to the following conditions:
 .
 The above copyright notice and this permission notice shall be included
 in all copies or substantial portions of the Software.
 .
 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 DEALINGS IN THE SOFTWARE.
```

---

### Task 4.3：编写 build-linux.sh

**Files:**
- Create: `release/scripts/build-linux.sh`

- [ ] **Step 1：写脚本**

写入 `/home/ruo/Desktop/LYX/VibeCoding/MorsePractice/release/scripts/build-linux.sh`：

```bash
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
```

- [ ] **Step 2：测试构建**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
chmod +x release/scripts/build-linux.sh
bash release/scripts/build-linux.sh
# 预期：✓ Built: .../morse-practice_0.1.0_amd64.deb
ls -lh release/dist/*.deb
# 预期：~150KB 的 .deb 文件
```

- [ ] **Step 3：验证 .deb 元数据**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
dpkg-deb --info release/dist/morse-practice_*.deb
# 预期：看到 Package: morse-practice, Version: 0.1.0, Depends: python3, xdg-utils
```

- [ ] **Step 4：解压看文件树**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
mkdir -p /tmp/deb-test
dpkg-deb -x release/dist/morse-practice_*.deb /tmp/deb-test
find /tmp/deb-test -type f | head -30
# 预期：看到 /tmp/deb-test/usr/bin/morse-practice, /opt/morse-practice/index.html, /opt/morse-practice/manifest.json 等
rm -rf /tmp/deb-test
```

- [ ] **Step 5：（可选）真机安装测试**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
sudo dpkg -i release/dist/morse-practice_*.deb
# 启动测试
morse-practice &
# 应该弹出默认浏览器打开 http://127.0.0.1:18765/
# 验证：能完整加载应用、断网也能用（因为资源都在 /opt/morse-practice/）
# 卸载
sudo dpkg -r morse-practice
```

- [ ] **Step 6：清理 + 提交 Phase 4**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
rm -rf release/dist
git add release/scripts/build-assets.sh
git add release/scripts/build-linux.sh
git add release/packaging/linux/
git commit -m "feat(release): add Linux .deb packaging

- build-assets.sh: copy web source to dist/web/ with version injection
- build-linux.sh: assemble .deb tree and build via dpkg-deb
- packaging/linux/: DEBIAN control files, usr/bin launcher, .desktop,
  copyright (MIT license)
- Depends: python3, xdg-utils
- Recommends: chromium | google-chrome | firefox

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Phase 5：Android TWA

### Task 5.1：生成 Android keystore + 填 SHA-256

**Files:**
- Create（本地，不进 git）: `morse-practice.keystore`
- Modify: `.well-known/assetlinks.json`（填入真实 SHA-256）
- Modify: `.gitignore`（添加 *.keystore）

**Prerequisites:** `keytool`（JDK）已安装

- [ ] **Step 1：生成 keystore**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
# 替换 <STORE_PASS> 和 <KEY_PASS> 为强密码
keytool -genkey -v \
  -keystore morse-practice.keystore \
  -alias morse-practice \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass <STORE_PASS> -keypass <KEY_PASS> \
  -dname "CN=Yuxin Luo, OU=Personal, O=MorsePractice, L=City, S=State, C=CN"
# 预期：生成 ~2KB 的 morse-practice.keystore
ls -la morse-practice.keystore
```

- [ ] **Step 2：获取 SHA-256 指纹**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
keytool -list -v -keystore morse-practice.keystore -storepass <STORE_PASS> \
  | grep -E "SHA256:"
# 预期：输出一行类似：
#   SHA256: AB:CD:EF:...（60 字符的十六进制）
# 复制冒号分隔的指纹备用
```

- [ ] **Step 3：把 SHA-256 填到 .well-known/assetlinks.json**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
# 替换指纹（去掉冒号 + 转为大写）
FINGERPRINT="<上一步输出的指纹，去掉冒号>"
# 例如 FINGERPRINT="ABCDEF1234..."
python3 -c "
import json
with open('.well-known/assetlinks.json') as f:
    data = json.load(f)
data[0]['target']['sha256_cert_fingerprints'] = ['$FINGERPRINT']
with open('.well-known/assetlinks.json', 'w') as f:
    json.dump(data, f, indent=2)
"
cat .well-known/assetlinks.json
# 预期：sha256_cert_fingerprints 是真实指纹
```

- [ ] **Step 4：更新 .gitignore（防止 keystore 入库）**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
cat >> .gitignore << 'EOF'

# Android signing keys (NEVER commit)
*.keystore
*.keystore.b64
EOF
git diff .gitignore
# 预期：看到追加的 3 行
```

- [ ] **Step 5：base64 编码 keystore（备 GitHub Secret）**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
base64 -w 0 morse-practice.keystore > /tmp/keystore.b64
wc -c /tmp/keystore.b64
# 预期：~3KB base64 字符串
```

- [ ] **Step 6：手动配置 GitHub Secrets**

```
浏览器打开 https://github.com/Yuxin-Luo/MorsePractice/settings/secrets/actions/new
依次添加 3 个 Secret：
  1. ANDROID_KEYSTORE_BASE64 = (粘贴 /tmp/keystore.b64 内容)
  2. ANDROID_KEYSTORE_PASS   = <STORE_PASS>
  3. ANDROID_KEY_PASS        = <KEY_PASS>
```

- [ ] **Step 7：安全备份 keystore（重要！）**

```bash
# ⚠️  丢失 keystore = 无法升级已发布 APK（用户必须卸载重装）
# 备份到：1Password / Bitwarden / 加密 USB 盘
echo "请把 morse-practice.keystore 备份到密码管理器或加密位置"
ls -la morse-practice.keystore
```

- [ ] **Step 8：提交 assetlinks.json + .gitignore**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
git add .well-known/assetlinks.json .gitignore
git status --short
# 预期：M .gitignore, M .well-known/assetlinks.json
# ⚠️  确认 morse-practice.keystore 不在暂存区！
git commit -m "chore(release): add Android SHA-256 to assetlinks.json

Generated morse-practice.keystore locally and added fingerprint to
.well-known/assetlinks.json for TWA verification.

Keystore backup is the user's responsibility (see .gitignore).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5.2：创建 twa-manifest.json + build-android.sh

**Files:**
- Create: `release/packaging/android/twa-manifest.json`
- Create: `release/scripts/build-android.sh`

**Prerequisites:** Bubblewrap CLI 已装（`npm install -g @bubblewrap/cli`）

- [ ] **Step 1：写 twa-manifest.json**

写入 `/home/ruo/Desktop/LYX/VibeCoding/MorsePractice/release/packaging/android/twa-manifest.json`：

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
  "appVersion": "0.1.0",
  "versionCode": 10000
}
```

- [ ] **Step 2：写 build-android.sh**

写入 `/home/ruo/Desktop/LYX/VibeCoding/MorsePractice/release/scripts/build-android.sh`：

```bash
#!/usr/bin/env bash
# 构建 Android .apk (Bubblewrap TWA)
# 依赖：
#   - JDK 17+
#   - Bubblewrap CLI (npm install -g @bubblewrap/cli)
#   - 环境变量：KEYSTORE_FILE, KEYSTORE_PASS, KEY_PASS
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
VERSION=$(node -p "require('./package.json').version")
TWA_MANIFEST="$ROOT/release/packaging/android/twa-manifest.json"
DIST="$ROOT/release/dist"
TMP_DIR=$(mktemp -d)

# 0. 更新 version + versionCode
VERSION_CODE=$(echo "$VERSION" | awk -F. '{ printf "%d%02d%02d", $1, $2, $3 }')
TEMP_MANIFEST="$TMP_DIR/twa-manifest.json"
sed -e "s/\"appVersion\": \".*\"/\"appVersion\": \"$VERSION\"/" \
    -e "s/\"versionCode\": .*/\"versionCode\": $VERSION_CODE/" \
    "$TWA_MANIFEST" > "$TEMP_MANIFEST"

# 1. 检查 keystore 环境变量
: "${KEYSTORE_FILE:?Need KEYSTORE_FILE env var}"
: "${KEYSTORE_PASS:?Need KEYSTORE_PASS env var}"
: "${KEY_PASS:?Need KEY_PASS env var}"

# 2. 复制 keystore 到临时位置
cp "$KEYSTORE_FILE" "$TMP_DIR/keystore.jks"

# 3. 调 Bubblewrap 构建
cd "$TMP_DIR"
bubblewrap build \
  --manifest="$TEMP_MANIFEST" \
  --keystore="$TMP_DIR/keystore.jks" \
  --keystorePassword="$KEYSTORE_PASS" \
  --keyPassword="$KEY_PASS"

# 4. 移动 apk 到 dist
APK_SRC=$(find "$TMP_DIR" -name "app-release-signed.apk" -type f | head -1)
APK_NAME="morse-practice-$VERSION.apk"
cp "$APK_SRC" "$DIST/$APK_NAME"

# 5. 清理
rm -rf "$TMP_DIR"

echo ""
echo "✓ Built: $DIST/$APK_NAME"
ls -lh "$DIST/$APK_NAME"
```

- [ ] **Step 3：本地测试构建（需要 keystore + JDK + Bubblewrap）**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
chmod +x release/scripts/build-android.sh
# 用本地 keystore 测试
export KEYSTORE_FILE="$ROOT/morse-practice.keystore"
export KEYSTORE_PASS="<STORE_PASS>"
export KEY_PASS="<KEY_PASS>"

# 先跑 build-assets.sh
bash release/scripts/build-assets.sh
# 再跑 build-android.sh
bash release/scripts/build-android.sh
# 预期：✓ Built: .../morse-practice-0.1.0.apk
ls -lh release/dist/*.apk
# 预期：~50KB 的 apk 文件

# 验证 APK 类型
file release/dist/*.apk
# 预期：Zip archive data, at least v1.0 to extract
```

- [ ] **Step 4：验证 APK 内容（可选）**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
# 用 aapt 查看 APK 元数据（如果安装了 android-sdk）
aapt dump badging release/dist/morse-practice-*.apk 2>/dev/null | head -10
# 预期：package: name='com.github.yuxinluo.morsepractice'
#        application-label:'Morse Practice'
```

- [ ] **Step 5：清理 + 提交**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
rm -rf release/dist
git add release/packaging/android/twa-manifest.json
git add release/scripts/build-android.sh
git commit -m "feat(release): add Android TWA packaging (Bubblewrap)

- twa-manifest.json: TWA config targeting morsepractice.pages.dev
- build-android.sh: invoke bubblewrap build with keystore
- Package: com.github.yuxinluo.morsepractice
- Theme: #6c5ce7

Note: pages.dev subdomain uses shared signing key fallback
(custom tabs), 100% fullscreen TWA requires custom domain.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Phase 6：CI 与 Changelog

### Task 6.1：编写 cliff.toml（自动 changelog）

**Files:**
- Create: `release/cliff.toml`

- [ ] **Step 1：写 cliff.toml**

写入 `/home/ruo/Desktop/LYX/VibeCoding/MorsePractice/release/cliff.toml`：

```toml
# git-cliff ~> 1.4 configuration
# https://git-cliff.org/

[changelog]
header = """
# Changelog\n
All notable changes to this project will be documented in this file.\n
"""
body = """
{% if version -%}
    ## [{{ version }}] - {{ timestamp | date(format="%Y-%m-%d") }}
{% else -%}
    ## [Unreleased]
{% endif -%}
{% for group, commits in commits | filter(attribute="merge_commit", value=false) | group_by(attribute="group") -%}
    ### {{ group | upper_first }}
    {% for commit in commits | filter(attribute="merge_commit", value=false) | sort(attribute="message") -%}
        - {{ commit.message | split(pat="\n") | first | trim | upper_first }}
    {% endfor -%}
{% endfor %}\n
"""
trim = true
postprocessors = []

[git]
conventional_commits = true
filter_unconventional = true
filter_commits = false
topo_order = false
sort_commits = "oldest"

[commit_parsers.conv]
message = "^(?P<type>\\w+)(?:\\((?P<scope>[^)]+)\\))?:\\s(?P<subject>.+)$"
body = ".*"

[commit_parsers.squash]
message = "^squash!\\s(?P<type>\\w+)(?:\\((?P<scope>[^)]+)\\))?:\\s(?P<subject>.+)$"
body = ".*"

[commit_parsers.merge]
message = "^Merge\\sbranch\\s'([^']+)'\\sinto\\s.+$"
body = ".*"
group = "Miscellaneous"

[commit_parsers.revert]
message = "^revert:\\s(?P<type>\\w+)(?:\\((?P<scope>[^)]+)\\))?:\\s(?P<subject>.+)$"
body = ".*"
group = "Reverted"

[groups]
# 按 Conventional Commits 类型分组
commits.title = "Features"
commits.inv = "feat"
commits.field = "type"
commits.pattern = "^feat$"

fix.title = "Bug Fixes"
fix.inv = "fix"
fix.field = "type"
fix.pattern = "^fix$"

docs.title = "Documentation"
docs.inv = "docs"
docs.field = "type"
docs.pattern = "^docs$"

perf.title = "Performance"
perf.inv = "perf"
perf.field = "type"
perf.pattern = "^perf$"

refactor.title = "Refactor"
refactor.inv = "refactor"
refactor.field = "type"
refactor.pattern = "^refactor$"

style.title = "Styling"
style.inv = "style"
style.field = "type"
style.pattern = "^style$"

test.title = "Testing"
test.inv = "test"
test.field = "type"
test.pattern = "^test$"

ci.title = "Continuous Integration"
ci.inv = "ci"
ci.field = "type"
ci.pattern = "^ci$"

build.title = "Build System"
build.inv = "build"
build.field = "type"
build.pattern = "^build$"

chore.title = "Chores"
chore.inv = "chore"
chore.field = "type"
chore.pattern = "^chore$"

revert.title = "Reverted"
revert.inv = "revert"
revert.field = "type"
revert.pattern = "^revert$"

misc.title = "Miscellaneous"
misc.inv = ".*"
misc.field = "type"
misc.pattern = ".*"
```

- [ ] **Step 2：本地测试 cliff（可选，需要安装 git-cliff）**

```bash
# 如果没装：
# cargo install git-cliff
# 或：brew install git-cliff
# 或：跳过这步直接提交，CI 会跑

cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
git cliff --config release/cliff.toml --tag v0.1.0..HEAD
# 预期：看到基于已有 commit 的分组 changelog
```

- [ ] **Step 3：提交**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
git add release/cliff.toml
git commit -m "chore(release): add git-cliff config for auto-generated changelog

- Groups: Features, Bug Fixes, Documentation, Performance, Refactor,
  Styling, Testing, CI, Build, Chores, Reverted, Miscellaneous
- Parses Conventional Commits with scope and subject
- Used by .github/workflows/release.yml on tag push

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6.2：编写 GitHub Actions workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1：写 workflow**

写入 `/home/ruo/Desktop/LYX/VibeCoding/MorsePractice/.github/workflows/release.yml`：

```yaml
name: Release

on:
  push:
    tags: ['v*.*.*']

permissions:
  contents: write

jobs:
  # 1. 共享：构建 web 资源（上传给下游 4 个 job）
  build-assets:
    name: Build web assets
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - name: Build web assets
        run: bash release/scripts/build-assets.sh
      - uses: actions/upload-artifact@v4
        with:
          name: web-assets
          path: release/dist/web/
          retention-days: 1

  # 2. Linux .deb
  build-linux:
    name: Build Linux .deb
    needs: build-assets
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: web-assets
          path: release/dist/web
      - name: Build .deb
        run: bash release/scripts/build-linux.sh
      - uses: actions/upload-artifact@v4
        with:
          name: morse-practice-linux-deb
          path: release/dist/*.deb

  # 3. Windows .exe
  build-windows:
    name: Build Windows .exe
    needs: build-assets
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: web-assets
          path: release/dist/web
      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'
      - name: Build .exe
        run: bash release/scripts/build-windows.sh
      - uses: actions/upload-artifact@v4
        with:
          name: morse-practice-windows-exe
          path: release/dist/*.exe

  # 4. Android .apk
  build-android:
    name: Build Android .apk
    needs: build-assets
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: web-assets
          path: release/dist/web
      - uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
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

  # 5. 收集产物 + 创建 Release
  release:
    name: Create GitHub Release
    needs: [build-linux, build-windows, build-android]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: release/dist/
          pattern: morse-practice-*
          merge-multiple: true
      - name: Generate changelog
        id: cliff
        uses: orhunp/git-cliff-action@v3
        with:
          config: release/cliff.toml
          args: --verbose
      - name: Create release
        uses: softprops/action-gh-release@v2
        with:
          name: ${{ github.ref_name }}
          body: ${{ steps.cliff.outputs.content }}
          files: |
            release/dist/*.deb
            release/dist/*.exe
            release/dist/*.apk
          draft: false
          prerelease: ${{ contains(github.ref_name, '-rc') }}
          fail_on_unmatched_files: true
```

- [ ] **Step 2：YAML 语法验证**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
python3 -c "
import yaml
with open('.github/workflows/release.yml') as f:
    yaml.safe_load(f)
print('✓ YAML valid')
"
# 预期：✓ YAML valid
```

- [ ] **Step 3：暂存（不立即 commit，先本地测试 Phase 7 一起）**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
git add .github/workflows/release.yml
# 不要 commit
```

---

## Phase 7：本地端到端干跑 + 首次发布

### Task 7.1：本地一键构建（验证所有脚本串起来）

**Files:** 不涉及新文件（仅验证）

- [ ] **Step 1：跑完整本地构建**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
rm -rf release/dist
echo "=== 1. build-assets ==="
bash release/scripts/build-assets.sh
echo ""
echo "=== 2. build-linux ==="
bash release/scripts/build-linux.sh
echo ""
echo "=== 3. build-windows ==="
bash release/scripts/build-windows.sh
echo ""
echo "=== 4. build-android (需要 keystore 环境变量) ==="
export KEYSTORE_FILE="$PWD/morse-practice.keystore"
export KEYSTORE_PASS="<STORE_PASS>"
export KEY_PASS="<KEY_PASS>"
bash release/scripts/build-android.sh
echo ""
echo "=== 产物清单 ==="
ls -lh release/dist/
# 预期：看到 morse-practice-0.1.0.{deb,exe,apk} 三个文件
```

- [ ] **Step 2：跑全部测试**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
npm test
# 预期：所有测试通过（80+ 原有 + PWA 资源完整性）
```

- [ ] **Step 3：本地装一个 .deb 试一下**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
sudo dpkg -i release/dist/morse-practice_*.deb
morse-practice &
# 浏览器应该弹出 → 验证功能
# 关闭终端 / Ctrl+C 停止
# 卸载
sudo dpkg -r morse-practice
```

- [ ] **Step 4：清理 + 提交 CI workflow**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
rm -rf release/dist
git status --short
# 预期：M .gitignore, A .github/workflows/release.yml
#       + 之前的暂存文件（如果有）
git add .gitignore .github/workflows/release.yml
git diff --cached --stat
git commit -m "ci: add release workflow for .exe/.apk/.deb on tag push

- 5 jobs: build-assets → (linux | windows | android) → release
- Auto-generate changelog via git-cliff (release/cliff.toml)
- Upload artifacts to GitHub Release on tag push
- Android signed via GitHub Secrets (ANDROID_KEYSTORE_*)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7.2：推 RC tag 做端到端测试

**Files:** 不涉及新文件

**Prerequisites:** Phase 7.1 已成功；GitHub Secrets 已配

- [ ] **Step 1：先合并到 main（如不在 main）**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
git branch
# 预期：* main
# 如果不是，先合并：git checkout main && git merge --no-ff <your-branch>
```

- [ ] **Step 2：打 RC tag**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
git tag v0.2.0-rc.1
git push origin v0.2.0-rc.1
# 预期：GitHub Actions 自动触发
```

- [ ] **Step 3：观察 Actions 跑完**

```bash
# 浏览器打开 https://github.com/Yuxin-Luo/MorsePractice/actions
# 等 5 个 job 全部绿色（约 5-10 分钟）
# 验证：
#   - build-assets 通过
#   - build-linux 产物 .deb
#   - build-windows 产物 .exe
#   - build-android 产物 .apk
#   - release 创建了 v0.2.0-rc.1（pre-release 标识）
#     并附带 changelog + 3 个资产
```

- [ ] **Step 4：下载 RC 产物本地验证**

```bash
# 在浏览器 Release 页面下载 3 个文件：
#   - morse-practice_0.2.0-rc.1_amd64.deb
#   - Morse-Practice-0.2.0-rc.1.exe
#   - morse-practice-0.2.0-rc.1.apk
# 验证：
#   - .deb 安装 → 启动 → 正常
#   - .exe 在 Windows 上双击 → 启动 → 正常
#   - .apk 通过 adb install 上 Android 设备 → 启动 → 正常
```

- [ ] **Step 5：RC OK 后打正式 tag**

```bash
cd /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
git tag -d v0.2.0-rc.1
git push origin :refs/tags/v0.2.0-rc.1
# 可选：删除 GitHub 上的 RC release
# gh release delete v0.2.0-rc.1 --yes

# 升级 package.json version 到 0.2.0
node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('package.json')); p.version='0.2.0'; fs.writeFileSync('package.json', JSON.stringify(p, null, 2)+'\n');"

# 提交版本号 bump
git add package.json
git commit -m "chore(release): bump version to 0.2.0"

# 打正式 tag
git tag v0.2.0
git push origin main v0.2.0
# 预期：触发正式 release
```

- [ ] **Step 6：浏览器验证正式 release**

```
打开 https://github.com/Yuxin-Luo/MorsePractice/releases
→ 应该看到 v0.2.0 release（非 pre-release）
→ 3 个资产可下载
→ changelog 自动生成
```

---

## 附录 A：故障排查

| 症状 | 原因 | 解决 |
|------|------|------|
| `sw.js` 注册失败 | HTTPS 未启用 / 路径不对 | 部署到 Cloudflare Pages（自动 HTTPS）|
| TWA 启动后是 Custom Tab | `pages.dev` 子域无严格 DAL | 绑自定义域；或接受现状 |
| `dpkg-deb` 报权限错误 | DEBIAN 脚本无可执行权限 | `chmod 755 postinst prerm` |
| Go 交叉编译失败 | 缺 `gcc-mingw-w64` | `sudo apt install gcc-mingw-w64` |
| Bubblewrap 报 Java 版本错 | JDK < 17 | 安装 JDK 17（`apt install openjdk-17-jdk`）|
| GitHub Actions 跳过 release | `permissions` 没声明 | workflow 顶部加 `permissions: contents: write` |
| changelog 是空的 | commit 不符合 Conventional Commits | 用 `feat:` / `fix:` 前缀重写 commit message |
| `keytool` 找不到 | JDK 未装 | `apt install default-jre` |

---

## 附录 B：未来改进（已知限制）

- Android 绑自定义域以获得 100% TWA 全屏
- Windows 启动器加系统托盘 Quit 按钮
- Linux 启动器改为 systemd user service
- 加 macOS .dmg / .app（用 Tauri 跨平台扩展）
- 申请代码签名证书消除 SmartScreen 警告
- Service Worker 加版本探测 + 提示用户刷新

---

## 总览

- **任务数**：22 个（不含 Phase 0 的环境检查）
- **预计 commit 数**：8-10 个
- **预计时间**：第一次完整跑通 2-3 小时（含手动测试和 keystore 设置）
- **首次发版 target**：v0.2.0
