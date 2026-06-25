# MorsePractice 项目交接指南（2026-06-25）

> **本文件是 MorsePractice 项目的"硬约束 + 关键状态 + 踩坑历史"全集**。
> 原本分散在 `CLAUDE.md` + `release/dev_doc/` 多处，本文档把它们整合到一起，
> 方便下个会话 / 接手 agent 30 秒内找到全部信息。
>
> **配套文档**（按读序）：
>
> | # | 文档 | 用途 |
> |---|------|------|
> | 1 | 本文档 | 交接指南（项目事实 + 硬约束 + 当前阻塞） |
> | 2 | `2026-06-26-local-build-strategy.md` | **思路**（why / what / trade-off） |
> | 3 | `2026-06-25-action-checklist.md` | 端到端操作清单（v2，本地版） |
> | 4 | `2026-06-25-local-android-build-guide.md` | Android 步骤级 |
> | 5 | `2026-06-25-ci-debug-log.md` | 10 轮踩坑历史（**别重踩**） |
>
> 其他参考资料：
> - `2026-06-25-multi-platform-release-design.md`（设计稿）
> - `2026-06-25-multi-platform-release-plan.md`（计划）
> - `2026-06-25-multi-platform-release-execution-log.md`（2026-06-25 执行记录）

---

## 🎯 项目是什么

- **MorsePractice**（摩斯码练习器）—— 零构建 PWA（纯 HTML + JS + CSS）
- 已发布 v1.0，准备 v0.2.0
- 线上：https://morsepractice.pages.dev（Cloudflare Pages，绑 GitHub 自动部署）
- 包名 / 主题色 / 域名等见 `2026-06-25-multi-platform-release-design.md`

---

## 🚦 发布模式：全手动

**CI 已禁用**（commit `6ee9d0e`，`.github/workflows/release.yml` 的 tag trigger 注释掉 + release job 备份到注释里）。
每次发布 = 本地编 3 平台 + `gh release create`。

**为什么不用 CI**：9 轮 debug 后判定不收敛（详见 `ci-debug-log.md` 决策段）。
**未来如要恢复 CI**：恢复方法是取消 workflow 文件里 2 处注释，参考 ci-debug-log 的 fix 列表。

---

## 🛑 硬性约束（违反 = 制造新坑）

### 不许动

- ❌ `mykEY/morse-practice.keystore` —— **gitignored，丢了 = 永远无法升级已发布 APK**
- ❌ `mykEY/password.txt` —— 同上
- ❌ 恢复 CI workflow（除非用户明确要求）—— 已确认失败
- ❌ 重生成 keystore —— 同第 3 条

### 必查

- ✅ 动手前先看 `strategy.md` 的 6-question pre-flight
- ✅ 失败时回 `ci-debug-log.md` 找答案，别瞎试
- ✅ JDK 必须是 **17**（不是 21），Bubblewrap 1.24.1 强校验
- ✅ `~/.bubblewrap/config.json` 必须写好 jdkPath + androidSdkPath
- ✅ `$ANDROID_HOME/tools` symlink 指向 `cmdline-tools/latest`（Bubblewrap 兼容）
- ✅ 打包前 PWA 已部署到 CF Pages：`curl https://morsepractice.pages.dev/manifest.json` 验证

---

## 🔐 关键状态

| 项 | 状态 |
|----|------|
| PWA 线上 | https://morsepractice.pages.dev（绑 main 分支自动部署） |
| 域名 `morsepractice.pages.dev` | Cloudflare Pages shared subdomain（TWA 会 fallback 到 Custom Tabs，100% 全屏需绑自定义域） |
| Android keystore | `mykEY/morse-practice.keystore`（gitignored，**必须备份**） |
| Android packageId | `com.github.yuxinluo.morsepractice` |
| Android SHA-256 | `6F71A59E042C2376697C6AF89FD21802E2FCA613D48DAE9566A01C3BAE433919` |
| Bubblewrap 版本 | 1.24.1（不要升 2.x，未测） |
| GitHub Secrets（3 个） | 保留中，备查恢复 CI 用 |
| **Android build 当前状态** | **❌ 未实测通过**（见下方「⚠️ 当前阻塞」） |
| Linux/Windows build | ✅ 实测通过（670K .deb / 7.8M .exe） |

---

## ⚠️ 当前阻塞（2026-06-25 22:00）

**Android 构建未实测通过**——之前多轮在 Bubblewrap 1.24.1 内部细节上猜测（manifest 字段 / SHA-1 算法 / checksum 文件名），已接近幻觉。

**事实**（已实测）：
- `manifest-checksum.txt` 和 `twa-manifest.json` 的 SHA-1 已 match（`c7da6d...`）
- `app/build.gradle` 已被 sed patch 到正确值
- WebSearch 工具在本环境**不可用**（API 400），无法从网络找攻略
- `init-android.sh` 第 26 行的检测 `.bubblewrap/checksum.json` 是错的（1.24.1 实际生成 `manifest-checksum.txt`）
- **最新 build 未实测**

**三个方向（待用户决定）**

1. **暂停 Android，只发 Linux + Windows v0.2.0**——这两个平台已实测通过
2. **换工具**（PWA Builder / Capacitor）——需要用户自己搜攻略
3. **继续 Bubblewrap 1.24.1**——先实测一次 build，不循环猜

详细见 `2026-06-25-ci-debug-log.md` 末尾「2026-06-25 22:00」段。

---

## 🧰 关键脚本

```bash
bash release/scripts/build-assets.sh    # 共享：复制 web 资源到 dist/web/
bash release/scripts/build-linux.sh     # → .deb（dpkg-deb）
bash release/scripts/build-windows.sh   # → .exe（Go 交叉编译）
bash release/scripts/build-android.sh   # → .apk（Bubblewrap TWA）⚠️ 当前未通过
bash release/scripts/init-android.sh    # 一次性（真 TTY 跑一次,~30s）

# 创建 release
gh release create vX.Y.Z \
  release/dist/morse-practice_X.Y.Z_amd64.deb \
  release/dist/Morse-Practice-X.Y.Z.exe \
  release/dist/morse-practice-X.Y.Z.apk
```

---

## 🔄 完成一次发布后必做

1. 更新 `2026-06-25-multi-platform-release-continuation.md` 的「已验证产物」表
2. 在 `2026-06-25-ci-debug-log.md` 的「📝 增量记录」追加实战记录：
   - 日期 / 花了多久 / 踩了什么新坑
3. 如果是用户首次发布，加一行到「总教训」段

---

## 🪤 已踩过 10 个坑（**不要重做**）

按时间序：

1. `e956789` — heredoc + YAML + shell 变量三角展开失败 → printf 替代
2. `16202d1` — `licenses/` 缺失（premature fix，没根治）
3. `9f44c68` — `cmdline-tools;latest` 漏装
4. `ab8ed62` — Bubblewrap 1.24.1 硬要 `tools/` 或 `bin/` → symlink
5. `ec8c4b0` — `versionCode` 前导零 → node 算
6. `47d7d46` — `bubblewrap build` 缺 checksum → init 前置
7. `42e4ce6` — `new URL('/tmp/...')` 抛 "Invalid URL" → 本地 HTTP server 托管
8. `3a2d7bf` — `orhunp/git-cliff-action` 拼错用户名 → `orhun/git-cliff-action`
9. `6ee9d0e` — **决策：彻底废弃 CI**（成本不收敛）
10. `d746dbc` — 当前阻塞：Android build 未实测通过（多轮猜测接近幻觉）

详细 debug 见 `2026-06-25-ci-debug-log.md`。