# Cloudflare Pages 部署设计

**日期**: 2026-06-24
**状态**: 已批准,待实施
**目标**: 把 morse-practice 静态站点部署到 Cloudflare Pages,使所有访问者可通过公开 URL 体验 demo。

---

## Context

摩斯密码练习器是一个纯前端 SPA:

- 入口 `index.html` + ES Modules(`src/main.js` 及其子模块) + 单个 CSS 文件
- **零后端**:无 `fetch` / XHR / axios,所有持久化用 `localStorage`
- **零构建步骤**:`package.json` 的 dev script 是 `python3 -m http.server 8000`,只服务源文件
- 数据(`words.js` / `sentences.js`)是 JS 模块,直接 import

这是 Cloudflare Pages 静态托管的教科书场景,不需要 Workers / D1 / KV / R2。

## 决策汇总

| 维度 | 选择 | 理由 |
|---|---|---|
| Cloudflare 产品 | **Pages**(静态) | 无服务端代码;Workers 是 over-kill |
| 部署触发 | **Git 集成自动部署** | push 后 30s 内生效;无需本地 wrangler |
| 域名 | **默认 `*.pages.dev`** | 免费 + 自动 HTTPS + CDN |
| 构建步骤 | **不构建** | ES Modules + 小体积,CF 自动 Brotli 压缩收益已足够 |
| 预览环境 | **仅生产** | PR 预览对当前规模不必要 |

## 架构

```
用户浏览器
   │
   │ HTTPS (Brotli + 边缘缓存)
   ▼
Cloudflare CDN 边缘节点(全球 300+ POP)
   │
   │ 静态文件回源
   ▼
Cloudflare Pages (Git 集成,生产分支 = main)
   │
   │ 自动部署:git push origin main → 30s 内生效
   ▼
GitHub: Yuxin-Luo/MorsePractice
```

## 涉及文件

### 新增
- `wrangler.toml`(可选,推荐)— Pages 项目配置,便于在版本控制中记录部署设置
- `.pagesignore`(可选)— 显式排除不上传的路径(双保险,即便 `.gitignore` 不生效)
- `docs/superpowers/specs/2026-06-24-cloudflare-pages-deployment-design.md`(本文档)

### 不变
- `index.html` / `src/` / `styles/` / `dev-docs/` — 直接部署
- `package.json` / `node_modules/` / `tests/` / `.git/` / `ReferenceRepositories/` — 已被 `.gitignore` 排除

## 部署配置

### `wrangler.toml`(推荐新增)
```toml
name = "morse-practice"
pages_build_dir = "."
compatibility_date = "2026-06-24"

[build]
# 无构建命令,直接发布源文件
```

### `.pagesignore`(可选双保险)
```
node_modules/
tests/
.git/
ReferenceRepositories/
*.log
.DS_Store
```

## 部署步骤(用户手动操作)

1. **登录** https://dash.cloudflare.com
2. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. 选择 **GitHub** → 授权 → 选 `Yuxin-Luo/MorsePractice` 仓库
4. **Project name**: `morse-practice`(决定 URL 子域,不可改)
5. **Production branch**: `main`
6. **Build settings**:
   - Framework preset: **None**
   - Build command:**留空**
   - Build output directory:**留空**(或 `/`)
7. **Save and Deploy** → 等待首次构建(约 30-60s)
8. 获得 URL: `https://morse-practice.pages.dev`

## 数据流与隐私

- 用户首次访问 → CF 边缘返回静态 HTML/JS/CSS(命中缓存即 0 回源)
- 用户练习进度 → 写入浏览器 `localStorage`,**不上传到任何服务器**
- 隐私:Cloudflare 看到的是静态资源 GET 请求,不含任何用户练习数据

## 缓存策略

- 默认:Cloudflare Pages 静态资源缓存由 CF 自动管理(边缘 2 小时,客户端 1 年 immutable)
- `index.html` 不缓存(`max-age=0`),确保更新立即生效
- 现有 `?v=N` 手动 cache-bust 仍保留作为内容版本标记

## 错误处理

| 场景 | 表现 | 处理 |
|---|---|---|
| 首次部署失败 | Dashboard 显示 build log | 检查 Build output directory 设置 |
| 旧版缓存 | 用户看到旧版本 | bump HTML 中 `?v=N` 或等 CF 边缘过期 |
| GitHub webhook 失败 | Dashboard 显示 disconnected | 重新授权 GitHub App |
| 需要回滚 | 任何历史版本 | Dashboard → Deployments → Rollback |

## 验证清单

部署后逐项确认:

- [ ] `https://morse-practice.pages.dev` 返回 200,正常加载
- [ ] 四个模式可用:
  - 看码打字:输入 → 提交 → 计分
  - 听码打字:播放 → 输入 → 提交
  - 翻译器:实时互译
  - 拍码练习:Space 拍码 + 目标练习提交
- [ ] DevTools Network:所有资源 200,JS/CSS Brotli 压缩(content-encoding: br)
- [ ] Lighthouse:Performance / Accessibility / Best Practices ≥ 90
- [ ] localStorage 数据隔离:不同浏览器/隐私窗口数据独立

## 后续维护

- **更新内容**:常规 git workflow → `git push origin main` → CF 自动部署
- **域名升级**:若以后想用自定义域名,在 Pages 项目 → Custom domains 添加,CF 自动签证书
- **监控**:CF Dashboard → Pages → 项目 → Analytics 提供请求量/带宽/错误率面板
