// Rides: the "Ride with Uber" link on listings, and whether ride requests to C4I are open.
// The Uber link is an ordinary link to Uber's own page/app (Uber "universal link"). The app sends Uber
// nothing: the person's phone opens Uber with the place filled in, and the person books and pays in Uber.
// No Uber code, key or tracking is in this app.
import { api, ADAPTER } from './data/index.js';

const enc = encodeURIComponent;
export function uberUrl({ la, lo, name = '', addr = '' } = {}) {
  let u = 'https://m.uber.com/ul/?action=setPickup&pickup=my_location';
  if (la != null && lo != null && Number.isFinite(+la) && Number.isFinite(+lo)) u += `&dropoff[latitude]=${(+la).toFixed(5)}&dropoff[longitude]=${(+lo).toFixed(5)}`;
  if (name) u += `&dropoff[nickname]=${enc(String(name).slice(0, 80))}`;
  if (addr) u += `&dropoff[formatted_address]=${enc(String(addr).slice(0, 200))}`;
  return u;
}

// Ride requests to C4I are off until an administrator turns them on. Cached for 5 minutes.
let cache = null;
export async function ridesOpen(force = false) {
  if (ADAPTER !== 'remote') return false;
  if (!force && cache && Date.now() - cache.at < 3e5) return cache.on;
  try { const r = await api.rideConfig(); cache = { on: r?.enabled === true, at: Date.now() }; } catch { cache = { on: false, at: Date.now() - 24e4 }; }
  return cache.on;
}
export const clearRideCache = () => { cache = null; };
