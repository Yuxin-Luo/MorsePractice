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
