// "Official sources" (#sources, /official-sources): the one page for government resources.
// 1. The "not a government app" notice.
// 2. "Find a government resource": search by county and by type of help. Shows that county's own offices
//    (emergency management, social services, health, Register of Deeds, fire marshal, schools) and the state,
//    federal and tribal agencies for that type, each with its official website as the source.
// 3. The full list of every government agency whose information the app uses, grouped North Carolina /
//    Federal / Tribal, then the non-government organizations. Data: content/official-sources.js.
import { APP_NAME } from '../config.js';
import { OFFICIAL_SOURCES, SOURCES_CHECKED, RESOURCE_TYPES, typesOf, EBCI_COUNTIES } from '../content/official-sources.js';
import { loadData, getLoc } from '../geo.js';
import { t, pick, isEs } from '../i18n/index.js';
import { $, esc, ext, tel, contactLine } from '../ui.js';

const GROUPS = () => [
  ['nc', t('North Carolina government')],
  ['federal', t('Federal government')],
  ['tribal', t('Tribal government')],
  ['other', t('Other organizations (not government)')],
];
const typeLabel = (id) => { const x = RESOURCE_TYPES.find((r) => r[0] === id); return x ? (isEs() ? x[2] : x[1]) : ''; };
const entry = (s) => `<li class="src"><b>${esc(pick(s.name))}</b>
  ${s.url ? `<div class="links srcurl">${ext(s.url, s.url)}</div>` : ''}
  <p class="small">${t('Used in the app for:')} ${esc(pick(s.uses))}</p>
  ${(s.more || []).length ? `<div class="links srcurl">${s.more.map(([l, u]) => ext(pick(l) + ': ' + u, u)).join('')}</div>` : ''}</li>`;
const notGov = () => `<div class="card warn" id="notgov"><h3>${t('Not a government app')}</h3>
  <p>${t('{app} is a project of C4I Veteran Services Corp., a 501(c)(3) nonprofit. It is not a government app and is not a government agency. It does not represent FEMA, the State of North Carolina, any county or any agency listed here, and it does not take applications for government benefits. In an emergency, call 911.', { app: esc(APP_NAME) })}</p>
  <p>${t('To apply for help or to confirm information, use the official websites below or call the agency.')}</p></div>`;

// One county office as a result: name, phone, its own website (shown as the address), and where the listing came from.
const local = (title, o, types, from) => (!o || (!o.url && !o.phone) ? null : { types, html: `<li class="src"><b>${esc(title)}</b>${o.name && o.name !== title && !o.name.startsWith(title.split(' County')[0] + ' County') ? `<br><span class="small">${esc(o.name)}</span>` : ''}
  ${tel(t('Call'), o.phone)}
  ${o.url ? `<div class="links srcurl">${ext(o.url, o.url)}</div>` : ''}
  <p class="small">${t('Source:')} ${esc(from || o.source || '')}</p></li>`, text: `${title} ${o.name || ''}` });

function countyOffices(c, schools) {
  const n = c.name; const out = [];
  out.push(local(t('{name} County government', { name: n }), c.website, ['county'], t('NC.gov county websites list')));
  out.push(local(t('{name} County Emergency Management', { name: n }), c.em, ['emergency']));
  out.push(local(t('{name} County Department of Social Services (DSS)', { name: n }), c.dss, ['benefits']));
  out.push(local(t('{name} County Health Department', { name: n }), c.health, ['health']));
  out.push(local(t('{name} County Register of Deeds', { name: n }), c.rod, ['documents']));
  if (c.fireMarshal) out.push(local(t('{name} County fire marshal / emergency services', { name: n }), { ...c.fireMarshal, name: c.fireMarshal.title }, ['fire']));
  out.push({ types: ['fire'], text: 'fire bomberos', html: `<li class="src"><b>${t('Fire departments in {name} County', { name: esc(n) })}</b><div class="links"><a href="#fire/county/${encodeURIComponent(n)}">${t('All fire departments in {name}', { name: esc(n) })}</a></div><p class="small">${t('Source:')} ${t('NC Office of State Fire Marshal directory')}</p></li>` });
  schools.filter((s) => s.county === n).forEach((s) => out.push(local(s.name, { url: s.url, phone: s.phone }, ['schools'], t('NC Department of Public Instruction'))));
  return out.filter(Boolean);
}

async function sources() {
  const [counties, schools] = await Promise.all([loadData('counties'), loadData('school-districts')]);
  const loc = getLoc();
  const state = { county: counties.some((c) => c.name === loc?.county) ? loc.county : '', type: '', q: '' };
  const gov = OFFICIAL_SOURCES.filter((s) => s.gov);

  function results() {
    const { county, type } = state; const q = state.q.trim().toLowerCase();
    if (!county && !type && !q) return { n: 0, html: '', summary: t('Choose a county, a type of help, or both. The full list of sources is below.') };
    const words = q.split(/\s+/).filter(Boolean);
    const hit = (text) => words.every((w) => text.toLowerCase().includes(w));
    const c = counties.find((x) => x.name === county);
    const loc2 = c ? countyOffices(c, schools).filter((r) => (!type || r.types.includes(type)) && (!q || hit(r.text))) : [];
    const ag = gov.filter((s) => (!type || typesOf(s).includes(type)) && (!q || hit(`${s.name.en} ${s.name.es} ${s.uses.en} ${s.uses.es} ${typesOf(s).map(typeLabel).join(' ')}`)) && (s.group !== 'tribal' || !c || EBCI_COUNTIES.includes(c.name)));
    const n = loc2.length + ag.length;
    const what = [c ? t('{name} County', { name: c.name }) : t('All of North Carolina'), type ? typeLabel(type) : '', q ? `"${state.q.trim()}"` : ''].filter(Boolean).join(' · ');
    const summary = `${n === 1 ? t('1 result') : t('{n} results', { n })} · ${what}`;
    const html = `${loc2.length ? `<section class="card" aria-labelledby="gr-local"><h3 id="gr-local">${t('{name} County offices', { name: esc(c.name) })}</h3><ul class="srclist">${loc2.map((r) => r.html).join('')}</ul><a class="btn secondary" href="#county/${encodeURIComponent(c.name)}">${t('Open the {name} County page', { name: esc(c.name) })}</a></section>` : ''}
      ${ag.length ? `<section class="card" aria-labelledby="gr-ag"><h3 id="gr-ag">${t('State, federal and tribal agencies')}</h3><ul class="srclist">${ag.map(entry).join('')}</ul></section>` : ''}
      ${n ? '' : `<div class="card"><p>${t('No government resource matches. Try another type of help or fewer words, or call 211.')}</p>${tel('NC 211', '211')}</div>`}`;
    return { n, html, summary };
  }

  const r0 = results();
  return { html: `<h2>${t('Official sources')}</h2>
  ${notGov()}
  <p>${t('The phone numbers, websites and guides in this app come from the public sources below. Each government agency is listed with its official website.')}</p>
  <form class="card" id="grf" role="search" aria-labelledby="grh"><h3 id="grh">${t('Find a government resource')}</h3>
    <label for="grc">${t('County')}</label><select id="grc" name="county"><option value="">${t('All of North Carolina')}</option>${counties.map((c) => `<option ${c.name === state.county ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
    <label for="grt">${t('Type of help')}</label><select id="grt" name="type"><option value="">${t('All types of help')}</option>${RESOURCE_TYPES.map(([id]) => `<option value="${id}">${esc(typeLabel(id))}</option>`).join('')}</select>
    <label for="grq">${t('Agency or word (optional)')}</label><input id="grq" name="q" type="search" autocomplete="off" placeholder="${t('e.g. FEMA, Medicaid, license')}">
    <button class="btn" type="submit">${t('Show resources')}</button>
    <p class="small">${t('Every result shows the official website it comes from. Your search stays on this phone.')}</p></form>
  <p id="grsum" role="status" aria-live="polite">${esc(r0.summary)}</p>
  <div id="grres">${r0.html}</div>
  <h3 id="allsrc">${t('All sources')}</h3>
  <nav aria-label="${t('Groups of sources')}"><ul class="srcjump">${GROUPS().map(([g, l]) => `<li><a href="#sources" data-jump="src-${g}">${esc(l)}</a></li>`).join('')}</ul></nav>
  ${GROUPS().map(([g, l]) => `<section class="card" aria-labelledby="src-${g}"><h3 id="src-${g}" tabindex="-1">${esc(l)}</h3>
    ${g === 'other' ? `<p class="small">${t('These organizations are not government agencies. Some state and federal agencies use a website that does not end in .gov; they are listed with their government above.')}</p>` : ''}
    <ul class="srclist">${OFFICIAL_SOURCES.filter((s) => s.group === g).map(entry).join('')}</ul>
    ${g === 'nc' ? `<p class="small">${t('Each county government, county office and school district is linked to its own official website on its county page.')}</p>` : ''}
    ${g === 'other' ? `<p class="small">${t('Food banks and pantries, stores, insurance companies, hotels, and phone and translation apps are linked to their own websites in their listings.')}</p>` : ''}</section>`).join('')}
  <p class="small">${t('Links checked {date}. Websites change: if a link does not work, tell us.', { date: esc(SOURCES_CHECKED) })} ${contactLine()}</p>
  <a class="btn secondary" href="#about">${t('About &amp; disclaimer')}</a>`,
  bind() {
    // Jump links scroll within the page without changing the route (the app routes by #hash).
    document.querySelectorAll('[data-jump]').forEach((a) => { a.onclick = (e) => { e.preventDefault(); const h = document.getElementById(a.dataset.jump); if (h) { h.scrollIntoView(); h.focus({ preventScroll: true }); } }; });
    const run = () => { state.county = $('#grc').value; state.type = $('#grt').value; state.q = $('#grq').value; const r = results(); $('#grsum').textContent = r.summary; $('#grres').innerHTML = r.html; };
    $('#grf').onsubmit = (e) => { e.preventDefault(); run(); };
    $('#grc').onchange = run; $('#grt').onchange = run;
  } };
}

export const sourcesScreens = { sources };
