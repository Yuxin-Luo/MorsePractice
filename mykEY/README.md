# `mykEY/` — 本地密钥与凭证目录

> ⚠️ **本目录被 `.gitignore` 忽略 — 文件永不进入 git。**
> 整目录需手动备份到 1Password / Bitwarden / 加密 USB。

## 文件清单

| 文件 | 用途 | 备份？ |
|------|------|--------|
| `morse-practice.keystore` | Android 签名 keystore（RSA 2048 / 10000 天有效期） | **必备份** |
| `password.txt` | keystore 密码（storepass = keypass，32 字符随机） | **必备份** |
| `keystore.b64` | base64 编码的 keystore，给 GitHub Secrets 用 | 可重新生成 |

## 备份清单

最少必须备份的 **2 个文件**：

1. `mykEY/morse-practice.keystore`
2. `mykEY/password.txt`

丢了这 2 个文件中的任何一个 = **无法升级已发布的 APK**（用户必须卸载重装）。

## 重新生成 `keystore.b64`

```bash
base64 -w 0 mykEY/morse-practice.keystore > mykEY/keystore.b64
```

然后到 https://github.com/Yuxin-Luo/MorsePractice/settings/secrets/actions 更新 `ANDROID_KEYSTORE_BASE64` secret。

## 完整重新生成 keystore

```bash
# 生成新 keystore（需要输入 storepass 和 keypass）
keytool -genkey -v \
  -keystore mykEY/morse-practice.keystore \
  -alias morse-practice \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Yuxin Luo, OU=Personal, O=MorsePractice, L=City, S=State, C=CN"

# 提取 SHA-256
keytool -list -v -keystore mykEY/morse-practice.keystore \
  | grep "SHA256:" | awk '{print $2}' | tr -d ':'

# 把新 SHA-256 写入 .well-known/assetlinks.json（去掉冒号 + 大写）
```

⚠️ **重新生成 keystore = 不同签名 = 无法覆盖旧版本**。仅在原 keystore 丢失且接受用户卸载重装时才这样做。

## GitHub Secrets 配置

仓库设置 → Secrets and variables → Actions → New repository secret：

| Secret Name | 值来源 |
|-------------|--------|
| `ANDROID_KEYSTORE_BASE64` | `cat mykEY/keystore.b64` |
| `ANDROID_KEYSTORE_PASS` | `cat mykEY/password.txt` |
| `ANDROID_KEY_PASS` | `cat mykEY/password.txt`（同密码） |

## 使用示例

本地构建 APK：

```bash
export KEYSTORE_FILE="$PWD/mykEY/morse-practice.keystore"
export KEYSTORE_PASS=$(cat mykEY/password.txt)
export KEY_PASS=$(cat mykEY/password.txt)
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64  # 或 JDK 17
echo '{"jdkPath":"'"$JAVA_HOME"'","androidSdkPath":""}' > ~/.bubblewrap/config.json

bash release/scripts/build-android.sh
```

## 安全检查清单

- [ ] 三个文件都已备份到密码管理器 / 加密 USB
- [ ] GitHub Secrets 已配置（特别是 `ANDROID_KEYSTORE_BASE64`）
- [ ] 未把任何文件 commit 到 git（`git status` 不应显示 mykEY/）
- [ ] 旧 release 用的旧 keystore 仍在（如果有发布历史）