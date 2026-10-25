#!/usr/bin/env python3
"""Candidate culturally specific food places in NC from an OSM extract (research input only; every listing that ends up
in the app is checked by hand). Usage: python3 scripts/extract_cultural_food_osm.py north-carolina.osm.pbf out.json"""
import json, re, sys, os
import osmium
from shapely.geometry import shape, Point
from shapely.strtree import STRtree
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
counties = json.load(open(os.path.join(ROOT, 'public/data/county-boundaries.json')))
polys = [shape({'type': 'MultiPolygon', 'coordinates': c['p']}) for c in counties]
tree = STRtree(polys)
def county_of(lo, la):
    pt = Point(lo, la)
    for i in tree.query(pt):
        if polys[i].contains(pt): return counties[i]['n']
NAME = re.compile(r'halal|kosher|zabiha|tienda|carnicer|mercado|supermercado|latin|hispan|mexican|asian|oriental|h mart|hmart|patel|india|bharat|desi|apna|african|caribbean|jamaica|mediterranean|middle east|arab|persian|turkish|international|euro|russian|polish|ukrain|korean|chinese|vietnam|thai|filipin|japanese|lao|hmong|montagnard|nepal|ethiopia|caribe|taj|bombay|halal|islamic|masjid|mosque|gurdwara|sikh|hindu|temple|jewish|synagogue|chabad|food bank|food pantry|pantry|lotte|grand asia|global|world market|afro|nigeria|ghana|somali|kurd|arabic|bazaar|sabor|la rosa|la favorita|compare foods|super g|international food', re.I)
SHOPS = {'supermarket', 'convenience', 'butcher', 'greengrocer', 'deli', 'grocery', 'food', 'seafood', 'spices', 'general'}
out = []
class H(osmium.SimpleHandler):
    def visit(self, kind, o, la, lo):
        t = {k.k: k.v for k in o.tags}
        name = t.get('name', '')
        diet = {k: v for k, v in t.items() if k.startswith('diet:')}
        shop = t.get('shop'); amen = t.get('amenity'); sf = t.get('social_facility'); rel = t.get('religion')
        is_shop = shop in SHOPS
        is_bank = amen == 'food_bank' or sf in ('food_bank', 'soup_kitchen') or (amen == 'social_facility' and 'food' in (sf or ''))
        is_worship = amen == 'place_of_worship' and rel in ('muslim', 'jewish', 'sikh', 'hindu', 'buddhist')
        hit = (is_shop and (NAME.search(name) or diet.get('diet:halal') in ('yes', 'only') or diet.get('diet:kosher') in ('yes', 'only') or t.get('origin') or t.get('cuisine'))) or is_bank or is_worship
        if not hit or not name or la is None: return
        c = county_of(lo, la)
        if not c: return
        out.append({'id': f'{kind}/{o.id}', 'name': name, 'shop': shop, 'amenity': amen, 'social_facility': sf, 'religion': rel, 'cuisine': t.get('cuisine'), 'origin': t.get('origin'), **diet,
            'phone': t.get('phone') or t.get('contact:phone'), 'website': t.get('website') or t.get('contact:website'),
            'addr': ' '.join(x for x in [t.get('addr:housenumber'), t.get('addr:street')] if x), 'city': t.get('addr:city'), 'zip': t.get('addr:postcode'), 'county': c, 'la': round(la, 5), 'lo': round(lo, 5)})
    def node(self, n):
        if n.location.valid(): self.visit('node', n, n.location.lat, n.location.lon)
    def area(self, a):
        try:
            ring = list(a.outer_rings())
            if not ring: return
            pts = [(n.lon, n.lat) for n in ring[0]]
            la = sum(p[1] for p in pts) / len(pts); lo = sum(p[0] for p in pts) / len(pts)
            self.visit('way' if a.from_way() else 'relation', a, la, lo)  # note: a.id is the osmium area id; build_cultural_food.py converts it (osm_url)
        except Exception: pass
H().apply_file(sys.argv[1], locations=True)
json.dump(out, open(sys.argv[2], 'w'), indent=1)
print(len(out))
