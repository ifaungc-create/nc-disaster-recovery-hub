import './styles.css';
import { APP_NAME, APP_TAGLINE, APP_DESCRIPTION, DATA_DATE, CONTACT_EMAIL } from './config.js';
import { api, ADAPTER } from './data/index.js';
import { ROLES, RESPONDER_STATUS } from './data/shared.js';
import { auth } from './auth.js';
import { CRISIS } from './content/resources.js';
import { $, esc, download, today, contactLine } from './ui.js';
import { getLoc, clearLoc } from './geo.js';
import { t, getLang, setLang, langChosen, applyLang } from './i18n/index.js';
import { foodScreens } from './screens/food.js';
import { homeCareScreens } from './screens/homecare.js';
import { translationScreens } from './screens/translation.js';
import { alertScreens } from './screens/alerts.js';
import { legalScreens } from './screens/legal.js';
import { PUBLIC_PAGES, countyPage } from './paths.js';
import { notesScreens } from './screens/notes.js';
import { placeScreens } from './screens/places.js';
import { infoScreens } from './screens/info.js';
import { adminScreens, responderNotice } from './screens/admin.js';

const app = $('#app');
import { ctx } from './ctx.js';
import { routeFromPath } from './paths.js';
import { onTranslateProxy } from './proxy.js';
const PRIVATE = ['notes', 'share', 'submit', 'admin'];
const go = (r) => { if (location.hash === '#' + r) render(); else location.hash = r; };
ctx.go = go;

const MARK = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#fff"/><path d="M32 12 10 31h6v19h32V31h6z" fill="#12355B"/><path d="M32 46s-10-6.3-10-12.4A5.6 5.6 0 0 1 32 30a5.6 5.6 0 0 1 10 3.6C42 39.7 32 46 32 46z" fill="#fff"/></svg>';
const ico = { home: 'M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z', notes: 'M6 2h9l5 5v15H6zm8 1v5h5M9 12h8M9 16h8', help: 'M4 5h16v3H4zm0 5h16v3H4zm0 5h10v3H4z', county: 'M12 2a7 7 0 00-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z', me: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-8 9a8 8 0 0116 0z' };
const NAV = () => [['home', t('Home'), ico.home], ['notes', t('My Notes'), ico.notes], ['resources', t('Help'), ico.help], ['counties', t('County'), ico.county], ['settings', t('Settings'), ico.me]];
// Language switch, shown in the header of every screen. The other language is named in its own language.
const langSwitch = () => getLang() === 'es' ? '<button class="hbtn lang" id="langsw" data-lang="en" lang="en" aria-label="Switch to English">English</button>' : '<button class="hbtn lang" id="langsw" data-lang="es" lang="es" aria-label="Cambiar a español">Español</button>';
// First visit: choose a language. Both choices are written in their own language.
const langPicker = () => `<div class="langpick" id="langpick" role="dialog" aria-modal="true" aria-labelledby="lp_h"><div class="card"><h2 id="lp_h" lang="en">Choose your language</h2><p lang="es" class="muted">Elija su idioma</p><button class="btn" data-pick="en" lang="en">English</button><button class="btn" data-pick="es" lang="es">Español</button><p class="small" lang="en">You can change this any time with the button at the top of the screen.</p><p class="small" lang="es">Puede cambiarlo en cualquier momento con el botón en la parte de arriba de la pantalla.</p></div></div>`;
const crisisBar = () => `<nav class="crisis" aria-label="${t('Crisis and emergency numbers')}">${CRISIS.map((c) => `<a class="${c.cls || ''}" href="tel:${c.tel}"><b>${esc(t(c.top))}</b> ${esc(t(c.sub))}<span class="sr">. ${esc(t(c.aria))}</span></a>`).join('')}</nav>`;

function shell(route, inner) {
  const top = route.split('/')[0];
  const navTop = { case: 'notes', share: 'notes', claim: 'notes', county: 'counties', schools: 'counties', fire: 'home', hotels: 'home', 'cultural-food': 'home', 'home-care': 'home', translation: 'home', alerts: 'settings', accessibility: 'settings', 'delete-account': 'settings', phone: 'resources', privacy: 'settings', about: 'settings', login: 'settings', signup: 'settings', admin: 'settings', submit: 'home' }[top] || top;
  app.innerHTML = `
  <a class="skip" href="#main">${t('Skip to content')}</a>
  <header class="top"><h1 class="brandh"><a href="#home" class="brand">${MARK}<span>${esc(APP_NAME)}<small class="tagline">${esc(t(APP_TAGLINE))}</small></span></a></h1><span class="hbtns">${langSwitch()}${ctx.me ? `<a class="hbtn" href="#settings">${esc(ctx.me.name.split(' ')[0])}<span class="sr"> · ${t('Account and settings')}</span></a>` : `<a class="hbtn" href="#login">${t('Sign in')}</a>`}</span></header>
  ${crisisBar()}
  <main id="main" tabindex="-1">${ctx.flash ? `<div class="note" role="status">${ctx.flash}</div>` : ''}${inner}</main>
  <footer class="disc"><p><b>${esc(APP_NAME)}</b> · ${esc(t(APP_TAGLINE))}</p><p>${t('This app shares public information and keeps your notes private. It is not a government service and does not replace 911. Listed agencies and organizations are not affiliated with this app. Information collected {date}; always confirm with the agency.', { date: esc(DATA_DATE) })}</p><p id="footcontact">${contactLine()}</p><p><a href="#about">${t('About &amp; disclaimer')}</a> · <a href="#privacy">${t('Privacy')}</a> · <a href="#accessibility">${t('Accessibility')}</a> · <a href="#delete-account">${t('Delete your account')}</a></p></footer>
  <nav class="bottom" aria-label="${t('Main')}">${NAV().map(([id, l, d]) => `<a href="#${id}" ${navTop === id ? 'aria-current="page"' : ''}><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${d}"/></svg>${l}</a>`).join('')}</nav>`;
  ctx.flash = '';
  $('#langsw').onclick = (e) => { setLang(e.currentTarget.dataset.lang); render(); };
  // Skip link: move focus to the main content without changing the route (the app uses # routes).
  $('.skip').onclick = (e) => { e.preventDefault(); const m = $('#main'); m.focus(); m.scrollIntoView(); };
  if (!langChosen()) {
    app.insertAdjacentHTML('beforeend', langPicker());
    // Modal dialog: the page behind is inert, Tab stays inside, Escape keeps the current language.
    [...app.children].forEach((el) => { if (el.id !== 'langpick') el.inert = true; });
    const picks = [...document.querySelectorAll('#langpick [data-pick]')]; picks[0].focus();
    const choose = (l) => { setLang(l); [...app.children].forEach((el) => (el.inert = false)); render(); };
    picks.forEach((b) => (b.onclick = () => choose(b.dataset.pick)));
    $('#langpick').addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); choose(getLang()); }
      else if (e.key === 'Tab') { e.preventDefault(); const i = picks.indexOf(document.activeElement); picks[(i + (e.shiftKey ? -1 : 1) + picks.length) % picks.length].focus(); }
    });
  }
}
function focusTitle() { const h = $('main h2'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } window.scrollTo(0, 0); }

const screens = { ...notesScreens, ...placeScreens, ...infoScreens, ...adminScreens, ...foodScreens, ...homeCareScreens, ...translationScreens, ...alertScreens, ...legalScreens };

screens.home = () => {
  const loc = getLoc(); const me = ctx.me;
  const tile = (href, b, s, cls = '') => `<a class="tile${cls}" href="#${href}"><b>${b}</b><span>${s}</span></a>`;
  return { html: `
    <h2>${me ? t('Hi, {name}', { name: esc(me.name.split(' ')[0]) }) : t('Help after a disaster in North Carolina')}</h2>
    ${me ? `<p class="muted">${esc(t(ROLES[me.role]))}${me.org ? ' · ' + esc(me.org) : ''}</p>` : `<p>${t('Find shelter, phone numbers for your county, free legal help and step-by-step guides. Keep your case numbers and notes in one private place.')}</p>`}
    <div class="card loc"><div>${loc?.county ? `<b>${t('Your county: {county}', { county: esc(loc.county) })}</b><br><span class="small">${t('Saved on this device only')}</span>` : `<b>${t('Find your county')}</b><br><span class="small">${t("Shows your county's offices and nearby fire departments first.")}</span>`}</div>${loc?.county ? `<a class="btn small" href="#county/${encodeURIComponent(loc.county)}">${t('Open')}</a>` : `<a class="btn small" href="#counties">${t('Choose')}</a>`}</div>
    <div class="tiles">
      ${me ? tile('notes/cases', t('My case numbers'), t('FEMA, Red Cross, insurance…')) : tile('signup', t('Create a free account'), t('Private notes & case numbers'))}
      ${tile('notes/referrals', t('Referrals'), t('Track who you were sent to'))}
      ${tile('resources/housing', t('Housing & shelter'), t('Tonight and long-term'))}
      ${tile('hotels', t('Hotels nearby'), t('Directions and call'))}
      ${tile('cultural-food', t('Cultural food: pantries & stores'), t('Halal, kosher, Latino, Asian and more'), ' new')}
      ${tile('home-care', t('Home care after a fire or flood'), t('Clean, dry, stop mold, save food'), ' new')}
      ${tile('translation', t('Translation apps & interpreters'), t('Other languages, free interpreters'), ' new')}
      ${tile('alerts', t('Alerts'), t('Recovery news for NC or your county'), ' new')}
      ${tile('fire', t('Fire departments'), t('Search by county, ZIP, name'))}
      ${tile('resources/documents', t('Replace documents'), t('License, SSN card, birth cert.'))}
      ${tile('resources/insurance', t('Insurance'), t('Claims & NCDOI help line'))}
      ${tile('resources/legal', t('Free legal help'), t('Legal Aid NC hotline'))}
      ${tile('phone', t('Get a phone number'), t('Free options'))}
      ${tile('resources', t('All resources'), t('Jobs, relocating, relief'))}
    </div>
    ${responderNotice(me)}
    ${me?.isAdmin ? `<a class="btn" href="#admin" id="adminlink">${t('Admin: review responders and records')}</a>` : ''}
    ${me?.role === 'responder' && me.responderStatus === 'approved' ? `<a class="btn" href="#share">${t('Create a share card for a client')}</a>${ADAPTER === 'remote' ? `<a class="btn secondary" href="#submit">${t('Add a resource to the lists')}</a>` : ''}` : me?.role === 'responder' ? '' : `<a class="btn secondary" href="#claim">${t('Got a code from a responder? Enter it')}</a>`}
    <div class="card" id="homedisc"><p class="small">${t('<b>Please note:</b> the agencies and organizations listed here are not affiliated with this app or with C4I Veteran Services Corp. This is a research and referral tool; information changes, so confirm before you go.')} <a href="#about">${t('Full disclaimer')}</a></p></div>
    <div class="card warn"><h3>${t('Someone at the door offering to board up or clean?')}</h3><p>${t('Talk to your insurance company before you sign anything.')} <a href="#resources/boardup">${t('What to know')}</a></p></div>` };
};

const proxyNote = (route) => (onTranslateProxy() ? `<div class="card warn" id="proxynote"><p>${t('You are viewing this page through Google Translate. Signing in and accounts only work on the app itself.')}</p><a class="btn" href="https://disaster-resources.app/#${route}" target="_top" rel="noopener">${t('Open the app to sign in')}</a></div>` : '');
screens.login = () => ({ html: `
  <h2>${t('Sign in')}</h2>
  ${proxyNote('login')}
  <p class="brandline">${esc(APP_NAME)} · ${esc(t(APP_TAGLINE))}</p>
  <form id="f" class="card" novalidate>
    <label for="le">${t('Email')}</label><input id="le" name="email" type="email" autocomplete="email" required>
    <label for="lp">${t('Password')}</label><input id="lp" name="password" type="password" autocomplete="current-password" required>
    <label class="opt"><input type="checkbox" name="keep"><span>${t('Keep me signed in on this device')} <span class="small">${t('(only on your own phone)')}</span></span></label>
    <p class="err" role="alert" id="err"></p>
    <button class="btn" type="submit">${t('Sign in')}</button>
  </form>
  ${ADAPTER === 'remote' ? `<p><a href="#reset" id="forgot">${t('Forgot your password? Reset it with a code')}</a></p>` : ''}
  <a class="btn secondary" href="#signup">${t('Create a free account')}</a>
  ${ADAPTER === 'local' ? `<p class="small">${t('Prototype: accounts are stored only on this device.')}</p>` : ''}`,
  bind() {
    $('#f').onsubmit = async (e) => { e.preventDefault(); const d = new FormData(e.target);
      try { ctx.me = await auth.logIn(d.get('email'), d.get('password'), d.get('keep') === 'on'); afterAuth(); } catch (x) { $('#err').textContent = t(x.message); } };
  } });

screens.signup = () => ({ html: `
  <h2>${t('Create a free account')}</h2>
  ${proxyNote('signup')}
  <p class="brandline">${esc(APP_NAME)} · ${esc(t(APP_TAGLINE))}</p>
  <p>${t('Your account opens right away. Your notes are private: only you can see them.')}</p>
  <form id="f" class="card" novalidate>
    <fieldset style="border:0;padding:0;margin:0"><legend><b>${t('How are you using this app?')}</b></legend>
      <div class="choice">
        <label><input type="radio" name="role" value="affected" checked><span><b>${t(ROLES.affected)}</b><br><span class="small">${t('Keep case numbers, notes and referrals in one private place.')}</span></span></label>
        <label><input type="radio" name="role" value="responder"><span><b>${t(ROLES.responder)}</b><br><span class="small">${t('Caseworkers, volunteers and agency staff. Create share cards with your contact info for clients.')}</span></span></label>
      </div></fieldset>
    <div id="orgWrap" class="hide"><label for="so">${t('Organization (optional)')}</label><input id="so" name="org" autocomplete="organization"><p class="small">${ADAPTER === 'remote' ? t('An administrator reviews each responder account. You can use the app right away; share cards and adding resources open once you are approved.') : t('Responder accounts are not verified in on-device mode.')} ${t('Clients see the name you enter on your share cards.')}</p></div>
    <label for="sn">${t('Your name')} <span class="small">${t('(a first name is fine)')}</span></label><input id="sn" name="name" autocomplete="given-name" required>
    <label for="se">${t('Email')}</label><input id="se" name="email" type="email" autocomplete="email" required>
    <label for="sp">${t('Password')} <span class="small">${t('(8 or more characters)')}</span></label><input id="sp" name="password" type="password" autocomplete="new-password" minlength="8" required>
    <label class="opt"><input type="checkbox" name="terms"><span>${t('I read the <a href="#privacy" target="_blank">privacy notice</a> and the <a href="#about" target="_blank" id="signupdisc">disclaimer</a>. My notes stay private unless I choose to share them.')}</span></label>
    <label class="opt"><input type="checkbox" name="keep"><span>${t('Keep me signed in on this device')}</span></label>
    <p class="err" role="alert" id="err"></p>
    <button class="btn" type="submit">${t('Create account')}</button>
  </form>
  <a class="btn secondary" href="#login">${t('I already have an account')}</a>`,
  bind() {
    const f = $('#f'); f.role.forEach((r) => (r.onchange = () => $('#orgWrap').classList.toggle('hide', f.role.value !== 'responder')));
    f.onsubmit = async (e) => { e.preventDefault(); const d = new FormData(f);
      try { ctx.me = await auth.signUp({ role: d.get('role'), name: d.get('name'), email: d.get('email'), password: d.get('password'), org: d.get('org') || '', termsAccepted: d.get('terms') === 'on' }, d.get('keep') === 'on'); ctx.flash = ctx.me.role === 'responder' && ctx.me.responderStatus === 'pending' ? t('Your account is ready. Your responder request was sent; an administrator will review it.') : t('Your account is ready.'); afterAuth(); } catch (x) { $('#err').textContent = t(x.message); } };
  } });

// Password reset with a one-time code. There is no email service: an administrator gives the code
// (by phone or in person). Administrators can write a recovery code to the site's server log instead.
screens.reset = () => ({ html: `
  <h2>${t('Reset your password')}</h2>
  ${proxyNote('reset')}
  <p>${t('This app does not send emails. To reset your password, contact the administrator (see "Problems with the app?" in Settings). After checking who you are, they give you a one-time code by phone or in person. The code works once and expires in 2 hours.')}</p>
  <form id="rf" class="card" novalidate>
    <label for="re">${t('Email')}</label><input id="re" name="email" type="email" autocomplete="username" required>
    <label for="rc">${t('One-time code')}</label><input id="rc" name="code" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" required>
    <label for="rp">${t('New password')} <span class="small">${t('(8 or more characters)')}</span></label><input id="rp" name="password" type="password" autocomplete="new-password" minlength="8" required>
    <p class="err" role="alert" id="rerr"></p>
    <button class="btn" type="submit">${t('Set new password')}</button>
  </form>
  <details class="card" id="adminrec"><summary>${t('Administrators: get a recovery code')}</summary>
    <p class="small">${t('For administrator accounts only. The code is not shown here and is not emailed: it is written to the site\'s server log, which only the people who run the site can read. The code works once and expires in 30 minutes. Using it also confirms admin access.')}</p>
    <form id="af" novalidate><label for="ae">${t('Administrator email')}</label><input id="ae" type="email" autocomplete="username" required>
    <p class="small" id="amsg" role="status" aria-live="polite"></p><button class="btn secondary" type="submit">${t('Write a recovery code to the server log')}</button></form>
  </details>
  <a class="btn secondary" href="#login">${t('Back to sign in')}</a>`,
  bind() {
    $('#rf').onsubmit = async (e) => { e.preventDefault(); const d = new FormData(e.target); $('#rerr').textContent = '';
      if (!String(d.get('code') || '').trim()) { $('#rerr').textContent = t('Enter the one-time code.'); $('#rc').focus(); return; }
      try { await api.resetPassword(String(d.get('email')).trim(), d.get('code'), d.get('password')); ctx.flash = t('Your password was changed. Sign in with your new password.'); go('login'); } catch (x) { $('#rerr').textContent = t(x.message); } };
    $('#af').onsubmit = async (e) => { e.preventDefault(); $('#amsg').textContent = '';
      try { await api.requestAdminCode($('#ae').value.trim()); $('#amsg').textContent = t('Done. If this is an administrator account, a recovery code is now in the server log (Netlify: Logs, Functions, api). Enter it above with a new password.'); } catch (x) { $('#amsg').textContent = t(x.message); } };
  } });

function afterAuth() { const p = sessionStorage.getItem('ncdrh.after'); sessionStorage.removeItem('ncdrh.after'); go(p || 'home'); }

screens.settings = () => {
  const me = ctx.me, loc = getLoc();
  return { html: `
    <h2>${t('Settings')}</h2>
    <div class="card" id="langcard"><h3>${t('Language')}</h3><p>${t('Choose the language for the app. Your choice is saved on this device only.')}</p>
      <div class="actions"><button class="btn ${getLang() === 'en' ? '' : 'secondary'}" data-setlang="en" lang="en" aria-pressed="${getLang() === 'en'}">English</button><button class="btn ${getLang() === 'es' ? '' : 'secondary'}" data-setlang="es" lang="es" aria-pressed="${getLang() === 'es'}">Español</button></div></div>
    ${me ? `<div class="card"><h3>${t('Your account')}</h3><dl class="kv"><dt>${t('Name')}</dt><dd>${esc(me.name)}</dd><dt>${t('Email')}</dt><dd>${esc(me.email)}</dd><dt>${t('Account type')}</dt><dd>${esc(t(ROLES[me.role]))}${me.isAdmin ? ' · ' + t('Administrator') : ''}</dd>${me.role === 'responder' && ADAPTER === 'remote' ? `<dt>${t('Responder status')}</dt><dd>${esc(t(RESPONDER_STATUS[me.responderStatus] || ''))}</dd>` : ''}${me.org ? `<dt>${t('Organization')}</dt><dd>${esc(me.org)}</dd>` : ''}</dl>
      ${me.isAdmin ? `<a class="btn" href="#admin">${t('Admin area')}</a>` : ''}<button class="btn secondary" id="logout">${t('Sign out')}</button></div>
      ${me.adminPending ? `<div class="card warn" id="claimcard"><h3>${t('Confirm admin access')}</h3><p>${t('This email is on the administrator list, but admin access stays off until you prove the account is yours with a one-time code. Get the code from the site\'s server log (only the people who run the site can read it) or from another administrator.')}</p>
        <button class="btn secondary" type="button" id="claimstart">${t('Write a code to the server log')}</button><p class="small" id="claimmsg" role="status" aria-live="polite"></p>
        <form id="claimf" novalidate><label for="claimcode">${t('One-time code')}</label><input id="claimcode" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false"><p class="err" role="alert" id="claimerr"></p><button class="btn" type="submit">${t('Confirm admin access')}</button></form></div>` : ''}
      <div class="card"><h3>${t('Download my data')}</h3><p>${t('Save a copy of everything in your account (case numbers, notes, referrals) as a file.')}</p><button class="btn secondary" id="export">${t('Download my data (JSON)')}</button></div>
      <div class="card"><h3>${t('Delete my account')}</h3><p>${me.role === 'responder' ? t('Permanently deletes your account, notes, case numbers, referrals and share cards. This cannot be undone. Download your data first if you want a copy.') : t('Permanently deletes your account, notes, case numbers and referrals. This cannot be undone. Download your data first if you want a copy.')}</p>
      <label for="dc">${t('Type DELETE to confirm')}</label><input id="dc" autocomplete="off"><p class="err" id="derr" role="alert"></p><button class="btn danger" id="del">${t('Delete my account')}</button></div>`
    : `<div class="card"><p>${t('You are not signed in.')}</p><a class="btn" href="#login">${t('Sign in')}</a><a class="btn secondary" href="#signup">${t('Create a free account')}</a></div>`}
    <div class="card" id="alertscard"><h3>${t('Alerts')}</h3><p>${t('Get notifications about disaster recovery news for North Carolina or your county. Off until you turn them on.')}</p><a class="btn secondary" href="#alerts">${t('Choose alerts')}</a></div>
    <div class="card"><h3>${t('Location')}</h3><p>${loc?.county ? (loc.la != null ? t('Saved on this device: <b>{county} County</b> and an approximate position (about 100 m). It is never sent to our server.', { county: esc(loc.county) }) : t('Saved on this device: <b>{county} County</b>. It is never sent to our server.', { county: esc(loc.county) })) : t('No location is saved.')}</p>${loc ? `<button class="btn secondary" id="clearloc">${t('Forget my location')}</button>` : ''}</div>
    <div class="card" id="settingscontact"><h3>${t('Problems with the app?')}</h3><p>${contactLine()}</p><p class="small">${t('To report a broken link or wrong phone number, use the "Report a broken link or number" link under the listing.')}</p></div>
    <a class="btn secondary" href="#about">${t('About &amp; disclaimer')}</a>
    <a class="btn secondary" href="#privacy">${t('Privacy: how your information is handled')}</a>
    <p class="small">${ADAPTER === 'local' ? t('Data storage: this device only (prototype).') : t('Data storage: server.')}</p>`,
  bind() {
    document.querySelectorAll('[data-setlang]').forEach((b) => (b.onclick = () => { setLang(b.dataset.setlang); render(); }));
    $('#clearloc') && ($('#clearloc').onclick = () => { clearLoc(); ctx.flash = t('Location forgotten.'); render(); });
    if (!me) return;
    $('#logout').onclick = () => { auth.logOut(); ctx.me = null; ctx.flash = t('You are signed out.'); go('home'); };
    $('#claimstart') && ($('#claimstart').onclick = async () => { $('#claimmsg').textContent = '';
      try { await api.adminClaimStart(); $('#claimmsg').textContent = t('A code was written to the server log (Netlify: Logs, Functions, api). It works once and expires in 30 minutes.'); } catch (x) { $('#claimmsg').textContent = t(x.message); } });
    $('#claimf') && ($('#claimf').onsubmit = async (e) => { e.preventDefault(); $('#claimerr').textContent = '';
      try { ctx.me = await api.adminClaimFinish($('#claimcode').value); ctx.flash = t('Admin access is confirmed for this account.'); render(); } catch (x) { $('#claimerr').textContent = t(x.message); } });
    $('#export').onclick = async () => download(`my-recovery-data-${today()}.json`, JSON.stringify(await api.exportData(me.id), null, 2));
    $('#del').onclick = async () => {
      if ($('#dc').value.trim().toUpperCase() !== 'DELETE') { $('#derr').textContent = t('Type DELETE in the box to confirm.'); return; }
      await api.deleteAccount(me.id);
      try { const { unsubscribe } = await import('./push.js'); await unsubscribe(); } catch {} // this device's alerts (not linked to the account) are turned off too
      auth.logOut(); ctx.me = null; ctx.flash = t('Your account and all its data were deleted.'); go('home');
    };
  } };
};

// Real paths give lower-case county names (/county/new-hanover -> 'new hanover'); restore the official spelling.
const properCounty = (n) => n.replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/^Mcdowell$/, 'McDowell');
// Page title and description follow the route and language (the static per-path HTML has the English ones).
function setMeta(route) {
  const cm = /^county\/([^/]+)$/.exec(route || '');
  const pg = PUBLIC_PAGES.find((x) => x.route === route) || (cm ? countyPage(properCounty(decodeURIComponent(cm[1]))) : null);
  const v = pg ? (getLang() === 'es' && pg.es ? pg.es : pg) : null;
  document.title = v ? `${v.title} · ${APP_NAME}` : APP_NAME;
  const d = document.querySelector('meta[name=description]'); if (d) d.setAttribute('content', v ? v.desc : t(APP_DESCRIPTION));
}

async function render() {
  // Hash routes (#hotels) win; real paths (/hotels, /county/wake) are crawlable aliases for public screens.
  const route = decodeURIComponent(location.hash.slice(1)) || routeFromPath(location.pathname) || 'home';
  const [name, ...rest] = route.split('/');
  if (PRIVATE.includes(name) && !ctx.me) { sessionStorage.setItem('ncdrh.after', route); ctx.flash = t('Please sign in or create a free account to use your private notes.'); return go('login'); }
  if ((name === 'login' || name === 'signup') && ctx.me) return go('home');
  // A waiting responder may have been approved since sign-in: re-check on the screens that depend on it.
  if (ADAPTER === 'remote' && ctx.me?.role === 'responder' && ctx.me.responderStatus !== 'approved' && ['home', 'share', 'submit'].includes(name)) { try { ctx.me = (await api.getUser(ctx.me.id)) || ctx.me; } catch {} }
  const fn = screens[name] || screens.home;
  let out;
  try { out = await fn(rest, route); } catch (e) { out = { html: `<h2>${t('Something went wrong')}</h2><p>${esc(t(e.message))}</p><a class="btn" href="#home">${t('Go home')}</a>` }; }
  if (typeof out === 'string') out = { html: out };
  applyLang(); shell(route, out.html); if (langChosen()) focusTitle(); out.bind?.(); setMeta(route);
}
ctx.render = render;

window.addEventListener('hashchange', render);
// In the Google Translate copy, keep in-app links inside the translation: Google's proxy sets
// <base href="https://disaster-resources.app/...">, so a plain "#route" link would open the untranslated site.
if (onTranslateProxy()) document.addEventListener('click', (e) => {
  const a = e.target.closest?.('a[href]'); const h = a && a.getAttribute('href');
  if (e.defaultPrevented || !h || h[0] !== '#' || h.length < 2 || a.target) return;
  e.preventDefault(); location.hash = h.slice(1);
});
(async () => {
  applyLang();
  ctx.me = await auth.currentUser();
  render();
  if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((r) => r.update()).catch(() => {});
})();
