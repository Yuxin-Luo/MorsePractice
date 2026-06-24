# Morse Practice · 摩斯密码练习器

A web-based Morse code practice tool with three difficulty tiers (letter / word / sentence) and bilingual (zh/en) UI. Built with **pure ES Modules + Vanilla JavaScript** — no build step required, deploys to Cloudflare Pages as a static site.

> 🎯 目标：让学习摩斯密码的朋友有一个清晰、可累积、中文化的练习工具。

## ✨ 特性

- **3 档正向练习**：看摩斯码 → 拼字母/单词/句子
- **3 档听码反向**：听摩斯码 → 键入听到的内容
- **进度持久化**：localStorage 记录每题对错、字符级统计
- **中英双语 UI**：所有界面文字可切换
- **零构建**：纯 ES Module，浏览器原生支持
- **零后端**：可一键部署到 Cloudflare Pages

## 🚀 本地运行

```bash
# 启动本地服务器（推荐，避开 file:// 协议的 CORS 限制）
python3 -m http.server 8000
# 浏览器访问 http://localhost:8000

# 跑测试
npm install
npm test
```

## 📦 部署

```bash
npx wrangler pages deploy .
```

详细部署步骤见 [`dev-docs/08-deployment.md`](dev-docs/08-deployment.md)。

## 📁 项目结构

```
src/
├── core/       # 摩斯引擎 + 音频引擎（纯函数）
├── modes/      # 正向 + 听码两种练习模式
├── storage/    # localStorage 进度持久化
├── i18n/       # 中英双语
├── data/       # 静态词库/句库
├── ui/         # UI 控制器
└── main.js     # 入口

tests/          # vitest 单元测试
dev-docs/       # 开发文档（每模块一份 MD）
```

## 📚 开发文档

详见 [`dev-docs/`](dev-docs/) 目录，每一阶段的实现细节都有对应 MD。

## 📄 License

MIT
