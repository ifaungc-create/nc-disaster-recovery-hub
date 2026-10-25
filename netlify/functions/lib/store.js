// Netlify Blobs repository. One site-wide store (default name "ncdrh"), strong consistency, keys:
//   user/<uid>          account record, AES-256-GCM sealed with the user's key   (email, name, role, org, pw hash)
//   email/<blind-index> { uid }  (HMAC of the normalized email, so no raw email in keys)
//   data/<uid>          sealed { cases, notes, referrals, myCards }  (notes include share cards the user saved)
//   card/<code>         sealed share card (responder contact info only), metadata { exp } for cleanup
//   resp/<uid>          sealed (admin key) responder request: name, email, org, status, decided by/at
//   sub/<uid>/<id>      sealed (admin key) record submitted by a responder + review status
//   community/approved  PUBLIC, plaintext: approved community records shown to everyone
//   audit/<ts>-<rand>   admin action log: who (admin email), what, target id, when. No client data.
//   rl/<group>/<bucket>/<ip-hash>  rate-limit counters (no raw IPs)
// All read-modify-write updates use ETag conditional writes (onlyIfMatch / onlyIfNew) with retry.
import { getStore } from '@netlify/blobs';
import { STORE_NAME } from './env.js';
import { seal, open, userKey, cardKey, adminKey } from './crypto.js';
import { randomBytes } from 'node:crypto';
import { err } from '../../../src/data/shared.js';

export const store = () => getStore({ name: STORE_NAME, consistency: 'strong' });
const MAX_BLOB = 2 * 1024 * 1024;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Full-jitter exponential backoff between conflicting writes (cap 400 ms).
const backoff = (i) => sleep(Math.random() * Math.min(400, 20 * 2 ** i));
const TRIES = 10;

async function readSealed(key, k) {
  const r = await store().getWithMetadata(key, { type: 'json' });
  if (!r) return { value: null, etag: null };
  if (!r.etag) throw new Error('Storage returned no ETag; refusing an unconditional overwrite');
  return { value: open(r.data, k, key), etag: r.etag };
}
// Write sealed value; `etag` null means "must not exist yet".
async function writeSealed(key, k, value, etag, metadata) {
  const env = seal(value, k, key);
  if (JSON.stringify(env).length > MAX_BLOB) throw err('Your notes are too large to save. Delete some old notes first.', 413);
  const res = await store().setJSON(key, env, { ...(etag ? { onlyIfMatch: etag } : { onlyIfNew: true }), ...(metadata ? { metadata } : {}) });
  return res.modified;
}
// Optimistic concurrency: re-read and re-apply on conflict, so two phones editing at once never lose an update.
export async function mutate(key, k, init, fn, metadata) {
  for (let i = 0; i < TRIES; i++) {
    const { value, etag } = await readSealed(key, k);
    if (!value && !init) throw err('Not found', 404);
    const next = await fn(structuredClone(value || init()));
    if (await writeSealed(key, k, next, etag, typeof metadata === 'function' ? metadata(next) : metadata)) return next;
    await backoff(i);
  }
  throw err('Someone else changed this at the same time. Please try again.', 409);
}

export const users = {
  mutate: (uid, fn) => mutate('user/' + uid, userKey(uid), null, fn),
  async claimEmail(idx, uid) { return (await store().setJSON('email/' + idx, { uid }, { onlyIfNew: true })).modified; },
  async uidForEmail(idx) { return (await store().get('email/' + idx, { type: 'json' }))?.uid || null; },
  async create(u) { if (!(await writeSealed('user/' + u.id, userKey(u.id), u, null))) throw err('Could not create account', 409); },
  async get(uid) { return (await readSealed('user/' + uid, userKey(uid))).value; },
  async remove(uid, idx) { await store().delete('user/' + uid); if (idx) await store().delete('email/' + idx); },
};
const emptyData = () => ({ cases: [], notes: [], referrals: [], myCards: [] });
export const data = {
  async get(uid) { return (await readSealed('data/' + uid, userKey(uid))).value || emptyData(); },
  mutate: (uid, fn) => mutate('data/' + uid, userKey(uid), emptyData, fn),
  async remove(uid) { await store().delete('data/' + uid); },
};
export const cards = {
  async create(code, rec) { return writeSealed('card/' + code, cardKey(code), rec, null, { exp: rec.expiresAt }); },
  async get(code) { return (await readSealed('card/' + code, cardKey(code))).value; },
  mutate: (code, fn) => mutate('card/' + code, cardKey(code), null, fn, (v) => ({ exp: v.expiresAt })),
  async remove(code) { await store().delete('card/' + code); },
};

export const responders = {
  async create(uid, rec) { return writeSealed('resp/' + uid, adminKey(), rec, null); },
  async get(uid) { return (await readSealed('resp/' + uid, adminKey())).value; },
  mutate: (uid, fn) => mutate('resp/' + uid, adminKey(), null, fn),
  async list() { const out = []; for await (const p of store().list({ prefix: 'resp/', paginate: true })) for (const b of p.blobs) { const v = (await readSealed(b.key, adminKey())).value; if (v) out.push(v); } return out; },
  async remove(uid) { await store().delete('resp/' + uid); },
};
export const submissions = {
  async create(uid, rec) { return writeSealed(`sub/${uid}/${rec.id}`, adminKey(), rec, null); },
  async get(uid, id) { return (await readSealed(`sub/${uid}/${id}`, adminKey())).value; },
  mutate: (uid, id, fn) => mutate(`sub/${uid}/${id}`, adminKey(), null, fn),
  async list(uid = '') { const out = []; for await (const p of store().list({ prefix: 'sub/' + (uid ? uid + '/' : ''), paginate: true })) for (const b of p.blobs) { const v = (await readSealed(b.key, adminKey())).value; if (v) out.push(v); } return out; },
  async removeAllFor(uid) { for await (const p of store().list({ prefix: `sub/${uid}/`, paginate: true })) for (const b of p.blobs) await store().delete(b.key); },
};
// Public list of approved community records. Plaintext on purpose: it is published to everyone.
export const community = {
  async list() { return (await store().get('community/approved', { type: 'json' }))?.records || []; },
  async mutate(fn) {
    for (let i = 0; i < TRIES; i++) {
      const r = await store().getWithMetadata('community/approved', { type: 'json' });
      if (r && !r.etag) throw new Error('Storage returned no ETag');
      const next = await fn(structuredClone(r?.data || { records: [] }));
      const res = await store().setJSON('community/approved', next, r ? { onlyIfMatch: r.etag } : { onlyIfNew: true });
      if (res.modified) return next;
      await backoff(i);
    }
    throw err('Please try again.', 409);
  },
};
export const audit = {
  async log(entry) { const at = new Date().toISOString(); await store().setJSON(`audit/${at}-${randomBytes(3).toString('hex')}`, { at, ...entry }); },
  async recent(limit = 100) { const keys = []; for await (const p of store().list({ prefix: 'audit/', paginate: true })) for (const b of p.blobs) keys.push(b.key); keys.sort().reverse(); const out = []; for (const k of keys.slice(0, limit)) out.push(await store().get(k, { type: 'json' })); return out; },
};
