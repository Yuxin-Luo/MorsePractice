# 摩斯密码练习器 · 开源项目调研

> 调研日期：2026-06-24  
> 调研目的：评估"自建 Web 端摩斯密码练习器"的重复造轮子风险与差异化空间

## 文件结构

```
morse-practice-research-2026-06-24/
├── README.md            ← 本文件
├── index.html           ← 可视化报告（推荐用浏览器打开）
├── data.json            ← 结构化数据（HTML 通过 fetch 加载）
├── REPORT.md            ← Markdown 详细报告
└── raw/                 ← 原始调研数据（97 个 agent jsonl + meta 文件）
    └── agent-*.jsonl    ← 之前 deep-research 工作流跑出的所有 agent 记录
```

## 如何查看

### 🌟 推荐：可视化报告
```bash
# 在文件夹目录下启动一个简单的 HTTP 服务器
cd morse-practice-research-2026-06-24
python3 -m http.server 8000
# 然后浏览器访问 http://localhost:8000
```

或者用 VSCode 的 Live Server 插件打开 `index.html`。

> **注意**：直接双击 `index.html` 打开（`file://` 协议）会因为浏览器的 CORS 策略无法加载 `data.json`，会显示加载失败。请用 HTTP 服务器访问。

### 📄 备选：Markdown 报告
直接查看 `REPORT.md`，包含完整的对比表格和分析。

### 📊 备选：JSON 数据
查看 `data.json`，结构化数据，方便二次处理或导入其他工具。

### 🔬 深度查看：原始数据
`raw/` 文件夹里是 96 个 agent jsonl 文件，每个文件记录了一个 sub-agent 的完整执行轨迹。可以从中看到每个搜索、抓取、验证步骤的输入和输出。

## 调研方法

- **方法**：deep-research 工作流（5 角度并行搜索 → URL 去重 → 抓取 top 来源 → 2 票对抗式验证 → 综合报告）
- **5 个搜索角度**：
  1. 广度检索：star 最高的 Web 端摩斯码练习器
  2. 多模式分层与难度递进
  3. 反向听码练习（键盘/拍发 → 摩斯播放与识别）
  4. 中文与本地化
  5. Cloudflare 静态/Workers 部署 + localStorage 完整闭环
- **覆盖项目**：15+ 个候选 GitHub 仓库
- **验证机制**：2 轮对抗式验证，过滤低质量 / 已失效 / 不相关的项目

## 核心结论（一句话）

> ✅ 值得做。重复造轮子风险低，差异化空间充足。
>
> **MVP 范围**：中文 UI + 三档难度（字母/单词/句子）+ 题目级 localStorage + 纯静态 + Cloudflare Pages
>
> **预计工时**：1-2 周

详细论据见 `REPORT.md` 或 `index.html`。
