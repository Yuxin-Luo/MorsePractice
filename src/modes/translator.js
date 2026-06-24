/**
 * Live bidirectional translator: text ↔ morse.
 *
 * Wires two textareas so typing in either side updates the other in
 * real time. The text→morse direction is straightforward (encode).
 * The morse→text direction handles partial codes gracefully:
 *
 *   Input morse: ".... . .-.. .-.. --- / .-- --- .-. .-.. -.."
 *   Decoded:     "HELLO WORLD"
 *
 *   If a token is incomplete (e.g. user typed ".-" but no space yet),
 *   we keep it as-is rather than replacing with garbage — the user is
 *   still typing it.
 *
 *   Slashes '/' translate to spaces (matching encoder's word format).
 */

import { encode, decode } from '../core/encoder.js';
import { playMorse, stop } from '../core/audio.js';

/**
 * Wire the translator UI. Call once on app init.
 *
 * @param {object} els
 * @param {HTMLTextAreaElement} els.textArea - plain text input
 * @param {HTMLTextAreaElement} els.morseArea - morse input
 * @param {HTMLButtonElement} [els.playBtn] - play morse button (optional)
 * @returns {{ detach: () => void }}
 */
export function attachTranslator({ textArea, morseArea, playBtn }) {
  let syncing = false;

  function syncFromText() {
    if (syncing) return;
    syncing = true;
    try {
      const text = textArea.value;
      morseArea.value = text ? encode(text) : '';
    } finally {
      syncing = false;
    }
  }

  function syncFromMorse() {
    if (syncing) return;
    syncing = true;
    try {
      const raw = morseArea.value;
      if (!raw.trim()) {
        textArea.value = '';
        return;
      }
      // Normalize: add spaces around `/` so it always parses as a
      // word-separator token regardless of whether the user typed
      // spaces around it. e.g. both `..../....` and `.... / ....`
      // become `.... / ....` after this step.
      const normalized = raw
        .replace(/\s*\/\s*/g, ' / ')
        .trim();
      const chars = normalized.split(/\s+/).map((token) => {
        if (!token) return '';
        if (token === '/') return ' ';
        // decode() returns '?' for unknown — if so, keep raw token
        // so the user sees what they typed (otherwise it flashes garbage).
        const d = decode(token);
        return d === '?' ? token : d;
      });
      textArea.value = chars.join('');
    } finally {
      syncing = false;
    }
  }

  const onTextInput = () => syncFromText();
  const onMorseInput = () => syncFromMorse();
  const onPlayClick = async () => {
    stop();
    // Use the canonical encoded form so playMorse sees properly-spaced tokens
    const morse = morseArea.value
      .replace(/\s*\/\s*/g, ' / ')
      .trim();
    if (morse) {
      try {
        await playMorse(morse, { wpm: 15, frequency: 600, volume: 0.25 });
      } catch (e) {
        console.error('[translator] play failed:', e);
      }
    }
  };

  textArea.addEventListener('input', onTextInput);
  morseArea.addEventListener('input', onMorseInput);
  if (playBtn) playBtn.addEventListener('click', onPlayClick);

  return {
    detach() {
      textArea.removeEventListener('input', onTextInput);
      morseArea.removeEventListener('input', onMorseInput);
      if (playBtn) playBtn.removeEventListener('click', onPlayClick);
    },
  };
}