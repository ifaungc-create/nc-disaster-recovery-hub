// Owner lookup helpers (src/owner.js) and the Red Cross call check (src/rcnotice.js). No network.
import assert from 'node:assert/strict';
import { addressKey, parcelQuery, parseParcels, lookupOwner, zillowRentalsUrl, PARCEL_URL } from '../src/owner.js';

let n = 0; const ok = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
await ok('addressKey keeps the house number and street name only', () => {
  assert.equal(addressKey('112 Broadway St., Durham'), '112 BROADWAY');
  assert.equal(addressKey('  100 e. broad street apt 4 '), '100 E BROAD');
  assert.equal(addressKey('5 Court St'), '5 COURT');
  assert.equal(addressKey('1304B Old NC 98 Hwy'), '1304B OLD NC 98');
  assert.equal(addressKey('Main Street'), '');
  assert.equal(addressKey('123'), '');
  assert.equal(addressKey(''), '');
});
await ok('typed text cannot change the query', () => {
  const k = addressKey("12 O'Hara'; DROP TABLE x -- Rd");
  assert.match(k, /^[A-Z0-9 ]+$/);
  const u = new URL(parcelQuery(k, 'New Hanover'));
  assert.equal(u.origin + u.pathname, PARCEL_URL);
  assert.equal(u.searchParams.get('where'), `cntyname='New Hanover' AND UPPER(siteadd) LIKE '${k}%'`);
  assert.equal(u.searchParams.get('returnGeometry'), 'false');
  assert.throws(() => parcelQuery("1 A' OR 1=1", 'Wake'));
  assert.throws(() => parcelQuery('1 MAIN', "Wake' OR '1'='1"));
});
const SAMPLE = { features: [{ attributes: { ownname: 'FIVE POINTS LOFTS LLC', ownname2: '', siteadd: '112 BROADWAY ST', sunit: '', scity: 'DURHAM', cntyname: 'Durham', mcity: 'BEND', mstate: 'OR', transfdate: 1778648400000 } }, { attributes: { ownname: '', siteadd: '1 X ST' } }] };
await ok('parseParcels gives owner, address, mailing city and record date; skips empty rows', () => {
  const rows = parseParcels(SAMPLE);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], { owner: 'FIVE POINTS LOFTS LLC', owner2: '', address: '112 BROADWAY ST', city: 'DURHAM', county: 'Durham', mailTo: 'BEND, OR', asOf: '2026-05-13' });
  assert.throws(() => parseParcels({ error: { code: 400 } }));
  assert.throws(() => parseParcels(null));
});
await ok('lookupOwner sends no cookies or referrer and reports failures', async () => {
  let seen = null;
  const r = await lookupOwner('112 Broadway St', 'Durham', { fetchFn: async (url, opt) => { seen = { url, opt }; return { ok: true, json: async () => SAMPLE }; } });
  assert.equal(r.rows[0].owner, 'FIVE POINTS LOFTS LLC');
  assert.equal(seen.opt.credentials, 'omit'); assert.equal(seen.opt.referrerPolicy, 'no-referrer');
  await assert.rejects(lookupOwner('Broadway', 'Durham', { fetchFn: async () => ({ ok: true, json: async () => SAMPLE }) }), (e) => e.code === 'address');
  await assert.rejects(lookupOwner('1 Main St', 'Wake', { fetchFn: async () => ({ ok: false, status: 500 }) }));
});
await ok('Zillow rental link by county', () => {
  assert.equal(zillowRentalsUrl('Durham'), 'https://www.zillow.com/durham-county-nc/rentals/');
  assert.equal(zillowRentalsUrl('New Hanover'), 'https://www.zillow.com/new-hanover-county-nc/rentals/');
  assert.equal(zillowRentalsUrl(''), 'https://www.zillow.com/nc/rentals/');
});
console.log(`owner: ${n} checks passed`);
