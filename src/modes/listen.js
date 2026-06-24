/**
 * Listen mode: play morse, user types what they heard.
 *
 * Three sub-modes (matching forward):
 *  - letter:   plays single character morse, user types 1 char
 *  - word:     plays word morse, user types the word
 *  - sentence: plays full sentence morse, user types the sentence
 *
 * Reuses:
 *  - encode() from core/encoder to render morse for playback
 *  - playMorse() from core/audio for sound
 *  - judgeAnswer() from modes/forward for the verdict (kept DRY)
 */

import { encode } from '../core/encoder.js';
import { playMorse } from '../core/audio.js';
import { judgeAnswer } from './forward.js';
import wordsBank from '../data/words.js';
import sentencesBank from '../data/sentences.js';

const LETTER_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');

function randItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a listen-mode question. The morse string is pre-encoded here
 * so the controller can pass it straight to playMorse().
 *
 * @param {'letter'|'word'|'sentence'} mode
 * @returns {{item: string, morse: string, mode: string}}
 */
export function generateListenQuestion(mode) {
  let item;
  if (mode === 'letter') {
    item = randItem(LETTER_POOL);
  } else if (mode === 'word') {
    item = randItem(wordsBank);
  } else if (mode === 'sentence') {
    item = randItem(sentencesBank);
  } else {
    throw new Error(`Unknown listen mode: ${mode}`);
  }
  return { item, morse: encode(item), mode };
}

/**
 * Convenience: judge the listen answer using the same logic as forward.
 */
export function judgeListenAnswer(target, input) {
  return judgeAnswer(target, input);
}

/**
 * Play a listen-mode question, then resolve when audio finishes.
 * Exposes a stop() to abort.
 */
export async function playListenQuestion(question, opts = {}) {
  const { wpm = 15, frequency = 600, volume = 0.25 } = opts;
  await playMorse(question.morse, { wpm, frequency, volume });
}

/**
 * Build a "Listen mode" controller. Same shape as forward session.
 */
export function createListenSession({ mode, onItemChange, onResult, onPlayEnd } = {}) {
  let current = null;
  let currentInput = '';
  let lastResult = null;

  const next = () => {
    current = generateListenQuestion(mode);
    currentInput = '';
    lastResult = null;
    if (onItemChange) onItemChange({ ...current, input: currentInput, result: null });
  };

  const play = async (opts) => {
    if (!current) return;
    await playListenQuestion(current, opts);
    if (onPlayEnd) onPlayEnd();
  };

  const setInput = (input) => {
    currentInput = input;
  };

  const submit = () => {
    if (!current) return;
    lastResult = judgeListenAnswer(current.item, currentInput);
    if (onResult) onResult({ item: current.item, morse: current.morse, input: currentInput, result: lastResult });
    return lastResult;
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

  return { next, play, setInput, submit, getState, mode };
}
