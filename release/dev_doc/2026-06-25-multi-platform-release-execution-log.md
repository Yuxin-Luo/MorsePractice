# 多平台发布执行日志（2026-06-25）

> 本文档记录 2026-06-25 当天执行 `2026-06-25-multi-platform-release-plan.md` 的完整过程。
> 配套文档：
> - 设计稿：`2026-06-25-multi-platform-release-design.md`
> - 计划：`2026-06-25-multi-platform-release-plan.md`
> - 进展/待办：`2026-06-25-multi-platform-release-continuation.md`

执行方式：superpowers:executing-plans（串行 + checkpoint），按 Phase 0 → 7 顺序跑。

---

## 全局约束（来自 plan）

- 业务代码不引入打包器/构建工具 — **零构建哲学延续**
- 所有发布相关代码放 `release/` 目录
- GitHub 仓库：`git@github.com:Yuxin-Luo/MorsePractice.git`
- 线上域名：`morsepractice.pages.dev`
- 主题色：`#6c5ce7`，背景色：`#f7f8fc`
- Android 包名：`com.github.yuxinluo.morsepractice`
- 所有提交遵循 Conventional Commits

---

## Phase 0 — 环境准备

### 完成项

1. **工具链检查**：git / node / npm / python3 / keytool / dpkg-deb / PIL 全部就绪
2. **安装缺失工具**：
   - Go 1.22.10（无 sudo，下载 `go1.22.10.linux-amd64.tar.gz` 到 `~/.local/go/`）
   - Bubblewrap CLI 1.24.1（`npm install -g @bubblewrap/cli`，耗时 5 分钟）
3. **创建 release/ 骨架**：`{assets, cmd, packaging/linux/DEBIAN, packaging/android, scripts, dev_doc}` 6 个子目录
4. **提交 plan 文件 + preview.html**

### 关键命令

```bash
# Go 安装（无 sudo 方案）
mkdir -p $HOME/.local/go
curl -kfsSL -o /tmp/go.tar.gz "https://golang.google.cn/dl/go1.22.10.linux-amd64.tar.gz"
tar -C $HOME/.local -xzf /tmp/go.tar.gz
echo 'export PATH=$HOME/.local/go/bin:$PATH' >> ~/.bashrc

# Bubblewrap 安装（npm global，耗时 5min）
npm install -g @bubblewrap/cli

# Skeleton
mkdir -p release/{assets,cmd/windows-launcher,packaging/linux/DEBIAN,packaging/android,scripts,dev_doc}
```

### Commit

- `dd27084` — `chore(release): scaffold release/ directory structure`

### 备注

- 用户偏好：Go / Bubblewrap 现在一起装好，不阻塞后续 Phase
- 用户偏好：dev_doc/ 一起 commit 进 git（与上次设计稿 commit 388bb70 一致）
- 用户偏好：commit 节奏按 plan 原文（约 8 个 commits），不强行每个 Task 都 commit
- 用户偏好：Phase 7.2 前停下来，等手动 push tag

---

## Phase 1 — 站点 PWA 改造

### 完成项

1. **创建 `manifest.json`** — PWA app metadata（name / short_name / display=standalone / theme_color / icons 3 个）
2. **创建 `sw.js`** — Service Worker（CACHE_VERSION=morse-cache-v1，PRECACHE 21 个 URL）
3. **创建 `.well-known/assetlinks.json`** — TWA 数字资产关联（SHA-256 占位符）
4. **修改 `index.html`**：
   - 删除 3 个 no-cache meta（`Cache-Control` / `Pragma` / `Expires`）
   - 在 `</head>` 前加 PWA 标签（manifest link / theme-color / apple-touch-icon / SW 注册脚本）
5. **写 `tests/pwa-manifest.test.js`** — vitest 9 个测试（manifest 字段 / icon 存在 / SW PRECACHE 完整性 / assetlinks 字段）

### 关键决策

- **暂存不 commit**：PRECACHE 引用了 `/assets/icon-*.png` 但图标还没生成；assetlinks.json 是 SHA-256 占位符。等 Phase 2 图标生成 + 真实 SHA-256 一起 commit。

### TDD 红 → 绿

- Step 2 测试运行：2 fail（icon-related）/ 7 pass — **符合预期红态**

### 验证

```bash
python3 -c "import json; json.load(open('manifest.json')); print('✓ JSON valid')"
node --check sw.js && echo "✓ sw.js syntax OK"
python3 -c "import json; json.load(open('.well-known/assetlinks.json')); print('✓ JSON valid')"
# 启动 dev-server.py 8765 验证 manifest.json + sw.js 返回 200
```

### 备注

- 浏览器手动验证（Application → Manifest 区域）跳过：环境无 GUI 浏览器交互能力

---

## Phase 2 — 图标生成

### 完成项

1. **写 `release/scripts/test_build_icons.py`** — 4 个 icon 尺寸 + maskable 主题色像素验证
2. **写 `release/scripts/build-icons.py`** — 从 `FrontImages/icon.png`（628×625）中心裁剪 + 缩放
3. **生成 4 个 PNG 到 `release/assets/`**：
   - `icon-192.png` (43.7 KB)
   - `icon-256.png` (78.9 KB)
   - `icon-512.png` (312 KB)
   - `icon-maskable-512.png` (213 KB)
4. **同步到根目录 `assets/`** — 供 Service Worker PRECACHE 引用
5. **PWA 测试从 7 pass / 2 fail → 9 pass** ✅
6. **完整测试套件**：174/174 通过 ✅

### TDD 红 → 绿

- Step 2 测试运行：`✗ build-icons.py exists at ...` — 红
- Step 4 测试运行：16 个断言全过 — 绿

### Commit

- `8f76090` — `feat(pwa): add manifest, service worker, and app icons`

---

## Phase 3 — Windows 启动器（Go）

### 完成项

1. **写 `release/cmd/windows-launcher/main_test.go`** — TestPickPort + TestBuildURL
2. **`go mod init release/cmd/windows-launcher`** — Go 1.22 module
3. **写 `release/cmd/windows-launcher/main.go`**：
   - `//go:embed all:dist` 嵌入 web 资源
   - HTTP server on 127.0.0.1:0（自动分配端口）
   - 跨平台打开浏览器（windows: rundll32 / darwin: open / linux: xdg-open）
4. **写 `release/scripts/build-windows.sh`** — 交叉编译脚本
5. **本地交叉编译验证**：`GOOS=windows GOARCH=amd64 go build` → `Morse-Practice-0.1.0.exe` (7.8 MB PE32+ GUI x86-64)
6. **`go test ./...`** ✅

### 计划偏差（已修正）

1. **`//go:embed all:dist` 不跟随 symlink**
   - plan 原文用 `ln -sf "$DIST" "$LAUNCHER/dist"`
   - 实际：`pattern all:dist: cannot embed irregular file dist`
   - 修正：`rm -f dist && cp -r ../../dist dist`（真实 copy）
2. **PATH 不含 `~/.local/go/bin`**
   - 加 `export PATH="$HOME/.local/go/bin:$PATH"` 到 build-windows.sh 顶部
3. **`cd ../../../..` 路径错误**（我的初次尝试）
   - 修正：去掉 cd，节点在 launcher 目录直接跑 go build

### Commit

- `9ce5ba1` — `feat(release): add Windows launcher (Go + embed.FS)`

---

## Phase 4 — 资源构建 + Linux 打包

### 完成项

1. **写 `release/scripts/build-assets.sh`** — 复制 web 资源 + 注入版本号
2. **写 6 个 Linux 模板文件**：
   - `DEBIAN/control`（Package / Version / Section / Depends / Recommends / Description）
   - `DEBIAN/postinst`（chmod + update-desktop-database）
   - `DEBIAN/prerm`（空操作）
   - `usr/bin/morse-practice`（bash 启动器：python3 -m http.server + 浏览器探测）
   - `usr/share/applications/morse-practice.desktop`（Categories=Education;Languages）
   - `usr/share/doc/morse-practice/copyright`（MIT license）
3. **写 `release/scripts/build-linux.sh`** — dpkg-deb 构建
4. **本地构建验证**：`bash build-linux.sh` → 670K `morse-practice_0.1.0_amd64.deb`
5. **dpkg-deb --info 验证**：Package / Version / Depends / Recommends 全部正确
6. **解包验证**：27 个文件落到 `/usr/bin/` / `/opt/morse-practice/` / `/usr/share/...`

### 计划偏差（已修正）

1. **control 文件末尾缺 `\n`**
   - dpkg-deb 错误：`在字段 Description 的值中间发有 EOF 字符`
   - 修正：`echo "" >> release/packaging/linux/DEBIAN/control`
2. **`build-assets.sh` 的 sed 假定 manifest 有 version 字段**
   - 我们的 manifest.json 没有 version → sed no-op
   - 修正：往 manifest.json 加 `"version": "0.1.0"` 字段

### Commit

- `6663220` — `feat(release): add Linux .deb packaging`

---

## Phase 5 — Android TWA

### Phase 5.1：生成 keystore + 填 SHA-256

1. **生成随机 32 字符密码**（`secrets.choice` 选 ascii_letters+digits）
2. **`keytool -genkey`** 生成 `morse-practice.keystore` (2776 bytes, RSA 2048, 10000 天)
3. **提取 SHA-256**：`6F71A59E042C2376697C6AF89FD21802E2FCA613D48DAE9566A01C3BAE433919`
4. **写入 `.well-known/assetlinks.json`**
5. **`cat >> .gitignore`** 加 `*.keystore` / `*.keystore.b64`

### 用户请求（中途新增）

> "请在当前路径新建一个 mykEY 文件夹，专门用于存放密钥等隐私信息并添加 git-ignore"

**执行：**
- 创建 `mykEY/` 目录
- 移动 `morse-practice.keystore` → `mykEY/`
- 保存密码到 `mykEY/password.txt`
- base64 编码到 `mykEY/keystore.b64`
- `cat >> .gitignore` 加 `mykEY/`

### Phase 5.2：twa-manifest + build-android.sh

1. **写 `release/packaging/android/twa-manifest.json`** — packageId / host / themeColor / iconUrl / webManifestUrl / fallbackType=customtabs / versionCode=10000
2. **写 `release/scripts/build-android.sh`** — 调 bubblewrap build
3. **`build-android.sh` 调整**：
   - 默认 `KEYSTORE_FILE` 指向 `mykEY/morse-practice.keystore`
   - 加 `export PATH="$HOME/.local/go/bin:$PATH"`（与其他脚本一致）
   - 加 `JAVA_HOME` 环境变量支持

### 已知缺口（plan 偏差）

**本地 APK 构建未验证**：
- `bubblewrap build` 需要 JDK + Android SDK
- 本地只有 JDK 21，Bubblewrap 硬要 JDK 17
- 通过写 `~/.bubblewrap/config.json` 的 `jdkPath` 跳过安装提示
- `sdkmanager` 反复 IO 错误拉 manifest（网络问题）
- 尝试手动下载 platform-tools.zip → 部分成功但未继续（build-tools + platforms 还要更多下载）
- **决策**：跳过本地 APK 验证，依赖 CI workflow 显式装 Android SDK

### 计划偏差（已修正）

1. **keystore 位置**：`./` → `mykEY/`
2. **JDK 21 vs 17**：`~/.bubblewrap/config.json` 预填 jdkPath 跳过 Bubblewrap 的 JDK 下载提示

### Commit

- `8b331a8` — `chore(release): add Android SHA-256 to assetlinks.json`
- `cff03f3` — `feat(release): add Android TWA packaging (Bubblewrap)`

---

## Phase 6 — CI 与 Changelog

### Phase 6.1：cliff.toml

写 `release/cliff.toml` — git-cliff ~> 1.4 配置，按 Conventional Commits 类型分组（Features / Bug Fixes / Documentation / Performance / Refactor / Styling / Testing / CI / Build / Chores / Reverted / Miscellaneous）。

`git-cliff` 本地未安装（`cargo install` 需要额外时间），跳过本地 dry-run。

### Commit

- `729f775` — `chore(release): add git-cliff config for auto-generated changelog`

### Phase 6.2：release.yml workflow

写 `.github/workflows/release.yml`，5 个 jobs：
1. `build-assets` — 跑 build-assets.sh + 上传 web-assets artifact
2. `build-linux` — 下载 web-assets + 跑 build-linux.sh + 上传 .deb
3. `build-windows` — 同上 + `actions/setup-go@v5` + 跑 build-windows.sh + 上传 .exe
4. `build-android` — 同上 + `actions/setup-java@v4` (JDK 17) + `npm install -g @bubblewrap/cli` + `android-actions/setup-android@v3` + 从 secret 解码 keystore + 跑 build-android.sh + 上传 .apk
5. `release` — 下载所有 artifacts + 调 orhunp/git-cliff-action@v3 生成 changelog + 调 softprops/action-gh-release@v2 上传

**关键配置**：
- `permissions: contents: write`（避免默认只读）
- `prerelease: ${{ contains(github.ref_name, '-rc') }}`（自动识别 RC tag）
- `JAVA_HOME: ${{ env.JAVA_HOME }}`（注入到 build-android.sh）

### 用户请求（中途新增）

> "mykEY 文件夹内记得补充一个 readme 文档方便后来者看懂并使用"

**执行：**
- 写 `mykEY/README.md` — 详细说明 mykEY/ 目录的文件清单、备份清单、重新生成步骤、GitHub Secrets 配置、本地构建示例、安全检查清单
- 修正 `.gitignore`：`mykEY/*` + `!mykEY/README.md`（让 README 入库，但 keystore/password 仍被忽略）
  - 第一次尝试用 `mykEY/` + `!mykEY/README.md` 不工作（父目录忽略会 catch 所有）
  - 修正：`mykEY/*`（只忽略内容）+ `!mykEY/README.md`（README 例外）

### YAML 验证

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml')); print('✓ YAML valid')"
```

✅ 通过

### 阶段产物（暂存到 Phase 7.1 commit）

- `.github/workflows/release.yml`
- `.gitignore` 修正（mykEY/* + !mykEY/README.md）
- `mykEY/README.md`

---

## Phase 7 — 本地 E2E + 首次发布

### Phase 7.1：本地一键构建

**跑完整流水线（除 Android）：**

```bash
rm -rf release/dist
bash release/scripts/build-assets.sh  # ✅ 25 个文件落到 dist/web/
bash release/scripts/build-linux.sh    # ✅ 670K morse-practice_0.1.0_amd64.deb
bash release/scripts/build-windows.sh  # ✅ 7.8M Morse-Practice-0.1.0.exe
# bash release/scripts/build-android.sh  # SKIP - 本地 SDK 拉不下来
```

**完整测试：**

```bash
npx vitest run
# ✅ 174/174 passed (11 files)
```

**清理 + commit：**

```bash
rm -rf release/dist
git add .github/workflows/release.yml .gitignore mykEY/README.md
git commit -m "ci: add release workflow for .exe/.apk/.deb on tag push"
```

### Commit

- `0c3deb2` — `ci: add release workflow for .exe/.apk/.deb on tag push`

### Phase 7.2：推 RC tag（用户手动）

按用户偏好，**不在 Claude 端自动 push**。详见 `2026-06-25-multi-platform-release-continuation.md`。

---

## 全局统计

| Phase | Task 数 | Commit 数 | 关键产物 |
|-------|---------|-----------|---------|
| 0 | 1 | 1 | release/ 骨架 |
| 1 | 5 | (暂存) | manifest.json / sw.js / assetlinks.json / index.html |
| 2 | 1 | 1 (合并 1+2) | 4 个图标 + build-icons.py |
| 3 | 2 | 1 | Go 启动器 + build-windows.sh |
| 4 | 3 | 1 | build-assets.sh + build-linux.sh + 6 个 .deb 模板 |
| 5 | 2 | 2 | keystore + assetlinks SHA-256 + twa-manifest + build-android.sh |
| 6 | 2 | 2 (cliff + ci) | cliff.toml + release.yml |
| 7 | 2 | 1 (ci workflow) | 验证 + workflow commit |
| **总计** | **18** | **8** | |

---

## 经验教训 / 备忘

1. **Go embed 不跟随 symlink** — build 脚本要 cp 而非 ln
2. **dpkg-deb control 末尾要 \n** — 编辑器自动 trim 末尾换行会触发 EOF 错误
3. **sed 假定字段存在** — build-assets.sh 的 sed 对不存在的字段是 no-op，要先加字段
4. **Bubblewrap 强交互** — `~/.bubblewrap/config.json` 预填 jdkPath 是非交互使用的关键
5. **CI 显式装 SDK** — 本地 sdkmanager 网络不稳时，CI ubuntu-latest 更可靠
6. **mykEY/* 模式** — gitignore 的目录忽略 + 子文件例外的正确写法
7. **commit 节奏** — plan 写 "暂存不 commit" 是有意为之（TDD 节奏 + 关联提交），不要强行每个 Task commit