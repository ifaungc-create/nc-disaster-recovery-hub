// Local/mock adapter: all data lives in this browser's localStorage. Nothing is sent anywhere.
// Interface (shared with remote.js; every method is async):
//   createUser({email,password,name,role,org,termsAccepted}) -> user     verifyLogin(email,pw) -> user
//   getUser(id) -> user|null    deleteAccount(id)    exportData(id) -> object
//   list(uid, kind) / create(uid, kind, obj) / update(uid, kind, id, patch) / remove(uid, kind, id)   kind: cases|notes|referrals
//   createShareCard(uid, card) -> {code, card, expiresAt}   listShareCards(uid)   revokeShareCard(uid, code)
//   getShareCard(code) -> {card, code, expiresAt}   claimShareCard(uid, {code}|{card}, consent) -> note
//   listCommunity() -> approved records   submitRecord(rec)   mySubmissions()   admin*(...) (server only)
// Limitation: share codes only resolve on the same device in mock mode (QR codes carry the card itself and work anywhere).
import { SHARE_CARD_DAYS } from '../config.js';
import { KINDS, validateSignup, cleanItem, cleanCard, cardToNote, newCode, normCode, err } from './shared.js';

const KEY = 'ncdrh.db.v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } };
const db = () => load() || { users: [], items: {}, cards: [] };
const save = (d) => localStorage.setItem(KEY, JSON.stringify(d));
const rid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const rand = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function hashPw(pw, salt) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pw))); }
// On-device mode has no admin: responders are treated as approved and nothing can be published.
const pub = (u) => u && { id: u.id, email: u.email, name: u.name, role: u.role, org: u.org, createdAt: u.createdAt, isAdmin: false, responderStatus: u.role === 'responder' ? 'approved' : undefined };
const serverOnly = async () => { throw err('This needs the online version of the app (server storage).', 501); };
const now = () => new Date().toISOString();

export const local = {
  name: 'local',
  async createUser(data) {
    const v = validateSignup(data); const d = db();
    if (d.users.some((u) => u.email === v.email)) throw err('An account with that email already exists on this device. Try signing in.', 409);
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    const u = { id: rid(), ...v, salt, pw: await hashPw(data.password, salt), createdAt: now(), privacyAcceptedAt: now() };
    d.users.push(u); d.items[u.id] = { cases: [], notes: [], referrals: [] }; save(d); return pub(u);
  },
  async verifyLogin(email, pw) {
    const u = db().users.find((x) => x.email === String(email || '').trim().toLowerCase());
    if (!u || (await hashPw(String(pw || ''), u.salt)) !== u.pw) throw err('Email or password is incorrect.', 401);
    return pub(u);
  },
  async getUser(id) { return pub(db().users.find((u) => u.id === id)) || null; },
  async deleteAccount(id) { const d = db(); d.users = d.users.filter((u) => u.id !== id); delete d.items[id]; d.cards = d.cards.filter((c) => c.ownerId !== id); save(d); return { ok: true }; },
  async exportData(id) {
    const d = db(); const u = d.users.find((x) => x.id === id); if (!u) throw err('Not signed in', 401);
    return { exportedAt: now(), account: pub(u), ...d.items[id], shareCardsICreated: d.cards.filter((c) => c.ownerId === id).map(({ ownerId, ...c }) => c) };
  },
  async list(uid, kind) { if (!KINDS.includes(kind)) throw err('Unknown record type.'); return [...(db().items[uid]?.[kind] || [])].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')); },
  async create(uid, kind, obj) {
    const d = db(); const box = d.items[uid]; if (!box) throw err('Not signed in', 401);
    const rec = { id: rid(), ...cleanItem(kind, obj), createdAt: now(), updatedAt: now() }; box[kind].push(rec); save(d); return rec;
  },
  async update(uid, kind, id, patch) {
    const d = db(); const list = d.items[uid]?.[kind]; const i = list ? list.findIndex((r) => r.id === id) : -1; if (i < 0) throw err('Not found', 404);
    list[i] = { ...list[i], ...cleanItem(kind, { ...list[i], ...patch }), updatedAt: now() }; save(d); return list[i];
  },
  async remove(uid, kind, id) { const d = db(); const box = d.items[uid]; if (!box?.[kind]) throw err('Not found', 404); box[kind] = box[kind].filter((r) => r.id !== id); save(d); return { ok: true }; },
  async createShareCard(uid, card) {
    const d = db(); const u = d.users.find((x) => x.id === uid); if (!u || u.role !== 'responder') throw err('Only responder accounts can create share cards.', 403);
    let code; do code = newCode(rand); while (d.cards.some((c) => c.code === code));
    const rec = { code, ownerId: uid, card: cleanCard(card), createdAt: now(), expiresAt: new Date(Date.now() + SHARE_CARD_DAYS * 864e5).toISOString(), revoked: false, saves: 0 };
    d.cards.push(rec); save(d); const { ownerId, ...out } = rec; return out;
  },
  async listShareCards(uid) { return db().cards.filter((c) => c.ownerId === uid).map(({ ownerId, ...c }) => c).reverse(); },
  async revokeShareCard(uid, code) { const d = db(); const c = d.cards.find((x) => x.code === code && x.ownerId === uid); if (!c) throw err('Not found', 404); c.revoked = true; save(d); return { ok: true }; },
  async getShareCard(code) {
    const c = db().cards.find((x) => x.code === normCode(code));
    if (!c || c.revoked || c.expiresAt < now()) throw err('That code was not found, has expired, or was turned off by the responder. Check the code and try again.', 404);
    return { code: c.code, card: c.card, expiresAt: c.expiresAt };
  },
  async claimShareCard(uid, src, consent) {
    if (consent !== true) throw err('Please confirm you want to save this information.');
    let card, code = '';
    if (src?.code) { const r = await this.getShareCard(src.code); card = r.card; code = r.code; const d = db(); const c = d.cards.find((x) => x.code === code); c.saves += 1; save(d); }
    else card = cleanCard(src?.card);
    return this.create(uid, 'notes', cardToNote(card, code));
  },
  async listCommunity() { return []; },
  submitRecord: serverOnly, mySubmissions: async () => [],
  adminListResponders: serverOnly, adminDecideResponder: serverOnly, adminListSubmissions: serverOnly,
  adminDecideSubmission: serverOnly, adminUnpublish: serverOnly, adminAudit: serverOnly,
  pushKey: serverOnly, pushSubscribe: serverOnly, pushStatus: serverOnly, pushUnsubscribe: serverOnly, adminPushCount: serverOnly, adminPushSend: serverOnly, adminPushLog: serverOnly, adminPushTest: serverOnly,
  adminEditPublished: serverOnly, adminFindUser: serverOnly, adminDeleteUser: serverOnly, adminIssueReset: serverOnly, adminIssueClaim: serverOnly,
  adminInvite: serverOnly, adminListAdmins: serverOnly, adminRevokeAdmin: serverOnly, adminNewTempPassword: serverOnly, changePassword: serverOnly,
  resetPassword: serverOnly, requestAdminCode: serverOnly, adminClaimStart: serverOnly, adminClaimFinish: serverOnly,
};
