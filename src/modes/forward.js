/**
 * Forward practice mode: given a target, user types the answer.
 *
 * Three sub-modes:
 *  - letter:    target is a single character (A-Z + 0-9), user types 1 char
 *  - word:      target is a word, user types it character by character
 *  - sentence:  target is a sentence, user types ignoring spaces/punctuation
 *
 * Judging:
 *  - letter:    exact match (case-insensitive)
 *  - word:      per-character (correct chars highlighted green, wrong red)
 *  - sentence:  case-insensitive, ignore non-alphanumeric, per-char
 */

import { encode } from '../core/encoder.js';

const LETTER_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');

/** Built-in word/sentence bank (small but functional for v1). */
const WORDS = [
  'HELLO', 'WORLD', 'SOS', 'TEST', 'CODE', 'PRACTICE', 'MORSE',
  'RADIO', 'LIGHT', 'SOUND', 'WAVE', 'TONE', 'BEAT', 'NOTE', 'KEY',
  'DIT', 'DAH', 'HAM', 'CW', 'FREQ', 'PITCH', 'DASH', 'DOT',
  'APPLE', 'BEACH', 'CLOUD', 'DREAM', 'EARTH', 'FLAME', 'GRASS',
  'HOUSE', 'INDEX', 'JOKER', 'KNIFE', 'LEMON', 'MOUSE', 'NORTH',
  'OCEAN', 'PIANO', 'QUEEN', 'RIVER', 'STORM', 'TIGER', 'UNCLE',
  'VIOLET', 'WATER', 'YELLOW', 'ZEBRA',
];

const SENTENCES = [
  'I AM FINE',
  'HELLO WORLD',
  'THE QUICK BROWN FOX',
  'PRACTICE MAKES PERFECT',
  'MORSE CODE IS FUN',
  'CQ CQ CQ',
  'THE RAIN IN SPAIN',
  'A QUICK MOVEMENT OF THE ENEMY',
  'TO BE OR NOT TO BE',
  'KNOWLEDGE IS POWER',
];

function randItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a question for the given mode.
 * @param {'letter'|'word'|'sentence'} mode
 * @returns {{item: string, morse: string, mode: string}}
 */
export function generateQuestion(mode) {
  let item;
  if (mode === 'letter') {
    item = randItem(LETTER_POOL);
  } else if (mode === 'word') {
    item = randItem(WORDS);
  } else if (mode === 'sentence') {
    item = randItem(SENTENCES);
  } else {
    throw new Error(`Unknown mode: ${mode}`);
  }
  return { item, morse: encode(item), mode };
}

/**
 * Strip non-alphanumeric characters for sentence judging.
 */
function normalize(s) {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Judge the user's input against the target.
 *
 * Returns:
 *  {
 *    isCorrect: boolean,           // overall
 *    charResults: boolean[],       // per-character pass/fail
 *    expected: string,             // normalized expected text
 *    actual: string,               // normalized user input
 *  }
 */
export function judgeAnswer(target, input) {
  const expected = normalize(target);
  const actual = normalize(input);
  const charResults = [];
  const len = Math.max(expected.length, actual.length);
  for (let i = 0; i < len; i++) {
    charResults.push(expected[i] === actual[i]);
  }
  return {
    isCorrect: expected === actual,
    charResults,
    expected,
    actual,
  };
}

/**
 * Build a "Forward mode" controller.
 * Notifies via callbacks (loose coupling — UI doesn't import this class internals).
 */
export function createForwardSession({ mode, onItemChange, onResult, onError } = {}) {
  let current = null;
  let currentInput = '';
  let lastResult = null;

  const next = () => {
    current = generateQuestion(mode);
    currentInput = '';
    lastResult = null;
    if (onItemChange) onItemChange({ ...current, input: currentInput, result: null });
  };

  const retry = () => {
    // Re-judge with the same item and current input
    if (!current) return;
    lastResult = judgeAnswer(current.item, currentInput);
    if (onResult) onResult({ item: current.item, morse: current.morse, input: currentInput, result: lastResult });
  };

  const submit = () => {
    if (!current) return;
    lastResult = judgeAnswer(current.item, currentInput);
    if (onResult) onResult({ item: current.item, morse: current.morse, input: currentInput, result: lastResult });
    return lastResult;
  };

  const setInput = (input) => {
    currentInput = input;
  };

  const getState = () => ({
    mode,
    item: current?.item ?? null,
    morse: current?.morse ?? null,
    input: currentInput,
    result: lastResult,
  });

  // Initialize
  next();

  return { next, retry, submit, setInput, getState, mode };
}
