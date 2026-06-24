# Morse Practice · 开发文档

> 本目录记录每个开发模块的设计决策、实现细节、测试方法、已知限制和借鉴的参考。

## 模块清单

| # | 阶段 | 模块 | 状态 | 文档 |
|---|------|------|------|------|
| 01 | Stage 1 | 项目骨架 | 🟢 进行中 | [01-skeleton.md](./01-skeleton.md) |
| 02 | Stage 2 | 摩斯引擎（编解码 + 时序）| ⏳ 待开发 | [02-morse-engine.md](./02-morse-engine.md) |
| 03 | Stage 3 | 音频引擎（Web Audio） | ⏳ 待开发 | [03-audio-engine.md](./03-audio-engine.md) |
| 04 | Stage 4 | 正向练习模式（letter/word/sentence） | ⏳ 待开发 | [04-forward-mode.md](./04-forward-mode.md) |
| 05 | Stage 5 | localStorage 进度持久化 | ⏳ 待开发 | [05-progress-storage.md](./05-progress-storage.md) |
| 06 | Stage 6 | i18n（中英双语）| ⏳ 待开发 | [06-i18n.md](./06-i18n.md) |
| 07 | Stage 7 | 听码反向模式（固定题库）| ⏳ 待开发 | [07-listen-mode.md](./07-listen-mode.md) |
| 08 | Stage 8 | Cloudflare Pages 部署 | ⏳ 待开发 | [08-deployment.md](./08-deployment.md) |

## 当前进度

**Stage 1：项目骨架** 🟢

## 快速开始

```bash
# 本地开发
cd ..
python3 -m http.server 8000

# 跑测试
npm test
```

## 总体架构

```
MorsePractice/
├── index.html              # 应用入口
├── src/
│   ├── main.js             # 启动 + 路由
│   ├── core/               # 纯函数 + 引擎
│   ├── modes/              # 练习模式
│   ├── storage/            # 持久化
│   ├── i18n/               # 双语
│   ├── data/               # 静态题库
│   └── ui/                 # UI 控制器
├── tests/                  # vitest 单元测试
├── dev-docs/               # ← 你正在看这个
├── styles/                 # CSS
└── README.md               # 对外的项目说明
```

## 设计原则

1. **零构建** — 浏览器原生 ES Module，无 webpack/vite/rollup 介入
2. **纯函数优先** — 摩斯编解码、判分、统计都是纯函数，便于测试
3. **Web Audio API 直用** — 不用 Tone.js 等音频框架，依赖最少
4. **i18n 内建** — 所有 UI 字符串从一开始就通过 `t('key')` 调用
5. **localStorage 唯一持久层** — 不引入 IndexedDB / Dexie

## 借鉴的参考

调研报告见 [`../morse-practice-research-2026-06-24/REPORT.md`](../morse-practice-research-2026-06-24/REPORT.md)。

本地克隆的参考仓库位于 `../ReferenceRepositories/`（已 `.gitignore` 排除），主要包括：
- `morse-code-trainer/` — MORSE 表 + encode/decode/timing 范式
- `morsewalker/` — Web Audio OscillatorNode + Farnsworth 时序公式
- `morse-code-translator/` — 多字符表 + 单元测试结构
- `xmorse/` — 摩斯 + Unicode 思路
- `morse-trainer/` — 练习记录 schema
