// Fixed-window rate limits per hashed client IP, stored in Blobs. Keys carry the window number, so the
// hourly cleanup function can delete old windows without reading them. Raw IPs are never stored or logged.
import { store } from './store.js';
import { ipHash } from './crypto.js';
import { err } from '../../../src/data/shared.js';
export const LIMITS = {
  login: { max: 10, windowS: 900 },      // 10 sign-in attempts / 15 min
  register: { max: 5, windowS: 3600 },   // 5 new accounts / hour
  code: { max: 30, windowS: 900 },       // 30 share-code lookups or saves / 15 min
  hotels: { max: 30, windowS: 900 },     // 30 hotel searches / 15 min
  push: { max: 30, windowS: 900 },       // 30 alert sign-ups/changes / 15 min
  reset: { max: 10, windowS: 3600 },     // 10 password-reset or recovery-code tries / hour
};
export const clientIp = (req, context) => context?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown';
export async function limit(group, req, context) {
  const { max, windowS } = LIMITS[group]; const bucket = Math.floor(Date.now() / 1000 / windowS);
  const key = `rl/${group}/${bucket}/${ipHash(clientIp(req, context))}`; const s = store();
  for (let i = 0; i < 4; i++) {
    const cur = await s.getWithMetadata(key, { type: 'json' });
    const n = (cur?.data?.n || 0) + 1;
    if (n > max) throw Object.assign(err('Too many attempts. Please wait a few minutes and try again.', 429), { retryAfter: (bucket + 1) * windowS - Math.floor(Date.now() / 1000) });
    const res = await s.setJSON(key, { n }, cur ? { onlyIfMatch: cur.etag } : { onlyIfNew: true });
    if (res.modified) return;
  }
  // Under heavy contention fail open for this one request rather than lock people out.
}
export const windowOf = (key) => { const [, group, bucket] = key.split('/'); const l = LIMITS[group]; return l ? (Number(bucket) + 1) * l.windowS * 1000 : 0; };
