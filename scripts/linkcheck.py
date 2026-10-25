"""Check every URL in the county and school-district data. Writes data-raw/linkcheck.json {url: {status, final}}."""
import json, subprocess, concurrent.futures as cf, os, sys, csv
R = os.path.join(os.path.dirname(__file__), '..', 'data-raw')
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
urls = set()
for c in json.load(open(os.path.join(R, 'counties_unchecked.json'))):
    for k, v in c.items():
        if isinstance(v, dict):
            for f in ('url', 'alerts', 'orderVitalRecords', 'directoryPage'):
                if v.get(f): urls.add(v[f])
for r in csv.DictReader(open(os.path.join(R, 'dpi_lea_2025.csv'))):
    u = (r['url'] or '').strip()
    if u: urls.add(u if u.startswith('http') else 'http://' + u)
for extra in [a for a in sys.argv[1:] if not a.startswith('--')]:
    urls.update(json.load(open(extra)))
cache_f = os.path.join(R, 'linkcheck.json')
cache = json.load(open(cache_f)) if os.path.exists(cache_f) else {}
# The build box cannot reach port 80, so plain-http links are checked (and later published) as https.
def https(u): return 'https://' + u[len('http://'):] if u.startswith('http://') else u
urls = {https(u.replace('&amp;', '&')) for u in urls if not u.startswith('http://http')} | {u for u in urls if u.startswith('http://http')}
todo = [u for u in urls if u not in cache or (cache[u]['status'] == 0 and 'timed out' in cache[u].get('err', '') and '--retry' in sys.argv)]
def chk(u):
    r = subprocess.run(['curl', '-sS', '-L', '--max-redirs', '8', '-m', '20', '-A', UA, '-H', 'Accept: text/html,*/*', '-o', '/dev/null', '-w', '%{http_code} %{url_effective}', u], capture_output=True, text=True)
    parts = (r.stdout or '0 ').split(' ', 1)
    return u, {'status': int(parts[0] or 0), 'final': parts[1] if len(parts) > 1 else '', 'err': r.stderr.strip()[:120]}
with cf.ThreadPoolExecutor(24) as ex:
    for u, res in ex.map(chk, todo): cache[u] = res
json.dump(cache, open(cache_f, 'w'), indent=1)
from collections import Counter
print(len(urls), 'urls;', Counter(v['status'] for u, v in cache.items() if u in urls))
