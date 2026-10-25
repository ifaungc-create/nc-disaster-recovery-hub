// Translation: free translation apps, the phone's built-in translation, free interpreters, and an optional
// "open this app in Google Translate" link. Nothing is sent to Google unless the person taps that link.
// Content and sources: src/content/translation.js (English and Spanish).
import { t, isEs, pick } from '../i18n/index.js';
import { esc, tel, ext, fmtDate, $ } from '../ui.js';
import { SITE_URL } from '../config.js';
import { PUBLIC_PAGES } from '../paths.js';
import { SOURCES, APPS, HOWTO, RIGHTS, GT_LANGS, CHECKED, gtUrl, langDir } from '../content/translation.js';

const srcLink = (id) => {
  const s = SOURCES[id];
  if (!isEs()) return ext(s.en, s.url);
  return s.url_es ? ext(s.es, s.url_es) : ext(s.es + ' (en inglés)', s.url);
};
const sources = (ids) => `<div class="links sources"><span class="small"><b>${t('Sources:')}</b></span>${ids.map(srcLink).join('')}</div>`;
const pageChoices = () => [{ path: '/', title: t('Home'), route: 'home' }, ...PUBLIC_PAGES.map((p) => ({ path: p.path, title: isEs() && p.es ? p.es.title : p.title, route: p.route }))];

function translation() {
  const toc = [['tr-help', t('Free interpreters')], ['tr-apps', t('Free translation apps')], ['tr-phone', t('Translation built into your phone')], ['tr-gt', t('Read this app in another language')]];
  return { html: `<h2>${t('Translation apps & interpreters')}</h2>
    <p>${t('This app is in English and Spanish. For other languages, you can get a free interpreter, use a free translation app, or use the translation built into your phone.')}</p>
    <div class="note"><b>${t('Check important details with a person.')}</b> ${t('Apps can translate wrong. For deadlines, money amounts, case numbers and medical or legal information, ask for an interpreter.')}</div>
    ${isEs() ? `<p class="small esnote">${t('Many official websites are only in English. Links marked "(en inglés)" open an English page. Names of agencies and programs are left in English so you can find them.')}</p>` : ''}
    <nav class="card" aria-label="${t('On this page')}"><b>${t('On this page')}</b><ul class="toc">${toc.map(([id, l]) => `<li><a href="#${id}" data-jump="${id}">${esc(l)}</a></li>`).join('')}</ul></nav>

    <section aria-labelledby="tr-help-h" id="tr-help"><h3 id="tr-help-h" class="sech">${t('Free interpreters')}</h3>
    ${RIGHTS.map((r) => `<div class="card" id="tr-r-${r.id}"><h4>${esc(pick(r.title))}</h4><ul class="steps-plain">${r.points.map((p) => `<li>${esc(pick(p))}</li>`).join('')}</ul>
      ${r.phone ? tel(pick(r.phone[0]), r.phone[1]) : ''}${r.phone2 ? tel(pick(r.phone2[0]), r.phone2[1]) : ''}${sources(r.src)}</div>`).join('')}
    </section>

    <section aria-labelledby="tr-apps-h" id="tr-apps"><h3 id="tr-apps-h" class="sech">${t('Free translation apps')}</h3>
    <p class="small">${t('All free to download. They work with many languages; some work without internet after you download a language. Each app has its own privacy policy.')}</p>
    ${APPS.map((a) => `<div class="card app" id="tr-app-${a.id}"><h4>${esc(a.name)}</h4><p>${esc(pick(a.what))}</p>${a.note ? `<p class="small">${esc(pick(a.note))}</p>` : ''}<div class="links">${a.links.map(([l, u]) => ext(pick(l), u)).join('')}</div></div>`).join('')}
    </section>

    <section aria-labelledby="tr-phone-h" id="tr-phone"><h3 id="tr-phone-h" class="sech">${t('Translation built into your phone')}</h3>
    <p class="small">${t('Menu names can be a little different on your phone model. Each guide links the official help page.')}</p>
    ${HOWTO.map((h) => `<div class="card" id="tr-how-${h.id}"><h4>${esc(pick(h.title))}</h4><ol class="steps">${h.steps.map((s) => `<li>${esc(pick(s))}</li>`).join('')}</ol>${sources(h.src)}</div>`).join('')}
    </section>

    <section aria-labelledby="tr-gt-h" id="tr-gt"><h3 id="tr-gt-h" class="sech">${t('Read this app in another language')}</h3>
    <div class="card"><p>${t('You can open a page of this app in Google Translate. This is optional.')}</p>
      <p class="small" id="gtprivacy"><b>${t('Privacy:')}</b> ${t('Nothing is sent to Google unless you tap the button. When you tap it, the address and text of the page are sent to Google, which has its own privacy policy. Sign-in, private notes and the nearby hotel search do not work in the translated copy, so do not type personal information there.')}</p>
      <label for="gtlang">${t('Translate into')}</label>
      <select id="gtlang">${GT_LANGS.filter(([c]) => c !== (isEs() ? 'es' : 'en')).map(([c, n]) => `<option value="${esc(c)}" lang="${esc(c)}" dir="${langDir(c)}">${esc(n)}</option>`).join('')}</select>
      <label for="gtpage">${t('Page')}</label>
      <select id="gtpage">${pageChoices().map((p) => `<option value="${esc(p.path)}"${p.route === 'translation' ? ' selected' : ''}>${esc(p.title)}</option>`).join('')}</select>
      <a class="btn" id="gtopen" href="#" target="_blank" rel="noopener noreferrer" aria-describedby="gtprivacy">${t('Open in Google Translate')} <span aria-hidden="true">↗</span><span class="sr"> ${t('(opens a new tab)')}</span></a>
      <p class="small">${t('Translations are made by a computer and may be wrong.')}</p>
      <p class="small">${t('If the page does not translate, use the Translate option in your web browser instead (see "Translate a web page" above).')}</p></div>
    </section>
    <p class="small">${t('Links and steps checked {date}.', { date: esc(fmtDate(CHECKED)) })}</p>`,
  bind(root) {
    (root || document).querySelectorAll('a[data-jump]').forEach((a) => (a.onclick = (e) => {
      e.preventDefault(); const el = document.getElementById(a.dataset.jump); if (el) { el.scrollIntoView(); const h = el.querySelector('h3'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } }
    }));
    // The link is built from the two choices; it is only followed when the person taps it.
    const upd = () => { const a = $('#gtopen'); if (a) a.href = gtUrl(SITE_URL.replace(/\/$/, '') + $('#gtpage').value, $('#gtlang').value); };
    $('#gtlang').onchange = upd; $('#gtpage').onchange = upd; upd();
  } };
}

export const translationScreens = { translation };
