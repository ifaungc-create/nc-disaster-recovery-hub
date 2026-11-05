// "Official sources" (#sources, /official-sources): every government agency whose information the app uses,
// grouped North Carolina / Federal / Tribal, each with its official website, then the non-government
// organizations the app uses. The "not a government app" notice is at the top. Data: content/official-sources.js.
import { APP_NAME } from '../config.js';
import { OFFICIAL_SOURCES, SOURCES_CHECKED } from '../content/official-sources.js';
import { t, pick } from '../i18n/index.js';
import { esc, ext, contactLine } from '../ui.js';

const GROUPS = () => [
  ['nc', t('North Carolina government')],
  ['federal', t('Federal government')],
  ['tribal', t('Tribal government')],
  ['other', t('Other organizations (not government)')],
];
const entry = (s) => `<li class="src"><b>${esc(pick(s.name))}</b>
  ${s.url ? `<div class="links srcurl">${ext(s.url, s.url)}</div>` : ''}
  <p class="small">${t('Used in the app for:')} ${esc(pick(s.uses))}</p>
  ${(s.more || []).length ? `<div class="links srcurl">${s.more.map(([l, u]) => ext(pick(l) + ': ' + u, u)).join('')}</div>` : ''}</li>`;
const notGov = () => `<div class="card warn" id="notgov"><h3>${t('Not a government app')}</h3>
  <p>${t('{app} is a project of C4I Veteran Services Corp., a 501(c)(3) nonprofit. It is not a government app and is not a government agency. It does not represent FEMA, the State of North Carolina, any county or any agency listed here, and it does not take applications for government benefits. In an emergency, call 911.', { app: esc(APP_NAME) })}</p>
  <p>${t('To apply for help or to confirm information, use the official websites below or call the agency.')}</p></div>`;

const sources = () => ({ html: `<h2>${t('Official sources')}</h2>
  ${notGov()}
  <p>${t('The phone numbers, websites and guides in this app come from the public sources below. Each government agency is listed with its official website.')}</p>
  <nav aria-label="${t('Groups of sources')}"><ul class="srcjump">${GROUPS().map(([g, l]) => `<li><a href="#sources" data-jump="src-${g}">${esc(l)}</a></li>`).join('')}</ul></nav>
  ${GROUPS().map(([g, l]) => `<section class="card" aria-labelledby="src-${g}"><h3 id="src-${g}" tabindex="-1">${esc(l)}</h3>
    ${g === 'other' ? `<p class="small">${t('These organizations are not government agencies. Some state and federal agencies use a website that does not end in .gov; they are listed with their government above.')}</p>` : ''}
    <ul class="srclist">${OFFICIAL_SOURCES.filter((s) => s.group === g).map(entry).join('')}</ul>
    ${g === 'nc' ? `<p class="small">${t('Each county government, county office and school district is linked to its own official website on its county page.')}</p>` : ''}
    ${g === 'other' ? `<p class="small">${t('Food banks and pantries, stores, insurance companies, hotels, and phone and translation apps are linked to their own websites in their listings.')}</p>` : ''}</section>`).join('')}
  <p class="small">${t('Links checked {date}. Websites change: if a link does not work, tell us.', { date: esc(SOURCES_CHECKED) })} ${contactLine()}</p>
  <a class="btn secondary" href="#about">${t('About &amp; disclaimer')}</a>`,
  // Jump links scroll within the page without changing the route (the app routes by #hash).
  bind() { document.querySelectorAll('[data-jump]').forEach((a) => { a.onclick = (e) => { e.preventDefault(); const h = document.getElementById(a.dataset.jump); if (h) { h.scrollIntoView(); h.focus({ preventScroll: true }); } }; }); },
});

export const sourcesScreens = { sources };
