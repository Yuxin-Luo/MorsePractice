# Stage 5：localStorage 进度持久化

## 目标

把每题的对错、字符级统计、错题历史、当前题状态都存到 localStorage，**刷新页面不丢**。这是用户"积累感"的来源——让他们看到"哪些字符我老错"。

## 关键文件

- `src/storage/progress.js:1-180` — localStorage 封装，schema v1
- `tests/progress.test.js:1-110` — 13 个测试覆盖 load/save/reset、recordAttempt、字符级统计、history 截断、saveCurrent/loadCurrent
- `src/ui/app.js:64-99, 188-205` — 接入：每次 submit 后 `recordAndPersist()`
- `index.html:38-50` — 统计面板 DOM
- `styles/main.css:155-178` — 统计卡片样式

## Schema (v1)

```js
{
  version: 1,
  stats: {
    "A": { seen: 5, correct: 4, lastSeenAt: 1719190000000 },
    "B": { seen: 3, correct: 1, lastSeenAt: ... },
    ...
  },
  history: [
    { ts, mode: "word", item: "HELLO", input: "HELLA", isCorrect: false },
    ...
  ],
  current: { mode, item, input } | null,
}
```

## 设计决策

- **v1 schema 带 version 字段**：未来加字段时写 migrator，平滑升级
- **history 截断 200 条**：localStorage 通常 5MB 上限，200 条历史约 50KB，安全边际大
- **只统计 expected 字符**：用户输错的、target 里没有的字符不计入。理由：避免"用户习惯性误按"污染数据
- **大写归一化 + 去非字母数字**：sentence 模式的输入也用同一套判分规则
- **in-memory fallback**：隐私模式或 file:// 协议下 localStorage 可能不可用，自动降级到内存；不抛异常
- **JSON.parse + try/catch 兜底**：哪怕 localStorage 里的 JSON 被人手动改坏了，下次加载也只会重置而不是崩溃
- **`recordAttempt()` 是纯函数**：返回新 state，不 mutate 入参。方便测试和撤销

## API

```js
import {
  loadProgress, saveProgress, resetProgress,
  recordAttempt, getCharAccuracy, getWeakestChars, getSummary,
  saveCurrent, loadCurrent,
} from './src/storage/progress.js';

let s = loadProgress();
s = recordAttempt(s, 'word', 'HELLO', 'HELLO', true);
saveProgress(s);
```

## 测试

- 60 测试全绿（`Tests 60 passed (60)`）
- progress 模块 13 个测试：load 默认/持久化/reset、recordAttempt 字符统计/标记错误字符/history 截断/大小写不敏感、getCharAccuracy、getWeakestChars 排序与 min-seen 过滤、getSummary、saveCurrent/loadCurrent 往返

## 手动验证

```bash
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
# 答几题 → 看底部"📊 累计统计"变化
# 刷新页面 → 统计不变
# 控制台: localStorage.getItem('morse.v1.progress')
# 应看到 JSON 数据
```

## 借鉴的参考

- `ReferenceRepositories/morse-code-trainer/src/lib/db/store.ts` — Dexie/IndexedDB schema 思路（简化为 localStorage）
- `ReferenceRepositories/morse-trainer/script.js` 的 `morseTrainerRecords` 记录 schema 思路

## 已知限制

- **不做字符级的"重练习"调度**（SRS）；v1 只是统计，不调度
- **不做云端同步**——多设备无法共享；v1 用户明确接受
- **history 只保留最近 200 条**；老数据会被裁掉
- **不导出/导入数据**——v1 用户清浏览器数据即丢失

## 下一阶段衔接

Stage 6（i18n）会：
1. 新建 `src/i18n/{index,zh,en}.js`
2. 改造 `index.html` 的所有中文字符串
3. 在 `app.js` 用 `t('key')` 替换
4. 顶部加语言切换按钮
