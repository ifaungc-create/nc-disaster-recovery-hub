// Public pages: accessibility statement (#accessibility) and how to delete your account (#delete-account).
import { APP_NAME, CONTACT_EMAIL } from '../config.js';
import { t } from '../i18n/index.js';
import { esc, contactLine, ext } from '../ui.js';

export const A11Y_TESTED = '2026-10-24';
const mail = (subject) => `<a href="mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}">${CONTACT_EMAIL}</a>`;

const accessibility = () => ({ html: `<h2>${t('Accessibility')}</h2>
  <p>${t('{app} should be usable by everyone, including people who use a screen reader, a keyboard, voice control, large text or high contrast.', { app: esc(APP_NAME) })}</p>
  <div class="card"><h3>${t('Our goal')}</h3><p>${t('We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.1, level AA.')} ${ext(t('WCAG 2.1 (W3C)'), 'https://www.w3.org/TR/WCAG21/')}</p></div>
  <div class="card"><h3>${t('What we do')}</h3><ul>
    <li>${t('Every screen works with a keyboard, and the focus outline is always visible. A "Skip to content" link is the first thing on each page.')}</li>
    <li>${t('Pages use headings, landmarks and labels that screen readers can announce. Form errors are announced.')}</li>
    <li>${t('Text and buttons have strong color contrast. Buttons and links are large enough to tap (at least 48 by 48 pixels).')}</li>
    <li>${t('The app works with text enlarged to 200% and on small screens, and it reduces motion if your device asks for that.')}</li>
    <li>${t('The whole app is in English and Spanish, and each page tells your device which language it is in.')}</li>
    <li>${t('No time limits, no flashing content and no CAPTCHAs.')}</li></ul></div>
  <div class="card"><h3>${t('How we test')}</h3><p>${t('Every screen, in English and Spanish, is checked with automated tools (axe-core and Lighthouse) and with scripted keyboard tests (tab order, focus, the Escape key). Last checked {date}.', { date: A11Y_TESTED })}</p></div>
  <div class="card"><h3>${t('Known problems')}</h3><ul>
    <li>${t('Links to other websites (agencies, app stores, maps) open pages we do not control. Their accessibility may be different.')}</li>
    <li>${t('Pages opened in Google Translate are made by Google and may not work as well with screen readers.')}</li>
    <li>${t('Automated tools cannot find every problem. The app has not yet been tested by an outside accessibility expert or with every screen reader.')}</li></ul></div>
  <div class="card" id="a11ycontact"><h3>${t('Tell us about a problem')}</h3><p>${t('If something is hard to use, or you need information in another format, email {email}. Tell us the page and what happened. We will try to help you get the information another way.', { email: mail('Accessibility') })}</p></div>
  <a class="btn secondary" href="#about">${t('About &amp; disclaimer')}</a>` });

const deleteAccount = () => ({ html: `<h2>${t('Delete your account and data')}</h2>
  <p>${t('This page explains how to delete your {app} account and the data in it. It applies to the website and the Android app; they use the same account.', { app: esc(APP_NAME) })}</p>
  <div class="card"><h3>${t('Delete it in the app (fastest)')}</h3><ol class="steps">
    <li>${t('Sign in.')}</li><li>${t('Open <b>Settings</b> (bottom of the screen).')}</li>
    <li>${t('Optional: tap <b>Download my data</b> to keep a copy.')}</li>
    <li>${t('Under <b>Delete my account</b>, type DELETE in the box and tap <b>Delete my account</b>.')}</li></ol>
    <p>${t('Everything is erased from our storage right away.')}</p><a class="btn" href="#settings">${t('Go to Settings')}</a></div>
  <div class="card"><h3>${t('Can\'t sign in? Ask us by email')}</h3><p>${t('Email {email} from the email address you used for your account, with the subject "Delete my account". We will reply to confirm it is your account, delete it, and tell you when it is done (within 30 days at most).', { email: mail('Delete my account') })}</p></div>
  <div class="card"><h3>${t('What is deleted')}</h3><ul>
    <li>${t('Your account: name, email, password, account type and organization.')}</li>
    <li>${t('Your notes, case numbers and referrals.')}</li>
    <li>${t('For responders: your share cards (the codes stop working) and records you sent that were not yet approved.')}</li></ul></div>
  <div class="card"><h3>${t('What is kept')}</h3><ul>
    <li>${t('Resource records that an administrator already approved and published stay public, because they are public information. They do not show who sent them.')}</li>
    <li>${t('The administrators\' log keeps what an administrator did (for example "responder approved") and when. It has no notes or client information.')}</li>
    <li>${t('Anti-abuse counters are scrambled, are not linked to you, and are deleted automatically within a few hours.')}</li>
    <li>${t('Alerts are separate from your account. Turn them off on each device in <b>Settings &gt; Alerts</b>; that deletes the push address.')}</li></ul></div>
  <p>${contactLine()}</p>` });

export const legalScreens = { accessibility, 'delete-account': deleteAccount };
