// Remote adapter: same interface as local.js, backed by netlify/functions/api.js.
// The session token is a short-lived HMAC token returned at login; it is kept in sessionStorage
// (or localStorage if the person chose "keep me signed in"). No cookies are used.
import { tokenStore } from '../auth.js';
async function rpc(action, ...args) {
  const r = await fetch('/.netlify/functions/api', { method: 'POST', headers: { 'content-type': 'application/json', ...(tokenStore.get() ? { authorization: 'Bearer ' + tokenStore.get() } : {}) }, body: JSON.stringify({ action, args }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || 'Something went wrong. Please try again.'), { code: r.status });
  return j.result;
}
const withToken = (u) => { if (u?.token) { tokenStore.set(u.token); delete u.token; } return u; };
export const remote = {
  name: 'remote',
  createUser: async (d) => withToken(await rpc('createUser', d)),
  verifyLogin: async (e, p) => withToken(await rpc('verifyLogin', e, p)),
  getUser: (id) => rpc('getUser', id),
  deleteAccount: () => rpc('deleteAccount'),
  exportData: () => rpc('exportData'),
  list: (_u, kind) => rpc('list', kind),
  create: (_u, kind, o) => rpc('create', kind, o),
  update: (_u, kind, id, p) => rpc('update', kind, id, p),
  remove: (_u, kind, id) => rpc('remove', kind, id),
  createShareCard: (_u, c) => rpc('createShareCard', c),
  listShareCards: () => rpc('listShareCards'),
  revokeShareCard: (_u, code) => rpc('revokeShareCard', code),
  getShareCard: (code) => rpc('getShareCard', code),
  claimShareCard: (_u, src, consent) => rpc('claimShareCard', src, consent),
  // Community records (public, admin-approved) and responder submissions
  listCommunity: () => rpc('listCommunity'),
  submitRecord: (r) => rpc('submitRecord', r),
  mySubmissions: () => rpc('mySubmissions'),
  // Admin area (server checks ADMIN_EMAILS on every call)
  adminListResponders: () => rpc('adminListResponders'),
  adminDecideResponder: (uid, decision, reason) => rpc('adminDecideResponder', uid, decision, reason || ''),
  adminListSubmissions: (status) => rpc('adminListSubmissions', status),
  adminDecideSubmission: (owner, id, decision, edits, reason) => rpc('adminDecideSubmission', owner, id, decision, edits || null, reason || ''),
  adminUnpublish: (id, reason) => rpc('adminUnpublish', id, reason || ''),
  adminAudit: () => rpc('adminAudit'),
  // Push alerts (per device)
  pushKey: () => rpc('pushKey'),
  pushSubscribe: (sub, topics, lang) => rpc('pushSubscribe', sub, topics, lang),
  pushStatus: (sub) => rpc('pushStatus', sub),
  pushUnsubscribe: (sub) => rpc('pushUnsubscribe', sub),
  adminPushCount: (target) => rpc('adminPushCount', target),
  adminPushSend: (msg, confirmed) => rpc('adminPushSend', msg, confirmed),
  adminPushLog: () => rpc('adminPushLog'),
};
