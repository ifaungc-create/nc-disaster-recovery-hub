// English/Spanish checks. Fails if en.js is out of date, if any Spanish key is missing or empty,
// if placeholders/HTML tags differ, or if the Spanish resource content drifts from the English.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extract, render } from '../scripts/i18n-extract.mjs';
import EN from '../src/i18n/en.js';
import ES from '../src/i18n/es.js';
import * as R from '../src/content/resources.js';
import * as RES from '../src/content/resources.es.js';
import { SOURCES, SECTIONS as HC, DONTS } from '../src/content/homecare.js';
import { ERRORS, LABELS } from '../src/i18n/errors.js';

let n = 0; const ok = (name, fn) => { fn(); n++; console.log('ok -', name); };
const vars = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
const tags = (s) => (s.match(/<[^>]+>/g) || []).join();
const phones = (s) => (String(s).match(/\b(?:1-)?\d{3}-\d{3}-\d{4}\b|\b\d{3}-[0-9A-Z]{7}\b/g) || []).sort().join();

ok('en.js is current (run node scripts/i18n-extract.mjs)', () => {
  assert.equal(readFileSync(new URL('../src/i18n/en.js', import.meta.url), 'utf8'), render(extract()));
});
ok('every key has a Spanish translation', () => {
  const missing = Object.keys(EN).filter((k) => typeof ES[k] !== 'string' || !ES[k].trim());
  assert.deepEqual(missing, [], 'missing Spanish: ' + missing.join(' | '));
});
ok('no stale Spanish keys', () => {
  const stale = Object.keys(ES).filter((k) => !(k in EN));
  assert.deepEqual(stale, [], 'stale: ' + stale.join(' | '));
});
ok('placeholders, HTML tags and phone numbers match', () => {
  for (const k of Object.keys(EN)) {
    assert.equal(vars(ES[k]), vars(k), 'vars: ' + k);
    assert.equal(tags(ES[k]), tags(k), 'tags: ' + k);
    assert.equal(phones(ES[k]), phones(k), 'phones: ' + k);
  }
});
ok('"Not verified" is "No verificado"', () => assert.equal(ES['Not verified'], 'No verificado'));
ok('server error and label texts are translated', () => {
  for (const k of [...Object.values(ERRORS || {}), ...Object.values(LABELS || {})].filter((x) => typeof x === 'string')) {
    assert.ok(ES[k] || !(k in EN), 'error text: ' + k);
  }
});
ok('resources.es.js mirrors resources.js (ids, items, phones)', () => {
  assert.equal(RES.SECTIONS.length, R.SECTIONS.length);
  R.SECTIONS.forEach((s, i) => {
    const e = RES.SECTIONS[i];
    assert.equal(e.id, s.id);
    assert.equal(e.items.length, s.items.length, 'items in ' + s.id);
    s.items.forEach((it, j) => {
      const pe = (it.phones || []).map((p) => p[1]).join();
      const ps = (e.items[j].phones || []).map((p) => p[1]).join();
      assert.equal(ps, pe, `phones in ${s.id}[${j}]`);
      assert.ok((e.items[j].links || []).length >= (it.links || []).length, `links in ${s.id}[${j}]`); // Spanish may add an official Spanish page
      for (const [, u] of e.items[j].links || []) assert.ok(/^(https:\/\/|tel:|#)/.test(u), 'link ' + u);
      assert.ok(e.items[j].title && (e.items[j].body || e.items[j].steps), `text in ${s.id}[${j}]`);
      assert.deepEqual(Object.keys(e.items[j]).sort(), Object.keys(it).sort(), `fields in ${s.id}[${j}]`);
      if (it.steps) assert.equal(e.items[j].steps.length, it.steps.length, `steps in ${s.id}[${j}]`);
    });
  });
  assert.equal(JSON.stringify(Object.keys(RES.PHONE || {})), JSON.stringify(Object.keys(R.PHONE || {})));
});
ok('home care: every point has English and Spanish, valid sources', () => {
  const all = [...HC.flatMap((s) => s.points), ...DONTS.points ?? DONTS];
  assert.ok(all.length >= 60);
  for (const p of all) {
    assert.ok(p.en && p.es, 'point text: ' + JSON.stringify(p));
    assert.ok(p.src && p.src.length, 'point has a source: ' + p.en);
    for (const id of p.src) assert.ok(SOURCES[id], 'unknown source ' + id);
  }
  for (const s of HC) { assert.ok(s.title?.en && s.title?.es, 'section title ' + s.id); for (const id of s.more || []) assert.ok(SOURCES[id]); }
  for (const [id, s] of Object.entries(SOURCES)) {
    assert.ok(s.en && s.es && /^https:\/\//.test(s.url), 'source ' + id);
    if (s.url_es) assert.ok(/^https:\/\//.test(s.url_es));
  }
});
console.log(`i18n: ${n} checks passed`);
