# Stage 1：项目骨架

## 目标

搭好项目目录结构、测试工具链、git 仓库，为后续 7 个阶段的开发提供基座。本阶段不写任何业务代码，只确保"开局环境"是正确的。

## 关键文件

- `package.json:1-18` — 声明 vitest + happy-dom 作为 devDependency，加 `"test"` 脚本
- `vitest.config.js:1-9` — 配置 happy-dom 测试环境（为后续 DOM 触发的模块如 localStorage、AudioContext 准备）
- `.gitignore:1-20` — 排除 `node_modules/`、`coverage/`、`ReferenceRepositories/`、`.env` 等
- `.editorconfig:1-14` — 统一缩进（2 空格）、UTF-8、LF、文件末尾换行
- `dev-docs/README.md:1-58` — 总体开发文档入口
- `README.md:1-50` — 对外的项目说明

## 设计决策

- **`"type": "module"`** — package.json 加这个字段，让 `.js` 文件默认按 ES Module 解析（浏览器和 Node 一致行为）
- **vitest 而非 jest** — 原生支持 ES Module、配置更轻量、watch 体验更好
- **happy-dom 而非 jsdom** — 更快、更轻、API 兼容度满足 localStorage 测试需求
- **不引入 vite/webpack** — 与"零构建"原则一致，Cloudflare Pages 可直接部署整个目录
- **.gitignore 提前排除 ReferenceRepositories** — 调研阶段的本地参考仓库不进版本控制

## 测试

当前阶段无单元测试。Stage 2 起会逐步加入 `tests/encoder.test.js`、`tests/audio.test.js` 等。

## 借鉴的参考

无（纯基础设施搭建）。

## 已知限制

- `python3 -m http.server` 是用 Python 起本地服务器，仅用于开发；生产环境用 Cloudflare Pages
- 没有 CI 配置（`wrangler pages deploy` 时 Cloudflare 自带构建）

## 下一阶段衔接

Stage 2（摩斯引擎）会创建 `src/core/morse-table.js` 和 `src/core/encoder.js`，并写入 `tests/encoder.test.js`。本阶段提供的 vitest + happy-dom 环境会被直接复用。
