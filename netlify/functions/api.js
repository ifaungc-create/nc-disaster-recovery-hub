// Netlify Function: single RPC endpoint used by src/data/remote.js (the default adapter on Netlify).
// Storage: Netlify Blobs (lib/store.js). Per-user records are AES-256-GCM encrypted with a per-user key
// derived from DATA_ENCRYPTION_KEY. Sessions: HMAC-SHA256 bearer tokens (APP_SESSION_SECRET), 12 h. No cookies.
// Fails closed if secrets are missing. Logs no personal data: only the action name and an error class.
// Admin rights need BOTH: the email is in ADMIN_EMAILS AND the account has confirmed it with a one-time code
// (lib/codes.js), OR it was made an administrator by another administrator (Administrators tab: the invite
// itself confirms; status is stored on the account and in the admin registry). Invited admins get a
// temporary password (hash only, 72 h) and must set their own before any other action works.
// Password reset uses one-time codes too; no email service is used.
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { users, data, cards, responders, submissions, community, audit, admins } from './lib/store.js';
import * as codes from './lib/codes.js';
import { hashPassword, verifyPassword, emailIndex, tempPassword } from './lib/crypto.js';
import { sessionSecret, ConfigError, isAdminEmail } from './lib/env.js';
import { limit } from './lib/ratelimit.js';
import * as push from './lib/push.js';
import { KINDS, validateSignup, cleanItem, cleanCard, cardToNote, newCode, normCode, err, cleanSubmission } from '../../src/data/shared.js';

export const SHARE_CARD_DAYS = 30;
const MAX_BODY = 64 * 1024, MAX_ITEMS = 1000, MAX_CARDS = 300, TOKEN_H = 12;
const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;
const mac = (b) => createHmac('sha256', sessionSecret()).update('session:' + b).digest('base64url');
export const sign = (o) => { const b = Buffer.from(JSON.stringify({ ...o, exp: Date.now() + TOKEN_H * 36e5 })).toString('base64url'); return b + '.' + mac(b); };
export const verify = (t = '') => { try { const [b, s] = String(t).split('.'); if (!b || !s || b.length > 400) return null; const want = mac(b); if (want.length !== s.length || !timingSafeEqual(Buffer.from(want), Buffer.from(s))) return null; const o = JSON.parse(Buffer.from(b, 'base64url')); return o.exp > Date.now() && typeof o.uid === 'string' ? o : null; } catch { return null; } };
const json = (status, body, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra } });
const pub = (u) => u && { id: u.id, email: u.email, name: u.name, role: u.role, org: u.org, createdAt: u.createdAt };
// Profile sent to the app: adds admin flag (from ADMIN_EMAILS) and the responder approval status.
// An account is an admin only if its email is in ADMIN_EMAILS and it proved control with a one-time code
// for that same email. Registering an ADMIN_EMAILS address alone gives no admin rights.
export const adminConfirmed = (u) => !!u && (u.adminGranted === true || (isAdminEmail(u.email) && u.adminVerifiedEmail === u.email));
export const TEMP_PW_HOURS = 72;
const tempExpired = (u) => !!u?.mustChangePassword && !(Date.parse(u.tempPwExpiresAt || '') > Date.now());
// While a temporary password is in use, only these actions work (the token also carries mcp: 1).
const MCP_OK = new Set(['getUser', 'changePassword']);
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
async function profile(u) {
  if (!u) return null; const isAdmin = adminConfirmed(u);
  const r = u.role === 'responder' ? await responders.get(u.id) : null;
  return { ...pub(u), isAdmin, adminPending: !isAdmin && isAdminEmail(u.email), ...(u.mustChangePassword ? { mustChangePassword: true, tempPwExpiresAt: u.tempPwExpiresAt, privacyPending: !u.privacyAcceptedAt } : {}), responderStatus: u.role === 'responder' ? (isAdmin ? 'approved' : r?.status || 'pending') : undefined, responderReason: r?.status === 'denied' || r?.status === 'revoked' ? r.reason || '' : undefined };
}
const MAX_PENDING_SUBMISSIONS = 50;
const reasonOf = (v) => (typeof v === 'string' ? v.trim().slice(0, 300) : '');
const now = () => new Date().toISOString();
const live = (c) => c && !c.revoked && c.expiresAt > now();
const strip = ({ ownerId, ...c }) => c;
const normEmail = (e) => String(e || '').trim().toLowerCase().slice(0, 200);
const tokenFor = (u) => sign({ uid: u.id, role: u.role, sv: u.sv || 0, ...(u.mustChangePassword ? { mcp: 1 } : {}) });
// "d***@c4i…": enough for the owner to recognise their own line, not enough to identify anyone else.
export const maskEmail = (e) => { const [l = '', d = ''] = String(e || '').split('@'); return `${l.slice(0, 1)}***@${d.slice(0, 3)}…`; };
// Operator channel: Netlify → disaster-resources-lltd → Logs → Functions → api. One labelled line per code; no email is sent.
const opLog = (label, u, c) => console.log(`[admin-code] ${label} for ${maskEmail(u.email)}: ${c.code} (single use, expires ${c.expiresAt})`);
// Confirmed administrators (registry entries whose account is still a confirmed admin). Stale entries are dropped.
async function activeAdmins() {
  const out = [];
  for (const r of await admins.list()) { const u = await users.get(r.uid); if (adminConfirmed(u)) out.push({ r, u }); else await admins.remove(r.uid); }
  return out;
}
const ensureRegistered = async (u, by = 'ADMIN_EMAILS', source = 'bootstrap') => { if (adminConfirmed(u) && !(await admins.get(u.id))) await admins.put(u.id, { addedAt: u.adminVerifiedAt || u.adminGrantedAt || new Date().toISOString(), addedBy: by, source }); };
// New temporary password fields for an account (the caller merges them in and bumps the session version).
async function tempGrant() {
  const temp = tempPassword(); const expiresAt = new Date(Date.now() + TEMP_PW_HOURS * 36e5).toISOString();
  return { temp, expiresAt, fields: { pw: await hashPassword(temp), mustChangePassword: true, tempPwExpiresAt: expiresAt } };
}
// Removes every record for one account (used by self-service and admin deletion). Published community
// records stay; they carry no submitter identity. Push subscriptions are per device and not linked to accounts.
async function deleteUserData(u) {
  const d = await data.get(u.id);
  for (const code of d.myCards || []) await cards.remove(code);
  await submissions.removeAllFor(u.id); await responders.remove(u.id); await codes.remove(u.id); await admins.remove(u.id);
  await data.remove(u.id); await users.remove(u.id, emailIndex(u.email));
}

export default async (req, context) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  let action = '-';
  try {
    sessionSecret(); // fail closed before touching storage
    if (Number(req.headers.get('content-length') || 0) > MAX_BODY) throw err('Request too large.', 413);
    const text = await req.text(); if (text.length > MAX_BODY) throw err('Request too large.', 413);
    let body; try { body = JSON.parse(text); } catch { throw err('Bad request'); }
    action = typeof body?.action === 'string' ? body.action.slice(0, 40) : '-';
    const a = Array.isArray(body?.args) ? body.args.slice(0, 6) : [];
    const session = verify((req.headers.get('authorization') || '').replace(/^Bearer /, ''));
    let me = null;
    const mustChange = () => err('You must set a new password before you continue.', 403);
    if (session?.mcp && !MCP_OK.has(action)) throw mustChange(); // temporary-password token: nothing else works, public actions included
    const need = async () => {
      if (!session) throw err('Please sign in again.', 401); me = await users.get(session.uid); if (!me || (me.sv || 0) !== (session.sv || 0)) throw err('Please sign in again.', 401);
      if (me.mustChangePassword) { if (tempExpired(me)) throw err('This temporary password has expired. Ask an administrator for a new one.', 401); if (!MCP_OK.has(action)) throw mustChange(); }
      return me.id;
    };
    const needResponder = async () => {
      const id = await need(); if (adminConfirmed(me)) return id;
      if (me.role !== 'responder') throw err('This is for disaster responder accounts.', 403);
      const r = await responders.get(id);
      if (r?.status !== 'approved') throw err(r?.status === 'pending' || !r ? 'Your responder account is waiting for admin approval.' : 'Your responder access is not active. Contact the administrator.', 403);
      return id;
    };
    const needAdmin = async () => { const id = await need(); if (!adminConfirmed(me)) throw err('Administrators only.', 403); await ensureRegistered(me); return id; };
    const findUser = async (email) => { const e = normEmail(email); const uid = e ? await users.uidForEmail(emailIndex(e)) : null; return uid ? users.get(uid) : null; };
    const kind = (k) => { if (!KINDS.includes(k)) throw err('Unknown record type.'); return k; };
    let result;
    switch (action) {
      case 'createUser': {
        await limit('register', req, context);
        const v = validateSignup(a[0] || {}); const pw = String(a[0].password);
        if (pw.length > 256) throw err('Password is too long (256 characters max).');
        const id = randomUUID(); const idx = emailIndex(v.email);
        if (!(await users.claimEmail(idx, id))) throw err('An account with that email already exists. Try signing in.', 409);
        try {
          await users.create({ id, ...v, pw: await hashPassword(pw), createdAt: now(), privacyAcceptedAt: now() });
          if (v.role === 'responder') await responders.create(id, { uid: id, name: v.name, email: v.email, org: v.org, status: 'pending', requestedAt: now() });
        } catch (e) { await users.remove(id, idx); await responders.remove(id); throw e; }
        result = { ...(await profile(await users.get(id))), token: sign({ uid: id, role: v.role, sv: 0 }) }; break;
      }
      case 'verifyLogin': {
        await limit('login', req, context);
        const email = String(a[0] || '').trim().toLowerCase().slice(0, 200); const pw = String(a[1] ?? '').slice(0, 256);
        const uid = email ? await users.uidForEmail(emailIndex(email)) : null; const u = uid ? await users.get(uid) : null;
        if (!(await verifyPassword(pw, u?.pw)) || !u) throw err('Email or password is incorrect.', 401);
        if (tempExpired(u)) throw err('This temporary password has expired. Ask an administrator for a new one.', 401);
        result = { ...(await profile(u)), token: tokenFor(u) }; break;
      }
      case 'getUser': { const id = await need(); if (a[0] !== id) throw err('Forbidden', 403); result = await profile(me); break; }
      case 'deleteAccount': {
        await need();
        if (adminConfirmed(me) && (await activeAdmins()).filter((x) => x.u.id !== me.id).length === 0) throw err('You are the only administrator. Add another administrator before you delete your account.', 409);
        await deleteUserData(me); result = { ok: true }; break;
      }
      // Any signed-in account; required (and the only thing allowed) while a temporary password is in use.
      case 'changePassword': {
        await need(); await limit('password', req, context);
        const cur = String(a[0] ?? '').slice(0, 256), pw = String(a[1] ?? '');
        if (pw.length < 8) throw err('Password must be at least 8 characters.'); if (pw.length > 256) throw err('Password is too long (256 characters max).');
        if (!(await verifyPassword(cur, me.pw))) throw err(me.mustChangePassword ? 'The temporary password is not correct.' : 'Your current password is not correct.', 400);
        if (pw === cur) throw err(me.mustChangePassword ? 'Your new password must be different from the temporary password.' : 'Your new password must be different from your current password.');
        if (!me.privacyAcceptedAt && a[2] !== true) throw err('Please read and accept the privacy notice.');
        const forced = !!me.mustChangePassword; const pwHash = await hashPassword(pw);
        const next = await users.mutate(me.id, (x) => { const { mustChangePassword, tempPwExpiresAt, ...rest } = x; return { ...rest, pw: pwHash, sv: (x.sv || 0) + 1, passwordChangedAt: now(), ...(x.privacyAcceptedAt ? {} : { privacyAcceptedAt: now() }) }; });
        if (forced) await audit.log({ admin: next.email, action: adminConfirmed(next) ? 'admin.password_set' : 'account.password_set', target: 'user:' + next.id });
        result = { ...(await profile(next)), token: tokenFor(next) }; break; // every other session ends (session version bumped)
      }
      // ---------- password reset and admin confirmation (one-time codes, no email service)
      case 'resetPassword': {
        await limit('reset', req, context);
        const pw = String(a[2] ?? ''); if (pw.length < 8) throw err('Password must be at least 8 characters.'); if (pw.length > 256) throw err('Password is too long (256 characters max).');
        const u = await findUser(a[0]); const used = u ? await codes.consume(u.id, ['reset', 'recovery'], a[1]) : null;
        if (!used) throw err('That code is not valid or has expired. Ask an administrator for a new one.', 400);
        const pwHash = await hashPassword(pw);
        const next = await users.mutate(u.id, (x) => { const { mustChangePassword, tempPwExpiresAt, ...rest } = x; return { ...rest, pw: pwHash, sv: (x.sv || 0) + 1, passwordChangedAt: now(),
          ...(used.purpose === 'recovery' && isAdminEmail(x.email) ? { adminVerifiedEmail: x.email, adminVerifiedAt: now() } : {}) }; });
        await ensureRegistered(next);
        await audit.log({ admin: used.by || 'operator code', action: used.purpose === 'recovery' ? 'admin.recovery' : 'account.password_reset', target: 'user:' + u.id });
        result = { ok: true, isAdmin: adminConfirmed(next) }; break; // old sessions stop working (session version bumped)
      }
      case 'requestAdminCode': { // public; same answer whether or not the email is an admin address or has an account
        await limit('reset', req, context); const e = normEmail(a[0]);
        if (isAdminEmail(e)) { const u = await findUser(e); if (u) opLog('ADMIN RECOVERY CODE', u, await codes.issue(u.id, 'recovery', '')); else console.log('[admin-code] recovery requested for an admin address that has no account yet'); }
        result = { ok: true }; break;
      }
      case 'adminClaimStart': {
        await need(); if (!isAdminEmail(me.email) || adminConfirmed(me)) throw err('This account cannot claim admin access.', 403);
        await limit('reset', req, context); const c = await codes.issue(me.id, 'claim', ''); opLog('ADMIN CLAIM CODE', me, c); result = { ok: true, expiresAt: c.expiresAt }; break;
      }
      case 'adminClaimFinish': {
        await need(); if (!isAdminEmail(me.email) || adminConfirmed(me)) throw err('This account cannot claim admin access.', 403);
        await limit('reset', req, context); const used = await codes.consume(me.id, ['claim'], a[0]);
        if (!used) throw err('That code is not valid or has expired. Ask an administrator for a new one.', 400);
        me = await users.mutate(me.id, (x) => ({ ...x, adminVerifiedEmail: x.email, adminVerifiedAt: now() })); await ensureRegistered(me);
        await audit.log({ admin: me.email, action: 'admin.claim', target: 'user:' + me.id, ...(used.by ? { reason: 'code from ' + used.by } : {}) });
        result = await profile(me); break;
      }
      case 'exportData': {
        const id = await need(); const d = await data.get(id);
        const mine = []; for (const code of d.myCards || []) { const c = await cards.get(code); if (c) mine.push(strip(c)); }
        const subs = me.role === 'responder' ? (await submissions.list(id)).map(({ uid, ...x }) => x) : undefined;
        result = { exportedAt: now(), account: await profile(me), cases: d.cases, notes: d.notes, referrals: d.referrals, shareCardsICreated: mine, ...(subs ? { recordsISubmitted: subs } : {}) }; break;
      }
      case 'list': { const id = await need(); const k = kind(a[0]); result = [...(await data.get(id))[k]].sort((x, y) => (y.updatedAt || '').localeCompare(x.updatedAt || '')); break; }
      case 'create': {
        const id = await need(); const k = kind(a[0]); const rec = { id: randomUUID(), ...cleanItem(k, a[1] || {}), createdAt: now(), updatedAt: now() };
        await data.mutate(id, (d) => { if (d[k].length >= MAX_ITEMS) throw err(`You have reached the limit of ${MAX_ITEMS} items here.`, 413); d[k].push(rec); return d; });
        result = rec; break;
      }
      case 'update': {
        const id = await need(); const k = kind(a[0]); let out;
        await data.mutate(id, (d) => { const i = d[k].findIndex((r) => r.id === a[1]); if (i < 0) throw err('Not found', 404); d[k][i] = out = { ...d[k][i], ...cleanItem(k, { ...d[k][i], ...(a[2] || {}) }), updatedAt: now() }; return d; });
        result = out; break;
      }
      case 'remove': { const id = await need(); const k = kind(a[0]); await data.mutate(id, (d) => { d[k] = d[k].filter((r) => r.id !== a[1]); return d; }); result = { ok: true }; break; }
      case 'createShareCard': {
        const id = await needResponder();
        const card = cleanCard(a[0] || {}); const d = await data.get(id); if ((d.myCards || []).length >= MAX_CARDS) throw err('You have reached the share card limit. Delete your account data or contact support.', 413);
        let rec;
        for (let i = 0; i < 5 && !rec; i++) { const code = newCode((n) => randomInt(n)); const r = { code, ownerId: id, card, createdAt: now(), expiresAt: new Date(Date.now() + SHARE_CARD_DAYS * 864e5).toISOString(), revoked: false, saves: 0 }; if (await cards.create(code, r)) rec = r; }
        if (!rec) throw err('Please try again.', 503);
        await data.mutate(id, (x) => { x.myCards = [...(x.myCards || []), rec.code]; return x; });
        result = strip(rec); break;
      }
      case 'listShareCards': { const id = await needResponder(); const out = []; for (const code of [...((await data.get(id)).myCards || [])].reverse()) { const c = await cards.get(code); if (c && c.ownerId === id) out.push(strip(c)); } result = out; break; }
      case 'revokeShareCard': {
        const id = await need(); const code = normCode(a[0]); if (!((await data.get(id)).myCards || []).includes(code)) throw err('Not found', 404);
        await cards.mutate(code, (c) => { if (c.ownerId !== id) throw err('Not found', 404); c.revoked = true; return c; }); result = { ok: true }; break;
      }
      case 'getShareCard': {
        await limit('code', req, context); const code = normCode(a[0]); const c = CODE_RE.test(code) ? await cards.get(code) : null;
        if (!live(c)) throw err('That code was not found, has expired, or was turned off by the responder. Check the code and try again.', 404);
        result = { code: c.code, card: c.card, expiresAt: c.expiresAt }; break; // responder info only; never who else saved it
      }
      case 'claimShareCard': {
        const id = await need(); if (a[1] !== true) throw err('Please confirm you want to save this information.');
        let card, code = '';
        if (a[0]?.code) {
          await limit('code', req, context); code = normCode(a[0].code);
          const c = CODE_RE.test(code) ? await cards.get(code) : null; if (!live(c)) throw err('That code was not found, has expired, or was turned off.', 404);
          card = c.card; await cards.mutate(code, (x) => { x.saves = (x.saves || 0) + 1; return x; });
        } else card = cleanCard(a[0]?.card || {});
        const rec = { id: randomUUID(), ...cleanItem('notes', cardToNote(card, code)), createdAt: now(), updatedAt: now() };
        await data.mutate(id, (d) => { if (d.notes.length >= MAX_ITEMS) throw err('Too many notes.', 413); d.notes.push(rec); return d; });
        result = rec; break;
      }
      // ---------- community records
      case 'listCommunity': { result = await community.list(); break; } // public: approved records only
      case 'submitRecord': {
        const id = await needResponder(); const record = cleanSubmission(a[0] || {});
        const mine = await submissions.list(id); if (mine.filter((x) => x.status === 'pending').length >= MAX_PENDING_SUBMISSIONS) throw err('You have many records waiting for review. Please wait for an admin to review them.', 429);
        const rec = { id: randomUUID(), uid: id, submitter: { name: me.name, org: me.org }, status: 'pending', record, createdAt: now() };
        await submissions.create(id, rec); const { uid, ...out } = rec; result = out; break;
      }
      case 'mySubmissions': { const id = await needResponder(); result = (await submissions.list(id)).map(({ uid, ...x }) => x).sort((x, y) => y.createdAt.localeCompare(x.createdAt)); break; }
      // ---------- push alerts (per device; never linked to an account)
      case 'pushKey': { result = { publicKey: push.vapid().pub, maxCounties: push.MAX_COUNTIES }; break; }
      case 'pushSubscribe': {
        await limit('push', req, context); push.vapid();
        const sub = push.cleanSubscription(a[0]); const topics = push.cleanTopics(a[1]);
        const rec = await push.subs.save(sub, topics, a[2]); result = { topics: rec.topics, lang: rec.lang }; break;
      }
      case 'pushStatus': { await limit('push', req, context); const s = await push.subs.get(push.cleanSubscription(a[0]).endpoint); result = s ? { topics: s.topics, lang: s.lang } : null; break; }
      case 'pushUnsubscribe': { await limit('push', req, context); await push.subs.remove(push.cleanSubscription(a[0]).endpoint); result = { ok: true }; break; }
      case 'pushResubscribe': { // service worker: the browser replaced the subscription; keep the same topics
        await limit('push', req, context); const old = await push.subs.get(String(a[0] || '')); if (!old) throw err('Not found', 404);
        const sub = push.cleanSubscription(a[1]); await push.subs.save(sub, old.topics, old.lang); if (sub.endpoint !== old.endpoint) await push.subs.remove(old.endpoint); result = { ok: true }; break;
      }
      case 'adminPushCount': { await needAdmin(); const tg = push.cleanTarget(a[0]); result = { target: tg, count: await push.count(tg) }; break; }
      case 'adminPushTest': { // only to the device the admin is using right now
        await needAdmin(); await limit('push', req, context); const sub = push.cleanSubscription(a[0]);
        const msg = { ...push.cleanMessage({ ...(a[1] || {}), target: 'statewide' }), target: 'test' };
        const entry = await push.sendTest(sub, a[2], msg, me.email); await audit.log({ admin: me.email, action: 'push.test', target: 'push:test-device' }); result = entry; break;
      }
      case 'adminPushSend': {
        await needAdmin(); if (a[1] !== true) throw err('Please confirm before sending.');
        const msg = push.cleanMessage(a[0] || {}); const entry = await push.send(msg, me.email);
        await audit.log({ admin: me.email, action: 'push.send', target: 'push:' + push.targetLabel(msg.target) }); result = entry; break;
      }
      case 'adminPushLog': { await needAdmin(); result = await push.sendLog(50); break; }
      // ---------- admin
      case 'adminListResponders': { await needAdmin(); result = (await responders.list()).sort((x, y) => (x.requestedAt || '').localeCompare(y.requestedAt || '')); break; }
      case 'adminDecideResponder': {
        await needAdmin(); const target = String(a[0] || ''); const decision = a[1]; const reason = reasonOf(a[2]);
        if (!['approve', 'deny', 'revoke'].includes(decision)) throw err('Unknown decision.');
        const next = await responders.mutate(target, (r) => {
          if (decision === 'approve' && !['pending', 'denied', 'revoked'].includes(r.status)) throw err('Already approved.', 409);
          if (decision === 'deny' && r.status !== 'pending') throw err('Only pending requests can be denied.', 409);
          if (decision === 'revoke' && r.status !== 'approved') throw err('Only approved responders can be revoked.', 409);
          return { ...r, status: { approve: 'approved', deny: 'denied', revoke: 'revoked' }[decision], reason: decision === 'approve' ? '' : reason, decidedAt: now(), decidedBy: me.email };
        });
        if (decision !== 'approve') { // turn off every share code this responder made
          for (const code of (await data.get(target)).myCards || []) { try { await cards.mutate(code, (c) => ({ ...c, revoked: true })); } catch {} }
        }
        await audit.log({ admin: me.email, action: 'responder.' + decision, target: 'user:' + target, ...(reason ? { reason } : {}) });
        result = next; break;
      }
      case 'adminListSubmissions': { await needAdmin(); const st = ['pending', 'approved', 'rejected'].includes(a[0]) ? a[0] : 'pending'; result = (await submissions.list()).filter((x) => x.status === st).sort((x, y) => x.createdAt.localeCompare(y.createdAt)); break; }
      case 'adminDecideSubmission': {
        await needAdmin(); const [owner, sid, decision, edits, rawReason] = [String(a[0] || ''), String(a[1] || ''), a[2], a[3], reasonOf(a[4])];
        if (!['approve', 'reject'].includes(decision)) throw err('Unknown decision.');
        let published = null;
        const next = await submissions.mutate(owner, sid, (x) => {
          if (x.status !== 'pending') throw err('This record was already reviewed.', 409);
          if (decision === 'reject') return { ...x, status: 'rejected', reason: rawReason, decidedAt: now(), decidedBy: me.email };
          const record = edits && typeof edits === 'object' ? cleanSubmission({ ...x.record, ...edits }) : x.record;
          published = { id: x.id, ...record, approvedAt: now(), source: 'responder' };
          return { ...x, record, status: 'approved', edited: !!edits, decidedAt: now(), decidedBy: me.email };
        });
        if (published) await community.mutate((c) => { c.records = [...c.records.filter((r) => r.id !== published.id), published]; return c; });
        await audit.log({ admin: me.email, action: 'submission.' + decision + (decision === 'approve' && next.edited ? '.edited' : ''), target: 'submission:' + sid, ...(rawReason ? { reason: rawReason } : {}) });
        const { uid, ...out } = next; result = out; break;
      }
      case 'adminUnpublish': {
        await needAdmin(); const rid = String(a[0] || ''); const reason = reasonOf(a[1]);
        await community.mutate((c) => { c.records = c.records.filter((r) => r.id !== rid); return c; });
        await audit.log({ admin: me.email, action: 'community.unpublish', target: 'submission:' + rid, ...(reason ? { reason } : {}) }); result = { ok: true }; break;
      }
      case 'adminAudit': { await needAdmin(); result = await audit.recent(100); break; }
      case 'adminEditPublished': {
        await needAdmin(); const rid = String(a[0] || ''); const edits = a[1] && typeof a[1] === 'object' ? a[1] : {}; const reason = reasonOf(a[2]); let fields = [];
        await community.mutate((c) => {
          const i = c.records.findIndex((r) => r.id === rid); if (i < 0) throw err('Not found', 404);
          const before = c.records[i]; const rec = cleanSubmission({ ...before, ...edits });
          fields = Object.keys(rec).filter((k) => rec[k] !== before[k]); if (!fields.length) throw err('Nothing was changed.');
          c.records[i] = { ...before, ...rec, editedAt: now() }; return c;
        });
        await audit.log({ admin: me.email, action: 'community.edit', target: 'submission:' + rid, fields, ...(reason ? { reason } : {}) });
        result = (await community.list()).find((r) => r.id === rid); break;
      }
      // ---------- accounts (admin): find, delete, one-time codes
      case 'adminFindUser': {
        await needAdmin(); const u = await findUser(a[0]); if (!u) { result = { found: false }; break; }
        const d = await data.get(u.id); const r = u.role === 'responder' ? await responders.get(u.id) : null;
        const subs = u.role === 'responder' ? (await submissions.list(u.id)).length : 0;
        await audit.log({ admin: me.email, action: 'user.find', target: 'user:' + u.id });
        result = { found: true, ...pub(u), isSelf: u.id === me.id, adminEmail: isAdminEmail(u.email), adminConfirmed: adminConfirmed(u), responderStatus: r?.status, hasOpenCode: await codes.hasOpen(u.id),
          counts: { cases: d.cases.length, notes: d.notes.length, referrals: d.referrals.length, shareCards: (d.myCards || []).length, submissions: subs } };
        break;
      }
      case 'adminDeleteUser': {
        await needAdmin(); const target = String(a[0] || ''); if (a[2] !== true) throw err('Please confirm before deleting.');
        if (target === me.id) throw err('To delete your own account, use Settings.', 400);
        const u = await users.get(target); if (!u) throw err('Not found', 404);
        if (adminConfirmed(u)) throw err('This account is an administrator. Remove its administrator rights first (Administrators tab).', 409);
        if (normEmail(a[1]) !== u.email) throw err('The email you typed does not match this account.');
        await deleteUserData(u);
        await audit.log({ admin: me.email, action: 'user.delete', target: 'user:' + target, ...(reasonOf(a[3]) ? { reason: reasonOf(a[3]) } : {}) }); // no name or email of the deleted person
        result = { ok: true }; break;
      }
      case 'adminIssueReset': {
        await needAdmin(); const target = String(a[0] || ''); if (target === me.id) throw err('You are signed in. To change your own password, use the admin recovery code on the sign-in page.', 400);
        const u = await users.get(target); if (!u) throw err('Not found', 404);
        const c = await codes.issue(u.id, 'reset', me.email); await audit.log({ admin: me.email, action: 'user.reset_code', target: 'user:' + u.id });
        result = c; break; // shown once to the admin; only a hash is stored
      }
      case 'adminIssueClaim': {
        await needAdmin(); const u = await users.get(String(a[0] || '')); if (!u) throw err('Not found', 404);
        if (!isAdminEmail(u.email) || adminConfirmed(u)) throw err('This account cannot claim admin access.', 403);
        const c = await codes.issue(u.id, 'claim', me.email); await audit.log({ admin: me.email, action: 'admin.claim_code', target: 'user:' + u.id });
        result = c; break;
      }
      // ---------- administrators (admin): add by invite, list, revoke, new temporary password
      case 'adminInvite': {
        await needAdmin(); await limit('invite', req, context);
        const email = normEmail(a[0]?.email); if (!EMAIL_RE.test(email)) throw err('Enter a valid email address.');
        const name = String(a[0]?.name ?? '').trim().slice(0, 120); if (!name) throw err("Enter the new administrator's name.");
        const g = await tempGrant(); const grant = { ...g.fields, adminGranted: true, adminGrantedBy: me.email, adminGrantedAt: now() };
        let u = await findUser(email); let created = false;
        if (u) {
          if (adminConfirmed(u)) throw err('This person is already an administrator.', 409);
          u = await users.mutate(u.id, (x) => ({ ...x, ...grant, sv: (x.sv || 0) + 1 })); // their old password and sessions stop working
        } else {
          const id = randomUUID(); const idx = emailIndex(email);
          if (!(await users.claimEmail(idx, id))) throw err('Someone else changed this at the same time. Please try again.', 409);
          try { await users.create({ id, email, name, role: 'affected', org: '', createdAt: now(), ...grant }); } catch (e) { await users.remove(id, idx); throw e; }
          u = await users.get(id); created = true;
        }
        await admins.put(u.id, { addedAt: now(), addedBy: me.email, source: 'invite' });
        await audit.log({ admin: me.email, action: created ? 'admin.invite' : 'admin.invite_existing', target: 'user:' + u.id }); // never the password
        result = { id: u.id, name: u.name, email: u.email, created, tempPassword: g.temp, expiresAt: g.expiresAt }; break; // shown once; only a hash is stored
      }
      case 'adminListAdmins': {
        await needAdmin();
        result = (await activeAdmins()).map(({ r, u }) => ({ id: u.id, name: u.name, email: u.email, source: r.source, addedAt: r.addedAt, addedBy: r.addedBy, isSelf: u.id === me.id,
          bootstrap: isAdminEmail(u.email), waitingFirstSignIn: !!u.mustChangePassword, tempExpired: tempExpired(u), tempPwExpiresAt: u.mustChangePassword ? u.tempPwExpiresAt : undefined }))
          .sort((x, y) => String(x.addedAt).localeCompare(String(y.addedAt)));
        break;
      }
      case 'adminRevokeAdmin': {
        await needAdmin(); const target = String(a[0] || '');
        if (target === me.id) throw err('You cannot remove your own administrator rights.', 400);
        // Serialise revocations: claim the admin-meta version first, so two admins revoking each other at once cannot leave zero.
        let ok = false;
        for (let i = 0; i < 5 && !ok; i++) {
          const { value, etag } = await admins.meta(); const recent = (value?.revoked || []).filter((x) => Date.parse(x.at) > Date.now() - 6e5);
          // a revocation is "in flight" until the account shows adminRevokedAt at or after it
          const pending = (u) => recent.some((x) => x.uid === u.id && !(String(u.adminRevokedAt || '') >= x.at));
          if (pending(me)) throw err('Administrators only.', 403);
          const u = await users.get(target); if (!adminConfirmed(u) || pending(u)) throw err('This account is not an administrator.', 404);
          const others = (await activeAdmins()).filter((x) => x.u.id !== target && !pending(x.u));
          if (!others.length) throw err('You cannot remove the last administrator.', 409);
          ok = await admins.writeMeta({ v: (value?.v || 0) + 1, revoked: [...recent, { uid: target, at: now() }] }, etag);
        }
        if (!ok) throw err('Someone else changed this at the same time. Please try again.', 409);
        const u = await users.mutate(target, (x) => { const { adminGranted, adminGrantedBy, adminGrantedAt, adminVerifiedEmail, adminVerifiedAt, ...rest } = x; return { ...rest, sv: (x.sv || 0) + 1, adminRevokedAt: now() }; });
        await admins.remove(target);
        await audit.log({ admin: me.email, action: 'admin.revoke', target: 'user:' + target, ...(reasonOf(a[1]) ? { reason: reasonOf(a[1]) } : {}) });
        result = { ok: true, bootstrap: isAdminEmail(u.email) }; break;
      }
      case 'adminNewTempPassword': { // "resend": the old temporary password is never stored, so a new one replaces it
        await needAdmin(); await limit('invite', req, context); const target = String(a[0] || '');
        if (target === me.id) throw err('To change your own password, sign out and use "Forgot your password?".', 400);
        const u0 = await users.get(target); if (!adminConfirmed(u0)) throw err('This account is not an administrator.', 404);
        const g = await tempGrant(); const u = await users.mutate(target, (x) => ({ ...x, ...g.fields, sv: (x.sv || 0) + 1 }));
        await audit.log({ admin: me.email, action: 'admin.temp_password', target: 'user:' + target });
        result = { id: u.id, name: u.name, email: u.email, created: false, tempPassword: g.temp, expiresAt: g.expiresAt }; break;
      }
      default: throw err('Unknown action');
    }
    return json(200, { result });
  } catch (e) {
    if (e instanceof ConfigError) { console.error('[api] server not configured'); return json(503, { error: 'The service is not configured yet.' }); }
    if (e.code && e.code < 600) return json(e.code, { error: e.message }, e.retryAfter ? { 'retry-after': String(e.retryAfter) } : {});
    console.error('[api] failed', action, e.name); // no messages, bodies, emails or ids
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
