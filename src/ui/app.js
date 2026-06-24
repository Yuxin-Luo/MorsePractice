/**
 * Main app controller: wires the forward / listen sessions to the DOM.
 *
 * Two directions, three sub-modes each:
 *   forward:  see-morse → type-target  (uses modes/forward.js)
 *   listen:   hear-morse → type-target  (uses modes/listen.js)
 *
 * History model:
 *   - history[] holds every question we've been on, in order
 *   - historyIndex points to the current position
 *   - 'next' judges+records the current question, generates a new one, appends
 *   - 'prev' just decrements historyIndex and renders the saved state
 *   - 'retry' re-judges the same item with the current input
 *   - Direction/mode change resets history (different topic)
 */

import { createForwardSession, generateQuestion, judgeAnswer } from '../modes/forward.js';
import { createListenSession, generateListenQuestion } from '../modes/listen.js';
import { playMorse, stop } from '../core/audio.js';
import { loadProgress, saveProgress, recordAttempt, getSummary, resetProgress } from '../storage/progress.js';
import { t } from '../i18n/index.js';
import { MORSE } from '../core/morse-table.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const els = {
  directionButtons: () => $$('.direction-btn'),
  modeButtons: () => $$('.mode-btn'),
  promptMorse: () => $('#prompt-morse'),
  promptHint: () => $('#prompt-hint'),
  inputField: () => $('#answer-input'),
  playBtn: () => $('#btn-play'),
  retryBtn: () => $('#btn-retry'),
  nextBtn: () => $('#btn-next'),
  prevBtn: () => $('#btn-prev'),
  feedback: () => $('#feedback'),
  statTotal: () => $('#stat-total'),
  statAccuracy: () => $('#stat-accuracy'),
  statChars: () => $('#stat-chars'),
  referenceBtn: () => $('#btn-reference'),
  referenceModal: () => $('#reference-modal'),
  modalClose: () => $('#modal-close'),
  chartGrid: () => $('#chart-grid'),
  resetStatsBtn: () => $('#btn-reset-stats'),
};

let session = null;
let direction = 'forward';
let subMode = 'letter';
let history = [];
let historyIndex = -1;

/** Initialize the app. */
export function initApp() {
  console.log('[initApp] start, subMode =', JSON.stringify(subMode), 'direction =', JSON.stringify(direction));
  renderStats();
  bindDirectionButtons();
  bindModeButtons();
  bindActionButtons();
  bindInputField();
  bindKeyboardShortcuts();
  bindReferenceModal();
  bindResetStatsButton();
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
  document.addEventListener('i18n:applied', () => {
    if (session) renderPrompt(history[historyIndex]);
  });
}

/** Start a fresh session. Resets history. Used on boot and on direction/mode change. */
function startSession() {
  // Defensive: if any module-level state was lost (shouldn't happen, but
  // protects against weird caching/timing issues), restore sensible defaults.
  if (!['letter', 'word', 'sentence'].includes(subMode)) {
    console.warn('[startSession] subMode was invalid, resetting to letter:', subMode);
    subMode = 'letter';
  }
  if (!['forward', 'listen'].includes(direction)) {
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
  // We don't need a session object — history is the source of truth. The
  // session was previously used for judging, but its `current` field got
  // stale after the first nextQuestion() call (it was only initialized
  // once in startSession). Now we use judgeAnswer() directly with the
  // history's item, which is always up-to-date.
  session = null;
  history = [makeState(generateFresh())];
  historyIndex = 0;
  renderCurrent();
  els.promptMorse().classList.toggle('hidden', direction === 'listen');
  if (direction === 'listen') autoPlay();
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
    if (e.target.tagName === 'INPUT') return;
    if (e.key === ' ') {
      e.preventDefault();
      els.playBtn().click();
    } else if (e.key === 'r' || e.key === 'R') {
      els.retryBtn().click();
    } else if (e.key === 'n' || e.key === 'N') {
      els.nextBtn().click();
    } else if (e.key === 'p' || e.key === 'P') {
      els.prevBtn().click();
    } else if (e.key === '1') {
      document.querySelector('.direction-btn[data-direction="forward"]').click();
    } else if (e.key === '2') {
      document.querySelector('.direction-btn[data-direction="listen"]').click();
    } else if (e.key === '?') {
      els.referenceBtn()?.click();
    }
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
  if (direction === 'forward') {
    els.promptMorse().innerHTML = renderMorseHTML(state.morse ?? '');
    els.promptMorse().classList.remove('hidden');
    els.promptHint().innerHTML = `<span>${escapeHtml(t('prompt.target'))}</span> <span class="prompt-item">${escapeHtml(state.item ?? '')}</span> <span class="hint-text hint-dim">${escapeHtml(t('prompt.hint'))}</span>`;
  } else {
    els.promptMorse().classList.add('hidden');
    els.promptHint().innerHTML = `<span class="hint-text">${escapeHtml(t('prompt.listenHint') || '🔊 点击播放后，输入你听到的内容')}</span>`;
  }
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
