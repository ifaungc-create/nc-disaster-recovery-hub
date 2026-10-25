// Unit tests for the Netlify functions against the Blobs-backed store, using the official Netlify Blobs
// local server (@netlify/blobs/server) on a temp folder. No network, no Netlify account.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.NCDRH_DEV_INSECURE_SECRETS = '1';
process.env.ADMIN_EMAILS = ' DN22@c4iveteranservices.org , admin2@example.org';
const dir = mkdtempSync(join(tmpdir(), 'ncdrh-blobs-'));
const { startLocalBlobs } = await import('../netlify/functions/lib/local-blobs.js');
const { server } = await startLocalBlobs(dir);
const { default: api } = await import('../netlify/functions/api.js');
const { default: overpass, parse } = await import('../netlify/functions/overpass.js');
const { store, cards } = await import('../netlify/functions/lib/store.js');
const { cleanup } = await import('../netlify/functions/lib/../cleanup.js');
const { seal, open, userKey } = await import('../netlify/functions/lib/crypto.js');

let ipN = 0; const freshIp = () => `198.51.100.${++ipN}`;
let IP = freshIp();
const call = async (action, args = [], token, ip = IP, raw) => { const r = await api(new Request('http://x/', { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: raw ?? JSON.stringify({ action, args }) }), { ip }); return { status: r.status, headers: r.headers, ...(await r.json()) }; };
const allBlobs = async () => { const out = []; for await (const p of store().list({ paginate: true })) for (const b of p.blobs) out.push({ key: b.key, raw: JSON.stringify(await store().get(b.key, { type: 'json' })) }); return out; };
// Operator channel: one-time codes are written to the function log. Capture them like an operator reading the log.
const realLog0 = console.log; const opLines = [];
const capture = async (fn) => { const at = opLines.length; console.log = (...x) => { const l = x.join(' '); if (l.startsWith('[admin-code]')) opLines.push(l); else realLog0(...x); }; try { await fn(); } finally { console.log = realLog0; } return opLines.slice(at); };
const codeIn = (lines) => (lines.join('\n').match(/: ([A-Z2-9]{5}-[A-Z2-9]{5}) \(single use/) || [])[1];
let n = 0; const ok = (m) => { n++; console.log('  ✓', m); };

try {
  // ---------- accounts
  const a = await call('createUser', [{ email: '  Pat@Example.org ', password: 'longenough1', name: 'Pat', role: 'affected', termsAccepted: true }]);
  assert.equal(a.status, 200, a.error); assert.ok(a.result.token); assert.equal(a.result.email, 'pat@example.org'); ok('creates affected user (email normalized), returns token');
  assert.equal((await call('createUser', [{ email: 'PAT@example.org', password: 'longenough1', name: 'P', role: 'affected', termsAccepted: true }])).status, 409); ok('blocks duplicate email (case-insensitive)');
  const dup = await Promise.all([1, 2, 3].map(() => call('createUser', [{ email: 'race@example.org', password: 'longenough1', name: 'R', role: 'affected', termsAccepted: true }], null, freshIp())));
  assert.deepEqual(dup.map((d) => d.status).sort(), [200, 409, 409]); ok('concurrent duplicate registrations: exactly one wins (onlyIfNew)');
  assert.equal((await call('createUser', [{ email: 'x@y.org', password: 'short', name: 'P', role: 'affected', termsAccepted: true }])).status, 400); ok('rejects short password');
  assert.equal((await call('createUser', [{ email: 'x@y.org', password: 'longenough1', name: 'P', role: 'admin', termsAccepted: true }])).status, 400); ok('rejects unknown role');
  assert.equal((await call('verifyLogin', ['pat@example.org', 'wrong'])).status, 401); ok('rejects wrong password');
  assert.equal((await call('verifyLogin', ['nobody@example.org', 'whatever1'])).status, 401); ok('unknown email gives the same error');
  const tA = (await call('verifyLogin', ['PAT@example.org', 'longenough1'])).result.token; ok('logs in (normalized email)');
  const samRes = (await call('createUser', [{ email: 'sam@agency.org', password: 'longenough2', name: 'Sam', role: 'responder', org: 'Example Relief', termsAccepted: true }])).result; const tR = samRes.token; const samId = samRes.id;

  // ---------- responder approval + admin
  assert.equal(samRes.responderStatus, 'pending'); assert.equal(samRes.isAdmin, false); ok('responder registration creates a pending request (can sign in, no responder features)');
  const pend = await call('createShareCard', [{ org: 'X' }], tR); assert.equal(pend.status, 403); assert.match(pend.error, /waiting for admin approval/); ok('pending responder cannot create share cards');
  assert.equal((await call('submitRecord', [{ kind: 'shelter', category: 'housing', county: 'Wake', title: 'T', description: 'd', sourceUrl: 'https://example.org' }], tR)).status, 403); ok('pending responder cannot submit records');
  assert.equal((await call('verifyLogin', ['sam@agency.org', 'longenough2'], null, freshIp())).result.responderStatus, 'pending'); ok('login reports pending status');
  // ---------- admin claim protection: an ADMIN_EMAILS address gets admin rights only after proving it with a one-time code
  const noAcct = await capture(() => call('requestAdminCode', ['dn22@c4iveteranservices.org'], null, freshIp()));
  assert.ok(noAcct.some((l) => /no account yet/.test(l)) && !noAcct.join().includes('@')); ok('existence check: recovery request for an unregistered admin address logs "no account yet" (no email in the log)');
  const adm = (await call('createUser', [{ email: 'dn22@c4iveteranservices.org', password: 'admin-pass-123', name: 'Admin', role: 'affected', termsAccepted: true }], null, freshIp())).result; let tAdm = adm.token;
  assert.equal(adm.isAdmin, false); assert.equal(adm.adminPending, true); assert.equal((await call('adminListResponders', [], tAdm)).status, 403); ok('a new account with an ADMIN_EMAILS address is NOT admin until confirmed (adminPending)');
  const squat = (await call('createUser', [{ email: 'Admin2@example.org', password: 'squatter-123', name: 'Squatter', role: 'responder', termsAccepted: true }], null, freshIp())).result;
  assert.equal(squat.isAdmin, false); assert.equal(squat.responderStatus, 'pending'); assert.equal((await call('adminAudit', [], squat.token)).status, 403); ok('someone registering an admin address first gets no admin rights and no auto-approved responder status');
  const pubReq = await capture(() => call('requestAdminCode', ['nobody@example.org'], null, freshIp()));
  assert.equal(pubReq.length, 0); assert.deepEqual((await call('requestAdminCode', ['pat@example.org'], null, freshIp())).result, { ok: true }); ok('recovery request for a non-admin email does nothing and gives the same answer');
  assert.equal((await call('adminClaimStart', [], tA)).status, 403); ok('non-admin addresses cannot start an admin claim');
  const cl = await capture(() => call('adminClaimStart', [], tAdm, freshIp())); const claimCode = codeIn(cl);
  assert.match(claimCode, /^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/); assert.ok(!cl.join().includes('dn22')); ok('claim code is written only to the operator log (format XXXXX-XXXXX, no email in the log line)');
  const codeBlob = (await allBlobs()).find((b) => b.key === 'code/' + adm.id); assert.ok(codeBlob && !codeBlob.raw.includes(claimCode) && !codeBlob.raw.includes(claimCode.replace('-', ''))); ok('codes are stored only as a keyed hash');
  assert.equal((await call('adminClaimFinish', ['AAAAA-AAAAA'], tAdm, freshIp())).status, 400); assert.equal((await call('adminClaimFinish', [claimCode], squat.token, freshIp())).status, 400); ok('wrong code, or another account\'s code, is refused');
  const fin = await call('adminClaimFinish', [claimCode.toLowerCase().replace('-', ' ')], tAdm, freshIp()); assert.equal(fin.status, 200, fin.error); assert.equal(fin.result.isAdmin, true);
  assert.equal((await call('adminClaimFinish', [claimCode], tAdm, freshIp())).status, 403); ok('correct code confirms admin access (case and spacing ignored); confirmed account cannot claim again');
  assert.equal((await call('getUser', [adm.id], tAdm)).result.isAdmin, true); ok('ADMIN_EMAILS (normalized) + confirmed code makes dn22@c4iveteranservices.org an admin');
  // tries limit: 5 wrong guesses burn the code
  const sq = await capture(() => call('adminClaimStart', [], squat.token, freshIp())); const sqCode = codeIn(sq);
  for (let i = 0; i < 5; i++) await call('adminClaimFinish', ['ZZZZZ-ZZZZ' + i], squat.token, freshIp());
  assert.equal((await call('adminClaimFinish', [sqCode], squat.token, freshIp())).status, 400); ok('after 5 wrong tries the code stops working, even the right one');
  assert.equal((await call('adminListResponders', [], tA)).status, 403); assert.equal((await call('adminListResponders', [], tR)).status, 403); ok('non-admins (affected, responder) cannot use admin actions');
  const q = (await call('adminListResponders', [], tAdm)).result; assert.ok(q.some((r) => r.uid === samId && r.status === 'pending' && r.email === 'sam@agency.org')); ok('admin sees pending responder requests');
  const lee = (await call('createUser', [{ email: 'lee@example.org', password: 'longenough3', name: 'Lee', role: 'responder', termsAccepted: true }], null, freshIp())).result;
  assert.equal((await call('adminDecideResponder', [lee.id, 'deny', 'Could not confirm agency'], tAdm)).result.status, 'denied');
  const leeTry = await call('createShareCard', [{ org: 'X' }], lee.token); assert.equal(leeTry.status, 403); assert.match(leeTry.error, /not active/);
  assert.equal((await call('getUser', [lee.id], lee.token)).result.responderReason, 'Could not confirm agency'); ok('admin denies a request (with reason); denied responder stays locked out');
  assert.equal((await call('adminDecideResponder', [samId, 'approve'], tAdm)).result.status, 'approved'); assert.equal((await call('getUser', [samId], tR)).result.responderStatus, 'approved'); ok('admin approves responder; status becomes approved');
  assert.equal((await call('adminDecideResponder', [samId, 'approve'], tAdm)).status, 409); ok('double approval rejected');

  // ---------- password reset with one-time codes (no email service)
  const lee2 = (await call('createUser', [{ email: 'reset-me@example.org', password: 'old-password-1', name: 'R', role: 'affected', termsAccepted: true }], null, freshIp())).result;
  assert.equal((await call('adminIssueReset', [lee2.id], tA)).status, 403); ok('only admins can give reset codes');
  assert.equal((await call('adminIssueReset', [adm.id], tAdm)).status, 400); ok('an admin cannot give a reset code to their own signed-in account');
  const rc = (await call('adminIssueReset', [lee2.id], tAdm)).result; assert.match(rc.code, /^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/); assert.ok(Math.abs(Date.parse(rc.expiresAt) - Date.now() - 2 * 3600e3) < 60e3); ok('admin gives a reset code (shown once, expires in 2 hours)');
  assert.equal((await call('resetPassword', ['reset-me@example.org', 'WRONG-CODE1', 'new-password-1'], null, freshIp())).status, 400);
  assert.equal((await call('resetPassword', ['reset-me@example.org', rc.code, 'short'], null, freshIp())).status, 400);
  assert.equal((await call('resetPassword', ['pat@example.org', rc.code, 'new-password-1'], null, freshIp())).status, 400); ok('reset refuses a wrong code, a short password, or the code used on another account');
  const rs = await call('resetPassword', ['RESET-ME@example.org', rc.code, 'new-password-1'], null, freshIp()); assert.equal(rs.status, 200, rs.error); assert.equal(rs.result.isAdmin, false);
  assert.equal((await call('verifyLogin', ['reset-me@example.org', 'old-password-1'], null, freshIp())).status, 401); assert.equal((await call('verifyLogin', ['reset-me@example.org', 'new-password-1'], null, freshIp())).status, 200); ok('reset sets the new password; the old one stops working');
  assert.equal((await call('list', ['notes'], lee2.token)).status, 401); ok('reset signs the account out everywhere (old sessions stop working)');
  assert.equal((await call('resetPassword', ['reset-me@example.org', rc.code, 'new-password-2'], null, freshIp())).status, 400); ok('a reset code works only once');
  const rc2 = (await call('adminIssueReset', [lee2.id], tAdm)).result; const rc3 = (await call('adminIssueReset', [lee2.id], tAdm)).result;
  assert.equal((await call('resetPassword', ['reset-me@example.org', rc2.code, 'new-password-3'], null, freshIp())).status, 400); ok('a new code replaces the older one');
  await store().setJSON('code/' + lee2.id, { ...(await store().get('code/' + lee2.id, { type: 'json' })), exp: new Date(Date.now() - 1000).toISOString() });
  assert.equal((await call('resetPassword', ['reset-me@example.org', rc3.code, 'new-password-3'], null, freshIp())).status, 400); ok('an expired code is refused');
  const rc4 = (await call('adminIssueReset', [lee2.id], tAdm)).result;
  const race = await Promise.all([1, 2, 3].map((i) => call('resetPassword', ['reset-me@example.org', rc4.code, 'race-password-' + i], null, freshIp())));
  assert.equal(race.filter((r) => r.status === 200).length, 1); ok('the same code used at the same time from 3 places: only one succeeds');
  const resetLog = (await call('adminAudit', [], tAdm)).result; assert.ok(resetLog.some((l) => l.action === 'user.reset_code') && resetLog.some((l) => l.action === 'account.password_reset' && l.admin === 'dn22@c4iveteranservices.org'));
  assert.ok(!JSON.stringify(resetLog).includes('reset-me@') && !JSON.stringify(resetLog).includes(rc.code)); ok('reset codes and resets are logged without the person\'s email or the code');
  // admin recovery from the sign-in page (forgotten admin password): code goes to the operator log only
  const rec = await capture(() => call('requestAdminCode', [' DN22@c4iveteranservices.org '], null, freshIp())); const recCode = codeIn(rec); assert.ok(recCode);
  const tAdmOld = tAdm; const rr = await call('resetPassword', ['dn22@c4iveteranservices.org', recCode, 'admin-pass-456'], null, freshIp()); assert.equal(rr.status, 200); assert.equal(rr.result.isAdmin, true);
  assert.equal((await call('adminAudit', [], tAdmOld)).status, 401); tAdm = (await call('verifyLogin', ['dn22@c4iveteranservices.org', 'admin-pass-456'], null, freshIp())).result.token; ok('admin recovery code (from the operator log) sets a new admin password and keeps admin confirmed');
  const sqRec = await capture(() => call('requestAdminCode', ['admin2@example.org'], null, freshIp()));
  assert.equal((await call('resetPassword', ['admin2@example.org', codeIn(sqRec), 'taken-back-1'], null, freshIp())).status, 200);
  assert.equal((await call('verifyLogin', ['admin2@example.org', 'squatter-123'], null, freshIp())).status, 401);
  const t2 = (await call('verifyLogin', ['admin2@example.org', 'taken-back-1'], null, freshIp())).result; assert.equal(t2.isAdmin, true); ok('the real owner takes back an admin address someone else registered: recovery code resets the password and confirms admin');

  // ---------- records + isolation
  assert.equal((await call('list', ['cases'])).status, 401); ok('list requires a session');
  assert.equal((await call('list', ['cases'], tA.slice(0, -2) + 'xx')).status, 401); ok('tampered token rejected');
  const c = (await call('create', ['cases', { agency: 'FEMA', number: 'FEMA-555-0001', phone: '800-555-0100', evil: 'x' }], tA)).result;
  assert.equal(c.agency, 'FEMA'); assert.equal(c.evil, undefined); ok('creates case number; unknown fields stripped');
  assert.equal((await call('update', ['cases', c.id, { number: 'FEMA-555-0002' }], tA)).result.number, 'FEMA-555-0002'); ok('updates case number');
  assert.equal((await call('list', ['cases'], tR)).result.length, 0); ok('other users cannot see the record');
  assert.equal((await call('update', ['cases', c.id, { number: 'hack' }], tR)).status, 404); ok('other users cannot edit the record');
  const par = await Promise.all(Array.from({ length: 15 }, (_, i) => call('create', ['notes', { title: 'n' + i, body: 'parallel ' + i }], tA))); assert.deepEqual(par.map((x) => x.status), Array(15).fill(200), JSON.stringify(par.map((x) => x.status)));
  assert.equal((await call('list', ['notes'], tA)).result.length, 15); ok('15 concurrent writes to one user: no lost updates (ETag onlyIfMatch + retry)');
  const ref = (await call('create', ['referrals', { to: 'Legal Aid NC', status: 'waiting', followUp: '2026-11-01' }], tA)).result; assert.equal(ref.status, 'waiting'); ok('creates referral');
  assert.equal((await call('remove', ['cases', c.id], tA)).status, 200); assert.equal((await call('list', ['cases'], tA)).result.length, 0); ok('deletes case number');
  await call('create', ['cases', { agency: 'Insurance claim', agencyOther: 'Example Mutual', number: 'CLM-SECRET-42' }], tA);

  // ---------- validation / size
  assert.equal((await call('x', [], null, IP, JSON.stringify({ action: 'create', args: ['notes', { body: 'x'.repeat(70000) }] }))).status, 413); ok('request body over 64 KB rejected (413)');
  assert.equal((await call('create', ['nope', {}], tA)).status, 400); ok('unknown record type rejected');
  assert.equal((await call('x', [], null, IP, '{not json')).status, 400); ok('malformed JSON rejected');
  const big = (await call('create', ['notes', { title: 't'.repeat(500), body: 'b' }], tA)).result; assert.equal(big.title.length, 160); ok('field lengths capped server-side');

  // ---------- encryption at rest
  const blobs = await allBlobs(); const rawAll = blobs.map((b) => b.key + b.raw).join('\n');
  for (const s of ['pat@example.org', 'CLM-SECRET-42', 'Legal Aid NC', 'parallel 3', 'Example Relief', 'scrypt$']) assert.ok(!rawAll.includes(s), 'plaintext leaked: ' + s);
  assert.ok(blobs.some((b) => b.key.startsWith('data/')) && blobs.every((b) => !b.key.includes('@'))); ok('no emails, case numbers, notes or hashes in plaintext in any blob or key (AES-256-GCM)');
  const env = seal({ x: 1 }, userKey('u1'), 'data/u1');
  assert.throws(() => open(env, userKey('u2'), 'data/u1')); assert.throws(() => open(env, userKey('u1'), 'data/u2')); ok('per-user key + key-bound AAD: wrong user or wrong slot cannot decrypt');

  // ---------- share cards
  assert.equal((await call('createShareCard', [{ org: 'X' }], tA)).status, 403); ok('affected users cannot create share cards');
  const card = (await call('createShareCard', [{ org: 'Example Relief', contact: 'Sam', phone: '919-555-0101', url: 'javascript:alert(1)' }], tR)).result;
  assert.match(card.code, /^[A-HJ-NP-Z2-9]{8}$/); assert.equal(card.card.url, ''); assert.equal(card.ownerId, undefined); ok('responder creates share card; unsafe URL dropped; owner id not exposed');
  const look = await call('getShareCard', [card.code.toLowerCase()], null, freshIp()); assert.equal(look.status, 200); assert.equal(look.result.card.org, 'Example Relief'); ok('code lookup works from any device without the responder (server-side codes)');
  assert.equal((await call('claimShareCard', [{ code: card.code }, true])).status, 401); ok('saving a card requires an account');
  assert.equal((await call('claimShareCard', [{ code: card.code }, false], tA)).status, 400); ok('saving requires explicit consent');
  const note = (await call('claimShareCard', [{ code: card.code.slice(0, 4) + '-' + card.code.slice(4) }, true], tA)).result; assert.match(note.body, /Example Relief/); ok('claim by code saves a copy into the client\'s encrypted notes');
  assert.equal((await call('list', ['notes'], tR)).result.length, 0); const rl = (await call('listShareCards', [], tR)).result; assert.equal(rl[0].saves, 1);
  assert.ok(!JSON.stringify(rl).includes('pat') && !JSON.stringify(rl).includes(note.id)); ok('responder sees only a save count, never client identity or notes');
  assert.equal((await call('revokeShareCard', [card.code], tA)).status, 404); ok('only the owner can revoke');
  await call('revokeShareCard', [card.code], tR); assert.equal((await call('getShareCard', [card.code])).status, 404); assert.equal((await call('claimShareCard', [{ code: card.code }, true], tA)).status, 404); ok('revoked code no longer resolves or saves');
  const card2 = (await call('createShareCard', [{ org: 'Old Card' }], tR)).result;
  await cards.mutate(card2.code, (x) => { x.expiresAt = new Date(Date.now() - 1000).toISOString(); return x; });
  assert.equal((await call('getShareCard', [card2.code])).status, 404); ok('expired code (30-day expiry) no longer resolves');
  assert.equal(Math.round((Date.parse(card.expiresAt) - Date.parse(card.createdAt)) / 864e5), 30); ok('cards expire 30 days after creation');
  const qr = (await call('claimShareCard', [{ card: { org: 'County DSS', phone: '828-555-0177' } }, true], tA)); assert.equal(qr.status, 200); ok('QR-carried card saved with consent');

  // ---------- community records (submissions -> admin queue -> public)
  const bad = await call('submitRecord', [{ kind: 'shelter', category: 'housing', county: 'Wake', title: 'No source' , phone: '919-555-0000' }], tR); assert.equal(bad.status, 400); assert.match(bad.error, /source/); ok('submission requires an https source link');
  assert.equal((await call('submitRecord', [{ kind: 'shelter', category: 'housing', county: 'Atlantis', title: 'x', phone: '1', sourceUrl: 'https://a.org' }], tR)).status, 400); ok('submission county must be one of the 100 counties or Statewide');
  const s1 = (await call('submitRecord', [{ kind: 'shelter', category: 'housing', county: 'Buncombe', title: 'Westside Shelter', phone: '828-555-0199', description: 'Open nightly 6pm', url: 'https://shelter.example.org', sourceUrl: 'https://county.example.org/shelters', evil: 1 }], tR)).result;
  assert.equal(s1.status, 'pending'); assert.equal(s1.record.evil, undefined); ok('approved responder submits a record; it goes to the admin queue as pending');
  const s2 = (await call('submitRecord', [{ kind: 'phone', category: 'legal', county: 'Statewide', title: 'Fake Legal Line', phone: '800-555-0000', sourceUrl: 'https://scam.example.org' }], tR)).result;
  assert.equal((await call('listCommunity')).result.length, 0); ok('pending records are not visible to anyone');
  const queue = (await call('adminListSubmissions', ['pending'], tAdm)).result; assert.equal(queue.length, 2); assert.equal(queue[0].submitter.org, 'Example Relief'); ok('admin sees pending submissions with submitter name/org');
  const rj = (await call('adminDecideSubmission', [samId, s2.id, 'reject', null, 'Could not verify number'], tAdm)).result; assert.equal(rj.status, 'rejected');
  const ap = (await call('adminDecideSubmission', [samId, s1.id, 'approve', { title: 'Westside Emergency Shelter' }], tAdm)).result; assert.equal(ap.status, 'approved'); assert.equal(ap.record.title, 'Westside Emergency Shelter'); ok('admin edits then approves one record, rejects the other with a reason');
  assert.equal((await call('adminDecideSubmission', [samId, s1.id, 'reject'], tAdm)).status, 409); ok('a reviewed record cannot be reviewed again');
  assert.equal((await call('adminDecideSubmission', [samId, s2.id, 'approve', { sourceUrl: 'javascript:x' }], tAdm)).status, 409); ok('rejected record cannot later be approved through the decide endpoint');
  const pubList = (await call('listCommunity', [], null, freshIp())).result;
  assert.equal(pubList.length, 1); assert.equal(pubList[0].title, 'Westside Emergency Shelter'); assert.equal(pubList[0].county, 'Buncombe'); assert.ok(pubList[0].approvedAt);
  assert.ok(!JSON.stringify(pubList).includes('Fake Legal Line') && !JSON.stringify(pubList).includes('Sam') && !JSON.stringify(pubList).includes(samId)); ok('public list: approved (edited) record only; rejected never shown; no submitter identity');
  const mine = (await call('mySubmissions', [], tR)).result; assert.equal(mine.find((x) => x.id === s2.id).reason, 'Could not verify number'); ok('responder sees status and rejection reason of their submissions');
  const log = (await call('adminAudit', [], tAdm)).result; const acts = log.map((l) => l.action);
  for (const x of ['responder.approve', 'responder.deny', 'submission.approve.edited', 'submission.reject']) assert.ok(acts.includes(x), x);
  assert.ok(log.every((l) => l.admin && l.at && l.target)); assert.ok(log.filter((l) => /^(responder|submission)\./.test(l.action)).every((l) => l.admin === 'dn22@c4iveteranservices.org')); assert.ok(log.some((l) => l.action === 'admin.recovery' && l.admin === 'operator code')); const rawLog = JSON.stringify(log);
  for (const x of ['pat@example.org', 'CLM-SECRET-42', 'Legal Aid NC', 'sam@agency.org']) assert.ok(!rawLog.includes(x)); ok('admin actions logged (who, what, target id, when) with no client personal data');
  assert.equal((await call('adminAudit', [], tR)).status, 403); ok('audit log is admin-only');
  const rawQueue = (await allBlobs()).filter((b) => b.key.startsWith('resp/') || b.key.startsWith('sub/')).map((b) => b.raw).join();
  assert.ok(!rawQueue.includes('sam@agency.org') && !rawQueue.includes('Fake Legal Line')); ok('responder requests and submissions are encrypted at rest');
  // ---------- edit a published record in place
  assert.equal((await call('adminEditPublished', [s1.id, { phone: '828-555-0198' }], tR)).status, 403); ok('only admins can edit published records');
  assert.equal((await call('adminEditPublished', [s1.id, { title: 'Westside Emergency Shelter' }], tAdm)).status, 400); ok('an edit that changes nothing is refused');
  assert.equal((await call('adminEditPublished', [s1.id, { sourceUrl: 'javascript:x' }], tAdm)).status, 400); ok('edits are validated like new records (unsafe source link refused)');
  const ed = await call('adminEditPublished', [s1.id, { phone: '828-555-0198', description: 'Open nightly 7pm', evil: 1 }, 'Hours changed'], tAdm); assert.equal(ed.status, 200, ed.error);
  const pubEd = (await call('listCommunity', [], null, freshIp())).result.find((r) => r.id === s1.id); assert.equal(pubEd.phone, '828-555-0198'); assert.equal(pubEd.description, 'Open nightly 7pm'); assert.equal(pubEd.evil, undefined); assert.ok(pubEd.editedAt && pubEd.approvedAt); ok('admin edits a published record in place (public list updated, unknown fields dropped)');
  const edLog = (await call('adminAudit', [], tAdm)).result.find((l) => l.action === 'community.edit'); assert.deepEqual([...edLog.fields].sort(), ['description', 'phone']); assert.equal(edLog.reason, 'Hours changed'); assert.equal(edLog.target, 'submission:' + s1.id); ok('each edit is added to the Log with the changed field names and reason');
  assert.equal((await call('adminEditPublished', ['nope', { title: 'x' }], tAdm)).status, 404); ok('editing an unknown record gives 404');
  await call('adminUnpublish', [s1.id, 'Closed'], tAdm); assert.equal((await call('listCommunity')).result.length, 0);
  await call('adminDecideSubmission', [samId, (await call('submitRecord', [{ kind: 'organization', category: 'relief', county: 'Statewide', title: 'Statewide Relief Org', url: 'https://relief.example.org', sourceUrl: 'https://relief.example.org/about' }], tR)).result.id, 'approve'], tAdm);
  assert.equal((await call('listCommunity')).result.length, 1); ok('admin can unpublish an approved record');

  // ---------- rate limits
  const ip = freshIp(); const st = []; for (let i = 0; i < 11; i++) st.push((await call('verifyLogin', ['pat@example.org', 'wrong'], null, ip)).status);
  assert.deepEqual(st.slice(0, 10), Array(10).fill(401)); const lim = await call('verifyLogin', ['pat@example.org', 'longenough1'], null, ip); assert.equal(lim.status, 429); assert.ok(Number(lim.headers.get('retry-after')) > 0);
  assert.equal((await call('verifyLogin', ['pat@example.org', 'longenough1'], null, freshIp())).status, 200); ok('login limited to 10 per 15 min per IP (429 + Retry-After); other IPs unaffected');
  const ip2 = freshIp(); let s31; for (let i = 0; i < 31; i++) s31 = (await call('getShareCard', ['ZZZZZZZZ'], null, ip2)).status; assert.equal(s31, 429); ok('share-code lookups limited to 30 per 15 min per IP');
  const ip3 = freshIp(); let s6; for (let i = 0; i < 6; i++) s6 = (await call('createUser', [{ email: `r${i}@x.org`, password: 'short', name: 'x', role: 'affected', termsAccepted: true }], null, ip3)).status; assert.equal(s6, 429); ok('registration limited to 5 per hour per IP');
  const rlKeys = (await allBlobs()).filter((b) => b.key.startsWith('rl/'));
  assert.ok(rlKeys.length && rlKeys.every((b) => !/198\.51\.100/.test(b.key + b.raw))); ok('rate-limit counters store only a keyed IP hash, never the IP');
  await cleanup(Date.now() + 2 * 3600e3); assert.equal((await allBlobs()).filter((b) => b.key.startsWith('rl/')).length, 0); ok('scheduled cleanup removes expired rate-limit windows');
  await call('adminIssueReset', [samId], tAdm); assert.ok((await allBlobs()).some((b) => b.key === 'code/' + samId));
  await cleanup(Date.now() + 3 * 3600e3); assert.ok(!(await allBlobs()).some((b) => b.key.startsWith('code/'))); ok('scheduled cleanup removes expired one-time codes');

  // ---------- revoke an approved responder
  const live1 = (await call('createShareCard', [{ org: 'Example Relief', phone: '919-555-0102' }], tR)).result;
  assert.equal((await call('getShareCard', [live1.code], null, freshIp())).status, 200);
  assert.ok((await call('adminListResponders', [], tAdm)).result.some((r) => r.uid === samId && r.status === 'approved')); 
  assert.equal((await call('adminDecideResponder', [samId, 'revoke', 'Left the agency'], tAdm)).result.status, 'revoked');
  assert.equal((await call('getShareCard', [live1.code], null, freshIp())).status, 404); assert.equal((await call('createShareCard', [{ org: 'X' }], tR)).status, 403);
  assert.equal((await call('submitRecord', [{ kind: 'link', category: 'other', county: 'Statewide', title: 'x', url: 'https://x.org', sourceUrl: 'https://x.org' }], tR)).status, 403); ok('admin revokes an approved responder: their share codes stop working, no new cards or submissions');
  assert.equal((await call('listCommunity')).result.length, 1); ok('records approved earlier stay published after the submitter is revoked');
  await call('adminDecideResponder', [samId, 'approve'], tAdm);

  // ---------- export + delete
  const ex = (await call('exportData', [], tA)).result; assert.equal(ex.referrals.length, 1); assert.ok(ex.notes.length >= 17); assert.equal(ex.cases[0].number, 'CLM-SECRET-42'); ok('export returns all the user\'s data as JSON');
  const exR = (await call('exportData', [], tR)).result; assert.equal(exR.shareCardsICreated.length, 3); assert.equal(exR.recordsISubmitted.length, 3); ok('responder export includes their share cards and submissions');
  const before = (await allBlobs()).map((b) => b.key);
  const meR = await call('getUser', [JSON.parse(Buffer.from(tR.split('.')[0], 'base64url')).uid], tR); const rid = meR.result.id;
  assert.equal((await call('deleteAccount', [], tR)).status, 200);
  const after = (await allBlobs()).map((b) => b.key);
  assert.ok(before.some((k) => k.includes(rid))); assert.ok(!after.some((k) => k.includes(rid))); assert.ok(![card.code, card2.code, live1.code].some((c) => after.includes('card/' + c)));
  assert.equal(before.length - after.length, 1 + 1 + 1 + 3 + 1 + 3); // user, email index, data, 3 cards, responder request, 3 submissions
  assert.equal((await call('listCommunity')).result.length, 1);
  ok('delete account removes every blob for that user (account, email index, data, share cards, responder request, submissions)');
  assert.equal((await call('list', ['notes'], tR)).status, 401); ok('a deleted account\'s token stops working immediately');
  assert.equal((await call('verifyLogin', ['sam@agency.org', 'longenough2'])).status, 401); ok('deleted account cannot sign in; email can be registered again');
  assert.equal((await call('createUser', [{ email: 'sam@agency.org', password: 'longenough2', name: 'Sam', role: 'responder', termsAccepted: true }], null, freshIp())).status, 200);

  // ---------- admin deletes an account (find by email, confirm, everything removed, audit without personal data)
  const vic = (await call('createUser', [{ email: 'qa-delete@example.org', password: 'longenough9', name: 'Delete Me', role: 'responder', org: 'QA Org', termsAccepted: true }], null, freshIp())).result;
  await call('adminDecideResponder', [vic.id, 'approve'], tAdm);
  await call('create', ['notes', { title: 'private', body: 'VICTIM-NOTE-77' }], vic.token); await call('create', ['cases', { agency: 'FEMA', number: 'VIC-CASE-1' }], vic.token);
  const vcard = (await call('createShareCard', [{ org: 'QA Org' }], vic.token)).result;
  await call('submitRecord', [{ kind: 'link', category: 'other', county: 'Wake', title: 'QA pending', url: 'https://qa.example.org', sourceUrl: 'https://qa.example.org' }], vic.token);
  await call('adminIssueReset', [vic.id], tAdm);
  assert.equal((await call('adminFindUser', ['qa-delete@example.org'], tA)).status, 403); ok('only admins can look up accounts');
  const fu = (await call('adminFindUser', ['  QA-Delete@Example.org'], tAdm)).result; assert.equal(fu.found, true); assert.equal(fu.id, vic.id); assert.equal(fu.counts.notes, 1); assert.equal(fu.counts.cases, 1); assert.equal(fu.counts.shareCards, 1); assert.equal(fu.counts.submissions, 1); assert.equal(fu.hasOpenCode, true); assert.equal(fu.responderStatus, 'approved');
  assert.ok(!JSON.stringify(fu).includes('VICTIM-NOTE') && !JSON.stringify(fu).includes('VIC-CASE')); ok('admin finds an account by email: shows counts only, never the notes or case numbers');
  assert.equal((await call('adminFindUser', ['nobody@example.org'], tAdm)).result.found, false); ok('finding an unknown email says not found');
  assert.equal((await call('adminDeleteUser', [vic.id, 'qa-delete@example.org', false], tAdm)).status, 400); assert.equal((await call('adminDeleteUser', [vic.id, 'wrong@example.org', true], tAdm)).status, 400); ok('deletion needs the confirmation and the exact account email');
  assert.equal((await call('adminDeleteUser', [adm.id, 'dn22@c4iveteranservices.org', true], tAdm)).status, 400); ok('an admin cannot delete their own account from the admin area');
  assert.equal((await call('adminDeleteUser', [vic.id, 'qa-delete@example.org', true], tA)).status, 403); ok('non-admins cannot delete accounts');
  const del = await call('adminDeleteUser', [vic.id, 'QA-delete@example.org ', true, 'Requested by phone'], tAdm); assert.equal(del.status, 200, del.error);
  const left = (await allBlobs()).map((b) => b.key); assert.ok(!left.some((k) => k.includes(vic.id))); assert.ok(!left.includes('card/' + vcard.code)); ok('admin deletion removes every blob for that account (account, email index, data, cards, responder request, submissions, open code)');
  assert.equal((await call('list', ['notes'], vic.token)).status, 401); assert.equal((await call('verifyLogin', ['qa-delete@example.org', 'longenough9'], null, freshIp())).status, 401); assert.equal((await call('getShareCard', [vcard.code], null, freshIp())).status, 404); ok('the deleted person is signed out everywhere, cannot sign in, and their share codes stop working');
  const dl = (await call('adminAudit', [], tAdm)).result; const dEntry = dl.find((l) => l.action === 'user.delete'); assert.equal(dEntry.target, 'user:' + vic.id); assert.equal(dEntry.reason, 'Requested by phone');
  const dRaw = JSON.stringify(dl); for (const x of ['qa-delete@example.org', 'Delete Me', 'QA Org', 'VICTIM-NOTE-77']) assert.ok(!dRaw.includes(x), x); ok('deletion is logged (who, when, account id, reason) without the deleted person\'s name, email or data');
  assert.equal((await call('adminFindUser', ['qa-delete@example.org'], tAdm)).result.found, false); assert.equal((await call('createUser', [{ email: 'qa-delete@example.org', password: 'longenough9', name: 'Again', role: 'affected', termsAccepted: true }], null, freshIp())).status, 200); ok('the email is free again after deletion');

  // ---------- fail closed
  delete process.env.NCDRH_DEV_INSECURE_SECRETS;
  const fc = await call('verifyLogin', ['pat@example.org', 'longenough1'], null, freshIp()); assert.equal(fc.status, 503);
  process.env.APP_SESSION_SECRET = 'too-short'; process.env.DATA_ENCRYPTION_KEY = 'AAAA'; assert.equal((await call('list', ['notes'], tA)).status, 503);
  delete process.env.APP_SESSION_SECRET; delete process.env.DATA_ENCRYPTION_KEY; process.env.NCDRH_DEV_INSECURE_SECRETS = '1';
  ok('fails closed (503) when APP_SESSION_SECRET / DATA_ENCRYPTION_KEY are missing or weak');

  // ---------- overpass (optional live hotel check): mirrors, cache per grid cell, logs without coordinates
  const realFetch = globalThis.fetch, realLog = console.log; let sent = '', calls = [], fail = new Set(), logs = [];
  const { MIRRORS, UA } = await import('../netlify/functions/overpass.js');
  globalThis.fetch = async (url, init) => { if (!MIRRORS.includes(String(url))) return realFetch(url, init); calls.push({ url: String(url), ua: init.headers['user-agent'] }); sent = decodeURIComponent(String(init.body));
    if (fail.has(String(url))) return new Response('busy', { status: 429 });
    return new Response(JSON.stringify({ elements: [{ type: 'node', id: 1, lat: 35.6, lon: -82.55, tags: { tourism: 'hotel', name: 'Test Inn', phone: '+1 828 555 0100' } }, { type: 'way', id: 2, center: { lat: 35.61, lon: -82.56 }, tags: { tourism: 'motel' } }, { type: 'node', id: 9, lat: 36.2, lon: -82.55, tags: { tourism: 'hotel', name: 'Far Inn' } }] }), { status: 200 }); };
  const op = async (b, ip = freshIp()) => { console.log = (...a) => logs.push(a.join(' ')); try { const res = await overpass(new Request('http://x/', { method: 'POST', body: JSON.stringify(b) }), { ip }); return { status: res.status, cc: res.headers.get('cache-control'), ...(await res.json()) }; } finally { console.log = realLog; } };
  assert.ok(!MIRRORS.some((m) => m.includes('overpass-api.de')) && MIRRORS.length >= 2); ok('overpass: mirror list excludes overpass-api.de (its policy excludes netlify.app apps)');
  fail.add(MIRRORS[0]);
  const h = await op({ lat: 35.595123, lon: -82.551487, radius: 16000 });
  assert.equal(h.status, 200); assert.deepEqual(h.results.map((x) => x.name), ['Test Inn']); assert.equal(h.cc, 'no-store'); assert.equal(h.cached, false);
  ok('overpass: parses hotels, drops unnamed and out-of-radius, no-store');
  assert.deepEqual(calls.map((c) => c.url), MIRRORS.slice(0, 2)); assert.equal(h.mirror, new URL(MIRRORS[1]).host); ok('overpass: falls back to the next mirror when one fails');
  assert.ok(calls.every((c) => c.ua === UA && /NC-Disaster-Recovery-Hub\/1\.0 \(\+https:\/\/disaster-resources\.app/.test(c.ua))); ok('overpass: identifying User-Agent');
  assert.ok(sent.includes('around:24000,35.55,-82.55') && sent.includes('out center tags 200') && !sent.includes('35.59') && !sent.includes('35.6,')); ok('overpass: query uses the ~10 km grid-cell center, not the person\'s position; limited output');
  assert.ok(logs.length >= 2 && logs.every((l) => !/35\.|82\.|lat|lon/.test(l))); assert.ok(logs.some((l) => /mirror=\S+ status=429 ms=\d+/.test(l))); assert.ok(logs.some((l) => /status=200/.test(l)));
  ok('overpass: logs upstream host, status and timing only (no coordinates)');
  calls = []; const h2 = await op({ lat: 35.58, lon: -82.52, radius: 16000 }); assert.equal(h2.cached, true); assert.equal(calls.length, 0); ok('overpass: second search in the same cell is served from the Blobs cache');
  const cacheKeys = []; for await (const p of store().list({ prefix: 'hotelcache/', paginate: true })) for (const b of p.blobs) cacheKeys.push(b.key);
  assert.deepEqual(cacheKeys, ['hotelcache/35.55_-82.55_24000']); assert.ok((await cleanup(Date.now() + 2 * 864e5)) >= 1); cacheKeys.length = 0;
  for await (const p of store().list({ prefix: 'hotelcache/', paginate: true })) for (const b of p.blobs) cacheKeys.push(b.key); assert.equal(cacheKeys.length, 0); ok('overpass: cache entries expire after a day (cleanup removes them)');
  MIRRORS.forEach((m) => fail.add(m)); const h3 = await op({ lat: 35.2, lon: -80.8 }); assert.equal(h3.status, 504); assert.match(h3.error, /offline list/); ok('overpass: all mirrors down → 504 with a clear message');
  assert.equal((await op({ lat: 40.7, lon: -74 })).status, 400); ok('overpass: rejects locations outside the NC area');
  fail.clear(); const ipH = freshIp(); let sh; for (let i = 0; i < 31; i++) sh = (await op({ lat: 35.6, lon: -82.5 }, ipH)).status; assert.equal(sh, 429); ok('overpass: rate limited per IP hash');
  globalThis.fetch = realFetch;
  assert.equal(parse({ elements: [{ type: 'node', id: 3, lat: 1, lon: 2, tags: { name: 'A', 'contact:phone': '1' } }] })[0].phone, '1'); ok('overpass: contact:phone fallback');
  console.log(`\n${n} function tests passed (Netlify Blobs local server)`);
} catch (e) { console.error('FAILED after', n, 'tests:', e); process.exitCode = 1; }
finally { await server.stop(); rmSync(dir, { recursive: true, force: true }); }
