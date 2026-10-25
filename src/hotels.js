// Hotels and motels. Main search: ON THE DEVICE, against /data/hotels.json (every OpenStreetMap hotel/motel
// in North Carolina, from a dated extract). Your position never leaves the phone for this search.
// Optional live check: /.netlify/functions/overpass with the position rounded to ~1 km (the server snaps
// it to a ~10 km cell before asking OpenStreetMap), to pick up places added after the snapshot.
import { haversineMi, loadData } from './geo.js';
import { HOTEL_RADIUS_M } from './config.js';
const RADIUS_MI = HOTEL_RADIUS_M / 1609.344, WIDER_MI = 25, MIN_RESULTS = 5;
const norm = (h) => ({ id: h.id, name: h.n, kind: h.k, la: h.la, lo: h.lo, phone: h.p || '', website: h.w || '', brandSite: h.bw || '', email: h.e || '', addr: h.a || '', town: h.t || '', county: h.c || '' });
export async function hotelData() { const d = await loadData('hotels'); return { date: (d.osmTimestamp || '').slice(0, 10), list: d.hotels.map(norm) }; }
// Nearest first within ~10 miles; widens to 25 miles when fewer than 5 are found (rural areas).
export async function findHotels(la, lo) {
  const { list, date } = await hotelData();
  const all = list.map((h) => ({ ...h, mi: haversineMi(la, lo, h.la, h.lo) })).sort((a, b) => a.mi - b.mi);
  let radiusMi = RADIUS_MI, rows = all.filter((h) => h.mi <= radiusMi);
  if (rows.length < MIN_RESULTS) { radiusMi = WIDER_MI; rows = all.filter((h) => h.mi <= radiusMi); }
  return { rows, radiusMi, date };
}
export async function findHotelsLive(la, lo, radiusMi = RADIUS_MI) {
  const r = await fetch('/.netlify/functions/overpass', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lat: Math.round(la * 100) / 100, lon: Math.round(lo * 100) / 100, radius: Math.round(radiusMi * 1609.344) }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'The live map check is not available right now.');
  return (j.results || []).map((h) => ({ ...h, mi: haversineMi(la, lo, h.la, h.lo) }));
}
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = () => /Android/i.test(navigator.userAgent);
// Directions open in the person's own maps app; only the destination is in the link.
export function directionsUrl(la, lo, name = '') {
  if (isIOS()) return `https://maps.apple.com/?daddr=${la},${lo}&q=${encodeURIComponent(name)}`;
  if (isAndroid()) return `geo:${la},${lo}?q=${la},${lo}(${encodeURIComponent(name)})`;
  return `https://www.openstreetmap.org/directions?to=${la}%2C${lo}`;
}

// Map listing links. Plain links, opened only when the person taps them; the app sends nothing to Google or
// Apple itself. The place's live listing there shows its current phone, website, hours and reviews.
// name + street address + city; with no city in the data, the nearest town (h.town, from the build) or the county.
const placeQuery = (h) => { const a = h.addr || ''; return [h.name, a, /\bNC\b/.test(a) ? '' : (h.town ? h.town + ', NC' : h.county ? h.county + ' County, NC' : 'NC')].filter(Boolean).join(', '); };
const r2 = (x) => (Math.round(x * 100) / 100).toFixed(2); // about 1 km
export const googlePlaceUrl = (h) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeQuery(h))}`;
// q runs a real Apple Maps search (so the business listing opens), sll tells it where to search.
export const applePlaceUrl = (h) => `https://maps.apple.com/?q=${encodeURIComponent(placeQuery(h))}&sll=${h.la},${h.lo}`;
// Area search: "hotels" near the typed ZIP/town, or near the device position rounded to about 1 km.
export function areaSearchUrls(p, label) {
  const near = label && label !== 'your location' ? label.replace(/^ZIP /, '') + ', NC' : `${r2(p.la)},${r2(p.lo)}`;
  return { google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('hotels near ' + near)}`, apple: `https://maps.apple.com/?q=hotels&sll=${r2(p.la)},${r2(p.lo)}` };
}
