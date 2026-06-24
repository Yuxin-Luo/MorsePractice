# Stage 13：4-tab 路由 + Space 键 gate

## 目标

把 v1 的 2-tab（看码 / 听码）扩成 4-tab，加上翻译 + 拍码两个新页面。解决 Space 键的全局监听器与拍码页的冲突。

## 关键文件

- `src/ui/app.js` — `direction` 类型扩展、`startSession()` 分支、`bindKeyboardShortcuts()` gate
- `index.html` — 4 个 `.direction-btn`，4 个 `<section.page>`

## 路由逻辑

```js
function startSession() {
  if (direction === 'translator') { startTranslatorPage(); return; }
  if (direction === 'straightkey') { startStraightKeyPage(); return; }
  // forward / listen
  ...
}
```

`renderPageVisibility()` 切换哪些 `<section>` 显示 / 隐藏。

## Space 键 gate

```js
function bindKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (direction === 'straightkey') return;  // ← 关键 gate
    if (e.key === ' ') { e.preventDefault(); els.playBtn().click(); }
    ...
  });
}
```

在拍码页里，独立的 document-level keydown/keyup 监听器专门处理 Space：

```js
document.addEventListener('keydown', (e) => {
  if (direction !== 'straightkey') return;
  if (e.code !== 'Space') return;
  if (e.repeat) return;
  if (e.target.tagName === 'INPUT') return;
  e.preventDefault();
  straightkeySession?.onKeyDown();
});
```

## 已知限制

- INPUT / TEXTAREA 元素聚焦时全局 Space 仍然会被拦截 —— 拍码页的 input（如果有）需要手动 `blur()`