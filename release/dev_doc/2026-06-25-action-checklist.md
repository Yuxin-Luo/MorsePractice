# 多平台发布 — 用户人工执行清单（**全手动模式**）

> **变更记录（2026-06-25 13:00）**：
> 原本用 CI 自动跑 .deb + .exe + 创建 release。
> 改了：**全手动**——本地编 3 平台 → `gh release create` 一把上传。
> 详见 `2026-06-25-multi-platform-release-continuation.md`「全手动发布模式」段
> + `2026-06-25-ci-debug-log.md` #9 决策记录。
>
> 配套文档：
> - 进展说明：`2026-06-25-multi-platform-release-continuation.md`
> - CI Debug 日志：`2026-06-25-ci-debug-log.md`
> - **本地 Android 编译指南**：`2026-06-25-local-android-build-guide.md`
> - 设计稿：`2026-06-25-multi-platform-release-design.md`

---

## 🧭 流程总览

```
本地 Linux 机器:
  1. 跑 3 个 build 脚本 → release/dist/{*.deb, *.exe, *.apk}
  2. 验证 3 个产物
  3. gh release create vX.Y.Z release/dist/*.{deb,exe,apk}
  4. 完事
```

总耗时：**30-60 分钟**（首次环境准备 30min + 后续每次 5min）。

---

## 阶段 0：备份敏感凭据（**最高优先级，丢 = 不可恢复**）

> 这一步必须在所有其他操作之前完成。`mykEY/` 是 gitignored，本地丢失 = 永远无法升级已发布的 APK。

- [ ] **0.1** 打开密码管理器（1Password / Bitwarden / KeePass）
- [ ] **0.2** 创建条目 **"MorsePractice Android keystore"**，保存：
  - `NEoITxs5hVbfOj0IpWq90DzfGS1ZlncV`（密码）
- [ ] **0.3** 复制 keystore 文件到备份位置（任选其一）：
  - 密码管理器附件上传（推荐）
  - 加密 USB 盘：`cp mykEY/morse-practice.keystore /media/usb/`
  - 加密云盘（iCloud / Dropbox 加密 vault）
- [ ] **0.4** 验证备份：备份位置的文件大小应 = **2776 字节**
  ```bash
  ls -la mykEY/morse-practice.keystore
  # 期望: -rw-rw-r-- 1 ruo ruo 2776 6月 25 10:36 mykEY/morse-practice.keystore
  ```

✅ **完成后才能进入阶段 1**

---

## 阶段 1：本地环境准备（**首次需要，第二次起可跳**）

### 1.1 系统包

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y dpkg-deb python3 curl git
```

### 1.2 Node.js 20+

```bash
# nvm 推荐
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
nvm use 20
node -v  # 确认 v20.x
```

### 1.3 JDK 17（Android 编译用）

```bash
sudo apt install -y openjdk-17-jdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
# 永久生效:
echo 'export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64' >> ~/.bashrc

java -version  # 必须 17.x,不能是 21
```

### 1.4 Go 1.22+（Windows 交叉编译用）

```bash
# 无 sudo 装法
mkdir -p $HOME/.local/go
curl -kfsSL -o /tmp/go.tar.gz "https://golang.google.cn/dl/go1.22.10.linux-amd64.tar.gz"
tar -C $HOME/.local -xzf /tmp/go.tar.gz
echo 'export PATH=$HOME/.local/go/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
go version  # go1.22.x
```

### 1.5 Android SDK（仅 Android 编译需要）

```bash
export ANDROID_HOME=$HOME/Android/Sdk
mkdir -p "$ANDROID_HOME/cmdline-tools"

cd /tmp
curl -kfsSL -o cmdline-tools.zip \
  "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
unzip -q cmdline-tools.zip
mv cmdline-tools "$ANDROID_HOME/cmdline-tools/latest"

export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

### 1.6 Bubblewrap CLI

```bash
npm install -g @bubblewrap/cli
bubblewrap --version  # 1.24.x
```

### 1.7 Bubblewrap 一次性配置（**关键**）

```bash
mkdir -p ~/.bubblewrap
printf '{"jdkPath":"%s","androidSdkPath":"%s"}\n' \
  "$JAVA_HOME" "$ANDROID_HOME" > ~/.bubblewrap/config.json
cat ~/.bubblewrap/config.json  # 确认是绝对路径

# 修 SDK 布局(Bubblewrap 1.24.1 校验 SDK 根有 tools/ 或 bin/)
ln -sfn "$ANDROID_HOME/cmdline-tools/latest" "$ANDROID_HOME/tools"
```

### 1.8 gh CLI

```bash
sudo apt install -y gh
gh auth login
# 选 GitHub.com → SSH → 登录
```

✅ **环境就绪。后续每次发布只需要阶段 2-4。**

---

## 阶段 2：本地编译 3 平台

```bash
cd ~/path/to/MorsePractice

# 加载环境
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=$HOME/Android/Sdk
export PATH="$HOME/.local/go/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$JAVA_HOME/bin:$PATH"
export KEYSTORE_PASS=$(cat mykEY/password.txt)
export KEY_PASS=$(cat mykEY/password.txt)

# 清空旧产物
rm -rf release/dist
mkdir -p release/dist

# Linux .deb
bash release/scripts/build-linux.sh
# → release/dist/morse-practice_<VERSION>_amd64.deb

# Windows .exe（Go 交叉编译）
bash release/scripts/build-windows.sh
# → release/dist/Morse-Practice-<VERSION>.exe

# Android .apk（Bubblewrap TWA）
bash release/scripts/build-android.sh
# → release/dist/morse-practice-<VERSION>.apk
```

### 预期产物

```bash
ls -lh release/dist/
# morse-practice_0.2.0_amd64.deb    ~700K
# Morse-Practice-0.2.0.exe         ~8M
# morse-practice-0.2.0.apk          ~12M
```

✅ **3 个产物都在就进阶段 3**

---

## 阶段 3：本地验证产物

### 3.1 .deb

```bash
# 看包信息
dpkg-deb --info release/dist/morse-practice_*.deb
# 期望: Package: morse-practice / Version: 0.2.0 / Architecture: amd64

# 试装（可选）
sudo dpkg -i release/dist/morse-practice_*.deb
morse-practice  # 期望: 启动浏览器
sudo dpkg -r morse-practice
```

### 3.2 .exe

> Windows 机器才能完整跑（Linux 上只能验证文件格式）
>
> 临时验证：scp 到 Windows → 双击 → 应该启动浏览器到 `http://127.0.0.1:<port>`

最低限度验证（任何平台都能做）：

```bash
file release/dist/Morse-Practice-*.exe
# 期望: PE32+ executable (GUI) x86-64, for MS Windows
```

### 3.3 .apk

```bash
AAPT=$ANDROID_HOME/build-tools/34.0.0/aapt
APKSIGNER=$ANDROID_HOME/build-tools/34.0.0/apksigner

# 包信息
$AAPT dump badging release/dist/morse-practice-*.apk | head
# 期望: package: name='com.github.yuxinluo.morsepractice' versionCode='...' versionName='0.2.0'

# 签名验证
$APKSIGNER verify --verbose release/dist/morse-practice-*.apk
# 期望: Verifies + v2/v3 signature verified
```

✅ **3 个产物都验证 OK 才进阶段 4**

---

## 阶段 4：上传到 GitHub Release

```bash
cd ~/path/to/MorsePractice

# 1. bump 版本号（如未改）
node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('package.json')); p.version='0.2.0'; fs.writeFileSync('package.json', JSON.stringify(p,null,2)+'\n');"
git add package.json
git commit -m "chore(release): bump version to 0.2.0"
git push origin main

# 2. 推 tag(不会触发 CI,workflow 已禁用)
git tag v0.2.0
git push origin v0.2.0

# 3. 创建 release + 上传 3 个产物
gh release create v0.2.0 \
  release/dist/morse-practice-0.2.0_amd64.deb \
  release/dist/Morse-Practice-0.2.0.exe \
  release/dist/morse-practice-0.2.0.apk \
  --title "v0.2.0" \
  --notes "## What's New
- 多平台 release 工作流（手动模式）
- 详见 commit log"
```

### 预期结果

- https://github.com/Yuxin-Luo/MorsePractice/releases/tag/v0.2.0
- 3 个 assets 可下载
- 公开 release（**非** pre-release，因为没有 `-rc`）

---

## 阶段 5（可选）：RC 验证流

如果想先发 RC 测一下，再推正式版：

```bash
# RC tag(版本号可以是 0.2.0-rc.1 但 git tag 用 v 前缀)
git tag v0.2.0-rc.1
git push origin v0.2.0-rc.1
# 注:CI 不会跑(.github/workflows/release.yml 的 tag trigger 已禁用)

# 上传 RC 产物(标 prerelease)
gh release create v0.2.0-rc.1 \
  release/dist/morse-practice-0.2.0-rc.1_amd64.deb \
  release/dist/Morse-Practice-0.2.0-rc.1.exe \
  release/dist/morse-practice-0.2.0-rc.1.apk \
  --prerelease \
  --title "v0.2.0-rc.1" \
  --notes "Release candidate for v0.2.0"

# 验证 OK 后:
gh release delete v0.2.0-rc.1 --yes
git tag -d v0.2.0-rc.1
git push origin :refs/tags/v0.2.0-rc.1

# 推正式
git tag v0.2.0
git push origin v0.2.0
gh release create v0.2.0 ... (同阶段 4)
```

---

## ⚠️ 不再需要的事

| 不再做 | 原因 |
|--------|------|
| ~~推 tag 后等 Actions 跑 5min~~ | CI 不自动跑 |
| ~~看 `release/dist/*.apk` 是否被 release job 收~~ | APK 本地上传 |

## 🔐 已配置但暂不使用的 GitHub Secrets

| Secret | 状态 | 用途 |
|--------|------|------|
| `ANDROID_KEYSTORE_BASE64` | ✅ 已存（Repository Secret） | 备查：将来恢复 CI 编 APK |
| `ANDROID_KEYSTORE_PASS` | ✅ 已存 | 同上 |
| `ANDROID_KEY_PASS` | ✅ 已存 | 同上 |

**目前**没有任何 workflow step 引用这 3 个 Secret（CI release 流程已禁用 + release job 已删）。
**保留理由**：万一未来想恢复 CI 编 APK，无需重新 base64 keystore / 复制密码——Secrets 已在位。

**删除触发条件**（任一）：
- 决定永远不会恢复 CI 编 APK → 手动从 https://github.com/Yuxin-Luo/MorsePractice/settings/secrets/actions 删除
- Repo 准备公开 → **必须**先删（基线安全）

注：删除需 `secrets:write` 权限，gh CLI 当前 token 没有，所以只能网页操作。

## 🔧 恢复 CI（万一以后想要）

`release/dev_doc/2026-06-25-ci-debug-log.md` 里有 #1-#7 全部 fix 记录。
恢复步骤：

1. 取消 `.github/workflows/release.yml` 顶部的 trigger 注释
2. 取消文件底部 release job 注释
3. 删 `mykEY/README.md` 以外的 `mykEY/*` 临时 hack，恢复原始 gitignore
4. 重新加 `build-android` job（参考 git log 里删之前的版本 + debug log 的 fix 列表）

但目前**没必要**——手动 5min 比 CI 维护 + 调试快得多。
