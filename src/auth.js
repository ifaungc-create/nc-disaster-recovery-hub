// Session handling. Default: the session ends when the browser tab/app is closed (sessionStorage).
// "Keep me signed in on this device" moves it to localStorage. No cookies are set.
import { api } from './data/index.js';
const SKEY = 'ncdrh.session', TKEY = 'ncdrh.token';
const stores = () => [sessionStorage, localStorage];
const read = (k) => sessionStorage.getItem(k) || localStorage.getItem(k);
let remember = !!localStorage.getItem(SKEY);
const write = (k, v) => { stores().forEach((s) => s.removeItem(k)); (remember ? localStorage : sessionStorage).setItem(k, v); };
export const tokenStore = { get: () => read(TKEY), set: (t) => write(TKEY, t) };
export const auth = {
  async signUp(data, keep = false) { remember = keep; const u = await api.createUser(data); write(SKEY, u.id); return u; },
  async logIn(email, pw, keep = false) { remember = keep; const u = await api.verifyLogin(email, pw); write(SKEY, u.id); return u; },
  logOut() { stores().forEach((s) => { s.removeItem(SKEY); s.removeItem(TKEY); }); },
  async currentUser() { const id = read(SKEY); if (!id) return null; try { return (await api.getUser(id)) || (this.logOut(), null); } catch { this.logOut(); return null; } },
};
