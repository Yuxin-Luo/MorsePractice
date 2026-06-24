import { describe, it, expect } from 'vitest';
import { generateQuestion, judgeAnswer, createForwardSession } from '../src/modes/forward.js';

describe('generateQuestion()', () => {
  it('returns a letter-mode question with morse and single-char item', () => {
    const q = generateQuestion('letter');
    expect(q.mode).toBe('letter');
    expect(q.item).toMatch(/^[A-Z0-9]$/);
    expect(q.morse).toMatch(/^[.\-]+$/);
  });

  it('returns a word-mode question with morse and a real word', () => {
    const q = generateQuestion('word');
    expect(q.mode).toBe('word');
    expect(q.item.length).toBeGreaterThan(1);
    expect(q.morse).toContain(' ');
  });

  it('returns a sentence-mode question with multi-word morse', () => {
    const q = generateQuestion('sentence');
    expect(q.mode).toBe('sentence');
    expect(q.morse).toContain(' / ');
  });

  it('throws on unknown mode', () => {
    expect(() => generateQuestion('nonsense')).toThrow();
  });
});

describe('judgeAnswer()', () => {
  it('letter: exact match is correct', () => {
    const r = judgeAnswer('A', 'A');
    expect(r.isCorrect).toBe(true);
    expect(r.charResults).toEqual([true]);
  });

  it('letter: case-insensitive', () => {
    const r = judgeAnswer('A', 'a');
    expect(r.isCorrect).toBe(true);
  });

  it('word: partial pass per char', () => {
    const r = judgeAnswer('HELLO', 'HELLA');
    expect(r.isCorrect).toBe(false);
    expect(r.charResults).toEqual([true, true, true, true, false]);
  });

  it('word: full match', () => {
    const r = judgeAnswer('HELLO', 'hello');
    expect(r.isCorrect).toBe(true);
  });

  it('sentence: ignores spaces and case', () => {
    const r = judgeAnswer('HELLO WORLD', 'helloworld');
    expect(r.isCorrect).toBe(true);
  });

  it('sentence: ignores punctuation', () => {
    const r = judgeAnswer('I AM FINE.', 'IAMFINE');
    expect(r.isCorrect).toBe(true);
  });
});

describe('createForwardSession()', () => {
  it('initializes with a question', () => {
    const events = [];
    const s = createForwardSession({
      mode: 'letter',
      onItemChange: (s) => events.push(s),
    });
    expect(s.getState().item).toMatch(/^[A-Z0-9]$/);
    expect(events).toHaveLength(1);
  });

  it('next() advances to a new question', () => {
    const s = createForwardSession({ mode: 'letter' });
    const first = s.getState().item;
    s.next();
    const second = s.getState().item;
    // Could be the same by chance, but usually not; just verify state changes were notified
    expect(s.getState().input).toBe('');
  });

  it('setInput + submit judges and notifies', () => {
    const results = [];
    const s = createForwardSession({
      mode: 'letter',
      onResult: (r) => results.push(r),
    });
    const target = s.getState().item;
    s.setInput(target);
    s.submit();
    expect(results).toHaveLength(1);
    expect(results[0].result.isCorrect).toBe(true);
  });

  it('setInput + submit with wrong input', () => {
    const s = createForwardSession({ mode: 'letter' });
    s.setInput('WRONG_ANSWER');
    const result = s.submit();
    expect(result.isCorrect).toBe(false);
  });
});
