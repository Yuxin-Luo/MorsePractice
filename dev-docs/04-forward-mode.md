# Stage 4：正向练习模式（首版可交互 UI）

## 目标

实现"看摩斯码打字"的 3 档练习模式。这是项目**第一个有真实 UI 的阶段**——浏览器打开 `index.html` 即可上手操作。

## 关键文件

- `src/modes/forward.js:1-130` — 题目生成、判分逻辑、会话控制器
- `src/ui/app.js:1-180` — 视图控制器：DOM 事件绑定、状态渲染
- `src/main.js:1-10` — 应用入口
- `index.html:1-50` — DOM 骨架
- `styles/main.css:1-235` — 暗色主题样式
- `tests/forward.test.js:1-85` — 14 个测试覆盖题目生成、判分、会话

## 设计决策

- **MVC 分离**：`forward.js` 不 import 任何 DOM，纯逻辑；`app.js` 是唯一接触 DOM 的层
- **3 档共用判分函数 `judgeAnswer()`**：letter 是 word 的特例，sentence 是 word 的一般化
- **`normalize()` 用于 sentence**：去空格、去标点、转大写，让用户能"自然地"输入（不会因为忘记空格而错）
- **`createForwardSession` 工厂模式**：闭包持有状态，回调通知 UI。比 class 更轻量
- **`prev/next` 走 history 数组**：保留所有出过的题，方便回看；用 `historyIndex` 定位当前
- **键盘快捷键**：空格=播放、R=重试、N=下一题、P=上一题、Enter=提交；input 聚焦时让位给原生输入
- **不做持久化**：Stage 5 才会接入 localStorage；本阶段 history 仅存内存
- **不做 i18n**：Stage 6 才会中英双语；本阶段 UI 文字直接写中文

## 判分规则

| 模式 | 规则 |
|------|------|
| letter | 精确匹配单字符（大小写不敏感）|
| word | 按字符逐位判分，错的位置标红、对的位置标绿 |
| sentence | 忽略空格、标点、大小写差异 |

## UI 流程

1. 用户在顶部 3 个 mode 按钮中选一档
2. 看到 `.... . .-.. .-.. ---` 这种摩斯码
3. 在输入框里键入 `HELLO`
4. 点"重试"或按 Enter 提交
5. 反馈区出现 ✅/❌/⚠️，错的字符位置高亮
6. 点"下一题"或按 N 出新题
7. 点"上一题"或按 P 回看历史题

## 测试

- 47 测试全绿（`Tests 47 passed (47)`）
- forward 模块 14 个测试：题目生成、判分（精确/部分/忽略空格）、会话（初始化/next/submit/setInput/错答）

## 手动验证

```bash
cd ~/Desktop/LYX/VibeCoding/MorsePractice
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

应能看到：
- 顶部 3 个 mode 按钮（字母/数字高亮）
- 中间大块显示摩斯码 + 目标（半透明提示）
- 下方输入框
- 4 个 action 按钮（上一题/播放/重试/下一题）
- 底部快捷键说明

## 借鉴的参考

- `ReferenceRepositories/morse-trainer/script.js:98-130` — 内联 morseTables 思路（v1 内置小词库）
- 借鉴 `morsewalker` 的 tokenize+play 思路（本阶段只用 tokenize + display 摩斯码）

## 已知限制

- **词库只有 50 词、10 句**——Stage 7 听码会扩展到 1000 词 / 100 句
- **没有错题本**——Stage 5 持久化
- **没有"显示/隐藏"目标切换**——目标一直显示（学习辅助模式）
- **WPM 固定 20**——暂不暴露调速 UI

## 下一阶段衔接

Stage 5 会：
1. 新建 `src/storage/progress.js`
2. `app.js` 在 `submit()` 后调用 `recordAttempt()`
3. 错题历史进入 localStorage，刷新页面不丢
