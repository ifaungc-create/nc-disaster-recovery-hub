// Apple Push Notification service (APNs) for the iPhone app. Token-based auth (a .p8 key from the Apple
// Developer account, Keys > Apple Push Notifications service). Configuration (Netlify environment variables):
//   APNS_KEY       the full contents of the .p8 file (-----BEGIN PRIVATE KEY----- ...), newlines allowed or as \n
//   APNS_KEY_ID    the 10-character Key ID shown next to the key
//   APNS_TEAM_ID   the Apple Team ID (defaults to HG3J2Z782D, C4I Veteran Services Corp)
//   APNS_TOPIC     the app's bundle ID (defaults to app.disasterresources.nchub)
//   APNS_SANDBOX   "1" only for development builds run from Xcode; App Store and TestFlight builds use production
// Only the device token is stored for an iPhone (as the push address "apns:<hex token>"), never an account.
import http2 from 'node:http2';
import { createPrivateKey, sign } from 'node:crypto';

export const isApns = (endpoint) => typeof endpoint === 'string' && endpoint.startsWith('apns:');
export const apnsToken = (endpoint) => endpoint.slice(5);
export const validApnsEndpoint = (endpoint) => /^apns:[0-9a-f]{64,200}$/.test(String(endpoint || ''));

export function apnsConfigured() { return !!(process.env.APNS_KEY && process.env.APNS_KEY_ID); }
function config() {
  const raw = String(process.env.APNS_KEY || '').replace(/\\n/g, '\n').trim();
  return {
    key: raw ? createPrivateKey(raw) : null,
    keyId: String(process.env.APNS_KEY_ID || '').trim(),
    teamId: String(process.env.APNS_TEAM_ID || 'HG3J2Z782D').trim(),
    topic: String(process.env.APNS_TOPIC || 'app.disasterresources.nchub').trim(),
    host: process.env.APNS_SANDBOX === '1' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com',
  };
}

let cached = { jwt: '', at: 0, keyId: '' };
const b64url = (b) => Buffer.from(b).toString('base64url');
function jwt(cfg) {
  const now = Math.floor(Date.now() / 1000);
  if (cached.jwt && cached.keyId === cfg.keyId && now - cached.at < 40 * 60) return cached.jwt; // Apple: refresh at most every 20 min, valid up to 60
  const head = b64url(JSON.stringify({ alg: 'ES256', kid: cfg.keyId }));
  const body = b64url(JSON.stringify({ iss: cfg.teamId, iat: now }));
  const sig = sign('sha256', Buffer.from(`${head}.${body}`), { key: cfg.key, dsaEncoding: 'ieee-p1363' });
  cached = { jwt: `${head}.${body}.${b64url(sig)}`, at: now, keyId: cfg.keyId };
  return cached.jwt;
}

// Opens one HTTP/2 connection for a batch. send(token, {title, body, url}) resolves to
// { ok: true } | { ok: false, gone: true } (token no longer valid: delete it) | { ok: false, reason }.
export function apnsSession() {
  const cfg = config();
  if (!cfg.key || !cfg.keyId) return { send: async () => ({ ok: false, reason: 'APNs is not configured' }), close() {} };
  const client = http2.connect(cfg.host);
  client.on('error', () => {});
  const send = (token, msg) => new Promise((resolve) => {
    const payload = JSON.stringify({ aps: { alert: { title: msg.title, body: msg.body }, sound: 'default' }, url: msg.url || '' });
    let req;
    try {
      req = client.request({
        ':method': 'POST', ':path': `/3/device/${token}`,
        authorization: `bearer ${jwt(cfg)}`, 'apns-topic': cfg.topic, 'apns-push-type': 'alert',
        'apns-priority': '10', 'apns-expiration': String(Math.floor(Date.now() / 1000) + 24 * 3600),
        'content-type': 'application/json',
      });
    } catch (e) { resolve({ ok: false, reason: String(e?.message || e) }); return; }
    let status = 0, data = '';
    const timer = setTimeout(() => { try { req.close(); } catch {} resolve({ ok: false, reason: 'timeout' }); }, 10000);
    req.on('response', (h) => { status = Number(h[':status']); });
    req.setEncoding('utf8'); req.on('data', (c) => { data += c; });
    req.on('end', () => {
      clearTimeout(timer);
      if (status === 200) return resolve({ ok: true });
      let reason = ''; try { reason = JSON.parse(data).reason || ''; } catch {}
      resolve({ ok: false, gone: status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered', reason: reason || String(status) });
    });
    req.on('error', (e) => { clearTimeout(timer); resolve({ ok: false, reason: String(e?.message || e) }); });
    req.end(payload);
  });
  return { send, close() { try { client.close(); } catch {} } };
}
