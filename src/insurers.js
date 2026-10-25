// Insurance claim phone directory (Insurance section). Data: public/data/insurers.json, built by the research pass
// from company websites and official regulator pages only (checked date inside the file). Alphabetical, no ranking.
// Search and filtering run on the device; the list is precached for offline use.
import { loadData } from './geo.js';
import { $, $$, esc, ext, telHref, report } from './ui.js';
import { t, tk, locale } from './i18n/index.js';

const PRODUCTS = [['', tk('All products')], ['homeowners', tk('Homeowners')], ['renters', tk('Renters')], ['flood', tk('Flood')], ['condo', tk('Condo')]];
// Product names as stored in the data (lowercase); shown with t(p).
export const PRODUCT_NAMES = [tk('homeowners'), tk('renters'), tk('condo'), tk('flood'), tk('mobile home'), tk('dwelling'), tk('high-value home'), tk('wind-only'), tk('wind/hail'), tk('all P&C')];
// Phone keypad letters, for vanity numbers like 1-800-SF-CLAIM.
const KEYS = { a: 2, b: 2, c: 2, d: 3, e: 3, f: 3, g: 4, h: 4, i: 4, j: 5, k: 5, l: 5, m: 6, n: 6, o: 6, p: 7, q: 7, r: 7, s: 7, t: 8, u: 8, v: 8, w: 9, x: 9, y: 9, z: 9 };
const dial = (n) => String(n).toLowerCase().replace(/[a-z]/g, (c) => KEYS[c]);
const telLink = (n) => telHref(dial(n));
const digits = (n) => dial(n).replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
// Short notes for companies that share a claims line with another company (from insurers-summary.md).
const SHARED = {
  'Safeco (Liberty Mutual)': tk("Shared number: Safeco claims now go through Liberty Mutual's claims line (800-2CLAIMS)."),
  'Nationwide (incl. Allied / AMCO)': tk('Shared number: Allied (AMCO) policies use this Nationwide line.'),
  'Occidental Fire & Casualty (IAT, via SageSure)': tk('Shared number: Occidental claims are handled by SageSure.'),
  'SafePort Insurance (via SageSure)': tk('Shared number: SafePort claims are handled by SageSure.'),
  'SURE (SureChoice Underwriters Reciprocal Exchange, via SageSure)': tk('Shared number: SURE claims are handled by SageSure.'),
  'Progressive Home / ASI': tk('Progressive places home policies with several companies. Its main line connects you to whichever company holds your policy; the company is named on your declarations page.'),
};
const ALIASES = { 'Nationwide (incl. Allied / AMCO)': 'allied amco', 'National Flood Insurance Program (NFIP Direct / FEMA)': 'nfip fema floodsmart', 'NC Insurance Underwriting Association (Coastal/Beach Plan) & NC Joint Underwriting Association (FAIR Plan)': 'ncjua nciua fair plan beach plan coastal' };
const NFIP = 'National Flood Insurance Program (NFIP Direct / FEMA)';
const SPECIAL = /catastrophe|storm|hurricane|flood|after-hours|emergency|connects you/i;
const fmtDate = (d) => { const [y, m, day] = String(d).split('-').map(Number); return y ? new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(locale(), { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : ''; };

export async function insurerData() { const d = await loadData('insurers'); return { checked: d.generated, list: [...d.records].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })) }; }

const bigCall = (label, n) => `<a class="btn call" href="${esc(telLink(n))}">${esc(label)}<br><b>${esc(n)}</b></a>`;
const smallCall = (label, n) => `<a class="btn secondary" href="${esc(telLink(n))}">${esc(label)}: ${esc(n)}</a>`;
function card(r) {
  const nfip = r.name === NFIP, general = r.claimsPhoneType === 'general';
  const others = (r.otherNumbers || []).filter((o) => o.verified && digits(o.number) !== digits(r.claimsPhone)); // unverified extras are left out
  const special = others.filter((o) => SPECIAL.test(o.label) && !/fax|text/i.test(o.label) && !(nfip && /FEMA disaster/i.test(o.label)));
  const rest = others.filter((o) => !special.includes(o));
  const restHtml = rest.map((o) => /fax/i.test(o.label) ? `<li>${esc(o.label)}: ${esc(o.number)} (fax)</li>` : /^text/i.test(o.label) ? `<li><a href="sms:${esc(digits(o.number))}">${esc(o.label)}: ${esc(o.number)}</a></li>` : `<li><a href="${esc(telLink(o.number))}">${esc(o.label)}: ${esc(o.number)}</a></li>`).join('');
  const primary = nfip ? bigCall(t('Call to file a claim (policies bought directly from NFIP)'), r.claimsPhone) : bigCall(general ? t('Call customer service') : t('Call to file a claim'), r.claimsPhone);
  return `<li class="ins card" data-n="${esc((r.name + ' ' + r.ncdoiGroup + ' ' + (ALIASES[r.name] || '')).toLowerCase())}" data-p="${esc(r.products.join('|'))}">
    <h3>${esc(r.name)}${r.open247 ? ' <span class="badge ok">24/7</span>' : ''}</h3>
    <p class="small">${esc(r.products.map((p) => t(p)).join(', '))}${r.hours ? ' · ' + esc(r.hours) : ''}</p>
    ${primary}${general ? `<p class="small">${t('No separate claims line listed; ask for claims.')}</p>` : ''}
    ${nfip ? `<p class="small">${t('Most flood policies are sold and handled by a regular insurance company ("Write Your Own"). If your flood policy came through an insurance company, call that company first.')}</p>` : ''}
    ${SHARED[r.name] ? `<p class="small"><b>${esc(t(SHARED[r.name]))}</b></p>` : ''}
    ${special.length ? `<div class="actions">${special.map((o) => smallCall(nfip && /FMIX|find your flood insurer/i.test(o.label) ? t('Help finding your flood insurer (NFIP)') : o.label, o.number)).join('')}</div>` : ''}
    <div class="links">${r.onlineClaimUrl ? ext(t('File a claim online'), r.onlineClaimUrl) : ''}${ext(t('Website'), r.website)}</div>
    ${restHtml ? `<details><summary>${t('Other numbers')}</summary><ul class="plain">${restHtml}</ul></details>` : ''}
    ${report(r.name + ' (insurance claims)')}</li>`;
}

export async function insurerDirectory() {
  const { checked, list } = await insurerData();
  const nciga = list.find((r) => /Guaranty/.test(r.name));
  return { html: `<section class="card" id="insdir"><h3>${t('Insurance claim phone numbers')}</h3>
    <ul class="steps-plain">
      <li><b>${t('Have your policy number ready.')}</b></li>
      <li><b>${t('Flood damage is usually NOT covered by homeowners or renters insurance.')}</b> ${t('Flood claims go through your flood policy (NFIP or private).')}</li>
      <li>${t('If your insurer went out of business (e.g. Southern Fidelity), contact the NC Insurance Guaranty Association')}${nciga ? `: <a href="${esc(telLink(nciga.claimsPhone))}">${esc(nciga.claimsPhone)}</a>` : ''}.</li>
      <li>${t('If you disagree with your insurer or the claim is stuck, call the NC Department of Insurance consumer help line (free, weekdays 8–5):')} <a href="${esc(telLink('1-855-408-1212'))}">1-855-408-1212</a>.</li>
    </ul>
    <p class="small">${t("{n} companies and programs selling home, renters, condo or flood insurance in North Carolina, listed alphabetically. This is not a ranking. Being listed is not an endorsement, and none of these companies are affiliated with this app or with C4I Veteran Services Corp. Other licensed companies and local agents are available. Sources: each company's own website or an official regulator or government page (NCDOI, FloodSmart/FEMA, NCJUA/NCIUA); company list from the NCDOI 2025 homeowners market share report.", { n: list.length })}</p>
    <p class="small"><b>${t('Numbers checked {date}.', { date: esc(fmtDate(checked)) })}</b></p>
    <label for="insq">${t('Search by company name')}</label><input id="insq" type="search" autocomplete="off" placeholder="${t('e.g. State Farm')}">
    <label for="insp">${t('Product')}</label><select id="insp">${PRODUCTS.map(([v, l]) => `<option value="${v}">${t(l)}</option>`).join('')}</select>
    <p class="small" id="inssum" role="status" aria-live="polite">${t('{n} companies', { n: list.length })}</p></section>
    <ul class="list" id="inslist">${list.map(card).join('')}</ul>`,
  bind() {
    const apply = () => { const q = $('#insq').value.trim().toLowerCase(), p = $('#insp').value; let n = 0;
      $$('#inslist li.ins').forEach((li) => { const show = (!q || li.dataset.n.includes(q)) && (!p || li.dataset.p.split('|').includes(p)); li.classList.toggle('hide', !show); n += show; });
      $('#inssum').textContent = n ? (n === 1 ? t('1 company') : t('{n} companies', { n })) : t('No companies match. Try another name, or call NCDOI at 1-855-408-1212.'); };
    $('#insq').oninput = apply; $('#insp').onchange = apply;
  } };
}
