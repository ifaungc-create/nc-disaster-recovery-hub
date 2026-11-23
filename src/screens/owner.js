// "Check a listing before you pay": who the county lists as the owner of a rental address (see src/owner.js).
import { ctx } from '../ctx.js';
import { $, esc, ext, fmtDate } from '../ui.js';
import { t } from '../i18n/index.js';
import { getLoc, loadData } from '../geo.js';
import { lookupOwner, PARCEL_INFO_URL } from '../owner.js';

// The form, used on the Housing & shelter page and on the result screen.
export const ownerForm = (counties, { address = '', county = '', id = 'oc' } = {}) => `<form id="${id}f" novalidate>
  <label for="${id}a">${t('Street address of the rental')}</label><input id="${id}a" name="address" autocomplete="off" inputmode="text" value="${esc(address)}" placeholder="${t('e.g. 123 Main St')}">
  <label for="${id}c">${t('County')}</label><select id="${id}c" name="county"><option value="">${t('Choose…')}</option>${counties.map((c) => `<option${c.name === county ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
  <p class="err" role="alert" id="${id}err"></p><p class="small" role="status" id="${id}wait"></p>
  <button class="btn" type="submit">${t('Look up the owner')}</button>
  <p class="small" id="${id}priv">${t('The address and county you type go from your phone straight to the State of North Carolina\'s parcel records (NC OneMap). They are not sent to us and are not saved.')}</p></form>`;
export function bindOwnerForm(id = 'oc') {
  const f = $(`#${id}f`); if (!f) return;
  f.onsubmit = (e) => { e.preventDefault(); const a = $(`#${id}a`).value.trim(), c = $(`#${id}c`).value; const err = $(`#${id}err`);
    if (!/^\s*\d/.test(a) || a.split(/\s+/).length < 2) { err.textContent = t('Type the house number and street name, like 123 Main St.'); $(`#${id}a`).focus(); return; }
    if (!c) { err.textContent = t('Choose the county the rental is in.'); $(`#${id}c`).focus(); return; }
    err.textContent = ''; $(`#${id}wait`).textContent = t('Looking up the county record. This can take up to 20 seconds.'); f.querySelector('button[type=submit]').disabled = true;
    ctx.ownerQuery = { address: a, county: c }; if (location.hash === '#owner-check') ctx.render(); else ctx.go('owner-check'); };
}

const steps = () => `<div class="card" id="ocsteps"><h3>${t('What to do with this')}</h3><ol class="steps">
  <li>${t('Ask the person renting to you for their full name and a photo ID.')}</li>
  <li>${t('If the name matches the owner, that is a good sign.')}</li>
  <li>${t('If it does not match, ask why. Owners are often companies, and property managers rent homes for owners. Ask to see the management agreement.')}</li>
  <li>${t('See the inside before you pay anything, and pay in a way that leaves a record.')}</li></ol></div>`;
const more = (county) => `${county ? `<a class="btn secondary" href="#county/${encodeURIComponent(county)}">${esc(t('{name} County offices (Register of Deeds)', { name: county }))}</a>` : ''}
  <a class="btn secondary" href="#resources/legal">${t('Think it is a scam? Free legal help and where to report it')}</a>`;
const srcLine = () => `<p class="small srcline">${t('Source: {agency} (official site)', { agency: ext(t('NC OneMap parcel records (State of North Carolina, from county tax offices)'), PARCEL_INFO_URL) })}</p>`;

async function ownerCheck() {
  const counties = await loadData('counties'); const q = ctx.ownerQuery; const loc = getLoc();
  const head = `<p><a href="#resources/housing">‹ ${esc(t('Housing & shelter'))}</a></p><h2>${t('Who owns this property?')}</h2>`;
  if (!q) return { html: `${head}<p>${t('Found a place to rent on Facebook Marketplace or another website? See who the county says owns it before you pay.')}</p><div class="card">${ownerForm(counties, { county: loc?.county || '' })}</div>${srcLine()}`, bind: () => bindOwnerForm() };
  let res = null, err = '';
  try { res = await lookupOwner(q.address, q.county); }
  catch (x) { err = x.code === 'address' ? t('Type the house number and street name, like 123 Main St.') : t('The state parcel records did not answer. Check your connection and try again in a minute.'); }
  const rows = res?.rows || [];
  const result = err ? `<div class="card warn" id="ocfail"><p>${err}</p></div>`
    : !rows.length ? `<div class="card warn" id="ocnone"><h3>${t('No record found for that address')}</h3><p>${t('Check the house number, the spelling of the street and the county. Apartment buildings are often listed under one main address. No record does not mean the listing is fake.')}</p></div>`
    : `<p id="ocsum" role="status">${rows.length === 1 ? t('1 county record matches.') : t('{n} county records match. Find the one for your address.', { n: rows.length })}</p>
      <ul class="list" id="oclist">${rows.map((r) => `<li class="ocrow"><p class="small">${esc(r.address)}${r.city ? ', ' + esc(r.city) : ''} · ${esc(t('{name} County', { name: r.county }))}</p>
        <p class="ocowner"><span class="small">${t('Owner on the county record')}</span><br><b>${esc(r.owner)}</b>${r.owner2 ? `<br><b>${esc(r.owner2)}</b>` : ''}</p>
        ${r.mailTo ? `<p class="small">${t('Owner\'s mail goes to: {place}', { place: esc(r.mailTo) })}</p>` : ''}
        ${r.asOf ? `<p class="small">${t('Record as of {date}. A recent sale may not show yet.', { date: esc(fmtDate(r.asOf)) })}</p>` : ''}</li>`).join('')}</ul>`;
  return { html: `${head}${result}${rows.length ? steps() : ''}${more(q.county)}
    <div class="card"><h3>${t('Check another address')}</h3>${ownerForm(counties, q)}</div>${srcLine()}`, bind: () => bindOwnerForm() };
}

export const ownerScreens = { 'owner-check': ownerCheck };
