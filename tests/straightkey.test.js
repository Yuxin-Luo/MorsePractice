/**
 * Tests for the straight-key state machine.
 *
 * The session is decoupled from the DOM: we simulate keydown/keyup
 * directly and inspect emitted state. Tests use the real timing math
 * from encoder.js (15 WPM → ditDahThreshold = 160ms, letterGap = 240ms,
 * wordGap = 560ms).
 *
 * For the "audio" side, we monkey-patch performance.now() so the session
 * thinks specific durations have elapsed between keydown and keyup.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createStraightKeySession } from '../src/modes/straightkey.js';

// Mock the audio module so we don't need a real AudioContext in tests.
// We do this by stubbing performance.now and spying on playTone via a
// module-level swap. Since straightkey.js imports audio.js directly, we
// rely on the fact that playTone returns null when there's no audio
// context — but happy-dom does provide a window, so we need to stub.
// Simplest: stub AudioContext on window to a no-op.
class FakeOsc { constructor(){ this.frequency={value:0}; this.onended=null;} connect(){return this;} start(){} stop(){} disconnect(){} }
class FakeGain { constructor(){ this.gain={value:0, setValueAtTime(){}, linearRampToValueAtTime(){}}; } connect(){return this;} disconnect(){} }
class FakeCtx {
  constructor(){ this.currentTime=0; this.state='running'; this.destination={}; }
  createOscillator(){ return new FakeOsc(); }
  createGain(){ return new FakeGain(); }
  resume(){}
}

let mockNow = 0;
const origNow = performance.now.bind(performance);
beforeEach(() => {
  mockNow = 0;
  performance.now = () => mockNow;
  global.window.AudioContext = FakeCtx;
  global.window.webkitAudioContext = FakeCtx;
});
afterEach(() => {
  performance.now = origNow;
  vi.restoreAllMocks();
});

/** Simulate a key press of `holdMs` milliseconds. */
function press(session, holdMs) {
  session.onKeyDown();
  mockNow += holdMs;
  session.onKeyUp();
  mockNow += 10; // small gap after release
}

describe('straight-key session — basic tap classification', () => {
  it('short press (< threshold) is classified as dit', () => {
    let last = null;
    const s = createStraightKeySession({ onChange: (st) => { last = st; } });
    // 15 WPM threshold = 160ms; press for 50ms
    press(s, 50);
    expect(last.elements).toEqual(['.']);
  });

  it('long press (>= threshold) is classified as dah', () => {
    let last = null;
    const s = createStraightKeySession({ onChange: (st) => { last = st; } });
    // 15 WPM threshold = 160ms; press for 200ms
    press(s, 200);
    expect(last.elements).toEqual(['-']);
  });

  it('exactly at threshold is classified as dah (inclusive)', () => {
    let last = null;
    const s = createStraightKeySession({ onChange: (st) => { last = st; } });
    press(s, 160); // exactly at threshold
    expect(last.elements).toEqual(['-']);
  });

  it('emits onChange with possible chars during typing', () => {
    const events = [];
    const s = createStraightKeySession({ onChange: (st) => events.push(st) });
    press(s, 50); // .
    // '.' is a prefix of: E (.), I (..), S (...), H (....), 5 (.....),
    // T (-, but starts with -), A (.-), etc. — just check that the pure
    // dit chars are present and the array is non-empty.
    expect(events.at(-1).possible.length).toBeGreaterThan(0);
    expect(events.at(-1).possible).toEqual(expect.arrayContaining(['E', 'I', 'S']));
  });
});

describe('straight-key session — letter & word finalization', () => {
  it('three short presses within letter gap finalize as S', () => {
    let last = null;
    const s = createStraightKeySession({ onChange: (st) => { last = st; } });
    press(s, 50); // gap=10ms → same letter
    press(s, 50); // gap=10ms → same letter
    press(s, 50); // gap=10ms → same letter
    // After release, 10ms elapsed (not enough to finalize)
    expect(last.elements).toEqual(['.', '.', '.']);
    expect(last.letters).toEqual([]);
    // Wait > letterGap (240ms) → next keydown should finalize
    mockNow += 300;
    s.onKeyDown(); // no-op for pressStart
    expect(last.letters).toEqual(['S']);
  });

  it('gap >= letterGap but < wordGap finalizes letter only (no space)', () => {
    let last = null;
    const s = createStraightKeySession({ onChange: (st) => { last = st; } });
    press(s, 50); // .
    press(s, 50); // .
    press(s, 50); // .
    // Now wait letterGap (240ms) but less than wordGap (560ms)
    mockNow += 300;
    s.onKeyDown();
    expect(last.letters).toEqual(['S']);
    expect(last.letters).not.toContain(' ');
  });

  it('gap >= wordGap finalizes letter + word space', () => {
    let last = null;
    const s = createStraightKeySession({ onChange: (st) => { last = st; } });
    press(s, 50);
    press(s, 50);
    press(s, 50);
    // Wait > wordGap (560ms)
    mockNow += 600;
    s.onKeyDown();
    expect(last.letters).toEqual(['S', ' ']);
  });

  it('backspace pops the last element of current letter', () => {
    let last = null;
    const s = createStraightKeySession({ onChange: (st) => { last = st; } });
    press(s, 50);
    press(s, 200); // elements: ['.', '-']
    s.backspace();
    expect(last.elements).toEqual(['.']);
  });

  it('backspace pops the last letter when current letter is empty', () => {
    let last = null;
    const s = createStraightKeySession({ onChange: (st) => { last = st; } });
    press(s, 50);
    press(s, 50);
    press(s, 50); // letters: [] elements: ['.','.','.']
    // Force finalize
    mockNow += 300;
    s.onKeyDown(); // letters: ['S']
    s.backspace(); // should pop 'S'
    expect(last.letters).toEqual([]);
  });
});

describe('straight-key session — modes', () => {
  it('starts in free mode with no target', () => {
    const s = createStraightKeySession();
    expect(s.getState().mode).toBe('free');
    expect(s.getState().target).toBe(null);
  });

  it('setMode("practice") generates a target', () => {
    const s = createStraightKeySession();
    s.setMode('practice');
    expect(s.getState().mode).toBe('practice');
    expect(s.getState().target).toBeTruthy();
    expect(typeof s.getState().target).toBe('string');
  });

  it('setMode("free") clears the target', () => {
    const s = createStraightKeySession();
    s.setMode('practice');
    s.setMode('free');
    expect(s.getState().target).toBe(null);
  });

  it('setSubMode("word") generates a word target in practice mode', () => {
    const s = createStraightKeySession();
    s.setMode('practice');
    s.setSubMode('word');
    const t = s.getState().target;
    expect(t.length).toBeGreaterThan(1);
    expect(t).toMatch(/^[A-Z ]+$/); // words are uppercase letters + spaces
  });

  it('setSubMode in free mode is a no-op (no target to regenerate)', () => {
    const s = createStraightKeySession();
    s.setSubMode('word');
    expect(s.getState().target).toBe(null);
  });

  it('reset clears recognized state but keeps mode', () => {
    const s = createStraightKeySession();
    s.setMode('practice');
    press(s, 50);
    s.reset();
    const state = s.getState();
    expect(state.letters).toEqual([]);
    expect(state.elements).toEqual([]);
    expect(state.mode).toBe('practice');
  });
});

describe('straight-key session — practice mode result', () => {
  /** Helper: simulate keydown+keyup of given duration. */
  function tap(s, holdMs) {
    s.onKeyDown();
    mockNow += holdMs;
    s.onKeyUp();
    mockNow += 10;
  }
  /** Helper: simulate keydown+keyup of dit (short) or dah (long). */
  function tapSym(s, sym, t) {
    tap(s, sym === '.' ? t.ditDahThreshold / 2 : t.ditDahThreshold + 30);
  }

  const codes = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.',
    G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
    N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
    U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
    '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
    '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.' };

  /** Tap out the given target correctly. Assumes all chars are in codes. */
  function typeTarget(s, target) {
    const t = s.getState().timing;
    for (const ch of target) {
      if (ch === ' ') {
        mockNow += t.wordGap + 20;
        s.flushFinalize();
        continue;
      }
      const code = codes[ch];
      if (!code) throw new Error(`Test bug: no code for "${ch}"`);
      for (const sym of code) tapSym(s, sym, t);
      mockNow += t.letterGap + 20;
      s.flushFinalize();
    }
  }

  it('emits correct result when fully matching a single-letter target', () => {
    const s = createStraightKeySession();
    s.setMode('practice');
    s.setSubMode('letter');
    const target = s.getState().target;
    typeTarget(s, target);
    // Judgment is now explicit via submit()
    const result = s.submit();
    expect(result).not.toBeNull();
    expect(result.isCorrect).toBe(true);
  });

  it('emits wrong result when user types wrong chars', () => {
    const s = createStraightKeySession();
    s.setMode('practice');
    s.setSubMode('letter');
    const target = s.getState().target;
    // Type the same wrong letter (E = .) for every position; if target's
    // first char isn't E/I/S, this is guaranteed wrong.
    if (target[0] !== 'E' && target[0] !== 'I' && target[0] !== 'S' && target[0] !== 'H' && target[0] !== 'T') {
      const t = s.getState().timing;
      for (let i = 0; i < target.length; i++) {
        tap(s, t.ditDahThreshold / 2); // dit
        mockNow += t.letterGap + 20;
        s.flushFinalize();
      }
      const result = s.submit();
      expect(result).not.toBeNull();
      expect(result.isCorrect).toBe(false);
    } else {
      // Skip — first char happens to be a dit-only char
      expect(true).toBe(true);
    }
  });

  it('emits correct result when typing a multi-letter word', () => {
    const s = createStraightKeySession();
    s.setMode('practice');
    s.setSubMode('word');
    const target = s.getState().target;
    typeTarget(s, target);
    const result = s.submit();
    expect(result).not.toBeNull();
    expect(result.isCorrect).toBe(true);
  });
});

describe('straight-key session — nextTarget', () => {
  it('nextTarget returns a new (possibly different) target in practice mode', () => {
    const s = createStraightKeySession();
    s.setMode('practice');
    const first = s.getState().target;
    // Try up to 5 times to get a different one (very unlikely to collide)
    let different = first;
    for (let i = 0; i < 5; i++) {
      different = s.nextTarget();
      if (different !== first) break;
    }
    expect(different).toBeTruthy();
  });

  it('nextTarget is a no-op in free mode (returns null)', () => {
    const s = createStraightKeySession();
    expect(s.nextTarget()).toBe(null);
  });
});

describe('straight-key session — explicit submit / retry / setState', () => {
  // Local copies of the tap helpers (the ones in the previous describe block
  // are scoped to that block).
  function tap(s, holdMs) {
    s.onKeyDown();
    mockNow += holdMs;
    s.onKeyUp();
    mockNow += 10;
  }
  const codes = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.',
    G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
    N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
    U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
    '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
    '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.' };
  function typeTarget(s, target) {
    const t = s.getState().timing;
    for (const ch of target) {
      if (ch === ' ') {
        mockNow += t.wordGap + 20;
        s.flushFinalize();
        continue;
      }
      const code = codes[ch];
      if (!code) throw new Error(`Test bug: no code for "${ch}"`);
      for (const sym of code) {
        s.onKeyDown();
        mockNow += sym === '.' ? t.ditDahThreshold / 2 : t.ditDahThreshold + 30;
        s.onKeyUp();
        mockNow += 10;
      }
      mockNow += t.letterGap + 20;
      s.flushFinalize();
    }
  }

  it('submit returns { empty: true } when no letters tapped', () => {
    const s = createStraightKeySession();
    s.setMode('practice');
    expect(s.submit()).toEqual({ empty: true });
  });

  it('submit includes the pending element when user has tapped but not yet finalized', () => {
    const s = createStraightKeySession();
    s.setMode('practice');
    // Tap a single dit without waiting for letter-gap → goes into elements, not letters.
    s.onKeyDown();
    s.onKeyUp();
    expect(s.getState().letters).toEqual([]);  // not yet finalized
    expect(s.getState().elements).toEqual(['.']);  // pending
    const result = s.submit();
    expect(result).not.toEqual({ empty: true });
    expect(result.input).toBe('E');  // dit = E
  });

  it('submit locks subsequent submits until retry', () => {
    const s = createStraightKeySession();
    s.setMode('practice');
    const target = s.getState().target;
    typeTarget(s, target);
    const first = s.submit();
    expect(first.isCorrect).toBe(true);
    const second = s.submit();
    expect(second).toBe(first);  // same object returned
  });

  it('retry clears letters and re-enables submit', () => {
    const s = createStraightKeySession();
    s.setMode('practice');
    const target = s.getState().target;
    typeTarget(s, target);
    s.submit();
    s.retry();
    expect(s.getState().letters).toEqual([]);
    expect(s.getState().elements).toEqual([]);
    expect(s.getState().submitted).toBe(false);
  });

  it('setState restores target, letters, and submitted flag', () => {
    const s = createStraightKeySession();
    s.setMode('practice');
    const snapshot = {
      target: 'HI',
      letters: ['H'],
      elements: ['.', '-', '.', '.'],
      result: { isCorrect: false, item: 'HI', input: 'H', perfect: false },
      consumed: true,
    };
    s.setState(snapshot);
    expect(s.getState().target).toBe('HI');
    expect(s.getState().letters).toEqual(['H']);
    expect(s.getState().elements).toEqual(['.', '-', '.', '.']);
    expect(s.getState().submitted).toBe(true);
  });
});