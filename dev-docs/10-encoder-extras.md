# Stage 10：encoder.getPossibleChars

## 目标

提供"给定 morse 前缀，返回所有可能字符"的能力，给拍码页做实时反馈。

## 关键文件

- `src/core/encoder.js` — 新增 `getPossibleChars()`
- `tests/encoder.test.js` — 8 个新测试

## API

```js
getPossibleChars(prefix = '')
→ string[]
```

## 使用场景

拍码页：用户输入 `.-` → 显示"可能是 A, R, W"。输入 `....` → 显示"可能是 4, 5, H"。

## 已知限制

- 只对**单个 letter 的前缀**有效。多 letter 情况（如 `.... . .-..`）需要先 split 再逐 token 调用。