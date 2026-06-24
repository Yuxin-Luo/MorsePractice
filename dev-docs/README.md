# Morse Practice · 开发文档

> 本目录记录每个开发模块的设计决策、实现细节、测试方法、已知限制和借鉴的参考。

## 模块清单

| # | 阶段 | 模块 | 状态 | 文档 |
|---|------|------|------|------|
| 01 | Stage 1 | 项目骨架 | ✅ | [01-skeleton.md](./01-skeleton.md) |
| 02 | Stage 2 | 摩斯引擎（编解码 + 时序）| ✅ | [02-morse-engine.md](./02-morse-engine.md) |
| 03 | Stage 3 | 音频引擎（Web Audio） | ✅ | [03-audio-engine.md](./03-audio-engine.md) |
| 04 | Stage 4 | 正向练习模式（letter/word/sentence） | ✅ | [04-forward-mode.md](./04-forward-mode.md) |
| 05 | Stage 5 | localStorage 进度持久化 | ✅ | [05-progress-storage.md](./05-progress-storage.md) |
| 06 | Stage 6 | i18n（中英双语）| ✅ | [06-i18n.md](./06-i18n.md) |
| 07 | Stage 7 | 听码反向模式（固定题库）| ✅ | [07-listen-mode.md](./07-listen-mode.md) |
| 09 | Stage 9 | 音频原语扩展（playTone）| ✅ | [09-tone-primitives.md](./09-tone-primitives.md) |
| 10 | Stage 10 | 编码器扩展（getPossibleChars）| ✅ | [10-encoder-extras.md](./10-encoder-extras.md) |
| 11 | Stage 11 | 摩斯↔字母翻译页 | ✅ | [11-translator.md](./11-translator.md) |
| 12 | Stage 12 | 手键拍码页（free + practice）| ✅ | [12-straightkey.md](./12-straightkey.md) |
| 13 | Stage 13 | 4-tab 路由 + Space 键 gate | ✅ | [13-routing.md](./13-routing.md) |
| 14 | Stage 14 | 移动端 fallback（pointer events）| ✅ | [14-mobile-fallback.md](./14-mobile-fallback.md) |
| 08 | Stage 8 | Cloudflare Pages 部署 | ⏳ 待开发（需要账号） | [08-deployment.md](./08-deployment.md) |

## 当前进度

**v1 + v2 已完成。** 4 个 tab（看码打字 / 听码打字 / 翻译 / 拍码）全部上线，155 测试通过。待办：Stage 8 部署。

## 快速开始

```bash
# 本地开发（用 dev-server.py 发 no-cache 头，避免 ESM 缓存问题）
cd ..
python3 dev-server.py 8000
# 浏览器打开 http://localhost:8000

# 跑测试
npm test
```

## 总体架构

```
MorsePractice/
├── index.html              # 应用入口（4-tab nav + 4 个 page section）
├── src/
│   ├── main.js             # 启动 + 路由
│   ├── core/
│   │   ├── encoder.js      # 摩斯编解码 + 时序 + getPossibleChars
│   │   ├── audio.js        # playMorse / stop / playTone / stopTone
│   │   └── morse-table.js  # MORSE + FROM_MORSE
│   ├── modes/
│   │   ├── forward.js      # 正向（看码打字）3 档
│   │   ├── listen.js       # 听码反向 3 档
│   │   ├── translator.js   # 摩斯↔字母双向 live 翻译
│   │   └── straightkey.js  # 直键拍码（自由 + 目标练习）
│   ├── storage/progress.js # localStorage 累计统计
│   ├── i18n/               # 双语（zh + en）
│   ├── data/               # 静态题库
│   └── ui/app.js           # 主控制器（含 4-tab 路由 + Space gate）
├── tests/                  # vitest 单元测试（10 个文件）
├── dev-docs/               # ← 你正在看这个
├── styles/main.css         # 浅色主题样式
└── README.md               # 对外的项目说明
```

## 4 个 Tab 一览

| Tab | 用途 | 用户操作 | 键盘交互 |
|-----|------|---------|---------|
| **看码打字** | 看摩斯码 → 输入目标字符 | 输完按 Enter | Space 播放 / R 重试 / N 下一题 / P 上一题 |
| **听码打字** | 听摩斯码 → 输入目标字符 | 输完按 Enter | 同上 |
| **翻译** | 文本 ↔ 摩斯码双向 live | 在任一侧输入 | (无快捷键) |
| **拍码** | 按住空格拍码发声 | 自由拍 / 目标练习 | **Space 占用**（按住的瞬间发声） |

## 设计原则

1. **零构建** — 浏览器原生 ES Module，无 webpack/vite/rollout 介入
2. **纯函数优先** — 摩斯编解码、判分、统计都是纯函数，便于测试
3. **Web Audio API 直用** — 不用 Tone.js 等音频框架，依赖最少
4. **i18n 内建** — 所有 UI 字符串从一开始就通过 `t('key')` 调用
5. **localStorage 唯一持久层** — 不引入 IndexedDB / Dexie
6. **状态机与 DOM 解耦** — 直键拍码是纯状态机；UI 只是渲染器
7. **per-direction 偏好隔离** — toggle、showAnswer 等按方向分别存 localStorage
8. **移动端 fallback** — 直键拍码同时支持键盘 + 屏幕按钮（pointer events）

## 借鉴的参考

调研报告见 [`../morse-practice-research-2026-06-24/REPORT.md`](../morse-practice-research-2026-06-24/REPORT.md)。

本地克隆的参考仓库位于 `../ReferenceRepositories/`（已 `.gitignore` 排除），主要包括：
- `morse-code-trainer/` — MORSE 表 + encode/decode/timing 范式
- `morsewalker/` — Web Audio OscillatorNode + Farnsworth 时序公式
- `morse-code-translator/` — 多字符表 + 单元测试结构
- `xmorse/` — 摩斯 + Unicode 思路
- `morse-trainer/` — 练习记录 schema