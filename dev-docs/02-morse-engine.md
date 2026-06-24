# Stage 2：摩斯引擎

## 目标

实现国际摩斯码的**编解码**与**时序计算**核心，作为整个应用的基础设施。本阶段刻意只产出**纯函数**，不涉及 DOM、Audio、Storage，便于 TDD 覆盖和未来复用。

## 关键文件

- `src/core/morse-table.js:1-69` — `MORSE` 表（26 字母 + 10 数字 + 26 标点）+ `FROM_MORSE` 反向表，`Object.freeze` 防运行时篡改
- `src/core/encoder.js:1-87` — `encode()`、`decode()`、`isValidPrefix()`、`timing()` 四个纯函数
- `tests/encoder.test.js:1-141` — 24 个 vitest 测试用例，覆盖表内容、反向映射、编码（单词/句子/小写/未知字符/空输入）、解码、prefix 检查、时序数学

## 设计决策

- **两文件而非一个**：表（数据）放 `morse-table.js`，函数（行为）放 `encoder.js`。`encoder.js` 用 `export { MORSE, FROM_MORSE } from './morse-table.js'` 重新导出，让调用方可以单文件 import
- **`Object.freeze` 全表**：防运行时被误改（历史教训：参考 `morsewalker` 用 inline 对象，未冻结）
- **未知字符静默 drop**：调用方拿到的 morse 字符串永远是合法的；不做"throw"以减少模式层处理异常的负担
- **`encode` 不抛异常**：空字符串、纯空格、纯标点都返回空串而非 `null`，调用层用 truthy 判断更省事
- **`timing()` 单位毫秒**而非秒；浏览器 `setTimeout` 用毫秒，避免每次写 `* 1000`
- **Farnsworth 默认 = wpm**：兼容简单场景（无 Farnsworth）；用户传 `(20, 10)` 显式开启

## 时序公式（PARIS 标准）

```
1 word = 50 dit-units
1 dit-unit = 1200 / wpm  (ms)
dah     = 3 × dit-unit
letter  = 3 × dit-unit  (Farnsworth 时用 slowUnit)
word    = 7 × dit-unit  (Farnsworth 时用 slowUnit)
```

Farnsworth 模式：保持字符速度（dit/dah）不变，**拉长**字符间和单词间停顿。适合初学者——可以听到每个 dit/dah，但有充足反应时间。

## 测试

- 24 测试用例全绿（`npm test` 输出 `Tests 24 passed (24)`）
- 覆盖：
  - 26 字母 + 10 数字 + 4 常用标点
  - `MORSE` ↔ `FROM_MORSE` 互逆
  - encode: 单字母、SOS、单词、句子（带 ` / ` 分隔）、小写、未知字符、空输入
  - decode: 已知、未知、标点
  - `isValidPrefix`: 空、单字符、合法前缀、非法前缀
  - timing: 标准 WPM、Farnsworth、wordGap 公式

## 手动验证

```
encode("SOS")      → "... --- ..."
encode("HELLO")    → ".... . .-.. .-.. ---"
encode("HI")       → ".... .."
encode("5")        → "....."
encode("73")       → "--... ...--"
encode("中文a")   → ".-"           (中文被静默跳过)
decode(".-")       → "A"
timing(20)         → { dit: 60, dah: 180, letterGap: 180, wordGap: 420 }
timing(20, 10)     → { dit: 60, dah: 180, letterGap: 360, wordGap: 840 }
```

## 借鉴的参考

- `ReferenceRepositories/morse-code-trainer/src/lib/morse/code.ts:6-114` — MORSE 表、encode/decode/timing 函数范式、PARIS 公式
- `ReferenceRepositories/morsewalker/src/js/audio.js:43-54` — Farnsworth 时序公式（`1.2 / wpm` 单位为秒，等价于 `1200 / wpm` 毫秒）

## 已知限制

- **不支持中文/俄文/希腊文等扩展字符集**。若需要，可借鉴 `morse-code-translator` 的"多字符表 + priority set"架构（v1 不做）
- **`encode` 不做 NFC/NFD 归一化**（日语假名需要）；v1 不涉及
- **不支持 prosign**（`<ar>`、`<sk>` 等 ham radio 用的合并码）；v1 不涉及

## 下一阶段衔接

Stage 3（音频引擎）会：
1. `import { timing } from './encoder.js'` 复用本阶段的时序公式
2. 增加 `src/core/audio.js`，提供 `playMorse(morse, opts)` 接口
3. 用 `tests/audio.test.js` mock `AudioContext` 验证 setValueAtTime 调用时序
