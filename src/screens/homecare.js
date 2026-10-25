// Home care after a fire or flood: cleaning clothes and the home, smoke smell, mold, food in a power
// outage, safe washing and what NOT to do. Content and sources: src/content/homecare.js (English and Spanish).
import { t, isEs, pick } from '../i18n/index.js';
import { esc, tel, ext, fmtDate } from '../ui.js';
import { SECTIONS, DONTS, SOURCES, CHECKED } from '../content/homecare.js';

// In Spanish, link the agency's Spanish page when there is one; otherwise mark the English page.
const srcLink = (id) => {
  const s = SOURCES[id];
  if (!isEs()) return ext(s.en, s.url);
  return s.url_es ? ext(s.es, s.url_es) : ext(s.es + ' (en inglés)', s.url);
};
const sourcesHtml = (sec) => {
  const ids = [...new Set([...sec.points.flatMap((p) => p.src), ...(sec.phone ? [sec.phone.src] : []), ...(sec.more || [])])];
  return `<div class="links sources"><span class="small"><b>${t('Sources:')}</b></span>${ids.map(srcLink).join('')}</div>`;
};
const sectionHtml = (sec, cls = '') => `<section class="card hc${cls}" id="hc-${sec.id}" aria-labelledby="hc-${sec.id}-h"><h3 id="hc-${sec.id}-h">${esc(pick(sec.title))}</h3>
  <ul class="steps-plain">${sec.points.map((p) => `<li>${esc(pick(p))}</li>`).join('')}</ul>
  ${sec.id === 'first' ? `<div class="links">${ext(t('Insurance claim help'), '#resources/insurance')}${ext(t('Board-up & cleanup companies'), '#resources/boardup')}</div>` : ''}
  ${sec.phone ? `${tel(sec.phone.name, sec.phone.num)}<p class="small">${esc(pick(sec.phone.note))}</p>` : ''}
  ${sourcesHtml(sec)}</section>`;

function homeCare() {
  const all = [...SECTIONS, DONTS];
  return { html: `<h2>${t('Home care after a fire or flood')}</h2>
    <p>${t('How to clean clothes and your home, get rid of smoke smell, stop mold, keep food safe when the power is out, and what not to do. Each section lists the official sources it comes from.')}</p>
    <div class="note"><b>${t('Safety first.')}</b> ${t('Only go back inside when officials say it is safe. If you smell gas, leave and call 911 from outside. Before you clean, take photos of the damage for your insurance.')}</div>
    ${isEs() ? `<p class="small esnote">${t('Many official websites are only in English. Links marked "(en inglés)" open an English page. Names of agencies and programs are left in English so you can find them.')}</p>` : ''}
    <nav class="card" aria-label="${t('On this page')}"><b>${t('On this page')}</b><ul class="toc">${all.map((s) => `<li><a href="#hc-${s.id}" data-jump="hc-${s.id}">${esc(pick(s.title))}</a></li>`).join('')}</ul></nav>
    ${SECTIONS.map((s) => sectionHtml(s)).join('')}
    ${sectionHtml(DONTS, ' donts')}
    <p class="small">${t('General guidance only. Follow instructions from your local officials, your insurance company and the product label. For large or dangerous jobs, hire a licensed professional.')} ${t('Checked {date}.', { date: esc(fmtDate(CHECKED)) })}</p>`,
  bind(root) {
    // In-page links must not change the app route (the hash is the router), so scroll instead.
    (root || document).querySelectorAll('a[data-jump]').forEach((a) => (a.onclick = (e) => {
      e.preventDefault(); const el = document.getElementById(a.dataset.jump); if (el) { el.scrollIntoView(); el.querySelector('h3')?.focus?.(); }
    }));
  } };
}

export const homeCareScreens = { 'home-care': homeCare };
