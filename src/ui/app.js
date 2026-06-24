/**
 * Main app controller: wires the forward / listen / translator / straight-key
 * pages to the DOM.
 *
 * Four directions (a.k.a. "pages"):
 *   forward:     see-morse → type-target  (uses modes/forward.js)
 *   listen:      hear-morse → type-target (uses modes/listen.js)
 *   translator:  live text ↔ morse bidir  (uses modes/translator.js)
 *   straightkey: hold Space to tap       (uses modes/straightkey.js)
 *
 * History model (forward/listen only):
 *   - history[] holds every question we've been on, in order
 *   - historyIndex points to the current position
 *   - 'next' judges+records the current question, generates a new one, appends
 *   - 'prev' just decrements historyIndex and renders the saved state
 *   - 'retry' re-judges the same item with the current input
 *   - Direction/mode change resets history (different topic)
 *
 * Translator and straightkey pages don't use history — they have their own
 * session objects attached in startSession().
 */

import { createForwardSession, generateQuestion, judgeAnswer } from '../modes/forward.js';
import { createListenSession, generateListenQuestion } from '../modes/listen.js';
import { attachTranslator } from '../modes/translator.js';
import { createStraightKeySession } from '../modes/straightkey.js';
import { playMorse, stop, playTone, stopTone } from '../core/audio.js';
import { loadProgress, saveProgress, recordAttempt, getSummary, resetProgress } from '../storage/progress.js';
import { t } from '../i18n/index.js';
import { MORSE } from '../core/morse-table.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const PRACTICE_DIRECTIONS = ['forward', 'listen'];

const els = {
  directionButtons: () => $$('.direction-btn'),
  modeButtons: () => $$('.mode-btn'),
  // Practice-page elements (forward + listen)
  promptMorse: () => $('#prompt-morse'),
  promptHint: () => $('#prompt-hint'),
  promptItem: () => $('#prompt-item'),
  toggleHintBtn: () => $('#btn-toggle-hint'),
  toggleHintLabel: () => $('#btn-toggle-hint .toggle-label'),
  toggleHintIcon: () => $('#btn-toggle-hint .toggle-icon'),
  inputField: () => $('#answer-input'),
  playBtn: () => $('#btn-play'),
  retryBtn: () => $('#btn-retry'),
  nextBtn: () => $('#btn-next'),
  prevBtn: () => $('#btn-prev'),
  feedback: () => $('#feedback'),
  promptArea: () => $('.prompt-area'),
  inputArea: () => $('.input-area'),
  actionBar: () => $('.action-bar'),
  secondaryBar: () => $('.secondary-bar'),
  // Translator page
  translatorText: () => $('#translator-text'),
  translatorMorse: () => $('#translator-morse'),
  translatorPlay: () => $('#translator-play'),
  translatorClear: () => $('#translator-clear'),
  // Straight-key page
  skModeButtons: () => $$('.sk-mode-btn'),
  skSubModeButtons: () => $$('.sk-submode-btn'),
  skPracticeControls: () => $('#sk-practice-controls'),
  skTarget: () => $('#sk-target'),
  skNextTarget: () => $('#sk-next-target'),
  skToggleTarget: () => $('#sk-toggle-target'),
  skToggleTargetLabel: () => $('#sk-toggle-target .toggle-label'),
  skToggleTargetIcon: () => $('#sk-toggle-target .toggle-icon'),
  skRecognized: () => $('#sk-recognized'),
  skCurrent: () => $('#sk-current'),
  skPossible: () => $('#sk-possible'),
  skProgress: () => $('#sk-progress'),
  skHoldBtn: () => $('#sk-hold-btn'),
  skBackspace: () => $('#sk-backspace'),
  skClear: () => $('#sk-clear'),
  skFeedback: () => $('#sk-feedback'),
  // Shared
  statTotal: () => $('#stat-total'),
  statAccuracy: () => $('#stat-accuracy'),
  statChars: () => $('#stat-chars'),
  referenceBtn: () => $('#btn-reference'),
  referenceModal: () => $('#reference-modal'),
  modalClose: () => $('#modal-close'),
  chartGrid: () => $('#chart-grid'),
  resetStatsBtn: () => $('#btn-reset-stats'),
  translatorPage: () => $('#translator-page'),
  straightkeyPage: () => $('#straightkey-page'),
};

let session = null;
let direction = 'forward';
let subMode = 'letter';
let history = [];
let historyIndex = -1;

/**
 * Per-direction preference: should we show the answer in the prompt area?
 *
 * - forward (see morse → type): default true (hint helps beginners)
 * - listen (hear morse → type): default false (cheating defeats the point)
 *
 * Persisted to localStorage under 'morse.v1.showAnswer.{direction}' so the
 * choice survives page reloads. Stored separately per direction so toggling
 * forward doesn't leak into listen.
 */
const SHOW_ANSWER_DEFAULTS = { forward: true, listen: false };
const SHOW_ANSWER_KEY_PREFIX = 'morse.v1.showAnswer.';

function loadShowAnswer(d) {
  try {
    const v = localStorage.getItem(SHOW_ANSWER_KEY_PREFIX + d);
    if (v === 'true') return true;
    if (v === 'false') return false;
  } catch {}
  return SHOW_ANSWER_DEFAULTS[d] ?? true;
}
function saveShowAnswer(d, v) {
  try { localStorage.setItem(SHOW_ANSWER_KEY_PREFIX + d, String(!!v)); } catch {}
}

function getShowAnswer() {
  // Reads from a small in-memory cache synced with the current direction
  return showAnswerCache[direction] ?? SHOW_ANSWER_DEFAULTS[direction] ?? true;
}
function setShowAnswer(v) {
  showAnswerCache[direction] = !!v;
  saveShowAnswer(direction, !!v);
  renderToggleHintButton();
  renderCurrent();
}

// In-memory cache, initialized on initApp() and updated when direction changes.
const showAnswerCache = { forward: null, listen: null };

/**
 * Per-direction preference: should we show the target on the straight-key
 * practice page? Default true (show), persisted under
 * 'morse.v1.showTarget.straightkey'. (forward/listen don't use this.)
 */
const SHOW_TARGET_DEFAULTS = { straightkey: true };
const SHOW_TARGET_KEY_PREFIX = 'morse.v1.showTarget.';

function loadShowTarget(d) {
  try {
    const v = localStorage.getItem(SHOW_TARGET_KEY_PREFIX + d);
    if (v === 'true') return true;
    if (v === 'false') return false;
  } catch {}
  return SHOW_TARGET_DEFAULTS[d] ?? true;
}
function saveShowTarget(d, v) {
  try { localStorage.setItem(SHOW_TARGET_KEY_PREFIX + d, String(!!v)); } catch {}
}
const showTargetCache = { straightkey: null };
function getShowTarget() {
  return showTargetCache.straightkey ?? SHOW_TARGET_DEFAULTS.straightkey ?? true;
}
function setShowTarget(v) {
  showTargetCache.straightkey = !!v;
  saveShowTarget('straightkey', !!v);
  renderStraightKeyTargetToggle();
  // Re-render the current page state (target visibility)
  if (direction === 'straightkey' && straightkeySession) {
    renderStraightKeyState(straightkeySession.getState());
  }
}

/** Initialize the app. */
export function initApp() {
  console.log('[initApp] start, subMode =', JSON.stringify(subMode), 'direction =', JSON.stringify(direction));
  // Surface any unhandled async errors to console so they don't appear
  // as scary "Uncaught (in promise)" red banners in DevTools.
  // These usually come from playMorse / playTone being aborted by a tab
  // switch mid-playback; the error is benign but the dev console noise
  // is confusing.
  window.addEventListener('unhandledrejection', (e) => {
    console.warn('[initApp] unhandled rejection (likely aborted audio):', e.reason);
    e.preventDefault();
  });
  // Load per-direction "show answer" preference from localStorage.
  showAnswerCache.forward = loadShowAnswer('forward');
  showAnswerCache.listen = loadShowAnswer('listen');
  showTargetCache.straightkey = loadShowTarget('straightkey');
  renderStats();
  bindDirectionButtons();
  bindModeButtons();
  bindActionButtons();
  bindInputField();
  bindKeyboardShortcuts();
  bindReferenceModal();
  bindResetStatsButton();
  bindToggleHintButton();
  try {
    startSession();
  } catch (err) {
    console.error('[initApp] startSession failed:', err);
    console.error('  subMode =', JSON.stringify(subMode));
    console.error('  direction =', JSON.stringify(direction));
    console.error('  history =', JSON.stringify(history));
    console.error('  session =', session);
    throw err;
  }
  renderToggleHintButton();
  document.addEventListener('i18n:applied', () => {
    if (session) renderPrompt(history[historyIndex]);
    renderToggleHintButton();
  });
}

/** Show only the section for the current direction; hide the others. */
function renderPageVisibility() {
  const isPractice = PRACTICE_DIRECTIONS.includes(direction);
  const isTranslator = direction === 'translator';
  const isStraightKey = direction === 'straightkey';

  // Practice sections (prompt + input + actions). Feedback is special:
  // it has its own .hidden toggle managed by renderResult / clearFeedback,
  // so we DON'T touch it here.
  if (els.promptArea()) els.promptArea().classList.toggle('hidden', !isPractice);
  if (els.inputArea()) els.inputArea().classList.toggle('hidden', !isPractice);
  if (els.actionBar()) els.actionBar().classList.toggle('hidden', !isPractice);
  // Translator + straight-key pages
  if (els.translatorPage()) els.translatorPage().classList.toggle('hidden', !isTranslator);
  if (els.straightkeyPage()) els.straightkeyPage().classList.toggle('hidden', !isStraightKey);

  // Mode bar only makes sense for practice pages
  const modeBar = document.querySelector('.mode-bar');
  if (modeBar) modeBar.classList.toggle('hidden', !isPractice);

  // Result panels + tips + secondary bar are always visible
}

/** Start a fresh session. Resets history. Used on boot and on direction/mode change. */
function startSession() {
  // Defensive: if any module-level state was lost (shouldn't happen, but
  // protects against weird caching/timing issues), restore sensible defaults.
  if (!['letter', 'word', 'sentence'].includes(subMode)) {
    console.warn('[startSession] subMode was invalid, resetting to letter:', subMode);
    subMode = 'letter';
  }
  if (!['forward', 'listen', 'translator', 'straightkey'].includes(direction)) {
    console.warn('[startSession] direction was invalid, resetting to forward:', direction);
    direction = 'forward';
  }
  // Defensive: clear stale feedback from previous question/session BEFORE
  // rendering the new one. This guarantees no leftover error message is
  // visible after a direction/mode change.
  try {
    clearFeedback();
  } catch (e) { /* no DOM yet */ }
  els.directionButtons().forEach((b) => {
    b.classList.toggle('active', b.dataset.direction === direction);
  });
  els.modeButtons().forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === subMode);
  });
  renderPageVisibility();

  // Branch by page type
  if (direction === 'translator') {
    startTranslatorPage();
    return;
  }
  if (direction === 'straightkey') {
    startStraightKeyPage();
    return;
  }

  // Practice page (forward / listen)
  session = null;
  history = [makeState(generateFresh())];
  historyIndex = 0;
  renderCurrent();
  els.promptMorse().classList.toggle('hidden', direction === 'listen');
  if (direction === 'listen') autoPlay();
  renderToggleHintButton();
}

function createFactory() {
  return direction === 'forward' ? createForwardSession : createListenSession;
}

function generateFresh() {
  return direction === 'forward'
    ? generateQuestion(subMode)
    : generateListenQuestion(subMode);
}

function makeState(q) {
  // `consumed` = true once this question has been counted into the stats.
  // - Enter/Retry: sets consumed=true after judging+recording
  // - Multiple Enters: only the first counts (others are no-ops)
  // - Click 重试: clears consumed so the user gets a fresh "one count"
  return { mode: subMode, item: q.item, morse: q.morse, input: '', result: null, consumed: false };
}

/** Render whatever history[historyIndex] is. */
function renderCurrent() {
  const state = history[historyIndex];
  if (!state) return;
  renderPrompt(state);
  renderInput(state.input || '');
  if (state.result) renderResult(state); else clearFeedback();
  updateNavButtons();
}

function nextQuestion() {
  // Judge the current question if it has input AND hasn't been counted yet.
  // Multiple Enters before clicking 重试 won't double-count.
  const current = history[historyIndex];
  if (current && !current.consumed) {
    submitCurrent({ silent: true });
  }
  // Generate a new question
  history.push(makeState(generateFresh()));
  historyIndex = history.length - 1;
  renderCurrent();
  if (direction === 'listen') autoPlay();
}

/**
 * Judge the current question and (if not yet consumed) record to localStorage.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.silent=false] - if true, don't re-render the feedback panel
 *   (used by nextQuestion to keep flow moving)
 * @returns {object|null} the updated state, or null if input was empty
 */
function submitCurrent({ silent = false } = {}) {
  const state = history[historyIndex];
  if (!state) return null;
  // Already counted: don't record again. Just re-render the existing result.
  if (state.consumed) {
    if (!silent) renderResult(state);
    return state;
  }
  const input = els.inputField().value;
  if (!input.trim()) {
    if (!silent) showEmptyHint();
    return null;
  }
  const result = judgeAnswer(state.item, input);
  const updated = { ...state, input, result, consumed: true };
  history[historyIndex] = updated;
  recordAndPersist(updated.item, updated.input, result.isCorrect);
  if (!silent) renderResult(updated);
  return updated;
}

/**
 * Re-judge the current question: clear the consumed flag, then submit again.
 * If input is empty, just clear the consumed flag (allow fresh try).
 */
function retryCurrent() {
  const state = history[historyIndex];
  if (!state) return;
  const input = els.inputField().value;
  // If no input, just clear consumed and feedback — let user try again
  if (!input.trim()) {
    history[historyIndex] = { ...state, consumed: false, result: null, input: '' };
    clearFeedback();
    return;
  }
  // Re-judge with the same item; consumed is reset so it counts again
  const result = judgeAnswer(state.item, input);
  const updated = { ...state, input, result, consumed: true };
  history[historyIndex] = updated;
  renderResult(updated);
  recordAndPersist(updated.item, updated.input, result.isCorrect);
}

/** Show a hint when the user tries to submit empty input. */
function showEmptyHint() {
  const fb = els.feedback();
  fb.classList.remove('hidden', 'correct', 'wrong', 'partial');
  fb.classList.add('empty');
  fb.textContent = t('feedback.empty') || '请先输入答案';
}

function bindDirectionButtons() {
  els.directionButtons().forEach((btn) => {
    btn.addEventListener('click', () => {
      const d = btn.dataset.direction;
      if (direction === d) return;
      // Defensive: hide stale feedback before re-rendering
      clearFeedback();
      stop();
      direction = d;
      startSession();
    });
  });
}

function bindModeButtons() {
  els.modeButtons().forEach((btn) => {
    btn.addEventListener('click', () => {
      const m = btn.dataset.mode;
      if (subMode === m) return;
      clearFeedback();
      stop();
      subMode = m;
      startSession();
    });
  });
}

function bindActionButtons() {
  els.playBtn().addEventListener('click', async () => {
    const state = history[historyIndex];
    if (!state?.morse) return;
    stop();
    await playMorse(state.morse, { wpm: 15, frequency: 600, volume: 0.25 });
  });

  els.retryBtn().addEventListener('click', () => {
    retryCurrent();
    updateNavButtons();
  });

  els.nextBtn().addEventListener('click', () => {
    nextQuestion();
  });

  els.prevBtn().addEventListener('click', () => {
    if (historyIndex <= 0) return;
    historyIndex--;
    renderCurrent();
  });
}

function bindInputField() {
  const input = els.inputField();
  input.addEventListener('input', () => {
    // No-op: history is the source of truth, we read input.value at submit time.
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      submitCurrent();
      updateNavButtons();
    }
  });
}

function bindKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Don't hijack keys when the user is typing into a form field
    // (input, textarea, contenteditable). Otherwise typing a space
    // in the translator textarea would silently switch to play.
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
    // Straight-key page owns Space (and other modifier interactions).
    if (direction === 'straightkey') return;
    if (e.key === ' ') {
      e.preventDefault();
      els.playBtn().click();
    } else if (e.key === 'r' || e.key === 'R') {
      els.retryBtn().click();
    } else if (e.key === 'n' || e.key === 'N') {
      els.nextBtn().click();
    } else if (e.key === 'p' || e.key === 'P') {
      els.prevBtn().click();
    } else if (e.key === '?') {
      els.referenceBtn()?.click();
    }
    // Note: number keys 1/2/3/4 used to switch tabs, but they conflict
    // with typing digits in the translator. Removed — users should click
    // the tab directly. Direction buttons are large and obvious.
  });
}

// ─── Translator page ───

let translatorHandle = null;

function startTranslatorPage() {
  // Lazy-init: only attach listeners once per app session
  if (!translatorHandle) {
    const text = els.translatorText();
    const morse = els.translatorMorse();
    const play = els.translatorPlay();
    const clear = els.translatorClear();
    if (text && morse) {
      translatorHandle = attachTranslator({ textArea: text, morseArea: morse, playBtn: play });
    }
    if (clear && text && morse) {
      clear.addEventListener('click', () => {
        text.value = '';
        morse.value = '';
      });
    }
  }
  // Stop any stray audio
  stop();
  // Reset practice-page elements that may have leftover state
  history = [];
  historyIndex = -1;
  // Clear feedback so practice-page error messages don't leak
  try { clearFeedback(); } catch {}
}

// ─── Straight-key page ───

let straightkeySession = null;

function startStraightKeyPage() {
  stop();
  // Reset practice-page elements
  history = [];
  historyIndex = -1;
  try { clearFeedback(); } catch {}

  if (!straightkeySession) {
    straightkeySession = createStraightKeySession({
      wpm: 15,
      onChange: renderStraightKeyState,
      onResult: renderStraightKeyResult,
    });
  } else {
    // Reset on every (re-)entry
    straightkeySession.reset();
  }

  // Bind buttons (idempotent)
  bindStraightKeyControls();
  bindStraightKeyHoldButton();
}

function renderStraightKeyState(state) {
  // Recognized: built from finalized letters and (optional) current char marker
  const recEl = els.skRecognized();
  if (recEl) {
    const finals = state.letters.join('');
    if (finals) {
      // Render finalized letters as inline blocks; show current as bracketed
      const finalizedHtml = finals
        .split('')
        .map((c) => c === ' '
          ? '<span class="sk-letter">␣</span>'
          : `<span class="sk-letter">${escapeHtml(c)}</span>`)
        .join('');
      const currentHtml = state.currentChar
        ? `<span class="sk-letter pending">${escapeHtml(state.currentChar)}</span>`
        : '';
      recEl.innerHTML = finalizedHtml + currentHtml;
    } else if (state.currentChar) {
      recEl.innerHTML = `<span class="sk-letter pending">${escapeHtml(state.currentChar)}</span>`;
    } else {
      recEl.innerHTML = '<span class="placeholder">—</span>';
    }
  }
  // Current morse code (visible symbols)
  const curEl = els.skCurrent();
  if (curEl) {
    curEl.textContent = state.currentCode || '';
    curEl.style.opacity = state.currentCode ? '1' : '0.3';
  }
  // Possible chars
  const posEl = els.skPossible();
  if (posEl) {
    posEl.textContent = state.possible.length > 0
      ? state.possible.slice(0, 12).join(' ') + (state.possible.length > 12 ? ' …' : '')
      : '';
    posEl.style.opacity = state.possible.length > 0 ? '1' : '0.3';
  }
  // Practice-mode target display (respects the show-target toggle)
  const tgtEl = els.skTarget();
  if (tgtEl) {
    if (state.mode === 'practice') {
      const show = getShowTarget();
      tgtEl.textContent = show ? (state.target || '') : (t('prompt.maskItem') || '? ? ?');
      tgtEl.classList.toggle('hidden-by-toggle', !show);
    } else {
      tgtEl.textContent = '';
      tgtEl.classList.remove('hidden-by-toggle');
    }
  }
  // Show/hide practice controls
  const practiceControls = els.skPracticeControls();
  if (practiceControls) {
    practiceControls.classList.toggle('hidden', state.mode !== 'practice');
  }
  // Mode button active state
  els.skModeButtons().forEach((b) => {
    b.classList.toggle('active', b.dataset.skMode === state.mode);
  });
  // SubMode button active state
  els.skSubModeButtons().forEach((b) => {
    b.classList.toggle('active', b.dataset.skSubmode === state.subMode);
  });
  // Update the toggle button label
  renderStraightKeyTargetToggle();
}

/** Update the show/hide-target button label/icon based on current showTarget state. */
function renderStraightKeyTargetToggle() {
  const btn = els.skToggleTarget();
  if (!btn) return;
  const show = getShowTarget();
  const label = show ? t('straightkey.hideTarget') : t('straightkey.showTarget');
  const labelEl = els.skToggleTargetLabel();
  if (labelEl) labelEl.textContent = label;
  const iconEl = els.skToggleTargetIcon();
  if (iconEl) iconEl.textContent = show ? '🙈' : '👁️';
  btn.classList.toggle('active', show);
  btn.setAttribute('aria-pressed', show ? 'true' : 'false');
}

function renderStraightKeyResult(result) {
  const fb = els.skFeedback();
  if (!fb) return;
  fb.classList.remove('hidden', 'correct', 'wrong', 'partial');
  if (result.isCorrect) {
    fb.classList.add('correct');
    fb.textContent = t('straightkey.feedback.correct') + ` (${result.item})`;
  } else {
    fb.classList.add('wrong');
    fb.textContent = t('straightkey.feedback.wrong') +
      ` — 期望: ${result.item} · 你: ${result.input}`;
  }
}

let _skControlListenersBound = false;
function bindStraightKeyControls() {
  if (_skControlListenersBound) return;
  _skControlListenersBound = true;

  els.skModeButtons().forEach((btn) => {
    btn.addEventListener('click', () => {
      straightkeySession?.setMode(btn.dataset.skMode);
    });
  });
  els.skSubModeButtons().forEach((btn) => {
    btn.addEventListener('click', () => {
      straightkeySession?.setSubMode(btn.dataset.skSubmode);
    });
  });
  els.skNextTarget()?.addEventListener('click', () => {
    straightkeySession?.nextTarget();
    // Clear any previous feedback
    const fb = els.skFeedback();
    if (fb) { fb.classList.add('hidden'); fb.textContent = ''; }
  });
  els.skToggleTarget()?.addEventListener('click', () => {
    setShowTarget(!getShowTarget());
  });
  els.skBackspace()?.addEventListener('click', () => {
    straightkeySession?.backspace();
  });
  els.skClear()?.addEventListener('click', () => {
    straightkeySession?.reset();
    const fb = els.skFeedback();
    if (fb) { fb.classList.add('hidden'); fb.textContent = ''; }
  });
}

let _skHoldListenerBound = false;
function bindStraightKeyHoldButton() {
  if (_skHoldListenerBound) return;
  _skHoldListenerBound = true;
  const btn = els.skHoldBtn();
  if (!btn) return;
  // Use pointer events so this works for mouse + touch + pen
  const onDown = (e) => {
    e.preventDefault();
    straightkeySession?.onKeyDown();
    btn.classList.add('active');
  };
  const onUp = (e) => {
    e.preventDefault();
    straightkeySession?.onKeyUp();
    btn.classList.remove('active');
  };
  btn.addEventListener('pointerdown', onDown);
  btn.addEventListener('pointerup', onUp);
  btn.addEventListener('pointerleave', onUp);
  btn.addEventListener('pointercancel', onUp);

  // Also bind global Space when on the straight-key page. We do this
  // add/remove cycle inside bindKeyboardShortcuts; here we just add
  // additional document-level listeners scoped to the active page.
  document.addEventListener('keydown', (e) => {
    if (direction !== 'straightkey') return;
    if (e.repeat) return;
    if (e.code !== 'Space' && e.key !== ' ') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    straightkeySession?.onKeyDown();
  });
  document.addEventListener('keyup', (e) => {
    if (direction !== 'straightkey') return;
    if (e.code !== 'Space' && e.key !== ' ') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    straightkeySession?.onKeyUp();
  });
}

async function autoPlay() {
  stop();
  await new Promise((r) => setTimeout(r, 200));
  const state = history[historyIndex];
  if (state?.morse) {
    await playMorse(state.morse, { wpm: 15, frequency: 600, volume: 0.25 });
  }
}

/** Render a morse string as pretty HTML: · for dot, − for dah, gap between letters. */
function renderMorseHTML(morse) {
  if (!morse) return '';
  return morse
    .split(' ')
    .map((token) => {
      if (token === '/') return '<span class="word-gap">⫶</span>';
      if (token === '') return '';
      const pretty = token
        .replace(/\./g, '<span class="dit">·</span>')
        .replace(/-/g, '<span class="dah">−</span>');
      return `<span class="letter">${pretty}</span>`;
    })
    .join('<span class="letter-gap">·</span>');
}

function renderPrompt(state) {
  const show = getShowAnswer();
  if (direction === 'forward') {
    els.promptMorse().innerHTML = renderMorseHTML(state.morse ?? '');
    els.promptMorse().classList.remove('hidden');
    // Forward hint: show item + meta. Item masked when showAnswer=false.
    const itemText = show ? (state.item ?? '') : (t('prompt.maskItem') || '? ? ?');
    els.promptHint().innerHTML =
      `<span>${escapeHtml(t('prompt.target'))}</span>` +
      ` <span class="prompt-item${show ? '' : ' hidden-by-toggle'}">${escapeHtml(itemText)}</span>` +
      ` <span class="hint-text hint-dim">${escapeHtml(t('prompt.hint'))}</span>`;
    els.promptHint().classList.remove('hidden-by-toggle');
  } else {
    els.promptMorse().classList.add('hidden');
    // Listen hint: just a play hint, optionally showing the item.
    if (show) {
      const itemText = state.item ?? '';
      els.promptHint().innerHTML =
        `<span class="hint-text">${escapeHtml(t('prompt.listenHint') || '🔊 点击播放后，输入你听到的内容')}</span>` +
        `<span style="margin-left:8px">${escapeHtml(t('prompt.target'))}</span>` +
        `<span class="prompt-item" style="margin-left:6px">${escapeHtml(itemText)}</span>`;
      els.promptHint().classList.remove('hidden-by-toggle');
    } else {
      els.promptHint().innerHTML =
        `<span class="hint-text">${escapeHtml(t('prompt.listenHint') || '🔊 点击播放后，输入你听到的内容')}</span>`;
      els.promptHint().classList.remove('hidden-by-toggle');
    }
  }
}

/** Update the toggle button label/icon/active state based on current direction + showAnswer. */
function renderToggleHintButton() {
  const btn = els.toggleHintBtn();
  if (!btn) return;
  const show = getShowAnswer();
  // Label reflects the ACTION the button will perform, not the current state.
  // "显示答案" means "click to reveal" (current state: hidden)
  // "隐藏答案" means "click to hide" (current state: shown)
  const label = show ? t('prompt.hideAnswer') : t('prompt.showAnswer');
  const labelEl = els.toggleHintLabel();
  if (labelEl) labelEl.textContent = label;
  const iconEl = els.toggleHintIcon();
  if (iconEl) iconEl.textContent = show ? '🙈' : '👁️';
  btn.classList.toggle('active', show);
  btn.setAttribute('aria-pressed', show ? 'true' : 'false');
}

function renderInput(value) {
  const input = els.inputField();
  if (input.value !== value) input.value = value;
}

function renderResult(state) {
  const { result } = state;
  if (!result) return;
  const fb = els.feedback();
  fb.classList.remove('hidden', 'correct', 'wrong', 'partial');
  const status = result.isCorrect
    ? 'correct'
    : result.charResults.every((c) => !c)
    ? 'wrong'
    : 'partial';
  fb.classList.add(status);
  fb.innerHTML = '';

  if (status === 'correct') {
    fb.textContent = t('feedback.correct');
  } else if (status === 'wrong') {
    const morseReveal = direction === 'listen'
      ? `<div class="morse-reveal-label">${escapeHtml(t('feedback.expected'))}</div><div class="morse-reveal">${renderMorseHTML(state.morse ?? '')}</div>`
      : '';
    fb.innerHTML = `<div>${escapeHtml(t('feedback.wrong'))}</div><div class="expected">${escapeHtml(t('feedback.expected'))}<code>${escapeHtml(state.item)}</code></div><div class="actual">${escapeHtml(t('feedback.youTyped'))}<code>${escapeHtml(result.actual)}</code></div>${morseReveal}`;
  } else {
    const morseReveal = direction === 'listen'
      ? `<div class="morse-reveal-label">${escapeHtml(t('feedback.expected'))}</div><div class="morse-reveal">${renderMorseHTML(state.morse ?? '')}</div>`
      : '';
    fb.innerHTML = `<div>${escapeHtml(t('feedback.partial'))}</div><div class="char-diff"></div>${morseReveal}`;
    const diff = fb.querySelector('.char-diff');
    result.charResults.forEach((ok, i) => {
      const span = document.createElement('span');
      span.className = 'char ' + (ok ? 'ok' : 'bad');
      span.textContent = result.expected[i] || '·';
      diff.appendChild(span);
    });
  }
}

function clearFeedback() {
  const fb = els.feedback();
  fb.classList.add('hidden');
  fb.classList.remove('empty');
  fb.textContent = '';
}

function updateNavButtons() {
  if (els.prevBtn()) {
    els.prevBtn().disabled = historyIndex <= 0;
    els.prevBtn().style.opacity = historyIndex <= 0 ? '0.4' : '1';
  }
  if (els.nextBtn()) {
    const label = `${t('action.next')} (${historyIndex + 1}/${history.length})`;
    els.nextBtn().textContent = label;
  }
}

function recordAndPersist(item, input, isCorrect) {
  const state = loadProgress();
  const updated = recordAttempt(state, `${direction}.${subMode}`, item, input, isCorrect);
  saveProgress(updated);
  renderStats();
}

function renderStats() {
  const state = loadProgress();
  const sum = getSummary(state);
  if (els.statTotal()) els.statTotal().textContent = sum.totalAttempts;
  if (els.statAccuracy()) els.statAccuracy().textContent = sum.totalAttempts > 0 ? `${Math.round(sum.accuracy * 100)}%` : '—';
  if (els.statChars()) els.statChars().textContent = sum.uniqueChars;
}

// ─── Reset stats button ───

/** Bind the "clear stats" button in the stats panel.
 *  Clears localStorage progress (总答题数/正确率/字符统计/history),
 *  but leaves the current practice session (in-memory history) intact. */
function bindResetStatsButton() {
  if (!els.resetStatsBtn()) return;
  els.resetStatsBtn().addEventListener('click', () => {
    const ok = window.confirm(
      t('stats.confirmReset') || '确定要清空所有累计统计吗？此操作不可撤销。'
    );
    if (!ok) return;
    resetProgress();
    renderStats();
  });
}

// ─── Toggle answer hint button ───

/** Bind the toggle button that controls whether the answer is revealed.
 *  In forward mode (see morse → type), defaults to showing the answer;
 *  in listen mode (hear morse → type), defaults to hiding it. Both
 *  preferences are persisted per-direction in localStorage. */
function bindToggleHintButton() {
  const btn = els.toggleHintBtn();
  if (!btn) return;
  btn.addEventListener('click', () => {
    setShowAnswer(!getShowAnswer());
  });
}

// ─── Reference modal ───

function bindReferenceModal() {
  if (!els.referenceBtn()) return;
  els.referenceBtn().addEventListener('click', openReferenceModal);
  if (els.modalClose()) els.modalClose().addEventListener('click', closeReferenceModal);
  if (els.referenceModal()) {
    els.referenceModal().addEventListener('click', (e) => {
      if (e.target === els.referenceModal()) closeReferenceModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.referenceModal()?.classList.contains('open')) {
      closeReferenceModal();
    }
  });
}

function openReferenceModal() {
  buildChartGrid();
  els.referenceModal().classList.add('open');
  els.referenceModal().setAttribute('aria-hidden', 'false');
}

function closeReferenceModal() {
  els.referenceModal()?.classList.remove('open');
  els.referenceModal()?.setAttribute('aria-hidden', 'true');
}

function buildChartGrid() {
  const grid = els.chartGrid();
  if (!grid) return;
  grid.innerHTML = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
  for (const ch of chars) {
    const code = MORSE[ch] || '';
    const card = document.createElement('button');
    card.className = 'chart-card';
    card.type = 'button';
    card.title = `点击播放 ${ch}`;
    card.innerHTML = `
      <div class="chart-char">${ch}</div>
      <div class="chart-code">${code.replace(/\./g, '·').replace(/-/g, '−')}</div>
    `;
    card.addEventListener('click', async () => {
      card.classList.add('playing');
      stop();
      await playMorse(code, { wpm: 12, frequency: 600, volume: 0.25 });
      card.classList.remove('playing');
    });
    grid.appendChild(card);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
