# 本地 Android 编译指南（2026-06-25）

> **给下一位 agent / 接手人**：本指南是 MorsePractice 项目
> Android TWA APK 本地构建的完整操作手册。CI 上 Bubblewrap 1.24.1
> 与现代 Android SDK 有 6 轮不兼容坑，已经全部 fix 到 `release/scripts/build-android.sh` 里。
>
> 你拿到本指南后，**不需要重做 debug**——按下面步骤走，**预期 30 分钟内出第一个 APK**。
>
> 配套文档：
> - CI Debug 日志（**先看**）：`2026-06-25-ci-debug-log.md`——6 轮 debug 链
> - 进展 / 待办：`2026-06-25-multi-platform-release-continuation.md`
> - 计划：`2026-06-25-multi-platform-release-plan.md`

---

## 🎯 目标

在本地 Linux 跑：

```bash
bash release/scripts/build-android.sh
```

产出 `release/dist/morse-practice-X.Y.Z.apk`（已用 keystore 签名）。

---

## 🧱 0. 前置环境清单

| 依赖 | 最低版本 | 检查命令 | 备注 |
|------|---------|---------|------|
| Node.js | 20+ | `node -v` | Bubblewrap 1.24.x 要 Node 18+ |
| JDK | **17**（不要 21） | `java -version` | Bubblewrap 硬要 17，21 会报奇怪的 validatePath 错 |
| Bubblewrap CLI | 1.24.1 | `bubblewrap --version` | `npm install -g @bubblewrap/cli` |
| Android SDK | cmdline-tools 12+ | `ls $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager` | 必须有 `cmdline-tools/latest/` |
| Python 3 | 3.10+ | `python3 --version` | 用 `python3 -m http.server` 临时托管 manifest |
| curl | 任意 | `curl --version` | 探活 HTTP server |

### 0.1 JDK 17 安装

```bash
# 方式 A：apt（如果 sudo 可用）
sudo apt install -y openjdk-17-jdk

# 方式 B：无 sudo（参考 Phase 0 的 Go 装法）
mkdir -p $HOME/.local/jdk17
curl -kfsSL -o /tmp/jdk17.tar.gz \
  "https://download.java.net/java/GA/jdk17.0.2/dfd4a8d0985749f896bed50d7138ee7f/8/GPL/openjdk-17.0.2_linux-x64_bin.tar.gz"
tar -C $HOME/.local -xzf /tmp/jdk17.tar.gz
echo 'export JAVA_HOME=$HOME/.local/jdk-17.0.2' >> ~/.bashrc
echo 'export PATH=$JAVA_HOME/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### 0.2 Android SDK 安装

```bash
export ANDROID_HOME=$HOME/Android/Sdk
mkdir -p "$ANDROID_HOME/cmdline-tools"

# 装 cmdline-tools 12.0（最新稳定）
cd /tmp
curl -kfsSL -o cmdline-tools.zip \
  "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
unzip -q cmdline-tools.zip
mv cmdline-tools "$ANDROID_HOME/cmdline-tools/latest"

# 接受 licenses + 装 3 个组件
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

# 验证
ls "$ANDROID_HOME"  # 应该看到: build-tools, cmdline-tools, licenses, platform-tools, platforms
```

### 0.3 Bubblewrap 配置（**关键**，跳过会卡交互 prompt）

```bash
# 写 ~/.bubblewrap/config.json（Bubblewrap 启动读这个）
mkdir -p ~/.bubblewrap
printf '{"jdkPath":"%s","androidSdkPath":"%s"}\n' \
  "$JAVA_HOME" "$ANDROID_HOME" > ~/.bubblewrap/config.json
cat ~/.bubblewrap/config.json
# → {"jdkPath":"/home/you/.local/jdk-17.0.2","androidSdkPath":"/home/you/Android/Sdk"}
```

### 0.4 验证 JDK release 文件（**关键**）

```bash
cat $JAVA_HOME/release | grep JAVA_VERSION
# 必须输出 JAVA_VERSION="17.0.x"
# 如果输出 21.x → Bubblewrap 会拒收
```

### 0.5 修复 SDK 布局（**关键**）

```bash
# Bubblewrap 1.24.1 校验 SDK 根有 tools/ 或 bin/，但现代 SDK 都没有
# 建一个 symlink 让校验过
ln -sfn "$ANDROID_HOME/cmdline-tools/latest" "$ANDROID_HOME/tools"
ls -la "$ANDROID_HOME/tools"
# → tools -> /home/you/Android/Sdk/cmdline-tools/latest
```

### 0.6 确认 keystore 在位

```bash
ls -la mykEY/
# 必须有:
#   morse-practice.keystore  (2776 bytes)
#   password.txt             (32 字符密码)
#   README.md                (committed)
#   keystore.b64             (备查)
cat mykEY/password.txt
# → NEoITxs5hVbfOj0IpWq90DzfGS1ZlncV
```

---

## 🚀 1. 跑构建

```bash
cd ~/path/to/MorsePractice
export JAVA_HOME=$HOME/.local/jdk-17.0.2   # 或 openjdk-17 的实际路径
export ANDROID_HOME=$HOME/Android/Sdk
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$JAVA_HOME/bin:$PATH"
export KEYSTORE_PASS=$(cat mykEY/password.txt)
export KEY_PASS=$(cat mykEY/password.txt)

bash release/scripts/build-android.sh
```

### 预期输出

```
→ Initializing Bubblewrap project...
Initializing application from Web Manifest:
    -  http://127.0.0.1:8765/twa-manifest.json
[bubblewrap 下载 PWA manifest + 验证 icon + 生成 .bubblewrap/ + 拷 assets]
→ Stopping HTTP server...
→ Building APK...
[bubblewrap build --skipPwaValidation → Gradle assembleRelease → 签名]
✓ Built: /path/to/MorsePractice/release/dist/morse-practice-X.Y.Z.apk
-rw-r--r-- 1 you you 12M ... morse-practice-0.1.0.apk
```

---

## ✅ 2. 验证 APK

### 2.1 文件完整性

```bash
ls -lh release/dist/*.apk
# 应该在 8-15 MB 之间

# 用 aapt 查包信息（aapt 在 build-tools 里）
$ANDROID_HOME/build-tools/34.0.0/aapt dump badging release/dist/morse-practice-0.1.0.apk | head
# 应该看到:
#   package: name='com.github.yuxinluo.morsepractice' versionCode='10100' versionName='0.1.0'
#   application-label: 'Morse Practice'
#   launchable-activity: name='com.google.androidbrowserhelper.trusted.LauncherActivity'
```

### 2.2 签名验证

```bash
# 确认是 release 签名（v2 + v3）
$ANDROID_HOME/build-tools/34.0.0/apksigner verify --verbose release/dist/morse-practice-0.1.0.apk
# 应该输出 "Verifies" + 至少 v2 signature verified
```

### 2.3 真机 / 模拟器测试

```bash
# 启模拟器（需要 AVD 已在 Android Studio 创建）
emulator -avd Pixel_5_API_34 &

# 装 APK
adb install release/dist/morse-practice-0.1.0.apk
# → Success

# 启动
adb shell am start -n com.github.yuxinluo.morsepractice/com.google.androidbrowserhelper.trusted.LauncherActivity
# 期望：弹出全屏 TWA 加载 https://morsepractice.pages.dev/
```

---

## 🛟 3. 失败排错表

| 现象 | 根因 | 修法 |
|------|------|------|
| `cli ERROR The provided androidSdk isn't correct.` | SDK 缺 `tools/` 或 `bin/` | 重跑 `0.5 修复 SDK 布局` |
| `cli ERROR Invalid URL` | init 用 `new URL(args.manifest)` 校验 | 确认 `0.3 Bubblewrap 配置` 里 `jdkPath` 和 `androidSdkPath` 都是绝对路径且 `JAVA_HOME` 不是 21 |
| `Could not determine java version from '21.0.x'` | JDK 21 没 `JAVA_VERSION="17.0..."` release 行 | 重装 JDK 17，覆盖 `JAVA_HOME` |
| `licenses/android-sdk-license not found` | 漏跑 `sdkmanager --licenses` | `yes \| sdkmanager --licenses` |
| `Build failed: sdk.dir not set` | `local.properties` 缺 `sdk.dir` | `echo "sdk.dir=$ANDROID_HOME" > android/local.properties`（Bubblewrap init 后才有 android/ 目录） |
| Gradle 卡在 `Downloading gradle-7.x-bin.zip` | 国内网络问题 | 手动 `gradle wrapper --gradle-version 8.7` 或预下载到 `~/.gradle/wrapper/dists/` |
| `bubblewrap update` 失败（init 后到 build 之前） | 我们的脚本里没调 update，但本地手抖可能调过 | 删项目目录重新 init（`rm -rf .bubblewrap android/ app/`） |

---

## 🔄 4. 改 PWA 后重新打包

```bash
# PWA 改动后,只要重跑 build-android.sh
bash release/scripts/build-android.sh
# 30 秒出新 APK（init 会重新下载 PWA manifest 检测变化）
```

---

## 📦 5. 上传 APK 到 GitHub Release

### 5.1 准备 gh CLI

```bash
sudo apt install -y gh   # 或 brew install gh
gh auth login
```

### 5.2 流程

```bash
# 1. 推 tag → CI 跑 .deb + .exe + 建 release
git tag v0.2.0-rc.1
git push origin v0.2.0-rc.1
# 等 5-10 分钟

# 2. 确认 release 已建
gh release view v0.2.0-rc.1
# 应该看到 .deb + .exe 已经在 assets

# 3. 上传本地 APK
gh release upload v0.2.0-rc.1 release/dist/morse-practice-0.2.0-rc.1.apk --clobber

# 4. 验证
gh release view v0.2.0-rc.1
# → assets 列表应该有 3 个: .deb / .exe / .apk
```

---

## 🛡️ 6. 重要安全 / 备份事项

| 文件 | 状态 | 备份要求 |
|------|------|---------|
| `mykEY/morse-practice.keystore` | gitignored | **必须备份**到 1Password / Bitwarden / 加密 USB |
| `mykEY/password.txt` | gitignored | **必须备份** |
| `release/dist/*.apk` | 本地临时 | 每次 build 都会重写，建议也备份已发布的版本 |

**丢了 keystore = 永远无法升级已发布的 APK**。换设备 / 重新装系统前先备份。

---

## 🧭 7. 与 CI 的关系

| 平台 | 构建方式 | 触发 | 上传方式 |
|------|---------|------|---------|
| Linux .deb | CI 自动 | `git push --tags` | CI 自动 |
| Windows .exe | CI 自动 | `git push --tags` | CI 自动 |
| Android .apk | **本地手动** | 你跑 `build-android.sh` | **`gh release upload`** |

CI workflow（`.github/workflows/release.yml`）当前只编前两个。**不要**手动跑 GitHub Actions 编 APK。

未来如果想恢复 CI 编 APK，参考 `release/dev_doc/2026-06-25-ci-debug-log.md` 的 #1-#6 找到所有 fix，
把对应的 `Verify Android SDK structure` / `Pre-configure Bubblewrap` / `Decode keystore` 步骤加回 workflow。

---

## 📋 8. 完成度检查

第一次跑通后，请更新 `2026-06-25-multi-platform-release-continuation.md` 的「已验证产物」表：

```markdown
| Android | `release/dist/morse-practice_0.2.0.apk` | 12 MB | ✅ 本地构建验证 |
```

并在本指南底部追加一条「实战记录」（日期、用了多长时间、踩了哪些坑）。

---

**祝顺利。30 分钟后见 APK。**
