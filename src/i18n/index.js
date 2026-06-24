/**
 * i18n runtime.
 *
 * Usage:
 *   import { t, setLocale, getLocale, initI18n, applyTranslations } from './i18n/index.js';
 *   t('mode.letter')                  // → '字母 / 数字' or 'Letter / Digit'
 *   t('feedback.expected', { item: 'HELLO' })  // → '期望：HELLO' (if template added)
 *   setLocale('en');
 *
 * Behavior:
 *   - locale persisted in localStorage key 'morse.v1.locale'
 *   - on first load, falls back to navigator.language (zh* → 'zh', else 'en')
 *   - missing keys return '[missing.key]' rather than throwing
 *   - DOM helper applyTranslations() walks all [data-i18n] elements
 */

import zh from './zh.js';
import en from './en.js';

const STORAGE_KEY = 'morse.v1.locale';
const DICTS = { zh, en };

let _locale = null;
let _dict = null;

function detectLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && DICTS[saved]) return saved;
  } catch {}
  const nav = (typeof navigator !== 'undefined' && navigator.language) || 'en';
  return nav.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function loadDict(locale) {
  return DICTS[locale] || DICTS.zh;
}

/** Initialize the i18n subsystem. Idempotent. */
export function initI18n() {
  if (_locale) return;
  _locale = detectLocale();
  _dict = loadDict(_locale);
  // Reflect on <html lang>
  if (typeof document !== 'undefined') {
    document.documentElement.lang = _locale === 'zh' ? 'zh-CN' : 'en';
  }
}

/** Get current locale code. */
export function getLocale() {
  initI18n();
  return _locale;
}

/** Switch locale and persist. */
export function setLocale(locale) {
  if (!DICTS[locale]) return;
  _locale = locale;
  _dict = loadDict(locale);
  try { localStorage.setItem(STORAGE_KEY, locale); } catch {}
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    applyTranslations();
  }
}

/** Toggle between 'zh' and 'en'. */
export function toggleLocale() {
  setLocale(_locale === 'zh' ? 'en' : 'zh');
}

/**
 * Translate a dot-separated key, with optional {var} interpolation.
 * Returns '[missing.key]' for unknown keys (so the UI is debuggable).
 */
export function t(key, vars) {
  initI18n();
  const parts = key.split('.');
  let cur = _dict;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) {
      cur = cur[p];
    } else {
      return `[${key}]`;
    }
  }
  if (typeof cur !== 'string') return `[${key}]`;
  if (!vars) return cur;
  return cur.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? String(vars[name]) : `{${name}}`));
}

/**
 * Walk the DOM and apply translations to elements with [data-i18n] attr.
 * - [data-i18n="key"] → set textContent
 * - [data-i18n-placeholder="key"] → set placeholder
 * - [data-i18n-aria="key"] → set aria-label
 * Also dispatches 'i18n:applied' event for app.js to do its own updates.
 */
export function applyTranslations() {
  if (typeof document === 'undefined') return;
  initI18n();
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
  });
  // Update language switcher label
  const sw = document.querySelector('[data-i18n-lang-switch]');
  if (sw) sw.textContent = t('language.switchTo');
  document.dispatchEvent(new CustomEvent('i18n:applied', { detail: { locale: _locale } }));
}
