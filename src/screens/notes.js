// My Notes (case numbers, free-form notes, referral tracker), responder share cards, and claiming a card.
import qrcode from 'qrcode-generator';
import { api } from '../data/index.js';
import { AGENCIES, REF_STATUS, fmtCode, normCode } from '../data/shared.js';
import { SHARE_CARD_DAYS, SITE_URL } from '../config.js';
import { ADAPTER } from '../data/index.js';
import { responderNotice } from './admin.js';
import { ctx } from '../ctx.js';
import { $, $$, esc, tel, ext, fmtDate, today, b64urlEncode, b64urlDecode } from '../ui.js';
import { t, tk } from '../i18n/index.js';

const KIND = {
  cases: { tab: tk('Case numbers'), add: tk('Add a case number'), edit: tk('Edit case number'), del: tk('Delete this case number? This cannot be undone.'), deleted: tk('Deleted the case number.'), saved: tk('Saved the case number.'),
    empty: tk('Save every case, claim and application number here, with who to call. You will be asked for them again and again.'),
    fields: [
      { n: 'agency', l: tk('Agency or program'), t: 'select', opts: AGENCIES.map((a) => [a, a]) },
      { n: 'agencyOther', l: tk('Company or agency name'), hint: tk('For insurance or other: e.g. the insurance company') },
      { n: 'number', l: tk('Case, claim or application number'), req: true },
      { n: 'contactName', l: tk('Contact person') }, { n: 'phone', l: tk('Phone'), t: 'tel' }, { n: 'email', l: tk('Email'), t: 'email' },
      { n: 'opened', l: tk('Date opened'), t: 'date' }, { n: 'nextDate', l: tk('Next step or follow-up date'), t: 'date' },
      { n: 'details', l: tk('Notes'), t: 'textarea' }],
  },
  notes: { tab: tk('Notes'), add: tk('Write a note'), edit: tk('Edit note'), del: tk('Delete this note? This cannot be undone.'), deleted: tk('Deleted the note.'), saved: tk('Saved the note.'), empty: tk('Write down anything you want to remember: calls, what someone told you, things to buy, questions to ask.'),
    fields: [{ n: 'title', l: tk('Title') }, { n: 'body', l: tk('Note'), t: 'textarea', rows: 8 }] },
  referrals: { tab: tk('Referrals'), add: tk('Add a referral'), edit: tk('Edit referral'), del: tk('Delete this referral? This cannot be undone.'), deleted: tk('Deleted the referral.'), saved: tk('Saved the referral.'), empty: tk('When someone sends you to another agency or program, track it here so nothing falls through the cracks.'),
    fields: [
      { n: 'by', l: tk('Referred by'), hint: tk('Who sent you (person or agency)') }, { n: 'to', l: tk('Referred to'), req: true, hint: tk('Agency, program or person') },
      { n: 'what', l: tk('For what'), hint: tk('e.g. rental help, replacing glasses') }, { n: 'phone', l: tk('Their phone'), t: 'tel' },
      { n: 'status', l: tk('Status'), t: 'select', opts: Object.entries(REF_STATUS) }, { n: 'followUp', l: tk('Follow-up date'), t: 'date' },
      { n: 'details', l: tk('Notes'), t: 'textarea' }],
  },
};
const tabs = (cur) => `<div class="tabs" role="navigation" aria-label="${t('My Notes sections')}">${Object.entries(KIND).map(([k, v]) => `<a href="#notes/${k}" ${k === cur ? 'aria-current="page"' : ''}>${t(v.tab)}</a>`).join('')}</div>`;
const field = (f, v = '') => {
  const id = 'f_' + f.n, lab = `<label for="${id}">${esc(t(f.l))}${f.req ? '' : ` <span class="small">${t('(optional)')}</span>`}</label>${f.hint ? `<p class="small" id="${id}_h" style="margin:0 0 4px">${esc(t(f.hint))}</p>` : ''}`;
  const aria = f.hint ? ` aria-describedby="${id}_h"` : '';
  if (f.t === 'select') return lab + `<select id="${id}" name="${f.n}"${aria}>${f.opts.map(([val, l]) => `<option value="${esc(val)}" ${val === v ? 'selected' : ''}>${esc(t(l))}</option>`).join('')}</select>`;
  if (f.t === 'textarea') return lab + `<textarea id="${id}" name="${f.n}" rows="${f.rows || 4}"${aria}>${esc(v)}</textarea>`;
  return lab + `<input id="${id}" name="${f.n}" type="${f.t || 'text'}" value="${esc(v)}" ${f.req ? 'required' : ''}${f.t === 'tel' ? ' autocomplete="off" inputmode="tel"' : ''}${aria}>`;
};
const dueBadge = (d) => (!d ? '' : d < today() ? `<span class="badge verify">${t('Past due {date}', { date: esc(fmtDate(d)) })}</span>` : d === today() ? `<span class="badge verify">${t('Due today')}</span>` : `<span class="badge">${t('Follow up {date}', { date: esc(fmtDate(d)) })}</span>`);

function itemHtml(kind, r) {
  const actions = `<div class="actions"><a class="btn secondary" href="#notes/${kind}/edit/${r.id}">${t('Edit')}</a><button class="btn secondary" data-del="${r.id}">${t('Delete')}</button></div>`;
  if (kind === 'cases') return `<li data-id="${r.id}"><h3>${esc(t(r.agency))}${r.agencyOther ? ': ' + esc(r.agencyOther) : ''}</h3>
    <p class="code" style="text-align:left;font-size:24px;letter-spacing:1px">${esc(r.number)}</p>
    ${r.contactName ? `<p>${t('Contact:')} ${esc(r.contactName)}</p>` : ''}${tel(t('Call {name}', { name: r.contactName || t(r.agency) }), r.phone)}${r.email ? `<p><a href="mailto:${esc(r.email)}">${esc(r.email)}</a></p>` : ''}
    <p class="small">${r.opened ? t('Opened {date}', { date: esc(fmtDate(r.opened)) }) + ' ' : ''}</p>${dueBadge(r.nextDate)}${r.details ? `<p style="white-space:pre-wrap">${esc(r.details)}</p>` : ''}${actions}</li>`;
  if (kind === 'notes') return `<li data-id="${r.id}"><h3>${esc(r.title || t('Note'))}</h3><p class="small">${esc(fmtDate(r.updatedAt))}${r.fromCard ? ' · ' + t('from a responder share card') : ''}</p><p style="white-space:pre-wrap">${esc(r.body)}</p>${actions}</li>`;
  return `<li data-id="${r.id}"><h3>${esc(r.to)}</h3>${r.what ? `<p>${t('For:')} ${esc(r.what)}</p>` : ''}${r.by ? `<p class="small">${t('Referred by {name}', { name: esc(r.by) })}</p>` : ''}
    <label for="st_${r.id}" style="margin-top:6px">${t('Status')}</label><select id="st_${r.id}" data-status="${r.id}">${Object.entries(REF_STATUS).map(([k, l]) => `<option value="${k}" ${k === r.status ? 'selected' : ''}>${t(l)}</option>`).join('')}</select>
    <p style="margin-top:8px"><span class="badge s-${esc(r.status)}">${esc(t(REF_STATUS[r.status]))}</span> ${r.status === 'done' ? '' : dueBadge(r.followUp)}</p>${tel(t('Call {name}', { name: r.to }), r.phone)}${r.details ? `<p style="white-space:pre-wrap">${esc(r.details)}</p>` : ''}${actions}</li>`;
}

async function listScreen(kind) {
  const k = KIND[kind]; let rows = await api.list(ctx.me.id, kind);
  if (kind === 'referrals') rows = rows.sort((a, b) => (a.status === 'done') - (b.status === 'done') || (a.followUp || '9999').localeCompare(b.followUp || '9999'));
  const open = kind === 'referrals' ? rows.filter((r) => r.status !== 'done').length : 0;
  return { html: `<h2>${t('My Notes')}</h2><p class="small">${t('Private: only you can see these.')}</p>${tabs(kind)}
    <a class="btn" href="#notes/${kind}/new">+ ${t(k.add)}</a>
    ${kind === 'referrals' && rows.length ? `<p>${t('{open} open, {done} done', { open, done: rows.length - open })}</p>` : ''}
    ${rows.length ? `<ul class="list" id="items">${rows.map((r) => itemHtml(kind, r)).join('')}</ul>` : `<div class="card"><p>${t(k.empty)}</p></div>`}
    ${kind === 'notes' ? `<a class="btn secondary" href="#claim">${t("Save a responder's share code")}</a>` : ''}`,
  bind() {
    $$('[data-del]').forEach((b) => (b.onclick = async () => { if (!confirm(t(k.del))) return; await api.remove(ctx.me.id, kind, b.dataset.del); ctx.flash = t(k.deleted); ctx.render(); }));
    $$('[data-status]').forEach((s) => (s.onchange = async () => { await api.update(ctx.me.id, kind, s.dataset.status, { status: s.value }); ctx.flash = t('Status updated.'); ctx.render(); }));
  } };
}
async function formScreen(kind, id) {
  const k = KIND[kind]; const rec = id ? (await api.list(ctx.me.id, kind)).find((r) => r.id === id) : null;
  if (id && !rec) return { html: `<h2>${t('Not found')}</h2><a class="btn" href="#notes/${kind}">${t('Back')}</a>` };
  return { html: `<h2>${rec ? t(k.edit) : t(k.add)}</h2>${tabs(kind)}<form id="f" class="card" novalidate>${k.fields.map((f) => field(f, rec?.[f.n] ?? (f.n === 'opened' && !rec ? '' : ''))).join('')}
    <p class="err" role="alert" id="err"></p><button class="btn" type="submit">${t('Save')}</button><a class="btn secondary" href="#notes/${kind}">${t('Cancel')}</a></form>`,
  bind() {
    $('#f').onsubmit = async (e) => { e.preventDefault(); const o = Object.fromEntries(new FormData(e.target));
      try { if (rec) await api.update(ctx.me.id, kind, rec.id, o); else await api.create(ctx.me.id, kind, o); ctx.flash = t(k.saved); ctx.go('notes/' + kind); } catch (x) { $('#err').textContent = t(x.message); } };
  } };
}

// ---------- share cards (responders) ----------
// QR codes always point at the production address, except when running on localhost (dev/tests).
const qrBase = () => (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ? location.origin : SITE_URL);
const claimUrl = (rec) => `${qrBase()}/#claim/d/${b64urlEncode({ v: 1, c: rec.code, x: rec.expiresAt.slice(0, 10), k: rec.card })}`;
function qrSvg(text) { const q = qrcode(0, 'M'); q.addData(text, 'Byte'); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true, alt: t('QR code for the share card'), title: t('Share card QR code') }); }
const cardPreview = (c) => `<div class="card"><h3>${esc(c.title || t('Contact information'))}</h3><dl class="kv">${c.org ? `<dt>${t('Organization')}</dt><dd>${esc(c.org)}</dd>` : ''}${c.contact ? `<dt>${t('Contact')}</dt><dd>${esc(c.contact)}</dd>` : ''}${c.phone ? `<dt>${t('Phone')}</dt><dd>${esc(c.phone)}</dd>` : ''}${c.email ? `<dt>${t('Email')}</dt><dd>${esc(c.email)}</dd>` : ''}${c.url ? `<dt>${t('Website')}</dt><dd>${esc(c.url)}</dd>` : ''}</dl>${c.details ? `<p style="white-space:pre-wrap;margin-top:8px">${esc(c.details)}</p>` : ''}</div>`;

async function shareScreen(parts) {
  if (ctx.me.role !== 'responder') return { html: `<h2>${t('Share cards')}</h2><div class="card"><p>${t('Share cards are made by disaster responders. If a responder gave you a code, you can save it to your notes.')}</p><a class="btn" href="#claim">${t('Enter a code')}</a></div>` };
  if (ctx.me.responderStatus !== 'approved' && !ctx.me.isAdmin) return { html: `<h2>${t('Share cards')}</h2>${responderNotice(ctx.me)}` };
  if (parts[0] === 'card') {
    const rec = (await api.listShareCards(ctx.me.id)).find((c) => c.code === parts[1]);
    if (!rec) return { html: `<h2>${t('Not found')}</h2><a class="btn" href="#share">${t('Back')}</a>` };
    const live = !rec.revoked && rec.expiresAt > new Date().toISOString();
    return { html: `<h2>${t('Share card')}</h2>${live ? `<p>${t('Ask the person to scan the QR code with their phone camera, or to open this app and enter the code. They choose whether to save it.')}</p>
      <div class="qr" id="qr">${qrSvg(claimUrl(rec))}</div><p class="center small">${t('Or enter this code in the app:')} </p><p class="code" id="code">${esc(fmtCode(rec.code))}</p>
      <p class="small center">${t('Expires {date}. Saved {n} time(s) by code.', { date: esc(fmtDate(rec.expiresAt)), n: rec.saves })}</p>` : `<div class="note">${rec.revoked ? t('This card is turned off.') : t('This card is expired.')}</div>`}
      ${cardPreview(rec.card)}${live ? `<button class="btn danger" id="revoke">${t('Turn off this code')}</button><p class="small">${t('Turning it off stops new saves by code. People who already saved it keep their copy, and a QR code that was already scanned keeps working until it expires.')}</p>` : ''}<a class="btn secondary" href="#share">${t('All my share cards')}</a>`,
    bind() { $('#revoke') && ($('#revoke').onclick = async () => { await api.revokeShareCard(ctx.me.id, rec.code); ctx.flash = t('Code turned off.'); ctx.render(); }); } };
  }
  const cards = await api.listShareCards(ctx.me.id); const me = ctx.me;
  return { html: `<h2>${t('Share cards')}</h2>
    <p>${t('Give a client your contact information and next steps. They scan a QR code or type a short code, and choose whether to save it to their own private notes. You never see their notes or account.')}</p>
    <div class="card warn"><h3>${t('Do not include client information')}</h3><p>${t("Put only your and your organization's details here. No client names, case details, addresses or anything private.")}</p></div>
    <form id="f" class="card" novalidate>
      <label for="c_title">${t('Card title')}</label><input id="c_title" name="title" placeholder="${t('e.g. Your Red Cross caseworker')}" maxlength="120">
      <label for="c_org">${t('Organization')}</label><input id="c_org" name="org" value="${esc(me.org)}">
      <label for="c_contact">${t('Your name')}</label><input id="c_contact" name="contact" value="${esc(me.name)}">
      <label for="c_phone">${t('Phone')}</label><input id="c_phone" name="phone" type="tel" inputmode="tel">
      <label for="c_email">${t('Email')} <span class="small">${t('(optional)')}</span></label><input id="c_email" name="email" type="email">
      <label for="c_url">${t('Website')} <span class="small">${t('(optional, https://)')}</span></label><input id="c_url" name="url" type="url" placeholder="https://">
      <label for="c_details">${t('Next steps or details')}</label><textarea id="c_details" name="details" maxlength="1500" placeholder="${t('e.g. Call me after your FEMA inspection. Office hours Mon–Fri 9–4.')}"></textarea>
      <p class="err" role="alert" id="err"></p><button class="btn" type="submit">${t('Create share card')}</button>
      <p class="small">${t('The code expires in {n} days. You can turn it off any time.', { n: SHARE_CARD_DAYS })}</p></form>
    ${cards.length ? `<h3>${t('My share cards')}</h3><ul class="list">${cards.map((c) => `<li><a class="rowlink" href="#share/card/${c.code}"><span>${esc(c.card.title || c.card.org || t('Share card'))}<br><span class="small">${esc(fmtCode(c.code))} · ${c.revoked ? t('turned off') : c.expiresAt < new Date().toISOString() ? t('expired') : t('active until {date}', { date: esc(fmtDate(c.expiresAt)) })}</span></span><span aria-hidden="true">›</span></a></li>`).join('')}</ul>` : ''}`,
  bind() {
    $('#f').onsubmit = async (e) => { e.preventDefault(); const o = Object.fromEntries(new FormData(e.target));
      try { const rec = await api.createShareCard(me.id, { ...o, issued: today() }); ctx.go('share/card/' + rec.code); } catch (x) { $('#err').textContent = t(x.message); } };
  } };
}

// ---------- claim (person affected) ----------
async function claimScreen(parts, route) {
  let card = null, code = '', expires = '', error = '';
  if (parts[0] === 'd' && parts[1]) {
    try { const d = b64urlDecode(parts[1]); card = d.k; code = d.c || ''; expires = d.x || ''; if (expires && expires < today()) { card = null; error = t('This QR code has expired. Ask the responder for a new one.'); } } catch { error = t('This QR code could not be read. Ask the responder for the short code instead.'); }
  } else if (parts[0]) {
    try { const r = await api.getShareCard(parts[0]); card = r.card; code = r.code; expires = r.expiresAt; } catch (x) { error = t(x.message); }
  }
  if (!card) return { html: `<h2>${t("Save a responder's info")}</h2>
    <p>${t('A responder (for example a Red Cross caseworker) can give you a QR code or a short code with their contact information. Saving it puts a copy in your private notes.')}</p>
    ${error ? `<div class="note" role="alert">${esc(error)}</div>` : ''}
    <form id="f" class="card"><label for="cc">${t('Code (8 letters and numbers)')}</label><input id="cc" name="code" autocomplete="off" autocapitalize="characters" placeholder="ABCD-2345" inputmode="text" required><button class="btn" type="submit">${t('Look up code')}</button></form>
    ${ADAPTER === 'local' ? `<p class="small">${t('Offline mode: codes only work on the device where they were created. QR codes work on any device.')}</p>` : ''}`,
  bind() { $('#f').onsubmit = (e) => { e.preventDefault(); const c = normCode(new FormData(e.target).get('code')); if (c) ctx.go('claim/' + c); }; } };
  const route_ = route;
  return { html: `<h2>${t('Save this information?')}</h2><p>${t('A responder shared this contact information with you. Nothing is saved unless you choose to.')}</p>${cardPreview(card)}
    ${ctx.me ? `<form id="f" class="card"><label class="opt"><input type="checkbox" name="consent" id="consent"><span>${t('Yes, save a copy to my private notes. I understand the responder will not see my notes or account.')}</span></label><p class="err" role="alert" id="err"></p><button class="btn" type="submit">${t('Save to my notes')}</button><a class="btn secondary" href="#home">${t('No thanks')}</a></form>`
    : `<div class="card"><p>${t('Sign in or create a free account to save this to your private notes.')}</p><a class="btn" href="#signup" data-after>${t('Create a free account')}</a><a class="btn secondary" href="#login" data-after>${t('Sign in')}</a></div>`}`,
  bind() {
    $$('[data-after]').forEach((a) => (a.onclick = () => sessionStorage.setItem('ncdrh.after', route_)));
    const f = $('#f'); if (!f) return;
    f.onsubmit = async (e) => { e.preventDefault();
      try { await api.claimShareCard(ctx.me.id, parts[0] === 'd' ? { card } : { code }, $('#consent').checked); ctx.flash = t('Saved to your notes.'); ctx.go('notes/notes'); } catch (x) { $('#err').textContent = t(x.message); } };
  } };
}

export const notesScreens = {
  notes: (p) => { const kind = KIND[p[0]] ? p[0] : 'cases'; if (p[1] === 'new') return formScreen(kind); if (p[1] === 'edit') return formScreen(kind, p[2]); return listScreen(kind); },
  share: shareScreen,
  claim: claimScreen,
};
