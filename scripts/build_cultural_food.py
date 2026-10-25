"""Builds public/data/cultural-food.json from verified pantry pages + curated OSM store candidates.
Every entry cites the page it came from. verified=False entries render a "Not verified" badge."""
import json, re, datetime
OSM = {x['name'] + '|' + x['id']: x for x in json.load(open('data-raw/cultural-food/osm_stores.json'))}
osm_by_id = {x['id']: x for x in OSM.values()}

REGION = {}
for r, cs in {
  'triangle': 'Wake Durham Orange Chatham Johnston Franklin Harnett',
  'triad': 'Guilford Forsyth Davidson Surry Yadkin',
  'charlotte': 'Mecklenburg Cabarrus Iredell Union Gaston Stanly Rowan',
  'west': 'Buncombe Burke Watauga Ashe McDowell Jackson',
  'east': 'Pitt Wayne Wilson Beaufort Duplin Sampson New_Hanover Pasquotank Craven',
  'southeast': 'Cumberland Hoke Moore Bladen Richmond',
}.items():
    for c in cs.split(): REGION[c.replace('_', ' ')] = r

def ph(p):
    if not p: return None
    d = re.sub(r'\D', '', p)
    if d.startswith('1') and len(d) == 11: d = d[1:]
    return f'{d[0:3]}-{d[3:6]}-{d[6:]}' if len(d) == 10 else p

pantries = [
 # --- Jewish / kosher
 dict(id='rcjfs', name='Raleigh-Cary Jewish Family Services Food Pantry', types=['kosher','jewish'], county='Wake', city='Raleigh',
      address='8210 Creedmoor Road, Suite 104, Raleigh, NC 27613', phone='919-676-2295', ext='112', hours='By appointment only',
      url='https://www.raleighcaryjfs.org/financial-and-food-assistance', verified=True,
      note={'en':'JFS says it is the only food pantry in Wake County with a kosher section. Serves residents across Wake County. Also offers Mitzvah Meals (kosher-style prepared meals).',
            'es':'JFS indica que es la única despensa de alimentos del condado de Wake con una sección kosher. Atiende a residentes de todo el condado de Wake. También ofrece Mitzvah Meals (comidas preparadas estilo kosher).'}),
 dict(id='jfsclt', name='Jewish Family Services of Greater Charlotte Food Pantry', types=['jewish'], county='Mecklenburg', city='Charlotte',
      address='5007 Providence Rd, Suite 105, Charlotte, NC 28226', phone='704-364-6594',
      url='https://jfscharlotte.org/supportservices/', verified=True,
      note={'en':'Food, personal care items and other necessities. The page does not say whether kosher food is available; ask when you call.',
            'es':'Alimentos, artículos de cuidado personal y otras necesidades. La página no indica si hay alimentos kosher; pregunte al llamar.'}),
 dict(id='jfswnc', name='Jewish Family Services of WNC Food Pantry', types=['jewish'], county='Buncombe', city='Asheville',
      address='20 Fall Pippin Lane, Suite 202, Asheville, NC 28803', phone='828-253-2900',
      url='https://jfswnc.org/services-and-programs/crisis/', verified=True,
      note={'en':'Pantry for anyone needing temporary help; partner agency of MANNA FoodBank. Kosher availability is not stated.',
            'es':'Despensa para cualquier persona que necesite ayuda temporal; agencia asociada de MANNA FoodBank. No se indica si hay alimentos kosher.'}),
 dict(id='gsojfs', name='Jewish Family Services ~ David D. Frazier Food Pantry', types=['jewish'], county='Guilford', city='Greensboro',
      address='5509-C West Friendly Avenue, Greensboro, NC 27410', phone='336-852-4829', hours='Wednesdays 11:00 am–1:00 pm (do not arrive before 10:30 am)',
      url='https://findfood.ghpfa.org/findfood/services_1676604904375_5/2660980/13056549', verified=True,
      note={'en':'Listed on the Greater Guilford Food Finder. Households may come weekly; first visit needs an intake form. May close for bad weather or holidays, so call ahead.',
            'es':'Aparece en Greater Guilford Food Finder. Los hogares pueden venir cada semana; la primera visita requiere un formulario de admisión. Puede cerrar por mal tiempo o días festivos; llame antes.'}),
 dict(id='jfg', name='Jewish for Good Food Pantry', types=['jewish'], county='Durham', city='Durham',
      address='1937 West Cornwallis Road, Durham, NC 27705', phone='919-354-4959',
      url='https://www.jewishforgood.org/about', verified=True,
      note={'en':'The agency says it offers a food pantry. Hours, eligibility and kosher availability are not on the page; call first.',
            'es':'La agencia indica que ofrece una despensa de alimentos. El horario, los requisitos y si hay alimentos kosher no aparecen en la página; llame primero.'}),
 # --- Muslim / halal
 dict(id='iar', name='Islamic Association of Raleigh Food Pantry', types=['halal','muslim'], county='Wake', city='Raleigh',
      address='808 Atwater St, Raleigh, NC 27607', phone='919-834-9572', hours='First Saturday of each month 10 am–12 pm (every Saturday during Ramadan)',
      url='https://raleighmasjid.org/services/social-services-welfare/food-pantry-service/', verified=True,
      note={'en':'Rice, oil, sugar, flour, milk, eggs, juice and zabiha (halal) meat. Open to everyone, Muslim and non-Muslim. Register on your first visit. Pantry is at the Al Iman School building / Red Brick Building facing Ligon Street.',
            'es':'Arroz, aceite, azúcar, harina, leche, huevos, jugo y carne zabiha (halal). Abierta a todos, musulmanes y no musulmanes. Regístrese en su primera visita. La despensa está en el edificio de Al Iman School / edificio de ladrillo rojo frente a Ligon Street.'}),
 dict(id='mycc', name='Muslim Youth & Community Center (MYCC) Food Pantry', types=['halal','muslim'], county='Wake', city='Raleigh',
      address='5017 Deah Way, Raleigh, NC 27616', phone='919-238-6424', hours='Third Saturday of each month 11 am–1 pm',
      url='https://mycc-rdu.org/food-pantry/', verified=True,
      note={'en':'Monthly food pantry. Ask whether halal meat is included that month.', 'es':'Despensa mensual. Pregunte si ese mes incluye carne halal.'}),
 dict(id='icna-durham', name='ICNA Relief Food Pantry (Durham)', types=['muslim'], county='Durham', city='Durham',
      address='3034 Fayetteville St, Durham, NC', phone='866-354-0102', ext='2004', hours='Drive-thru food distribution, 2nd Saturday of each month 2–4 pm',
      url='https://icnarelief.org/north-carolina/', verified=True,
      note={'en':'Run by ICNA Relief, a Muslim relief organization.', 'es':'Administrada por ICNA Relief, una organización musulmana de ayuda.'}),
 dict(id='mec', name='Muslim Education Center – Charlotte Food Program', types=['muslim'], county='Mecklenburg', city='Charlotte',
      address='4301 Shamrock Dr, Charlotte, NC 28215', phone='704-290-2000',
      url='https://www.meccharlotte.org/charlotte-food-program', verified=False,
      note={'en':'The center has a "Charlotte Food Program" page, but it does not show hours or who can get food. Call to confirm.',
            'es':'El centro tiene una página del "Charlotte Food Program", pero no muestra horario ni quién puede recibir alimentos. Llame para confirmar.'}),
 dict(id='icg', name='Islamic Center of Greensboro Food Pantry', types=['muslim'], county='Guilford', city='Greensboro',
      address='2023 Sixteenth St, Greensboro, NC 27405', phone='336-375-4908',
      url='https://icgmasjid.org/food-pantry/', verified=True,
      note={'en':'Free, confidential walk-in pantry, open to everyone.', 'es':'Despensa gratuita y confidencial, sin cita, abierta a todos.'}),
 dict(id='wdm', name="Halimah's Pantry – W.D. Mohammed Islamic Center", types=['muslim'], county='Guilford', city='Greensboro',
      address='3015 E. Bessemer Avenue, Greensboro, NC 27405', phone='336-285-5992', hours='Tue, Wed, Thu 11:30 am–1:00 pm',
      url='https://wdmicgso.org/', verified=True,
      note={'en':'Fresh groceries, open to all in need. New clients complete an intake form; pickup at the rear of the building.',
            'es':'Alimentos frescos, abierta a todas las personas necesitadas. Los clientes nuevos llenan un formulario; se recoge en la parte trasera del edificio.'}),
 dict(id='cmws', name="Al-Ma'un Food Bank – Community Mosque of Winston-Salem", types=['muslim'], county='Forsyth', city='Winston-Salem',
      address='1419 Waughtown Street, Winston-Salem, NC 27107', phone='336-650-1095', hours='Third Saturday of each month 11:00 am–12:30 pm',
      url='https://communitymosque.com/food-bank-%26-services', verified=True,
      note={'en':'Fresh groceries. ICNA Relief also lists a drive-thru food / hot meal distribution here on the 3rd Saturday, 11 am–1 pm.',
            'es':'Alimentos frescos. ICNA Relief también anuncia aquí una distribución de alimentos / comida caliente (drive-thru) el 3.er sábado, de 11 am a 1 pm.'}),
 dict(id='omar', name='Masjid Omar Ibn Sayyid – Monthly Food Drive', types=['muslim'], county='Cumberland', city='Fayetteville',
      address=None, phone='910-488-7322', hours='Third Saturday of each month, 9 am',
      url='https://www.masjidomaribnsayyid.org/', verified=False,
      note={'en':'The masjid lists a monthly food drive. It is not clear whether food is handed out to the public; call first.',
            'es':'La mezquita anuncia una colecta mensual de alimentos. No está claro si se entregan alimentos al público; llame primero.'}),
 # --- Sikh langar (free vegetarian meal)
 dict(id='sgnc', name='Sikh Gurudwara of North Carolina – Langar', types=['sikh','vegetarian'], county='Durham', city='Durham',
      address='3214 E. Banner St, Durham, NC 27704', phone='919-220-0630', hours='Sundays: 12:45 pm Bhog followed by Langar',
      url='https://sgncweb.org/program/', verified=True, kind='meal',
      note={'en':'Langar is a free community meal. Visitors of all backgrounds are welcome. Please cover your head and remove shoes per gurdwara custom (see the visitors page).',
            'es':'El langar es una comida comunitaria gratuita. Se recibe a visitantes de todos los orígenes. Por costumbre del gurdwara, cúbrase la cabeza y quítese los zapatos (vea la página para visitantes).'}),
 dict(id='gsclt', name='Gurdwara Sahib Charlotte – Guru Ka Langar', types=['sikh','vegetarian'], county='Mecklenburg', city='Charlotte',
      address='5715 University City Blvd., Charlotte, NC 28262', phone='704-509-2828', hours='Sundays 1:15 pm',
      url='https://gurdwarasahibcharlotte.org/services/', verified=True, kind='meal',
      note={'en':'Free vegetarian community meal, open to people of any background.', 'es':'Comida comunitaria vegetariana gratuita, abierta a personas de cualquier origen.'}),
 dict(id='gkd', name='Gurudwara Sahib Khalsa Darbar – Langar (Free Kitchen)', types=['sikh','vegetarian'], county='Mecklenburg', city='Charlotte',
      address='401 E Arrowood Rd, Charlotte, NC 28217', phone=None,
      url='https://gurdwarakhalsadarbar.org/services/', verified=False, kind='meal',
      note={'en':'The gurdwara lists a langar (free kitchen). Days and times are not on the page.', 'es':'El gurdwara anuncia un langar (cocina gratuita). Los días y horarios no aparecen en la página.'}),
 # --- Latino / bilingual
 dict(id='camino', name='Camino Food Farmacy', types=['latino'], county='Mecklenburg', city='Charlotte',
      address='201 Stetson Dr, Charlotte, NC 28262', phone='704-596-5606',
      url='https://camino.org/the-food-farmacy-takes-a-bite-out-of-hunger/', verified=True,
      note={'en':'Bilingual (English/Spanish) nonprofit serving Latino families. Apply online or call; walk-ins and appointments accepted. Published hours vary between sources, so call for current hours.',
            'es':'Organización bilingüe (inglés/español) que atiende a familias latinas. Solicite en línea o llame; aceptan visitas sin cita y con cita. El horario publicado varía según la fuente; llame para confirmar.'}),
 dict(id='unidxs', name='UNIDXS WNC Food Pantry', types=['latino'], county='Jackson', city='Sylva',
      address='503 Mill Street, Sylva, NC 28779', phone=None, hours='Open pantry and pre-packed food boxes (check current schedule)',
      url='https://unidxswnc.org/warehouse', url_es='https://unidxswnc.org/es/warehouse', verified=True,
      note={'en':'Bilingual (English/Spanish) community organization. Site also points to the MANNA Food Helpline 828-290-9749.',
            'es':'Organización comunitaria bilingüe (inglés/español). El sitio también remite a la línea de ayuda de MANNA: 828-290-9749.'}),
 # --- Kosher prepared food
 dict(id='kosherclt', name='Kosher Charlotte (take-out at Chabad of Charlotte)', types=['kosher'], county='Mecklenburg', city='Charlotte',
      address='6619 Sardis Road, Charlotte, NC 28270 (back entrance)', phone='704-256-0134', hours='Take-out Mon–Thu 11 am–6 pm',
      url='https://www.chabadnc.org/templates/articlecco_cdo/aid/5022613/jewish/Kosher-food-in-Charlotte.htm', verified=True, kind='store',
      note={'en':'Kosher prepared food for purchase (not free). Listed by Chabad of Charlotte.', 'es':'Comida kosher preparada a la venta (no es gratis). Según Chabad of Charlotte.'}),
]
for p in pantries:
    p.setdefault('kind', 'pantry')

def osm_url(oid):
    # The extract stored osmium *area* ids for closed ways (area id = way id * 2, relation id * 2 + 1).
    kind, n = oid.split('/'); n = int(n)
    if kind == 'way': kind, n = ('way', n // 2) if n % 2 == 0 else ('relation', (n - 1) // 2)
    return f'https://www.openstreetmap.org/{kind}/{n}'
def store(oid, types, verified=False, url=None, phone=None, address=None, city=None, note=None, display=None):
    x = osm_by_id[oid]
    addr = address or ', '.join(filter(None, [x['addr'], x['city'], ('NC ' + x['zip']) if x['zip'] else 'NC']))
    return dict(id=oid.replace('/', '-'), name=display or x['name'], types=types, county=x['county'], city=city or x['city'],
                address=addr, phone=ph(phone or x['phone']), url=url or x['website'], osm=osm_url(oid),
                verified=verified, kind='store', note=note)

S = []
def add(osmname, types, **kw):
    hits = [x for x in osm_by_id.values() if x["name"] == osmname and (kw.get('addr_has') is None or kw['addr_has'] in (x['addr'] or ''))]
    kw.pop('addr_has', None)
    assert hits, osmname
    for h in hits:
        if not h['addr']: continue
        S.append(store(h['id'], types, **kw))

# verified: store's own website (fetched) shows this address/phone
add('Albaraka Mediterranean Market and Grill', ['halal','middle-eastern'], verified=True, url='https://albarakamarketnc.com/',
    note={'en':'Store website says its meat is 100% halal-certified.', 'es':'El sitio web de la tienda dice que su carne tiene certificación 100% halal.'})
add('Indian Fresh Market', ['south-asian','halal'], verified=True, url='https://ifmgrocery.store/', address='115 J Commons Dr, Mooresville, NC 28117', city='Mooresville',
    note={'en':'Store website mentions halal meats (certification not stated).', 'es':'El sitio web de la tienda menciona carnes halal (no indica certificación).'})
add('Grand Asia Market', ['asian'], verified=True, url='https://www.grandasiamarket.com/', phone='919-468-2988')
add("Kim's Oriental Food & Gifts", ['asian'], verified=True, display="Kim's Asian Market", url='https://www.kasianmarket.com/', address='5 Regent Park Blvd Unit 110, Asheville, NC 28806')
add('Carniceria El Kora', ['latino'], verified=True, url='https://carniceriataqueriaelkoranc.com/', address='4516 W Market St, Greensboro, NC 27407', city='Greensboro')
add('Euro Deli Mart', ['eastern-european'], verified=True, url='https://eurodelimart.com/', address='602 Hickory Ridge Drive, Greensboro, NC 27409', city='Greensboro')
add('Patel Brothers', ['south-asian'], addr_has='Chatham', verified=True, url='https://www.patelbros.com/locations', address='802 E. Chatham St., Cary, NC 27511')
add('Patel Brothers', ['south-asian'], addr_has='University', verified=True, url='https://www.patelbros.com/locations', phone='704-509-2305', address='8109 University City Blvd Suite A, Charlotte, NC 28213', city='Charlotte')
add('Little India', ['south-asian'], verified=True, url='https://littleindia.online/')
# OSM only (Not verified)
NV = dict(verified=False)
for name, types, extra in [
  ('Casablanca Market', ['halal','middle-eastern'], {'url': None}),
  ('Jubba Halal Market', ['halal'], {}),
  ('Harmony Mediterranean Market', ['middle-eastern'], {}),
  ('Mediterranean Mart', ['middle-eastern'], {}),
  ('Bosna Market', ['eastern-european'], {'url': None}),
  ('Nadinah African Market', ['african'], {}),
  ('H Mart', ['asian'], {}),
  ('Super G Mart', ['asian','international'], {'addr_has': 'Centrum'}),
  ('Super G Mart', ['asian','international'], {'addr_has': 'Market', 'address': '4927 West Market Street, NC'}),
  ('Asian Market', ['asian'], {'addr_has': 'Plaza'}),
  ("Li Ming's Global Mart", ['asian'], {}),
  ("Li Ming's Global Market", ['asian'], {}),
  ('Mikyin’s Asian Market', ['asian'], {}),
  ('YZ Asian Market', ['asian'], {}),
  ('South East Asian Market', ['asian'], {}),
  ('Laos Lanxang Asian Grocery Store', ['asian'], {}),
  ('Grace Kayah Asian Market', ['asian'], {'url': None}),
  ('Plei Ku Asian Market LLC', ['asian'], {}),
  ('Asian Market', ['asian'], {'addr_has': '757'}),
  ('Asian Food Market', ['asian'], {}),
  ('Super Global Mart', ['international'], {}),
  ('Fresh International Market', ['international'], {}),
  ('International Foods', ['international'], {}),
  ('NC International Grocery Store', ['international'], {}),
  ('Dynasty International Food & Gifts', ['international'], {}),
  ('Kadhambam Spices', ['south-asian'], {}),
  ('Spice Bazaar', ['south-asian'], {}),
  ('Spices Hut Indian Groceries', ['south-asian'], {}),
  ('Apna Bazaar', ['south-asian'], {}),
  ('Royal India Mart', ['south-asian'], {}),
  ('Angadi - Indian Grocery Store', ['south-asian'], {}),
  ('Taj Food Shop', ['south-asian'], {}),
  ('Monroe Convenience Store & Nepali/Indian Grocery', ['south-asian'], {}),
  ('Compare Foods', ['latino','international'], {'addr_has': 'Arrowood', 'url': 'https://www.compareclt.com/stores/compare-foods-e-arrowood'}),
  ('Compare Foods', ['latino','international'], {'addr_has': 'University', 'url': None}),
  ('Compare Foods', ['latino','international'], {'addr_has': 'Tryon'}),
  ('Compare Foods', ['latino','international'], {'addr_has': '2nd'}),
  ('Compare Foods', ['latino','international'], {'addr_has': '3rd'}),
  ('Compare Foods', ['latino','international'], {'addr_has': 'Ward'}),
  ('Compare Foods', ['latino','international'], {'addr_has': 'Bragg'}),
  ('Compare Foods of Zebulon', ['latino','international'], {'addr_has': '506'}),
  ('Compare Foods of Angier', ['latino','international'], {}),
  ('Super Compare Foods', ['latino','international'], {}),
  ('Oasis Tienda Latina', ['latino'], {'url': None}),
  ('Carnicería el Rey', ['latino'], {}),
  ('Tienda ToDo Guerrerense', ['latino'], {}),
  ('Tienda el primo', ['latino'], {}),
  ('La Mexicanita II', ['latino'], {}),
  ('Tienda Mexicana El Michoacano', ['latino'], {}),
  ('La Carniceria Meat Market', ['latino'], {}),
  ('El Super #2 Mexican Store', ['latino'], {}),
  ('Tienda Lloma Bonita Grocers', ['latino'], {'url': None}),
  ('Mi Tierra Tienda Latina y Carnicera', ['latino'], {}),
  ('Tienda Latina El Rincon', ['latino'], {}),
  ('Supermercado Lupitas', ['latino'], {}),
  ('Tienda La Despensa', ['latino'], {}),
  ('Supermercado La Lupita', ['latino'], {}),
  ('El Mexicano', ['latino'], {}),
  ('Don Juan Tienda Mexicana', ['latino'], {}),
  ('Rincon Hispano', ['latino'], {}),
  ('Tienda Mexicana Rincon Latino/Taqueria Rincon Latino', ['latino'], {}),
  ("Nicole's Latin Store and Gifts", ['latino'], {}),
  ('Los Tres Reyes', ['latino'], {'url': None}),
  ('Tienda Mexicana Mexican Store', ['latino'], {}),
  ('El Expresso Mexicano', ['latino'], {}),
  ('Tienda Carniceria Michoacan', ['latino'], {}),
  ('Supermercado El Rancho', ['latino'], {}),
  ('Tienda Michoacan', ['latino'], {}),
  ('La Palmita Mexican Store', ['latino'], {}),
  ('Carniceria El Jarocho', ['latino'], {}),
  ('La Mexicana Tienda Hispana', ['latino'], {}),
  ("Amy's Tienda Mexicana", ['latino'], {}),
  ('Tienda La Hidalguense', ['latino'], {}),
  ('Tienda Y Fruteria Hernandez', ['latino'], {}),
  ('Tienda Espana La Hacienda', ['latino'], {}),
  ('San Judas Tienda Mexicana', ['latino'], {}),
]:
    add(name, types, **NV, **extra)

# Gleiberman's (kosher grocery) — source: Chabad of Charlotte page + store site
S.append(dict(id='gleibermans', name="Gleiberman's Kosher Grocery", types=['kosher'], county='Mecklenburg', city='Charlotte',
  address='1816-G Galleria Boulevard, Charlotte, NC', phone='704-563-8288', url='https://gleibermans.com/', verified=True, kind='store',
  note={'en':"Store says it is the only fully kosher grocery store for 200 miles. Address and phone from Chabad of Charlotte's kosher food page.",
        'es':'La tienda dice ser el único supermercado totalmente kosher en 200 millas. Dirección y teléfono según la página de comida kosher de Chabad of Charlotte.'},
  source='https://www.chabadnc.org/templates/articlecco_cdo/aid/5022613/jewish/Kosher-food-in-Charlotte.htm'))

# de-dup and drop store urls that failed fetch
BAD = {'https://sites.google.com/site/casablancahalalmarket/', 'https://tienda-latina-oasis.business.site', 'https://gurunc.com/',
       'https://www.groupon.com/biz/charlotte/euro-grill-and-cafe', 'http://www.comparesupermarkets.com/index.php/1233-university-dr',
       'http://www.kadhambam.com/', 'http://www.SpiceBazaarNC.com', 'https://spiceshut.com', 'https://freshimarket.com/'}
seen = set(); stores = []
for s in S:
    if s['id'] in seen: continue
    seen.add(s['id'])
    if s.get('url') in BAD or (s.get('url') or '').startswith('https://www.facebook.com'): s['url'] = None
    stores.append(s)

items = pantries + stores
for i in items:
    i['region'] = REGION[i['county']]
    i['phone'] = ph(i.get('phone'))

foodbanks = [
 dict(id='manna', name='MANNA FoodBank', area={'en':'Western NC (16 counties)','es':'Oeste de Carolina del Norte (16 condados)'}, phone='828-290-9749', phoneLabel='Food Helpline', url='https://mannafoodbank.org/find-food/'),
 dict(id='shnwnc', name='Second Harvest Food Bank of Northwest NC', area={'en':'Northwest NC / Triad','es':'Noroeste de Carolina del Norte / Triad'}, phone='336-784-5770', url='https://foodfinder.secondharvestnwnc.org/'),
 dict(id='shmetrolina', name='Second Harvest Food Bank of Metrolina', area={'en':'Charlotte region','es':'Región de Charlotte'}, phone='704-376-1785', url='https://www.secondharvestmetrolina.org/need-food/find-food-near-you'),
 dict(id='fbcenc', name='Food Bank of Central & Eastern North Carolina', area={'en':'Central and eastern NC (34 counties)','es':'Centro y este de Carolina del Norte (34 condados)'}, phone='919-875-0707', url='https://foodbankcenc.org/find-food-resources/'),
 dict(id='iffs', name='Inter-Faith Food Shuttle', area={'en':'Triangle area','es':'Área del Triángulo'}, phone='919-250-0043', url='https://foodshuttle.org/findfood/'),
 dict(id='shsenc', name='Second Harvest Food Bank of Southeast North Carolina', area={'en':'Fayetteville / southeast NC (7 counties)','es':'Fayetteville / sureste de Carolina del Norte (7 condados)'}, phone='910-485-6923', url='https://hungercantwait.org/find-help/find-food/'),
 dict(id='fba', name='Food Bank of the Albemarle', area={'en':'Northeast NC','es':'Noreste de Carolina del Norte'}, phone='252-335-4035', url='https://afoodbank.org/get-help/food-locator/'),
]
helpers = [
 dict(id='nc211', name='NC 211 (United Way of NC)', phone='211', phone2='1-888-892-1162', url='https://nc211.org/',
      note={'en':'Free, confidential referrals to food and other help near you.','es':'Referencias gratuitas y confidenciales a alimentos y otra ayuda cerca de usted.'}),
 dict(id='fns', name='NCDHHS Food and Nutrition Services (FNS / SNAP)', url='https://www.ncdhhs.gov/divisions/child-and-family-well-being/food-and-nutrition-services-food-stamps',
      url_es='https://www.ncdhhs.gov/divisions/child-and-family-well-being/food-and-nutrition-services-food-stamps/servicios-de-alimentos-y-nutricion-cupones-para-alimentos',
      apply='https://epass.nc.gov/', note={'en':'Apply for food benefits online through ePASS or at your county DSS.','es':'Solicite beneficios de alimentos en línea por ePASS o en el DSS de su condado.'}),
]
kosher_tips = dict(url='https://www.chabadofcary.org/templates/articlecco_cdo/aid/2249819/jewish/Kosher-Information.htm',
  en='Chabad of Cary lists Triangle stores with kosher sections: Food Lion in North Raleigh (largest local kosher section), Wegmans on Davis Drive in Morrisville/Cary (fresh kosher meat and chicken), Trader Joe\'s and Publix (kosher poultry and frozen goods), and Golden Hex in Cary (Israeli kosher items). Selection changes; check labels for a kosher symbol.',
  es='Chabad of Cary indica tiendas del Triángulo con sección kosher: Food Lion en North Raleigh (la sección kosher más grande de la zona), Wegmans en Davis Drive en Morrisville/Cary (carne y pollo kosher frescos), Trader Joe\'s y Publix (aves kosher y congelados) y Golden Hex en Cary (productos kosher israelíes). La oferta cambia; busque el símbolo kosher en la etiqueta.')
out = dict(updated=datetime.date.today().isoformat(), foodbanks=foodbanks, helpers=helpers, kosherTips=kosher_tips, items=items)
json.dump(out, open('public/data/cultural-food.json', 'w'), ensure_ascii=False, indent=1)
from collections import Counter
print('items', len(items), 'pantry/meal', sum(i['kind'] != 'store' for i in items), 'stores', sum(i['kind'] == 'store' for i in items))
print('not verified', sum(not i['verified'] for i in items))
print(Counter(t for i in items for t in i['types']))
print(Counter(i['region'] for i in items))
