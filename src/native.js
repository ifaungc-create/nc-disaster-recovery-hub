// iPhone app features (Capacitor). Every function checks that the native plugin is really there, so the
// website and the Android app (a Trusted Web Activity) keep working and simply do not show these buttons.
// Never return a Capacitor plugin object from an async function: the plugin proxy answers to ".then", so the
// promise never finishes. Import the module and use mod.PluginName instead.
const cap = () => (typeof window !== 'undefined' ? window.Capacitor : undefined);
export const isNative = () => { try { return !!cap()?.isNativePlatform?.(); } catch { return false; } };
const has = (name) => { try { return isNative() && !!cap()?.isPluginAvailable?.(name); } catch { return false; } };

export const can = {
  remind: () => has('LocalNotifications'),
  calendar: () => has('CapacitorCalendar'),
  share: () => has('Share'),
  photos: () => has('Camera') && has('Filesystem') && has('Preferences'),
  lock: () => isNative() && !!cap()?.Plugins?.AppLock,
  push: () => has('PushNotifications'),
};

// ---------- reminders on this phone (local notifications) ----------
const idFor = (key) => { let h = 0; for (const ch of String(key)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h) % 2000000000 || 1; };
const atLocal = (ymd, h) => { const [y, m, d] = String(ymd).split('-').map(Number); return new Date(y, m - 1, d, h, 0, 0, 0); };
async function notifs() {
  const mod = await import('@capacitor/local-notifications');
  let p = await mod.LocalNotifications.checkPermissions();
  if (p.display !== 'granted') p = await mod.LocalNotifications.requestPermissions();
  if (p.display !== 'granted') throw Object.assign(new Error('Notifications are off for this app. Turn them on in Settings > Notifications.'), { denied: true });
  return mod;
}
// A follow-up reminder for a case number or referral: 6 PM the evening before and 9 AM on the day.
// Returns the number of reminders set (0 if the date has passed).
// title may be a string or { eve, day } (different wording for the evening before and the day itself).
export async function remindOn(key, ymd, title, body, route) {
  const tEve = typeof title === 'string' ? title : title.eve, tDay = typeof title === 'string' ? title : title.day;
  const LN = (await notifs()).LocalNotifications;
  const now = Date.now(), day = atLocal(ymd, 9), eve = atLocal(ymd, 18); eve.setDate(eve.getDate() - 1);
  const list = [];
  if (eve.getTime() > now) list.push({ id: idFor(key + ':eve'), title: tEve, body, schedule: { at: eve, allowWhileIdle: true }, extra: { route } });
  if (day.getTime() > now) list.push({ id: idFor(key + ':day'), title: tDay, body, schedule: { at: day, allowWhileIdle: true }, extra: { route } });
  if (list.length) await LN.schedule({ notifications: list });
  return list.length;
}
// Removes the reminders for an item (when it is deleted or done).
export async function cancelReminders(key) {
  if (!can.remind()) return;
  try { const { LocalNotifications } = await import('@capacitor/local-notifications'); await LocalNotifications.cancel({ notifications: [{ id: idFor(key + ':eve') }, { id: idFor(key + ':day') }] }); } catch {}
}
// Tapping a reminder or an alert opens the matching screen.
export async function listenForTaps() {
  if (can.remind()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    LocalNotifications.addListener('localNotificationActionPerformed', (a) => { const r = a?.notification?.extra?.route; if (r && /^[a-z0-9/_-]{1,60}$/.test(r)) location.hash = '#' + r; });
  }
  if (can.push()) {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
      const u = a?.notification?.data?.url;
      if (typeof u !== 'string' || !u.trim()) return;
      try { const url = new URL(u, location.origin); if (url.origin === location.origin && url.href !== location.href) location.href = url.href; } catch {}
    });
  }
}

// ---------- add to calendar (all-day event on the follow-up date) ----------
export async function addToCalendar(title, ymd, notes) {
  const { CapacitorCalendar } = await import('@ebarooni/capacitor-calendar');
  const start = atLocal(ymd, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  await CapacitorCalendar.createEventWithPrompt({ title, isAllDay: true, startDate: start.getTime(), endDate: end.getTime(), description: notes || '', alerts: [-60 * 15] });
}

// ---------- share sheet ----------
export async function shareText(title, text) {
  const { Share } = await import('@capacitor/share');
  await Share.share({ title, text, dialogTitle: title });
}

// ---------- photos of damage and documents, kept only on this phone ----------
// Files: Directory.Data/ncdrh-docs/<id>.jpg (inside the app, backed up with the phone's own backup only if the
// person uses iCloud backup). The list (id, label, date, small thumbnail) is kept in Preferences. Nothing is uploaded.
const DOCS_KEY = 'ncdrh.docs';
async function fsmod() { return import('@capacitor/filesystem'); }
async function prefsMod() { return import('@capacitor/preferences'); }
export async function listDocs() {
  if (!can.photos()) return [];
  try { const P = (await prefsMod()).Preferences; return JSON.parse((await P.get({ key: DOCS_KEY })).value || '[]'); } catch { return []; }
}
async function saveList(list) { const P = (await prefsMod()).Preferences; await P.set({ key: DOCS_KEY, value: JSON.stringify(list) }); }
const thumb = (b64) => new Promise((res) => {
  const img = new Image();
  img.onload = () => { const s = 240 / Math.max(img.width, img.height); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.7)); };
  img.onerror = () => res('');
  img.src = 'data:image/jpeg;base64,' + b64;
});
// source: 'camera' or 'photos'. Returns the new item, or null if the person cancels.
export async function addDoc(source, label, kind) {
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  let photo;
  try { photo = await Camera.getPhoto({ quality: 70, width: 2000, resultType: CameraResultType.Base64, source: source === 'photos' ? CameraSource.Photos : CameraSource.Camera, saveToGallery: false, correctOrientation: true }); }
  catch (e) { if (/cancel/i.test(String(e?.message || e))) return null; throw e; }
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const { Filesystem, Directory } = await fsmod();
  const path = `ncdrh-docs/${id}.jpg`;
  await Filesystem.writeFile({ path, data: photo.base64String, directory: Directory.Data, recursive: true });
  const item = { id, path, label: String(label || '').slice(0, 80), kind: kind === 'document' ? 'document' : 'damage', date: new Date().toISOString(), thumb: await thumb(photo.base64String) };
  const list = await listDocs(); list.unshift(item); await saveList(list.slice(0, 300));
  return item;
}
export async function docDataUrl(item) {
  const { Filesystem, Directory } = await fsmod();
  const r = await Filesystem.readFile({ path: item.path, directory: Directory.Data });
  return 'data:image/jpeg;base64,' + r.data;
}
export async function shareDoc(item, title) {
  const { Filesystem, Directory } = await fsmod();
  const { uri } = await Filesystem.getUri({ path: item.path, directory: Directory.Data });
  const { Share } = await import('@capacitor/share');
  await Share.share({ title, files: [uri], dialogTitle: title });
}
export async function removeDoc(id) {
  const list = await listDocs(); const item = list.find((x) => x.id === id); if (!item) return;
  try { const { Filesystem, Directory } = await fsmod(); await Filesystem.deleteFile({ path: item.path, directory: Directory.Data }); } catch {}
  await saveList(list.filter((x) => x.id !== id));
}

// ---------- Face ID lock (native plugin in ios/App/App/AppLock.swift) ----------
const lockPlugin = () => cap()?.Plugins?.AppLock;
export const lockStatus = () => lockPlugin().status();               // { enabled, available, biometry }
export const setLock = (enabled) => lockPlugin().setEnabled({ enabled });
export const biometryName = (b) => ({ faceID: 'Face ID', touchID: 'Touch ID' }[b] || '');
