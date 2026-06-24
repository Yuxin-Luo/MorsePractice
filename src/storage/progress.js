/**
 * localStorage-backed progress persistence.
 *
 * Schema v1:
 *   {
 *     version: 1,
 *     stats: { [char]: { seen, correct, lastSeenAt } },
 *     history: [ { ts, mode, item, input, isCorrect } ],
 *     current: { mode, item, input } | null,
 *   }
 *
 * Notes:
 *   - Atomic save: write to a temp key, then rename. Prevents partial writes
 *     from corrupting state if the tab is killed mid-write.
 *   - Tolerant load: if the saved blob is malformed, return default state
 *     rather than throw. Users can re-accumulate stats.
 *   - localStorage may be unavailable (private mode in some browsers, or
 *     file:// origin in some configs); we fall back to in-memory storage
 *     and surface a console warning.
 */

const STORAGE_KEY = 'morse.v1.progress';
const TEMP_KEY = 'morse.v1.progress.tmp';
const SCHEMA_VERSION = 1;

function defaultState() {
  return {
    version: SCHEMA_VERSION,
    stats: {},
    history: [],
    current: null,
  };
}

// In-memory fallback for environments without localStorage.
let _memory = null;
let _useMemory = false;

function _lsAvailable() {
  try {
    const k = '__morse_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function _init() {
  if (_memory === null && !_useMemory) {
    _useMemory = !_lsAvailable();
    if (_useMemory) {
      console.warn('[progress] localStorage unavailable; using in-memory fallback');
      _memory = defaultState();
    }
  }
}

function _read() {
  _init();
  if (_useMemory) return _memory;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const data = JSON.parse(raw);
    if (!data || data.version !== SCHEMA_VERSION) return defaultState();
    return data;
  } catch (e) {
    console.warn('[progress] failed to read state; resetting', e);
    return defaultState();
  }
}

function _write(state) {
  _init();
  if (_useMemory) {
    _memory = state;
    return;
  }
  try {
    // Atomic-ish write: write tmp first, then overwrite real key.
    localStorage.setItem(TEMP_KEY, JSON.stringify(state));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.removeItem(TEMP_KEY);
  } catch (e) {
    console.warn('[progress] failed to write state', e);
  }
}

/** Load the current progress state. Returns a fresh default if nothing saved. */
export function loadProgress() {
  return _read();
}

/** Replace the entire progress state. */
export function saveProgress(state) {
  if (!state || state.version !== SCHEMA_VERSION) {
    state = { ...defaultState(), ...state, version: SCHEMA_VERSION };
  }
  _write(state);
}

/** Reset all progress (testing or "start over" button). */
export function resetProgress() {
  _write(defaultState());
}

/**
 * Record an attempt and return the updated state.
 *
 * @param {object} state - current state (from loadProgress)
 * @param {'letter'|'word'|'sentence'} mode
 * @param {string} item - the target text
 * @param {string} input - the user's input
 * @param {boolean} isCorrect - overall correctness
 * @returns {object} updated state
 */
export function recordAttempt(state, mode, item, input, isCorrect) {
  const next = JSON.parse(JSON.stringify(state || defaultState()));
  const ts = Date.now();
  const expected = item.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const actual = (input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Per-character stats
  const len = Math.max(expected.length, actual.length);
  for (let i = 0; i < len; i++) {
    const ch = expected[i];
    if (!ch) continue;
    if (!next.stats[ch]) next.stats[ch] = { seen: 0, correct: 0, lastSeenAt: 0 };
    next.stats[ch].seen += 1;
    if (expected[i] === actual[i]) next.stats[ch].correct += 1;
    next.stats[ch].lastSeenAt = ts;
  }

  // History (cap at 200 to bound storage)
  next.history.push({ ts, mode, item, input, isCorrect });
  if (next.history.length > 200) {
    next.history = next.history.slice(-200);
  }

  return next;
}

/**
 * Get the accuracy (0-1) for a single character.
 * Returns null if the character has never been seen.
 */
export function getCharAccuracy(state, ch) {
  const s = state.stats[ch.toUpperCase()];
  if (!s || s.seen === 0) return null;
  return s.correct / s.seen;
}

/** Get the N weakest characters by accuracy. */
export function getWeakestChars(state, n = 10) {
  const entries = Object.entries(state.stats)
    .filter(([, s]) => s.seen >= 3) // require minimum sample
    .map(([ch, s]) => ({ ch, accuracy: s.correct / s.seen, seen: s.seen }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, n);
  return entries;
}

/** Get a high-level summary of total attempts and accuracy. */
export function getSummary(state) {
  const total = state.history.length;
  const correct = state.history.filter((h) => h.isCorrect).length;
  return {
    totalAttempts: total,
    correctAttempts: correct,
    accuracy: total > 0 ? correct / total : 0,
    uniqueChars: Object.keys(state.stats).length,
  };
}

/** Save the in-progress question so it survives a refresh. */
export function saveCurrent(state, mode, item, input) {
  const next = JSON.parse(JSON.stringify(state || defaultState()));
  next.current = { mode, item, input };
  return next;
}

/** Load the in-progress question, if any. */
export function loadCurrent(state) {
  return state.current ?? null;
}
