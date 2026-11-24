// "I'm overwhelmed": a calm screen with only three general next steps, for any kind of disaster.
// Public (no account). Nothing is saved or sent.
import { t } from '../i18n/index.js';

const HEART = '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21c-4.5-3-8-6.2-8-10.2A4.8 4.8 0 0 1 12 7.5a4.8 4.8 0 0 1 8 3.3C20 14.8 16.5 18 12 21z"/><path d="M8.5 12.5h7"/></svg>';

// The button on the home screen.
export const calmButton = () => `<a class="calmbtn" href="#calm" id="calmbtn">${HEART}<span><b>${t("I'm overwhelmed")}</b><span>${t('Show me only the next 3 things to do.')}</span></span></a>`;

const step = (n, title, sub, action) => `<li class="calmstep"><span class="calmnum" aria-hidden="true">${n}</span><div><h3>${title}</h3><p>${sub}</p>${action}</div></li>`;

const calm = () => ({ html: `<div class="calm" id="calm">
  <h2>${t('Take a breath.')}</h2>
  <p class="calmlead">${t('Here are just three things for now. Everything else can wait.')}</p>
  <ol class="calmsteps">
    ${step(1, t('Make sure everyone is safe.'), t('If anyone is hurt or in danger, call 911 now.'), `<a class="btn crisis" href="tel:911" id="calm911">${t('Call 911')}</a>`)}
    ${step(2, t('Find a place to sleep tonight.'), t('Shelters, hotels and help paying for a room.'), `<a class="btn" href="#resources/housing" id="calmsleep">${t('Show me places')}</a>`)}
    ${step(3, t('Write down one name and number.'), t('Anyone who helped you today: a firefighter, a caseworker, your insurance company.'), `<a class="btn" href="#binder/people" id="calmwrite">${t('Write it in my Recovery Binder')}</a>`)}
  </ol>
  <div class="calmtalk"><p><b>${t('Talk to someone now.')}</b> ${t('The 988 Lifeline is free and open 24 hours. You can call or text.')}</p>
    <div class="actions"><a class="btn crisis" href="tel:988" id="calm988">${t('Call 988')}</a><a class="btn secondary" href="sms:988" id="calm988t">${t('Text 988')}</a></div></div>
  <a class="btn secondary" href="#home" id="calmback">${t('Show the whole app again')}</a>
</div>` });

export const calmScreens = { calm };
