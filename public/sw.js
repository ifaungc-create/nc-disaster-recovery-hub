// Offline support: precache the app shell, built assets and the public resource data (/data/*.json),
// network-first for pages, cache-first for static files. Never caches API/function calls or account data.
const CACHE = 'ncdrh-v8';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/mark.svg', '/icons/icon-192.png', '/icons/icon-512.png'];
const DATA = ['counties', 'fire-departments', 'school-districts', 'county-boundaries', 'zips', 'places', 'hotels', 'insurers', 'cultural-food'].map((n) => `/data/${n}.json`);
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(async (c) => {
    await c.addAll(SHELL);
    const html = await (await fetch('/index.html', { cache: 'no-cache' })).text();
    await c.addAll([...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]))]);
    await c.addAll(DATA);
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== 'ncdrh-push').map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/.netlify/')) return;
  // Pages: each public path (/hotels, /county/wake) has its own HTML copy; cache it under its own URL.
  if (req.mode === 'navigate') { const key = url.pathname === '/' ? '/index.html' : url.pathname; e.respondWith(fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(key, cp)); } return r; }).catch(async () => (await caches.match(key)) || caches.match('/index.html'))); return; }
  // Data files: serve cached copy, refresh in the background.
  if (url.pathname.startsWith('/data/')) { e.respondWith(caches.open(CACHE).then(async (c) => { const hit = await c.match(req); const net = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit); return hit || net; })); return; }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); } return r; })));
});

// ---------- Alerts (Web Push). Only shows what the server sent; nothing is tracked or reported back.
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  const title = String(d.title || 'NC Disaster Recovery Hub').slice(0, 80);
  e.waitUntil(self.registration.showNotification(title, { body: String(d.body || '').slice(0, 300), icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', lang: d.lang === 'es' ? 'es' : 'en', tag: d.tag || undefined, data: { url: d.url || '/' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  let url = '/'; try { const u = new URL(e.notification.data?.url || '/', location.origin); url = u.protocol === 'https:' || u.origin === location.origin ? u.href : '/'; } catch {}
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const same = new URL(url).origin === location.origin;
    const w = same && list.find((c) => new URL(c.url).origin === location.origin);
    if (w) return w.focus().then((c) => (c && 'navigate' in c ? c.navigate(url) : null)).catch(() => self.clients.openWindow(url));
    return self.clients.openWindow(url);
  }));
});
// The browser replaced the subscription: move the same topics to the new one. The old endpoint is kept
// on this device only (cache 'ncdrh-push') so the server can find the old topics.
const rpc = (action, ...args) => fetch('/.netlify/functions/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, args }) }).then((r) => r.json());
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open('ncdrh-push'); const r = await c.match('/__push-endpoint'); const old = r ? await r.text() : e.oldSubscription?.endpoint;
    if (!old) return;
    const { result } = await rpc('pushKey');
    const sub = e.newSubscription || await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: result.publicKey });
    await rpc('pushResubscribe', old, sub.toJSON());
    await c.put('/__push-endpoint', new Response(sub.endpoint));
  })().catch(() => {}));
});
