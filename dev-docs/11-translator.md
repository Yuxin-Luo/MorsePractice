# Stage 11：摩斯↔字母翻译页

## 目标

Live 双向翻译：用户输入任一侧，另一侧自动更新。

## 关键文件

- `src/modes/translator.js` — 双向同步逻辑
- `index.html` — `<section id="translator-page">`
- `styles/main.css` — `.translator-row` 2 列布局

## 设计决策

- **部分 token 保留原文**：用户输入 `.-` 但还没输入空格时，不应显示 `A`；`decode('.-')` 返回 `A`，所以保留 `decode()` 的输出。但如果用户输入 `.-.-.`（不是任何字符的完整码），`decode()` 返回 `?`，我们保留原始 token `-.-.` 而不是显示 `?`，避免闪烁。
- **`/` 翻译为空格**：和 `encode()` 的输出格式保持一致。
- **同步互锁**：`syncing` 标志防止 input → output → input 循环。

## 测试

`tests/translator.test.js`：9 个测试覆盖双向同步、清空、部分 token、交替编辑、detach。

## 已知限制

- 不支持 Unicode（汉字、表情）—— `encode()` 会静默丢弃未知字符。