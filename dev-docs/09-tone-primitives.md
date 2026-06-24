# Stage 9：音频 playTone 原语

## 目标

给直键拍码页提供"播放单个 tone 任意时长"的能力。

## 关键文件

- `src/core/audio.js` — 新增 `playTone()` 和 `stopTone()`
- `tests/audio.test.js` — 11 个新测试

## API

```js
playTone({ durationMs, frequency = 600, volume = 0.25 })
→ OscillatorNode | null

stopTone(osc)
```

`playTone` 复用 `playMorse` 的 osc+gain ADSR envelope（attack=5ms, release=10ms），让单个 tone 与播放完整字符串时听起来一致。

## 容错

- `durationMs` 为 0 / 负数 / NaN / Infinity / undefined → 返回 null（不抛错）
- 极短 tone（< 10ms）→ 内部 clamp sustainEnd 避免 release 吃掉整个 sustain

## 已知限制

- 短于 50ms 的 tone 在某些浏览器上可能听不见 —— 但对直键拍码够用（dit 是 80ms）