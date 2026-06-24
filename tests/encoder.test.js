import { describe, it, expect } from 'vitest';
import { MORSE, FROM_MORSE, encode, decode, isValidPrefix, timing, getPossibleChars } from '../src/core/encoder.js';

describe('MORSE table', () => {
  it('contains all 26 English letters', () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    for (const l of letters) {
      expect(MORSE).toHaveProperty(l);
      expect(MORSE[l]).toMatch(/^[.\-]+$/);
    }
  });

  it('contains all 10 digits with correct codes', () => {
    expect(MORSE['0']).toBe('-----');
    expect(MORSE['1']).toBe('.----');
    expect(MORSE['5']).toBe('.....');
    expect(MORSE['9']).toBe('----.');
  });

  it('contains common punctuation', () => {
    expect(MORSE['.']).toBe('.-.-.-');
    expect(MORSE[',']).toBe('--..--');
    expect(MORSE['?']).toBe('..--..');
    expect(MORSE['/']).toBe('-..-.');
  });
});

describe('FROM_MORSE reverse map', () => {
  it('is a perfect inverse of MORSE', () => {
    expect(FROM_MORSE['.-']).toBe('A');
    expect(FROM_MORSE['-...']).toBe('B');
    expect(FROM_MORSE['-----']).toBe('0');
    expect(FROM_MORSE['..--..']).toBe('?');
  });

  it('returns undefined for non-existent code', () => {
    expect(FROM_MORSE['------']).toBeUndefined();
  });
});

describe('encode()', () => {
  it('encodes a single letter', () => {
    expect(encode('A')).toBe('.-');
    expect(encode('S')).toBe('...');
  });

  it('encodes SOS', () => {
    expect(encode('SOS')).toBe('... --- ...');
  });

  it('encodes a single word with letter gaps', () => {
    expect(encode('HELLO')).toBe('.... . .-.. .-.. ---');
  });

  it('encodes multi-word text with " / " separator', () => {
    expect(encode('HELLO WORLD')).toBe(
      '.... . .-.. .-.. --- / .-- --- .-. .-.. -..'
    );
  });

  it('lowercases → uppercases', () => {
    expect(encode('sos')).toBe('... --- ...');
    expect(encode('Hello')).toBe('.... . .-.. .-.. ---');
  });

  it('skips unknown characters silently', () => {
    expect(encode('A€B')).toBe('.- -...');
  });

  it('returns empty string for empty input', () => {
    expect(encode('')).toBe('');
    expect(encode('   ')).toBe('');
  });

  it('handles single-character digits', () => {
    expect(encode('5')).toBe('.....');
    expect(encode('73')).toBe('--... ...--');
  });
});

describe('decode()', () => {
  it('decodes a single morse code to its letter', () => {
    expect(decode('.-')).toBe('A');
    expect(decode('...')).toBe('S');
    expect(decode('-----')).toBe('0');
  });

  it('returns "?" for unknown morse code', () => {
    expect(decode('------')).toBe('?');
    expect(decode('..-..')).toBe('?');
  });

  it('decodes punctuation', () => {
    expect(decode('.-.-.-')).toBe('.');
    expect(decode('--..--')).toBe(',');
  });
});

describe('isValidPrefix()', () => {
  it('returns true for empty prefix', () => {
    expect(isValidPrefix('')).toBe(true);
  });

  it('returns true for any valid prefix of a known code', () => {
    expect(isValidPrefix('.')).toBe(true);   // A, I, S, H, etc.
    expect(isValidPrefix('-')).toBe(true);   // T, N, M, etc.
    expect(isValidPrefix('.-')).toBe(true);  // A
    expect(isValidPrefix('--')).toBe(true);  // M, G, etc.
  });

  it('returns false for codes that are prefixes of nothing', () => {
    expect(isValidPrefix('------')).toBe(false); // 6+ dashes never valid
    expect(isValidPrefix('....-..')).toBe(false); // 7+ chars never valid
  });
});

describe('timing()', () => {
  it('at 20 WPM: dit = 60ms, dah = 180ms', () => {
    const t = timing(20);
    expect(t.dit).toBe(60);
    expect(t.dah).toBe(180);
  });

  it('at 10 WPM: dit = 120ms, dah = 360ms', () => {
    const t = timing(10);
    expect(t.dit).toBe(120);
    expect(t.dah).toBe(360);
  });

  it('defaults farnsworth to wpm when not given', () => {
    const t = timing(20);
    // letterGap = slowUnit * 3 = (1200/20) * 3 = 180
    expect(t.letterGap).toBe(180);
  });

  it('with Farnsworth: letter/word gaps use slower speed', () => {
    const t = timing(20, 10);
    // slowUnit = 1200/10 = 120; letterGap = 120*3 = 360
    expect(t.letterGap).toBe(360);
    expect(t.wordGap).toBe(840); // 120*7
    // dit/dah still use 20 WPM
    expect(t.dit).toBe(60);
    expect(t.dah).toBe(180);
  });

  it('wordGap = 7 units at any speed', () => {
    expect(timing(15).wordGap).toBe((1200 / 15) * 7);
  });
});

describe('getPossibleChars (real-time prefix lookup)', () => {
  it('returns every character when prefix is empty', () => {
    const chars = getPossibleChars('');
    // MORSE table has alphanumerics + common punctuation
    expect(chars.length).toBe(Object.keys(MORSE).length);
    expect(chars).toEqual(expect.arrayContaining(['E', 'T', 'A', 'S', 'H', '5', '0']));
  });

  it('returns every character when prefix is omitted', () => {
    expect(getPossibleChars().length).toBe(Object.keys(MORSE).length);
  });

  it('returns chars for a single dit prefix', () => {
    // Includes E=.  I=..  S=...  H=....  5=.....  T=-  A=.- etc. (anything starting with .)
    const chars = getPossibleChars('.');
    expect(chars).toEqual(expect.arrayContaining(['E', 'I', 'S', 'H', '5']));
    // Sanity: it MUST include the E (the pure dit)
    expect(chars).toContain('E');
    // A prefix `.` matches A=.-, T=-, etc.
    expect(chars.length).toBeGreaterThan(5);
  });

  it('returns chars for .- prefix', () => {
    // A=.-  R=.-.  W=.--  N=-. etc. (anything starting with .-)
    const chars = getPossibleChars('.-');
    expect(chars).toEqual(expect.arrayContaining(['A', 'R', 'W']));
    // Should NOT contain pure dit (E=.) or pure dah (T=-)
    expect(chars).not.toContain('E');
    expect(chars).not.toContain('T');
  });

  it('returns multiple chars for a prefix that\'s a prefix of multiple codes', () => {
    // .... matches H=...., 4=....-, 5=.....
    expect(getPossibleChars('....').sort()).toEqual(['4', '5', 'H'].sort());
  });

  it('returns one or few chars for a near-complete code', () => {
    // .---- is 1; .----. is ' (apostrophe) — both share the prefix
    expect(getPossibleChars('.----')).toEqual(expect.arrayContaining(['1']));
    expect(getPossibleChars('.----').length).toBeLessThanOrEqual(2);
    // ----. is uniquely 9 (since ----.. isn't a thing)
    expect(getPossibleChars('----.')).toEqual(['9']);
  });

  it('returns empty array for an invalid prefix', () => {
    expect(getPossibleChars('....x')).toEqual([]);
    expect(getPossibleChars('z')).toEqual([]);
  });

  it('treats empty / null / undefined input as empty prefix (returns all chars)', () => {
    const baseline = getPossibleChars('');
    expect(getPossibleChars(null)).toEqual(baseline);
    expect(getPossibleChars(undefined)).toEqual(baseline);
  });
});

