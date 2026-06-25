# CLAUDE.md — MorsePractice 项目协作说明

> **本文件是给 Claude Code 会话的"项目指南"**——每次自动加载到上下文。
> 写在根目录是因为：1) 显眼 2) Claude Code 启动时会读
> 别把所有细节都塞这里——详细文档放 `release/dev_doc/`，本文件做**索引 + 硬约束**

---

## 🎯 项目是什么

- **MorsePractice**（摩斯码练习器）—— 零构建 PWA（纯 HTML + JS + CSS）
- 已发布 v1.0，准备 v0.2.0
- 线上：https://morsepractice.pages.dev（Cloudflare Pages，绑 GitHub 自动部署）
- 包名 / 主题色 / 域名等见 `release/dev_doc/2026-06-25-multi-platform-release-design.md`

## 🚦 发布模式：全手动

**CI 已禁用**（commit `6ee9d0e`，`.github/workflows/release.yml` 的 tag trigger 注释掉 + release job 备份到注释里）。
每次发布 = 本地编 3 平台 + `gh release create`。

**为什么不用 CI**：9 轮 debug 后判定不收敛（详见 `2026-06-25-ci-debug-log.md` #9 决策）。
**未来如要恢复 CI**：恢复方法是取消 workflow 文件里 2 处注释，参考 ci-debug-log 的 fix 列表。

---

## 📚 必读文档（按顺序）

> 接到本项目的 Claude 应该**先读这 4 篇**再动手，别直接照抄步骤。

| # | 文档 | 用途 | 读完用时 |
|---|------|------|---------|
| 1 | `release/dev_doc/2026-06-26-local-build-strategy.md` | **思路**（why / what / trade-off） | 5 min |
| 2 | `release/dev_doc/2026-06-25-action-checklist.md` | 端到端操作清单（v2，本地版） | 10 min |
| 3 | `release/dev_doc/2026-06-25-local-android-build-guide.md` | Android 步骤级 | 10 min |
| 4 | `release/dev_doc/2026-06-25-ci-debug-log.md` | 9 轮踩坑历史（**别重踩**） | 5 min |

其他可参考资料：
- `2026-06-25-multi-platform-release-design.md`（设计稿）
- `2026-06-25-multi-platform-release-plan.md`（计划）
- `2026-06-25-multi-platform-release-execution-log.md`（2026-06-25 执行记录）

---

## 🛑 硬性约束（违反 = 制造新坑）

### 不许动

- ❌ `release/scripts/build-*.sh` —— 6 轮 debug 已验证的脚本，改动 = 重新踩坑
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
- ✅ 任何时候不确定 → 问用户，别猜

### 工作模式

- ✅ 全程**中文**交流
- ✅ **分阶段**完成 + 阶段间等用户验收（用户偏好）
- ✅ 别 over-engineer：能跑就别改，能 1 行就别 10 行
- ✅ 看到不对的地方直接说，别硬上

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

---

## 🧰 关键脚本

```bash
bash release/scripts/build-assets.sh    # 共享：复制 web 资源到 dist/web/
bash release/scripts/build-linux.sh     # → .deb（dpkg-deb）
bash release/scripts/build-windows.sh   # → .exe（Go 交叉编译）
bash release/scripts/build-android.sh   # → .apk（Bubblewrap TWA）

# 创建 release
gh release create vX.Y.Z \
  release/dist/morse-practice_X.Y.Z_amd64.deb \
  release/dist/Morse-Practice-X.Y.Z.exe \
  release/dist/morse-practice-X.Y.Z.apk
```

---

## 🔄 完成一次发布后必做

1. 更新 `release/dev_doc/2026-06-25-multi-platform-release-continuation.md` 的「已验证产物」表
2. 在 `release/dev_doc/2026-06-25-ci-debug-log.md` 的「📝 增量记录」追加实战记录：
   - 日期 / 花了多久 / 踩了什么新坑
3. 如果是用户首次发布，加一行到「总教训」段

---

## 🪤 已踩过 9 个坑（**不要重做**）

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

详细 debug 见 `ci-debug-log.md`。

---

## 💬 跟用户沟通建议

- 用户偏好「全盘接手」+「阶段验收」模式：可以主动推进，但每个阶段做完等确认
- 看到选项/歧义时**主动给出推荐 + 理由**，别给 5 个选项让人选
- 完成阶段性目标时**给一个简洁总结**（做了什么 / 验证了什么 / 下一步）
- 报错时**先给根因 + 修复 + commit**，别只贴 log

---

**最后**：这是协作指南不是操作手册。**详细步骤在 `release/dev_doc/`**。本文件存在意义是让新会话**30 秒内找到正确的文档 + 知道哪些不能动**。
