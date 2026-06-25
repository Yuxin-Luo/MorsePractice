#!/usr/bin/env python3
"""
Bubblewrap init 非交互 wrapper

背景：Bubblewrap 1.24.x 的 `init --manifest=<URL>` 必须交互式填 ~20 个 prompt。
   - 即使 manifest 含完整 host/startUrl，init 仍问 Domain 等
   - init 默认 domain 从 manifest URL 提取（= HTTP server 的 127.0.0.1:8765）
     被 validateHost 拒绝 → Enter 接受也错
   - inquirer 不读 stdin EOF → 直接 pipe 不行

策略：用 pexpect 模拟 TTY，对每个 prompt 按"提示词"匹配，发送对应的答案。
   - "Domain" → 从 twa-manifest.json 的 host 字段读
   - "URL path" → 从 startUrl 字段读
   - 其他全部发 Enter 接受默认

调用：bw_init.py <bubblewrap-args...>
  例：bw_init.py bubblewrap init --manifest=http://127.0.0.1:8765/twa-manifest.json
"""
import json
import os
import re
import sys
import pexpect


def read_manifest_value(manifest_url, field):
    """从 manifest_url 抓 JSON，读指定字段"""
    import urllib.request
    try:
        with urllib.request.urlopen(manifest_url, timeout=5) as r:
            data = json.loads(r.read().decode("utf-8"))
            return data.get(field, "")
    except Exception as e:
        print(f"→ warn: failed to fetch manifest: {e}", file=sys.stderr)
        return ""


def find_manifest_arg(args):
    """从 cli args 找 --manifest=<URL>"""
    for a in args:
        m = re.match(r"--manifest[= ]?(.*)", a)
        if m:
            url = m.group(1).strip()
            if url:
                return url
    return None


def main():
    if len(sys.argv) < 2:
        print("Usage: bw_init.py <bubblewrap init args...>", file=sys.stderr)
        sys.exit(1)

    cmd_args = sys.argv[1:]
    manifest_url = find_manifest_arg(cmd_args)

    # 提前读 manifest 拿到 host / startUrl 等
    host = ""
    start_url = "/"
    name = "App"
    launcher_name = "App"
    package_id = "com.example.app"
    app_version = "1.0.0"

    if manifest_url:
        print(f"→ Reading manifest: {manifest_url}", file=sys.stderr)
        manifest = None
        try:
            with urllib.request.urlopen(manifest_url, timeout=5) as r:
                manifest = json.loads(r.read().decode("utf-8"))
        except Exception:
            # 也支持本地文件
            try:
                local = manifest_url.replace("http://127.0.0.1:8765/", "")
                local = re.sub(r"^http://[^/]+/", "", manifest_url)
                with open(local) as f:
                    manifest = json.loads(f.read())
            except Exception as e:
                print(f"→ warn: cannot read manifest: {e}", file=sys.stderr)

        if manifest:
            host = manifest.get("host", "")
            start_url = manifest.get("startUrl", "/")
            name = manifest.get("name", "App")
            launcher_name = manifest.get("launcherName", name)
            package_id = manifest.get("packageId", "com.example.app")
            app_version = manifest.get("appVersion", "1.0.0")

    print(f"→ host={host} startUrl={start_url} packageId={package_id} appVersion={app_version}",
          file=sys.stderr)

    # Prompt → 答案 映射（按出现顺序匹配）
    # 命中即发送对应答案，发送完发 \r 提交
    PROMPT_HANDLERS = [
        (r"\bDomain\b[:?]?", host),
        (r"\bURL path\b[:?]?", start_url),
        (r"\bName\b[:?]?", name),
        (r"\bLauncher name\b[:?]?", launcher_name),
        (r"\bApplication ID\b[:?]?", package_id),
        (r"\bApp version\b[:?]?", app_version),
        (r"\bVersion code\b[:?]?", "1"),
        (r"\bTheme color\b[:?]?", "#6c5ce7"),
        (r"\bBackground color\b[:?]?", "#f7f8fc"),
        (r"\bSplash color\b[:?]?", "#6c5ce7"),
        (r"\bDisplay mode\b[:?]?", ""),       # choice - Enter 选第一项
        (r"\bOrientation\b[:?]?", ""),       # choice - Enter 选第一项
        (r"\bIcon URL\b[:?]?", ""),          # 用 manifest 默认
        (r"\bMaskable icon URL\b[:?]?", ""),  # 跳过（maskable 可选）
        (r"\bMonochrome icon URL\b[:?]?", ""),
        (r"\bSigning key path\b[:?]?", ""),  # build 阶段传 keystore，init 跳过
        (r"\bSigning key alias\b[:?]?", ""),
        (r"\bKey password\b[:?]?", ""),       # 同上
    ]

    # 通用 fallback：Enter 接受默认
    GENERIC_PATTERNS = [
        r"\?\s+\(?\S*\)?\s*[\s:]*$",
        r"\[?Y/n\]?\s*$",
        r"\[?y/N\]?\s*$",
        r"Password:\s*$",
        r"Again:\s*$",
        r"Press ENTER",
    ]

    cmd = " ".join(cmd_args)
    print(f"→ Spawn: {cmd}", file=sys.stderr, flush=True)

    child = pexpect.spawn(
        cmd,
        timeout=300,
        encoding=None,  # bytes 模式
        dimensions=(40, 120),
        echo=False,
    )
    child.logfile_read = sys.stdout.buffer

    max_iter = 60
    for i in range(max_iter):
        all_patterns = [p for p, _ in PROMPT_HANDLERS] + GENERIC_PATTERNS + [pexpect.EOF, pexpect.TIMEOUT]
        try:
            idx = child.expect(all_patterns, timeout=30)
        except pexpect.exceptions.ExceptionPexpect as e:
            print(f"→ pexpect error after {i} prompts: {e}", file=sys.stderr)
            break

        if idx < len(PROMPT_HANDLERS):
            pattern, response = PROMPT_HANDLERS[idx]
            print(f"→ [{i}] matched prompt pattern: {pattern!r} → sending: {response!r}",
                  file=sys.stderr, flush=True)
            if response:
                child.sendline(response)
            else:
                child.sendline("")  # 空 = Enter 接受默认
        elif idx < len(PROMPT_HANDLERS) + len(GENERIC_PATTERNS):
            pattern = GENERIC_PATTERNS[idx - len(PROMPT_HANDLERS)]
            print(f"→ [{i}] matched generic pattern: {pattern!r} → sending Enter",
                  file=sys.stderr, flush=True)
            child.sendline("")
        else:
            # EOF / TIMEOUT
            print(f"→ init stream ended after {i} prompts", file=sys.stderr)
            break

    child.close(force=False)
    rc = child.exitstatus if child.exitstatus is not None else 0
    print(f"→ init exit code: {rc}", file=sys.stderr)
    sys.exit(rc)


import urllib.request  # noqa: E402

if __name__ == "__main__":
    main()