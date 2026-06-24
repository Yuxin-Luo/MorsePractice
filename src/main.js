/**
 * App entry point. Import this from index.html.
 */

import { initApp } from './ui/app.js';
import { initI18n, applyTranslations, toggleLocale } from './i18n/index.js';

function showBootError(err) {
  // Surface fatal boot errors to the user instead of silent failure.
  console.error('[boot] fatal error:', err);
  const banner = document.createElement('div');
  banner.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0;
    background: #f87171; color: #7f1d1d;
    padding: 12px 20px; font-family: monospace; font-size: 13px;
    border-bottom: 2px solid #b91c1c; z-index: 9999;
    white-space: pre-wrap; word-break: break-word;
  `;
  banner.textContent = '⚠️ 启动失败: ' + (err?.message || err);
  document.body.prepend(banner);
}

function boot() {
  try {
    initI18n();
    applyTranslations();
    initApp();
    // Wire language switcher
    const sw = document.querySelector('[data-i18n-lang-switch]');
    if (sw) sw.addEventListener('click', toggleLocale);
  } catch (err) {
    showBootError(err);
  }

  // Surface unhandled errors and promise rejections
  window.addEventListener('error', (e) => {
    console.error('[runtime] error:', e.error || e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[runtime] unhandled rejection:', e.reason);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
