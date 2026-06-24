# 摩斯密码练习器 - 开源项目调研报告

> 调研日期：2026/06/24  
> 调研方法：5 个角度并行搜索 + 来源抓取 + 2 轮对抗式验证  
> 调研范围：GitHub 上 Web 端 / 静态站 / 摩斯码练习 / 摩斯码训练相关项目

---

## 一、候选项目对比表

| # | 项目 | ⭐ Star | 技术栈 | 多模式（字母/单词/句子）| localStorage 进度 | 听码反向 | 中文支持 | Cloudflare 部署 | 维护状态 | 功能覆盖度（满分5）|
|---|------|---------|--------|--------------------------|-------------------|----------|----------|------------------|----------|---------------------|
| 1 | [hustcc/xmorse](https://github.com/hustcc/xmorse) | 326 | JS 库 | ❌ 仅编解码 | ❌ | ❌ | ⚠️ 名称相关 | ❌ | 已停更（最后提交 2020/02）| 1.5 |
| 2 | [hmatuschek/kochmorse](https://github.com/hmatuschek/kochmorse) | 93 | **C++ 桌面** | ⚠️ Koch 字符递进（不是题目长度）| ⚠️ 有进度 | ❌ | ❌ | ❌ | **2026/06 已 archive** | 1.5 |
| 3 | [sc0tfree/morsewalker](https://github.com/sc0tfree/morsewalker) | 49 | 纯 JS + Web Audio | ⚠️ 模式按"呼号格式"切（POTA/SST/CWT），不是按字符长度 | ❌ | ❌ | ❌ | ⚠️ 静态构建，但未配 Cloudflare | 活跃（针对 CW 竞赛）| 2.0 |
| 4 | [knyar/morse-learn](https://github.com/knyar/morse-learn) | — | 静态页 | ❌ 文本↔码展示 | ❌ | ❌ | ❌ | ❌ | 早期教学示例 | 1.0 |
| 5 | [googlecreativelab/morse-learn](https://github.com/googlecreativelab/morse-learn) | — | Android（GDE 时期）| ❌ | ❌ | ❌ | ❌ | ❌ | 演示项目 | 1.0 |
| 6 | [ozdemirburak/morse-code-translator](https://github.com/ozdemirburak/morse-code-translator) | — | 多语言字符表 | ❌ 翻译器 | ❌ | ❌ | ❌ | ❌ | 较新 | 1.0 |
| 7 | [robalb/morsechat](https://github.com/robalb/morsechat) | — | Node/JS | ❌ 聊天应用 | ❌ | ❌ | ❌ | ❌ | — | 0.5 |
| 8 | [John-Lin/morse-code-trainer](https://github.com/John-Lin/morse-code-trainer) | — | Web | ❌ | ❌ | ❌ | ❌ | ❌ | 一般 | 1.0 |
| 9 | [morse-crypto/morse-code-translator](https://github.com/morse-crypto/morse-code-translator) | — | Web | ❌ 单页工具 | ❌ | ❌ | ❌ | ❌ | 一般 | 0.5 |
| 10 | [Yuffster/morse_trainer](https://github.com/Yuffster/morse_trainer) | 3 | 纯 JS | ❌ NATO 字母播放器 | ❌ | ❌ | ❌ | ❌ 部署在 AWS S3 | **2016 后无人维护** | 0.5 |
| 11 | [entitybtw/morse-trainer](https://github.com/entitybtw/morse-trainer) | 2 | 纯 HTML/CSS/JS | ⚠️ 键盘 vs 拍键 两种输入 | ❌ | ⚠️ 拍键 → 识别 | ❌ | ⚠️ 静态可部署 | 较新 | 1.5 |
| 12 | [tioguerra/morse-code-trainer](https://github.com/tioguerra/morse-code-trainer) | 0 | SvelteKit + TS + Web Audio + **Dexie(IndexedDB)** + Tailwind v4 | ❌ | ⚠️ 用 IndexedDB 不用 localStorage | ❌ | ❌ | ⚠️ demo 部署在 GitHub Pages | **2026/05 新建，仅 4 commit** | 2.0 |
| 13 | [prasad-droid/Morse-Type](https://github.com/prasad-droid/Morse-Type) | 0 | 纯 JS + Web Audio | ⚠️ 仅 time vs word 两种模式 | ❌ | ❌ | ❌ | ⚠️ 静态可部署 | 极早期（2 commit）| 1.0 |
| 14 | [nerd-bear/Ditdah.uk](https://github.com/nerd-bear/Ditdah.uk) | 0 | Svelte/SvelteKit | ❌ 拍键 → 实时识别 | ❌ | ✅ 拍键 → 文本 | ❌ | ❌ 部署在 Vercel | **2025/03 新建** | 1.5 |
| 15 | [donblennon/morse-code-practice](https://github.com/donblennon/morse-code-practice) | — | — | — | — | — | — | — | **404，已删除** | 0 |

---

## 二、关键空缺（已被验证的事实）

### ✅ 验证 1：中文摩斯是真正的"无人区"
- GitHub 官方 `chinese-morse-code` topic：**0 个仓库**
- 用 `morse 中文`、`morse 汉字`、`摩斯码 练习` 等关键词搜索，唯一稳定出现的只有 **hustcc/xmorse**（326★，但是 JS 库，非应用）
- **结论**：中文 UI + 摩斯练习器 这个交集，目前确实没有竞品

### ✅ 验证 2：多模式"长度递进（字母→单词→句子）"也基本没人做
- `sc0tfree/morsewalker` 的模式是按"呼号场景"切（POTA/CWT/SST），不是按题目长度切
- `prasad-droid/Morse-Type` 只有 `time` vs `word` 两种模式
- `hmatuschek/kochmorse` 是按 Koch 字符集递进（不是按题目长度），且是 C++ 桌面 + 已 archive
- **结论**：你计划的"字母 → 单词 → 句子"三档长度递进，没有项目完整覆盖

### ✅ 验证 3："多模式 + localStorage + Cloudflare 一键部署" 完整闭环 — 0 命中
- GitHub 直接搜 `morse code practice localStorage` → **0 结果**
- 搜 `morse code cloudflare` → 没有项目自描述这三个关键词同时出现
- 现有项目要么缺 localStorage，要么用 IndexedDB（Dexie），要么部署在 S3 / Vercel / GitHub Pages
- **结论**：你想要的"零后端 + localStorage + Cloudflare Pages 一键部署"组合，**无人做过**

### ✅ 验证 4：听码反向（音频/拍键 → 识字）方向极冷门
- 只有 **Ditdah.uk**（0★，5 commit，2025/03）直接做 paddle/straight-key → 实时解码
- `entitybtw/morse-trainer` 算半个（键盘 vs 拍键 两种输入模式），但 2★
- **结论**：你若做"听码识字"方向，确实有空间

---

## 三、对你计划的判断

### 🟢 重复造轮子风险：**低**

| 维度 | 你要做的 | 已有项目 | 风险评估 |
|------|----------|----------|----------|
| 字母↔码互转 | ✅ | 多数项目都有 | 🟡 同质化，但基础功能 |
| 字母/单词/句子 三档 | ✅ | **无人做完整** | 🟢 差异化亮点 |
| 对错判断 | ✅ | 多数没有 | 🟢 差异化亮点 |
| 题目级 重试/上/下题 | ✅ | **无人做** | 🟢 差异化亮点 |
| localStorage 进度 | ✅ | 多数没做（tioguerra 用 IndexedDB）| 🟢 差异化亮点 |
| Cloudflare 部署 | ✅ | **无人明确支持** | 🟢 差异化亮点 |
| 中文 UI | ✅ | **无人做** | 🟢🟢 蓝海 |
| 听码反向（可选）| ✅ | 极冷门 | 🟢 蓝海 |

---

## 四、推荐差异化落地点

按"投入产出比"从高到低排序：

### 1. 🏆 中文 UI（最高 ROI）
- 目前 GitHub 0 个竞品
- 实现成本：仅需双语字符串表，不增加逻辑复杂度
- 效果：直接面向你的目标用户（"和我一样学习摩斯的志同道合的朋友"）

### 2. 🏆 显式三档难度递进（高 ROI）
- 数据模型：`{ mode: 'letter' | 'word' | 'sentence', item, level }`
- 题库策略：
  - **letter**：26 字母 + 0-9 数字 → 随机
  - **word**：TOP 500 常用英文单词 + 1-3 字母 → 随机
  - **sentence**：从短句（"I AM FINE"）到长句（"QUICK BROWN FOX"）分 3-4 级
- 题目级导航：每道题独立的"对/错/重试/上/下"状态

### 3. 🏆 题目级 localStorage 进度（高 ROI）
- localStorage key 设计：
  ```js
  morse.v1.progress   // 总体进度：{ letter: 0.85, word: 0.40, sentence: 0.10 }
  morse.v1.history    // 错题本：[{ qid, mode, item, userAnswer, correct, ts }]
  morse.v1.current    // 当前题：{ qid, mode, item, attempts }
  ```
- 关键差异：题目级 history（而非 session 级），让用户看到"哪些字符我老错"

### 4. 🥈 Cloudflare Pages 零配置部署（中 ROI）
- 技术选型：纯 HTML + ES Module + 少量 CSS，**不用 React/Vue**
- 把 `_headers`、`_redirects`、`wrangler.toml` 直接写进仓库
- README 写"Click to Deploy"按钮（Cloudflare 官方支持）
- 部署成本：< 5 分钟

### 5. 🥉 听码反向模式（可选，长尾 ROI）
- Web Audio API + OscillatorNode 生成 CW
- 用户输入听到的字母
- 进阶：Koch method 自适应字符集

### ❌ 不建议做
- 复杂 React/Vue 框架（拖慢首屏、增加部署门槛）
- 摩斯码编解码库（用 xmorse 或自己写 50 行就够）
- 多字符表（土耳其文/阿拉伯文等）扩展——除非你要做 i18n 国际化

---

## 五、技术栈建议

基于上面 14 个项目的"幸存者偏差"分析：

| 选择 | 建议 | 理由 |
|------|------|------|
| 框架 | **纯 HTML + ES Module** | 静态站、Cloudflare Pages 友好、首屏快 |
| 样式 | **Tailwind via CDN 或 Pico.css** | 不用构建链 |
| 音频 | **Web Audio API（OscillatorNode）** | 摩码的标准做法，零依赖 |
| 存储 | **localStorage**（v1 即可）| 简单、Cloudflare 静态站直接可用 |
| 部署 | **Cloudflare Pages** | 直接连 GitHub，自动构建 |
| 国际化 | **i18n JSON 文件** | 中英双语切换成本极低 |
| 测试 | **vitest + happy-dom** | 纯函数逻辑（编解码、打分）易测 |

---

## 六、最终建议

✅ **你这个项目值得做，重复造轮子风险低，差异化空间充足。**  
✅ **最小可行版本（MVP）建议范围**：中文 UI + 三档难度 + 题目级 localStorage + 纯静态 + Cloudflare Pages。  
✅ **预计总工时**：1-2 周（一个完整周末 + 几个晚上）即可上线 v1。

下一步：
1. 如果要立项，可以先用 brainstorming skill 列出 v1 的功能卡片
2. 用 `init` skill 初始化项目骨架（package.json / wrangler.toml / README）
3. 用 `tdd` skill 先把"摩斯码编解码 + 字母表"这套纯函数用 vitest 测过
