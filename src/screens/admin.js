// Responder record submissions (#submit) and the admin area (#admin). The server enforces every rule;
// these screens only hide what a person cannot use. Admins never see client notes: no API returns them.
import { ctx } from '../ctx.js';
import { api, ADAPTER } from '../data/index.js';
import { NC_COUNTIES, SUB_KINDS, SUB_CATEGORIES, RESPONDER_STATUS } from '../data/shared.js';
import { $, $$, esc, fmtDate } from '../ui.js';
import { clearCommunityCache } from '../community.js';
import { t, tk, getLang, locale } from '../i18n/index.js';
import { currentSub } from '../push.js';

const opts = (map, cur) => Object.entries(map).map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(t(l))}</option>`).join('');
const countyOpts = (cur) => ['Statewide', ...NC_COUNTIES].map((c) => `<option value="${esc(c)}" ${c === cur ? 'selected' : ''}>${esc(c === 'Statewide' ? t('Statewide') : c)}</option>`).join('');
// Same fields for the responder form and the admin edit forms; p keeps ids unique.
export const subFields = (r = {}, p = 's') => `
  <label for="${p}_kind">${t('What is it?')}</label><select id="${p}_kind" name="kind"><option value="">${t('Choose…')}</option>${opts(SUB_KINDS, r.kind)}</select>
  <label for="${p}_category">${t('Category')}</label><select id="${p}_category" name="category"><option value="">${t('Choose…')}</option>${opts(SUB_CATEGORIES, r.category)}</select>
  <label for="${p}_county">${t('County')}</label><select id="${p}_county" name="county"><option value="">${t('Choose…')}</option>${countyOpts(r.county)}</select>
  <label for="${p}_title">${t('Name or title')}</label><input id="${p}_title" name="title" maxlength="160" value="${esc(r.title || '')}">
  <label for="${p}_description">${t('Description')} <span class="small">${t('(who it helps, hours, how to get it)')}</span></label><textarea id="${p}_description" name="description" maxlength="2000">${esc(r.description || '')}</textarea>
  <label for="${p}_phone">${t('Phone number')}</label><input id="${p}_phone" name="phone" type="tel" inputmode="tel" maxlength="40" value="${esc(r.phone || '')}">
  <label for="${p}_url">${t('Link')} <span class="small">(https://)</span></label><input id="${p}_url" name="url" type="url" placeholder="https://" value="${esc(r.url || '')}">
  <label for="${p}_sourceUrl">${t('Source link')} <span class="small">${t('(where an admin can check this, https://)')}</span></label><input id="${p}_sourceUrl" name="sourceUrl" type="url" placeholder="https://" value="${esc(r.sourceUrl || '')}">`;
const FIELDS = ['kind', 'category', 'county', 'title', 'description', 'phone', 'url', 'sourceUrl'];
const FIELD_LABEL = { kind: tk('What is it?'), category: tk('Category'), county: tk('County'), title: tk('Name or title'), description: tk('Description'), phone: tk('Phone number'), url: tk('Link'), sourceUrl: tk('Source link') };
const formObj = (f) => Object.fromEntries(new FormData(f));
const changedFields = (rec, orig) => FIELDS.filter((k) => (rec[k] || '') !== (orig[k] || ''));
const STATUS = { pending: tk('Waiting for review'), approved: tk('Approved'), rejected: tk('Not approved') };
const statusBadge = (s) => `<span class="badge ${s === 'approved' ? 'ok' : s === 'pending' ? 's-waiting' : 's-not_started'}">${esc(STATUS[s] ? t(STATUS[s]) : s)}</span>`;
const where = (r) => `${esc(SUB_KINDS[r.kind] ? t(SUB_KINDS[r.kind]) : '')} · ${esc(SUB_CATEGORIES[r.category] ? t(SUB_CATEGORIES[r.category]) : '')} · ${esc(r.county === 'Statewide' ? t('Statewide') : t('{county} County', { county: r.county }))}`;
const when = (x) => new Date(x).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' });

export const responderNotice = (me) => {
  if (!me || me.role !== 'responder' || me.isAdmin || me.responderStatus === 'approved') return '';
  if (me.responderStatus === 'pending') return `<div class="note" id="pending-note" role="status"><b>${t('Your responder account is waiting for admin approval.')}</b> ${t('You can use the app like anyone else. Share cards and record submissions open once an administrator approves you.')}</div>`;
  return `<div class="note" id="pending-note" role="status"><b>${me.responderStatus === 'revoked' ? t('Your responder access is turned off.') : t('Your responder access is not approved.')}</b>${me.responderReason ? ' ' + t('Reason:') + ' ' + esc(me.responderReason) + '.' : ''} ${t('Contact the administrator if you think this is a mistake.')}</div>`;
};
const canRespond = (me) => me && (me.isAdmin || (me.role === 'responder' && me.responderStatus === 'approved'));

async function submit() {
  const me = ctx.me;
  const h = `<h2>${t('Add a resource')}</h2>`;
  if (ADAPTER === 'local') return { html: `${h}<div class="card"><p>${t('Adding resources needs the online version of the app.')}</p></div>` };
  if (!canRespond(me)) return { html: `${h}${responderNotice(me) || `<div class="card"><p>${t('Only approved responder accounts can add resources.')}</p></div>`}` };
  const mine = await api.mySubmissions();
  return { html: `${h}
    <p>${t('Know an organization, service, shelter, phone number or link that should be listed? Send it in. An administrator checks it against your source link before anyone sees it.')}</p>
    <div class="card warn"><h3>${t('Public information only')}</h3><p>${t('Approved records are shown to everyone. Never include client names or anything private.')}</p></div>
    <form id="f" class="card" novalidate>${subFields({}, 's')}<p class="err" role="alert" id="err"></p><button class="btn" type="submit">${t('Send for review')}</button></form>
    <h3>${t('What I sent')}</h3>${mine.length ? `<ul class="list" id="mine">${mine.map((x) => `<li data-sub="${esc(x.id)}"><b>${esc(x.record.title)}</b> ${statusBadge(x.status)}<br><span class="small">${where(x.record)} · ${esc(t('sent {date}', { date: fmtDate(x.createdAt) }))}</span>${x.status === 'rejected' && x.reason ? `<p class="small">${t('Reason:')} ${esc(x.reason)}</p>` : ''}</li>`).join('')}</ul>` : `<p class="small">${t('Nothing yet.')}</p>`}`,
  bind() {
    $('#f').onsubmit = async (e) => { e.preventDefault();
      try { await api.submitRecord(formObj(e.target)); ctx.flash = t('Sent. An administrator will review it.'); ctx.render(); } catch (x) { $('#err').textContent = t(x.message); } };
  } };
}

const TABS = [['responders', tk('Responders')], ['submissions', tk('Submissions')], ['published', tk('Published')], ['alerts', tk('Alerts')], ['accounts', tk('Accounts')], ['audit', tk('Log')]];
const tabs = (cur) => `<nav class="tabs" style="grid-template-columns:repeat(auto-fit,minmax(96px,1fr))" aria-label="${esc(t('Admin sections'))}">${TABS.map(([id, l]) => `<a href="#admin/${id}" ${id === cur ? 'aria-current="page"' : ''}>${esc(t(l))}</a>`).join('')}</nav>`;
// Names of logged admin actions (the log stores the code; this shows it in words).
const ACTION = {
  'responder.approve': tk('Approved a responder'), 'responder.deny': tk('Denied a responder request'), 'responder.revoke': tk('Revoked responder access'),
  'submission.approve': tk('Approved a record'), 'submission.approve.edited': tk('Edited and approved a record'), 'submission.reject': tk('Rejected a record'),
  'community.unpublish': tk('Unpublished a record'), 'community.edit': tk('Edited a published record'), 'push.send': tk('Sent an alert'), 'push.test': tk('Sent a test alert to own device'),
  'user.find': tk('Looked up an account'), 'user.delete': tk('Deleted an account'), 'user.reset_code': tk('Gave a password reset code'),
  'admin.claim_code': tk('Gave an admin confirmation code'), 'admin.claim': tk('Confirmed admin access'), 'admin.recovery': tk('Admin recovery code used (new password, admin confirmed)'),
  'account.password_reset': tk('Password reset with a code'),
};

async function admin(parts) {
  if (!ctx.me?.isAdmin) return { html: `<h2>${t('Admin')}</h2><div class="card"><p>${t('This area is for administrators.')}</p>${ctx.me?.adminPending ? `<p><a href="#settings">${t('Confirm admin access in Settings')}</a></p>` : ''}</div>` };
  const tab = TABS.some(([id]) => id === parts[0]) ? parts[0] : 'responders';
  const head = `<h2>${t('Admin')}</h2>${tabs(tab)}`;
  const done = (msg) => { ctx.flash = esc(msg); clearCommunityCache(); ctx.render(); };
  const fail = (el, x) => { el.textContent = t(x.message); };

  if (tab === 'responders') {
    const all = await api.adminListResponders();
    const row = (r, actions) => `<li data-resp="${esc(r.uid)}"><b>${esc(r.name)}</b>${r.org ? ' · ' + esc(r.org) : ''}<br><span class="small">${esc(r.email)} · ${esc(t('requested {date}', { date: fmtDate(r.requestedAt) }))}${r.decidedAt ? ' · ' + esc(t('decided {date}', { date: fmtDate(r.decidedAt) })) : ''}</span>${r.reason ? `<p class="small">${t('Reason:')} ${esc(r.reason)}</p>` : ''}${actions}</li>`;
    const pending = all.filter((r) => r.status === 'pending'), approved = all.filter((r) => r.status === 'approved'), other = all.filter((r) => r.status === 'denied' || r.status === 'revoked');
    return { html: `${head}<h3>${esc(t('Waiting for approval ({n})', { n: pending.length }))}</h3>
      ${pending.length ? `<ul class="list">${pending.map((r) => row(r, `<label for="rr_${esc(r.uid)}">${t('Reason if denying (optional)')}</label><input id="rr_${esc(r.uid)}" maxlength="300"><p class="err" role="alert"></p><button class="btn" data-act="approve">${t('Approve')}</button><button class="btn danger" data-act="deny">${t('Deny')}</button>`)).join('')}</ul>` : `<p class="small">${t('No requests.')}</p>`}
      <h3>${esc(t('Approved responders ({n})', { n: approved.length }))}</h3>
      ${approved.length ? `<ul class="list">${approved.map((r) => row(r, `<label for="rr_${esc(r.uid)}">${t('Reason for removing access (optional)')}</label><input id="rr_${esc(r.uid)}" maxlength="300"><p class="err" role="alert"></p><button class="btn danger" data-act="revoke">${t('Revoke access')}</button><p class="small">${t('Revoking also turns off all of this responder\'s share codes.')}</p>`)).join('')}</ul>` : `<p class="small">${t('None yet.')}</p>`}
      ${other.length ? `<h3>${esc(t('Denied or revoked ({n})', { n: other.length }))}</h3><ul class="list">${other.map((r) => row(r, `<p class="small">${esc(t(RESPONDER_STATUS[r.status]))}</p><p class="err" role="alert"></p><button class="btn secondary" data-act="approve">${t('Approve after all')}</button>`)).join('')}</ul>` : ''}`,
    bind() {
      $$('[data-resp] [data-act]').forEach((b) => (b.onclick = async () => { const li = b.closest('[data-resp]'); const act = b.dataset.act;
        if (act !== 'approve' && !confirm(act === 'deny' ? t('Deny this responder request?') : t('Remove this responder\'s access and turn off their share codes?'))) return;
        try { await api.adminDecideResponder(li.dataset.resp, act, li.querySelector('input')?.value || ''); done({ approve: t('Responder approved.'), deny: t('Request denied.'), revoke: t('Access revoked.') }[act]); } catch (x) { fail(li.querySelector('.err'), x); } }));
    } };
  }

  if (tab === 'submissions') {
    const pending = await api.adminListSubmissions('pending');
    return { html: `${head}<h3>${esc(t('Waiting for review ({n})', { n: pending.length }))}</h3><p class="small">${t('Check each record against its source link. You can fix anything before approving. Only approved records are shown to the public.')}</p>
      ${pending.length ? pending.map((x, i) => `<form class="card" data-sub="${esc(x.id)}" data-owner="${esc(x.uid)}" novalidate><p class="small">${esc(t('From {name}', { name: x.submitter?.name || '' }))}${x.submitter?.org ? ' · ' + esc(x.submitter.org) : ''} · ${esc(t('sent {date}', { date: fmtDate(x.createdAt) }))}</p>
        ${subFields(x.record, 'a' + i)}<label for="a${i}_reason">${t('Reason if rejecting (optional, the responder sees it)')}</label><input id="a${i}_reason" name="_reason" maxlength="300">
        <p class="err" role="alert"></p><button class="btn" type="submit" data-act="approve">${t('Approve')}</button><button class="btn danger" type="button" data-act="reject">${t('Reject')}</button></form>`).join('') : `<p class="small">${t('Nothing to review.')}</p>`}`,
    bind() {
      $$('form[data-sub]').forEach((f) => {
        const orig = pending.find((x) => x.id === f.dataset.sub).record;
        const go = async (act) => { const { _reason, ...rec } = formObj(f);
          const changed = changedFields(rec, orig).length > 0;
          try { await api.adminDecideSubmission(f.dataset.owner, f.dataset.sub, act, act === 'approve' && changed ? rec : null, act === 'reject' ? _reason : '');
            done(act === 'approve' ? (changed ? t('Edited and approved. It is now public.') : t('Approved. It is now public.')) : t('Rejected. It will not be shown.')); } catch (x) { fail(f.querySelector('.err'), x); } };
        f.onsubmit = (e) => { e.preventDefault(); go('approve'); };
        f.querySelector('[data-act="reject"]').onclick = () => go('reject');
      });
    } };
  }

  if (tab === 'published') {
    const list = await api.listCommunity();
    return { html: `${head}<h3>${esc(t('Published records ({n})', { n: list.length }))}</h3><p class="small">${t('You can fix a published record here. Each change is saved in the Log with the names of the fields you changed.')}</p>${list.length ? `<ul class="list">${list.map((r, i) => `<li data-pub="${esc(r.id)}"><b>${esc(r.title)}</b><br><span class="small">${where(r)} · ${esc(t('approved {date}', { date: fmtDate(r.approvedAt) }))}${r.editedAt ? ' · ' + esc(t('edited {date}', { date: fmtDate(r.editedAt) })) : ''}</span>
        <details class="edit"><summary>${t('Edit this record')}</summary><form data-edit="${esc(r.id)}" novalidate>${subFields(r, 'p' + i)}<label for="p${i}_reason">${t('Why are you changing it? (optional, saved in the Log)')}</label><input id="p${i}_reason" name="_reason" maxlength="300"><p class="err" role="alert"></p><button class="btn" type="submit">${t('Save changes')}</button></form></details>
        <label for="up_${esc(r.id)}">${t('Reason for unpublishing (optional)')}</label><input id="up_${esc(r.id)}" data-upr maxlength="300"><p class="err" role="alert" data-uperr></p><button class="btn danger" data-unpub>${t('Unpublish')}</button></li>`).join('')}</ul>` : `<p class="small">${t('None yet.')}</p>`}`,
    bind() {
      $$('[data-unpub]').forEach((b) => (b.onclick = async () => { const li = b.closest('[data-pub]'); if (!confirm(t('Remove this record from the public lists?'))) return;
        try { await api.adminUnpublish(li.dataset.pub, li.querySelector('[data-upr]').value); done(t('Unpublished.')); } catch (x) { fail(li.querySelector('[data-uperr]'), x); } }));
      $$('form[data-edit]').forEach((f) => (f.onsubmit = async (e) => { e.preventDefault(); const errEl = f.querySelector('.err'); errEl.textContent = '';
        const orig = list.find((r) => r.id === f.dataset.edit); const { _reason, ...rec } = formObj(f); const ch = changedFields(rec, orig);
        if (!ch.length) { errEl.textContent = t('Nothing was changed.'); return; }
        try { await api.adminEditPublished(f.dataset.edit, Object.fromEntries(ch.map((k) => [k, rec[k]])), _reason); done(t('Saved. The public record is updated.')); } catch (x) { fail(errEl, x); } }));
    } };
  }

  if (tab === 'alerts') return pushAdmin(head);
  if (tab === 'accounts') return accountsAdmin(head);

  const log = await api.adminAudit();
  const fieldsOf = (e) => (e.fields?.length ? `<p class="small">${esc(t('Changed: {fields}', { fields: e.fields.map((k) => t(FIELD_LABEL[k] || k)).join(', ') }))}</p>` : '');
  return { html: `${head}<h3>${t('Admin actions')}</h3><p class="small">${t('Who did what and when. Client information is never recorded here.')}</p>
    ${log.length ? `<ul class="list" id="audit">${log.map((e) => `<li data-action="${esc(e.action)}"><b>${esc(ACTION[e.action] ? t(ACTION[e.action]) : e.action)}</b> <span class="small">${esc(e.action)} · ${esc(e.target || '')}</span><br><span class="small">${esc(e.admin)} · ${esc(when(e.at))}</span>${fieldsOf(e)}${e.reason ? `<p class="small">${t('Reason:')} ${esc(e.reason)}</p>` : ''}</li>`).join('')}</ul>` : `<p class="small">${t('No actions yet.')}</p>`}` };
}

export const adminScreens = { submit, admin };

const targetText = (tg) => (tg === 'statewide' ? t('Statewide') : tg === 'test' ? t('Test: own device only') : (Array.isArray(tg) ? tg : [tg]).map((c) => t('{county} County', { county: c })).join(', '));

// Admin: compose and send an alert (Web Push) with a confirmation step, a test send to this device only, and the send log.
async function pushAdmin(head) {
  const log = await api.adminPushLog().catch(() => []);
  const picked = new Set();
  const chips = () => (picked.size ? `<ul class="chips" id="pa_chips">${[...picked].sort().map((c) => `<li>${esc(t('{county} County', { county: c }))} <button type="button" class="chipx" data-rm="${esc(c)}" aria-label="${esc(t('Remove {county} County', { county: c }))}">×</button></li>`).join('')}</ul>` : `<p class="small" id="pa_chips">${t('No counties chosen.')}</p>`);
  return { html: `${head}<h3>${t('Send an alert')}</h3>
    <p class="small">${t('Keep alerts short, true and useful. Check facts and links first. Never include personal information.')}</p>
    <form class="card" id="pa" novalidate>
      <fieldset><legend>${t('Send to')}</legend>
        <label class="opt"><input type="radio" name="scope" value="statewide" id="pa_state" checked><span>${t('Statewide: every device with alerts turned on (including people who chose only counties)')}</span></label>
        <label class="opt"><input type="radio" name="scope" value="counties" id="pa_cty"><span>${t('Only the counties I choose (devices that chose at least one of them)')}</span></label>
        <div id="pa_countybox" class="hide"><label for="pa_county">${t('Add a county')}</label>
          <div class="row"><select id="pa_county"><option value="">${t('Choose…')}</option>${NC_COUNTIES.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select><button type="button" class="btn secondary" id="pa_add">${t('Add county')}</button></div>
          <div id="pa_chipbox">${chips()}</div></div>
      </fieldset>
      <label for="pa_title">${t('Title (English)')}</label><input id="pa_title" name="title" maxlength="80" required aria-describedby="pa_err">
      <label for="pa_body">${t('Message (English)')}</label><textarea id="pa_body" name="body" maxlength="300" required aria-describedby="pa_err"></textarea>
      <label for="pa_titleEs">${t('Title (Spanish)')}</label><input id="pa_titleEs" name="titleEs" maxlength="80" lang="es" aria-describedby="pa_eshelp">
      <label for="pa_bodyEs">${t('Message (Spanish)')}</label><textarea id="pa_bodyEs" name="bodyEs" maxlength="300" lang="es" aria-describedby="pa_eshelp"></textarea>
      <p class="small" id="pa_eshelp">${t('Please add the Spanish version. If it is empty, people who use the app in Spanish get the English text.')}</p>
      <label for="pa_url">${t('Link when tapped (optional)')} <span class="small">${t('(a page in this app like /hotels, or https://)')}</span></label><input id="pa_url" name="url" maxlength="500" placeholder="/">
      <p class="err" id="pa_err" role="alert"></p>
      <div id="pa_confirm" class="note hide" role="status" aria-live="polite"></div>
      <button class="btn" type="submit" id="pa_review">${t('Review before sending')}</button>
      <button class="btn danger hide" type="button" id="pa_send">${t('Send now')}</button>
      <button class="btn secondary hide" type="button" id="pa_cancel">${t('Change the message')}</button>
      <button class="btn secondary" type="button" id="pa_test">${t('Send test to my device only')}</button>
      <p class="small">${t('The test goes only to this phone or computer. Turn on alerts on this device first (Alerts page). Nobody else gets it.')}</p>
    </form>
    <h3>${t('Sent alerts')}</h3>${log.length ? `<ul class="list" id="pushlog">${log.map((e) => `<li><b>${esc(e.title)}</b> <span class="small">${esc(targetText(e.target))}</span><br><span class="small">${esc(e.admin)} · ${esc(when(e.at))} · ${esc(t('{sent} delivered, {failed} failed, {removed} expired removed', { sent: e.sent, failed: e.failed, removed: e.removed }))}${e.hasSpanish ? '' : ' · ' + esc(t('no Spanish version'))}</span><p class="small">${esc(e.body)}</p></li>`).join('')}</ul>` : `<p class="small">${t('No alerts sent yet.')}</p>`}` ,
  bind() {
    const f = $('#pa'), errEl = $('#pa_err'), box = $('#pa_confirm'); let msg = null;
    const scope = () => (f.querySelector('input[name=scope]:checked')?.value || 'statewide');
    const target = () => (scope() === 'statewide' ? 'statewide' : [...picked].sort());
    const redraw = () => { $('#pa_chipbox').innerHTML = chips(); $$('#pa_chipbox [data-rm]').forEach((b) => (b.onclick = () => { picked.delete(b.dataset.rm); redraw(); $('#pa_county').focus(); })); };
    $$('input[name=scope]').forEach((r) => (r.onchange = () => $('#pa_countybox').classList.toggle('hide', scope() !== 'counties')));
    $('#pa_add').onclick = () => { const c = $('#pa_county').value; errEl.textContent = ''; if (!c) { errEl.textContent = t('Choose a county first.'); $('#pa_county').focus(); return; } picked.add(c); redraw(); };
    const lock = (on) => [...f.elements].forEach((x) => { if (!['pa_send', 'pa_cancel'].includes(x.id)) x.disabled = on; });
    const reset = () => { msg = null; box.classList.add('hide'); $('#pa_send').classList.add('hide'); $('#pa_cancel').classList.add('hide'); $('#pa_review').classList.remove('hide'); $('#pa_test').classList.remove('hide'); lock(false); };
    const check = (m) => {
      if (!m.title.trim()) { errEl.textContent = t('Please enter a title.'); $('#pa_title').focus(); return false; }
      if (!m.body.trim()) { errEl.textContent = t('Please enter a message.'); $('#pa_body').focus(); return false; }
      if (!!m.titleEs.trim() !== !!m.bodyEs.trim()) { errEl.textContent = t('For Spanish, fill in both the title and the message, or leave both empty.'); return false; }
      return true;
    };
    const noEs = (m) => (!m.titleEs.trim() ? `<p class="warn-text" id="pa_nospanish"><b>${t('Warning: there is no Spanish version.')}</b> ${t('People who use the app in Spanish will get the English text. You can still send it.')}</p>` : '');
    f.onsubmit = async (e) => { e.preventDefault(); errEl.textContent = '';
      const { scope: _s, ...m } = formObj(f); if (!check(m)) return;
      const tg = target(); if (tg !== 'statewide' && !tg.length) { errEl.textContent = t('Choose at least one county, or choose Statewide.'); $('#pa_county').focus(); return; }
      try { const { count } = await api.adminPushCount(tg); msg = { ...m, target: tg };
        box.innerHTML = `<b>${count === 1 ? t('Send this alert to 1 device?') : esc(t('Send this alert to {n} devices?', { n: count }))}</b><br><span class="small">${esc(t('Sending to: {target}', { target: targetText(tg) }))}</span><br>${esc(m.title)}: ${esc(m.body)}${m.titleEs ? `<br><span lang="es">${esc(m.titleEs)}: ${esc(m.bodyEs)}</span>` : ''}${noEs(m)}<br><span class="small">${t('This cannot be undone.')}</span>`;
        box.classList.remove('hide'); $('#pa_review').classList.add('hide'); $('#pa_test').classList.add('hide'); $('#pa_send').classList.remove('hide'); $('#pa_cancel').classList.remove('hide');
        lock(true); $('#pa_send').focus();
      } catch (x) { errEl.textContent = t(x.message); } };
    $('#pa_cancel').onclick = () => { reset(); $('#pa_title').focus(); };
    $('#pa_send').onclick = async () => { if (!msg) return; $('#pa_send').disabled = true;
      try { const r = await api.adminPushSend(msg, true); ctx.flash = esc(t('Alert sent: {sent} delivered, {failed} failed, {removed} expired removed.', { sent: r.sent, failed: r.failed, removed: r.removed })); ctx.render(); }
      catch (x) { reset(); errEl.textContent = t(x.message); } };
    $('#pa_test').onclick = async () => { errEl.textContent = ''; const { scope: _s, ...m } = formObj(f); if (!check(m)) return;
      const sub = await currentSub().catch(() => null);
      if (!sub) { errEl.textContent = t('Alerts are not turned on for this device. Turn them on in Alerts first, then send the test.'); return; }
      $('#pa_test').disabled = true;
      try { const r = await api.adminPushTest(sub.toJSON(), m, getLang()); box.innerHTML = `<b>${r.sent ? t('Test sent to this device only.') : t('The test could not be delivered to this device.')}</b>${noEs(m)}`; box.classList.remove('hide'); }
      catch (x) { errEl.textContent = t(x.message); } finally { $('#pa_test').disabled = false; } };
  } };
}

// Admin: find an account by email, give a one-time code (password reset or admin confirmation), or delete it.
async function accountsAdmin(head) {
  const ROLE = { affected: tk('Person affected by a disaster'), responder: tk('Disaster responder') };
  const view = (u) => {
    if (!u.found) return `<p class="note" role="status">${t('No account uses that email.')}</p>`;
    const c = u.counts;
    return `<div class="card" id="ua_card"><h3>${esc(u.name)}</h3>
      <p class="small">${esc(u.email)} · ${esc(t(ROLE[u.role] || u.role))}${u.org ? ' · ' + esc(u.org) : ''} · ${esc(t('created {date}', { date: fmtDate(u.createdAt) }))}</p>
      ${u.responderStatus ? `<p class="small">${t('Responder status:')} ${esc(t(RESPONDER_STATUS[u.responderStatus] || u.responderStatus))}</p>` : ''}
      ${u.adminEmail ? `<p class="small">${u.adminConfirmed ? t('Administrator (confirmed).') : t('This email is on the administrator list but admin access is not confirmed yet.')}</p>` : ''}
      <p class="small">${esc(t('Saved in this account: {cases} case numbers, {notes} notes, {referrals} referrals, {cards} share cards, {subs} submitted records.', { cases: c.cases, notes: c.notes, referrals: c.referrals, cards: c.shareCards, subs: c.submissions }))}</p>
      ${u.isSelf ? `<p class="note">${t('This is your own account. To delete it, use Settings.')}</p>` : `
      <div id="ua_codebox" role="status" aria-live="polite"></div>
      <button class="btn secondary" type="button" id="ua_reset">${t('Give a password reset code')}</button>
      ${u.adminEmail && !u.adminConfirmed ? `<button class="btn secondary" type="button" id="ua_claim">${t('Give an admin confirmation code')}</button>` : ''}
      <p class="small">${t('Codes work once, expire, and are shown only now. Give the code to the person by phone or in person, after you check who they are. Never send it to an email address you have not confirmed.')}</p>
      <h4>${t('Delete this account permanently')}</h4>
      <p class="small">${t('This removes the account, profile, saved case numbers, notes, referrals, share cards, responder request, submitted records not yet published, open codes, and signs the person out everywhere. Records already published stay public (they carry no submitter identity). It cannot be undone.')}</p>
      <form id="ua_del" novalidate><label for="ua_confirm">${t('To confirm, type the account email')}</label><input id="ua_confirm" type="email" autocomplete="off" spellcheck="false">
        <label for="ua_reason">${t('Reason (optional, saved in the Log; do not include names)')}</label><input id="ua_reason" maxlength="300">
        <p class="err" role="alert" id="ua_derr"></p><button class="btn danger" type="submit">${t('Delete account permanently')}</button></form>`}
    </div>`;
  };
  return { html: `${head}<h3>${t('Accounts')}</h3><p class="small">${t('Find an account by its email to give a password reset code or to delete the account and all its data. Each action is saved in the Log without the person\'s name or email.')}</p>
    <form class="card" id="ua" novalidate><label for="ua_email">${t('Email')}</label><input id="ua_email" type="email" autocomplete="off" spellcheck="false" required>
      <p class="err" role="alert" id="ua_err"></p><button class="btn" type="submit">${t('Find account')}</button></form><div id="ua_out"></div>`,
  bind() {
    let u = null;
    $('#ua').onsubmit = async (e) => { e.preventDefault(); $('#ua_err').textContent = ''; const email = $('#ua_email').value.trim();
      if (!email) { $('#ua_err').textContent = t('Enter a valid email address.'); return; }
      try { u = await api.adminFindUser(email); $('#ua_out').innerHTML = view(u); bindUser(); $('#ua_out h3, #ua_out .note')?.focus?.(); } catch (x) { $('#ua_err').textContent = t(x.message); } };
    const showCode = (r, label) => { $('#ua_codebox').innerHTML = `<div class="note" id="ua_code"><b>${esc(label)}</b> <span class="code" style="font-size:1.4em;letter-spacing:.08em">${esc(r.code)}</span><br><span class="small">${esc(t('Expires {when}. It works once.', { when: when(r.expiresAt) }))}</span></div>`; };
    const bindUser = () => {
      if (!u?.found || u.isSelf) return;
      $('#ua_reset').onclick = async () => { if (!confirm(t('Give a one-time password reset code for this account?'))) return;
        try { showCode(await api.adminIssueReset(u.id), t('Password reset code:')); } catch (x) { $('#ua_codebox').textContent = t(x.message); } };
      $('#ua_claim') && ($('#ua_claim').onclick = async () => { try { showCode(await api.adminIssueClaim(u.id), t('Admin confirmation code:')); } catch (x) { $('#ua_codebox').textContent = t(x.message); } });
      $('#ua_del').onsubmit = async (e) => { e.preventDefault(); const errEl = $('#ua_derr'); errEl.textContent = '';
        if ($('#ua_confirm').value.trim().toLowerCase() !== u.email) { errEl.textContent = t('The email you typed does not match this account.'); $('#ua_confirm').focus(); return; }
        if (!confirm(t('Delete this account and all its data permanently? This cannot be undone.'))) return;
        try { await api.adminDeleteUser(u.id, $('#ua_confirm').value, true, $('#ua_reason').value); ctx.flash = esc(t('The account and all its data were deleted.')); ctx.render(); } catch (x) { errEl.textContent = t(x.message); } };
    };
  } };
}
