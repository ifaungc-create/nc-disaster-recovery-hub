"""Build the static JSON the app ships (public/data/*.json) from the raw downloads in data-raw/.
Run: python3 scripts/build_counties.py && python3 scripts/linkcheck.py && python3 scripts/discover_links.py && python3 scripts/build_data.py
"""
import json, os, re, csv, math, urllib.parse
from collections import Counter
ROOT = os.path.join(os.path.dirname(__file__), '..')
R = os.path.join(ROOT, 'data-raw'); OUT = os.path.join(ROOT, 'public', 'data')
os.makedirs(OUT, exist_ok=True)
p = lambda f: os.path.join(R, f)
def dump(name, obj):
    json.dump(obj, open(os.path.join(OUT, name), 'w'), separators=(',', ':'), ensure_ascii=False)
    print(f'{name}: {os.path.getsize(os.path.join(OUT, name)) // 1024} KB')

# ---------- research corrections overlay ----------
# data-raw/research_corrections_2026-10-22.json (re-verification pass) and data-raw/local_corrections.json are applied
# to the built records, so every rebuild keeps them. Only medium, medium-high or high confidence is applied. A correction
# is applied when the built value still equals its "old" value; if the build already produces the "new" value it counts
# as already applied; anything else is skipped and reported in data-raw/corrections_applied.json.
OK_CONF = {'high', 'medium-high', 'medium'}
HTTP_ONLY = set(json.load(open(p('overrides.json'))).get('_httpOnly', []))  # sites that answer only over http (see overrides.json)
CORR = [c for f in ('research_corrections_2026-10-22.json', 'local_corrections.json') for c in json.load(open(os.path.join(R, f)))['corrections']]
corr_log = []
_MISSING = object()
def _get(o, path):
    for k in path.split('.'):
        if not isinstance(o, dict) or k not in o: return _MISSING
        o = o[k]
    return o
def _set(o, path, v):
    ks = path.split('.')
    for k in ks[:-1]: o = o.setdefault(k, {})
    if v is None: o.pop(ks[-1], None)
    else: o[ks[-1]] = v
def _match(rec, key):
    return all(str(rec.get(k)) == str(v) for k, v in key.items() if k != 'section')
def apply_corrections(fname, records):
    todo = [c for c in CORR if c['file'] == fname]
    todo.sort(key=lambda c: c['field'] == 'id')  # change ids last: later matches use the old id
    for c in todo:
        e = {'cid': c['cid'], 'record': c['record'], 'path': c['path'], 'confidence': c['confidence']}
        if c['confidence'] not in OK_CONF:
            corr_log.append({**e, 'result': 'skipped: confidence below medium'}); continue
        recs = [r for r in records if _match(r, c['record'])]
        if c['path'] == '(record)':
            if recs and c['new'] is None:
                for r in recs: records.remove(r)
                corr_log.append({**e, 'result': 'applied'})
            else: corr_log.append({**e, 'result': 'already applied' if not recs else 'skipped: unsupported'})
            continue
        if len(recs) != 1:
            corr_log.append({**e, 'result': f'skipped: {len(recs)} matching records'}); continue
        cur = _get(recs[0], c['path']); cur = None if cur is _MISSING else cur
        if isinstance(cur, str) and isinstance(c['old'], str) and cur.startswith('http://') and urllib.parse.urlsplit(cur).hostname in HTTP_ONLY and 'https://' + cur[7:] == c['old']:
            cur = c['old']  # same link; the build kept http for an http-only site
        if cur == c['old']: _set(recs[0], c['path'], c['new']); corr_log.append({**e, 'result': 'applied'})
        elif cur == c['new']: corr_log.append({**e, 'result': 'already applied'})
        else: corr_log.append({**e, 'result': 'skipped: current value differs from old', 'current': cur})

# ---------- county boundaries (Census TIGERweb, simplified) + point-in-polygon ----------
geo = json.load(open(p('nc_counties.geojson')))
polys = []
for f in geo['features']:
    g = f['geometry']; rings = g['coordinates'] if g['type'] == 'Polygon' else [r for poly in g['coordinates'] for r in poly]
    if g['type'] == 'Polygon': parts = [g['coordinates']]
    else: parts = g['coordinates']
    polys.append({'n': f['properties']['BASENAME'], 'p': [[[[round(x, 4), round(y, 4)] for x, y in ring] for ring in part] for part in parts]})
dump('county-boundaries.json', polys)
def inring(x, y, ring):
    c = False; j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]; xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi: c = not c
        j = i
    return c
def county_at(lat, lon):
    for c in polys:
        for part in c['p']:
            if inring(lon, lat, part[0]) and not any(inring(lon, lat, h) for h in part[1:]): return c['n']
    return ''

# ---------- ZIP centroids (Census 2024 ZCTA gazetteer) + places ----------
zips = {}
for row in csv.reader(open(p('2024_Gaz_zcta_national.txt')), delimiter='\t'):
    z = row[0].strip()
    if re.match(r'^2[78]\d{3}$', z):
        lat, lon = float(row[5]), float(row[6].strip())
        zips[z] = [round(lat, 4), round(lon, 4), county_at(lat, lon)]
zips = {z: v for z, v in zips.items() if v[2]}  # keep ZCTAs whose centroid is inside NC
dump('zips.json', zips)
places = []
for row in csv.reader(open(p('2024_Gaz_place_national.txt')), delimiter='\t'):
    if row[0] == 'NC':
        lat, lon = float(row[10]), float(row[11].strip())
        name = re.sub(r' (city|town|village|CDP)$', '', row[3])
        places.append([name, round(lat, 4), round(lon, 4), county_at(lat, lon)])
dump('places.json', places)

# ---------- fire departments ----------
dept = {}
P = 'OSFM_FireDepartments_20230324.'
for f in json.load(open(p('osfm_fd.json')))['features']:
    a = {k.replace(P, ''): v for k, v in f['attributes'].items() if k.startswith(P)}
    v, pd = a.get('VOLUNTEER') or 0, a.get('PAID') or 0
    t = 'Combination' if v and pd else 'Volunteer' if v else 'Paid (career)' if pd else ''
    dept[a['FD_ID']] = {'type': t, 'gov': a.get('FRF_GOV') or '', 'name': a['DEPT_NAME'], 'phone': a.get('DEPT_PHONE') or '', 'addr': a.get('DEPT_ADDRESS') or '', 'county': a['COUNTY'], 'lat': f['geometry']['y'], 'lon': f['geometry']['x']}
directory = {d['fdid']: d for d in json.load(open(p('osfm_directory_parsed.json')))['departments']}
# The OSFM directory also lists rescue squads, EMS, county EM offices and teams. Keep fire departments:
# FDIDs ending 00-49 (the usual fire-department range), any FDID that is in the OSFM fire-department map
# layer, and fire-named entries that are not EMS-only units or fire marshal offices. (Burke, Carteret,
# Craven, Moore, Pitt, Rowan and Surry number fire departments 50-99, which an earlier "< 50" filter dropped.)
FIRE_NAME = re.compile(r'\bFire\b|\bF&R\b|\bVFD\b|Fire[-/]Rescue', re.I)
NOT_FD = re.compile(r'Fire Marshal|Emergency Medical Service', re.I)
fire_dir = {k: d for k, d in directory.items() if int(k[-2:]) < 50 or k in dept or (FIRE_NAME.search(d['name']) and not NOT_FD.search(d['name']))}
def ph(s):
    m = re.search(r'\(?(\d{3})\)?[\s.\-]*(\d{3})[\s.\-]*(\d{4})', s or ''); return f'{m.group(1)}-{m.group(2)}-{m.group(3)}' if m else ''
out = []; seen = set()
for f in json.load(open(p('osfm_stations.json'))):
    a = f['attributes']
    if a.get('removed_ind') == 'Y' or a.get('dept_status') != 'Active' or not a.get('latitude'): continue
    d = dept.get(a['fd_id'], {}); cur = fire_dir.get(a['fd_id'])
    rec = {'id': a['fd_id'], 'n': (cur or {}).get('name') or a['dept_name'], 'st': a.get('station_number') or '', 't': d.get('type', ''),
           'a': (a.get('station_address') or '').strip(), 'c': (a.get('city') or '').strip(), 'z': (a.get('zip_code') or '')[:5], 'co': a['county'],
           'la': round(a['latitude'], 5), 'lo': round(a['longitude'], 5), 'p': ph((cur or {}).get('phone')) or ph(a.get('dept_phone')) or ph(d.get('phone'))}
    if not cur: rec['v'] = 0  # not in the Oct 2026 OSFM directory: to verify
    out.append(rec); seen.add(a['fd_id'])
# departments in the current directory with no station point: list them without a map location
nostation = 0
for k, d in fire_dir.items():
    if k in seen: continue
    g = dept.get(k)
    m = re.search(r'^(.*?),\s*NC\s*(\d{5})', d['cityStateZip'])
    rec = {'id': k, 'n': d['name'], 'st': '', 't': (g or {}).get('type', ''), 'a': d['mail'], 'c': m.group(1) if m else '', 'z': m.group(2) if m else '', 'co': d['county'], 'p': ph(d['phone'])}
    if g: rec['la'], rec['lo'] = round(g['lat'], 5), round(g['lon'], 5); rec['hq'] = 1
    else: nostation += 1
    out.append(rec)
apply_corrections('public/data/fire-departments.json', out)
out.sort(key=lambda r: (r['co'], r['n'], str(r['st'])))
dump('fire-departments.json', out)
depts = {r['id'] for r in out}
fire_stats = {'records': len(out), 'stations': sum(1 for r in out if 'hq' not in r and r.get('la') and r['st'] != ''), 'departments': len(depts),
  'departmentsInOct2026Directory': len(fire_dir), 'directoryDeptsWithoutStationPoint': len([k for k in fire_dir if k not in seen]),
  'withoutCoordinates': sum(1 for r in out if not r.get('la')), 'withoutPhone': sum(1 for r in out if not r['p']), 'notInCurrentDirectory': len({r['id'] for r in out if r.get('v') == 0}),
  'types': Counter(r['t'] or 'unknown' for r in out), 'counties': len({r['co'] for r in out})}
print('fire', fire_stats)

# ---------- counties (with link-check results) ----------
lc = json.load(open(p('linkcheck.json'))); disc = json.load(open(p('discovered.json')))
ovr = {k: v for k, v in json.load(open(p('overrides.json'))).items() if not k.startswith('_')}
for u in json.load(open(p('verified_by_webfetch.json')))['urls']: lc[u] = {'status': 200, 'final': u, 'via': 'webfetch'}
BADFIND = {'Henderson|health', 'Northampton|em', 'Pender|em'}  # matched the wrong page; keep the state-directory link
def https(u):
    if u.startswith('http://') and urllib.parse.urlsplit(u).hostname not in HTTP_ONLY: return 'https://' + u[7:]
    return u.replace('&amp;', '&')
def check(u):
    if not u: return '', 'missing'
    if u.startswith('http://http'): u = 'http://' + u[len('http://http://'):]
    hu = https(u); r = lc.get(hu) or lc.get(u) or {}
    s = r.get('status', 0)
    if 200 <= s < 400: return hu, 'ok'
    if s in (401, 403, 429): return hu, 'blocked'  # site refused automated checks; link likely fine
    return hu, 'to-verify'
counties = json.load(open(p('counties_unchecked.json')))
ltrg = json.load(open(p('ncvoad_ltrg.json')))
summary = Counter(); complete = []
for c in counties:
    for k in ('website', 'em', 'dss', 'health', 'rod', 'tribalEm'):
        if k not in c: continue
        o = c[k]
        key = f"{c['name']}|{k}"
        if key in ovr:
            o['url'], o['urlSource'] = ovr[key], 'official county website (state directory link was broken; found by search)'
            o['url'], o['check'] = check(o['url'])
        elif disc.get(key) and key not in BADFIND and check(o['url'])[1] == 'to-verify':
            o['url'], o['urlSource'] = disc[key]['url'], 'found on the official county website (state directory link was broken)'
            o['check'] = 'ok'  # discover_links.py loaded it (HTTP 200)
        else: o['url'], o['check'] = check(o.get('url'))
        for f in ('alerts', 'orderVitalRecords', 'directoryPage'):
            if o.get(f):
                u, s = check(o[f]); o[f] = u
                if s == 'to-verify': o[f + 'Check'] = 'to-verify'
    c['ltrg'] = ltrg.get(c['name'], [])
apply_corrections('public/data/counties.json', counties)
for c in counties:
    for k in ('website', 'em', 'dss', 'health', 'rod', 'tribalEm'):
        if k in c: summary[(k, c[k]['check'])] += 1
    core = ['website', 'em', 'dss', 'health', 'rod']
    c['complete'] = all(c[k]['check'] in ('ok', 'blocked') for k in core) and all(c[k].get('phone') for k in ('em', 'dss', 'health', 'rod'))
    if c['complete']: complete.append(c['name'])
import html as _html
def _unesc(o):
    if isinstance(o, str): return _html.unescape(o)
    if isinstance(o, list): return [_unesc(x) for x in o]
    if isinstance(o, dict): return {k: _unesc(v) for k, v in o.items()}
    return o
counties = _unesc(counties)
dump('counties.json', counties)
county_stats = {'counties': len(counties), 'complete': len(complete), 'allLinksStrictOk': sum(1 for c in counties if all(c[k]['check'] == 'ok' for k in ['website', 'em', 'dss', 'health', 'rod'])),
  'byField': {f'{k}:{s}': v for (k, s), v in sorted(summary.items())}, 'incomplete': [c['name'] for c in counties if not c['complete']]}
print('counties', county_stats)

# ---------- school districts (NC DPI School Report Card rcd_location 2024-25) ----------
leas = []
for r in csv.DictReader(open(p('dpi_lea_2025.csv'))):
    u = (r['url'] or '').strip(); u = u if u.startswith('http') else ('http://' + u if u else '')
    hu, s = check(u)
    kind = 'State school' if r['agency_code'] in ('296LEA', '297LEA') else ('City/town district' if r['agency_code'][2:3] != '0' and r['agency_code'] != '995LEA' else 'County district')
    leas.append({'code': r['agency_code'][:3], 'name': r['name'], 'county': r['county'], 'url': hu, 'check': s, 'phone': ph(r['phone']) if len(re.sub(r'\D', '', r['phone'] or '')) == 10 else '', 'address': f"{r['street_addr']}, {r['city']}, NC {r['zip']}", 'kind': kind})
apply_corrections('public/data/school-districts.json', leas)
leas.sort(key=lambda x: (x['county'], x['kind'] != 'County district', x['name']))
dump('school-districts.json', leas)
school_stats = {'total': len(leas), 'LEAs': sum(1 for l in leas if l['kind'] != 'State school'), 'county': sum(1 for l in leas if l['kind'] == 'County district'), 'city': sum(1 for l in leas if l['kind'] == 'City/town district'), 'state': sum(1 for l in leas if l['kind'] == 'State school'), 'links': Counter(l['check'] for l in leas), 'toVerify': [l['name'] for l in leas if l['check'] == 'to-verify']}
print('schools', school_stats)
json.dump(corr_log, open(os.path.join(R, 'corrections_applied.json'), 'w'), indent=1, ensure_ascii=False)
print('corrections', Counter(e['result'].split(':')[0] for e in corr_log))
json.dump({'built': '2026-10-22', 'fire': fire_stats, 'counties': county_stats, 'schools': school_stats}, open(os.path.join(R, 'coverage.json'), 'w'), indent=1, default=dict)
