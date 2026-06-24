# Stage 12：手键拍码页

## 目标

按住空格（或屏幕按钮）→ 听到声音 → 实时显示识别结果。同时支持**自由拍码沙盒**和**目标驱动练习**两种模式。

## 关键文件

- `src/modes/straightkey.js` — 纯状态机，与 DOM 解耦
- `index.html` — `<section id="straightkey-page">`
- `styles/main.css` — `.sk-display`, `.sk-progress`, `.sk-hold-btn`

## 状态机设计

### 时序（来自 `encoder.timing(15)`）

| 事件 | 时长（ms） | 含义 |
|------|-----------|------|
| dit (点) | 80 | 短按 |
| dah (划) | 240 | 长按 |
| ditDahThreshold | 160 | 区分 dit / dah 的阈值 |
| intraChar | 80 | 同字符内符号间隔 |
| letterGap | 240 | finalize 当前 letter |
| wordGap | 560 | finalize letter + 加空格 |

### 状态转换

```
IDLE → [keydown] → HOLDING → [keyup] → GAP
GAP → [keydown] → (finalize if gap ≥ letterGap / wordGap) → HOLDING
GAP → [long pause] → flushFinalize() → IDLE
```

### 元素分类

```js
function classifyByDuration(durMs) {
  return durMs < ditDahThreshold ? '.' : '-';
}
```

## 模式

### Free 模式

无目标。用户随意拍码，下方实时累积"识别"栏 + "可能"提示。

### Practice 模式

- 选择 sub-mode（letter / word / sentence）
- 系统生成目标 → 显示在「目标」栏
- 用户拍码 → 长度匹配后触发 `onResult`
- 正确显示 ✅，错误显示 ❌ + 期望值 vs 你输入
- 「下一题 →」按钮生成新目标

## UI 反馈

- **进度条**（`.sk-progress`）：按住的瞬间 progress 从 0 → 1，到达 `ditDahThreshold` 时停止
- **可能字符**：实时根据当前输入的 morse code 列出可能的目标字符
- **当前 morse**：显示正在输入的符号序列（如 `.-`）
- **已识别**：用 `<span class="sk-letter pending">` 包裹尚未 finalize 的字符，视觉上区分

## 测试

`tests/straightkey.test.js`：17 个测试覆盖
- 短按/长按 → dit/dah 分类
- letterGap / wordGap finalize 逻辑
- backspace（撤销 element / letter）
- 模式切换（free ↔ practice） + target 生成
- practice 模式 result 触发（letter 和 word target）

## 已知限制

- iOS Safari 长按行为不一致 → 用 `pointerdown/pointerup` 屏幕按钮兜底（见 [14-mobile-fallback.md](./14-mobile-fallback.md)）
- 自动重复 keydown → `e.repeat` 过滤