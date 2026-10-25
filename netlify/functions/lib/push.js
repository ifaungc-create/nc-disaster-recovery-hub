// Web Push (VAPID) for alerts. Subscriptions are stored per device, never linked to an account:
//   push/sub/<sha256(endpoint)>  sealed (admin key) { endpoint, keys, topics, lang, createdAt, updatedAt }
//   push/log/<ts>-<rand>         plaintext send log: admin, target, title, counts, time (no subscriber data)
// Topics: 'statewide' and 'county:<Name>' (NC_COUNTIES). Endpoints must belong to a known browser push service.
import { createHash, randomBytes } from 'node:crypto';
import webpush from 'web-push';
import { store } from './store.js';
import { seal, open, adminKey } from './crypto.js';
import { ConfigError } from './env.js';
import { NC_COUNTIES, err } from '../../../src/data/shared.js';
import { SITE_URL } from '../../../src/config.js';

export const MAX_COUNTIES = 10;
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/];
const devMode = () => process.env.NCDRH_DEV_INSECURE_SECRETS === '1' && process.env.CONTEXT !== 'production';

export function vapid() {
  const pub = process.env.VAPID_PUBLIC_KEY || '', priv = process.env.VAPID_PRIVATE_KEY || '';
  if (!/^[A-Za-z0-9_-]{80,100}$/.test(pub) || !/^[A-Za-z0-9_-]{40,50}$/.test(priv)) throw new ConfigError('VAPID keys missing');
  return { pub, priv, subject: process.env.VAPID_SUBJECT || 'mailto:info@c4iveteranservices.org' };
}
export function cleanTopics(t) {
  const list = Array.isArray(t) ? t : [];
  const out = new Set();
  for (const x of list) {
    if (x === 'statewide') out.add(x);
    else if (typeof x === 'string' && x.startsWith('county:') && NC_COUNTIES.includes(x.slice(7))) out.add(x);
  }
  if ([...out].filter((x) => x !== 'statewide').length > MAX_COUNTIES) throw err(`Choose up to ${MAX_COUNTIES} counties.`);
  if (!out.size) throw err('Choose statewide alerts or at least one county.');
  return [...out].sort();
}
export function cleanSubscription(s) {
  const endpoint = typeof s?.endpoint === 'string' ? s.endpoint : '';
  let u; try { u = new URL(endpoint); } catch { throw err('This browser gave an invalid push address.'); }
  const testOrigin = devMode() && process.env.NCDRH_TEST_PUSH_ORIGIN;
  const okHost = u.protocol === 'https:' && (PUSH_HOSTS.some((r) => r.test(u.hostname)) || (testOrigin && u.origin === testOrigin));
  if (!okHost || endpoint.length > 1000) throw err('This browser\'s push service is not supported.');
  const p256dh = String(s?.keys?.p256dh || ''), auth = String(s?.keys?.auth || '');
  if (!/^[A-Za-z0-9_=-]{80,100}$/.test(p256dh) || !/^[A-Za-z0-9_=-]{16,30}$/.test(auth)) throw err('This browser gave invalid push keys.');
  return { endpoint, keys: { p256dh, auth } };
}
const subKey = (endpoint) => 'push/sub/' + createHash('sha256').update(endpoint).digest('base64url');
const now = () => new Date().toISOString();

export const subs = {
  async save(sub, topics, lang) {
    const key = subKey(sub.endpoint); const old = await this.get(sub.endpoint);
    const rec = { ...sub, topics, lang: lang === 'es' ? 'es' : 'en', createdAt: old?.createdAt || now(), updatedAt: now() };
    await store().setJSON(key, seal(rec, adminKey(), key)); return rec;
  },
  async get(endpoint) { const key = subKey(endpoint); const r = await store().get(key, { type: 'json' }); return r ? open(r, adminKey(), key) : null; },
  async remove(endpoint) { await store().delete(subKey(endpoint)); },
  async *all() { for await (const p of store().list({ prefix: 'push/sub/', paginate: true })) for (const b of p.blobs) { const r = await store().get(b.key, { type: 'json' }); if (r) { try { yield { key: b.key, ...open(r, adminKey(), b.key) }; } catch {} } } },
};
export const matches = (sub, target) => (target === 'statewide' ? sub.topics.includes('statewide') : sub.topics.includes('county:' + target));
export function cleanTarget(t) { if (t === 'statewide' || NC_COUNTIES.includes(t)) return t; throw err('Choose statewide or a county.'); }
// Link: a path in this app (/…, #…) or an https link. Stored and sent as a full https URL.
export function cleanLink(l) {
  const s = String(l || '').trim(); if (!s) return SITE_URL + '/';
  if (s.startsWith('/') && !s.startsWith('//')) return SITE_URL + s;
  if (s.startsWith('#')) return SITE_URL + '/' + s;
  let u; try { u = new URL(s); } catch { throw err('The link must start with https:// or /'); }
  if (u.protocol !== 'https:') throw err('The link must start with https:// or /');
  return u.href;
}
const str = (v, max, name, req) => { const s = String(v ?? '').trim(); if (req && !s) throw err(`Please enter ${name}.`); if (s.length > max) throw err(`${name[0].toUpperCase() + name.slice(1)} is too long (${max} characters max).`); return s; };
export function cleanMessage(m = {}) {
  const msg = { target: cleanTarget(m.target), title: str(m.title, 80, 'a title', true), body: str(m.body, 300, 'a message', true), titleEs: str(m.titleEs, 80, 'the Spanish title'), bodyEs: str(m.bodyEs, 300, 'the Spanish message'), url: cleanLink(m.url) };
  if (!!msg.titleEs !== !!msg.bodyEs) throw err('For Spanish, fill in both the title and the message, or leave both empty.');
  return msg;
}
export async function count(target) { let n = 0; for await (const s of subs.all()) if (matches(s, target)) n++; return n; }
export async function send(msg, by, { concurrency = 25 } = {}) {
  const { pub, priv, subject } = vapid();
  const list = []; for await (const s of subs.all()) if (matches(s, msg.target)) list.push(s);
  let sent = 0, failed = 0, removed = 0; const tag = 'ncdrh-' + Date.now();
  const one = async (s) => {
    const es = s.lang === 'es' && msg.titleEs;
    const payload = JSON.stringify({ title: es ? msg.titleEs : msg.title, body: es ? msg.bodyEs : msg.body, url: msg.url, lang: es ? 'es' : 'en', tag });
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { vapidDetails: { subject, publicKey: pub, privateKey: priv }, TTL: 24 * 3600, urgency: 'high', timeout: 10000 });
      sent++;
    } catch (e) {
      if (e?.statusCode === 404 || e?.statusCode === 410) { await store().delete(s.key); removed++; } else failed++;
    }
  };
  for (let i = 0; i < list.length; i += concurrency) await Promise.all(list.slice(i, i + concurrency).map(one));
  const at = now();
  const entry = { at, admin: by, target: msg.target, title: msg.title, body: msg.body, hasSpanish: !!msg.titleEs, url: msg.url, matched: list.length, sent, failed, removed };
  await store().setJSON(`push/log/${at}-${randomBytes(3).toString('hex')}`, entry);
  return entry;
}
export async function sendLog(limit = 50) { const keys = []; for await (const p of store().list({ prefix: 'push/log/', paginate: true })) for (const b of p.blobs) keys.push(b.key); keys.sort().reverse(); const out = []; for (const k of keys.slice(0, limit)) out.push(await store().get(k, { type: 'json' })); return out; }
