// Scheduled function (hourly on Netlify): deletes expired rate-limit windows, share cards that
// expired more than 7 days ago, hotel search cache cells older than a day, and expired one-time codes. Reads only keys and metadata, never decrypts anything.
import { store } from './lib/store.js';
import { windowOf } from './lib/ratelimit.js';
export async function cleanup(nowMs = Date.now()) {
  const s = store(); let removed = 0;
  for await (const page of s.list({ prefix: 'rl/', paginate: true })) for (const b of page.blobs) if (windowOf(b.key) < nowMs) { await s.delete(b.key); removed++; }
  for await (const page of s.list({ prefix: 'card/', paginate: true })) for (const b of page.blobs) {
    const m = await s.getMetadata(b.key); const exp = Date.parse(m?.metadata?.exp || '');
    if (exp && exp + 7 * 864e5 < nowMs) { await s.delete(b.key); removed++; }
  }
  for await (const page of s.list({ prefix: 'code/', paginate: true })) for (const b of page.blobs) {
    const m = await s.getMetadata(b.key); const exp = Date.parse(m?.metadata?.exp || '');
    if (!exp || exp < nowMs) { await s.delete(b.key); removed++; }
  }
  for await (const page of s.list({ prefix: 'hotelcache/', paginate: true })) for (const b of page.blobs) {
    const m = await s.getMetadata(b.key); const exp = Date.parse(m?.metadata?.exp || '');
    if (!exp || exp < nowMs) { await s.delete(b.key); removed++; }
  }
  return removed;
}
export default async () => { const n = await cleanup(); return new Response(JSON.stringify({ removed: n }), { headers: { 'content-type': 'application/json' } }); };
export const config = { schedule: '@hourly' };
