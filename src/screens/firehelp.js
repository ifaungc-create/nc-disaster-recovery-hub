// "I just had a home fire": a short guided flow opened from the red button at the top of Home.
// One question per screen (#home-fire, #home-fire/insurance, …) so the phone's Back button works.
// Path: safe place to stay? → (no: Red Cross) → insurance? → phone number? → what NOT to do yet → checklist → app.
// Answers are kept in sessionStorage and the checklist ticks in localStorage: on this device only, never sent.
import { t, pick } from '../i18n/index.js';
import { esc, ext, telHref, fmtDate } from '../ui.js';
import { ctx } from '../ctx.js';
import { TEXT as X, CHECKLIST, SOURCES, PHONES, CHECKED } from '../content/firehelp.js';

const ANS_KEY = 'ncdrh.fire', CHK_KEY = 'ncdrh.firecheck';
const read = (store, k) => { try { return JSON.parse(store.getItem(k)) || {}; } catch { return {}; } };
const write = (store, k, v) => { try { store.setItem(k, JSON.stringify(v)); } catch {} };
const answers = () => read(sessionStorage, ANS_KEY);
const noIns = () => answers().ins === 'no';
const P = (o) => esc(pick(o));

export const FLAME = '<svg class="flame" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c.6 3.2-1.2 5-2.7 6.7C7.8 10.4 6.5 12 6.5 14.6 6.5 18.1 9 21 12 21s5.5-2.9 5.5-6.4c0-2.3-1-4-2.2-5.4-.2 1.4-.9 2.5-2 3 .5-3.4-.3-7.2-1.3-10.2z" fill="currentColor"/><path d="M12 21c-1.7 0-3-1.5-3-3.3 0-1.5.8-2.4 1.7-3.4.5 1 1.2 1.5 2 1.6-.2-1.2.2-2.4.9-3.3.9 1.2 1.4 2.6 1.4 4.1 0 2.4-1.3 4.3-3 4.3z" fill="#FFD27A"/></svg>';

// The glowing red button shown at the top of Home.
export const fireBar = () => `<a class="firebar" href="#home-fire" id="firebar">${FLAME}<span class="fb-txt"><b>${P(X.bar)}</b><span>${P(X.barSub)}</span></span><span class="fb-go" aria-hidden="true">›</span></a>`;

const progress = (i) => `<ol class="fprog" aria-label="${esc(t('Progress'))}">${X.steps.map((s, n) => `<li class="${n < i ? 'done' : n === i ? 'now' : ''}"${n === i ? ' aria-current="step"' : ''}><span class="dot" aria-hidden="true"></span><span class="lbl">${P(s)}</span></li>`).join('')}</ol>`;
const head = (i) => `<p class="fkicker">${FLAME}${P(X.title)}</p>${progress(i)}`;
// Big answer buttons. `ans` is saved before moving on, so later screens can adapt.
const choice = (href, label, cls = '', ans = '') => `<a class="fchoice ${cls}" href="#${href}"${ans ? ` data-ans="${esc(ans)}"` : ''}><span>${P(label)}</span><span class="fc-arrow" aria-hidden="true">›</span></a>`;
const callBtn = (label, num, cls = '') => `<a class="btn call fcall ${cls}" href="${esc(telHref(num))}"><span>${P(label)}</span><b>${esc(num)}</b></a>`;
const call211 = () => `<a class="btn secondary fcall" href="tel:211"><span>${P(X.call211)}</span><b>211</b></a><p class="small">${esc(t('If 211 does not connect, call'))} <a href="${esc(telHref(PHONES.nc211alt))}">${esc(PHONES.nc211alt)}</a></p>`;
const next = (href, label) => `<a class="btn fnext" href="#${href}">${esc(label)} <span aria-hidden="true">›</span></a>`;
const ul = (items) => `<ul class="fpoints">${items.map((x) => `<li>${P(x)}</li>`).join('')}</ul>`;
const srcLinks = (ids) => `<div class="links sources"><span class="small"><b>${P(X.sources)}</b></span>${ids.map((id) => ext(pick(SOURCES[id]), SOURCES[id].url)).join('')}</div>`;
const wrap = (i, body) => `<div class="fflow">${head(i)}<div class="fstep">${body}</div></div>`;

// Small line icons for the Red Cross services list.
const I = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONS = {
  recover: I('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>'),
  stay: I('<path d="M3 18v-6a2 2 0 012-2h14a2 2 0 012 2v6"/><path d="M3 14h18M3 18v2M21 18v2"/><circle cx="8" cy="7" r="2"/>'),
  meds: I('<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M12 8v8"/>'),
  mind: I('<path d="M12 21s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.6-7 10-7 10z"/>'),
  faith: I('<path d="M12 3c1.5 2 2 3 2 4a2 2 0 01-4 0c0-1 .5-2 2-4z"/><rect x="9" y="11" width="6" height="10" rx="1"/>'),
  loss: I('<circle cx="12" cy="9" r="3"/><path d="M12 6V3M12 15v6M9 9H6M18 9h-3M9.9 6.9L8 5M14.1 6.9L16 5"/>'),
  refer: I('<path d="M4 12h12M12 6l6 6-6 6"/><path d="M20 5v14"/>'),
};

const STEPS = {
  shelter: () => STEPS['red-cross'](),
  '': () => wrap(0, `<section class="f911" role="note"><p><b>${P(X.e911)}</b> ${P(X.e911Body)}</p><a class="btn danger f911btn" href="tel:911">${P(X.call911)}</a></section>
    <h2>${P(X.qStay)}</h2><p class="muted">${P(X.intro)}</p>
    <div class="fchoices">${choice('home-fire/insurance', X.stayYes, 'yes', 'stay:yes')}${choice('home-fire/red-cross', X.stayNo, 'no', 'stay:no')}</div>`),

  'red-cross': () => wrap(0, `<h2 class="rc-h"><span class="rcmark" aria-hidden="true">${I('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6"/>')}</span>${P(X.rcTitle)}</h2><p class="muted">${P(X.rcIntro)}</p>
    <section class="card fcard"><h3>${P(X.rcHowTitle)}</h3>
      <p><b>${P(X.shelterOnScene)}</b> ${P(X.shelterOnSceneBody)}</p>
      <p><b>${P(X.shelterGone)}</b> ${P(X.shelterGoneBody)}</p>${callBtn(X.callRC, PHONES.redcross, 'rc')}</section>
    <section class="card fcard"><h3>${P(X.rcNextTitle)}</h3><ol class="ftimeline">${X.rcNext.map((x, i) => `<li style="--i:${i}">${P(x)}</li>`).join('')}</ol></section>
    <h3 class="rc-sub">${P(X.rcCanTitle)}</h3>
    <ul class="rcserv">${X.rcCan.map((c, i) => `<li style="--i:${i}"><span class="rci rci-${c.k}" aria-hidden="true">${ICONS[c.k] || ''}</span><span><b>${P(c.t)}</b><br><span class="small">${P(c.d)}</span></span></li>`).join('')}</ul>
    <section class="card fcard rctips"><h3>${P(X.rcTipsTitle)}</h3>${ul(X.rcTips)}</section>
    <section class="card fcard"><p class="small">${P(X.shelter211)}</p>${call211()}</section>
    ${srcLinks(['rcDat', 'rcAfter', 'rcRelief'])}
    ${next('home-fire/insurance', t('Next: insurance'))}`),

  insurance: () => wrap(1, `<h2>${P(X.qIns)}</h2>
    <div class="fchoices">${choice('home-fire/phone', X.insYes, 'yes', 'ins:yes')}${choice('home-fire/no-insurance', X.insNo, 'no', 'ins:no')}${choice('home-fire/unsure', X.insUnsure, 'maybe', 'ins:unsure')}</div>`),

  phone: () => wrap(1, `<h2>${P(X.qPhone)}</h2>
    <div class="fchoices">${choice('home-fire/call', X.phoneYes, 'yes')}${choice('home-fire/find', X.phoneNo, 'no')}</div>`),

  call: () => wrap(1, `<h2>${P(X.callNowTitle)}</h2>
    <section class="card fcard"><ol class="steps">${X.callNow.map((x) => `<li>${P(x)}</li>`).join('')}</ol>
    <a class="btn secondary" href="#notes/cases">${P(X.saveClaim)}</a></section>
    ${next('home-fire/donts', t('Next: what not to do yet'))}`),

  find: () => wrap(1, `<h2>${P(X.findTitle)}</h2>
    <section class="card fcard"><p><b>${P(X.findWhere)}</b></p>${ul(X.find)}
    <a class="btn secondary" href="#resources/insurance" data-jumpto="insdir">${P(X.openList)}</a></section>
    <section class="card fcard"><h3>${P(X.callNowTitle)}</h3><ol class="steps">${X.callNow.map((x) => `<li>${P(x)}</li>`).join('')}</ol></section>
    ${next('home-fire/donts', t('Next: what not to do yet'))}`),

  unsure: () => wrap(1, `<h2>${P(X.unsureTitle)}</h2>
    <section class="card fcard">${ul(X.unsure)}<p class="small">${P(X.ncdoiHelp)}</p>${callBtn(X.callNcdoi, PHONES.ncdoi, 'alt')}</section>
    <div class="fchoices">${choice('home-fire/phone', X.foundIt, 'yes', 'ins:yes')}${choice('home-fire/no-insurance', X.noneFound, 'no', 'ins:no')}</div>`),

  'no-insurance': () => wrap(1, `<h2>${P(X.noInsTitle)}</h2>
    <section class="card fcard">${ul(X.noIns)}${callBtn(X.callRC, PHONES.redcross, 'rc')}
      ${call211()}
      <div class="links">${ext(pick(X.rcMore), '#home-fire/red-cross')}${ext(pick(X.reliefLink), '#resources/relief')}${ext(pick(X.countyLink), '#counties')}</div></section>
    ${next('home-fire/donts', t('Next: what not to do yet'))}`),

  donts: () => {
    const none = noIns(); const list = X.donts.filter((d) => !(none && d.ins));
    return wrap(2, `<h2 class="fdont-h"><span class="nosign" aria-hidden="true"></span>${P(none ? X.dontTitleNoIns : X.dontTitle)}</h2>
    <ul class="fdonts">${list.map((d, i) => `<li style="--i:${i}"><span class="x" aria-hidden="true">✕</span><span><b>${P(d.t)}</b><br><span class="small">${P(d.d)}</span></span></li>`).join('')}</ul>
    <div class="links">${ext(pick(X.boardupLink), '#resources/boardup')}</div>
    ${srcLinks(['ncdoi', 'ncdoiScams', 'lincoln'])}
    ${next('home-fire/checklist', t('Next: your checklist'))}`);
  },

  checklist: () => {
    const none = noIns(); const ticks = read(localStorage, CHK_KEY);
    const n = CHECKLIST.filter((c) => ticks[c.id]).length;
    const items = CHECKLIST.map((c, i) => {
      const text = c.text || (none ? c.noIns : c.ins);
      return `<li style="--i:${i}"><label class="fcheck"><input type="checkbox" data-chk="${c.id}" ${ticks[c.id] ? 'checked' : ''}><span class="box" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><span class="ftxt">${P(text)}</span></label>${c.link ? `<div class="flink">${ext(pick(c.link[0]), c.link[1])}</div>` : ''}</li>`;
    }).join('');
    const ids = [...new Set(CHECKLIST.flatMap((c) => c.src || []))];
    return wrap(3, `<h2>${P(X.listTitle)}</h2><p class="muted">${P(X.listIntro)}</p>
      <div class="fmeter" aria-hidden="true"><span style="width:${Math.round((n / CHECKLIST.length) * 100)}%"></span></div>
      <p class="small fcount" role="status" aria-live="polite">${esc(pick(X.done).replace('{n}', n).replace('{total}', CHECKLIST.length))}</p>
      <ol class="fchecklist">${items}</ol>
      <a class="btn fnext" href="#home" id="fgoapp">${P(X.goApp)} <span aria-hidden="true">›</span></a>
      <a class="btn secondary" href="#home-care">${P(X.homeCare)}</a>
      <button class="btn secondary" type="button" id="frestart">${P(X.restart)}</button>
      ${srcLinks([...ids, 'usfa'])}
      <p class="small">${esc(pick(X.checked).replace('{date}', fmtDate(CHECKED)))}</p>`);
  },
};

function bind() {
  // Answer buttons: save the answer, show the press, then move on.
  document.querySelectorAll('.fchoice').forEach((a) => (a.onclick = (e) => {
    e.preventDefault(); const [k, v] = (a.dataset.ans || '').split(':');
    if (k) { const s = answers(); s[k] = v; write(sessionStorage, ANS_KEY, s); }
    a.classList.add('picked'); a.parentElement.classList.add('chosen');
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => ctx.go(a.getAttribute('href').slice(1)), reduce ? 0 : 260);
  }));
  // "Open the list of insurance claim numbers": jump straight to the directory on the Insurance page.
  document.querySelectorAll('[data-jumpto]').forEach((a) => a.addEventListener('click', () => { ctx.jump = a.dataset.jumpto; }));
  // Checklist ticks (this device only).
  const boxes = [...document.querySelectorAll('[data-chk]')];
  boxes.forEach((b) => (b.onchange = () => {
    const ticks = read(localStorage, CHK_KEY); ticks[b.dataset.chk] = b.checked; write(localStorage, CHK_KEY, ticks);
    const n = boxes.filter((x) => x.checked).length;
    const bar = document.querySelector('.fmeter span'); if (bar) bar.style.width = Math.round((n / boxes.length) * 100) + '%';
    const c = document.querySelector('.fcount'); if (c) c.textContent = pick(X.done).replace('{n}', n).replace('{total}', boxes.length);
  }));
  const r = document.getElementById('frestart');
  if (r) r.onclick = () => { try { sessionStorage.removeItem(ANS_KEY); localStorage.removeItem(CHK_KEY); } catch {} ctx.go('home-fire'); };
}

export const fireHelpScreens = {
  'home-fire': (rest = []) => {
    const step = STEPS[rest[0] || ''] ? rest[0] || '' : '';
    return { html: STEPS[step](), bind };
  },
};
