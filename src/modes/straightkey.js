/**
 * Straight-key mode: user taps morse by holding a key (Space by default).
 *
 * Two modes:
 *   - free:     user just taps; recognition is displayed live, no target
 *   - practice: system picks a target (letter/word/sentence); user taps
 *               to match it; feedback shown when the user has matched
 *               the full target length.
 *
 * Time-based element classification:
 *   - hold time <  ditDahThreshold → dit  (.)
 *   - hold time >= ditDahThreshold → dah  (-)
 *
 * Gap-based letter/word finalization:
 *   - on next keydown, measure gap since last keyup
 *   - gap >= wordGap   → finalize current letter + add word space
 *   - gap >= letterGap → finalize current letter (same word)
 *   - gap <  letterGap → still typing the same letter
 *
 * The state machine is decoupled from the DOM: it accepts raw keydown/
 * keyup events (or pointerdown/pointerup from the mobile fallback) and
 * emits structured state via onChange. The UI is just a renderer.
 */

import { MORSE, FROM_MORSE } from '../core/morse-table.js';
import { getPossibleChars, timing } from '../core/encoder.js';
import { generateQuestion } from './forward.js';
import { generateListenQuestion } from './listen.js';
import { judgeAnswer } from './forward.js';
import { playTone, stopTone } from '../core/audio.js';

/**
 * Generate a practice-mode target based on the requested sub-mode.
 */
function generateTarget(subMode) {
  if (subMode === 'letter') return generateQuestion('letter').item;
  if (subMode === 'word') return generateQuestion('word').item;
  if (subMode === 'sentence') return generateListenQuestion('sentence').item;
  return 'A';
}

/**
 * Build display strings for the recognized-so-far state.
 *   finalized: e.g. "HEL"
 *   currentChar: e.g. "L"  (or "" if no current element)
 */
function buildDisplay(finalizedLetters, currentElements) {
  const finalized = finalizedLetters.join('');
  const currentCode = currentElements.join('');
  const currentChar = currentCode ? (FROM_MORSE[currentCode] || '?') : '';
  return { finalized, currentCode, currentChar };
}

/**
 * Create a straight-key session.
 *
 * @param {object} [opts]
 * @param {number} [opts.wpm=15] - reference speed; sets the dit/dah threshold
 * @param {(state: object) => void} [opts.onChange] - called whenever the
 *   recognition state changes (after every keyup, mode switch, reset, etc.)
 * @param {(result: object) => void} [opts.onResult] - practice mode only;
 *   called when the user has produced a complete tap matching the target length
 */
export function createStraightKeySession(opts = {}) {
  const { wpm = 15, onChange, onResult } = opts;
  const t = timing(wpm, wpm);

  let elements = [];        // current letter's dit/dah symbols e.g. ['.', '-']
  let letters = [];         // finalized letters + spaces e.g. ['H','E','L','L','O',' ']
  let currentOsc = null;
  let pressStart = 0;
  let lastRelease = 0;
  let mode = 'free';
  let subMode = 'letter';
  let target = null;
  let submitted = false;    // explicit submit gate; mirrors forward mode's consumed
  let lastResult = null;    // { isCorrect, item, input, perfect } from most recent submit

  function classifyByDuration(durMs) {
    return durMs < t.ditDahThreshold ? '.' : '-';
  }

  function finalizeLetter() {
    if (elements.length === 0) return;
    const code = elements.join('');
    letters.push(FROM_MORSE[code] || '?');
    elements = [];
  }

  function finalizeWord() {
    if (letters.length === 0 || letters[letters.length - 1] === ' ') return;
    letters.push(' ');
  }

  function maybeEmitPracticeResult() {
    // Kept as a no-op for now (judgment moved to submit()).
    // Removed the length-triggered auto-emit because users can now control
    // when to submit via the Submit button — auto-judging on length would
    // short-circuit the new explicit-submit flow.
  }

  /**
   * Explicit submission: judge the user's current `letters` against `target`
   * and return the result. Sets the `submitted` flag so subsequent submits
   * are no-ops (until retry). Only meaningful in practice mode.
   *
   * @returns {{ isCorrect: boolean, item: string, input: string, perfect: boolean } | { empty: true } | null}
   */
  function submit() {
    if (mode !== 'practice' || !target) return null;
    if (submitted) return lastResult;
    // Combine finalized letters + the current pending letter (if user is
    // mid-tap with no letter-gap yet). The renderer already shows the
    // pending element as a <pending> marker in the recognized area, so the
    // user sees it as part of their input — submit should agree.
    const currentCode = elements.join('');
    const currentChar = currentCode ? (FROM_MORSE[currentCode] || '') : '';
    const flat = (letters.join('') + currentChar).replace(/\s+/g, '').trim();
    const targetFlat = target.replace(/\s+/g, '').trim();
    if (!flat) return { empty: true };
    const inputSlice = flat.slice(0, targetFlat.length);
    const isCorrect = inputSlice === targetFlat;
    lastResult = { isCorrect, item: target, input: flat, perfect: isCorrect };
    submitted = true;
    emit();
    return lastResult;
  }

  /**
   * Retry the current question: clear user's tapped letters and reset the
   * submitted flag. Target is preserved. The next submit will record again.
   */
  function retry() {
    elements = [];
    letters = [];
    lastRelease = 0;
    submitted = false;
    lastResult = null;
    if (currentOsc) { stopTone(currentOsc); currentOsc = null; }
    emit();
  }

  /**
   * Restore the session to a previously-saved snapshot (used by app.js for
   * prev-question navigation). Emits once so the UI re-renders.
   *
   * @param {{ target: string, letters: string[], elements: string[], result: object|null, consumed: boolean }} snapshot
   */
  function setState(snapshot) {
    if (!snapshot) return;
    target = snapshot.target;
    letters = [...(snapshot.letters || [])];
    elements = [...(snapshot.elements || [])];
    lastResult = snapshot.result || null;
    submitted = !!snapshot.consumed;
    lastRelease = 0;
    if (currentOsc) { stopTone(currentOsc); currentOsc = null; }
    emit();
  }

  function emit() {
    const display = buildDisplay(letters, elements);
    onChange?.({
      mode,
      target,
      subMode,
      recognized: display.finalized,
      currentCode: display.currentCode,
      currentChar: display.currentChar,
      possible: display.currentCode ? getPossibleChars(display.currentCode) : [],
      isHolding: !!currentOsc,
      threshold: t.ditDahThreshold,
      letters: [...letters],
      elements: [...elements],
      submitted,
      lastResult,
    });
  }

  function onKeyDown() {
    if (currentOsc) return;
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (lastRelease > 0) {
      const gap = now - lastRelease;
      if (gap >= t.wordGap) { finalizeLetter(); finalizeWord(); }
      else if (gap >= t.letterGap) { finalizeLetter(); }
    }
    pressStart = now;
    currentOsc = playTone({ durationMs: Math.max(t.dah, 80), frequency: 600, volume: 0.25 });
    emit();
  }

  function onKeyUp() {
    if (!currentOsc) return;
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const dur = now - pressStart;
    stopTone(currentOsc);
    currentOsc = null;
    const symbol = classifyByDuration(dur);
    elements.push(symbol);
    lastRelease = now;
    emit();
    maybeEmitPracticeResult();
  }

  function reset() {
    elements = [];
    letters = [];
    lastRelease = 0;
    if (currentOsc) {
      stopTone(currentOsc);
      currentOsc = null;
    }
    submitted = false;
    lastResult = null;
    if (mode === 'practice') {
      target = target ?? generateTarget(subMode);
    } else {
      target = null;
    }
    emit();
  }

  function nextTarget() {
    if (mode !== 'practice') return null;
    submitted = false;
    lastResult = null;
    target = generateTarget(subMode);
    elements = [];
    letters = [];
    lastRelease = 0;
    if (currentOsc) { stopTone(currentOsc); currentOsc = null; }
    emit();
    return target;
  }

  function backspace() {
    if (elements.length > 0) {
      elements.pop();
      emit();
      return;
    }
    if (letters.length > 0) {
      letters.pop();
      emit();
      return;
    }
  }

  /**
   * Force-finalize any pending element (treat as if a long gap just elapsed).
   * Useful for tests and for the UI to flush after a quiet period.
   */
  function flushFinalize() {
    finalizeLetter();
    emit();
    maybeEmitPracticeResult();
  }

  function setMode(m) {
    if (m !== 'free' && m !== 'practice') return;
    if (mode === m) return;
    mode = m;
    if (m === 'practice') {
      target = generateTarget(subMode);
    } else {
      target = null;
    }
    reset();
  }

  function setSubMode(sm) {
    if (!['letter', 'word', 'sentence'].includes(sm)) return;
    subMode = sm;
    if (mode === 'practice') {
      target = generateTarget(subMode);
      reset();
    }
  }

  // Initial emit so the UI shows empty state immediately
  emit();

  return {
    onKeyDown,
    onKeyUp,
    reset,
    backspace,
    flushFinalize,
    nextTarget,
    setMode,
    setSubMode,
    submit,
    retry,
    setState,
    getState: () => {
      // Same shape as the onChange payload so renderers can consume either.
      const display = buildDisplay(letters, elements);
      return {
        mode,
        subMode,
        target,
        letters: [...letters],
        elements: [...elements],
        threshold: t.ditDahThreshold,
        timing: { ...t },
        recognized: display.finalized,
        currentCode: display.currentCode,
        currentChar: display.currentChar,
        possible: display.currentCode ? getPossibleChars(display.currentCode) : [],
        isHolding: !!currentOsc,
        submitted,
        lastResult,
      };
    },
  };
}