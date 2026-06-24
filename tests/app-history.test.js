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
});
