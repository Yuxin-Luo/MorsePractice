# 多平台发布 — 当前进展 + 后续步骤（2026-06-25）

> 本文档说明**当前状态**和**下一步用户操作**。
> 配套文档：
> - 执行日志：`2026-06-25-multi-platform-release-execution-log.md`
> - 设计稿：`2026-06-25-multi-platform-release-design.md`
> - 计划：`2026-06-25-multi-platform-release-plan.md`
> - **CI Debug 日志**：`2026-06-25-ci-debug-log.md` ← **部署踩坑实录，活文档**
> - 人工清单：`2026-06-25-action-checklist.md`

---

## 📊 当前状态（2026-06-25 11:08）

| 项 | 状态 |
|----|------|
| 分支 | `main` |
| 待推 commits | **8 个**（`dd27084` → `0c3deb2`） |
| 本地构建（Linux/Windows） | ✅ 验证通过 |
| 本地构建（Android） | ❌ 未验证（依赖 CI） |
| 测试套件 | ✅ 174/174 通过 |
| GitHub Secrets | ⏳ **待用户配置** |
| Tag 推送 | ⏳ **待用户操作** |
| GitHub Actions 首次跑 | ⏳ **待 tag 推送触发** |

---

## ✅ 已完成（commit 在 main，未推送 origin）

### Commit 列表

| Hash | 消息 |
|------|------|
| `dd27084` | chore(release): scaffold release/ directory structure |
| `8f76090` | feat(pwa): add manifest, service worker, and app icons |
| `9ce5ba1` | feat(release): add Windows launcher (Go + embed.FS) |
| `6663220` | feat(release): add Linux .deb packaging |
| `8b331a8` | chore(release): add Android SHA-256 to assetlinks.json |
| `cff03f3` | feat(release): add Android TWA packaging (Bubblewrap) |
| `729f775` | chore(release): add git-cliff config for auto-generated changelog |
| `0c3deb2` | ci: add release workflow for .exe/.apk/.deb on tag push |

### 已验证产物（本地构建）

| 平台 | 文件 | 大小 |
|------|------|------|
| Linux | `release/dist/morse-practice_0.1.0_amd64.deb` | 670 KB |
| Windows | `release/dist/Morse-Practice-0.1.0.exe` | 7.8 MB |
| Android | — | CI only |

---

## ⏳ 用户操作清单（按顺序执行）

### Step 1: 备份 keystore 凭据（**重要，不可逆**）

`mykEY/password.txt` 和 `mykEY/morse-practice.keystore` 都是 gitignored，**丢了这 2 个文件 = 永远无法升级已发布的 APK**。

```bash
# 密码
cat mykEY/password.txt
# → NEoITxs5hVbfOj0IpWq90DzfGS1ZlncV

# keystore
ls -la mykEY/morse-practice.keystore
# → 2776 bytes
```

**备份到 1Password / Bitwarden / 加密 USB**。

### Step 2: 配置 GitHub Secrets

打开 https://github.com/Yuxin-Luo/MorsePractice/settings/secrets/actions/new，添加 3 个 Secret：

| Secret Name | Value |
|-------------|-------|
| `ANDROID_KEYSTORE_BASE64` | `cat mykEY/keystore.b64` 的全部内容（3704 字符） |
| `ANDROID_KEYSTORE_PASS` | `cat mykEY/password.txt` = `NEoITxs5hVbfOj0IpWq90DzfGS1ZlncV` |
| `ANDROID_KEY_PASS` | 同上 |

### Step 3: 推送 commits 到 origin

```bash
cd ~/Desktop/LYX/VibeCoding/MorsePractice
git push origin main
```

### Step 4: 打 RC tag 并 push（触发 GitHub Actions）

```bash
git tag v0.2.0-rc.1
git push origin v0.2.0-rc.1
```

### Step 5: 观察 GitHub Actions

打开 https://github.com/Yuxin-Luo/MorsePractice/actions

预期 5 个 jobs：
1. **build-assets** (~30s) — 跑 build-assets.sh + 上传 web-assets artifact
2. **build-linux** (~1min) — 下载 web-assets + 跑 build-linux.sh + 上传 .deb
3. **build-windows** (~3min) — 同上 + 交叉编译 Go
4. **build-android** (~5min) — 同上 + 装 Bubblewrap + 装 Android SDK + 构建 APK
5. **release** (~30s) — 下载所有 + 调 git-cliff 生成 changelog + 创建 GitHub Release

预计总时长：**5-10 分钟**。

### Step 6: 验证 RC 产物

打开 https://github.com/Yuxin-Luo/MorsePractice/releases/tag/v0.2.0-rc.1，下载 3 个资产：

| 文件 | 验证方法 |
|------|---------|
| `morse-practice_0.2.0-rc.1_amd64.deb` | `sudo dpkg -i *.deb && morse-practice` |
| `Morse-Practice-0.2.0-rc.1.exe` | Windows 双击 |
| `morse-practice-0.2.0-rc.1.apk` | Android `adb install` |

### Step 7: RC OK → 推正式 tag

```bash
# 删 RC tag
git tag -d v0.2.0-rc.1
git push origin :refs/tags/v0.2.0-rc.1
# 可选：gh release delete v0.2.0-rc.1 --yes

# 升级版本号
node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('package.json')); p.version='0.2.0'; fs.writeFileSync('package.json', JSON.stringify(p, null, 2)+'\n');"

git add package.json
git commit -m "chore(release): bump version to 0.2.0"
git push origin main

# 打正式 tag
git tag v0.2.0
git push origin v0.2.0
```

### Step 8: 验证正式 release

打开 https://github.com/Yuxin-Luo/MorsePractice/releases：

- 应该看到 v0.2.0 release（**非 pre-release**）
- 3 个资产可下载（`.deb` / `.exe` / `.apk`）
- changelog 自动生成（按 Conventional Commits 分组）

---

## ⚠️ 已知风险 / 缺口

### 1. 本地 APK 构建未验证

- 原因：本地 `sdkmanager` 反复 IO 错误拉不下 manifest
- 影响：无法本地 smoke test APK
- 缓解：CI workflow 的 `build-android` job 显式装 `android-actions/setup-android@v3`

**如果 CI 也失败**，参考下方故障排查表。

### 2. Pages.dev 子域的 TWA 限制

- `morsepractice.pages.dev` 是 Cloudflare Pages 共享子域
- 数字资产链接（DAL）无法对 shared domain 严格验证
- APK 会 fallback 到 **Custom Tabs**（不是 100% 全屏 TWA）
- 100% 全屏 TWA 需要绑自定义域（如 `morse.yuxinluo.com`）

### 3. macOS / 其他 Linux 架构

- 当前 `.deb` 只支持 `amd64`（DEBIAN/control 的 Architecture: amd64）
- macOS / ARM64 Linux 用户无法用 .deb 安装
- 后续可加 `.dmg` / `arm64.deb`（plan 附录 B）

### 4. 代码签名

- Windows .exe 没有 EV 代码签名证书 → 用户首次运行会有 SmartScreen 警告
- 申请 EV 证书需要 ~$200-400/年 + 身份验证
- 短期方案：建议用户在 SmartScreen 点 "更多信息 → 仍要运行"

---

## 🛟 故障排查（plan 附录 A 摘要）

| 症状 | 原因 | 解决 |
|------|------|------|
| `sw.js` 注册失败 | HTTPS 未启用 / 路径不对 | 已部署到 Cloudflare Pages（自动 HTTPS） |
| TWA 启动是 Custom Tab | `pages.dev` 无严格 DAL | 绑自定义域；或接受现状 |
| `dpkg-deb` 权限错误 | DEBIAN 脚本无 +x | `chmod 755 postinst prerm` |
| Go 交叉编译失败 | 缺 `gcc-mingw-w64` | CI ubuntu-latest 已有 |
| Bubblewrap Java 错 | JDK < 17 | CI 用 JDK 17 |
| Actions 跳过 release | `permissions` 没声明 | workflow 顶部已有 `contents: write` |
| changelog 是空 | commit 不符合 Conventional Commits | 用 `feat:` / `fix:` 前缀重写 commit |
| `keytool` 找不到 | JDK 未装 | `apt install default-jre` |
| `sdkmanager` IO 错误 | 网络问题 / repo 拉不下 | CI 用 `android-actions/setup-android@v3` |

---

## 🔮 后续改进（plan 附录 B）

- [ ] Android 绑自定义域以获得 100% TWA 全屏
- [ ] Windows 启动器加系统托盘 Quit 按钮
- [ ] Linux 启动器改为 systemd user service
- [ ] 加 macOS .dmg / .app（用 Tauri 跨平台扩展）
- [ ] 申请代码签名证书消除 SmartScreen 警告
- [ ] Service Worker 加版本探测 + 提示用户刷新

---

## 📁 关键文件位置

```
repo/
├── .github/workflows/release.yml        # CI 配置
├── .well-known/assetlinks.json          # TWA 数字资产关联
├── manifest.json / sw.js                # PWA
├── index.html                           # 已加 PWA 标签
├── assets/icon-*.png                    # 4 个图标（根）
├── mykEY/                               # 🔐 gitignored
│   ├── README.md                        # 公开文档（committed）
│   ├── morse-practice.keystore          # 🔒 需备份
│   ├── password.txt                     # 🔒 需备份
│   └── keystore.b64                     # 给 GitHub Secrets 用
├── release/
│   ├── assets/icon-*.png                # 4 个图标
│   ├── cliff.toml                       # git-cliff 配置
│   ├── cmd/windows-launcher/            # Go 启动器
│   ├── packaging/
│   │   ├── android/twa-manifest.json
│   │   └── linux/{DEBIAN,usr/}
│   ├── scripts/
│   │   ├── build-assets.sh
│   │   ├── build-windows.sh
│   │   ├── build-linux.sh
│   │   └── build-android.sh
│   └── dev_doc/
│       ├── 2026-06-25-multi-platform-release-design.md
│       ├── 2026-06-25-multi-platform-release-plan.md
│       ├── 2026-06-25-multi-platform-release-execution-log.md
│       └── 2026-06-25-multi-platform-release-continuation.md  ← 本文档
└── tests/pwa-manifest.test.js           # vitest 资源完整性
```

---

## 🎯 成功标准

完成本计划 = 用户能：

1. ✅ 打开 https://morsepractice.pages.dev（Web 版）
2. ⏳ 在 https://github.com/Yuxin-Luo/MorsePractice/releases 下载 v0.2.0
3. ⏳ Linux：`sudo dpkg -i *.deb && morse-practice` → 弹出浏览器 → 离线使用
4. ⏳ Windows：双击 .exe → 启动本地服务器 → 浏览器打开 → 离线使用
5. ⏳ Android：安装 APK → 启动应用 → 通过 TWA 显示站点（Custom Tabs 模式）
6. ⏳ 后续每次 `git tag v*.*.* && git push --tags` 触发自动 release

**完成度：~80%（本地部分全部完成，远程发布待用户操作）**

---

**回到 Claude 时**，如有 Actions 失败 / RC 验证问题 / 任何疑问，把日志或错误信息贴回来，我能直接基于现有 8 个 commits debug。