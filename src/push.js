// Web Push on this device. Nothing happens until the person taps "Turn on alerts":
// then the browser asks for permission, subscribes, and the server stores only the push address + topics.
// In the iPhone app (Capacitor) the same screen uses Apple Push: the push address is "apns:<device token>".
import { api, ADAPTER } from './data/index.js';
import { isNative, can } from './native.js';
const NATIVE_KEY = 'ncdrh.apns';
const nativeOn = () => isNative() && can.push();
const nativeSub = () => { try { const e = localStorage.getItem(NATIVE_KEY); return e ? { endpoint: e, toJSON: () => ({ endpoint: e }) } : null; } catch { return null; } };
async function nativeToken() {
  const { PushNotifications } = await import('@capacitor/push-notifications');
  let p = await PushNotifications.checkPermissions();
  if (p.receive !== 'granted') p = await PushNotifications.requestPermissions();
  if (p.receive !== 'granted') throw Object.assign(new Error('denied'), { denied: true });
  const token = await new Promise((resolve, reject) => {
    let done = false; const hs = [];
    const finish = (fn, v) => { if (done) return; done = true; hs.forEach((h) => h.then((x) => x.remove()).catch(() => {})); fn(v); };
    hs.push(PushNotifications.addListener('registration', (tk) => finish(resolve, tk.value)));
    hs.push(PushNotifications.addListener('registrationError', (e) => finish(reject, new Error(e?.error || 'Could not turn on alerts on this iPhone.'))));
    setTimeout(() => finish(reject, new Error('Could not turn on alerts on this iPhone. Please try again.')), 20000);
    PushNotifications.register();
  });
  if (!/^[0-9a-fA-F]{64,200}$/.test(String(token))) throw new Error('Could not turn on alerts on this iPhone. Please try again.');
  return 'apns:' + String(token).toLowerCase();
}
const PUSH_CACHE = 'ncdrh-push';
export const pushSupported = () => ADAPTER === 'remote' && (nativeOn() || ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window));
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
export const permission = () => (nativeOn() ? 'default' : 'Notification' in window ? Notification.permission : 'unsupported');
const b64ToBytes = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
async function reg() { const r = await navigator.serviceWorker.getRegistration(); if (r) return r; await navigator.serviceWorker.register('/sw.js'); return navigator.serviceWorker.ready; }
const remember = async (endpoint) => { try { const c = await caches.open(PUSH_CACHE); endpoint ? await c.put('/__push-endpoint', new Response(endpoint)) : await c.delete('/__push-endpoint'); } catch {} };
export async function currentSub() { if (!pushSupported()) return null; if (nativeOn()) return nativeSub(); const r = await navigator.serviceWorker.getRegistration(); return r ? r.pushManager.getSubscription() : null; }
// Must be called from a tap (permission prompt).
export async function subscribe(topics, lang) {
  if (nativeOn()) { const endpoint = await nativeToken(); const out = await api.pushSubscribe({ endpoint }, topics, lang); try { localStorage.setItem(NATIVE_KEY, endpoint); } catch {} return out; }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw Object.assign(new Error('denied'), { denied: true });
  const r = await reg(); let sub = await r.pushManager.getSubscription();
  if (!sub) { const { publicKey } = await api.pushKey(); sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) }); }
  const out = await api.pushSubscribe(sub.toJSON(), topics, lang); await remember(sub.endpoint); return out;
}
export async function status() { const sub = await currentSub(); if (!sub) return null; try { return await api.pushStatus(sub.toJSON()); } catch { return null; } }
export async function unsubscribe() {
  const sub = await currentSub(); if (!sub) return;
  if (nativeOn()) { try { await api.pushUnsubscribe(sub.toJSON()); } finally { try { localStorage.removeItem(NATIVE_KEY); } catch {} try { await (await import('@capacitor/push-notifications')).PushNotifications.unregister(); } catch {} } return; }
  try { await api.pushUnsubscribe(sub.toJSON()); } finally { await sub.unsubscribe(); await remember(null); }
}
