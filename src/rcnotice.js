// Shown before any call to the American Red Cross (1-800-733-2767), wherever the number appears in the app:
// what the Red Cross helps with and what it does not, so people with other needs call the right place.
// Wording requested by C4I (November 22, 2026). The person can still place the call from the notice.
import { t } from './i18n/index.js';
import { digits } from './ui.js';

export const RC_DIGITS = '8007332767';
export const isRedCrossTel = (href = '') => /^tel:/i.test(href) && digits(href).endsWith(RC_DIGITS);

const html = (href) => `<div class="langpick rcnote" id="rcnote" role="dialog" aria-modal="true" aria-labelledby="rc_h" aria-describedby="rc_p"><div class="card">
  <h2 id="rc_h">${t('Before you call the Red Cross')}</h2>
  <div id="rc_p"><p>${t('The Red Cross is a disaster relief agency. Assistance is given to people involved in a verifiable disaster.')}</p>
  <p>${t('The Red Cross does not provide assistance with housing, bills, non-disaster emergencies, or landlord issues such as burst pipes or downed, neglected trees.')}</p></div>
  <a class="btn" id="rc_call" href="${href}" data-rc-ok="1">${t('Call the Red Cross')}</a>
  <p class="small">${t('For other needs, NC 211 can point you to local help.')}</p>
  <a class="btn secondary" id="rc_211" href="tel:211">${t('Call NC 211')}</a>
  <button class="btn secondary" type="button" id="rc_close">${t('Go back')}</button></div></div>`;

export function showRedCrossNotice(href, opener) {
  const app = document.getElementById('app'); if (!app || document.getElementById('rcnote')) return;
  app.insertAdjacentHTML('beforeend', html(href));
  const box = document.getElementById('rcnote'); const others = [...app.children].filter((el) => el !== box);
  others.forEach((el) => (el.inert = true));
  const focusables = [...box.querySelectorAll('a, button')]; focusables[0].focus();
  const close = () => { others.forEach((el) => (el.inert = false)); box.remove(); try { opener?.focus?.({ preventScroll: true }); } catch {} };
  box.querySelector('#rc_close').onclick = close;
  box.querySelector('#rc_call').addEventListener('click', () => setTimeout(close, 0));
  box.querySelector('#rc_211').addEventListener('click', () => setTimeout(close, 0));
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') { e.preventDefault(); const i = focusables.indexOf(document.activeElement); focusables[(i + (e.shiftKey ? -1 : 1) + focusables.length) % focusables.length].focus(); }
  });
}

// One listener for the whole app: every Red Cross phone link opens the notice first.
export function watchRedCrossCalls() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href]'); if (!a || a.dataset.rcOk || !isRedCrossTel(a.getAttribute('href'))) return;
    e.preventDefault(); showRedCrossNotice(a.getAttribute('href'), a);
  });
}
