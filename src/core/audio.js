/**
 * Morse audio engine using Web Audio API.
 *
 * Design notes:
 *  - Singleton AudioContext (lazy-inited on first user gesture for iOS Safari).
 *  - OscillatorNode with sine wave; gain envelope avoids audible click on
 *    attack/release.
 *  - Farnsworth spacing: dit/dah use wpm, letter/word gaps use farnsworth
 *    (if lower). See encoder.timing() for the math.
 *  - playMorse() returns a Promise that resolves when the sequence ends,
 *    plus exposes a stop() handle to abort mid-playback.
 */

import { timing } from './encoder.js';

let _ctx = null;
let _activeAbort = null;

/** Get the shared AudioContext, creating it on first call. */
export function getAudioContext() {
  if (!_ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) throw new Error('Web Audio API not supported in this browser');
    _ctx = new Ctor();
  }
  return _ctx;
}

/**
 * Play a morse string (with ' / ' word separators).
 *
 * @param {string} morse - morse string from encode() e.g. "... --- ..."
 * @param {object} [opts]
 * @param {number} [opts.wpm=20] - character speed
 * @param {number} [opts.farnsworth] - inter-character gap speed
 * @param {number} [opts.frequency=600] - tone frequency in Hz
 * @param {number} [opts.volume=0.3] - peak gain (0-1)
 * @param {() => void} [opts.onEnd] - called when playback finishes or is aborted
 * @returns {Promise<void>} resolves on natural end; abort via returned handle's stop()
 */
export function playMorse(morse, opts = {}) {
  const { wpm = 20, farnsworth, frequency = 600, volume = 0.3, onEnd } = opts;
  const t = timing(wpm, farnsworth);
  const ctx = getAudioContext();

  // Abort any in-flight playback.
  if (_activeAbort) _activeAbort();

  return new Promise((resolve) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Resume context if suspended (iOS Safari auto-suspends).
    if (ctx.state === 'suspended') ctx.resume();

    const startTime = ctx.currentTime + 0.05; // 50ms lead-in
    const attack = 0.005; // 5ms
    const release = 0.01; // 10ms
    let cursor = startTime;
    let aborted = false;
    const cleanups = [];

    const schedule = () => {
      const tokens = morse.split(' ');

      for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        if (tok === '/') {
          // Word separator
          cursor += t.wordGap / 1000;
          continue;
        }
        if (tok === '') continue;

        for (let j = 0; j < tok.length; j++) {
          const sym = tok[j];
          if (sym !== '.' && sym !== '-') continue;
          const dur = (sym === '.' ? t.dit : t.dah) / 1000;

          // Envelope: attack → sustain → release
          gain.gain.setValueAtTime(0, cursor);
          gain.gain.linearRampToValueAtTime(volume, cursor + attack);
          gain.gain.setValueAtTime(volume, cursor + dur - release);
          gain.gain.linearRampToValueAtTime(0, cursor + dur);
          cursor += dur;

          // Intra-symbol gap (except after last symbol of token)
          if (j < tok.length - 1) cursor += t.intraChar / 1000;
        }

        // Letter gap (except after last token or before '/')
        const isLast = i === tokens.length - 1;
        const nextIsSlash = tokens[i + 1] === '/';
        if (!isLast && !nextIsSlash) cursor += t.letterGap / 1000;
        // Slash already adds word gap; no extra letter gap before it.
      }
    };

    schedule();

    const totalDuration = cursor - startTime;
    osc.start(startTime);
    osc.stop(startTime + totalDuration + 0.05);

    const handleEnd = () => {
      if (aborted) return;
      aborted = true;
      cleanups.forEach((fn) => fn());
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {}
      if (_activeAbort === abort) _activeAbort = null;
      if (onEnd) onEnd();
      resolve();
    };

    const abort = () => {
      if (aborted) return;
      try {
        osc.stop();
      } catch {}
      handleEnd();
    };
    _activeAbort = abort;

    osc.onended = handleEnd;
  });
}

/** Stop any in-flight playback. Safe to call when nothing is playing. */
export function stop() {
  if (_activeAbort) {
    _activeAbort();
    _activeAbort = null;
  }
}

/**
 * Play a single tone of arbitrary duration.
 *
 * Used by the straight-key page where the user dictates the dit/dah
 * length via hold time. The tone is generated using the same ADSR
 * envelope as playMorse (attack 5ms, release 10ms) so it blends
 * seamlessly with auto-played morse.
 *
 * @param {object} [opts]
 * @param {number} opts.durationMs - tone length in milliseconds
 * @param {number} [opts.frequency=600] - tone frequency in Hz
 * @param {number} [opts.volume=0.25] - peak gain (0-1)
 * @returns {OscillatorNode|null} the oscillator instance, so the caller
 *   can stop it early via stopTone() if the user releases the key before
 *   durationMs elapses. Returns null on invalid input (no audio context).
 */
export function playTone(opts = {}) {
  const { durationMs, frequency = 600, volume = 0.25 } = opts;
  if (!Number.isFinite(durationMs) || durationMs <= 0) return null;
  const ctx = getAudioContext();
  if (!ctx) return null;

  // Resume context if suspended (iOS Safari auto-suspends).
  if (ctx.state === 'suspended') ctx.resume();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  gain.gain.value = 0;
  osc.connect(gain);
  gain.connect(ctx.destination);

  const t0 = ctx.currentTime + 0.005; // tiny lead-in to avoid races
  const dur = durationMs / 1000;
  const attack = 0.005;
  const release = 0.01;
  // Guard against release eating the entire tone (very short dit)
  const sustainEnd = Math.max(t0 + attack + 0.001, t0 + dur - release);

  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + attack);
  gain.gain.setValueAtTime(volume, sustainEnd);
  gain.gain.linearRampToValueAtTime(0, t0 + dur);

  osc.start(t0);
  osc.stop(t0 + dur + 0.02);

  // Auto-cleanup when the oscillator naturally ends.
  osc.onended = () => {
    try { osc.disconnect(); gain.disconnect(); } catch {}
  };

  return osc;
}

/**
 * Force-stop a tone started by playTone(). Safe to call multiple times
 * and on null/undefined. Use this when the user releases the key
 * earlier than the requested duration.
 *
 * @param {OscillatorNode|null|undefined} osc
 */
export function stopTone(osc) {
  if (!osc) return;
  try {
    osc.stop();
  } catch {
    // Already stopped — ignore.
  }
}
