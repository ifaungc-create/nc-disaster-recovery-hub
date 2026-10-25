// Location helpers. Everything here runs on the device: county lookup uses bundled Census county
// boundaries, ZIP/city lookup uses bundled Census Gazetteer centroids. Nothing is sent to a server.
// The browser location is only requested when the person taps a "Use my location" button.
const cache = {};
export const loadData = (name) => (cache[name] ||= fetch(`/data/${name}.json`).then((r) => { if (!r.ok) throw new Error('Could not load ' + name); return r.json(); }).catch((e) => { delete cache[name]; throw e; }));

const LKEY = 'ncdrh.location';
// Saved on this device only: county + coordinates rounded to ~100 m. Cleared from Settings.
export const getLoc = () => { try { return JSON.parse(localStorage.getItem(LKEY)) || null; } catch { return null; } };
export const setLoc = (l) => localStorage.setItem(LKEY, JSON.stringify({ ...l, la: l.la != null ? Math.round(l.la * 1e3) / 1e3 : null, lo: l.lo != null ? Math.round(l.lo * 1e3) / 1e3 : null, at: new Date().toISOString() }));
export const clearLoc = () => localStorage.removeItem(LKEY);

export function haversineMi(a, b, c, d) {
  const R = 3958.8, t = Math.PI / 180, dLa = (c - a) * t, dLo = (d - b) * t;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// polygons: [[outer, hole, ...], ...]
const inMulti = (x, y, polys) => polys.some((rings) => inRing(x, y, rings[0]) && !rings.slice(1).some((h) => inRing(x, y, h)));
export async function countyAt(la, lo) {
  const b = await loadData('county-boundaries');
  return b.find((c) => inMulti(lo, la, c.p))?.n || null;
}
export function geolocate() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('This device cannot share its location. Enter a ZIP code or city instead.'));
    navigator.geolocation.getCurrentPosition((p) => res({ la: p.coords.latitude, lo: p.coords.longitude }), (e) => rej(new Error(e.code === 1 ? 'Location permission was not given. You can enter a ZIP code or city instead.' : 'Could not get your location. Enter a ZIP code or city instead.')), { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
  });
}
// "28801", "Asheville", "Asheville, NC" -> {la, lo, county, label}
export async function lookupPlace(text) {
  const q = String(text || '').trim();
  const zip = /^(\d{5})(?:-\d{4})?$/.exec(q);
  if (zip) { const z = (await loadData('zips'))[zip[1]]; return z ? { la: z[0], lo: z[1], county: z[2], label: 'ZIP ' + zip[1] } : null; }
  const name = q.replace(/,?\s*(north carolina|nc)\.?$/i, '').trim().toLowerCase(); if (!name) return null;
  const places = await loadData('places');
  const hit = places.find((p) => p[0].toLowerCase() === name) || places.find((p) => p[0].toLowerCase().startsWith(name));
  if (hit) return { la: hit[1], lo: hit[2], county: hit[3], label: hit[0] };
  const counties = await loadData('counties'); const c = counties.find((x) => x.name.toLowerCase() === name.replace(/\s+county$/, ''));
  return c ? { county: c.name, label: c.name + ' County' } : null;
}
// Resolve the device location to a county and remember it on this device.
export async function locateMe() {
  const p = await geolocate(); const county = await countyAt(p.la, p.lo);
  if (!county) throw new Error('Your location does not look like it is in North Carolina. You can pick a county instead.');
  setLoc({ ...p, county, how: 'device' }); return getLoc();
}
