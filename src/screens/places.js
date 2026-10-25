// County pages, school districts, fire department finder, nearby hotels. All lookups run on the device
// against bundled JSON (hotels too). Only the optional live hotel check goes through our Overpass function.
import { ctx } from '../ctx.js';
import { DATA_DATE, HOTEL_LIVE_CHECK } from '../config.js';
import { $, $$, esc, tel, ext, verifyBadge, report, safeUrl } from '../ui.js';
import { loadData, getLoc, setLoc, locateMe, lookupPlace, geolocate, haversineMi } from '../geo.js';
import { findHotels, findHotelsLive, hotelData, directionsUrl, googlePlaceUrl, applePlaceUrl, areaSearchUrls } from '../hotels.js';
import { getCommunity, communityBlock } from '../community.js';
import { t, isEs } from '../i18n/index.js';

const chk = (o) => (o?.check === 'to-verify' ? ' ' + verifyBadge(t('This link did not load when checked on {date}', { date: DATA_DATE })) : '');
const locBtn = (label = t('Use my location')) => `<button class="btn secondary" id="locme">${label}</button><p class="err" role="alert" id="locerr"></p>`;
const bindLoc = (after) => { const b = $('#locme'); if (b) b.onclick = async () => { b.disabled = true; b.textContent = t('Finding your county…'); try { const l = await locateMe(); after(l); } catch (e) { $('#locerr').textContent = t(e.message); b.disabled = false; b.textContent = t('Use my location'); } }; };

async function counties() {
  const list = await loadData('counties'); const loc = getLoc();
  return { html: `<h2>${t('County services')}</h2><p>${t('Emergency management, social services (DSS), health department, Register of Deeds and more for all 100 North Carolina counties.')}</p>
    ${loc?.county ? `<a class="btn" href="#county/${encodeURIComponent(loc.county)}">${t('Your county: {county}', { county: esc(loc.county) })}</a>` : ''}${locBtn(loc?.county ? t('Update my location') : t('Use my location'))}
    <p class="small">${t('Your location is checked on this device against county maps. It is not sent anywhere.')}</p>
    <label for="cq">${t('Find a county')}</label><input id="cq" type="search" placeholder="${t('Type a county name')}" autocomplete="off">
    <ul class="list" id="clist">${list.map((c) => `<li data-n="${esc(c.name.toLowerCase())}"><a class="rowlink" href="#county/${encodeURIComponent(c.name)}"><span>${t('{name} County', { name: esc(c.name) })}</span><span aria-hidden="true">›</span></a></li>`).join('')}</ul>`,
  bind() { bindLoc((l) => ctx.go('county/' + l.county)); $('#cq').oninput = (e) => { const q = e.target.value.trim().toLowerCase(); $$('#clist li').forEach((li) => li.classList.toggle('hide', !!q && !li.dataset.n.includes(q))); }; } };
}

const office = (title, o, extra = '', county = '') => !o ? '' : `<div class="card"><h3>${esc(title)}</h3>${o.name && o.name !== title ? `<p>${esc(o.name)}</p>` : ''}
  ${tel(t('Call'), o.phone)}${o.afterHours ? tel(t('After hours / emergencies'), o.afterHours) : ''}${o.address ? `<p class="small">${esc(o.address)}</p>` : ''}
  <div class="links">${o.url ? ext(t('Website'), o.url) + chk(o) : ''}${extra}</div><p class="small">${t('Source:')} ${esc(o.source || '')}</p>${report((county ? county + ' County ' : '') + title)}</div>`;

async function county(parts) {
  const name = parts[0]; const all = await loadData('counties'); const c = all.find((x) => x.name.toLowerCase() === String(name).toLowerCase());
  if (!c) return { html: `<h2>${t('County not found')}</h2><a class="btn" href="#counties">${t('All counties')}</a>` };
  const [schools, fire, community] = await Promise.all([loadData('school-districts'), loadData('fire-departments'), getCommunity()]);
  const added = community.filter((r) => r.county === c.name);
  const loc = getLoc(); const mine = loc?.county === c.name;
  const lea = schools.filter((s) => s.county === c.name);
  let fd = fire.filter((f) => f.co === c.name);
  if (mine && loc.la != null) fd = fd.map((f) => ({ ...f, mi: f.la != null ? haversineMi(loc.la, loc.lo, f.la, f.lo) : 1e9 })).sort((a, b) => a.mi - b.mi);
  const depts = new Set(fd.map((f) => f.id)).size;
  return { html: `<h2>${t('{name} County', { name: esc(c.name) })}</h2>
    ${mine ? `<p class="badge ok">${t('Your county')}</p>` : `<button class="btn secondary" id="setmine">${t('Make this my county')}</button>`}
    ${c.complete ? '' : `<div class="note">${t('Some information for this county could not be confirmed. Items marked {badge} need checking; call the office if a link does not work.', { badge: verifyBadge() })}</div>`}
    ${office(t('Emergency Management'), c.em, c.em?.alerts ? ext(t('Sign up for emergency alerts'), c.em.alerts) : '', c.name)}
    ${c.tribalEm ? office(t('Eastern Band of Cherokee Indians Emergency Management'), c.tribalEm, '', '') : ''}
    ${office(t('Department of Social Services (DSS)'), c.dss, c.dss?.directoryPage ? ext(t('NCDHHS directory listing'), c.dss.directoryPage) : '', c.name)}
    ${office(t('Health Department'), c.health, '', c.name)}
    ${office(t('Register of Deeds (birth, death, marriage certificates; property records)'), c.rod, (c.rod?.orderVitalRecords ? ext(t('Order certificates online'), c.rod.orderVitalRecords) : '') + (c.rod?.directoryPage ? ext(t('NC Registers of Deeds listing'), c.rod.directoryPage) : ''), c.name)}
    <div class="card"><h3>${t('County government')}</h3><div class="links">${ext(t('{name} County website', { name: c.name }), c.website?.url)}${chk(c.website)}</div><p class="small">${t('Source: NC.gov county websites list')}</p>${report(c.name + ' County website')}</div>
    ${c.fireMarshal ? `<div class="card"><h3>${t('County fire marshal / emergency services')}</h3><p>${esc(c.fireMarshal.title)}${c.fireMarshal.check === 'to-verify' ? ' ' + verifyBadge(t('Not yet confirmed who handles fire reports')) : ''}</p>${tel(t('Call'), c.fireMarshal.phone)}${c.fireMarshal.address ? `<p class="small">${esc(c.fireMarshal.address)}</p>` : ''}${c.fireMarshal.url ? `<div class="links">${ext(t('Website'), c.fireMarshal.url)}</div>` : ''}${c.fireMarshal.check === 'to-verify' ? `<p class="small">${t('Not verified: the State Fire Marshal directory lists no county fire marshal here. This is the closest official county contact; ask them who handles fire reports.')}</p>` : ''}<p class="small">${t('Ask here about fire reports if the fire department cannot help.')} ${t('Source:')} ${esc(c.fireMarshal.source)}</p>${report(c.name + ' County fire marshal')}</div>` : `<div class="card"><h3>${t('County fire marshal')}</h3><p>${verifyBadge()} ${t('Not listed in the State Fire Marshal directory. Call the county emergency management office.')}</p></div>`}
    <div class="card" id="fd"><h3>${t('Fire departments')} (${depts})</h3>${fd.slice(0, 5).map((f) => `<p><b>${esc(f.n)}</b>${f.st ? ` · ${t('Station')} ${esc(f.st)}` : ''}${f.mi && f.mi < 1e8 ? ` · ${f.mi.toFixed(1)} mi` : ''}<br><span class="small">${esc([f.a, f.c].filter(Boolean).join(', '))}</span></p>${tel(t('Non-emergency'), f.p)}${report(f.n + (f.st ? ' Station ' + f.st : ''))}`).join('')}
      <a class="btn secondary" href="#fire/county/${encodeURIComponent(c.name)}">${t('All fire departments in {name}', { name: esc(c.name) })}</a><p class="small">${t('For a fire or emergency, call 911.')}</p></div>
    ${c.ltrg?.length ? `<div class="card"><h3>${t('Long-term recovery groups')}</h3><div class="links">${c.ltrg.map((g) => (g.url ? ext(g.name, g.url) : `<p>${esc(g.name)}</p>`)).join('')}</div><p class="small">${t('Source:')} NC VOAD</p></div>` : ''}
    ${communityBlock(added, t('Added by verified responders'))}
    <div class="card"><h3>${t('School districts')}</h3>${lea.map((s) => `<p><b>${esc(s.name)}</b>${s.check === 'to-verify' ? ' ' + verifyBadge() : ''}<br>${s.url ? ext(t('Website'), s.url) : ''}</p>${tel(t('Call'), s.phone)}${report(s.name)}`).join('')}<p class="small">${t('Source: NC DPI School Report Card data, 2024–25')}</p></div>
    <p class="small">${t('Information collected {date} from official state directories. Offices change: call before you go.', { date: esc(DATA_DATE) })}</p>`,
  bind() { $('#setmine') && ($('#setmine').onclick = () => { setLoc({ county: c.name, la: null, lo: null, how: 'chosen' }); ctx.flash = t('{name} is now your county.', { name: c.name }); ctx.render(); }); } };
}

async function schools() {
  const s = await loadData('school-districts'); const loc = getLoc();
  const sorted = [...s].sort((a, b) => (b.county === loc?.county) - (a.county === loc?.county) || a.county.localeCompare(b.county) || a.name.localeCompare(b.name));
  return { html: `<h2>${t('School districts')}</h2><p>${t("All {n} North Carolina public school districts (LEAs), by county. Children who lose their home in a disaster may be able to stay in their school or enroll right away; ask the district's McKinney-Vento liaison.", { n: s.filter((x) => x.kind !== 'State school').length })}</p>
    <label for="sq">${t('Filter by county or district')}</label><input id="sq" type="search" autocomplete="off">
    <ul class="list" id="slist">${sorted.map((x) => `<li data-n="${esc((x.county + ' ' + x.name).toLowerCase())}"><b>${esc(x.name)}</b> <span class="small">${t('{name} County', { name: esc(x.county) })} · ${esc(t(x.kind))}</span>${x.check === 'to-verify' ? ' ' + verifyBadge() : ''}<div class="links">${x.url ? ext(t('Website'), x.url) : ''}</div>${tel(t('Call'), x.phone)}${report(x.name)}</li>`).join('')}</ul><p class="small">${t('Source: NC Department of Public Instruction, School Report Card data 2024–25.')}</p>`,
  bind() { $('#sq').oninput = (e) => { const q = e.target.value.trim().toLowerCase(); $$('#slist li').forEach((li) => li.classList.toggle('hide', !!q && !li.dataset.n.includes(q))); }; } };
}

// ---------- fire departments ----------
const fireItem = (f) => `<li class="fd"><span class="dist">${f.mi != null && f.mi < 1e8 ? f.mi.toFixed(1) + ' mi' : ''}</span><h3>${esc(f.n)}</h3>
  <p class="small">${f.st ? `${t('Station')} ${esc(f.st)} · ` : ''}${esc(f.t === 'unknown' ? t('Type not listed') : t(f.t))} · ${t('{name} County', { name: esc(f.co) })}${f.v === 0 ? ' ' + verifyBadge(t('Not in the October 2026 State Fire Marshal directory')) : ''}</p>${f.x ? `<p class="small note">${esc(f.x)}</p>` : ''}
  <p>${esc([f.a, f.c, f.z].filter(Boolean).join(', ')) || `<span class="small">${t('Address not listed')}</span>`}${f.hq ? ` <span class="small">${t('(department headquarters)')}</span>` : ''}</p>
  ${f.p ? tel(t('Non-emergency'), f.p) : `<p class="small">${t('No phone listed. Call the county emergency management office.')}</p>`}${f.la != null ? `<div class="links">${ext(t('Directions'), directionsUrl(f.la, f.lo, f.n))}</div>` : ''}${report(f.n + (f.st ? ' Station ' + f.st : ''))}</li>`;

async function fire(parts) {
  const [all, counties] = await Promise.all([loadData('fire-departments'), loadData('counties')]);
  const loc = getLoc(); const preCounty = parts[0] === 'county' ? parts[1] : '';
  const state = { q: '', county: preCounty || '', origin: loc?.la != null ? { la: loc.la, lo: loc.lo, label: t('your location') } : null, shown: 40 };
  const cur = new Set(all.filter((f) => f.v !== 0).map((f) => f.id)).size, old = new Set(all.filter((f) => f.v === 0).map((f) => f.id)).size;
  const html = `<h2>${t('Fire departments')}</h2><p>${old === 1 ? t('{n} North Carolina fire departments and their stations, plus 1 older listing marked "Not verified".', { n: cur.toLocaleString() }) : t('{n} North Carolina fire departments and their stations, plus {old} older listings marked "Not verified".', { n: cur.toLocaleString(), old })} <b>${t('For a fire or emergency, call 911.')}</b> ${t('Use these numbers for non-emergencies, like getting a fire report.')}</p>
    <form id="ff" class="card" role="search"><label for="fq">${t('Name, city, ZIP code or county')}</label><input id="fq" name="q" type="search" autocomplete="off" placeholder="${t('e.g. 28801, Boone, or Wake')}">
    <label for="fc">${t('County')}</label><select id="fc" name="county"><option value="">${t('All counties')}</option>${counties.map((c) => `<option ${c.name === state.county ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
    <button class="btn" type="submit">${t('Search')}</button></form>${locBtn(t('Sort by distance from my location'))}
    <p id="fsum" role="status" aria-live="polite"></p><ul class="list" id="fl"></ul><button class="btn secondary hide" id="more">${t('Show more')}</button>
    <p class="small">${t('Source: NC Office of State Fire Marshal (NC Department of Insurance) fire station and department data, checked against the OSFM department directory dated 2026-10-07. Some stations may have moved or closed.')}</p>`;
  async function run() {
    let rows = all; const q = state.q.trim(); let label = '';
    if (state.county) rows = rows.filter((f) => f.co === state.county);
    if (/^\d{5}$/.test(q)) {
      const p = await lookupPlace(q); if (p?.la != null) { state.origin = { la: p.la, lo: p.lo, label: 'ZIP ' + q, zip: true }; }
      const inZip = rows.filter((f) => f.z === q); label = t('{n} in ZIP {zip}', { n: inZip.length, zip: q });
      if (p?.la != null) rows = rows.map((f) => ({ ...f, inz: f.z === q })).sort((a, b) => b.inz - a.inz); else rows = inZip;
      if (!p && !inZip.length) label = t('ZIP {zip} was not found in North Carolina', { zip: q });
    } else if (q) {
      const ql = q.toLowerCase(); const cm = counties.find((c) => c.name.toLowerCase() === ql.replace(/\s+county$/, ''));
      rows = cm ? rows.filter((f) => f.co === cm.name) : rows.filter((f) => f.n.toLowerCase().includes(ql) || (f.c || '').toLowerCase().includes(ql));
    }
    if (state.origin) rows = rows.map((f) => ({ ...f, mi: f.la != null ? haversineMi(state.origin.la, state.origin.lo, f.la, f.lo) : 1e9 })).sort((a, b) => (b.inz || 0) - (a.inz || 0) || a.mi - b.mi);
    else if (loc?.county && !state.county && !q) rows = [...rows].sort((a, b) => (b.co === loc.county) - (a.co === loc.county));
    $('#fsum').textContent = `${rows.length === 1 ? t('1 result') : t('{n} results', { n: rows.length.toLocaleString() })}${label ? ' · ' + label : ''}${state.county ? ' · ' + t('{name} County', { name: state.county }) : ''}${state.origin ? ' · ' + t('nearest to {place} first', { place: state.origin.label }) : ''}`;
    $('#fl').innerHTML = rows.slice(0, state.shown).map(fireItem).join('');
    $('#more').classList.toggle('hide', rows.length <= state.shown);
  }
  return { html, bind() {
    $('#ff').onsubmit = (e) => { e.preventDefault(); const d = new FormData(e.target); state.q = d.get('q') || ''; state.county = d.get('county') || ''; state.shown = 40; if (!/^\d{5}$/.test(state.q.trim()) && state.origin?.zip) state.origin = null; run(); };
    $('#more').onclick = () => { state.shown += 40; run(); };
    bindLoc((l) => { state.q = $('#fq').value; state.county = $('#fc').value; state.origin = { la: l.la, lo: l.lo, label: t('your location') }; $('#locme').textContent = t('Sorted by distance'); run(); });
    run();
  } };
}

// ---------- hotels ----------
const mapBtn = (label, url, cls = 'btn secondary') => `<a class="${cls}" href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
const hotelItem = (h, isNew) => `<li class="hotel"${isNew ? ' data-live' : ''}><span class="dist">${h.mi.toFixed(1)} mi</span><h3>${esc(h.name)}</h3><p class="small">${esc(h.kind === 'motel' ? t('Motel') : t('Hotel'))}${h.addr ? ' · ' + esc(h.addr) : ''}${isNew ? ` · <b>${t('new on the live map')}</b>` : ''}</p>
  <p class="small callahead"><b>${t('Call ahead to confirm availability and price.')}</b>${h.phone ? '' : ' ' + t('No phone in our list: tap Google Maps or Apple Maps to see the current phone, website and hours.')}</p>
  <div class="actions">${h.phone ? `<a class="btn" href="tel:${esc(h.phone.split(/[;,]/)[0].replace(/[^\d+]/g, ''))}">${t('Call')}</a>` : ''}${mapBtn(t('Check on Google Maps'), googlePlaceUrl(h), 'btn secondary gmaps')}${mapBtn('Apple Maps', applePlaceUrl(h), 'btn secondary amaps')}<a class="btn secondary" href="${esc(directionsUrl(h.la, h.lo, h.name))}" target="_blank" rel="noopener noreferrer">${t('Directions')}</a></div>
  ${h.website && /^https:/i.test(h.website) ? `<div class="links">${ext(t('Website'), h.website)}</div>` : h.brandSite && /^https:/i.test(h.brandSite) ? `<div class="links">${ext(t('Chain website'), h.brandSite)} <span class="small">${t("(the chain's main site, not this hotel's own page)")}</span></div>` : ''}${h.email ? `<div class="links"><a href="mailto:${esc(h.email)}">${t('Email')}</a></div>` : ''}</li>`;
const tsaNote = () => `<div class="card" id="tsa"><h3>${t('Disaster hotel help')}</h3>
  <p>${t('FEMA <b>Transitional Sheltering Assistance (TSA)</b> pays for a short stay in a participating hotel for eligible disaster survivors, but only when it is turned on for a disaster. You cannot request it: apply for FEMA assistance and FEMA will tell you if you are eligible. Then look up participating hotels with your 9-digit FEMA registration number, and call the hotel before you go.')}</p>
  <div class="links">${isEs() ? ext('Solicitar ayuda de FEMA (DisasterAssistance.gov en español)', 'https://www.disasterassistance.gov/es') : ext('Apply for FEMA help (DisasterAssistance.gov)', 'https://www.disasterassistance.gov/')}${ext(t('About TSA hotel stays (FEMA.gov)'), 'https://www.fema.gov/node/does-fema-offer-help-short-term-lodging-while-i-look-permanent-place-live')}${ext(t('TSA participating-hotel lookup (FEMA)'), 'https://www.femaemergencyhotels.com/')}</div>
  ${tel(t('FEMA Helpline'), '1-800-621-3362')}
  <p><b>${t('Need a shelter tonight?')}</b> ${t('NC 211 knows which emergency shelters are open, 24 hours a day. The Red Cross also runs shelters.')}</p>
  ${tel('NC 211', '211')}${tel(t('NC 211 (if 211 does not connect)'), '1-888-892-1162')}${tel(t('Red Cross'), '1-800-733-2767')}
  <div class="links">${ext(t('Find an open Red Cross shelter'), 'https://www.redcross.org/get-help/disaster-relief-and-recovery-services/find-an-open-shelter.html')}${ext(t('NC 211 online'), 'https://nc211.org/')}</div></div>`;
async function hotels() {
  const { date } = await hotelData().catch(() => ({ date: '' }));
  return { html: `<h2>${t('Hotels & motels nearby')}</h2>
    <p>${t('Find places to stay near you or near a ZIP code or town. Call ahead: rooms fill quickly after a disaster.')}</p>
    <div class="note">${t('<b>Your privacy:</b> the search runs on your phone against a list of every hotel and motel in North Carolina. Your location is not sent anywhere and is not saved.')}</div>
    <button class="btn" id="hloc">${t('Use my location')}</button>
    <form id="hf" class="card"><label for="hq">${t('Or enter a ZIP code or city')}</label><input id="hq" name="q" autocomplete="postal-code" placeholder="${t('e.g. 28401 or Wilmington')}"><button class="btn secondary" type="submit">${t('Search')}</button></form>
    <p class="err" role="alert" id="herr"></p>${tsaNote()}<p id="hsum" role="status" aria-live="polite"></p>
    <div id="harea" class="card hide"><p>${t('<b>Phone numbers, websites and open hours</b> are often missing from our list. Google Maps and Apple Maps show current details:')}</p><div class="actions"><a class="btn" id="hgoog" href="#" target="_blank" rel="noopener noreferrer">${t('Search hotels near you on Google Maps')}</a><a class="btn secondary" id="happl" href="#" target="_blank" rel="noopener noreferrer">Apple Maps</a></div><p class="small">${t('These open Google Maps or Apple Maps only when you tap them. That company then sees the search: the place you typed, or your area rounded to about 1 km. This app sends them nothing.')}</p></div>
    <ul class="list" id="hl"></ul>
    ${HOTEL_LIVE_CHECK ? `<div id="livewrap" class="hide"><button class="btn secondary" id="hlive">${t('Check the live map for newer listings')}</button><p class="small">${t('This one is optional. It sends your position, rounded to about 1 km, to our server, which asks OpenStreetMap about the surrounding area (about 10 km) and does not log it.')}</p><p class="small" id="hlivesum" role="status" aria-live="polite"></p></div>` : ''}
    <p class="small">${t('Hotel list: OpenStreetMap data as of {date}. It can miss places or include closed ones. Ask FEMA, the Red Cross or NC 211 whether you can get help paying for a hotel. Listings are not endorsements. Map data © OpenStreetMap contributors (ODbL).', { date: esc(date || t('the last update')) })}</p>`,
  bind() {
    let cur = null;
    const show = async (p, label, mine = false) => {
      $('#herr').textContent = ''; $('#hsum').textContent = t('Searching…'); $('#hl').innerHTML = ''; $('#harea').classList.add('hide'); if ($('#hlivesum')) $('#hlivesum').textContent = '';
      try {
        const { rows, radiusMi } = await findHotels(p.la, p.lo); cur = { p, rows, radiusMi };
        const within = t('within about {mi} miles of {place}', { mi: Math.round(radiusMi), place: label });
        $('#hsum').textContent = rows.length ? t('{n} hotels and motels {within}, nearest first', { n: rows.length, within }) : t('No hotels or motels found {within}. Try a nearby town, or call 211.', { within });
        const area = areaSearchUrls(p, mine ? 'your location' : label); $('#hgoog').href = safeUrl(area.google); $('#happl').href = safeUrl(area.apple);
        $('#hgoog').textContent = mine ? t('Search hotels near me on Google Maps') : t('Search hotels near {place} on Google Maps', { place: label.replace(/^ZIP /, '') }); $('#harea').classList.remove('hide');
        $('#hl').innerHTML = rows.map((h) => hotelItem(h)).join(''); if (HOTEL_LIVE_CHECK) $('#livewrap').classList.remove('hide');
      } catch (e) { $('#hsum').textContent = ''; $('#herr').textContent = t('The hotel list could not be loaded. Check your connection and try again.'); }
    };
    if (HOTEL_LIVE_CHECK) $('#hlive').onclick = async () => {
      if (!cur) return; const b = $('#hlive'); b.disabled = true; $('#hlivesum').textContent = t('Checking the live map…');
      try {
        const have = new Set(cur.rows.map((h) => h.id));
        const fresh = (await findHotelsLive(cur.p.la, cur.p.lo, cur.radiusMi)).filter((h) => !have.has(h.id) && h.mi <= cur.radiusMi);
        cur.rows = [...cur.rows, ...fresh].sort((x, y) => x.mi - y.mi);
        $('#hl').innerHTML = cur.rows.map((h) => hotelItem(h, fresh.includes(h))).join('');
        $('#hlivesum').textContent = fresh.length ? t('The live map added {n} more.', { n: fresh.length }) : t('The live map has nothing new for this area.');
      } catch (e) { $('#hlivesum').textContent = t(e.message); } finally { b.disabled = false; }
    };
    $('#hloc').onclick = async () => { try { const p = await geolocate(); show(p, t('your location'), true); } catch (e) { $('#herr').textContent = t(e.message); } };
    $('#hf').onsubmit = async (e) => { e.preventDefault(); const q = new FormData(e.target).get('q'); const p = await lookupPlace(q);
      if (!p || p.la == null) { $('#herr').textContent = t('We could not find that ZIP code or town in North Carolina. Check the spelling and try again.'); return; } show(p, p.label); };
  } };
}

export const placeScreens = { counties, county, schools, fire, hotels };
