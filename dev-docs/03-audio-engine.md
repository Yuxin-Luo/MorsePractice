# Stage 3：音频引擎

## 目标

让任意摩斯字符串（`... --- ...`）能在浏览器里**真的发出声音**。这是 Stage 7（听码反向）的前置依赖。

## 关键文件

- `src/core/audio.js:1-148` — `playMorse(morse, opts)` + `stop()` + `getAudioContext()`
- `tests/audio.test.js:1-110` — 9 个测试用例，mock `AudioContext` 验证调度逻辑

## 设计决策

- **单例 AudioContext**：浏览器对同时存在的 AudioContext 数量有限制；lazy init 也保证 iOS Safari 在用户首次交互后才创建（不交互就 `resume()` 会被拒）
- **50ms lead-in**：`startTime = ctx.currentTime + 0.05` 给浏览器一个缓冲，避免开屏 click
- **ADSR 包络**：5ms attack + 10ms release 用 `linearRampToValueAtTime` 实现；这正是参考 `morse-code-trainer/src/lib/audio/cw.ts` 的做法
- **Farnsworth 通过 `timing(wpm, farnsworth)` 一行解决**：Stage 2 已经算好 `dit/dah/letterGap/wordGap`，本阶段只负责把它们转成 `setValueAtTime` 调度
- **`playMorse` 返回 Promise**：调用方可以 `await`，模式层可以用 `async/await` 控制题目切换

## API

```js
import { playMorse, stop } from './src/core/audio.js';

await playMorse('... --- ...', {
  wpm: 20,
  farnsworth: 10,    // 可选；不传则等于 wpm
  frequency: 600,    // Hz
  volume: 0.3,       // 0-1
  onEnd: () => console.log('done'),
});

// 任何时候可以打断
stop();
```

## 测试

- 33 测试用例全绿（`Tests 33 passed (33)`）
- audio 模块 9 个测试覆盖：节点创建、默认/自定义频率、envelope 调度、dit vs dah 同样形状、word separator、start timestamp 未来性、onended handler 绑定、`stop()` 不抛异常

## 手动验证

```bash
# 启动本地服务器
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000/，控制台执行：
import('./src/core/audio.js').then(m => m.playMorse('... --- ...'))
# 应该能听到 SOS
```

## 借鉴的参考

- `ReferenceRepositories/morsewalker/src/js/audio.js:43-54` — Farnsworth 时序公式（`1.2 / wpm` 秒，等价于 `1200 / wpm` 毫秒）
- `ReferenceRepositories/morse-code-trainer/src/lib/audio/cw.ts` — ADSR 包络思想（attack=5ms, release=10ms）

## 已知限制

- **不支持 QSB/QRN 模拟**（morsewalker 那种 ham radio 衰落效果）；v1 不需要
- **没有预录的"标准 CW"音色**：v1 全部用纯 sine 波；后续可加滤波器做更柔和的音色
- **不支持 MIDI 输出**（有些摩斯练习器通过外部电键发码）

## 下一阶段衔接

Stage 4（正向模式 UI）会：
1. `import { encode } from './core/encoder.js'` 显示摩斯码
2. `import { playMorse } from './core/audio.js'` 提供"播放声音"按钮
3. 在 `src/modes/forward.js` 实现 letter/word/sentence 三档抽题 + 判分
