// App-wide search. Runs ON THE DEVICE against content already in the app and the public data files
// (/data/*.json, precached by the service worker), so it works offline and the words typed are never sent anywhere.
// Matching is accent-blind and checks English and Spanish text together, so "refugio" finds "shelter" and
// "certificado de nacimiento" finds the birth certificate guide whichever language is selected.
import { SECTIONS as EN_S } from './content/resources.js';
import { SECTIONS as ES_S } from './content/resources.es.js';
import { SECTIONS as HC, DONTS } from './content/homecare.js';
import { APPS } from './content/translation.js';
import { loadData } from './geo.js';
import { getCommunity } from './community.js';
import { t, tk, isEs, pick } from './i18n/index.js';
import ES from './i18n/es.js';

export const norm = (s = '') => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// Words that carry no meaning on their own ("how do I get a…", "¿dónde está el…").
const STOP = new Set('a an and the of for to in on at my me i is it be do how what where can need get find help with or by about near nc north carolina el la los las un una de del y o en mi me para por que como donde necesito ayuda con sobre cerca'.split(' '));
// A few everyday words that the official text does not use.
const SYN = { id: ['identification', 'license', 'identificacion', 'licencia'], dmv: ['license', 'licencia', 'dmv'], driver: ['driver', 'license', 'licencia'], drivers: ['driver', 'license', 'licencia'], licence: ['license'], ssn: ['social security'], food: ['food', 'comida', 'pantry', 'despensa', 'snap'], 'food stamps': ['snap'], stamps: ['snap'], money: ['cash', 'assistance', 'dinero'], house: ['home', 'housing', 'casa', 'vivienda'], apartment: ['rental', 'rent', 'alquiler'], lawyer: ['legal', 'abogado'], attorney: ['legal', 'abogado'], job: ['job', 'work', 'empleo', 'trabajo', 'unemployment'], work: ['job', 'empleo', 'trabajo'], motel: ['hotel', 'motel'], phone: ['phone', 'telefono', 'lifeline'], mold: ['mold', 'moho'], smoke: ['smoke', 'humo', 'soot'], fema: ['fema'], insurance: ['insurance', 'seguro', 'claim', 'reclamo'], school: ['school', 'escuela', 'district', 'distrito'], fire: ['fire', 'incendio', 'bomberos'] };

export const tokens = (q) => {
  const n = norm(q); const words = n.split(' ').filter((w) => w && !STOP.has(w));
  return (words.length ? words : n.split(' ').filter(Boolean)).slice(0, 8);
};
// Every word must appear somewhere in the item (or one of its everyday synonyms).
const hit = (text, w) => text.includes(w) || (w.length > 3 && w.endsWith('s') && text.includes(w.slice(0, -1))) || (SYN[w] || []).some((s) => text.includes(norm(s)));
export function score(entry, words, full) {
  if (!words.length) return 0;
  const title = entry._t ||= norm(entry.title + ' ' + (entry.alt || ''));
  const text = entry._x ||= title + ' ' + norm(entry.text || '');
  if (!words.every((w) => hit(text, w))) return 0;
  let s = entry.w || 1;
  if (full && title.includes(full)) s += 60;
  if (words.every((w) => hit(title, w))) s += 30;
  if (words.some((w) => title.startsWith(w))) s += 10;
  return s;
}

const dual = (k) => [t(k), ES[k] && !isEs() ? ES[k] : k].join(' '); // shown language first, the other language for matching
// The app's own screens. alt holds the other language and everyday words.
const pages = () => [
  ['resources/housing', 'Housing & shelter', 'Tonight and long-term', 'shelter refugio albergue rent rebuild'],
  ['hotels', 'Hotels nearby', 'Directions and call', 'motel lodging room tsa stay hotel'],
  ['cultural-food', 'Cultural food: pantries & stores', 'Halal, kosher, Latino, Asian and more', 'food pantry comida despensa grocery'],
  ['home-care', 'Home care after a fire or flood', 'Clean, dry, stop mold, save food', 'cleanup clean mold moho smoke humo flood inundacion'],
  ['translation', 'Translation apps & interpreters', 'Other languages, free interpreters', 'interpreter interprete language idioma translate traducir'],
  ['alerts', 'Alerts', 'Recovery news for NC or your county', 'notifications notificaciones avisos'],
  ['fire', 'Fire departments', 'Search by county, ZIP, name', 'fire station bomberos estacion fire report'],
  ['counties', 'County services', 'EM, DSS, health, Register of Deeds', 'county condado emergency management social services health department'],
  ['schools', 'School districts', 'All NC districts by county', 'school escuela district distrito'],
  ['phone', 'Get a phone number', 'Free options', 'phone telefono lifeline number'],
  ['notes/cases', 'My case numbers', 'FEMA, Red Cross, insurance…', 'case number numero de caso claim application'],
  ['notes/referrals', 'Referrals', 'Track who you were sent to', 'referral referencia'],
  ['resources', 'All resources', 'Jobs, relocating, relief', 'resources recursos help'],
  ['settings', 'Settings', tk('Language, account, location'), 'settings ajustes account cuenta language idioma password'],
  ['privacy', 'Privacy', 'How your information is handled', 'privacy privacidad data datos'],
  ['delete-account', 'Delete your account', tk('Remove your account and data'), 'delete borrar eliminar cuenta account'],
  ['sources', 'Official sources', tk('Where the information comes from'), 'sources fuentes official oficial government gobierno agency agencia fema gov'],
  ['about', 'About &amp; disclaimer', tk('Who runs this app'), 'about acerca disclaimer aviso c4i contact contacto'],
].map(([href, title, sub, alt]) => ({ kind: 'page', href: '#' + href, title: t(title), sub: t(sub), alt: `${ES[title] || ''} ${ES[sub] || ''} ${title} ${sub} ${alt}`, w: 30 }));

const flat = (it) => [it.body, ...(it.steps || []), ...(it.phones || []).map((p) => p.join(' ')), ...(it.links || []).map((l) => l[0]), it.honest].filter(Boolean).join(' ');
function guides() {
  const shown = isEs() ? ES_S : EN_S, other = isEs() ? EN_S : ES_S;
  const out = [];
  shown.forEach((s) => {
    const o = other.find((x) => x.id === s.id) || { items: [] };
    out.push({ kind: 'page', href: `#resources/${s.id}`, title: s.title, sub: s.short, alt: `${o.title || ''} ${o.short || ''}`, text: `${s.intro} ${o.intro || ''}`, w: 25 });
    s.items.forEach((it, i) => { const oi = o.items[i] || {};
      out.push({ kind: 'guide', href: `#resources/${s.id}`, jump: `ri-${s.id}-${i}`, title: it.title, sub: s.title, alt: oi.title || '', text: `${flat(it)} ${flat(oi)}`, phones: it.phones?.slice(0, 1), w: 20 }); });
  });
  [...HC, DONTS].forEach((s) => out.push({ kind: 'guide', href: '#home-care', jump: `hc-${s.id}`, title: pick(s.title), sub: t('Home care after a fire or flood'), alt: `${s.title.en} ${s.title.es}`, text: s.points.map((p) => `${p.en} ${p.es}`).join(' '), w: 18 }));
  APPS.forEach((a) => out.push({ kind: 'guide', href: '#translation', title: a.name, sub: t('Translation apps & interpreters'), text: `${a.what.en} ${a.what.es} translate traducir`, w: 12 }));
  return out;
}

// Directory data loads on first search (and is cached by the service worker for offline use).
let dirs = null;
async function directories() {
  if (dirs) return dirs;
  const [counties, places, fire, schools, ins, food] = await Promise.all(['counties', 'places', 'fire-departments', 'school-districts', 'insurers', 'cultural-food'].map((n) => loadData(n).catch(() => null)));
  const out = [];
  (counties || []).forEach((c) => out.push({ kind: 'place', href: `#county/${encodeURIComponent(c.name)}`, title: c.name, county: c.name, text: 'county condado', w: 22 }));
  (places || []).forEach(([town, , , co]) => out.push({ kind: 'town', href: `#county/${encodeURIComponent(co)}`, title: town, county: co, w: 14 }));
  (fire || []).filter((f) => f.v !== 0).forEach((f) => out.push({ kind: 'fire', href: `#fire/county/${encodeURIComponent(f.co)}`, title: f.n, county: f.co, city: f.c, zip: f.z, phone: f.p, text: `${f.c || ''} ${f.z || ''} ${f.co} fire bomberos station estacion`, w: 6 }));
  (schools || []).forEach((s) => out.push({ kind: 'school', href: '#schools', title: s.name, county: s.county, phone: s.phone, url: s.url, text: `${s.county} school escuela district distrito ${s.address || ''}`, w: 8 }));
  (ins?.records || []).forEach((r) => out.push({ kind: 'insurer', href: '#resources/insurance', title: r.name, phone: r.claimsPhone, text: `${r.ncdoiGroup || ''} ${(r.products || []).join(' ')} insurance seguro claim reclamo`, w: 8 }));
  (food?.items || []).forEach((f) => out.push({ kind: 'food', href: '#cultural-food', title: f.name, county: f.county, city: f.city, phone: f.phone, text: `${(f.types || []).join(' ')} ${f.city || ''} ${f.county || ''} ${f.address || ''} food comida pantry despensa`, w: 8 }));
  return (dirs = out);
}

// Results grouped for display. limit caps each group; the screen offers "Show all" per group.
export async function search(q) {
  const words = tokens(q); const full = norm(q);
  if (!words.length) return { words, groups: [], total: 0 };
  let extra = [];
  // A ZIP code: say which county it is in and list the fire departments there.
  const zip = /^\s*(\d{5})\s*$/.exec(q);
  const all = [...pages(), ...guides(), ...(await directories())];
  try { const com = await getCommunity(); extra = com.map((r) => ({ kind: 'guide', href: `#resources/${r.category && EN_S.some((s) => s.id === r.category) ? r.category : 'community'}`, title: r.title, sub: t('Added by verified responders'), text: `${r.body || ''} ${r.county || ''}`, phone: r.phone, w: 15 })); } catch {}
  let scored;
  if (zip) {
    const z = (await loadData('zips').catch(() => ({})))[zip[1]];
    scored = all.filter((e) => e.zip === zip[1]).map((e) => ({ e, s: 50 }));
    if (z) scored.unshift({ e: { kind: 'place', href: `#county/${encodeURIComponent(z[2])}`, title: z[2], county: z[2], zipOf: zip[1] }, s: 999 });
  } else {
    scored = [...all, ...extra].map((e) => ({ e, s: score(e, words, full) })).filter((x) => x.s > 0);
  }
  scored.sort((a, b) => b.s - a.s || a.e.title.localeCompare(b.e.title));
  const G = [['guides', ['page', 'guide']], ['places', ['place', 'town']], ['fire', ['fire']], ['schools', ['school']], ['insurers', ['insurer']], ['food', ['food']]];
  const seen = new Set();
  const groups = G.map(([id, kinds]) => ({ id, items: scored.filter(({ e }) => kinds.includes(e.kind)).map((x) => x.e).filter((e) => { const k = e.kind + '|' + e.title + '|' + (e.county || '') + '|' + (e.jump || e.href); if (seen.has(k)) return false; seen.add(k); return true; }) })).filter((g) => g.items.length);
  return { words, groups, total: groups.reduce((n, g) => n + g.items.length, 0) };
}
