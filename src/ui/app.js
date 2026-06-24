/**
 * Main app controller: wires the forward / listen sessions to the DOM.
 *
 * Two directions, three sub-modes each:
 *   forward:  see-morse → type-target  (uses modes/forward.js)
 *   listen:   hear-morse → type-target  (uses modes/listen.js)
 *
 * Architecture:
 *   - The session factory and helpers are imported per direction.
 *   - The same DOM elements (morse display, input, action buttons) are
 *     reused — only the prompts and the play button behavior differ.
 *   - 'direction' state lives at the top; switching direction tears down
 *     the current session and creates a new one with the same sub-mode.
 */

import { createForwardSession } from '../modes/forward.js';
import { createListenSession } from '../modes/listen.js';
import { playMorse, stop } from '../core/audio.js';
import { loadProgress, saveProgress, recordAttempt, getSummary } from '../storage/progress.js';
import { t } from '../i18n/index.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const els = {
  directionButtons: () => $$('.direction-btn'),
  modeButtons: () => $$('.mode-btn'),
  promptMorse: () => $('#prompt-morse'),
  promptItem: () => $('#prompt-item'),
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
};

let session = null;
let direction = 'forward'; // 'forward' | 'listen'
let subMode = 'letter'; // 'letter' | 'word' | 'sentence'
let history = [];
let historyIndex = -1;
let morseVisible = true; // For forward: whether morse code is shown

/** Initialize the app. */
export function initApp() {
  renderStats();
  bindDirectionButtons();
  bindModeButtons();
  bindActionButtons();
  bindInputField();
  bindKeyboardShortcuts();
  startSession();
  document.addEventListener('i18n:applied', () => {
    // Re-render prompt hint label and feedback
    renderPrompt(session.getState());
  });
}

function startSession() {
  els.directionButtons().forEach((b) => {
    b.classList.toggle('active', b.dataset.direction === direction);
  });
  els.modeButtons().forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === subMode);
  });
  const factory = direction === 'forward' ? createForwardSession : createListenSession;
  session = factory({
    mode: subMode,
    onItemChange: (state) => {
      renderPrompt(state);
      renderInput(state.input);
      clearFeedback();
      // In listen mode, auto-play the new question.
      if (direction === 'listen') autoPlay();
    },
    onResult: (state) => {
      renderResult(state);
      pushHistory(state);
    },
    onPlayEnd: () => {
      // Could update UI to "audio done" — for v1 just leave as-is
    },
  });
  // Show/hide morse display depending on direction
  els.promptMorse().classList.toggle('hidden', direction === 'listen');
  history = [session.getState()];
  historyIndex = 0;
  // Refresh play button label
  updateActionLabels();
}

function bindDirectionButtons() {
  els.directionButtons().forEach((btn) => {
    btn.addEventListener('click', () => {
      const d = btn.dataset.direction;
      if (direction === d) return;
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
      subMode = m;
      startSession();
    });
  });
}

function bindActionButtons() {
  els.playBtn().addEventListener('click', async () => {
    if (!session) return;
    const state = session.getState();
    if (!state.morse) return;
    stop();
    await playMorse(state.morse, { wpm: 15, frequency: 600, volume: 0.25 });
  });

  els.retryBtn().addEventListener('click', () => {
    if (!session) return;
    session.setInput(els.inputField().value);
    const result = session.submit();
    if (result) recordAndPersist(session.getState().item, session.getState().input, result.isCorrect);
  });

  els.nextBtn().addEventListener('click', () => {
    if (!session) return;
    session.setInput(els.inputField().value);
    const result = session.submit();
    if (result) recordAndPersist(session.getState().item, session.getState().input, result.isCorrect);
    // Generate a new question with same direction + subMode
    startSession();
  });

  els.prevBtn().addEventListener('click', () => {
    if (historyIndex <= 0) return;
    historyIndex--;
    const state = history[historyIndex];
    renderPrompt(state);
    renderInput(state.input);
    if (state.result) renderResult(state); else clearFeedback();
  });
}

function bindInputField() {
  const input = els.inputField();
  input.addEventListener('input', () => {
    if (session) session.setInput(input.value);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (session) {
        session.setInput(input.value);
        const result = session.submit();
        if (result) recordAndPersist(session.getState().item, session.getState().input, result.isCorrect);
      }
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
    }
  });
}

async function autoPlay() {
  if (!session) return;
  stop();
  await new Promise((r) => setTimeout(r, 200)); // small gap between questions
  const state = session.getState();
  if (state.morse) {
    await playMorse(state.morse, { wpm: 15, frequency: 600, volume: 0.25 });
  }
}

function renderPrompt(state) {
  if (direction === 'forward') {
    els.promptMorse().textContent = state.morse ?? '';
    els.promptMorse().classList.remove('hidden');
    els.promptItem().textContent = state.item ?? '';
    els.promptHint().innerHTML = `<span>${escapeHtml(t('prompt.target'))}</span> <span class="prompt-item" id="prompt-item">${escapeHtml(state.item ?? '')}</span> <span class="hint-text hint-dim">${escapeHtml(t('prompt.hint'))}</span>`;
  } else {
    // listen: don't show morse; show "Press play to listen" hint
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
    // In listen mode, also reveal the answer in morse for learning
    const morseReveal = direction === 'listen'
      ? `<div class="morse-reveal">${escapeHtml(state.morse ?? '')}</div>`
      : '';
    fb.innerHTML = `<div>${escapeHtml(t('feedback.wrong'))}</div><div class="expected">${escapeHtml(t('feedback.expected'))}<code>${escapeHtml(state.item)}</code></div><div class="actual">${escapeHtml(t('feedback.youTyped'))}<code>${escapeHtml(result.actual)}</code></div>${morseReveal}`;
  } else {
    const morseReveal = direction === 'listen'
      ? `<div class="morse-reveal">${escapeHtml(state.morse ?? '')}</div>`
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

function pushHistory(state) {
  if (history.length && history[history.length - 1].item === state.item) {
    history[history.length - 1] = state;
    return;
  }
  history.push(state);
  historyIndex = history.length - 1;
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

function updateActionLabels() {
  // Just re-render via applyTranslations is overkill; tags static.
  // We re-render the play button label per direction.
  const playLabel = direction === 'listen' ? '🔊 播放' : '🔊 播放';
  els.playBtn().textContent = playLabel;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
