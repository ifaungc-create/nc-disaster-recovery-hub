// English / Spanish. UI strings are keyed by their English text: t('Sign in') returns the English text,
// or the Spanish translation from es.js when Spanish is selected. en.js is generated from the source by
// scripts/i18n-extract.mjs; tests/i18n.test.mjs fails if any key is missing from es.js.
// Names, addresses and phone numbers are never translated. The choice is kept on this device only.
import ES from './es.js';
import { onTranslateProxy } from '../proxy.js';
export const LANG_KEY = 'ncdrh.lang';
let cur = null;
export function getLang() {
  if (cur) return cur;
  try { cur = localStorage.getItem(LANG_KEY) === 'es' ? 'es' : 'en'; } catch { cur = 'en'; }
  return cur;
}
export function langChosen() { if (onTranslateProxy()) return true; try { return !!localStorage.getItem(LANG_KEY); } catch { return true; } }
export function setLang(l) { cur = l === 'es' ? 'es' : 'en'; try { localStorage.setItem(LANG_KEY, cur); } catch {} applyLang(); }
export function applyLang() { if (typeof document !== 'undefined') document.documentElement.lang = getLang(); }
export const isEs = () => getLang() === 'es';
export function t(key, vars) {
  let s = (isEs() && ES[key]) || key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return s;
}
// Marks an English string (for example a server error) as translatable without translating it here.
export const tk = (s) => s;
// Pick the right side of an { en, es } object.
export const pick = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? (isEs() ? o.es ?? o.en : o.en) : o ?? '');
export const locale = () => (isEs() ? 'es-US' : 'en-US');
