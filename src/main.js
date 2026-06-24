/**
 * App entry point. Import this from index.html.
 */

import { initApp } from './ui/app.js';
import { initI18n, applyTranslations, toggleLocale } from './i18n/index.js';

function boot() {
  initI18n();
  applyTranslations();
  initApp();
  // Wire language switcher
  const sw = document.querySelector('[data-i18n-lang-switch]');
  if (sw) sw.addEventListener('click', toggleLocale);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
