# Stage 7：听码反向模式（固定题库）

## 目标

听到摩斯码后用键盘输入听到的内容，判分。3 档难度（letter / word / sentence）。这是项目**最后一块大功能**——v1 完整功能集已具备。

## 关键文件

- `src/modes/listen.js:1-100` — 听码会话控制器，复用 `playMorse` + `judgeAnswer`
- `src/data/words.json:1-300` — ~290 词静态词库（精选常用英文词）
- `src/data/sentences.json:1-100` — ~100 句常用英语谚语/短语
- `src/ui/app.js:1-260` — 重写后的主控制器，支持 forward + listen 两种方向
- `index.html:13-30` — 顶部新增"方向"切换条（看码/听码）
- `styles/main.css:155-178` — 方向按钮样式
- `tests/listen.test.js:1-55` — 8 个测试

## 设计决策

- **复用 `judgeAnswer()`**：listen 模式判分逻辑和 forward 一致，零重复
- **静态 JSON 词库**：v1 不引入随机句子生成器（避免产生无意义句子）
- **autoPlay 自动播放**：切换到 listen 模式后，每次出题自动播放，200ms 间隔避免重叠
- **错答时显示答案 + 摩斯码**：listen 模式独有，错答会在反馈区揭示正确摩斯码（学习反馈）
- **方向切换保留 subMode**：从 forward letter 切到 listen letter，不需要重新选档
- **`direction.subMode` 命名空间**写入 localStorage（如 `listen.word`），forward 和 listen 的统计分开
- **键盘快捷键 1/2**：1=forward，2=listen

## 数据来源

- **words.json**：~290 个英文单词，覆盖常用名词/动词/形容词
- **sentences.json**：~100 个英语习语/谚语/常用短语，从易到难
  - 短句：3 词（如 "I AM FINE"）
  - 长句：12+ 词（如 "PEOPLE WHO LIVE IN GLASS HOUSES SHOULDN'T THROW STONES"）
  - 大写字母，无标点（输入时大写敏感度低）

## 完整功能矩阵（v1 达成）

| 维度 | 状态 |
|------|------|
| 字母 ↔ 摩斯互转 | ✅ |
| 多模式（字母/单词/句子）| ✅ |
| 对错判断 | ✅ |
| 题目级 重试/上/下题 | ✅ |
| localStorage 进度 | ✅ |
| Cloudflare 一键部署 | ⏳ Stage 8 |
| 中文 UI | ✅ |
| 听码反向 3 档 | ✅ |

## 测试

- 80 测试全绿（`Tests 80 passed (80)`）
- listen 模块 8 个测试：question 生成（letter/word/sentence/throw）、judgeListenAnswer（正确/错误/部分）、会话（初始化/submit/notify）

## 手动验证

```bash
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
# 1. 默认 "看码打字" 模式 → 选 "句子" → 应看到 ".... . .-.. .-.. --- / .-- --- .-. .-.. -.." 等
# 2. 输入 "HELLO WORLD" → 重试 → 看到正确判定
# 3. 点 "下一题" → 下一句
# 4. 点 "👂 听码打字" → 自动播放单字母 → 输入 → 判分
# 5. 切换 "句子" → 听完整句 → 键入 → 错答时反馈区显示正确摩斯码
# 6. 刷新页面 → 统计不丢
# 7. 点右上 "EN" → 全部 UI 切英文
```

## 借鉴的参考

- `ReferenceRepositories/morsewalker/src/js/audio.js:43-54` — 听码播放 + 完整字符 + WPM 调整
- `ReferenceRepositories/morse-trainer/script.js:98-130` — 内联词库思路

## 已知限制

- **词库约 290 词 / 100 句**，对长时间练习偏少；后续可加 SRS 调度或社区词库
- **不调整 WPM**：固定 15 WPM（适合初学）；Stage 8 之外可加 UI 调速
- **不调整 frequency**：固定 600 Hz
- **没有"听不清"自动慢放功能**：v1 用 200ms 间隔 + 固定 WPM

## 下一阶段衔接

Stage 8（Cloudflare Pages 部署）会：
1. 新建 `wrangler.toml`、`_headers`、`_redirects`
2. 部署到 Cloudflare Pages
3. 准备用户向 README
