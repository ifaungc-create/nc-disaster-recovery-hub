"""For county links that failed the link check (404 / unreachable), look for the right page on the county's
own official homepage (from nc.gov) by link text, then confirm it loads. Output: data-raw/discovered.json"""
import json, re, html, subprocess, os, concurrent.futures as cf
from urllib.parse import urljoin
R = os.path.join(os.path.dirname(__file__), '..', 'data-raw')
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
lc = json.load(open(os.path.join(R, 'linkcheck.json')))
h = lambda u: 'https://' + u[7:] if u.startswith('http://') else u.replace('&amp;', '&')
def st(u): r = lc.get(h(u)) or {}; return r.get('status', 0)
KW = {'em': r'emergency (management|services)', 'dss': r'social services|\bDSS\b|human services', 'health': r'(public )?health', 'rod': r'register of deeds'}
def get(u):
    r = subprocess.run(['curl', '-sSL', '-m', '20', '-A', UA, '-w', '\n%{http_code} %{url_effective}', u], capture_output=True, text=True, errors='ignore')
    body, _, tail = r.stdout.rpartition('\n'); code, _, final = tail.partition(' ')
    return int(code or 0), final, body
out = {}
cs = json.load(open(os.path.join(R, 'counties_unchecked.json')))
jobs = [(c, k) for c in cs for k in KW if c.get(k, {}).get('url') and st(c[k]['url']) in (0, 404)]
print(len(jobs), 'failed links to rediscover')
pages = {}
def home(c):
    u = c['website']['url']
    if u not in pages: pages[u] = get(u)
    return pages[u]
def work(job):
    c, k = job
    code, final, body = home(c)
    if code != 200: return (c['name'], k), None
    cands = []
    for href, txt in re.findall(r'<a[^>]+href="([^"#][^"]*)"[^>]*>(.*?)</a>', body, flags=re.S | re.I):
        t = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', txt))).strip()
        if re.search(KW[k], t, re.I) and len(t) < 60 and not href.startswith(('mailto:', 'tel:')): cands.append((t, urljoin(final, html.unescape(href))))
    for t, u in cands[:4]:
        c2, f2, _ = get(u)
        if c2 == 200: return (c['name'], k), {'url': f2, 'text': t}
    return (c['name'], k), None
for c in cs: home(c) if any(j[0] is c for j in jobs) else None
with cf.ThreadPoolExecutor(10) as ex:
    for key, res in ex.map(work, jobs): out['|'.join(key)] = res
json.dump(out, open(os.path.join(R, 'discovered.json'), 'w'), indent=1)
print(sum(1 for v in out.values() if v), 'found of', len(out))
for k, v in out.items(): print(k, '->', v)
