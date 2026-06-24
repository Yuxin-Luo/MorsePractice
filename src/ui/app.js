/**
 * Main app controller: wires the forward session to the DOM.
 *
 * This is a thin "view controller" — it owns the DOM updates and event
 * listeners, but delegates all logic to src/modes/forward.js.
 */

import { createForwardSession, generateQuestion, judgeAnswer } from '../modes/forward.js';
import { playMorse, stop } from '../core/audio.js';
import { loadProgress, saveProgress, recordAttempt, getSummary } from '../storage/progress.js';
import { t } from '../i18n/index.js';

// DOM refs
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const els = {
  modeButtons: () => $$('.mode-btn'),
  promptMorse: () => $('#prompt-morse'),
  promptItem: () => $('#prompt-item'),
  inputField: () => $('#answer-input'),
  playBtn: () => $('#btn-play'),
  retryBtn: () => $('#btn-retry'),
  nextBtn: () => $('#btn-next'),
  prevBtn: () => $('#btn-prev'),
  feedback: () => $('#feedback'),
  historyList: () => $('#history-list'),
  resultPanel: () => $('#result-panel'),
};

let session = null;
let history = []; // in-memory history for prev/next navigation
let historyIndex = -1;

/** Initialize the app. */
export function initApp() {
  renderStats();
  bindModeButtons();
  bindActionButtons();
  bindInputField();
  bindKeyboardShortcuts();
  startSession('letter');
  // Re-apply translations on locale change
  document.addEventListener('i18n:applied', () => {
    // Re-render prompts in case item-related strings depend on locale
    // (item itself is morse, not text, so nothing to retranslate here)
  });
}

function startSession(mode) {
  els.modeButtons().forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  session = createForwardSession({
    mode,
    onItemChange: (state) => {
      renderPrompt(state);
      renderInput(state.input);
      clearFeedback();
    },
    onResult: (state) => {
      renderResult(state);
      pushHistory(state);
    },
  });
  history = [session.getState()];
  historyIndex = 0;
}

function bindModeButtons() {
  els.modeButtons().forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (session && session.mode === mode) return;
      startSession(mode);
    });
  });
}

function bindActionButtons() {
  els.playBtn().addEventListener('click', async () => {
    if (!session) return;
    const state = session.getState();
    if (!state.morse) return;
    stop();
    await playMorse(state.morse, { wpm: 20, frequency: 600, volume: 0.25 });
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
    // Generate a new question.
    const mode = session.mode;
    session = createForwardSession({
      mode,
      onItemChange: (state) => {
        renderPrompt(state);
        renderInput('');
        clearFeedback();
      },
      onResult: (state) => {
        renderResult(state);
        pushHistory(state);
      },
    });
    history.push(session.getState());
    historyIndex = history.length - 1;
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
  // Submit on Enter
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
    // Avoid hijacking input field
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
    }
  });
}

function renderPrompt(state) {
  els.promptMorse().textContent = state.morse ?? '';
  els.promptItem().textContent = state.item ?? '';
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
    fb.innerHTML = `<div>${escapeHtml(t('feedback.wrong'))}</div><div class="expected">${escapeHtml(t('feedback.expected'))}<code>${escapeHtml(state.item)}</code></div><div class="actual">${escapeHtml(t('feedback.youTyped'))}<code>${escapeHtml(result.actual)}</code></div>`;
  } else {
    fb.innerHTML = `<div>${escapeHtml(t('feedback.partial'))}</div><div class="char-diff"></div>`;
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
  // Avoid duplicating consecutive same items
  if (history.length && history[history.length - 1].item === state.item) {
    history[history.length - 1] = state;
    return;
  }
  history.push(state);
  historyIndex = history.length - 1;
}

function recordAndPersist(item, input, isCorrect) {
  const state = loadProgress();
  const mode = session.mode;
  const updated = recordAttempt(state, mode, item, input, isCorrect);
  saveProgress(updated);
  renderStats();
}

function renderStats() {
  const state = loadProgress();
  const sum = getSummary(state);
  // Update DOM if stats elements exist
  const totalEl = document.querySelector('#stat-total');
  const accEl = document.querySelector('#stat-accuracy');
  const charsEl = document.querySelector('#stat-chars');
  if (totalEl) totalEl.textContent = sum.totalAttempts;
  if (accEl) accEl.textContent = sum.totalAttempts > 0 ? `${Math.round(sum.accuracy * 100)}%` : '—';
  if (charsEl) charsEl.textContent = sum.uniqueChars;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
