// Web Push on this device. Nothing happens until the person taps "Turn on alerts":
// then the browser asks for permission, subscribes, and the server stores only the push address + topics.
import { api, ADAPTER } from './data/index.js';
const PUSH_CACHE = 'ncdrh-push';
export const pushSupported = () => ADAPTER === 'remote' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
export const permission = () => ('Notification' in window ? Notification.permission : 'unsupported');
const b64ToBytes = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
async function reg() { const r = await navigator.serviceWorker.getRegistration(); if (r) return r; await navigator.serviceWorker.register('/sw.js'); return navigator.serviceWorker.ready; }
const remember = async (endpoint) => { try { const c = await caches.open(PUSH_CACHE); endpoint ? await c.put('/__push-endpoint', new Response(endpoint)) : await c.delete('/__push-endpoint'); } catch {} };
export async function currentSub() { if (!pushSupported()) return null; const r = await navigator.serviceWorker.getRegistration(); return r ? r.pushManager.getSubscription() : null; }
// Must be called from a tap (permission prompt).
export async function subscribe(topics, lang) {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw Object.assign(new Error('denied'), { denied: true });
  const r = await reg(); let sub = await r.pushManager.getSubscription();
  if (!sub) { const { publicKey } = await api.pushKey(); sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) }); }
  const out = await api.pushSubscribe(sub.toJSON(), topics, lang); await remember(sub.endpoint); return out;
}
export async function status() { const sub = await currentSub(); if (!sub) return null; try { return await api.pushStatus(sub.toJSON()); } catch { return null; } }
export async function unsubscribe() {
  const sub = await currentSub(); if (!sub) return;
  try { await api.pushUnsubscribe(sub.toJSON()); } finally { await sub.unsubscribe(); await remember(null); }
}
