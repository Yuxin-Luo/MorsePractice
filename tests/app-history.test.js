/**
 * Tests for the app's state machine: history, direction switching, mode
 * switching, and feedback clearing.
 *
 * We can't run the real DOM in node, so we extract the pure logic into
 * a minimal harness that mirrors what app.js does internally. This catches
 * the "feedback not cleared on direction switch" bug.
 */

import { describe, it, expect } from 'vitest';
import { generateListenQuestion, judgeListenAnswer } from '../src/modes/listen.js';
import { generateQuestion, judgeAnswer } from '../src/modes/forward.js';

/** Mirror the relevant part of app.js — keep in sync with src/ui/app.js */
function createAppHarness() {
  let direction = 'forward';
  let subMode = 'letter';
  let history = [];
  let historyIndex = -1;
  const events = []; // captures the lifecycle events

  function makeState(q) {
    return { mode: subMode, item: q.item, morse: q.morse, input: '', result: null };
  }

  function generateFresh() {
    return direction === 'forward' ? generateQuestion(subMode) : generateListenQuestion(subMode);
  }

  function startSession() {
    history = [makeState(generateFresh())];
    historyIndex = 0;
    events.push({ event: 'startSession', direction, subMode, state: history[0] });
  }

  function submit(input) {
    const state = history[historyIndex];
    if (!state) return;
    const fn = direction === 'forward' ? judgeAnswer : judgeListenAnswer;
    const result = fn(state.item, input);
    const updated = { ...state, input, result };
    history[historyIndex] = updated;
    events.push({ event: 'submit', result, item: state.item });
  }

  function nextQuestion() {
    const current = history[historyIndex];
    if (current?.input) submit(current.input);
    history.push(makeState(generateFresh()));
    historyIndex = history.length - 1;
    events.push({ event: 'nextQuestion', state: history[historyIndex] });
  }

  function setDirection(d) {
    if (direction === d) return;
    direction = d;
    startSession();
    events.push({ event: 'setDirection', direction: d });
  }

  function setMode(m) {
    if (subMode === m) return;
    subMode = m;
    startSession();
    events.push({ event: 'setMode', subMode: m });
  }

  function getCurrentResult() {
    return history[historyIndex]?.result ?? null;
  }

  function getCurrentState() {
    return history[historyIndex];
  }

  // Init
  startSession();

  return { setDirection, setMode, submit, nextQuestion, getCurrentResult, getCurrentState, events };
}

describe('app state machine: feedback clearing on direction switch', () => {
  it('after wrong submit in listen mode, switching to forward clears the result', () => {
    const app = createAppHarness();
    // Start in listen mode
    app.setDirection('listen');
    const target = app.getCurrentState().item;
    // Submit wrong
    app.submit('WRONG_ANSWER_XYZ');
    expect(app.getCurrentResult()).not.toBeNull();
    expect(app.getCurrentResult().isCorrect).toBe(false);
    // Switch to forward
    app.setDirection('forward');
    // Result should be cleared
    expect(app.getCurrentResult()).toBeNull();
    expect(app.getCurrentState().input).toBe('');
  });

  it('after wrong submit in forward mode, switching to listen clears the result', () => {
    const app = createAppHarness();
    const target = app.getCurrentState().item;
    app.submit('WRONG_FORWARD');
    expect(app.getCurrentResult()).not.toBeNull();
    app.setDirection('listen');
    expect(app.getCurrentResult()).toBeNull();
  });

  it('after wrong submit, switching sub-mode clears the result', () => {
    const app = createAppHarness();
    app.submit('WRONG');
    expect(app.getCurrentResult()).not.toBeNull();
    app.setMode('word');
    expect(app.getCurrentResult()).toBeNull();
  });

  it('after correct submit, switching direction clears (and the answer is recorded)', () => {
    const app = createAppHarness();
    const target = app.getCurrentState().item;
    app.submit(target);
    expect(app.getCurrentResult().isCorrect).toBe(true);
    app.setDirection('listen');
    expect(app.getCurrentResult()).toBeNull();
  });

  it('nextQuestion in listen mode keeps result cleared on next item', () => {
    const app = createAppHarness();
    app.setDirection('listen');
    app.submit('WRONG');
    expect(app.getCurrentResult()).not.toBeNull();
    app.nextQuestion();
    expect(app.getCurrentResult()).toBeNull();
  });

  /**
   * REGRESSION: previously the app used session.submit() to judge answers.
   * But the session's internal `current` was set once in startSession() and
   * never updated, so after the first nextQuestion() call, every judgment
   * was against the FIRST question's item, not the displayed one. This
   * caused "expected: 7 / you typed: 7" to be marked wrong.
   *
   * Fix: judging is now done directly against history[historyIndex].item
   * using judgeAnswer(). This test verifies the fix: when we go to the next
   * question, the judging compares the new item (not the old one).
   */
  it('after nextQuestion, judging uses the NEW question item (regression)', () => {
    const app = createAppHarness();
    app.setDirection('listen');
    // Simulate that the first question was answered correctly
    const firstItem = app.getCurrentState().item;
    app.submit(firstItem);
    expect(app.getCurrentResult().isCorrect).toBe(true);
    // Move to next question
    app.nextQuestion();
    const secondItem = app.getCurrentState().item;
    // User types exactly the new item — should be judged correct
    // (regardless of what the first item was)
    app.submit(secondItem);
    expect(app.getCurrentResult().isCorrect).toBe(true);
    // User types a known wrong string
    app.nextQuestion();
    const thirdItem = app.getCurrentState().item;
    app.submit('DEFINITELY_WRONG_ANSWER');
    expect(app.getCurrentResult().isCorrect).toBe(false);
    expect(app.getCurrentResult().expected).toBe(thirdItem);
  });
});

/* ────────────────────────────────────────────────────────────────────
 * Tests for the new "consumed" flag and empty-input guard.
 *
 * These mirror the relevant logic from src/ui/app.js (submitCurrent,
 * retryCurrent, makeState). The harness intentionally diverges from
 * createAppHarness above to model the new state shape.
 * ──────────────────────────────────────────────────────────────────── */

function createSubmitHarness(opts = {}) {
  let direction = opts.direction ?? 'forward';
  let subMode = opts.subMode ?? 'letter';
  let history = [];
  let historyIndex = -1;
  const stats = { count: 0 };

  function makeState(q) {
    return { mode: subMode, item: q.item, morse: q.morse, input: '', result: null, consumed: false };
  }
  function generateFresh() {
    return direction === 'forward' ? generateQuestion(subMode) : generateListenQuestion(subMode);
  }
  function startSession() {
    history = [makeState(generateFresh())];
    historyIndex = 0;
  }
  function submitCurrent({ silent = false } = {}) {
    const state = history[historyIndex];
    if (!state) return null;
    if (state.consumed) return state; // already counted → no-op
    const input = state.input ?? '';
    if (!input.trim()) return null; // empty → no record
    const result = direction === 'forward'
      ? judgeAnswer(state.item, input)
      : judgeListenAnswer(state.item, input);
    const updated = { ...state, input, result, consumed: true };
    history[historyIndex] = updated;
    stats.count += 1;
    return updated;
  }
  function retryCurrent() {
    const state = history[historyIndex];
    if (!state) return;
    const input = state.input ?? '';
    if (!input.trim()) {
      history[historyIndex] = { ...state, consumed: false, result: null, input: '' };
      return;
    }
    const result = direction === 'forward'
      ? judgeAnswer(state.item, input)
      : judgeListenAnswer(state.item, input);
    const updated = { ...state, input, result, consumed: true };
    history[historyIndex] = updated;
    stats.count += 1;
    return updated;
  }
  function setInput(value) {
    const state = history[historyIndex];
    if (state) history[historyIndex] = { ...state, input: value };
  }
  function nextQuestion() {
    submitCurrent({ silent: true });
    history.push(makeState(generateFresh()));
    historyIndex = history.length - 1;
  }

  startSession();
  return { setInput, submitCurrent, retryCurrent, nextQuestion, getState: () => history[historyIndex], getStats: () => ({ ...stats }), getHistory: () => [...history] };
}

describe('app state machine: consumed flag (single-count per question)', () => {
  it('first Enter on a question counts once', () => {
    const app = createSubmitHarness();
    const item = app.getState().item;
    app.setInput(item);
    app.submitCurrent();
    expect(app.getStats().count).toBe(1);
    expect(app.getState().consumed).toBe(true);
  });

  it('multiple Enters on the same question count only ONCE', () => {
    const app = createSubmitHarness();
    const item = app.getState().item;
    app.setInput(item);
    app.submitCurrent();
    app.submitCurrent();
    app.submitCurrent();
    app.submitCurrent();
    expect(app.getStats().count).toBe(1);
  });

  it('clicking 重试 (retry) re-arms the consumed flag, allowing a new count', () => {
    const app = createSubmitHarness();
    const item = app.getState().item;
    app.setInput(item);
    app.submitCurrent();
    expect(app.getStats().count).toBe(1);
    // User clicks retry with a corrected answer
    app.setInput(item); // still correct, but we explicitly retry
    app.retryCurrent();
    expect(app.getStats().count).toBe(2);
  });

  it('nextQuestion does not double-count the just-consumed question', () => {
    const app = createSubmitHarness();
    const item = app.getState().item;
    app.setInput(item);
    app.submitCurrent();
    expect(app.getStats().count).toBe(1);
    app.nextQuestion(); // should NOT re-record
    expect(app.getStats().count).toBe(1);
  });

  it('nextQuestion on an unconsumed question DOES count it', () => {
    const app = createSubmitHarness();
    const item = app.getState().item;
    app.setInput(item);
    // user typed but never pressed Enter / clicked retry
    app.nextQuestion();
    expect(app.getStats().count).toBe(1);
  });

  it('works for listen direction too', () => {
    const app = createSubmitHarness({ direction: 'listen' });
    const item = app.getState().item;
    app.setInput(item);
    app.submitCurrent();
    expect(app.getStats().count).toBe(1);
    // Multiple Enters still count only once
    app.submitCurrent();
    app.submitCurrent();
    expect(app.getStats().count).toBe(1);
  });
});

describe('app state machine: empty-input guard', () => {
  it('empty submit does NOT record a wrong answer', () => {
    const app = createSubmitHarness();
    app.setInput('');
    app.submitCurrent();
    expect(app.getStats().count).toBe(0);
    expect(app.getState().consumed).toBe(false);
  });

  it('whitespace-only submit does NOT record', () => {
    const app = createSubmitHarness();
    app.setInput('   ');
    app.submitCurrent();
    expect(app.getStats().count).toBe(0);
    expect(app.getState().consumed).toBe(false);
  });

  it('clicking 重试 with empty input does NOT record', () => {
    const app = createSubmitHarness();
    // First do a real submit
    const item = app.getState().item;
    app.setInput('WRONG_ANSWER');
    app.submitCurrent();
    expect(app.getStats().count).toBe(1);
    // Now click retry with empty input
    app.setInput('');
    app.retryCurrent();
    expect(app.getStats().count).toBe(1); // unchanged
    expect(app.getState().consumed).toBe(false); // re-armed
  });
});
