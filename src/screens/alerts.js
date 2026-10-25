// #alerts: opt-in emergency and recovery alerts (Web Push). Statewide and/or by county. Off by default.
import { ctx } from '../ctx.js';
import { NC_COUNTIES } from '../data/shared.js';
import { $, $$, esc } from '../ui.js';
import { getLoc } from '../geo.js';
import { t, getLang } from '../i18n/index.js';
import { pushSupported, isIOS, isStandalone, permission, subscribe, status, unsubscribe } from '../push.js';

const MAX = 10;
async function alerts() {
  const head = `<h2>${t('Alerts')}</h2><p>${t('Get a notification on this phone or computer when there is important disaster recovery news for North Carolina or your county. Alerts are off until you turn them on.')}</p>
    <div class="card warn"><p><b>${t('This is not an emergency alert system.')}</b> ${t('For warnings about weather and danger, keep the Wireless Emergency Alerts on your phone turned on and follow your county emergency management. Call 911 in an emergency.')}</p></div>`;
  if (!pushSupported()) {
    const ios = isIOS() && !isStandalone();
    return { html: `${head}<div class="card" id="pushnot"><h3>${t('Alerts are not available here')}</h3>${ios ? `<p>${t('On iPhone and iPad (iOS 16.4 or later), alerts work only after you add this app to your Home Screen:')}</p><ol class="steps"><li>${t('In Safari, tap the Share button.')}</li><li>${t('Tap <b>Add to Home Screen</b>, then <b>Add</b>.')}</li><li>${t('Open the app from your Home Screen and come back to this page.')}</li></ol>` : `<p>${t('This browser cannot receive alerts. Try a current version of Chrome, Edge, Firefox or Safari.')}</p>`}</div>` };
  }
  const st = await status(); const perm = permission();
  const topics = new Set(st?.topics || ['statewide']);
  const loc = getLoc(); if (!st && loc?.county && NC_COUNTIES.includes(loc.county)) topics.add('county:' + loc.county);
  const counties = () => [...topics].filter((x) => x.startsWith('county:')).map((x) => x.slice(7));
  const chips = () => counties().length ? `<ul class="chips" id="pcounties">${counties().map((c) => `<li>${esc(t('{county} County', { county: c }))} <button type="button" class="chipx" data-rm="${esc(c)}" aria-label="${esc(t('Remove {county} County', { county: c }))}">×</button></li>`).join('')}</ul>` : `<p class="small" id="pcounties">${t('No counties chosen.')}</p>`;
  return { html: `${head}
    <form class="card" id="pf" novalidate><h3>${st ? t('Alerts are on for this device') : t('Choose your alerts')}</h3>
      <fieldset><legend>${t('What do you want alerts about?')}</legend>
        <label class="opt"><input type="checkbox" id="pstate" ${topics.has('statewide') ? 'checked' : ''}><span>${t('Statewide news for North Carolina')}</span></label>
        <label for="pcounty">${t('Add a county (up to {n})', { n: MAX })}</label>
        <div class="row"><select id="pcounty"><option value="">${t('Choose…')}</option>${NC_COUNTIES.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select><button type="button" class="btn secondary" id="padd">${t('Add county')}</button></div>
        <div id="pchips">${chips()}</div>
      </fieldset>
      <p class="small">${t('Alerts come in the language you are using now ({lang}) when a Spanish version is sent; otherwise in English.', { lang: getLang() === 'es' ? 'español' : 'English' })}</p>
      <p class="err" id="perr" role="alert"></p><p class="small" id="pmsg" role="status" aria-live="polite"></p>
      ${perm === 'denied' ? `<p class="note" id="pdenied">${t('Notifications are blocked for this app. To allow them, open your browser or phone settings, find this app or site, and allow notifications. Then come back here.')}</p>` : ''}
      <button class="btn" type="submit" id="pon">${st ? t('Save my alert choices') : t('Turn on alerts')}</button>
      ${st ? `<button class="btn danger" type="button" id="poff">${t('Turn off alerts')}</button>` : ''}
    </form>
    <div class="card"><h3>${t('Your privacy')}</h3><ul><li>${t('We store only the push address your browser gives us, the topics you chose and your language. No name, email or location.')}</li><li>${t('Alerts are not linked to your account, even if you are signed in.')}</li><li>${t('You can turn alerts off here at any time; we then delete the push address.')}</li><li>${t('Alerts are delivered by your browser\'s push service (for example Google, Apple, Mozilla or Microsoft).')}</li></ul><a href="#privacy">${t('Privacy: how your information is handled')}</a></div>`,
  bind() {
    const err = $('#perr'), msg = $('#pmsg');
    const redraw = () => { $('#pchips').innerHTML = chips(); bindChips(); };
    const bindChips = () => $$('[data-rm]').forEach((b) => (b.onclick = () => { topics.delete('county:' + b.dataset.rm); redraw(); msg.textContent = t('{county} County removed. Save to keep this change.', { county: b.dataset.rm }); ($('#pcounty')).focus(); }));
    bindChips();
    $('#padd').onclick = () => { const c = $('#pcounty').value; err.textContent = '';
      if (!c) { err.textContent = t('Choose a county first.'); $('#pcounty').focus(); return; }
      if (counties().length >= MAX && !topics.has('county:' + c)) { err.textContent = t('You can choose up to {n} counties.', { n: MAX }); return; }
      topics.add('county:' + c); redraw(); msg.textContent = t('{county} County added.', { county: c }); };
    $('#pstate').onchange = (e) => (e.target.checked ? topics.add('statewide') : topics.delete('statewide'));
    $('#pf').onsubmit = async (e) => { e.preventDefault(); err.textContent = ''; msg.textContent = '';
      if (!topics.size) { err.textContent = t('Choose statewide news or at least one county.'); $('#pstate').focus(); return; }
      const b = $('#pon'); b.disabled = true; msg.textContent = t('Working…');
      try { await subscribe([...topics], getLang()); ctx.flash = t('Alerts are on. You can change or turn them off here any time.'); ctx.render(); }
      catch (x) { msg.textContent = ''; err.textContent = x.denied ? t('Notifications were not allowed. To get alerts, allow notifications for this app in your browser or phone settings.') : t(x.message || 'Something went wrong. Please try again.'); b.disabled = false; } };
    $('#poff') && ($('#poff').onclick = async () => { err.textContent = '';
      try { await unsubscribe(); ctx.flash = t('Alerts are off. We deleted this device\'s push address.'); ctx.render(); } catch (x) { err.textContent = t(x.message || 'Something went wrong. Please try again.'); } });
  } };
}
export const alertScreens = { alerts };
