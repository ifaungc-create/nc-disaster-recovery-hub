// Cultural and religious food: pantries, free meals (langar) and stores across North Carolina.
// Data: public/data/cultural-food.json, built by scripts/build_cultural_food.py from pages that were fetched
// (organization websites, store websites, OpenStreetMap). Items the source did not confirm are marked "Not verified".
// Filtering runs on the device; the list is precached for offline use.
import { loadData } from '../geo.js';
import { t, tk, isEs, pick } from '../i18n/index.js';
import { $, esc, tel, ext, verifyBadge, report, fmtDate } from '../ui.js';

export const FOOD_TYPES = [
  ['halal', tk('Halal')], ['kosher', tk('Kosher')], ['muslim', tk('Muslim community')], ['jewish', tk('Jewish community')],
  ['sikh', tk('Sikh langar (free meal)')], ['vegetarian', tk('Vegetarian')], ['latino', tk('Latino / Hispanic')],
  ['asian', tk('Asian (Chinese, Korean, Vietnamese, Filipino and more)')], ['south-asian', tk('South Asian (Indian, Pakistani, Nepali)')],
  ['middle-eastern', tk('Middle Eastern / Mediterranean')], ['african', tk('African')], ['eastern-european', tk('Eastern European / Russian')],
  ['international', tk('International market (many cultures)')],
];
const TYPE = Object.fromEntries(FOOD_TYPES);
export const REGIONS = [
  ['triangle', tk('Triangle: Raleigh, Durham, Cary, Chapel Hill and nearby')], ['charlotte', tk('Charlotte area')],
  ['triad', tk('Triad: Greensboro, Winston-Salem, High Point and nearby')], ['west', tk('Western NC: Asheville, Boone and nearby')],
  ['east', tk('Eastern NC: Greenville, Wilson, Wilmington area and nearby')], ['southeast', tk('Southeast NC: Fayetteville, Sandhills and nearby')],
];
// Opening hours as written in the data, shown with t(hours).
export const HOURS = [
  tk('By appointment only'), tk('Wednesdays 11:00 am–1:00 pm (do not arrive before 10:30 am)'),
  tk('First Saturday of each month 10 am–12 pm (every Saturday during Ramadan)'), tk('Third Saturday of each month 11 am–1 pm'),
  tk('Drive-thru food distribution, 2nd Saturday of each month 2–4 pm'), tk('Tue, Wed, Thu 11:30 am–1:00 pm'),
  tk('Third Saturday of each month 11:00 am–12:30 pm'), tk('Third Saturday of each month, 9 am'), tk('Sundays: 12:45 pm Bhog followed by Langar'),
  tk('Sundays 1:15 pm'), tk('Open pantry and pre-packed food boxes (check current schedule)'), tk('Take-out Mon–Thu 11 am–6 pm'),
];
tk('Food Helpline');
const KINDS = { pantry: tk('Food pantry'), meal: tk('Free meal'), store: tk('Store') };
const UNVERIFIED_WHY = tk('Found on a public map or listing, but not confirmed by the place itself. Call first.');

const link = (x) => (isEs() && x.url_es ? x.url_es : x.url);
const where = (x) => [x.city, x.county ? t('{name} County', { name: x.county }) : ''].filter(Boolean).map(esc).join(' · ');
const chips = (x) => x.types.map((k) => `<span class="badge chip">${esc(t(TYPE[k] || k))}</span>`).join(' ');

function itemHtml(x) {
  const site = link(x);
  return `<li class="card food" data-id="${esc(x.id)}"><h3>${esc(x.name)}${x.verified ? '' : ' ' + verifyBadge(t(UNVERIFIED_WHY))}</h3>
    <p class="small">${esc(t(KINDS[x.kind]))} · ${where(x)}</p><p>${chips(x)}</p>
    ${x.address ? `<p>${esc(x.address)}</p>` : ''}${x.hours ? `<p class="small"><b>${t('Hours:')}</b> ${esc(t(x.hours))}</p>` : ''}
    ${x.note ? `<p class="small">${esc(pick(x.note))}</p>` : ''}
    ${x.phone ? tel(t('Call'), x.phone) + (x.ext ? `<p class="small">${t('Extension {n}', { n: esc(x.ext) })}</p>` : '') : `<p class="small">${t('No phone listed.')}</p>`}
    <div class="links">${site ? ext(t('Website'), site) : ''}${x.osm ? ext(t('Map (OpenStreetMap)'), x.osm) : ''}</div>${report(x.name)}</li>`;
}
const bankHtml = (b) => `<li class="card"><h3>${esc(b.name)}</h3><p class="small">${esc(pick(b.area))}</p>${tel(b.phoneLabel ? t(b.phoneLabel) : t('Call'), b.phone)}
  <div class="links">${ext(t('Find a food pantry near you'), b.url)}</div>${report(b.name)}</li>`;
const helperHtml = (h) => `<li class="card"><h3>${esc(h.name)}</h3><p>${esc(pick(h.note))}</p>${tel(h.id === 'nc211' ? 'NC 211' : t('Call'), h.phone)}${h.phone2 ? tel(t('NC 211 (if 211 does not connect)'), h.phone2) : ''}
  <div class="links">${ext(t('Website'), isEs() && h.url_es ? h.url_es : h.url)}${h.apply ? ext(t('Apply online (ePASS)'), h.apply) : ''}</div>${report(h.name)}</li>`;

async function culturalFood() {
  const d = await loadData('cultural-food');
  const counties = [...new Set(d.items.map((x) => x.county).filter(Boolean))].sort();
  const used = new Set(d.items.flatMap((x) => x.types));
  const unver = d.items.filter((x) => !x.verified).length;
  return { html: `<h2>${t('Cultural & religious food: pantries and stores')}</h2>
    <p>${t('Free food and stores for halal, kosher, Latino, Asian, South Asian, Middle Eastern and other foods in North Carolina. Free pantries and meals are listed first, then the regional food banks, then stores by region and city.')}</p>
    <div class="note"><b>${t('Call ahead.')}</b> ${t('Hours, food on hand and certifications change. Call before you go, and ask whether food is halal or kosher certified if that matters to you. We only say "certified" when the place itself says so.')}</div>
    ${isEs() ? `<p class="small esnote">${t('Many websites in this list are only in English. Names and addresses are left as written.')}</p>` : ''}
    <form id="cff" class="card" role="search"><label for="cft">${t('Type of food')}</label><select id="cft"><option value="">${t('All types')}</option>${FOOD_TYPES.filter(([k]) => used.has(k)).map(([k, l]) => `<option value="${k}">${esc(t(l))}</option>`).join('')}</select>
      <label for="cfk">${t('Free food or stores')}</label><select id="cfk"><option value="">${t('Both')}</option><option value="free">${t('Free food: pantries and meals')}</option><option value="store">${t('Stores (you pay)')}</option></select>
      <label for="cfc">${t('County')}</label><select id="cfc"><option value="">${t('All counties')}</option>${counties.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select>
      <label for="cfq">${t('City or name')}</label><input id="cfq" type="search" autocomplete="off" placeholder="${t('e.g. Charlotte')}"></form>
    <p id="cfsum" class="small" role="status" aria-live="polite"></p><div id="cfout"></div>
    <p class="small">${t('{n} places are marked "Not verified": we found them on a public map or listing, but the place itself did not confirm the details online.', { n: unver })} ${t('Listing is not an endorsement. None of these places are affiliated with this app or with C4I Veteran Services Corp.')}</p>
    <p class="small">${t('Sources: each organization or store website, the Feeding America food bank websites, NC 211, NCDHHS, and OpenStreetMap (© OpenStreetMap contributors, ODbL). Checked {date}.', { date: esc(fmtDate(d.updated)) })}</p>`,
  bind() {
    const run = () => {
      const ty = $('#cft').value, k = $('#cfk').value, c = $('#cfc').value, q = $('#cfq').value.trim().toLowerCase();
      const ok = (x) => (!ty || x.types.includes(ty)) && (!c || x.county === c) && (!q || `${x.name} ${x.city || ''} ${x.county || ''} ${x.address || ''}`.toLowerCase().includes(q));
      const free = k === 'store' ? [] : d.items.filter((x) => x.kind !== 'store' && ok(x));
      const stores = k === 'free' ? [] : d.items.filter((x) => x.kind === 'store' && ok(x));
      let h = '';
      if (k !== 'store') {
        h += `<h3 id="cf-free">${t('Free food from cultural and religious groups')}</h3>${free.length ? `<ul class="list">${free.map(itemHtml).join('')}</ul>` : `<p class="small">${t('No free food places match these filters.')}</p>`}`;
        if (ty === 'kosher' || ty === 'jewish' || !ty) h += `<div class="card"><h3>${t('Kosher food in regular stores')}</h3><p>${esc(pick(d.kosherTips))}</p><div class="links">${ext(t('Source: Chabad of Cary'), d.kosherTips.url)}</div></div>`;
        h += `<h3 id="cf-banks">${t('Food banks: find any pantry near you')}</h3><p class="small">${t('Each regional food bank (Feeding America network) has a map of the pantries and meal sites it supplies. Ask a pantry if it has halal, kosher, vegetarian or other foods you need.')}</p>
          <ul class="list">${d.foodbanks.map(bankHtml).join('')}${d.helpers.map(helperHtml).join('')}</ul>`;
      }
      if (stores.length || k === 'store') {
        h += `<h3 id="cf-stores">${t('Stores')}</h3>`;
        if (!stores.length) h += `<p class="small">${t('No stores match these filters.')}</p>`;
        for (const [r, rl] of REGIONS) {
          const rs = stores.filter((x) => x.region === r); if (!rs.length) continue;
          const byCity = {}; rs.forEach((x) => (byCity[x.city || t('{name} County', { name: x.county })] ??= []).push(x));
          h += `<details class="region" open><summary><b>${esc(t(rl))}</b> (${rs.length})</summary>${Object.keys(byCity).sort().map((city) => `<h4>${esc(city)}</h4><ul class="list">${byCity[city].sort((a, b) => a.name.localeCompare(b.name)).map(itemHtml).join('')}</ul>`).join('')}</details>`;
        }
      }
      $('#cfout').innerHTML = h;
      const n = free.length + stores.length;
      $('#cfsum').textContent = n === 1 ? t('1 place matches.') : t('{n} places match.', { n });
    };
    ['#cft', '#cfk', '#cfc'].forEach((s) => ($(s).onchange = run)); $('#cfq').oninput = run; $('#cff').onsubmit = (e) => { e.preventDefault(); run(); };
    run();
  } };
}

export const foodScreens = { 'cultural-food': culturalFood };
