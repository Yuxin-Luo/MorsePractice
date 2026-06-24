import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadProgress,
  saveProgress,
  resetProgress,
  recordAttempt,
  getCharAccuracy,
  getWeakestChars,
  getSummary,
  saveCurrent,
  loadCurrent,
} from '../src/storage/progress.js';

beforeEach(() => {
  // Clear localStorage between tests.
  try { localStorage.clear(); } catch {}
  resetProgress();
});

describe('loadProgress / saveProgress / resetProgress', () => {
  it('returns default state when nothing is saved', () => {
    const s = loadProgress();
    expect(s.version).toBe(1);
    expect(s.stats).toEqual({});
    expect(s.history).toEqual([]);
    expect(s.current).toBe(null);
  });

  it('persists state across loads', () => {
    const s1 = loadProgress();
    s1.stats['A'] = { seen: 1, correct: 1, lastSeenAt: 0 };
    saveProgress(s1);
    const s2 = loadProgress();
    expect(s2.stats['A']).toEqual({ seen: 1, correct: 1, lastSeenAt: 0 });
  });

  it('resetProgress clears all data', () => {
    const s1 = loadProgress();
    s1.stats['A'] = { seen: 1, correct: 1, lastSeenAt: 0 };
    saveProgress(s1);
    resetProgress();
    const s2 = loadProgress();
    expect(s2.stats).toEqual({});
  });
});

describe('recordAttempt()', () => {
  it('increments per-char seen/correct counters', () => {
    let s = loadProgress();
    s = recordAttempt(s, 'word', 'HELLO', 'HELLO', true);
    expect(s.stats['H'].seen).toBe(1);
    expect(s.stats['H'].correct).toBe(1);
    expect(s.stats['L'].seen).toBe(2); // HELLO has 2 L's
    expect(s.stats['L'].correct).toBe(2);
  });

  it('marks wrong chars as seen but not correct', () => {
    let s = loadProgress();
    s = recordAttempt(s, 'word', 'HELLO', 'HELLA', false);
    expect(s.stats['O'].seen).toBe(1);
    expect(s.stats['O'].correct).toBe(0);
    // We only track expected chars, so 'A' (typed but not in target) has no stats
    expect(s.stats['A']).toBeUndefined();
  });

  it('appends to history with timestamp and metadata', () => {
    let s = loadProgress();
    s = recordAttempt(s, 'letter', 'A', 'A', true);
    expect(s.history).toHaveLength(1);
    expect(s.history[0]).toMatchObject({ mode: 'letter', item: 'A', input: 'A', isCorrect: true });
    expect(typeof s.history[0].ts).toBe('number');
  });

  it('caps history at 200 entries', () => {
    let s = loadProgress();
    for (let i = 0; i < 250; i++) {
      s = recordAttempt(s, 'letter', 'A', 'A', true);
    }
    expect(s.history).toHaveLength(200);
  });

  it('is case-insensitive and ignores non-alphanumeric', () => {
    let s = loadProgress();
    s = recordAttempt(s, 'sentence', 'HELLO WORLD', 'helloworld', true);
    expect(s.stats['H'].correct).toBe(1);
    expect(s.stats['D'].correct).toBe(1);
  });
});

describe('getCharAccuracy()', () => {
  it('returns null for unseen char', () => {
    expect(getCharAccuracy(loadProgress(), 'Z')).toBe(null);
  });

  it('returns accuracy ratio', () => {
    let s = loadProgress();
    s = recordAttempt(s, 'word', 'AAA', 'AAB', false); // 2/3 correct
    s = recordAttempt(s, 'word', 'AAA', 'AAA', true);  // 3/3 correct
    // Hmm, 2/3 then 3/3 = 5/6 ≈ 0.833
    const acc = getCharAccuracy(s, 'A');
    expect(acc).toBeCloseTo(5 / 6, 3);
  });
});

describe('getWeakestChars()', () => {
  it('returns chars sorted by accuracy ascending, requires min 3 seen', () => {
    let s = loadProgress();
    // 4 correct
    for (let i = 0; i < 4; i++) s = recordAttempt(s, 'word', 'A', 'A', true);
    // 4 wrong
    for (let i = 0; i < 4; i++) s = recordAttempt(s, 'word', 'B', 'C', false);
    // 1 sample of D (excluded by min-seen=3)
    s = recordAttempt(s, 'word', 'D', 'E', false);

    const weak = getWeakestChars(s, 5);
    expect(weak[0].ch).toBe('B');
    expect(weak[0].accuracy).toBe(0);
    // D not in list (only 1 sample)
    expect(weak.find((w) => w.ch === 'D')).toBeUndefined();
  });
});

describe('getSummary()', () => {
  it('computes totals and accuracy', () => {
    let s = loadProgress();
    s = recordAttempt(s, 'letter', 'A', 'A', true);
    s = recordAttempt(s, 'letter', 'B', 'C', false);
    s = recordAttempt(s, 'letter', 'A', 'A', true);
    const sum = getSummary(s);
    expect(sum.totalAttempts).toBe(3);
    expect(sum.correctAttempts).toBe(2);
    expect(sum.accuracy).toBeCloseTo(2 / 3);
    expect(sum.uniqueChars).toBeGreaterThanOrEqual(2);
  });
});

describe('saveCurrent / loadCurrent', () => {
  it('round-trips a current question', () => {
    let s = loadProgress();
    s = saveCurrent(s, 'word', 'HELLO', 'HEL');
    saveProgress(s);
    const loaded = loadProgress();
    expect(loadCurrent(loaded)).toEqual({ mode: 'word', item: 'HELLO', input: 'HEL' });
  });
});
