// Responder record submissions (#submit) and the admin area (#admin). The server enforces every rule;
// these screens only hide what a person cannot use. Admins never see client notes: no API returns them.
import { ctx } from '../ctx.js';
import { api, ADAPTER } from '../data/index.js';
import { NC_COUNTIES, SUB_KINDS, SUB_CATEGORIES, RESPONDER_STATUS } from '../data/shared.js';
import { $, $$, esc, fmtDate } from '../ui.js';
import { clearCommunityCache } from '../community.js';
import { t, getLang } from '../i18n/index.js';

const opts = (map, cur) => Object.entries(map).map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`).join('');
const countyOpts = (cur) => ['Statewide', ...NC_COUNTIES].map((c) => `<option ${c === cur ? 'selected' : ''}>${esc(c)}</option>`).join('');
// Same fields for the responder form and the admin edit form; p keeps ids unique.
export const subFields = (r = {}, p = 's') => `
  <label for="${p}_kind">What is it?</label><select id="${p}_kind" name="kind"><option value="">Choose…</option>${opts(SUB_KINDS, r.kind)}</select>
  <label for="${p}_category">Category</label><select id="${p}_category" name="category"><option value="">Choose…</option>${opts(SUB_CATEGORIES, r.category)}</select>
  <label for="${p}_county">County</label><select id="${p}_county" name="county"><option value="">Choose…</option>${countyOpts(r.county)}</select>
  <label for="${p}_title">Name or title</label><input id="${p}_title" name="title" maxlength="160" value="${esc(r.title || '')}">
  <label for="${p}_description">Description <span class="small">(who it helps, hours, how to get it)</span></label><textarea id="${p}_description" name="description" maxlength="2000">${esc(r.description || '')}</textarea>
  <label for="${p}_phone">Phone number</label><input id="${p}_phone" name="phone" type="tel" inputmode="tel" maxlength="40" value="${esc(r.phone || '')}">
  <label for="${p}_url">Link <span class="small">(https://)</span></label><input id="${p}_url" name="url" type="url" placeholder="https://" value="${esc(r.url || '')}">
  <label for="${p}_sourceUrl">Source link <span class="small">(where an admin can check this, https://)</span></label><input id="${p}_sourceUrl" name="sourceUrl" type="url" placeholder="https://" value="${esc(r.sourceUrl || '')}">`;
const formObj = (f) => Object.fromEntries(new FormData(f));
const statusBadge = (s) => `<span class="badge ${s === 'approved' ? 'ok' : s === 'pending' ? 's-waiting' : 's-not_started'}">${esc({ pending: 'Waiting for review', approved: 'Approved', rejected: 'Not approved' }[s] || s)}</span>`;
const where = (r) => `${esc(SUB_KINDS[r.kind] || '')} · ${esc(SUB_CATEGORIES[r.category] || '')} · ${esc(r.county === 'Statewide' ? 'Statewide' : r.county + ' County')}`;

export const responderNotice = (me) => {
  if (!me || me.role !== 'responder' || me.isAdmin || me.responderStatus === 'approved') return '';
  if (me.responderStatus === 'pending') return `<div class="note" id="pending-note" role="status"><b>${t('Your responder account is waiting for admin approval.')}</b> ${t('You can use the app like anyone else. Share cards and record submissions open once an administrator approves you.')}</div>`;
  return `<div class="note" id="pending-note" role="status"><b>${me.responderStatus === 'revoked' ? t('Your responder access is turned off.') : t('Your responder access is not approved.')}</b>${me.responderReason ? ' ' + t('Reason:') + ' ' + esc(me.responderReason) + '.' : ''} ${t('Contact the administrator if you think this is a mistake.')}</div>`;
};
const canRespond = (me) => me && (me.isAdmin || (me.role === 'responder' && me.responderStatus === 'approved'));

async function submit() {
  const me = ctx.me;
  if (ADAPTER === 'local') return { html: '<h2>Add a resource</h2><div class="card"><p>Adding resources needs the online version of the app.</p></div>' };
  if (!canRespond(me)) return { html: `<h2>Add a resource</h2>${responderNotice(me) || '<div class="card"><p>Only approved responder accounts can add resources.</p></div>'}` };
  const mine = await api.mySubmissions();
  return { html: `<h2>Add a resource</h2>
    <p>Know an organization, service, shelter, phone number or link that should be listed? Send it in. An administrator checks it against your source link before anyone sees it.</p>
    <div class="card warn"><h3>Public information only</h3><p>Approved records are shown to everyone. Never include client names or anything private.</p></div>
    <form id="f" class="card" novalidate>${subFields({}, 's')}<p class="err" role="alert" id="err"></p><button class="btn" type="submit">Send for review</button></form>
    <h3>What I sent</h3>${mine.length ? `<ul class="list" id="mine">${mine.map((x) => `<li data-sub="${esc(x.id)}"><b>${esc(x.record.title)}</b> ${statusBadge(x.status)}<br><span class="small">${where(x.record)} · sent ${esc(fmtDate(x.createdAt))}</span>${x.status === 'rejected' && x.reason ? `<p class="small">Reason: ${esc(x.reason)}</p>` : ''}</li>`).join('')}</ul>` : '<p class="small">Nothing yet.</p>'}`,
  bind() {
    $('#f').onsubmit = async (e) => { e.preventDefault();
      try { await api.submitRecord(formObj(e.target)); ctx.flash = 'Sent. An administrator will review it.'; ctx.render(); } catch (x) { $('#err').textContent = x.message; } };
  } };
}

const TABS = [['responders', 'Responders'], ['submissions', 'Submissions'], ['published', 'Published'], ['alerts', 'Alerts'], ['audit', 'Log']];
const tabs = (cur) => `<nav class="tabs" style="grid-template-columns:repeat(auto-fit,minmax(96px,1fr))" aria-label="Admin sections">${TABS.map(([id, l]) => `<a href="#admin/${id}" ${id === cur ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;

async function admin(parts) {
  if (!ctx.me?.isAdmin) return { html: '<h2>Admin</h2><div class="card"><p>This area is for administrators.</p></div>' };
  const tab = TABS.some(([id]) => id === parts[0]) ? parts[0] : 'responders';
  const head = `<h2>Admin</h2>${tabs(tab)}`;
  const done = (msg) => { ctx.flash = msg; clearCommunityCache(); ctx.render(); };
  const fail = (el, x) => { el.textContent = x.message; };

  if (tab === 'responders') {
    const all = await api.adminListResponders();
    const row = (r, actions) => `<li data-resp="${esc(r.uid)}"><b>${esc(r.name)}</b>${r.org ? ' · ' + esc(r.org) : ''}<br><span class="small">${esc(r.email)} · requested ${esc(fmtDate(r.requestedAt))}${r.decidedAt ? ' · decided ' + esc(fmtDate(r.decidedAt)) : ''}</span>${r.reason ? `<p class="small">Reason: ${esc(r.reason)}</p>` : ''}${actions}</li>`;
    const pending = all.filter((r) => r.status === 'pending'), approved = all.filter((r) => r.status === 'approved'), other = all.filter((r) => r.status === 'denied' || r.status === 'revoked');
    return { html: `${head}<h3>Waiting for approval (${pending.length})</h3>
      ${pending.length ? `<ul class="list">${pending.map((r) => row(r, `<label for="rr_${esc(r.uid)}">Reason if denying (optional)</label><input id="rr_${esc(r.uid)}" maxlength="300"><p class="err" role="alert"></p><button class="btn" data-act="approve">Approve</button><button class="btn danger" data-act="deny">Deny</button>`)).join('')}</ul>` : '<p class="small">No requests.</p>'}
      <h3>Approved responders (${approved.length})</h3>
      ${approved.length ? `<ul class="list">${approved.map((r) => row(r, `<label for="rr_${esc(r.uid)}">Reason for removing access (optional)</label><input id="rr_${esc(r.uid)}" maxlength="300"><p class="err" role="alert"></p><button class="btn danger" data-act="revoke">Revoke access</button><p class="small">Revoking also turns off all of this responder's share codes.</p>`)).join('')}</ul>` : '<p class="small">None yet.</p>'}
      ${other.length ? `<h3>Denied or revoked (${other.length})</h3><ul class="list">${other.map((r) => row(r, `<p class="small">${esc(RESPONDER_STATUS[r.status])}</p><p class="err" role="alert"></p><button class="btn secondary" data-act="approve">Approve after all</button>`)).join('')}</ul>` : ''}`,
    bind() {
      $$('[data-resp] [data-act]').forEach((b) => (b.onclick = async () => { const li = b.closest('[data-resp]'); const act = b.dataset.act;
        if (act !== 'approve' && !confirm(act === 'deny' ? 'Deny this responder request?' : 'Remove this responder\'s access and turn off their share codes?')) return;
        try { await api.adminDecideResponder(li.dataset.resp, act, li.querySelector('input')?.value || ''); done({ approve: 'Responder approved.', deny: 'Request denied.', revoke: 'Access revoked.' }[act]); } catch (x) { fail(li.querySelector('.err'), x); } }));
    } };
  }

  if (tab === 'submissions') {
    const pending = await api.adminListSubmissions('pending');
    return { html: `${head}<h3>Waiting for review (${pending.length})</h3><p class="small">Check each record against its source link. You can fix anything before approving. Only approved records are shown to the public.</p>
      ${pending.length ? pending.map((x, i) => `<form class="card" data-sub="${esc(x.id)}" data-owner="${esc(x.uid)}" novalidate><p class="small">From ${esc(x.submitter?.name || '')}${x.submitter?.org ? ' · ' + esc(x.submitter.org) : ''} · sent ${esc(fmtDate(x.createdAt))}</p>
        ${subFields(x.record, 'a' + i)}<label for="a${i}_reason">Reason if rejecting (optional, the responder sees it)</label><input id="a${i}_reason" name="_reason" maxlength="300">
        <p class="err" role="alert"></p><button class="btn" type="submit" data-act="approve">Approve</button><button class="btn danger" type="button" data-act="reject">Reject</button></form>`).join('') : '<p class="small">Nothing to review.</p>'}`,
    bind() {
      $$('form[data-sub]').forEach((f) => {
        const orig = pending.find((x) => x.id === f.dataset.sub).record;
        const go = async (act) => { const { _reason, ...rec } = formObj(f);
          const changed = Object.keys(rec).some((k) => (rec[k] || '') !== (orig[k] || ''));
          try { await api.adminDecideSubmission(f.dataset.owner, f.dataset.sub, act, act === 'approve' && changed ? rec : null, act === 'reject' ? _reason : '');
            done(act === 'approve' ? (changed ? 'Edited and approved. It is now public.' : 'Approved. It is now public.') : 'Rejected. It will not be shown.'); } catch (x) { fail(f.querySelector('.err'), x); } };
        f.onsubmit = (e) => { e.preventDefault(); go('approve'); };
        f.querySelector('[data-act="reject"]').onclick = () => go('reject');
      });
    } };
  }

  if (tab === 'published') {
    const list = await api.listCommunity();
    return { html: `${head}<h3>Published records (${list.length})</h3>${list.length ? `<ul class="list">${list.map((r) => `<li data-pub="${esc(r.id)}"><b>${esc(r.title)}</b><br><span class="small">${where(r)} · approved ${esc(fmtDate(r.approvedAt))}</span><label for="up_${esc(r.id)}">Reason (optional)</label><input id="up_${esc(r.id)}" maxlength="300"><p class="err" role="alert"></p><button class="btn danger" data-unpub>Unpublish</button></li>`).join('')}</ul>` : '<p class="small">None yet.</p>'}`,
    bind() { $$('[data-unpub]').forEach((b) => (b.onclick = async () => { const li = b.closest('[data-pub]'); if (!confirm('Remove this record from the public lists?')) return;
      try { await api.adminUnpublish(li.dataset.pub, li.querySelector('input').value); done('Unpublished.'); } catch (x) { fail(li.querySelector('.err'), x); } })); } };
  }

  if (tab === 'alerts') return pushAdmin(head);

  const log = await api.adminAudit();
  return { html: `${head}<h3>Admin actions</h3><p class="small">Who did what and when. Client information is never recorded here.</p>
    ${log.length ? `<ul class="list" id="audit">${log.map((e) => `<li><b>${esc(e.action)}</b> <span class="small">${esc(e.target || '')}</span><br><span class="small">${esc(e.admin)} · ${esc(new Date(e.at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }))}</span>${e.reason ? `<p class="small">Reason: ${esc(e.reason)}</p>` : ''}</li>`).join('')}</ul>` : '<p class="small">No actions yet.</p>'}` };
}

export const adminScreens = { submit, admin };

// Admin: compose and send an alert (Web Push) with a confirmation step, plus the send log.
async function pushAdmin(head) {
  const log = await api.adminPushLog().catch(() => []);
  const when = (x) => new Date(x).toLocaleString(getLang() === 'es' ? 'es-US' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
  return { html: `${head}<h3>${t('Send an alert')}</h3>
    <p class="small">${t('Alerts go to every device that chose this topic. Keep them short, true and useful. Check facts and links first. Never include personal information.')}</p>
    <form class="card" id="pa" novalidate>
      <label for="pa_target">${t('Send to')}</label><select id="pa_target" name="target"><option value="statewide">${t('Statewide (everyone who chose statewide news)')}</option>${NC_COUNTIES.map((c) => `<option value="${esc(c)}">${esc(t('{county} County', { county: c }))}</option>`).join('')}</select>
      <label for="pa_title">${t('Title (English)')}</label><input id="pa_title" name="title" maxlength="80" required aria-describedby="pa_err">
      <label for="pa_body">${t('Message (English)')}</label><textarea id="pa_body" name="body" maxlength="300" required aria-describedby="pa_err"></textarea>
      <label for="pa_titleEs">${t('Title (Spanish, optional)')}</label><input id="pa_titleEs" name="titleEs" maxlength="80" lang="es">
      <label for="pa_bodyEs">${t('Message (Spanish, optional)')}</label><textarea id="pa_bodyEs" name="bodyEs" maxlength="300" lang="es"></textarea>
      <label for="pa_url">${t('Link when tapped (optional)')} <span class="small">${t('(a page in this app like /hotels, or https://)')}</span></label><input id="pa_url" name="url" maxlength="500" placeholder="/">
      <p class="err" id="pa_err" role="alert"></p>
      <div id="pa_confirm" class="note hide" role="status" aria-live="polite"></div>
      <button class="btn" type="submit" id="pa_review">${t('Review before sending')}</button>
      <button class="btn danger hide" type="button" id="pa_send">${t('Send now')}</button>
      <button class="btn secondary hide" type="button" id="pa_cancel">${t('Change the message')}</button>
    </form>
    <h3>${t('Sent alerts')}</h3>${log.length ? `<ul class="list" id="pushlog">${log.map((e) => `<li><b>${esc(e.title)}</b> <span class="small">${esc(e.target === 'statewide' ? t('Statewide') : t('{county} County', { county: e.target }))}</span><br><span class="small">${esc(e.admin)} · ${esc(when(e.at))} · ${esc(t('{sent} delivered, {failed} failed, {removed} expired removed', { sent: e.sent, failed: e.failed, removed: e.removed }))}</span><p class="small">${esc(e.body)}</p></li>`).join('')}</ul>` : `<p class="small">${t('No alerts sent yet.')}</p>`}` ,
  bind() {
    const f = $('#pa'), errEl = $('#pa_err'), box = $('#pa_confirm'); let msg = null;
    const reset = () => { msg = null; box.classList.add('hide'); $('#pa_send').classList.add('hide'); $('#pa_cancel').classList.add('hide'); $('#pa_review').classList.remove('hide'); [...f.elements].forEach((x) => (x.disabled = false)); };
    f.onsubmit = async (e) => { e.preventDefault(); errEl.textContent = '';
      const m = formObj(f);
      if (!m.title.trim()) { errEl.textContent = t('Please enter a title.'); $('#pa_title').focus(); return; }
      if (!m.body.trim()) { errEl.textContent = t('Please enter a message.'); $('#pa_body').focus(); return; }
      if (!!m.titleEs.trim() !== !!m.bodyEs.trim()) { errEl.textContent = t('For Spanish, fill in both the title and the message, or leave both empty.'); return; }
      try { const { count } = await api.adminPushCount(m.target); msg = m;
        box.innerHTML = `<b>${count === 1 ? t('Send this alert to 1 device?') : t('Send this alert to {n} devices?', { n: count })}</b><br>${esc(m.title)}: ${esc(m.body)}${m.titleEs ? `<br><span lang="es">${esc(m.titleEs)}: ${esc(m.bodyEs)}</span>` : ''}<br><span class="small">${t('This cannot be undone.')}</span>`;
        box.classList.remove('hide'); $('#pa_review').classList.add('hide'); $('#pa_send').classList.remove('hide'); $('#pa_cancel').classList.remove('hide');
        [...f.elements].forEach((x) => { if (!['pa_send', 'pa_cancel'].includes(x.id)) x.disabled = true; }); $('#pa_send').focus();
      } catch (x) { errEl.textContent = t(x.message); } };
    $('#pa_cancel').onclick = () => { reset(); $('#pa_title').focus(); };
    $('#pa_send').onclick = async () => { if (!msg) return; $('#pa_send').disabled = true;
      try { const r = await api.adminPushSend(msg, true); ctx.flash = esc(t('Alert sent: {sent} delivered, {failed} failed, {removed} expired removed.', { sent: r.sent, failed: r.failed, removed: r.removed })); ctx.render(); }
      catch (x) { reset(); errEl.textContent = t(x.message); } };
  } };
}
