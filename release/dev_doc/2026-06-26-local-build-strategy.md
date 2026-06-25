# 本地编译 — 思路文档（给下一位 agent）

> **状态**：设计文档（**不是**操作手册）
> **配套手册**：`2026-06-25-local-android-build-guide.md`（步骤级）
> **配套清单**：`2026-06-25-action-checklist.md`（端到端流程）
> **配套 debug**：`2026-06-25-ci-debug-log.md`（历史踩坑实录）
>
> **写给谁**：拿到本仓库、希望在本地出 3 平台产物的下一位
> **目标**：帮你**先想清楚再动手**，不要直接照着步骤抄

---

## 🎯 一句话总结

> **本机就是发布机**——没有跨平台 / 跨人协作需求，CI 价值低，**全本地脚本 + 一份人工清单**就够。

如果你只想知道「怎么跑」，看 `action-checklist.md` v2 即可。
如果你想知道「为什么这么设计 / 哪里能改 / 哪里有坑」，**看本文件**。

---

## 🧠 三个核心思考

### 思考 1：发布频次 vs 工具复杂度

```
发布频次: ──────●──────────────────────────────────●──
              v1.0                              v0.2.0
              6 个月前                          未来某天

工具链:Bubblewrap + Android SDK + Go 跨编译 + JDK 17 + dpkg + gh CLI
```

每半年一次发布，每次 5min，**但工具链要装 1 小时**。

**判断**：
- 频次够高（每周 / 每天）→ CI 自动值回票价
- 频次低（每季度 / 半年）→ 工具链装一次后本地脚本够用
- 频次更低（每年 / 不定）→ 连本地脚本都嫌多，**手抄命令也行**

我们落「本地脚本 + 人工清单」这一档。

### 思考 2：发布机 vs 构建机

**CI 思维的盲区**：「让 GitHub 服务器替我编译」

但你的发布机本来就是 Linux 容器（容器 / WSL / 实体机），
跟你要分发的目标机**完全同构**（Linux .deb / 跨编译 Windows .exe / 模拟 Android TWA），
CI 提供的「跨环境隔离」对你的用例**没有价值**。

**真正有价值的是**：
- 一份能复现的脚本（`release/scripts/build-*.sh`）—— ✅ 已有
- 一份手顺文档（`action-checklist.md`）—— ✅ 已有
- 一份能找回来的 keystore —— ✅ 已在 `mykEY/`，gitignore 保护

CI 增加的是「自动触发 + 自动上传」—— 但触发你也只要 `gh release create` 一行。

### 思考 3：失败可恢复性

| 失败类型 | CI 时代 | 本地时代 |
|---------|---------|---------|
| 编译脚本 bug | 改 → push → 等 5min | 改 → 重跑，**5 秒** |
| 工具链问题（sdkmanager 拉不动） | 改 workflow → push → 等 5min | 看 log → 手动下 SDK → 改 PATH |
| 网络抽风（CF Pages 不可达） | 重试 workflow | 等几分钟重跑 |
| Keystore 损坏 | 完蛋（CI 永远不会成功） | 完蛋（但你能立刻发现） |
| Tag 推错 | 删 tag + 重打 | 同 |

**结论**：CI 不降低任何失败类型的修复成本，**只增加日常维护成本**。

---

## 🏗️ 架构：3 平台 × 各自独立的 build 脚本

```
release/scripts/
├── build-assets.sh    # 共享:复制 web 资源到 dist/web/
├── build-linux.sh     # dpkg-deb 打包
├── build-windows.sh   # Go 交叉编译
└── build-android.sh   # Bubblewrap TWA
```

### 关键设计点

1. **不依赖彼此**——任何一个脚本可以独立跑、独立失败
2. **共享一个 dist/**——所有产物落 `release/dist/`，最后 `gh release create` 一起捞
3. **入口在 `release/scripts/build-assets.sh`**——下游 3 个脚本会检查 `dist/web/` 在不在，
   不在自动跑（避免重复打包 web 资源）

### 3 个脚本的本质差异

| 平台 | 工具 | 复杂度 | CI 上踩的坑数 |
|------|------|--------|--------------|
| Linux .deb | `dpkg-deb` | 最低（系统自带） | 0 |
| Windows .exe | Go `GOOS=windows` 交叉编译 | 中（需 `~/.local/go`） | 0 |
| Android .apk | Bubblewrap + Android SDK | 最高 | **6 个** |

**Android 是唯一值得花时间理解的**——见思考 4。

### 思考 4：为什么 Android 单独难

Bubblewrap 1.24.1（2023 年发布）+ 现代 Android SDK（cmdline-tools 9.0+，2022 年后）
有**结构性不兼容**。不是 bug，是 Bubblewrap 没跟上 Android SDK layout 演进。

| 时期 | SDK 布局 | Bubblewrap 1.24.1 期望 |
|------|---------|---------------------|
| ≤ 2022 | `tools/` `bin/` 在 SDK 根 | ✅ 兼容 |
| > 2022 | `cmdline-tools/latest/bin/sdkmanager` | ❌ 校验失败 |

**两个时代的 mismatch**——必须用 symlink / config hack 绕开（已在 `build-android.sh` 里）。
**未来**：升级到 Bubblewrap 2.x 应该能解决，但我们没升（要测）。

---

## ⚙️ 关键依赖：哪些必须装

### 三个「不装就跑不了」的硬依赖

| 依赖 | 装的理由 | 能不能用容器绕过 |
|------|---------|----------------|
| **JDK 17**（不是 21） | Bubblewrap 硬校验 `JAVA_VERSION="17.0.x"` | 能，但容器本身要装 |
| **Android SDK + cmdline-tools** | Bubblewrap 调 sdkmanager 验证项目 | 能，但容器要装 |
| **Bubblewrap CLI** | 直接调它做 TWA | 能，但 npm 要装 |

### 三个「装了更舒服」软依赖

| 依赖 | 不装的代价 |
|------|----------|
| **Go 1.22+** | Windows .exe 编译不了 |
| **Python 3.10+** | Android build 起 HTTP server 用 |
| **gh CLI** | 创建 release 用（否则只能网页 UI 拖拽） |

### 一个「不能丢」的状态

**`mykEY/morse-practice.keystore` + `password.txt`**——丢了 = 永远无法升级已发布的 APK。
**没备份 = 这个项目死了**。

**Why:** Android 升级机制要求新旧 APK 用同一 keystore 签名。Google Play 会拒收不同签名的「升级」。
**How to apply:** 第一次跑通后，**立刻**把这两个文件备份到 1Password / 加密 USB / 离线硬盘。

---

## 🎯 给下一位的「动手前清单」

> **在按 `action-checklist.md` 跑之前，先回答这 6 个问题**

### Q1：你的发布机是什么系统？

- **Ubuntu 22.04+ / Debian 12+**（推荐）→ 3 平台都能直接编
- **macOS** → Linux/Windows 都能编，Android 需要 Android Studio 的 SDK
- **Windows**（不推荐）→ 需要 WSL2 才能编 .deb / .apk
- **其它** → 先验证 `dpkg-deb` 能不能跑

### Q2：JDK 17 装在哪？

`/usr/lib/jvm/java-17-openjdk-amd64`？`$HOME/.local/jdk-17.0.2`？其他？

`build-android.sh` 读 `$JAVA_HOME`——必须**显式 export**，不能只 `update-alternatives`。

### Q3：Android SDK 装在哪？

`$HOME/Android/Sdk`？`/opt/android-sdk`？`/usr/local/lib/android/sdk`？

`build-android.sh` 读 `$ANDROID_HOME`——同上，必须显式 export。

### Q4：keystore 在不在？

```bash
ls -la mykEY/morse-practice.keystore
# 必须输出 2776 bytes
```

**没的话**：参考 `mykEY/README.md` 重新生成（但**已发布的 APK 失去升级能力**，
下次得让用户卸载重装——所以备份 + 找回**永远优先**）。

### Q5：上次发布用的什么版本？

```bash
gh release list
# 找到上一个 vX.Y.Z
```

**发新版前先 bump `package.json` 的 version 字段**——`build-*.sh` 都读这个。
否则 3 个脚本会拿旧版本号打包。

### Q6：CF Pages 上的 PWA 是最新版吗？

Bubblewrap init 会从 `webManifestUrl` 下载 PWA manifest 验证。
**PWA 没 deploy 的话 init 会用旧版**——结果 APK 内嵌的 PWA 是旧版。

**Checklist**：
```bash
curl -s https://morsepractice.pages.dev/manifest.json | python3 -c "
import json, sys
m = json.load(sys.stdin)
print('version:', m.get('version', 'MISSING'))
"
# 期望是即将打包的版本号
```

---

## 🚦 三个容易踩的「概念坑」

### 坑 1：把 CI 经验直接搬到本地

**症状**：「我之前在 CI 跑过的步骤在本地怎么不 work？」

**Why:** CI 的 Linux 是 `ubuntu-latest`（2026 年 = ubuntu-24.04），本机可能是其他版本：
- `dpkg-deb` 选项可能略有差异
- 默认 Python 版本不同（CI 是 3.11，本机可能是 3.10）
- `apt` 装包名不一样

**How to apply:** 本地跑**完全**按 `action-checklist.md` 的本地步骤，**不要**参考
`.github/workflows/release.yml`——那只是「之前在 ubuntu-24.04 跑通」的快照。

### 坑 2：忽略 PWA 部署

**症状**：APK 装上手机打开是旧版界面 / 404 / 错乱

**Why:** Bubblewrap TWA 把 `webManifestUrl` 指向的 PWA 整个内嵌到 APK。PWA 改动后
CF Pages 没 deploy → Bubblewrap 用旧 PWA 打包 → APK 是旧版。

**How to apply:** **打包前先确认 CF Pages 部署完成**（看 commit 触发 deployment 状态，
或者直接 `curl -sI https://morsepractice.pages.dev/manifest.json` 验证）。

### 坑 3：把 keystore 当成「可以重新生成的临时文件」

**症状**：重装系统 / 换电脑后找不到 keystore → 无法升级已发版本

**Why:** Android 用 keystore 标识「开发者身份」。APK 升级链 = 同一 keystore 签的
新旧两个 APK 组成一对。换了 keystore = 等于不同开发者 → 升级链断。

**How to apply:** **keystore 是项目资产，不是临时文件**。第一次跑通后立刻备份。
**丢了 = 这个项目的所有用户都得卸载重装**。

---

## 🛠️ 可以改进的方向（你接手后可以考虑）

| 改进 | 价值 | 代价 |
|------|------|------|
| 写个 `release.sh` 一键跑 3 平台 | 省 30 秒 | 30 分钟写 |
| 把 Android SDK 装到固定路径 + 写 setup 脚本 | 换机器时少踩坑 | 1 小时 |
| 升级 Bubblewrap 到 2.x | 解决 6 个 fix 的根因 | 测一次新版本兼容性 |
| 加 Docker 镜像 | 「换机器 0 配置」 | 写 Dockerfile + 文档 |
| 加 .deb 的 ARM64 build | 支持树莓派 / M-series Mac Linux | 改 `Architecture: arm64` |
| 加 macOS .dmg | 苹果用户友好 | 写 hdiutil 流程 |

**优先级建议**：
1. **什么都不改**（现状够用）—— 6 个月后再发一次也不会有问题
2. **加 `release.sh`** —— 真要发多次的话
3. **其他都是 nice-to-have**

---

## 📚 文档地图

```
release/dev_doc/
├── 2026-06-25-multi-platform-release-design.md            ← 为什么这么设计
├── 2026-06-25-multi-platform-release-plan.md              ← 计划执行步骤
├── 2026-06-25-multi-platform-release-execution-log.md     ← 2026-06-25 当天执行记录
├── 2026-06-25-multi-platform-release-continuation.md      ← 进展/待办
├── 2026-06-25-action-checklist.md                         ← 端到端操作清单(本地版)
├── 2026-06-25-ci-debug-log.md                             ← CI 踩坑历史(9 轮)
├── 2026-06-25-local-android-build-guide.md                ← Android 编译步骤级
└── 2026-06-26-local-build-strategy.md                     ← ★ 本文件:思路级
```

**读法建议**：
- 5min 速览：先看本文件 → 「三个核心思考」 + 「动手前清单」
- 30min 完整：加上 `local-android-build-guide.md` + `action-checklist.md` v2
- 完整考古：再读 `ci-debug-log.md` 9 轮 + `execution-log.md` Phase 0-7

---

## 🤝 给你的建议

**别直接照着步骤抄**。先：

1. 读完本文件的「三个核心思考」+ 「动手前清单」+ 「三个概念坑」
2. 估算一次发布需要多少时间（按你的本机配置）
3. 决定要不要做任何改进（看「可以改进的方向」）
4. 然后再开 `action-checklist.md` v2 一步步跑

**如果决定开干前还有疑问**——读 `ci-debug-log.md` 9 轮 debug 历史，
那是我们替你踩过的所有坑。**别重踩**。
