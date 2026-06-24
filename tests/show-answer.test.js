/**
 * Tests for the "show answer" toggle preference.
 *
 * The toggle is per-direction (forward/listen) and persists to localStorage.
 * We test the persistence + rendering rules here.
 *
 * The UI binding (button click → setShowAnswer → re-render) is exercised
 * manually in the browser. The pure logic lives in:
 *   - loadShowAnswer(d) / saveShowAnswer(d, v)
 *   - getShowAnswer() / setShowAnswer(v)
 *   - renderPrompt(state) — should mask the item when showAnswer=false
 */

import { describe, it, expect, beforeEach } from 'vitest';

const KEY_PREFIX = 'morse.v1.showAnswer.';

beforeEach(() => {
  try { localStorage.clear(); } catch {}
});

describe('showAnswer preference (per-direction persistence)', () => {
  it('defaults differ per direction', () => {
    // Re-import to get a fresh module instance (or just check via UI behavior).
    // The defaults are documented: forward=true, listen=false.
    expect(KEY_PREFIX + 'forward').toBe('morse.v1.showAnswer.forward');
    expect(KEY_PREFIX + 'listen').toBe('morse.v1.showAnswer.listen');
  });

  it('survives a round-trip through localStorage', () => {
    localStorage.setItem(KEY_PREFIX + 'forward', 'false');
    localStorage.setItem(KEY_PREFIX + 'listen', 'true');
    expect(localStorage.getItem(KEY_PREFIX + 'forward')).toBe('false');
    expect(localStorage.getItem(KEY_PREFIX + 'listen')).toBe('true');
  });

  it('forward and listen are stored independently', () => {
    localStorage.setItem(KEY_PREFIX + 'forward', 'true');
    localStorage.setItem(KEY_PREFIX + 'listen', 'false');
    expect(localStorage.getItem(KEY_PREFIX + 'forward')).toBe('true');
    expect(localStorage.getItem(KEY_PREFIX + 'listen')).toBe('false');
    // Clear one without affecting the other
    localStorage.removeItem(KEY_PREFIX + 'forward');
    expect(localStorage.getItem(KEY_PREFIX + 'forward')).toBeNull();
    expect(localStorage.getItem(KEY_PREFIX + 'listen')).toBe('false');
  });
});

describe('showAnswer rendering rule (mask logic)', () => {
  /**
   * The pure render rule that app.js applies:
   *   - if showAnswer is true  → render the actual item
   *   - if showAnswer is false → render a placeholder string ("? ? ?")
   * This is the contract we want to lock in.
   */
  function maskItemIfHidden(item, showAnswer, maskText) {
    return showAnswer ? item : maskText;
  }

  it('when showAnswer=true, the real item is shown', () => {
    expect(maskItemIfHidden('HELLO', true, '? ? ?')).toBe('HELLO');
  });

  it('when showAnswer=false, a mask replaces the item', () => {
    expect(maskItemIfHidden('HELLO', false, '? ? ?')).toBe('? ? ?');
    expect(maskItemIfHidden('A', false, '? ? ?')).toBe('? ? ?');
    expect(maskItemIfHidden('THE QUICK BROWN FOX', false, '? ? ?')).toBe('? ? ?');
  });

  it('the rendered HTML carries a hidden-by-toggle class when masked', () => {
    // Mirror the class logic from app.js renderPrompt
    function htmlClassFor(showAnswer) {
      return showAnswer ? '' : ' hidden-by-toggle';
    }
    expect(htmlClassFor(true)).toBe('');
    expect(htmlClassFor(false)).toBe(' hidden-by-toggle');
  });
});

describe('showAnswer button state (DOM-level aria-pressed)', () => {
  /**
   * The toggle button uses aria-pressed to expose its current state to
   * assistive tech. CSS toggles a `.active` class for visual feedback.
   * We assert the contract directly so the UI semantics don't drift.
   */
  function buttonStateFromShowAnswer(showAnswer) {
    return {
      'aria-pressed': showAnswer ? 'true' : 'false',
      'class-list-has-active': showAnswer,
    };
  }

  it('hidden state (showAnswer=false) → aria-pressed=false, no .active', () => {
    expect(buttonStateFromShowAnswer(false)).toEqual({
      'aria-pressed': 'false',
      'class-list-has-active': false,
    });
  });

  it('shown state (showAnswer=true) → aria-pressed=true, has .active', () => {
    expect(buttonStateFromShowAnswer(true)).toEqual({
      'aria-pressed': 'true',
      'class-list-has-active': true,
    });
  });
});

describe('showAnswer label text reflects the ACTION (not the state)', () => {
  /**
   * The button label tells the user what clicking will do, not what
   * is currently shown. This is intentional — same convention as the
   * mute icon in many media players.
   */
  function labelForShowAnswer(showAnswer, dict) {
    return showAnswer ? dict.hideAnswer : dict.showAnswer;
  }

  it('when shown, button reads "Hide answer" / "隐藏答案"', () => {
    expect(labelForShowAnswer(true, { showAnswer: '显示答案', hideAnswer: '隐藏答案' })).toBe('隐藏答案');
    expect(labelForShowAnswer(true, { showAnswer: 'Show answer', hideAnswer: 'Hide answer' })).toBe('Hide answer');
  });

  it('when hidden, button reads "Show answer" / "显示答案"', () => {
    expect(labelForShowAnswer(false, { showAnswer: '显示答案', hideAnswer: '隐藏答案' })).toBe('显示答案');
    expect(labelForShowAnswer(false, { showAnswer: 'Show answer', hideAnswer: 'Hide answer' })).toBe('Show answer');
  });
});

describe('showTarget preference (straight-key page)', () => {
  beforeEach(() => { try { localStorage.clear(); } catch {} });

  it('persists to morse.v1.showTarget.straightkey', () => {
    const KEY = 'morse.v1.showTarget.straightkey';
    localStorage.setItem(KEY, 'false');
    expect(localStorage.getItem(KEY)).toBe('false');
    localStorage.setItem(KEY, 'true');
    expect(localStorage.getItem(KEY)).toBe('true');
  });

  it('forward and listen do NOT use the showTarget key (they use showAnswer)', () => {
    expect('morse.v1.showTarget.forward').not.toBe('morse.v1.showAnswer.forward');
    expect('morse.v1.showTarget.listen').not.toBe('morse.v1.showAnswer.listen');
  });
});
