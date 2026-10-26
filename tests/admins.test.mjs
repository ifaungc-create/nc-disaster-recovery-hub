// Unit/API tests for adding administrators: invite with a temporary password, forced password change,
// expiry, revoke, last-admin protection, new temporary password, non-admins blocked, operator log format.
// Runs on the official Netlify Blobs local server in a temp folder. No network, no Netlify account.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.NCDRH_DEV_INSECURE_SECRETS = '1';
process.env.ADMIN_EMAILS = 'dn22@c4iveteranservices.org';
const dir = mkdtempSync(join(tmpdir(), 'ncdrh-admins-'));
const { startLocalBlobs } = await import('../netlify/functions/lib/local-blobs.js');
const { server } = await startLocalBlobs(dir);
const { default: api, maskEmail, TEMP_PW_HOURS } = await import('../netlify/functions/api.js');
const { store, users } = await import('../netlify/functions/lib/store.js');
const { tempPassword } = await import('../netlify/functions/lib/crypto.js');

let ipN = 0; const freshIp = () => `203.0.113.${++ipN}`;
const call = async (action, args = [], token, ip = freshIp()) => { const r = await api(new Request('http://x/', { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify({ action, args }) }), { ip }); return { status: r.status, ...(await r.json()) }; };
const realLog = console.log; const lines = [];
const capture = async (fn) => { const at = lines.length; console.log = (...x) => { const l = x.join(' '); if (l.startsWith('[admin-code]')) lines.push(l); else realLog(...x); }; try { return { r: await fn(), l: lines.slice(at) }; } finally { console.log = realLog; } };
const codeIn = (l) => (l.join('\n').match(/: ([A-Z2-9]{5}-[A-Z2-9]{5}) \(single use/) || [])[1];
const allRaw = async () => { let s = ''; for await (const p of store().list({ paginate: true })) for (const b of p.blobs) s += b.key + JSON.stringify(await store().get(b.key, { type: 'json' })); return s; };
let n = 0; const ok = (m) => { n++; console.log('  ✓', m); };

try {
  // ---------- temporary password generator
  const tp = tempPassword(); assert.match(tp, /^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){4}$/); assert.notEqual(tp, tempPassword()); ok('temporary password: 20 random symbols (100 bits), no look-alike characters, groups of 4');
  assert.equal(maskEmail('dn22@c4iveteranservices.org'), 'd***@c4i…'); ok('operator log masks the email as d***@c4i…');

  // ---------- owner bootstrap (unchanged: log-code claim), with the clearer log line
  const owner = (await call('createUser', [{ email: 'dn22@c4iveteranservices.org', password: 'owner-pass-1', name: 'Owner', role: 'affected', termsAccepted: true }])).result;
  assert.equal(owner.isAdmin, false); assert.equal(owner.adminPending, true);
  assert.equal((await call('adminListAdmins', [], owner.token)).status, 403); assert.equal((await call('adminInvite', [{ name: 'X', email: 'x@example.org' }], owner.token)).status, 403); ok('ADMIN_EMAILS account cannot list or invite admins before the log-code claim');
  const st = await capture(() => call('adminClaimStart', [], owner.token));
  assert.equal(st.l.length, 1); assert.match(st.l[0], /^\[admin-code\] ADMIN CLAIM CODE for d\*\*\*@c4i…: [A-Z2-9]{5}-[A-Z2-9]{5} \(single use, expires /); assert.ok(!st.l[0].includes('dn22')); ok('claim code is logged on its own labelled line: "ADMIN CLAIM CODE for d***@c4i…: XXXXX-XXXXX"');
  const fin = await call('adminClaimFinish', [codeIn(st.l)], owner.token); assert.equal(fin.result.isAdmin, true); const tOwn = owner.token; ok('owner confirms with the code (bootstrap kept)');
  const l0 = (await call('adminListAdmins', [], tOwn)).result; assert.equal(l0.length, 1); assert.equal(l0[0].source, 'bootstrap'); assert.equal(l0[0].isSelf, true); assert.equal(l0[0].bootstrap, true); ok('Administrators list shows the owner (bootstrap entry)');

  // ---------- non-admins are blocked
  const pat = (await call('createUser', [{ email: 'pat@example.org', password: 'pat-pass-11', name: 'Pat', role: 'affected', termsAccepted: true }])).result;
  for (const [act, args] of [['adminInvite', [{ name: 'Evil', email: 'evil@example.org' }]], ['adminListAdmins', []], ['adminRevokeAdmin', [owner.id]], ['adminNewTempPassword', [owner.id]]]) {
    assert.equal((await call(act, args, pat.token)).status, 403, act); assert.equal((await call(act, args)).status, 401, act + ' signed out');
  }
  ok('non-admins (403) and signed-out callers (401) cannot invite, list, revoke or reset administrators');

  // ---------- invite a new person
  assert.equal((await call('adminInvite', [{ name: 'A', email: 'not-an-email' }], tOwn)).status, 400);
  assert.equal((await call('adminInvite', [{ name: '  ', email: 'ok@example.org' }], tOwn)).status, 400); ok('invite validates email and name');
  const inv = await call('adminInvite', [{ name: 'Alex Admin', email: '  Alex@Example.org ' }], tOwn); assert.equal(inv.status, 200, inv.error);
  const temp = inv.result.tempPassword; assert.match(temp, /^[A-Z2-9]{4}(-[A-Z2-9]{4}){4}$/); assert.equal(inv.result.email, 'alex@example.org'); assert.equal(inv.result.created, true);
  const hrs = (Date.parse(inv.result.expiresAt) - Date.now()) / 36e5; assert.ok(hrs > TEMP_PW_HOURS - 0.1 && hrs <= TEMP_PW_HOURS, String(hrs)); ok('invite creates the account and returns the temporary password once, expiring in 72 hours');
  const raw = await allRaw(); assert.ok(!raw.includes(temp)); assert.ok(!raw.includes('alex@example.org')); ok('temporary password stored hashed only (not in any blob); email stays encrypted');
  const alexRec = await users.get(inv.result.id); assert.equal(alexRec.mustChangePassword, true); assert.equal(alexRec.adminGranted, true); assert.ok(alexRec.pw.startsWith('scrypt') || alexRec.pw.length > 40); ok('account stores mustChangePassword + admin status (the invite confirms the admin)');
  assert.equal((await call('adminInvite', [{ name: 'Alex', email: 'alex@example.org' }], tOwn)).status, 409); ok('inviting an existing administrator is refused (409)');
  const auditTxt = JSON.stringify((await call('adminAudit', [], tOwn)).result); assert.match(auditTxt, /admin\.invite/); assert.ok(!auditTxt.includes(temp)); ok('admin log entry written for the invite, without the password');

  // ---------- forced password change
  const lg = await call('verifyLogin', ['alex@example.org', temp]); assert.equal(lg.status, 200); assert.equal(lg.result.mustChangePassword, true); assert.equal(lg.result.isAdmin, true); assert.equal(lg.result.privacyPending, true);
  const tAlexTemp = lg.result.token; ok('sign-in with the temporary password works and says mustChangePassword');
  for (const [act, args] of [['adminListAdmins', []], ['list', ['cases']], ['exportData', []], ['listCommunity', []], ['getShareCard', ['ABCD2345']], ['adminInvite', [{ name: 'Z', email: 'z@example.org' }]], ['deleteAccount', []]]) {
    const r = await call(act, args, tAlexTemp); assert.equal(r.status, 403, act); assert.match(r.error, /set a new password/);
  }
  assert.equal((await call('getUser', [inv.result.id], tAlexTemp)).result.mustChangePassword, true); ok('server blocks every other action (403, public ones too) until the password is changed; getUser still works');
  const lg2 = (await call('verifyLogin', ['alex@example.org', temp])).result.token; // a second session (another device)
  assert.equal((await call('changePassword', ['WRONG-TEMP', 'brand-new-pass-1', true], tAlexTemp)).status, 400); ok('change refused when the temporary password is wrong');
  assert.equal((await call('changePassword', [temp, temp, true], tAlexTemp)).status, 400); ok('new password must differ from the temporary one');
  assert.equal((await call('changePassword', [temp, 'short', true], tAlexTemp)).status, 400); assert.equal((await call('changePassword', [temp, 'x'.repeat(257), true], tAlexTemp)).status, 400); ok('new password must be 8 to 256 characters');
  assert.equal((await call('changePassword', [temp, 'brand-new-pass-1'], tAlexTemp)).status, 400); ok('privacy notice must be accepted by an invited account');
  const ch = await call('changePassword', [temp, 'brand-new-pass-1', true], tAlexTemp); assert.equal(ch.status, 200, ch.error); assert.equal(ch.result.mustChangePassword, undefined); const tAlex = ch.result.token;
  assert.equal((await call('getUser', [inv.result.id], lg2)).status, 401); assert.equal((await call('getUser', [inv.result.id], tAlexTemp)).status, 401); ok('after the change, other sessions end (old tokens refused); a new token is returned');
  assert.equal((await call('verifyLogin', ['alex@example.org', temp])).status, 401); assert.equal((await call('verifyLogin', ['alex@example.org', 'brand-new-pass-1'])).status, 200); ok('temporary password no longer works; the new one does');
  assert.equal((await call('adminListAdmins', [], tAlex)).status, 200); assert.ok((await users.get(inv.result.id)).privacyAcceptedAt); ok('new admin can use admin tools right away; privacy acceptance recorded');
  assert.match(JSON.stringify((await call('adminAudit', [], tOwn)).result), /admin\.password_set/); ok('admin log records that the new admin set their password');

  // ---------- expiry (72 h)
  const inv2 = (await call('adminInvite', [{ name: 'Blair', email: 'blair@example.org' }], tOwn)).result;
  const tBlairTemp = (await call('verifyLogin', ['blair@example.org', inv2.tempPassword])).result.token;
  await users.mutate(inv2.id, (x) => ({ ...x, tempPwExpiresAt: new Date(Date.now() - 1000).toISOString() }));
  const ex = await call('verifyLogin', ['blair@example.org', inv2.tempPassword]); assert.equal(ex.status, 401); assert.match(ex.error, /expired/);
  assert.equal((await call('changePassword', [inv2.tempPassword, 'blair-new-pass-1', true], tBlairTemp)).status, 401); ok('expired temporary password: sign-in and change refused with "expired"');
  const lst = (await call('adminListAdmins', [], tOwn)).result; const b = lst.find((x) => x.email === 'blair@example.org'); assert.equal(b.waitingFirstSignIn, true); assert.equal(b.tempExpired, true); ok('Administrators list shows "waiting for first sign-in" and expired');
  const nt = await call('adminNewTempPassword', [inv2.id], tOwn); assert.equal(nt.status, 200); assert.notEqual(nt.result.tempPassword, inv2.tempPassword);
  assert.equal((await call('verifyLogin', ['blair@example.org', inv2.tempPassword])).status, 401); assert.equal((await call('verifyLogin', ['blair@example.org', nt.result.tempPassword])).status, 200); ok('new temporary password (resend) replaces the old one and resets the 72 h');
  assert.equal((await call('adminNewTempPassword', [owner.id], tOwn)).status, 400); assert.equal((await call('adminNewTempPassword', [pat.id], tOwn)).status, 404); ok('new temporary password: not for yourself, only for administrators');
  assert.match(JSON.stringify((await call('adminAudit', [], tOwn)).result), /admin\.temp_password/); assert.ok(!JSON.stringify((await call('adminAudit', [], tOwn)).result).includes(nt.result.tempPassword)); ok('admin log entry for the new temporary password, without it');

  // ---------- existing account upgraded
  const tPatOld = pat.token;
  const up = await call('adminInvite', [{ name: 'ignored', email: 'pat@example.org' }], tOwn); assert.equal(up.status, 200); assert.equal(up.result.created, false); assert.equal(up.result.name, 'Pat');
  assert.equal((await call('getUser', [pat.id], tPatOld)).status, 401); assert.equal((await call('verifyLogin', ['pat@example.org', 'pat-pass-11'])).status, 401);
  const patLg = await call('verifyLogin', ['pat@example.org', up.result.tempPassword]); assert.equal(patLg.result.mustChangePassword, true); assert.equal(patLg.result.privacyPending, false); ok('existing account is upgraded: old password and sessions stop, temporary password + forced change');
  assert.equal((await call('changePassword', [up.result.tempPassword, 'pat-better-pass'], patLg.result.token)).status, 200); ok('upgraded account (privacy already accepted) changes the password without the checkbox');

  // ---------- revoke + last-admin protection
  assert.equal((await call('adminRevokeAdmin', [owner.id], tOwn)).status, 400); ok('cannot revoke yourself');
  assert.equal((await call('adminRevokeAdmin', [pat.id + 'x'], tOwn)).status, 404); ok('revoke: unknown or non-admin account refused');
  const rv = await call('adminRevokeAdmin', [pat.id, 'test'], tOwn); assert.equal(rv.status, 200); assert.equal(rv.result.bootstrap, false);
  const patAfter = await call('verifyLogin', ['pat@example.org', 'pat-better-pass']); assert.equal(patAfter.result.isAdmin, false); assert.equal((await call('adminListAdmins', [], patAfter.result.token)).status, 403); ok('revoked admin keeps the account but loses admin rights (sessions ended)');
  assert.match(JSON.stringify((await call('adminAudit', [], tOwn)).result), /admin\.revoke/); ok('admin log entry for the revocation');
  // Alex removes Blair; now only owner + Alex. Alex removes owner -> Alex is the last admin. Alex cannot remove self, and the owner (bootstrap) can claim again.
  assert.equal((await call('adminRevokeAdmin', [inv2.id], tAlex)).status, 200);
  const rvOwn = await call('adminRevokeAdmin', [owner.id], tAlex); assert.equal(rvOwn.status, 200); assert.equal(rvOwn.result.bootstrap, true);
  assert.equal((await call('adminListAdmins', [], tAlex)).result.length, 1); assert.equal((await call('adminRevokeAdmin', [inv.result.id], tAlex)).status, 400);
  const dl = await call('deleteAccount', [], tAlex); assert.equal(dl.status, 409); assert.match(dl.error, /only administrator/); ok('last administrator cannot be removed, and cannot delete their own account');
  // concurrent mutual revocation never leaves zero admins
  const tOwn2 = (await call('verifyLogin', ['dn22@c4iveteranservices.org', 'owner-pass-1'])).result.token;
  const st2 = await capture(() => call('adminClaimStart', [], tOwn2)); assert.equal((await call('adminClaimFinish', [codeIn(st2.l)], tOwn2)).result.isAdmin, true); ok('revoked bootstrap owner can confirm again with a new log code');
  // a revocation that already landed does not block the re-confirmed owner
  const inv3 = (await call('adminInvite', [{ name: 'Casey', email: 'casey@example.org' }], tOwn2)).result; assert.equal((await call('adminRevokeAdmin', [inv3.id], tOwn2)).status, 200); ok('re-confirmed owner can manage admins again (an applied revocation does not block them)');
  const both = await Promise.all([call('adminRevokeAdmin', [owner.id], tAlex), call('adminRevokeAdmin', [inv.result.id], tOwn2)]);
  assert.ok(both.filter((x) => x.status === 200).length <= 1, JSON.stringify(both.map((x) => x.status)));
  const left = []; for (const [id, em] of [[owner.id, 'dn22'], [inv.result.id, 'alex']]) { const u = await users.get(id); if (u.adminGranted || u.adminVerifiedEmail) left.push(em); } assert.ok(left.length >= 1); ok('two admins revoking each other at the same time: at most one wins, never zero admins');
  const dlBlock = await call('adminDeleteUser', [left.includes('alex') ? inv.result.id : owner.id, 'x', true], left.includes('alex') ? tOwn2 : tAlex);
  assert.ok([401, 403, 409].includes(dlBlock.status)); ok('admin accounts cannot be deleted from the Accounts tab while they are administrators');
  assert.ok(!lines.join('\n').includes('@example.org') && !lines.join('\n').includes('dn22@')); ok('no full email ever written to the operator log');
  console.log(`\n${n} administrator tests passed`);
} catch (e) { console.error(e); process.exitCode = 1; } finally { await server.stop(); rmSync(dir, { recursive: true, force: true }); }
