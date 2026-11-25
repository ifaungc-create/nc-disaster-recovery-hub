// Ask C4I for a ride (#ride, signed-in accounts). A request goes to C4I staff, who call or text the person
// and book the ride by hand with a ride company. Off until an administrator turns it on (Admin > Rides).
// The phone's position is read only when the person taps "Use my location", and only sent with the request.
import { ctx } from '../ctx.js';
import { api } from '../data/index.js';
import { RIDE_PURPOSES, RIDE_STATUS, RIDE_OPEN } from '../data/shared.js';
import { $, $$, esc, fmtDate, today } from '../ui.js';
import { t, locale } from '../i18n/index.js';
import { ridesOpen } from '../rides.js';
import { isNative } from '../native.js';
import { loadBinder } from './binder.js';

const statusBadge = (s) => `<span class="badge ${s === 'booked' || s === 'done' ? 'ok' : s === 'declined' || s === 'cancelled' ? 's-not_started' : 's-waiting'}">${esc(t(RIDE_STATUS[s] || s))}</span>`;
const whenText = (r) => (r.when === 'later' ? `${fmtDate(r.date)} ${r.time}` : t('As soon as possible'));
const where = (r) => (r.from || (r.gps ? t('My location') : ''));
export const rideItem = (x) => `<li data-ride="${esc(x.id)}"><p>${statusBadge(x.status)} <span class="small">${esc(t('sent {date}', { date: fmtDate(x.createdAt) }))}</span></p>
  <p><b>${t('From:')}</b> ${esc(where(x.ride))}<br><b>${t('To:')}</b> ${esc(x.ride.to)}<br><span class="small">${esc(whenText(x.ride))} · ${esc(t(RIDE_PURPOSES[x.ride.purpose] || ''))}</span></p>
  ${RIDE_OPEN.includes(x.status) ? `<button class="btn secondary small" type="button" data-cancelride="${esc(x.id)}">${t('Cancel this request')}</button>` : ''}</li>`;

// High-accuracy position for a pickup (the county finder uses a rough one).
const pickupPosition = () => new Promise((res, rej) => {
  if (!navigator.geolocation) return rej(new Error('This device cannot share its location. Enter a ZIP code or city instead.'));
  navigator.geolocation.getCurrentPosition((p) => res({ la: p.coords.latitude, lo: p.coords.longitude, acc: Math.round(p.coords.accuracy || 0) }),
    (e) => rej(new Error(e.code === 1 ? 'Location permission was not given. You can enter a ZIP code or city instead.' : 'Could not get your location. Enter a ZIP code or city instead.')), { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
});

async function ride() {
  const [open, mine] = await Promise.all([ridesOpen(true), api.myRides().catch(() => [])]);
  const list = mine.length ? `<h3>${t('My ride requests')}</h3><ul class="list" id="myrides">${mine.map(rideItem).join('')}</ul>` : '';
  const closed = `<div class="card" id="ridesoff"><p>${t('Ride requests to C4I are not open right now.')}</p>
    <p>${t('To get somewhere now, look for "Ride with Uber" on hotel, county office and fire department listings. You book and pay in the Uber app.')}</p>
    <p>${t('NC 211 can tell you about local transportation help, 24 hours a day.')}</p><a class="btn secondary" href="tel:211">${t('Call 211')}</a></div>`;
  if (!open) return { html: `<h2>${t('Ask C4I for a ride')}</h2>${closed}${list}`, bind: bindList };
  const phone = loadBinder().household.phone || '';
  const gpsOk = !isNative(); // the iPhone app's location message says the location stays on the phone, so it uses the typed address only
  return { html: `<h2>${t('Ask C4I for a ride')}</h2>
    <div class="note" id="ridenote"><p><b>${t('This is a request, not a booked ride.')}</b> ${t('C4I staff will call or text you to plan it. If you do not hear from us, the ride is not booked.')}</p><p>${t('In an emergency, call 911.')}</p></div>
    <form id="rf" class="card" novalidate>
      <label for="r_from">${t('Where should the driver pick you up?')}</label><p class="small" id="r_from_h" style="margin:0 0 4px">${t('Address, intersection or place name')}</p>
      <input id="r_from" maxlength="300" autocomplete="street-address" aria-describedby="r_from_h">
      ${gpsOk ? `<button class="btn secondary" type="button" id="r_gps">${t('Use my location')}</button><p class="small" id="r_gpsmsg" role="status" aria-live="polite"></p>` : ''}
      <label for="r_to">${t('Where do you need to go?')}</label><input id="r_to" maxlength="300">
      <label for="r_purpose">${t('What is the ride for?')}</label><select id="r_purpose">${Object.entries(RIDE_PURPOSES).map(([k, l]) => `<option value="${k}">${esc(t(l))}</option>`).join('')}</select>
      <fieldset><legend>${t('When?')}</legend><label class="opt"><input type="radio" name="r_when" value="now" checked> ${t('As soon as possible')}</label><label class="opt"><input type="radio" name="r_when" value="later"> ${t('Another day or time')}</label></fieldset>
      <div id="r_later" class="hide"><label for="r_date">${t('Day')}</label><input id="r_date" type="date" min="${today()}"><label for="r_time">${t('Time')}</label><input id="r_time" type="time"></div>
      <label for="r_riders">${t('How many people are riding?')}</label><select id="r_riders">${[1, 2, 3, 4, 5, 6].map((n) => `<option>${n}</option>`).join('')}</select>
      <label class="opt"><input type="checkbox" id="r_minors"><span>${t('Someone under 18 is riding')}</span></label>
      <label class="opt"><input type="checkbox" id="r_adult"><span>${t('An adult (18 or older) will ride for the whole trip.')}</span></label>
      <label for="r_phone">${t('Phone number C4I can call or text')}</label><input id="r_phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="40" value="${esc(phone)}">
      <label for="r_notes">${t('Anything the driver or C4I should know')} <span class="small">${t('(optional)')}</span></label><p class="small" id="r_notes_h" style="margin:0 0 4px">${t('For example: wheelchair, service animal, a lot of bags.')}</p><textarea id="r_notes" rows="3" maxlength="600" aria-describedby="r_notes_h"></textarea>
      <label class="opt consent"><input type="checkbox" id="r_consent"><span>${t('I agree that C4I staff may read this request, call or text me, and give my first name, phone number and these addresses to a ride company (such as Lyft or Uber) to book the ride. C4I deletes this request 30 days after I send it.')} <a href="#privacy" target="_blank">${t('Privacy')}</a></span></label>
      <p class="err" role="alert" id="rerr"></p>
      <button class="btn" type="submit">${t('Send my ride request')}</button>
    </form>${list}`,
  bind() {
    bindList();
    let gps = null;
    $$('input[name=r_when]').forEach((r) => (r.onchange = () => $('#r_later').classList.toggle('hide', r.value !== 'later' || !r.checked)));
    const g = $('#r_gps');
    if (g) g.onclick = async () => { const msg = $('#r_gpsmsg'); g.disabled = true; msg.textContent = t('Finding your location…');
      try { gps = await pickupPosition(); msg.textContent = t('Your location will be sent with this request (accurate to about {m} meters). Also type a street or place name if you can.', { m: gps.acc || '?' }); g.textContent = t('Update my location'); }
      catch (x) { gps = null; msg.textContent = t(x.message); } finally { g.disabled = false; } };
    $('#rf').onsubmit = async (e) => { e.preventDefault(); const err = $('#rerr'); err.textContent = '';
      const when = document.querySelector('input[name=r_when]:checked')?.value || 'now';
      const o = { from: $('#r_from').value, gps, to: $('#r_to').value, purpose: $('#r_purpose').value, when, date: $('#r_date').value, time: $('#r_time').value, riders: $('#r_riders').value,
        minors: $('#r_minors').checked, adult: $('#r_adult').checked, phone: $('#r_phone').value, notes: $('#r_notes').value, consent: $('#r_consent').checked };
      try { await api.rideRequest(o); ctx.flash = t('Your ride request was sent. C4I staff will call or text you.'); ctx.render(); }
      catch (x) { err.textContent = t(x.message); err.scrollIntoView({ block: 'center' }); } };
  } };
}
function bindList() {
  $$('[data-cancelride]').forEach((b) => (b.onclick = async () => { if (!confirm(t('Cancel this ride request?'))) return;
    try { await api.cancelRide(b.dataset.cancelride); ctx.flash = t('Your ride request was cancelled.'); ctx.render(); } catch (x) { ctx.flash = esc(t(x.message)); ctx.render(); } }));
}
export const whenLabel = (r) => (r.when === 'later' ? new Date(`${r.date}T${r.time}`).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' }) : t('As soon as possible'));
export const rideScreens = { ride };
