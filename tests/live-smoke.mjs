// Live smoke test against a deployed site. Creates throwaway accounts and deletes them again.
// Usage: LIVE_URL=https://disaster-resources-lltd.netlify.app node tests/live-smoke.mjs
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
const BASE = (process.env.LIVE_URL || 'https://disaster-resources-lltd.netlify.app').replace(/\/$/, '');
const SHOTS = new URL('../screenshots/', import.meta.url).pathname;
const rnd = randomBytes(4).toString('hex');
const PW = 'Smoke-' + randomBytes(9).toString('base64url');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, geolocation: { latitude: 35.5951, longitude: -82.5515 }, permissions: ['geolocation'], acceptDownloads: true });
await context.addInitScript(() => { try { if (!localStorage.getItem('ncdrh.lang')) localStorage.setItem('ncdrh.lang', 'en'); } catch {} });
const page = await context.newPage();
const foreign = [], errors = [], results = {};
page.on('request', (r) => { const u = new URL(r.url()); if (u.origin !== BASE && !/^(data|blob):/.test(u.protocol)) foreign.push(r.url()); });
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', (d) => d.accept());
let n = 0; const step = (m) => console.log(`  ✓ ${++n}. ${m}`);
const go = async (h) => { await page.goto(BASE + '/#' + h); await page.waitForFunction((x) => decodeURIComponent(location.hash.slice(1)) === x && document.querySelector('main h2'), h); await page.waitForTimeout(400); };
const signUp = async (role, name, email) => {
  await go('signup'); await page.check(`input[name=role][value=${role}]`);
  await page.fill('#sn', name); await page.fill('#se', email); await page.fill('#sp', PW); await page.check('input[name=terms]');
  await page.click('button[type=submit]'); await page.waitForSelector('text=Your account is ready', { timeout: 20000 });
};
const del = async () => { await go('settings'); await page.fill('#dc', 'DELETE'); await page.click('#del'); await page.waitForSelector('text=were deleted', { timeout: 20000 }); };
const loginFails = async (email) => { await go('login'); await page.fill('#le', email); await page.fill('#lp', PW); await page.click('button[type=submit]'); await page.waitForSelector('#err:has-text("incorrect")', { timeout: 20000 }); };
const created = [];
try {
  await go('home'); await page.waitForTimeout(500);
  assert.deepEqual(await page.$$eval('.crisis a', (as) => as.map((a) => a.getAttribute('href'))), ['tel:911', 'tel:988', 'tel:211', 'tel:+18007332767']);
  await page.screenshot({ path: SHOTS + 'live-01-home.png' }); step('home loads with crisis bar');
  for (const h of ['resources', 'resources/housing', 'counties', 'phone', 'privacy', 'schools']) await go(h);
  await go('settings'); assert.match(await page.textContent('main'), /Data storage: server/); step('resource, county list, phone, privacy, schools pages load; build uses server storage');

  const A = `smoketest+${rnd}@example.com`;
  await signUp('affected', 'Smoke', A); created.push(A); step(`registered throwaway affected account ${A}`);
  await go('notes/cases'); await page.click('text=+ Add a case number'); await page.selectOption('#f_agency', 'FEMA'); await page.fill('#f_number', 'SMOKE-' + rnd); await page.click('button[type=submit]'); await page.waitForSelector('text=Saved the case number');
  await go('notes/notes'); await page.click('text=+ Write a note'); await page.fill('#f_title', 'Smoke test'); await page.fill('#f_body', 'Delete me ' + rnd); await page.click('button[type=submit]'); await page.waitForSelector('text=Delete me ' + rnd);
  step('added a case number and a note');
  await go('settings');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export')]);
  const ex = JSON.parse(await readFile(await dl.path(), 'utf8'));
  assert.equal(ex.account.email, A); assert.equal(ex.cases.length, 1); assert.equal(ex.notes.length, 1); step('export JSON has the account, 1 case, 1 note');
  await del(); await loginFails(A); created.splice(created.indexOf(A), 1); step('deleted affected account; sign-in now fails');

  const R = `smoketest+${rnd}-resp@example.com`;
  await signUp('responder', 'Smoke Responder', R); created.push(R);
  assert.ok(await page.locator('#pending-note').count()); await page.screenshot({ path: SHOTS + 'live-02-responder-pending.png' });
  await go('share'); assert.ok(await page.locator('#pending-note').count()); assert.equal(await page.locator('#c_title').count(), 0);
  step('throwaway responder is pending; share cards blocked');
  await del(); await loginFails(R); created.splice(created.indexOf(R), 1); step('deleted responder account (and its pending request); sign-in now fails');

  await go('fire'); await page.waitForSelector('#fl li'); await page.selectOption('#fc', 'Buncombe'); await page.click('#ff button[type=submit]'); await page.waitForSelector('#fsum:has-text("Buncombe County")');
  step('fire search: ' + (await page.textContent('#fsum')).trim().slice(0, 80));
  await go('county/Buncombe'); assert.ok(await page.locator('h3:has-text("Emergency Management")').count()); assert.ok(await page.locator('h3:has-text("Department of Social Services")').count());
  await page.screenshot({ path: SHOTS + 'live-03-county-buncombe.png' }); step('Buncombe county page loads (EM, DSS)');

  await go('hotels');
  // Hotels come from the bundled static list; the live Overpass check is optional and usually hidden.
  await page.click('#hloc'); results.hotelStatus = 'static list';
  await page.waitForFunction(() => document.querySelector('li.hotel') || /could not|try again|error|no /i.test(document.querySelector('main').textContent) && document.querySelector('#hsum')?.textContent, null, { timeout: 45000 }).catch(() => {});
  results.hotelCount = await page.locator('li.hotel').count();
  results.hotelSummary = ((await page.textContent('#hsum').catch(() => '')) || '').trim();
  results.hotelFirst = results.hotelCount ? (await page.locator('li.hotel h3').first().textContent()).trim() : '';
  results.hotelError = results.hotelCount ? '' : ((await page.textContent('main')).match(/[^.]*(could not|try again|error)[^.]*\./i) || [''])[0];
  if (results.hotelCount) await page.screenshot({ path: SHOTS + 'live-04-hotels.png' });
  assert.ok(results.hotelCount > 0, 'hotel results'); step(`hotel search from Asheville: ${results.hotelStatus}, ${results.hotelCount} results`);

  results.foreign = foreign; results.errors = errors;
  assert.deepEqual(foreign, []); step('no third-party requests');
} catch (e) { console.error('LIVE SMOKE FAILED at step', n + 1, e.message); await page.screenshot({ path: '/tmp/live-failed.png' }).catch(() => {}); process.exitCode = 1; }
finally { console.log(JSON.stringify({ ...results, leftover: created })); await browser.close(); }
