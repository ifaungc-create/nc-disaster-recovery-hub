#!/usr/bin/env python3
"""Build public/data/hotels.json: every tourism=hotel|motel in North Carolina from an OSM extract.

Usage: python3 scripts/build_hotels.py north-carolina.osm.pbf north-carolina.state.txt
Needs pyosmium + shapely (pip install osmium shapely). Data: (c) OpenStreetMap contributors, ODbL.
Source used: https://download.openstreetmap.fr/extracts/north-america/us-south/north-carolina.osm.pbf
Each record: id, n(ame), k(ind), la, lo (5 decimals, the building's own position), p(hones, '; '-separated, from phone,
contact:phone, contact:mobile, mobile), w(ebsite, https only, from website, contact:website, url), bw (brand or operator
site from brand:website / operator:website, or the brand's site found elsewhere in the extract by brand:wikidata),
e(mail), a(ddress from addr:*), f=1 when the address has number, street, city and ZIP, c(ounty). The app searches this list by distance ON THE DEVICE; no location leaves the phone.
"""
import json, re, sys, os
import osmium
from shapely.geometry import shape, Point
from shapely.strtree import STRtree

pbf, state = sys.argv[1], sys.argv[2]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ts = re.search(r'timestamp=(\S+)', open(state).read()).group(1).replace('\\', '')
counties = json.load(open(os.path.join(ROOT, 'public/data/county-boundaries.json')))
polys = [shape({'type': 'MultiPolygon', 'coordinates': c['p']}) for c in counties]
tree = STRtree(polys)
def county_of(lo, la):
    pt = Point(lo, la)
    for i in tree.query(pt):
        if polys[i].contains(pt): return counties[i]['n']
    return None

KINDS = ('hotel', 'motel')
# Every OSM tag that can carry a phone or website for the place itself, in order of preference.
PHONE_TAGS = ('phone', 'contact:phone', 'contact:mobile', 'mobile', 'phone:mobile')
WEB_TAGS = ('website', 'contact:website', 'url')
BRAND_WEB_TAGS = ('brand:website', 'operator:website')  # the chain's or operator's site, not this property's page
EMAIL = re.compile(r'^[^@\s;,]+@[^@\s;,]+\.[a-z]{2,}$', re.I)
is_https = lambda u: u.lower().startswith('https://') and len(u) > 12 and ' ' not in u
def uniq(xs):
    seen, out_ = set(), []
    for x in xs:
        k = re.sub(r'\D', '', x)[-10:]
        if k and k not in seen: seen.add(k); out_.append(x.strip())
    return out_
stats = {'httpOnlyWebsite': 0}
brand_site = {}  # brand:wikidata -> brand:website seen anywhere in the extract
def note_brand(tags):
    q, w = tags.get('brand:wikidata'), tags.get('brand:website', '')
    if q and is_https(w): brand_site.setdefault(q, {}).setdefault(w, 0); brand_site[q][w] += 1
out, skipped = {}, {'unnamed': 0, 'outside': 0, 'nogeom': 0}
def rec(kind_id, tags, la, lo):
    if la is None: skipped['nogeom'] += 1; return
    name = tags.get('name') or tags.get('brand')
    if not name: skipped['unnamed'] += 1; return
    c = county_of(lo, la)
    if not c: skipped['outside'] += 1; return
    phones = uniq(x for k in PHONE_TAGS for x in re.split(r'\s*;\s*', tags.get(k, '')) if x)
    webs = [w for w in (tags.get(k, '').split(';')[0].strip() for k in WEB_TAGS) if w]
    stats['httpOnlyWebsite'] += bool(webs) and not any(is_https(w) for w in webs)
    web = next((w for w in webs if is_https(w)), '')
    bweb = next((w for w in (tags.get(k, '').strip() for k in BRAND_WEB_TAGS) if is_https(w)), '') if not web else ''
    email = next((e for e in (tags.get(k, '').split(';')[0].strip() for k in ('email', 'contact:email')) if EMAIL.match(e)), '')
    city = tags.get('addr:city') or tags.get('addr:place') or ''
    street = ' '.join(x for x in [tags.get('addr:housenumber'), tags.get('addr:street')] if x)
    if tags.get('addr:unit') and street: street += ' ' + ('' if tags['addr:unit'].lower().startswith(('suite', 'ste', 'unit', '#')) else 'Unit ') + tags['addr:unit']
    st = (tags.get('addr:state') or 'NC').upper()
    zipc = (tags.get('addr:postcode') or '')[:5] if re.match(r'^\d{5}', tags.get('addr:postcode') or '') else ''
    addr = ', '.join(x for x in [street, city, (st + ' ' + zipc).strip() if (zipc or city) else ''] if x)
    if not street and tags.get('addr:full'): addr = tags['addr:full'].strip()
    r = {'id': kind_id, 'n': name[:120], 'k': tags.get('tourism'), 'la': round(la, 5), 'lo': round(lo, 5), 'c': c}
    if phones: r['p'] = '; '.join(phones)[:80]
    if web: r['w'] = web[:300]
    if email: r['e'] = email[:120]
    if addr: r['a'] = addr[:200]
    if tags.get('addr:housenumber') and tags.get('addr:street') and city and zipc: r['f'] = 1  # full street address
    if tags.get('brand:wikidata'): r['q'] = tags['brand:wikidata']
    if bweb: r['bw'] = bweb[:300]
    out[kind_id] = r

class H(osmium.SimpleHandler):
    def node(self, n):
        if 'brand:website' in n.tags: note_brand(dict(n.tags))
        if n.tags.get('tourism') in KINDS: rec(f'node/{n.id}', dict(n.tags), n.location.lat, n.location.lon)
    def way(self, w):
        if 'brand:website' in w.tags: note_brand(dict(w.tags))
        if w.tags.get('tourism') in KINDS:
            pts = [(nd.lat, nd.lon) for nd in w.nodes if nd.location.valid()]
            if pts: rec(f'way/{w.id}', dict(w.tags), sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
            else: rec(f'way/{w.id}', dict(w.tags), None, None)
    def relation(self, r):
        if r.tags.get('tourism') in KINDS: rels.append((r.id, dict(r.tags), [m.ref for m in r.members if m.type == 'w']))
rels = []
H().apply_file(pbf, locations=True)
# Relations (multipolygon buildings): use the average of member way centers.
if rels:
    want = {w for _, _, ws in rels for w in ws}; centers = {}
    class W(osmium.SimpleHandler):
        def way(self, w):
            if w.id in want:
                pts = [(nd.lat, nd.lon) for nd in w.nodes if nd.location.valid()]
                if pts: centers[w.id] = (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
    W().apply_file(pbf, locations=True)
    for rid, tags, ws in rels:
        cs = [centers[w] for w in ws if w in centers]
        rec(f'relation/{rid}', tags, *( (sum(c[0] for c in cs) / len(cs), sum(c[1] for c in cs) / len(cs)) if cs else (None, None)))
# Chains: a property with brand:wikidata but no website of its own gets the brand's official site when some
# object in this extract tags that same brand:wikidata with a brand:website (most common value). Never guessed.
# If the extract has no brand:website for a brand, use the site that at least 3 properties of that same brand
# (same brand:wikidata) link to, reduced to its https origin (e.g. three Hampton Inns linking to pages on
# https://www.hilton.com give https://www.hilton.com/). Taken from the extract; never guessed.
from collections import Counter
from urllib.parse import urlsplit
origins = {}
for r in out.values():
    if r.get('q') and r.get('w'): u = urlsplit(r['w']); origins.setdefault(r['q'], Counter())[f'https://{u.hostname}/'] += 1
for q, cnt in origins.items():
    if q not in brand_site:
        o, n = cnt.most_common(1)[0]
        if n >= 3 and n >= 0.6 * sum(cnt.values()): brand_site[q] = {o: n}
stats['brandsWithSite'] = len(brand_site); stats['propertiesWithBrandTag'] = sum(1 for r in out.values() if r.get('q'))
for r in out.values():
    q = r.pop('q', None)
    if 'w' not in r and 'bw' not in r and q in brand_site:
        r['bw'] = max(brand_site[q].items(), key=lambda kv: kv[1])[0]; stats['brandSiteFromExtract'] = stats.get('brandSiteFromExtract', 0) + 1
# For places with no city in their address, note the nearest Census place (within ~15 km) as 't' (town).
# It is used only to make the Google/Apple Maps search link specific ("Kimpton, Asheville, NC"); it is never shown as an address.
import math
places = json.load(open(os.path.join(ROOT, 'public/data/places.json')))
def nearest_town(la, lo):
    best, bd = None, 1e9
    for pl in places:
        d = math.hypot((pl[1] - la) * 111, (pl[2] - lo) * 111 * math.cos(math.radians(la)))
        if d < bd: best, bd = pl[0], d
    return best if bd <= 15 else None
for r in out.values():
    if not re.search(r', [^,]+, NC', r.get('a', '')):
        t = nearest_town(r['la'], r['lo'])
        if t: r['t'] = t; stats['nearTownForMapLinks'] = stats.get('nearTownForMapLinks', 0) + 1
rows = sorted(out.values(), key=lambda r: (r['c'], r['n']))
doc = {'source': 'OpenStreetMap contributors (ODbL), extract from download.openstreetmap.fr', 'osmTimestamp': ts, 'count': len(rows), 'hotels': rows}
json.dump(doc, open(os.path.join(ROOT, 'public/data/hotels.json'), 'w'), separators=(',', ':'), ensure_ascii=False)
print(json.dumps({'count': len(rows), 'motels': sum(r['k'] == 'motel' for r in rows), 'withPhone': sum('p' in r for r in rows), 'withWebsite': sum('w' in r for r in rows), 'withBrandSiteOnly': sum('bw' in r for r in rows), 'withAnyWebsite': sum('w' in r or 'bw' in r for r in rows), 'withEmail': sum('e' in r for r in rows), 'withFullAddress': sum('f' in r for r in rows), 'withAnyAddress': sum('a' in r for r in rows), **stats, 'counties': len({r['c'] for r in rows}), 'skipped': skipped, 'osmTimestamp': ts}))
