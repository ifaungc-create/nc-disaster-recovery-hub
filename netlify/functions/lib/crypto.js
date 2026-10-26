// Password hashing (scrypt), key derivation (HKDF-SHA256) and encryption at rest (AES-256-GCM).
import { scrypt as _scrypt, randomBytes, timingSafeEqual, hkdfSync, createCipheriv, createDecipheriv, createHmac } from 'node:crypto';
import { promisify } from 'node:util';
import { dataKey, sessionSecret } from './env.js';
const scrypt = promisify(_scrypt);

// scrypt N=2^17, r=8, p=1 (OWASP Password Storage Cheat Sheet recommendation; ~128 MiB, a few hundred ms).
// The cost is stored with each hash, so it can be raised later without breaking existing accounts.
// SCRYPT_LOG_N can raise it (max 18); it cannot be set below 15.
const LOG_N = Math.min(Math.max(Number(process.env.SCRYPT_LOG_N) || 17, 15), 18), R = 8, P = 1, KEYLEN = 64;
const opts = (logN) => ({ N: 2 ** logN, r: R, p: P, maxmem: 256 * 2 ** logN * R + 1024 * 1024 });
export async function hashPassword(pw) {
  const salt = randomBytes(16);
  const h = await scrypt(String(pw).normalize('NFKC'), salt, KEYLEN, opts(LOG_N));
  return `scrypt$${LOG_N}$${R}$${P}$${salt.toString('base64')}$${h.toString('base64')}`;
}
// Unknown accounts are checked against this so the response time does not reveal whether an email exists.
let dummy; const dummyHash = async () => (dummy ||= await hashPassword('not-a-real-password-' + randomBytes(8).toString('hex')));
export async function verifyPassword(pw, stored) {
  const s = stored || (await dummyHash());
  const [alg, logN, r, p, salt, hash] = String(s).split('$');
  if (alg !== 'scrypt' || Number(r) !== R || Number(p) !== P || !(Number(logN) >= 15 && Number(logN) <= 18)) return false;
  const want = Buffer.from(hash, 'base64');
  const got = await scrypt(String(pw ?? '').normalize('NFKC'), Buffer.from(salt, 'base64'), want.length, opts(Number(logN)));
  return timingSafeEqual(got, want) && !!stored;
}

const SALT = Buffer.from('ncdrh/v1');
const hkdf = (ikm, info) => Buffer.from(hkdfSync('sha256', ikm, SALT, Buffer.from(info), 32));
// Per-user data key: HKDF(DATA_ENCRYPTION_KEY, "user:<id>"). Per-card key: HKDF(..., "card:<code>").
export const userKey = (uid) => hkdf(dataKey(), 'user:' + uid);
export const cardKey = (code) => hkdf(dataKey(), 'card:' + code);
// Admin-queue key: responder requests and pending submissions (responder names/emails, never client data).
export const adminKey = () => hkdf(dataKey(), 'admin-queue');
// Blind index for email lookup, so raw emails never appear in blob keys.
export const emailIndex = (email) => createHmac('sha256', hkdf(dataKey(), 'email-index')).update(email).digest('base64url');
// Rate-limit bucket id: a keyed hash of the client IP, truncated. The raw IP is never stored.
export const ipHash = (ip) => createHmac('sha256', hkdf(Buffer.from(sessionSecret()), 'ip-hash')).update(String(ip || 'unknown')).digest('base64url').slice(0, 22);

// Envelope: { v, iv, tag, ct } (base64). The blob key is bound in as AAD, so a ciphertext copied
// to another key (e.g. another user's slot) fails to decrypt.
export function seal(obj, key, aad) {
  const iv = randomBytes(12); const c = createCipheriv('aes-256-gcm', key, iv); c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return { v: 1, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), ct: ct.toString('base64') };
}
export function open(env, key, aad) {
  if (!env || env.v !== 1) throw new Error('Unreadable record');
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(env.iv, 'base64')); d.setAAD(Buffer.from(aad)); d.setAuthTag(Buffer.from(env.tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(env.ct, 'base64')), d.final()]).toString('utf8'));
}
// Temporary password for a new administrator: 20 characters from a 32-symbol alphabet with no look-alikes
// (100 bits), in groups of 4 so it can be read out by phone. Only its scrypt hash is stored.
const TEMP_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const tempPassword = () => { const b = randomBytes(20); return [...b].map((x) => TEMP_ALPHA[x % 32]).join('').match(/.{4}/g).join('-'); };
