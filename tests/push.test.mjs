// Push alerts, end to end on the server side: subscribe → admin send → a local fake push service receives
// the request, which is decrypted with the subscription's private key (RFC 8291) to prove delivery works.
// Also: topics, unsubscribe, expired (410) cleanup, VAPID header, admin-only + confirmation, send log.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createECDH, randomBytes } from 'node:crypto';
import https from 'node:https';
import { createRequire } from 'node:module';
const ece = createRequire(import.meta.url)('http_ece');
const webpush = createRequire(import.meta.url)('web-push');

const dir = mkdtempSync(join(tmpdir(), 'ncdrh-push-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(dir, 'k.pem'), '-out', join(dir, 'c.pem'), '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' });
const got = []; let gone = new Set();
const srv = https.createServer({ key: readFileSync(join(dir, 'k.pem')), cert: readFileSync(join(dir, 'c.pem')) }, (req, res) => {
  const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => {
    const id = req.url.split('/').pop(); got.push({ id, headers: req.headers, body: Buffer.concat(chunks) });
    res.statusCode = gone.has(id) ? 410 : 201; res.end();
  });
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const ORIGIN = `https://localhost:${srv.address().port}`;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // the fake push service uses a throwaway self-signed certificate
process.env.NCDRH_DEV_INSECURE_SECRETS = '1';
process.env.NCDRH_TEST_PUSH_ORIGIN = ORIGIN;
process.env.ADMIN_EMAILS = 'dn22@c4iveteranservices.org';
const V = webpush.generateVAPIDKeys(); process.env.VAPID_PUBLIC_KEY = V.publicKey; process.env.VAPID_PRIVATE_KEY = V.privateKey;
const { startLocalBlobs } = await import('../netlify/functions/lib/local-blobs.js');
const { server } = await startLocalBlobs(join(dir, 'blobs'));
const { default: api } = await import('../netlify/functions/api.js');
const { store } = await import('../netlify/functions/lib/store.js');
let ipN = 0; const ip = () => `203.0.113.${++ipN}`;
const call = async (action, args = [], token) => { const r = await api(new Request('http://x/', { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify({ action, args }) }), { ip: ip() }); return { status: r.status, ...(await r.json()) }; };
const device = (id) => { const ecdh = createECDH('prime256v1'); ecdh.generateKeys(); const auth = randomBytes(16); return { ecdh, auth, sub: { endpoint: `${ORIGIN}/push/${id}`, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } } }; };
const decrypt = (d, body) => JSON.parse(ece.decrypt(body, { version: 'aes128gcm', privateKey: d.ecdh, authSecret: d.auth.toString('base64url') }).toString());
let n = 0; const ok = (m) => { n++; console.log('  ✓', m); };
try {
  const k = await call('pushKey'); assert.equal(k.result.publicKey, V.publicKey); ok('pushKey returns the VAPID public key');
  const A = device('a'), B = device('b'), C = device('c');
  assert.equal((await call('pushSubscribe', [A.sub, ['statewide'], 'en'])).status, 200);
  assert.deepEqual((await call('pushSubscribe', [B.sub, ['county:Wake', 'statewide'], 'es'])).result, { topics: ['county:Wake', 'statewide'], lang: 'es' });
  assert.equal((await call('pushSubscribe', [C.sub, ['county:Buncombe'], 'en'])).status, 200); ok('subscribe: statewide and county topics, language');
  assert.equal((await call('pushSubscribe', [A.sub, [], 'en'])).status, 400); assert.equal((await call('pushSubscribe', [A.sub, ['county:Atlantis'], 'en'])).status, 400); ok('rejects empty or unknown topics');
  assert.equal((await call('pushSubscribe', [{ ...A.sub, endpoint: 'https://evil.example.com/x' }, ['statewide'], 'en'])).status, 400);
  assert.equal((await call('pushSubscribe', [{ ...A.sub, endpoint: 'http://fcm.googleapis.com/x' }, ['statewide'], 'en'])).status, 400); ok('rejects push addresses that are not a known https push service (no SSRF)');
  assert.deepEqual((await call('pushStatus', [B.sub])).result.topics, ['county:Wake', 'statewide']); ok('status returns this device\'s topics');
  const raw = []; for await (const p of store().list({ prefix: 'push/sub/', paginate: true })) for (const b of p.blobs) raw.push(JSON.stringify(await store().get(b.key, { type: 'json' })));
  assert.equal(raw.length, 3); assert.ok(raw.every((r) => !r.includes('localhost') && !r.includes('Wake'))); ok('subscriptions are encrypted at rest, no account link');

  const u = (await call('createUser', [{ email: 'pat@example.org', password: 'longenough1', name: 'Pat', role: 'affected', termsAccepted: true }])).result.token;
  const adm = (await call('createUser', [{ email: 'dn22@c4iveteranservices.org', password: 'admin-pass-123', name: 'Admin', role: 'affected', termsAccepted: true }])).result.token;
  const msg = { target: 'statewide', title: 'Test alert', body: 'Disaster recovery center open', titleEs: 'Alerta de prueba', bodyEs: 'Centro de recuperación abierto', url: '/hotels' };
  assert.equal((await call('adminPushSend', [msg, true], u)).status, 403); assert.equal((await call('adminPushCount', ['statewide'])).status, 401); ok('only admins can count or send');
  assert.equal((await call('adminPushSend', [msg, false], adm)).status, 400); ok('send requires explicit confirmation');
  assert.equal((await call('adminPushSend', [{ ...msg, url: 'javascript:alert(1)' }, true], adm)).status, 400); assert.equal((await call('adminPushSend', [{ ...msg, bodyEs: '' }, true], adm)).status, 400); ok('rejects unsafe links and half-translated messages');
  assert.equal((await call('adminPushCount', ['statewide'], adm)).result.count, 2); assert.equal((await call('adminPushCount', ['Wake'], adm)).result.count, 1); ok('count matches topic');
  const r = await call('adminPushSend', [msg, true], adm); assert.equal(r.status, 200, r.error); assert.equal(r.result.sent, 2);
  assert.deepEqual(got.map((g) => g.id).sort(), ['a', 'b']);
  const ga = got.find((g) => g.id === 'a'), gb = got.find((g) => g.id === 'b');
  assert.match(ga.headers.authorization, /^vapid t=.+, k=/); assert.equal(ga.headers['content-encoding'], 'aes128gcm'); assert.equal(ga.headers.ttl, '86400');
  const pa = decrypt(A, ga.body), pb = decrypt(B, gb.body);
  assert.equal(pa.title, 'Test alert'); assert.equal(pa.url, 'https://disaster-resources.app/hotels'); assert.equal(pb.title, 'Alerta de prueba'); assert.equal(pb.lang, 'es');
  ok('statewide send delivered to the 2 statewide devices; payload decrypts (VAPID, aes128gcm); Spanish device gets Spanish');
  got.length = 0; gone = new Set(['c']);
  const r2 = await call('adminPushSend', [{ target: 'Buncombe', title: 'Buncombe', body: 'x' }], adm); assert.equal(r2.status, 400);
  const r3 = await call('adminPushSend', [{ target: 'Buncombe', title: 'Buncombe', body: 'x' }, true], adm); assert.equal(r3.result.removed, 1); assert.equal(r3.result.sent, 0);
  assert.equal((await call('pushStatus', [C.sub])).result, null); ok('county send; expired (410) subscription removed automatically');
  assert.equal((await call('pushUnsubscribe', [A.sub])).status, 200); assert.equal((await call('pushStatus', [A.sub])).result, null); assert.equal((await call('adminPushCount', ['statewide'], adm)).result.count, 1); ok('unsubscribe deletes the subscription');
  const log = (await call('adminPushLog', [], adm)).result; assert.equal(log.length, 2); assert.equal(log[0].target, 'Buncombe'); assert.equal(log[1].sent, 2); assert.ok(!JSON.stringify(log).includes('localhost')); ok('send log (newest first) with counts, no subscriber data');
  const D = device('d'); await call('pushSubscribe', [D.sub, ['county:Wake'], 'en']); const D2 = device('d2');
  assert.equal((await call('pushResubscribe', [D.sub.endpoint, D2.sub])).status, 200); assert.deepEqual((await call('pushStatus', [D2.sub])).result.topics, ['county:Wake']); assert.equal((await call('pushStatus', [D.sub])).result, null); ok('resubscribe (browser rotated the subscription) keeps topics');
  delete process.env.VAPID_PRIVATE_KEY; assert.equal((await call('pushSubscribe', [A.sub, ['statewide'], 'en'])).status, 503); ok('fails closed without VAPID keys');
  console.log(`\n${n} push tests passed`);
} catch (e) { console.error('FAILED after', n, 'tests:', e); process.exitCode = 1; }
finally { await server.stop(); srv.close(); rmSync(dir, { recursive: true, force: true }); }
