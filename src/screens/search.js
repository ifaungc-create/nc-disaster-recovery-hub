// Search the whole app from one box. The search runs on this device (see src/search.js).
import { ctx } from '../ctx.js';
import { $, $$, esc, tel, ext } from '../ui.js';
import { t, tk } from '../i18n/index.js';
import { search } from '../search.js';

const GROUP_TITLES = { guides: tk('Guides and pages'), places: tk('Counties and towns'), fire: tk('Fire departments'), schools: tk('School districts'), insurers: tk('Insurance claim lines'), food: tk('Cultural food: pantries & stores') };
const LIMIT = { guides: 12, places: 6, fire: 8, schools: 5, insurers: 6, food: 6 };
const MAX_ALL = 100; // a phone stays fast; the full list is one tap away on its own screen
const FULL = { fire: ['#fire', tk('Search all fire departments')], schools: ['#schools', tk('All school districts')], food: ['#cultural-food', tk('Open the cultural food list')], places: ['#counties', tk('All counties')], insurers: ['#resources/insurance', tk('Open insurance help')] };
const KIND = { page: tk('Section'), guide: tk('Guide'), place: tk('County'), town: tk('Town'), fire: tk('Fire department'), school: tk('School district'), insurer: tk('Insurance company'), food: tk('Cultural food') };
const POPULAR = [tk('FEMA'), tk('shelter'), tk('birth certificate'), tk('mold'), tk('insurance claim'), tk('unemployment'), tk('legal aid'), tk('food')];

// Search box for the home screen and the search screen. Submitting opens #search/<words>.
export const searchForm = (q = '', id = 'gs') => `<form class="card searchbox" role="search" id="${id}f" action="#search">
  <label for="${id}q">${t('Search the app')}</label>
  <div class="searchrow"><input id="${id}q" name="q" type="search" enterkeyhint="search" autocomplete="off" value="${esc(q)}" placeholder="${t('e.g. FEMA, mold, 27601')}"><button class="btn" type="submit">${t('Search')}</button></div>
  <p class="small">${t('Searches guides, phone numbers, counties, towns, ZIP codes, fire departments and more. Your search stays on this phone.')}</p></form>`;
export const bindSearchForm = (id = 'gs') => { const f = $(`#${id}f`); if (f) f.onsubmit = (e) => { e.preventDefault(); const q = $(`#${id}q`).value.trim(); if (q) ctx.go('search/' + encodeURIComponent(q)); }; };

const where = (e) => [e.city, e.county ? t('{name} County', { name: e.county }) : '', e.zip].filter(Boolean).join(' · ');
function row(e) {
  const sub = e.zipOf ? t('ZIP {zip} is in {name} County', { zip: e.zipOf, name: e.title }) : e.kind === 'town' ? t('{name} County', { name: e.county }) : e.sub || where(e);
  const title = e.kind === 'place' && !e.zipOf ? t('{name} County', { name: e.title }) : e.zipOf ? t('{name} County', { name: e.title }) : e.title;
  return `<li class="sres"><a class="rowlink" href="${esc(e.href)}"${e.jump ? ` data-jump="${esc(e.jump)}"` : ''}><span><span class="badge kind">${esc(t(KIND[e.kind] || ''))}</span> <b>${esc(title)}</b>${sub ? `<br><span class="small">${esc(sub)}</span>` : ''}</span><span aria-hidden="true">›</span></a>
    ${e.phone || (e.phones && e.phones[0]) || e.url ? `<div class="sacts">${e.phone ? tel(t('Call'), e.phone) : e.phones?.[0] ? tel(e.phones[0][0], e.phones[0][1]) : ''}${e.url ? `<div class="links">${ext(t('Website'), e.url)}</div>` : ''}</div>` : ''}</li>`;
}

async function searchScreen(parts) {
  const q = decodeURIComponent(parts.join('/') || '');
  const show = ctx.searchShowAll || {}; ctx.searchShowAll = {};
  let res = { groups: [], total: 0, words: [] }, err = '';
  if (q) { try { res = await search(q); } catch { err = t('Search could not load the lists. Check your connection and try again.'); } }
  const summary = !q ? '' : err || (res.total ? (res.total === 1 ? t('1 result for "{q}"', { q: esc(q) }) : t('{n} results for "{q}"', { n: res.total.toLocaleString(), q: esc(q) })) : t('Nothing found for "{q}".', { q: esc(q) }));
  const html = `<h2>${t('Search')}</h2>${searchForm(q, 'ss')}
    <p id="ssum" role="status" aria-live="polite">${summary}</p>
    ${q && !err && !res.total ? `<div class="card"><p>${t('Try fewer or different words, a county name, or a ZIP code. You can also call 211 any time: they know local shelters, food and help.')}</p>${tel('NC 211', '211')}<a class="btn secondary" href="#resources">${t('Browse all resources')}</a></div>` : ''}
    ${res.groups.map((g) => { const lim = show[g.id] ? Math.min(g.items.length, MAX_ALL) : LIMIT[g.id]; const full = FULL[g.id]; return `<section class="sgroup" aria-labelledby="sg-${g.id}"><h3 id="sg-${g.id}">${esc(t(GROUP_TITLES[g.id]))} <span class="small">(${g.items.length.toLocaleString()})</span></h3>
      <ul class="list">${g.items.slice(0, lim).map(row).join('')}</ul>${g.items.length > lim && !show[g.id] ? `<button class="btn secondary" type="button" data-more="${g.id}">${g.items.length > MAX_ALL ? t('Show {n} more', { n: (MAX_ALL - lim).toLocaleString() }) : t('Show all {n}', { n: g.items.length.toLocaleString() })}</button>` : ''}${g.items.length > lim && show[g.id] && full ? `<a class="btn secondary" href="${full[0]}">${esc(t(full[1]))}</a>` : ''}</section>`; }).join('')}
    ${!q ? `<div class="card"><h3>${t('Popular searches')}</h3><div class="chips">${POPULAR.map((w) => `<a class="chip" href="#search/${encodeURIComponent(t(w))}">${esc(t(w))}</a>`).join('')}</div></div>` : ''}`;
  return { html, bind() {
    bindSearchForm('ss');
    if (!q) $('#ssq')?.focus();
    $$('[data-jump]').forEach((a) => a.addEventListener('click', () => { ctx.jump = a.dataset.jump; }));
    $$('[data-more]').forEach((b) => (b.onclick = () => { ctx.searchShowAll = { ...show, [b.dataset.more]: true }; ctx.keepScroll = window.scrollY; ctx.render(); }));
  } };
}

export const searchScreens = { search: searchScreen };
