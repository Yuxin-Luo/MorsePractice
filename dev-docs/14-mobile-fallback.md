# Stage 14：拍码页移动端 fallback

## 目标

iOS Safari 不支持键盘长按、`preventDefault()` 在长按时行为不一致 → 提供屏幕按钮作为键盘的备选。

## 关键文件

- `src/ui/app.js` — `bindStraightKeyHoldButton()`
- `styles/main.css` — `.sk-hold-btn` 移动端适配

## 事件绑定

用 Pointer Events（兼容鼠标 + 触屏 + 触控笔）：

```js
btn.addEventListener('pointerdown', onDown);
btn.addEventListener('pointerup', onUp);
btn.addEventListener('pointerleave', onUp);  // 用户拖出按钮也触发
btn.addEventListener('pointercancel', onUp); // 系统中断也触发
```

`e.preventDefault()` 在 `pointerdown` 上调用以压制 iOS 的长按弹出菜单。

## CSS 视觉反馈

```css
.sk-hold-btn.active {
  background: linear-gradient(135deg, var(--red) 0%, #dc2626 100%);
  border-color: transparent;
  color: white;
  box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.25);
}
```

按住时按钮变红 + 加光晕，松手立刻恢复。

## 浏览器兼容性

| 浏览器 | 键盘 Space | 屏幕按钮 |
|--------|----------|---------|
| Chrome (desktop) | ✅ | ✅ |
| Firefox (desktop) | ✅ | ✅ |
| Safari (macOS) | ✅ | ✅ |
| Chrome (Android) | ❌（弹键盘遮挡）| ✅ |
| Safari (iOS) | ⚠️（长按不可靠）| ✅ |

## 已知限制

- 移动端的 `pointerleave` 在某些 Android 浏览器上不稳定 → 如果用户拖出按钮后没松手，会卡在"按住"状态。需要在 `pointercancel` 上兜底。