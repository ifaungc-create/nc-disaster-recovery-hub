// Property owner lookup ("Check a listing before you pay"). Asks NC OneMap, the State of North Carolina's
// statewide parcel service (county tax parcel records for all 100 counties), who the county lists as the
// owner of an address. This is the ONE place the app contacts a server that is not its own: the street
// address and county the person typed go straight from their device to the state's server. Nothing goes
// through our server, nothing is saved, no cookies are kept (credentials: 'omit'). netlify.toml allows
// this one host in connect-src. Service checked 2026-11-22.
export const PARCEL_HOST = 'https://services.nconemap.gov';
export const PARCEL_URL = PARCEL_HOST + '/secure/rest/services/NC1Map_Parcels/FeatureServer/1/query';
export const PARCEL_INFO_URL = 'https://www.nconemap.gov/pages/parcels';
const FIELDS = 'ownname,ownname2,siteadd,sunit,scity,cntyname,mcity,mstate,transfdate';
// Street-type words: the county record may abbreviate them differently ("ST" vs "STREET"), so the search
// stops before the first one and matches on the house number and street name only.
const TYPES = new Set('ST STREET RD ROAD AVE AV AVENUE DR DRIVE LN LANE CT COURT BLVD BOULEVARD WAY PL PLACE CIR CIRCLE HWY HIGHWAY PKWY PARKWAY TRL TRAIL TER TERRACE LOOP RUN XING CROSSING APT UNIT STE SUITE LOT'.split(' '));

// "112 Broadway St., Durham" -> "112 BROADWAY". Returns '' when there is no house number and street name.
export function addressKey(input) {
  const words = String(input || '').toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (words.length < 2 || !/^\d{1,6}[A-Z]?$/.test(words[0])) return '';
  const out = [words[0]];
  for (const w of words.slice(1)) {
    if (out.length > 1 && TYPES.has(w)) break; // keep a first word like "COURT" in "5 COURT ST"
    if (out.length >= 5) break;
    out.push(w);
  }
  return out.length >= 2 ? out.join(' ') : '';
}

// Builds the request. The key holds only A-Z, 0-9 and spaces (see addressKey), and the county comes from
// the app's own list, so nothing typed can change the query.
export function parcelQuery(key, county) {
  if (!/^[A-Z0-9 ]+$/.test(key) || !/^[A-Za-z ]+$/.test(county)) throw new Error('bad query');
  const p = new URLSearchParams({ where: `cntyname='${county}' AND UPPER(siteadd) LIKE '${key}%'`, outFields: FIELDS, returnGeometry: 'false', resultRecordCount: '6', f: 'json' });
  return PARCEL_URL + '?' + p;
}

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
// State response -> plain rows. Owner names are shown exactly as the county wrote them.
export function parseParcels(json) {
  if (!json || json.error || !Array.isArray(json.features)) throw new Error('bad response');
  return json.features.map((f) => f.attributes || {}).filter((a) => clean(a.ownname) && clean(a.siteadd)).map((a) => ({
    owner: clean(a.ownname), owner2: clean(a.ownname2), address: [clean(a.siteadd), clean(a.sunit)].filter(Boolean).join(' #'), city: clean(a.scity), county: clean(a.cntyname),
    mailTo: [clean(a.mcity), clean(a.mstate)].filter(Boolean).join(', '), asOf: typeof a.transfdate === 'number' ? new Date(a.transfdate).toISOString().slice(0, 10) : '',
  }));
}

export async function lookupOwner(address, county, { fetchFn = fetch, timeoutMs = 25000 } = {}) {
  const key = addressKey(address);
  if (!key) { const e = new Error('address'); e.code = 'address'; throw e; }
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetchFn(parcelQuery(key, county), { credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctl.signal });
    if (!r.ok) throw new Error('http ' + r.status);
    return { key, rows: parseParcels(await r.json()) };
  } finally { clearTimeout(timer); }
}

// Zillow rentals for a county (an outside business website, opened in the person's browser; nothing is sent by the app).
export const airbnbStaysUrl = (county) => (county ? `https://www.airbnb.com/s/${county.replace(/[^A-Za-z]+/g, '-')}-County--NC/homes` : 'https://www.airbnb.com/s/North-Carolina/homes');
export const zillowRentalsUrl = (county) => (county ? `https://www.zillow.com/${county.toLowerCase().replace(/[^a-z]+/g, '-')}-county-nc/rentals/` : 'https://www.zillow.com/nc/rentals/');
