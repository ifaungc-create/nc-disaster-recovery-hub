// Netlify Function: OPTIONAL live check of OpenStreetMap hotels/motels via public Overpass mirrors.
// The app's main hotel search runs on the device against /data/hotels.json; this is only used when a
// person taps "Check live map data", to pick up places added since the snapshot.
// Privacy: the position is snapped to a 0.1° grid cell (about 10 km) here, the query is built here (no
// arbitrary queries), results are cached per cell in Blobs for a day, and the response is no-store.
// Logs contain only the mirror host, HTTP status, timing and cache hit/miss, never coordinates.
// overpass-api.de is NOT used: its usage policy asks apps hosted on netlify.app not to use it.
import { limit } from './lib/ratelimit.js';
import { ConfigError } from './lib/env.js';
import { store } from './lib/store.js';

export const MIRRORS = (process.env.OVERPASS_URL ? process.env.OVERPASS_URL.split(',') : [
  'https://overpass.private.coffee/api/interpreter', // Private.coffee (formerly overpass.kumi.systems), no rate limit
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter', // VK Maps, no stated limits
]).map((s) => s.trim()).filter(Boolean);
export const UA = 'NC-Disaster-Recovery-Hub/1.0 (+https://disaster-resources.app; disaster recovery info for North Carolina)';
const PER_MIRROR_MS = 4500, BUDGET_MS = 9000, CELL = 0.1, CACHE_MS = 864e5;
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const r2 = (n) => Math.round(n * 100) / 100;
export const cellOf = (lat, lon) => ({ la: Math.round((Math.floor(lat / CELL) + 0.5) * CELL * 100) / 100, lo: Math.round((Math.floor(lon / CELL) + 0.5) * CELL * 100) / 100 });
// Query the whole cell plus the search radius: cell half-diagonal is about 7.5 km.
export const buildQuery = (lat, lon, radius) => `[out:json][timeout:8];nwr["tourism"~"^(hotel|motel)$"](around:${radius},${lat},${lon});out center tags 200;`;
const host = (u) => { try { return new URL(u).host; } catch { return 'mirror'; } };
const log = (o) => console.log('[overpass]', Object.entries(o).map(([k, v]) => `${k}=${v}`).join(' '));
export function parse(osm) {
  return (osm?.elements || []).map((e) => {
    const t = e.tags || {}; const la = e.lat ?? e.center?.lat; const lo = e.lon ?? e.center?.lon;
    const addr = [[t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' '), t['addr:city'], t['addr:postcode']].filter(Boolean).join(', ');
    return { id: `${e.type}/${e.id}`, name: t.name || t.brand || '', kind: t.tourism, la, lo, phone: t.phone || t['contact:phone'] || '', website: t.website || t['contact:website'] || '', addr };
  }).filter((h) => h.name && Number.isFinite(h.la) && Number.isFinite(h.lo));
}
const distM = (a, b, c, d) => { const R = 6371e3, x = ((c - a) * Math.PI) / 180, y = ((d - b) * Math.PI) / 180; const s = Math.sin(x / 2) ** 2 + Math.cos((a * Math.PI) / 180) * Math.cos((c * Math.PI) / 180) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); };

async function fromMirrors(query) {
  const start = Date.now();
  for (const url of MIRRORS) {
    const left = BUDGET_MS - (Date.now() - start); if (left < 1000) break;
    const t0 = Date.now();
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': UA, accept: 'application/json' }, body: 'data=' + encodeURIComponent(query), signal: AbortSignal.timeout(Math.min(PER_MIRROR_MS, left)) });
      log({ mirror: host(url), status: r.status, ms: Date.now() - t0 });
      if (!r.ok) continue;
      const data = await r.json(); if (data?.remark && /runtime error|timed out/i.test(data.remark)) { log({ mirror: host(url), remark: 'runtime-error' }); continue; }
      return { results: parse(data), mirror: host(url) };
    } catch (e) { log({ mirror: host(url), status: e?.name === 'TimeoutError' ? 'timeout' : 'error', ms: Date.now() - t0 }); }
  }
  return null;
}

export default async (req, context) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  try { await limit('hotels', req, context); } catch (e) { if (e instanceof ConfigError) return json(503, { error: 'The service is not configured yet.' }); if (e.code === 429) return json(429, { error: e.message }); return json(503, { error: 'Hotel search is not available right now.' }); }
  let b; try { b = await req.json(); } catch { return json(400, { error: 'Bad request' }); }
  const lat = Number(b.lat), lon = Number(b.lon), radius = Math.min(Math.max(Number(b.radius) || 16000, 1000), 40000);
  // Roughly North Carolina plus a margin, so neighbors near the state line still work.
  if (!(lat > 33 && lat < 37.5 && lon > -85.5 && lon < -74.5)) return json(400, { error: 'Location is outside the North Carolina area.' });
  const cell = cellOf(lat, lon), qr = Math.round(radius + 8000), key = `hotelcache/${cell.la}_${cell.lo}_${qr}`;
  const s = store(); let got = null, cached = false;
  try { const c = await s.getWithMetadata(key, { type: 'json' }); if (c && Date.parse(c.metadata?.exp || '') > Date.now()) { got = c.data; cached = true; } } catch {}
  if (!got) {
    got = await fromMirrors(buildQuery(cell.la, cell.lo, qr));
    if (got) { try { await s.setJSON(key, got, { metadata: { exp: new Date(Date.now() + CACHE_MS).toISOString() } }); } catch {} }
  }
  log({ cache: cached ? 'hit' : got ? 'miss' : 'miss-failed' });
  if (!got) return json(504, { error: 'The live map service did not answer. The offline list above still works.' });
  const p = { la: r2(lat), lo: r2(lon) };
  return json(200, { results: got.results.filter((h) => distM(p.la, p.lo, h.la, h.lo) <= radius), source: 'OpenStreetMap contributors (ODbL), via Overpass API', mirror: got.mirror, cached });
};
