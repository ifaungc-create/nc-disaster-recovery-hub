// Small HTML helpers shared by screens. All dynamic text goes through esc().
import { t, locale } from './i18n/index.js';
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s = '') => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Official county sites that only answer over plain http (https times out or errors; checked 2026-10-22).
// Keep in sync with "_httpOnly" in data-raw/overrides.json.
export const HTTP_ONLY_HOSTS = ['bertiecounty.nc.gov', 'tyrrellcounty.org'];
const httpOk = (u) => { const m = /^http:\/\/([^/:?#]+)(?=[/?#]|$)/i.exec(u); return !!m && HTTP_ONLY_HOSTS.includes(m[1].toLowerCase()); };
export const safeUrl = (u = '') => (/^(https:|mailto:|tel:|sms:|geo:|#)/i.test(u) || httpOk(u) ? u : '#');
export const digits = (n = '') => String(n).replace(/[^\d]/g, '');
export const telHref = (n) => { const d = digits(n); return d.length === 10 ? `tel:+1${d}` : d.length === 11 && d[0] === '1' ? `tel:+${d}` : `tel:${d}`; };
export const tel = (label, num) => (num ? `<a class="tel" href="${telHref(num)}"><span>${esc(label)}</span><b>${esc(num)}</b></a>` : '');
export const ext = (label, url) => (url ? (url.startsWith('#') ? `<a href="${esc(url)}">${esc(label)}</a>` : `<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(label)} <span aria-hidden="true">↗</span><span class="sr"> ${t('(opens a new tab)')}</span></a>`) : '');
// "Report a broken link or number": opens the person's email app; the item name is prefilled. Nothing is sent by us.
// The subject and body stay in English in both languages: they are read by the C4I team.
import { CONTACT_EMAIL } from './config.js';
export const reportHref = (name) => `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Broken link or number: ' + String(name || '').slice(0, 150))}&body=${encodeURIComponent('Item: ' + String(name || '').slice(0, 150) + '\nWhat is wrong (number does not work, link broken, closed…):\n')}`;
export const report = (name) => `<p class="report small"><a href="${esc(reportHref(name))}" data-report="${esc(name)}">${t('Report a broken link or number')}</a></p>`;
export const contactLine = () => `${t('Problems with the app? Email')} <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>`;
export const verifyBadge = (why = '') => `<span class="badge verify" title="${esc(why)}">${t('Not verified')}</span>`;
export const fmtDate = (d) => { if (!d) return ''; const x = new Date(d.length === 10 ? d + 'T12:00:00' : d); return isNaN(x) ? '' : x.toLocaleDateString(locale(), { month: 'short', day: 'numeric', year: 'numeric' }); };
export const today = () => new Date().toLocaleDateString('en-CA');
export const b64urlEncode = (obj) => { const b = new TextEncoder().encode(JSON.stringify(obj)); let s = ''; b.forEach((x) => (s += String.fromCharCode(x))); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
export const b64urlDecode = (str) => { const s = atob(String(str).replace(/-/g, '+').replace(/_/g, '/')); return JSON.parse(new TextDecoder().decode(Uint8Array.from(s, (c) => c.charCodeAt(0)))); };
export function download(name, text, type = 'application/json') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
