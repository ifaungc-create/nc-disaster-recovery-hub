// Resource guides, the free phone number page and the plain-language privacy page.
import { APP_NAME, APP_TAGLINE, DATA_DATE, DISCLAIMER, CONTACT_EMAIL } from '../config.js';
import { ADAPTER } from '../data/index.js';
import { sections, phoneInfo } from '../content/index.js';
import { t, isEs, pick } from '../i18n/index.js';
import { esc, tel, ext, verifyBadge, report, contactLine, srcNote } from '../ui.js';
import { sourceFor } from '../content/official-sources.js';
import { getCommunity, communityBlock } from '../community.js';
import { insurerDirectory } from '../insurers.js';
import { getLoc, loadData } from '../geo.js';
import { zillowRentalsUrl } from '../owner.js';
import { ownerForm, bindOwnerForm } from './owner.js';

// "Source: <agency> (official site)": the government agencies whose websites this item links to.
const govSources = (it) => [...new Set((it.links || []).map(([, u]) => sourceFor(u)).filter((x) => x && x.gov && x.url))];
const srcLine = (it) => { const g = govSources(it); if (!g.length) return '';
  const links = g.map((x) => ext(pick(x.name), x.url)).join(' ');
  return `<p class="small srcline">${g.length === 1 ? t('Source: {agency} (official site)', { agency: links }) : t('Sources: {agencies} (official sites)', { agencies: links })}</p>`; };
const item = (it, id = '') => `<div class="card${it.warn ? ' warn' : ''}"${id ? ` id="${id}"` : ''}><h3>${esc(it.title)}${it.verify ? ' ' + verifyBadge(it.verify) : ''}</h3>
  ${it.body ? `<p>${esc(it.body)}</p>` : ''}${it.steps ? `<ol class="steps">${it.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
  ${(it.phones || []).map(([l, n]) => tel(l, n)).join('')}${it.links ? `<div class="links">${it.links.map(([l, u]) => ext(l, u)).join('')}</div>` : ''}${srcLine(it)}
  ${it.verify ? `<p class="small">${t('Not verified')}: ${esc(it.verify)}</p>` : ''}${it.honest ? `<p class="small"><b>${t('Honest take:')}</b> ${esc(it.honest)}</p>` : ''}${(it.phones?.length || it.links?.length) ? report(it.title) : ''}</div>`;

// The All help screen: every guide and tool, grouped by need. The Home tiles open these same groups
// (#resources/g-money and so on), so each thing has one name and one place.
const GROUPS = () => { const S = Object.fromEntries(sections().map((x) => [x.id, [`resources/${x.id}`, x.title, x.short]]));
  return [
    { id: 'housing', title: t('Housing & shelter'), rows: [S.housing, ['hotels', t('Hotels nearby'), t('Directions and call')], ['owner-check', t('Check a rental listing'), t('See who the county says owns it')], S.relocating] },
    { id: 'food', title: t('Food &amp; home'), rows: [['cultural-food', t('Cultural food: pantries & stores'), t('Halal, kosher, Latino, Asian and more')], ['home-care', t('Home care after a fire or flood'), t('Clean, dry, stop mold, save food')]] },
    { id: 'money', title: t('Financial assistance &amp; jobs'), rows: [S.jobs, S.relief, ['phone', t('Get a phone number'), t('Free and low-cost options')]] },
    { id: 'documents', title: t('Documents &amp; insurance'), rows: [S.documents, S.insurance, S['fire-report']] },
    { id: 'legal', title: t('Legal &amp; scams'), rows: [S.legal, ['owner-check', t('Check a rental listing'), t('See who the county says owns it')], S.boardup] },
    { id: 'county', title: t('My county'), rows: [['counties', t('County services'), t('EM, DSS, health, Register of Deeds')], ['fire', t('Fire departments'), t('Find by county, ZIP or name')], ['schools', t('School districts'), t('All NC districts by county')], ['sources', t('Official sources'), t('Government resources by county and type of help')]] },
    { id: 'more', title: t('More help'), rows: [['translation', t('Translation apps & interpreters'), t('Other languages, free interpreters')], ['alerts', t('Alerts'), t('Recovery news for NC or your county')], ...(ADAPTER === 'remote' ? [['resources/community', t('Added by verified responders'), t('Checked by an administrator')]] : [])] },
  ]; };
// Section titles from the content files are plain text; t() titles carry &amp;. Both are safe to print as is after this.
const rowTitle = (x) => (/&amp;/.test(x) ? x : esc(x));
const groupList = (g) => `<ul class="list">${g.rows.filter(Boolean).map(([h, ti, d]) => `<li><a class="rowlink" href="#${h}"><span>${rowTitle(ti)}<br><span class="small">${rowTitle(d)}</span></span><span aria-hidden="true">›</span></a></li>`).join('')}</ul>`;
// Housing & shelter extras: quick jumps, Zillow rentals for the person's county and the owner check.
const housingJumps = () => `<div class="chips jumps" id="hjumps">${[['ri-housing-0', t('Tonight')], ['hrent', t('Find a rental')], ['hcheck', t('Check a listing')], ['ri-housing-1', t('FEMA')]].map(([id, l]) => `<button type="button" class="chip" data-jumpto="${id}">${l}</button>`).join('')}</div>`;
const rentalCard = (county) => `<div class="card" id="hrent"><h3>${t('More rental listings')}</h3>
  <p>${county ? t('Houses and apartments for rent in {name} County on Zillow.', { name: esc(county) }) : t('Houses and apartments for rent in North Carolina on Zillow. Choose your county to see listings near you.')}</p>
  <div class="links"><a href="${esc(zillowRentalsUrl(county))}" target="_blank" rel="noopener noreferrer" id="zillowlink">${county ? esc(t('Zillow rentals in {name} County', { name: county })) : t('Zillow rentals in North Carolina')} <span aria-hidden="true">↗</span><span class="sr"> ${t('(opens a new tab)')}</span></a>${county ? '' : `<a href="#counties">${t('Choose your county')}</a>`}</div>
  <p class="small">${t('Zillow is an outside business website, not a government agency, and is not affiliated with this app.')}</p></div>`;
const checkCard = (counties, county) => `<div class="card okc" id="hcheck"><h3>${t('Check a listing before you pay')}</h3>
  <p>${t('Found a place to rent on Facebook Marketplace or another website? See who the county says owns it before you pay.')}</p>${ownerForm(counties, { county, id: 'hc' })}</div>`;
// In Spanish, a short note: many official sites are only in English.
const esNote = () => (isEs() ? `<p class="small esnote">${t('Many official websites are only in English. Links marked "(en inglés)" open an English page. Names of agencies and programs are left in English so you can find them.')}</p>` : '');
async function resources(parts) {
  if (parts[0] === 'community') {
    const all = await getCommunity();
    return `<p><a href="#resources">‹ ${t('All help')}</a></p><h2>${t('Added by verified responders')}</h2><p>${t('Organizations, services and numbers sent in by approved responders and checked by an administrator.')}</p>
      ${communityBlock(all.filter((r) => r.county === 'Statewide'), t('Statewide'))}${communityBlock(all.filter((r) => r.county !== 'Statewide').sort((a, b) => a.county.localeCompare(b.county)), t('By county'))}${all.length ? '' : `<div class="card"><p>${t('Nothing has been added yet.')}</p></div>`}`;
  }
  const SECTIONS = sections(); const s = SECTIONS.find((x) => x.id === parts[0]);
  const gm = /^g-([a-z]+)$/.exec(parts[0] || ''); const grp = gm && GROUPS().find((g) => g.id === gm[1]);
  if (grp) return `<p><a href="#resources">‹ ${t('All help')}</a></p><h2>${grp.title}</h2>${esNote()}${groupList(grp)}`;
  if (!s) return `<h2>${t('All help')}</h2><p>${t('Verified North Carolina phone numbers, websites and step-by-step guides.')}</p>${esNote()}${srcNote()}
    ${GROUPS().map((g) => `<section class="hgroup" aria-labelledby="hg-${g.id}"><h3 id="hg-${g.id}">${g.title}</h3>${groupList(g)}</section>`).join('')}`;
  const added = (await getCommunity()).filter((r) => r.category === s.id);
  let dir = null;
  if (s.id === 'insurance') dir = await insurerDirectory().catch(() => ({ html: `<div class="card"><p class="err">${t('The insurance claim phone list could not be loaded. Check your connection and try again.')}</p></div>` }));
  const housing = s.id === 'housing'; const county = housing ? getLoc()?.county || '' : ''; const counties = housing ? await loadData('counties') : [];
  const cards = s.items.map((it, i) => item(it, `ri-${s.id}-${i}`) + (housing && i === 2 ? rentalCard(county) + checkCard(counties, county) : '')).join('');
  const html = `<p><a href="#resources">‹ ${t('All help')}</a></p><h2>${esc(s.title)}</h2><p>${esc(s.intro)}</p>${housing ? housingJumps() : ''}${esNote()}${srcNote()}${dir ? dir.html : ''}${cards}
    ${communityBlock(added, t('Added by verified responders'))}
    <p class="small srcnote">${t('Numbers and links checked {date}. Programs change: confirm details with the agency.', { date: esc(DATA_DATE) })} <a href="#sources">${t('Official sources')}</a></p>`;
  if (housing) return { html, bind() { bindOwnerForm('hc'); document.querySelectorAll('[data-jumpto]').forEach((b) => (b.onclick = () => { const el = document.getElementById(b.dataset.jumpto); if (el) { el.tabIndex = -1; el.scrollIntoView({ block: 'start' }); el.focus({ preventScroll: true }); } })); } };
  return dir?.bind ? { html, bind: dir.bind } : html;
}

const phone = () => { const PHONE = phoneInfo(); return `<h2>${t('Get a phone number')}</h2><p>${esc(PHONE.intro)}</p>${esNote()}${srcNote()}${PHONE.options.map(item).join('')}
  <div class="card"><h3>${t('Tips')}</h3><ol class="steps"><li>${t('Whatever number you get, give it to FEMA, your insurer and your caseworkers, and save it in My Notes.')}</li><li>${t('Many libraries, Disaster Recovery Centers and shelters have free Wi-Fi and phone charging.')}</li><li>${t('For a real emergency, call 911 from any phone. Any working mobile phone can call 911, even without service.')}</li></ol></div>
  ${PHONE.verify?.length ? `<p class="small">${PHONE.verify.map((v) => verifyBadge() + ' ' + esc(v)).join('<br>')}</p>` : ''}`; };

// The disclaimer text is shown exactly as approved; only the email address is turned into a mailto link.
const disclaimerHtml = () => esc(DISCLAIMER).replace(esc(CONTACT_EMAIL), `<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>`);
// In Spanish, the official English disclaimer stays (it is the approved wording) and a translation is shown above it.
const DISCLAIMER_ES = 'Ninguna de las organizaciones o agencias que aparecen en esta aplicación, ya sean gubernamentales o privadas, está afiliada a esta aplicación ni a C4I Veteran Services Corp. Esta aplicación es una plataforma de investigación y referidos para ayudarle a recuperarse de un desastre. Hemos hecho todo lo posible por confirmar toda la información y mantenerla al día, pero la información cambia. Avísenos si un número no funciona o un enlace no sirve: info@c4iveteranservices.org.';
const about = () => `<h2>${t('About &amp; disclaimer')}</h2>
  <p class="brandline">${esc(APP_NAME)} · ${esc(t(APP_TAGLINE))}</p>
  ${isEs() ? `<div class="card" id="disclaimer-es" lang="es"><h3>Aviso legal (traducción)</h3><p>${esc(DISCLAIMER_ES).replace(esc(CONTACT_EMAIL), `<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>`)}</p><p class="small">Esta es una traducción. El texto oficial en inglés está abajo.</p></div>` : ''}
  <div class="card" id="disclaimer" lang="en"><h3>${isEs() ? 'Disclaimer (official English text)' : 'Disclaimer'}</h3><p>${disclaimerHtml()}</p></div>
  <div class="card"><h3>${t('About this app')}</h3><p>${t('{app} helps people in North Carolina recover after fires, floods and hurricanes: phone numbers and websites for every county, fire departments, school districts, hotels, cultural food pantries and stores, home care guides, step-by-step guides, and a private place to keep case numbers and notes. It is free, has no ads and does not track you. It is available in English and Spanish.', { app: esc(APP_NAME) })}</p><p>${t('It is not a government service and does not replace 911. In an emergency, call 911.')}</p><p><a href="#sources" id="aboutsources">${t('Official sources: where the information in this app comes from')}</a></p></div>
  <div class="card" id="aboutcontact"><h3>${t('Contact')}</h3><p>${contactLine()}</p><p class="small">${t('Found a number that does not work or a broken link? Use "Report a broken link or number" under the listing, or email us.')}</p></div>
  <a class="btn secondary" href="#sources">${t('Official sources')}</a>
  <a class="btn secondary" href="#privacy">${t('Privacy, in plain language')}</a>
  <a class="btn secondary" href="#accessibility">${t('Accessibility')}</a>
  <a class="btn secondary" href="#delete-account">${t('Delete your account and data')}</a>`;

const privacy = () => `<h2>${t('Privacy, in plain language')}</h2>
  <p class="brandline">${esc(APP_NAME)} · ${esc(t(APP_TAGLINE))}</p>
  <div class="card"><h3>${t('The short version')}</h3><ol class="steps">
    <li>${t('Your notes, case numbers and referrals are private. Only you can see them.')}</li>
    <li>${t('We do not use ads, analytics, trackers or tracking cookies. We do not sell your information. We share it only if you ask C4I for a ride (see "Asking C4I for a ride" below).')}</li>
    <li>${t('Your location is used only when you tap a "Use my location" button.')}</li>
    <li>${t('You can download all your data or delete your account at any time in Settings.')} <a href="#delete-account">${t('How to delete your account')}</a></li></ol></div>
  <div class="card"><h3>${t('Where your information is kept')}</h3><p>${ADAPTER === 'local' ? t('In this prototype, your account and notes are stored only on this device, in this browser. They are not sent to any server. If you clear your browser data or lose the device, they are gone, so download a copy from Settings.') : t('Your account and notes are stored on our server (Netlify, in the United States), encrypted with a key that is unique to your account. Only you can read them through the app. Responders and agencies cannot see them, and we do not look at them. If you delete your account, everything is erased from our storage right away.')}</p><p>${t('Your password is never stored in readable form. We never store your IP address; to stop password-guessing we keep a short-lived, scrambled counter that cannot be turned back into your address.')}</p></div>
  <div class="card"><h3>${t('Location')}</h3><ol class="steps"><li>${t('<b>Finding your county:</b> your phone\'s position is matched to a county map that is part of the app, on your device. Only the county name and a rough position (about 100 m) are remembered on this device, so the app can show your county first. "Forget my location" in Settings erases it.')}</li>
    <li>${t('<b>Checking who owns a rental:</b> the street address and county you type go from your phone straight to the State of North Carolina\'s parcel records (NC OneMap) to find the owner. They are not sent to us and are not saved in the app. This is the only time the app contacts a server that is not its own.')}</li>
    <li>${t('<b>Hotel search:</b> runs on your phone against a list of North Carolina hotels and motels. Your location is not sent anywhere.')}</li>
    <li>${t('<b>Directions:</b> tapping "Directions" opens your maps app (Apple Maps, Google Maps or OpenStreetMap). That app has its own privacy policy.')}</li>
    <li>${t('<b>Ride with Uber:</b> tapping "Ride with Uber" opens the Uber app or website with the place you picked as the drop-off. We send Uber nothing. If you book, Uber sees your location and the trip under its own privacy policy. You book and pay in Uber; C4I does not pay for these rides.')}</li></ol></div>
  <div class="card" id="privbinder"><h3>${t('Recovery Binder')}</h3><p>${t('The binder is saved only on this phone or in this browser. It is never uploaded. The PDF is made on your phone. If you are signed in and choose to, the PDF also includes the case numbers and referrals from My Notes; they are read from your account and used only on your phone. Photos you pick on the website are used only to make the PDF and are not saved. You can erase the binder at the bottom of the binder screen.')}</p></div>
  <div class="card" id="privrides"><h3>${t('Asking C4I for a ride')}</h3><p>${t('Ride requests are off unless C4I has turned them on. If you send one, we store what you typed (pickup, drop-off, time, number of riders, phone number and notes), your name and account email, and your phone\'s location only if you tapped "Use my location". It is encrypted on our server and only C4I administrators can read it.')}</p><p>${t('To book the ride, C4I staff give your first name, phone number, pickup and drop-off to a ride company such as Lyft or Uber. That company\'s privacy policy then applies. We do not copy driver, car or trip details from the ride company into this app. Requests are deleted automatically 30 days after you send them, and right away if you delete your account. You can cancel an open request in the app.')}</p></div>
  <div class="card"><h3>${t('Responders and share cards')}</h3><p>${t('A responder can give you a card with their own contact information. You choose whether to save it. Saving it copies their information into your notes; it does not give the responder any access to your account or notes, and they are not told who saved it (they see only a count).')}</p><p>${ADAPTER === 'remote' ? t('Responder accounts are approved by an administrator before they can make share cards. Approval is not a background check: only trust a card from someone you met through an agency you know.') : t('Responder accounts are not verified in this on-device version. Only trust a card from someone you met through an agency you know.')}</p></div>
  <div class="card" id="privalerts"><h3>${t('Alerts (push notifications)')}</h3><p>${t('Alerts are off unless you turn them on in Settings &gt; Alerts. If you do, your browser gives us a push address for this device, and we store it with the topics you chose (statewide and/or counties) and your language. We do not store your name, email or location with it, and it is not linked to your account. Alerts are delivered through your browser\'s push service (for example Google, Apple, Mozilla or Microsoft). Turning alerts off deletes the push address from our storage. Addresses that stop working are deleted automatically.')}</p></div>
  <div class="card" id="privandroid"><h3>${t('Android app')}</h3><p>${t('The Android app from Google Play shows this same website inside a Chrome window, so everything on this page applies to it too. It does not collect anything extra. Notifications need your permission (Android 13 and later ask you).')}</p></div>
  <div class="card" id="privios"><h3>${t('iPhone app')}</h3><p>${t('The iPhone app from the App Store shows this same website, so everything on this page applies to it too. It adds a few features that work only on your phone:')}</p><ol class="steps">
    <li>${t('<b>Photos of damage and documents:</b> photos you take or choose are kept only inside the app on your phone. They are never uploaded to us. They leave your phone only if you share them yourself. The app asks for camera or photo access only when you tap to add a photo.')}</li>
    <li>${t('<b>Reminders and calendar:</b> follow-up reminders are scheduled on your phone. "Add to calendar" opens your phone\'s own calendar screen so you can save the event; the app does not read your calendar.')}</li>
    <li>${t('<b>Face ID lock:</b> if you turn it on, your iPhone checks your face or passcode. The app never sees your face data or passcode.')}</li>
    <li>${t('<b>Alerts:</b> if you turn them on, Apple gives us a push address (device token) for your phone. We store and delete it exactly as described under Alerts above.')}</li>
    <li>${t('<b>Widget and Siri:</b> the Home Screen widget and Siri shortcuts only open the app or call a phone number. They do not collect anything.')}</li></ol></div>
  <div class="card"><h3>${t('Cookies and storage')}</h3><p>${t('We do not set cookies. The app stores your sign-in on this device (until you close the app, unless you chose "keep me signed in"), your language choice, your saved county, and offline copies of the public resource lists.')} ${t('If you turned on alerts, it also keeps this device\'s push address so the alert settings can be updated.')}</p></div>
  <div class="card"><h3>${t('Links to other websites')}</h3><p>${t('Links to agencies and companies open their websites, which have their own privacy policies. {app} uses no third-party scripts, fonts or advertising inside the app. The one outside service it contacts is the state parcel record lookup described above, and only when you use it.', { app: esc(APP_NAME) })}</p></div>
  <div class="card"><h3>${t('Important')}</h3><p>${t('This app is not a government agency and is not an emergency service. In an emergency, call 911. The information here was collected {date} from official sources and may change.', { date: esc(DATA_DATE) })} <a href="#about">${t('Read the full disclaimer')}</a>.</p><p>${contactLine()}</p></div>`;

export const infoScreens = { resources, phone, privacy, about };
