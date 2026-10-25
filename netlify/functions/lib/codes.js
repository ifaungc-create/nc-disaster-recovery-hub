// One-time codes for password reset and for confirming admin access. No email service is used:
//  - 'reset'    : issued by a confirmed admin in the Admin area and passed on by phone or in person.
//  - 'recovery' : for accounts whose email is in ADMIN_EMAILS. Written only to the Netlify function log,
//                 which only people with access to the Netlify site can read. Sets a new password and
//                 confirms admin access in one step.
//  - 'claim'    : confirms admin access for a signed-in ADMIN_EMAILS account. Written to the function log,
//                 or issued by an already-confirmed admin.
// Codes are random (about 50 bits), stored only as a keyed hash bound to the account and purpose,
// single-use, expire, and allow at most 5 wrong tries. One open code per account (a new one replaces it).
import { randomBytes, createHmac, timingSafeEqual, hkdfSync } from 'node:crypto';
import { dataKey } from './env.js';
import { store } from './store.js';

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const TTL = { reset: 2 * 3600e3, recovery: 30 * 60e3, claim: 30 * 60e3 };
export const MAX_TRIES = 5;
const key = () => Buffer.from(hkdfSync('sha256', dataKey(), Buffer.from('ncdrh/v1'), Buffer.from('one-time-codes'), 32));
const norm = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const digest = (uid, purpose, code) => createHmac('sha256', key()).update(`${uid}\n${purpose}\n${norm(code)}`).digest();
const slot = (uid) => 'code/' + uid;

export function newCode() {
  const b = randomBytes(10); let s = ''; for (const x of b) s += ALPHA[x % 32];
  return s.slice(0, 5) + '-' + s.slice(5);
}
// Creates (or replaces) the account's open code and returns the plain code once. Only the hash is stored.
export async function issue(uid, purpose, by = '') {
  if (!TTL[purpose]) throw new Error('bad purpose');
  const code = newCode(); const exp = new Date(Date.now() + TTL[purpose]).toISOString();
  await store().setJSON(slot(uid), { purpose, h: digest(uid, purpose, code).toString('base64'), exp, tries: 0, by }, { metadata: { exp } });
  return { code, expiresAt: exp };
}
// Checks a code. On success the code is deleted (single use). On failure the try counter goes up and the
// code is deleted after MAX_TRIES. Returns { purpose, by } on success, or null.
export async function consume(uid, purposes, code) {
  const s = store(); const r = await s.getWithMetadata(slot(uid), { type: 'json' }); const c = r?.data;
  if (!c || !purposes.includes(c.purpose)) return null;
  if (Date.parse(c.exp) < Date.now() || c.tries >= MAX_TRIES) { await s.delete(slot(uid)); return null; }
  const want = Buffer.from(c.h, 'base64'); const got = digest(uid, c.purpose, code);
  if (want.length === got.length && timingSafeEqual(want, got)) {
    // Only one caller can delete with this ETag; a second concurrent use of the same code fails.
    const del = await s.setJSON(slot(uid), { used: true }, { onlyIfMatch: r.etag, metadata: { exp: new Date().toISOString() } });
    if (del && del.modified === false) return null;
    await s.delete(slot(uid)); return { purpose: c.purpose, by: c.by || '' };
  }
  c.tries++;
  if (c.tries >= MAX_TRIES) await s.delete(slot(uid)); else await s.setJSON(slot(uid), c, { onlyIfMatch: r.etag, metadata: { exp: c.exp } });
  return null;
}
export const remove = (uid) => store().delete(slot(uid));
export const hasOpen = async (uid) => { const c = await store().get(slot(uid), { type: 'json' }); return !!(c && c.h && Date.parse(c.exp) > Date.now()); };
