import { describe, it, expect } from 'vitest';
import { generateListenQuestion, judgeListenAnswer, createListenSession } from '../src/modes/listen.js';
import wordsBank from '../src/data/words.js';
import sentencesBank from '../src/data/sentences.js';

describe('generateListenQuestion()', () => {
  it('returns a letter-mode question', () => {
    const q = generateListenQuestion('letter');
    expect(q.mode).toBe('letter');
    expect(q.item).toMatch(/^[A-Z0-9]$/);
    expect(q.morse).toMatch(/^[.\-]+$/);
  });

  it('returns a word-mode question from the bank', () => {
    const q = generateListenQuestion('word');
    expect(wordsBank).toContain(q.item);
  });

  it('returns a sentence-mode question from the bank', () => {
    const q = generateListenQuestion('sentence');
    expect(sentencesBank).toContain(q.item);
    expect(q.morse).toContain(' / ');
  });

  it('throws on unknown mode', () => {
    expect(() => generateListenQuestion('foo')).toThrow();
  });
});

describe('judgeListenAnswer()', () => {
  it('correct letter', () => {
    expect(judgeListenAnswer('A', 'A').isCorrect).toBe(true);
  });

  it('correct word (case-insensitive)', () => {
    expect(judgeListenAnswer('HELLO', 'hello').isCorrect).toBe(true);
  });

  it('partial word per char', () => {
    const r = judgeListenAnswer('HELLO', 'HXLLO');
    expect(r.isCorrect).toBe(false);
    expect(r.charResults).toEqual([true, false, true, true, true]);
  });
});

describe('createListenSession()', () => {
  it('initializes with a question', () => {
    const events = [];
    const s = createListenSession({
      mode: 'letter',
      onItemChange: (s) => events.push(s),
    });
    expect(s.getState().item).toMatch(/^[A-Z0-9]$/);
    expect(events).toHaveLength(1);
  });

  it('setInput + submit judges', () => {
    const results = [];
    const s = createListenSession({
      mode: 'letter',
      onResult: (r) => results.push(r),
    });
    const target = s.getState().item;
    s.setInput(target);
    s.submit();
    expect(results).toHaveLength(1);
    expect(results[0].result.isCorrect).toBe(true);
  });
});
