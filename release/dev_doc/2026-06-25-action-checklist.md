# 多平台发布 — 用户人工执行清单

> 本清单按顺序执行。预计总耗时：30-60 分钟（备份 5min + 配置 10min + push + Actions 10min + 测试 15min + 正式 tag 5min）。
> 配套文档：
> - 执行日志：`2026-06-25-multi-platform-release-execution-log.md`
> - 进展说明：`2026-06-25-multi-platform-release-continuation.md`
> - 设计稿：`2026-06-25-multi-platform-release-design.md`

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

## 阶段 1：配置 GitHub Secrets

- [ ] **1.1** 浏览器打开 https://github.com/Yuxin-Luo/MorsePractice/settings/secrets/actions/new

- [ ] **1.2** 添加 Secret `ANDROID_KEYSTORE_BASE64`：
  - 点击 **"New repository secret"**
  - Name: `ANDROID_KEYSTORE_BASE64`
  - Secret: 粘贴以下整段（3704 字符）：

```
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
```

  - 或本地一行命令读取：
    ```bash
    cat mykEY/keystore.b64
    ```
  - 点击 **"Add secret"**

- [ ] **1.3** 添加 Secret `ANDROID_KEYSTORE_PASS`：
  - Name: `ANDROID_KEYSTORE_PASS`
  - Secret: `NEoITxs5hVbfOj0IpWq90DzfGS1ZlncV`
  - 点击 **"Add secret"**

- [ ] **1.4** 添加 Secret `ANDROID_KEY_PASS`：
  - Name: `ANDROID_KEY_PASS`
  - Secret: `NEoITxs5hVbfOj0IpWq90DzfGS1ZlncV`（与上面相同）
  - 点击 **"Add secret"**

- [ ] **1.5** 验证：刷新 https://github.com/Yuxin-Luo/MorsePractice/settings/secrets/actions
  - 期望看到 3 个 Secret：`ANDROID_KEYSTORE_BASE64` / `ANDROID_KEYSTORE_PASS` / `ANDROID_KEY_PASS`
  - ✅ 都在列表里

---

## 阶段 2：推送 commits 到 origin

- [ ] **2.1** 打开终端，确保在项目根目录：
  ```bash
  cd ~/Desktop/LYX/VibeCoding/MorsePractice
  pwd
  # 期望: /home/ruo/Desktop/LYX/VibeCoding/MorsePractice
  ```

- [ ] **2.2** 确认在 main 分支且 working tree 干净：
  ```bash
  git branch --show-current
  # 期望: main
  
  git status --short
  # 期望: 只有 ?? FrontImages/（这是正常的，不影响 push）
  ```

- [ ] **2.3** 推送 9 个 commits 到 origin：
  ```bash
  git push origin main
  ```
  期望输出（简化）：
  ```
  Enumerating objects: XX, done.
  Counting objects: 100% (XX/XX), done.
  ...
  To github.com:Yuxin-Luo/MorsePractice.git
   * [new branch]      main -> main
  ```
  或如果是 fast-forward：
  ```
  To github.com:Yuxin-Luo/MorsePractice.git
     388bb70..439a986  main -> main
  ```

- [ ] **2.4** 浏览器验证：打开 https://github.com/Yuxin-Luo/MorsePractice/commits/main
  - 期望：最上方是 `docs(release): add execution log and continuation checklist`
  - 期望：往上看 8 个新 commits（scaffold / pwa / windows / linux / android / cliff / ci / docs）

---

## 阶段 3：打 RC tag 并 push

- [ ] **3.1** 打 RC tag：
  ```bash
  cd ~/Desktop/LYX/VibeCoding/MorsePractice
  git tag v0.2.0-rc.1
  git tag -l "v0.2*"
  # 期望: v0.2.0-rc.1
  ```

- [ ] **3.2** 推送 RC tag（**这一步触发 GitHub Actions**）：
  ```bash
  git push origin v0.2.0-rc.1
  ```
  期望输出：
  ```
  Total 0 (delta 0), reused 0 (delta 0), pack-reused 0
  To github.com:Yuxin-Luo/MorsePractice.git
   * [new tag]         v0.2.0-rc.1 -> v0.2.0-rc.1
  ```

- [ ] **3.3** 浏览器打开 https://github.com/Yuxin-Luo/MorsePractice/actions
  - 期望：看到新 workflow run "Release" 正在运行
  - 点击进入能看到 5 个 jobs

---

## 阶段 4：观察 GitHub Actions（**约 5-10 分钟**）

- [ ] **4.1** 刷新 Actions 页面，监控 5 个 jobs：

| Job | 预期耗时 | 看什么 |
|-----|---------|--------|
| `build-assets` | ~30s | 绿 = build-assets.sh 跑通 |
| `build-linux` | ~1min | 绿 = .deb 构建成功 |
| `build-windows` | ~3min | 绿 = .exe 交叉编译成功 |
| `build-android` | ~5min | 绿 = APK 构建成功（最长） |
| `release` | ~30s | 绿 = GitHub Release 创建成功 |

- [ ] **4.2** 等所有 job 变绿
  - 全部绿色 → 进入阶段 5
  - 有红色 → 进入阶段 4a 故障排查

### 阶段 4a：故障排查（**只在有 job 失败时**）

- [ ] **4a.1** 点击红色 job 看具体错误
- [ ] **4a.2** 常见错误速查：

| 错误现象 | 原因 | 解决 |
|---------|------|------|
| `build-linux` 失败：`dpkg-deb: 缺少换行` | DEBIAN control 末尾无 `\n` | 已修正（commit 6663220）；如复发，联系我 |
| `build-windows` 失败：`cannot find package` | Go module 问题 | 已修正；如复发，联系我 |
| `build-android` 失败：`JAVA_HOME not set` | 环境变量未注入 | 已修正；如复发，联系我 |
| `build-android` 失败：`ANDROID_KEYSTORE_BASE64 not found` | Secret 未配置 | 回阶段 1.5 确认 |
| `release` 失败：`No matching files` | 上游 job 没产出 | 看上游哪个 job 红了 |

- [ ] **4a.3** 把失败截图 / log 贴回来给我，我能基于具体错误 debug

---

## 阶段 5：验证 RC 产物

- [ ] **5.1** 打开 https://github.com/Yuxin-Luo/MorsePractice/releases/tag/v0.2.0-rc.1
  - 期望：Release 标题 = `v0.2.0-rc.1`
  - 期望：标记为 **"This is a pre-release"**（黄色徽章）
  - 期望：changelog 自动生成（按 Features / Bug Fixes 等分组）
  - 期望：Assets 区有 3 个文件：
    - `morse-practice_0.2.0-rc.1_amd64.deb`
    - `Morse-Practice-0.2.0-rc.1.exe`
    - `morse-practice-0.2.0-rc.1.apk`

- [ ] **5.2** 下载 3 个文件到本地临时目录：
  ```bash
  mkdir -p /tmp/rc-test && cd /tmp/rc-test
  # 在浏览器下载 3 个文件到这里（或用 gh CLI）
  ```

- [ ] **5.3** 验证 .deb（Linux 用户）：
  ```bash
  sudo dpkg -i /tmp/rc-test/morse-practice_0.2.0-rc.1_amd64.deb
  ```
  - 期望输出：`正在设置 morse-practice ...`
  - 启动测试：
    ```bash
    morse-practice &
    ```
  - 期望：浏览器自动打开 `http://127.0.0.1:18765/`，显示摩斯密码练习器
  - 验证离线：断网 → 刷新页面 → 仍能正常工作（资源在 /opt/morse-practice/）
  - 卸载：
    ```bash
    sudo dpkg -r morse-practice
    ```

- [ ] **5.4** 验证 .exe（Windows 用户，找朋友或在虚拟机）：
  - 双击 `Morse-Practice-0.2.0-rc.1.exe`
  - 期望：浏览器打开 → 显示摩斯密码练习器
  - ⚠️ 首次运行会有 SmartScreen 警告："Windows 已保护你的电脑"
    - 点 **"更多信息"** → **"仍要运行"**
  - 关闭浏览器后服务停止

- [ ] **5.5** 验证 .apk（Android 用户，用 adb）：
  ```bash
  adb install /tmp/rc-test/morse-practice-0.2.0-rc.1.apk
  adb shell am start -n com.github.yuxinluo.morsepractice/.MainActivity
  ```
  - 期望：应用启动，显示摩斯密码练习器（通过 TWA / Custom Tabs）
  - ⚠️ 因 `pages.dev` 子域限制，可能是 Custom Tabs 模式（顶部有浏览器栏），不是 100% 全屏

- [ ] **5.6** 如任何验证失败，把现象告诉我；否则进入阶段 6

---

## 阶段 6：RC → 正式 release

> ⚠️ 只有阶段 5 全部通过才能进入这一步

- [ ] **6.1** 删除本地 + 远程 RC tag：
  ```bash
  cd ~/Desktop/LYX/VibeCoding/MorsePractice
  git tag -d v0.2.0-rc.1
  git push origin :refs/tags/v0.2.0-rc.1
  ```
  - 可选：删除 GitHub 上的 RC release
    ```bash
    gh release delete v0.2.0-rc.1 --yes
    # （需要先 `gh auth login`）
    ```

- [ ] **6.2** 升级 package.json 版本号到 0.2.0：
  ```bash
  cd ~/Desktop/LYX/VibeCoding/MorsePractice
  node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('package.json')); p.version='0.2.0'; fs.writeFileSync('package.json', JSON.stringify(p, null, 2)+'\n');"
  cat package.json | head -5
  ```
  - 期望："version": "0.2.0",

- [ ] **6.3** 提交版本号 bump：
  ```bash
  git add package.json
  git commit -m "chore(release): bump version to 0.2.0"
  git push origin main
  ```

- [ ] **6.4** 打正式 tag 并 push（**再次触发 Actions**）：
  ```bash
  git tag v0.2.0
  git push origin v0.2.0
  ```

- [ ] **6.5** 浏览器观察 Actions 跑第二次（5-10 分钟）

---

## 阶段 7：验证正式 release

- [ ] **7.1** 打开 https://github.com/Yuxin-Luo/MorsePractice/releases
  - 期望看到 v0.2.0（**非 pre-release**）
  - 期望 3 个资产 + 自动 changelog

- [ ] **7.2** 验证 .deb（重复阶段 5.3，但用正式版本）：
  ```bash
  cd /tmp && mkdir -p final-test && cd final-test
  # 下载正式 .deb
  sudo dpkg -i morse-practice_0.2.0_amd64.deb
  morse-practice &
  # 验证功能正常
  sudo dpkg -r morse-practice
  ```

- [ ] **7.3** 🎉 **发布完成！** 在 README 或社交媒体分享：
  - https://github.com/Yuxin-Luo/MorsePractice/releases/tag/v0.2.0
  - 或 https://morsepractice.pages.dev

---

## 🎯 完成标准

✅ **全部完成 = 满足以下条件：**

1. https://github.com/Yuxin-Luo/MorsePractice/releases 有 v0.2.0 release
2. 3 个资产可下载且各自能在对应平台运行
3. changelog 自动生成且按 Conventional Commits 正确分组
4. keystore + 密码已备份（不丢）

---

## 📞 任何一步遇到问题

把以下信息贴回来给我：

1. **当前在哪一步**（如 "阶段 4.2 build-android 失败"）
2. **错误截图 / log 关键行**（5-10 行就够）
3. **本地 terminal 输出**（如果 push / tag 报错）

我能直接基于现有 9 个 commits debug，不需要从头开始。

---

## 📂 文件位置速查

| 用途 | 路径 |
|------|------|
| Keystore | `mykEY/morse-practice.keystore`（gitignored） |
| 密码 | `mykEY/password.txt`（gitignored） |
| Keystore base64 | `mykEY/keystore.b64`（gitignored） |
| mykEY 使用文档 | `mykEY/README.md`（公开） |
| 项目根 | `~/Desktop/LYX/VibeCoding/MorsePractice` |
| GitHub 仓库 | https://github.com/Yuxin-Luo/MorsePractice |
| GitHub Actions | https://github.com/Yuxin-Luo/MorsePractice/actions |
| GitHub Secrets | https://github.com/Yuxin-Luo/MorsePractice/settings/secrets/actions |
| 线上站点 | https://morsepractice.pages.dev |

---

**祝发布顺利！🚀**