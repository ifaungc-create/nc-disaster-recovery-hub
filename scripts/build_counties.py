"""Build src/data/static/counties.json from official directories downloaded into data-raw/.
Sources (fetched 2026-10-22):
 - County websites: https://www.nc.gov/your-government/county-government-websites
 - Emergency management: https://www.ncdps.gov/our-organization/emergency-management/county-emergency-management-agencies
 - DSS: https://www.ncdhhs.gov/divisions/social-services/local-dss-directory (+ per-county pages)
 - Health departments: https://www.dph.ncdhhs.gov/contact/LHD
 - Register of Deeds: https://www.ncard.us/find-your-register-of-deeds/ (+ per-county pages)
 - County fire marshal / fire contact: NC OSFM Department Directory (report created 2026-10-07)
"""
import re, html, csv, json, os
R = os.path.join(os.path.dirname(__file__), '..', 'data-raw')
p = lambda f: os.path.join(R, f)
clean = lambda s: re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s or ''))).strip()
def norm_url(u):
    u = (u or '').strip()
    if not u: return ''
    if not re.match(r'^https?://', u): u = 'https://' + u.lstrip('/')
    return u
def phone(s):
    m = re.search(r'\(?(\d{3})\)?[\s.\-]*(\d{3})[\s.\-]*(\d{4})', s or '')
    return f'{m.group(1)}-{m.group(2)}-{m.group(3)}' if m else ''
def rows(f):
    s = open(p(f), encoding='utf-8', errors='ignore').read(); out = []
    for tr in re.findall(r'<tr.*?</tr>', s, flags=re.S):
        cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', tr, flags=re.S)
        out.append([(clean(c), re.findall(r'href="([^"]+)"', c)) for c in cells])
    return out[1:]

counties = {}
s = open(p('ncgov_counties.html')).read()
for u, n in re.findall(r'href="([^"]+)"[^>]*>\s*([^<]*?County[^<]*?)\s*</a>', s):
    name = html.unescape(n).replace(' County', '').strip()
    counties[name] = {'name': name, 'website': {'url': u, 'source': 'nc.gov'}}
assert len(counties) == 100, len(counties)
key = lambda n: {'Charlotte - Mecklenburg': 'Mecklenburg', 'Tyrell': 'Tyrrell'}.get(n.replace(' County', '').strip(), n.replace(' County', '').strip())

for c in rows('em.html'):
    n = key(c[0][0]); 
    if n not in counties: print('EM? ', n); continue
    alerts = [h for h in c[3][1]] if len(c) > 3 else []
    counties[n]['em'] = {'name': f'{n} County Emergency Management', 'url': norm_url(c[0][1][0]) if c[0][1] else '', 'phone': phone(c[1][0]), 'alerts': norm_url(alerts[0]) if alerts else '', 'source': 'NC DPS / NCEM county directory'}

for c in rows('lhd.html'):
    n = key(c[0][0])
    if n not in counties: print('LHD? ', n); continue
    counties[n]['health'] = {'name': f'{n} County health department', 'url': norm_url(c[0][1][0]) if c[0][1] else '', 'address': c[1][0], 'phone': phone(c[2][0]), 'source': 'NCDHHS Division of Public Health'}

for r in csv.DictReader(open(p('dss_map.csv'))):
    n = r['county'].strip(); slug = n.lower().replace(' ', '_')
    t = r['title'].replace('<br />', '\n'); lines = [clean(x) for x in t.split('\n') if clean(x)]
    addr = next((l for l in lines if re.search(r', NC\s*\d{5}', l)), '')
    ph = next((phone(l) for l in lines if re.match(r'(main number|phone)', l.lower())), '')
    page = open(p(f'pages/dss_{slug}.html'), encoding='utf-8', errors='ignore').read()
    m = page[page.find('<main'):] if '<main' in page else page
    web = next((u for u, txt in re.findall(r'href="([^"]+)"[^>]*>([^<]*)</a>', m) if 'website' in txt.lower() and u.startswith('http')), '')
    txt = clean(m)
    pm = re.search(r'Phone:\s*([\d\-\(\)\. ]{10,16})', txt)
    if pm and not ph: ph = phone(pm.group(1))
    am = re.search(r'Address:\s*(.*?\bNC,?\s*\d{5})', txt)
    if am and not addr: addr = am.group(1)
    em = re.search(r'Emergency (?:phone|Phone)[^:]*:\s*([\d\-\(\)\. ]{10,16})', txt)
    counties[n]['dss'] = {'name': f'{n} County Department of Social Services', 'url': norm_url(web), 'phone': ph, 'afterHours': phone(em.group(1)) if em else '', 'address': addr, 'directoryPage': 'https://www.ncdhhs.gov' + r['url'], 'source': 'NCDHHS Local DSS Directory'}

for n in counties:
    slug = n.lower().replace(' ', '_')
    f = p(f'pages/rod_{slug}.html')
    if not os.path.exists(f): print('ROD missing', n); continue
    s = open(f, encoding='utf-8', errors='ignore').read(); t = clean(s)
    seg = t[t.find(f'{n} County Register of Deeds'):]
    g = lambda lab: (re.search(lab + r':\s*(.*?)\s+(?:Mailing Address|Address|Phone|Fax|Email|Website|County):', seg) or [None, ''])[1]
    links = re.findall(r'href="([^"]+)"[^>]*>([^<]*)</a>', s)
    wm = re.search(r'Website:\s*(?:<[^>]+>\s*)*<a[^>]+href="([^"]+)"', s)
    web = wm.group(1) if wm else norm_url(g('Website'))
    vit = next((u for u, x in links if 'vital records' in x.lower()), '')
    counties[n]['rod'] = {'name': f'{n} County Register of Deeds', 'url': web, 'phone': phone(g('Phone')), 'address': re.sub(r'\s+', ' ', g('(?<!Mailing )Address')).strip(), 'orderVitalRecords': vit, 'directoryPage': 'https://www.ncard.us/find-your-register-of-deeds/' + ('mcDowell' if n == 'McDowell' else n.lower().replace(' ', '-')) + '-county/', 'source': 'NC Association of Registers of Deeds'}

osfm = json.load(open(p('osfm_directory_parsed.json')))['counties']
for n, c in osfm.items():
    if n in counties and (c['contactTitle'] or c['phone']):
        counties[n]['fireMarshal'] = {'title': c['contactTitle'], 'phone': phone(c['phone']), 'address': c['address'], 'source': 'NC OSFM Department Directory (2026-10-07)'}

# Gaps in the state directories, filled from each county's own official website (checked 2026-10-22).
FILL = {
  ('Caswell', 'em'): 'https://www.caswellcountync.gov/emergency-services',
  ('Cherokee', 'em'): 'https://www.cherokeecounty-nc.gov/176/Emergency-Management-Services',
  ('Madison', 'em'): 'https://www.madisoncountync.gov/emergency-management.html',
  ('Mitchell', 'em'): 'https://www.mitchellcountync.gov/departments/emergency-management/',
  ('Robeson', 'em'): 'https://www.robesoncountync.gov/robeson-emergency-services',
  ('Avery', 'dss'): 'https://www.averycountync.gov/departments/DSS.php',
  ('Granville', 'dss'): 'https://www.granvillecounty.org/463/Social-Services',
  ('Guilford', 'dss'): 'https://www.guilfordcountync.gov/government/departments-and-agencies/health-and-human-services-agency/social-services',
  ('Randolph', 'dss'): 'https://www.randolphcountync.gov/departments/social-services',
}
for (n, k), u in FILL.items():
    if not counties[n][k].get('url'): counties[n][k]['url'] = u; counties[n][k]['urlSource'] = 'official county website (state directory had no link)'
# Eastern Band of Cherokee Indians emergency management (listed in the NCDPS table; tribal lands are mainly in Jackson and Swain counties)
for c in rows('em.html'):
    if 'Eastern Band' in c[0][0]:
        for n in ('Jackson', 'Swain', 'Graham', 'Cherokee', 'Haywood'):
            counties[n]['tribalEm'] = {'name': 'Eastern Band of Cherokee Indians Emergency Management', 'url': norm_url(c[0][1][0]) if c[0][1] else '', 'phone': phone(c[1][0]), 'source': 'NC DPS / NCEM county directory'}
out = [counties[k] for k in sorted(counties)]
os.makedirs(os.path.join(R, '..', 'src', 'data', 'static'), exist_ok=True)
json.dump(out, open(p('counties_unchecked.json'), 'w'), indent=1)
miss = {k: [s for s in ['em', 'dss', 'health', 'rod'] if not counties[k].get(s, {}).get('url') or not counties[k].get(s, {}).get('phone')] for k in counties}
print('counties', len(out), 'with gaps:', {k: v for k, v in miss.items() if v})
