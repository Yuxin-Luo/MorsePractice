/**
 * Morse encoder/decoder + timing utilities.
 *
 * Re-exports MORSE/FROM_MORSE from morse-table for convenient single-import use.
 * Algorithm reference: PARIS standard — 1 word = 50 dit-units, so
 * 1 dit-unit = 1200 / wpm milliseconds. Dah = 3 dit-units. Letter
 * gap = 3 dit-units. Word gap = 7 dit-units. Farnsworth spacing
 * uses a separate (slower) unit for inter-character gaps while
 * keeping character speed unchanged.
 */

import { MORSE, FROM_MORSE } from './morse-table.js';

export { MORSE, FROM_MORSE };

/**
 * Encode plain text into space-separated Morse. Words separated by ' / '.
 * Unknown characters are silently dropped.
 *
 * @param {string} text - input text, case-insensitive
 * @returns {string} morse representation
 */
export function encode(text) {
  if (!text) return '';
  return text
    .toUpperCase()
    .split(' ')
    .filter((w) => w.length > 0)
    .map((word) =>
      word
        .split('')
        .map((c) => MORSE[c] ?? '')
        .filter(Boolean)
        .join(' ')
    )
    .filter((w) => w.length > 0)
    .join(' / ');
}

/**
 * Decode a single Morse cluster (e.g. ".-") to a character.
 * Returns '?' for unknown clusters.
 *
 * @param {string} symbols
 * @returns {string}
 */
export function decode(symbols) {
  return FROM_MORSE[symbols] ?? '?';
}

/**
 * Check whether `prefix` is a valid prefix of any Morse code.
 * Empty string is a valid prefix (vacuously true).
 *
 * @param {string} prefix
 * @returns {boolean}
 */
export function isValidPrefix(prefix) {
  if (prefix.length === 0) return true;
  for (const code of Object.values(MORSE)) {
    if (code.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Compute standard Morse timing in milliseconds from words-per-minute.
 *
 * @param {number} wpm - character speed (PARIS)
 * @param {number} [farnsworth=wpm] - inter-character gap speed; if
 *   lower than wpm, it slows the letter/word gaps while keeping
 *   character speed unchanged.
 * @returns {{dit: number, dah: number, ditDahThreshold: number,
 *   intraChar: number, letterGap: number, wordGap: number}}
 */
export function timing(wpm, farnsworth = wpm) {
  const unit = 1200 / wpm;
  const slowUnit = 1200 / farnsworth;
  return {
    dit: unit,
    dah: unit * 3,
    /** Threshold separating a tap (dit) from a hold (dah). */
    ditDahThreshold: unit * 2,
    /** Gap between symbols within a character. */
    intraChar: unit,
    /** Gap that signals "letter complete". */
    letterGap: slowUnit * 3,
    /** Gap that signals "word complete". */
    wordGap: slowUnit * 7,
  };
}
