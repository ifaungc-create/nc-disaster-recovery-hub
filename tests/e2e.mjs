// End-to-end tests on a production build (vite preview with the local functions middleware).
// Default: the server-backed adapter (VITE_DATA_ADAPTER=remote) on Netlify Blobs via the official Blobs
// local server, in a fresh temp folder. E2E_ADAPTER=local runs the same suite on the on-device adapter.
// Mobile viewport, system Chrome, no network needed: Overpass is mocked, geolocation is simulated.
import { chromium } from 'playwright-core';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const ROOT = new URL('..', import.meta.url).pathname;
const BASE = 'http://localhost:4174';
const SHOTS = process.env.SHOTS_DIR || ROOT + 'screenshots/';
mkdirSync(SHOTS, { recursive: true });
const ADAPTER = process.env.E2E_ADAPTER === 'local' ? 'local' : 'remote';
const BLOBS = mkdtempSync(join(tmpdir(), 'ncdrh-e2e-blobs-'));
const ADMIN = 'dn22@c4iveteranservices.org';
const env = { ...process.env, VITE_DATA_ADAPTER: ADAPTER, NCDRH_BLOBS_DIR: BLOBS, NCDRH_DEV_INSECURE_SECRETS: '1', ADMIN_EMAILS: ADMIN };
// Fake Web Push service (local https, throwaway certificate) so an alert can be sent end to end without
// contacting Google/Mozilla/Apple. The functions only accept it in dev mode (NCDRH_TEST_PUSH_ORIGIN).
const pushGot = []; let pushSrv = null;
if (ADAPTER === 'remote') {
  const https = await import('node:https'); const { readFileSync } = await import('node:fs');
  execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout ${BLOBS}/k.pem -out ${BLOBS}/c.pem -days 1 -subj /CN=localhost`, { stdio: 'ignore' });
  pushSrv = https.createServer({ key: readFileSync(BLOBS + '/k.pem'), cert: readFileSync(BLOBS + '/c.pem') }, (q, r) => { const c = []; q.on('data', (d) => c.push(d)); q.on('end', () => { pushGot.push({ url: q.url, headers: q.headers, len: Buffer.concat(c).length }); r.statusCode = 201; r.end(); }); });
  await new Promise((r) => pushSrv.listen(0, '127.0.0.1', r));
  const { default: webpush } = await import('web-push'); const v = webpush.generateVAPIDKeys();
  Object.assign(env, { NCDRH_TEST_PUSH_ORIGIN: `https://localhost:${pushSrv.address().port}`, NODE_TLS_REJECT_UNAUTHORIZED: '0', VAPID_PUBLIC_KEY: v.publicKey, VAPID_PRIVATE_KEY: v.privateKey });
}
delete env.APP_SESSION_SECRET; delete env.DATA_ENCRYPTION_KEY;
if (!process.env.SKIP_BUILD) execSync('npx vite build', { cwd: ROOT, stdio: 'ignore', env });
const server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true, env });
console.log(`E2E on the ${ADAPTER === 'remote' ? 'server adapter (Netlify Blobs local server, ' + BLOBS + ')' : 'on-device adapter'}`);
const stop = () => { try { process.kill(-server.pid); } catch {} try { pushSrv?.close(); } catch {} rmSync(BLOBS, { recursive: true, force: true }); };
for (let i = 0; i < 60; i++) { try { await fetch(BASE); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }

const ASHEVILLE = { latitude: 35.5951, longitude: -82.5515 };
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, geolocation: ASHEVILLE, permissions: ['geolocation'], acceptDownloads: true });
// Existing checks run in English; the language picker and Spanish mode are tested in their own profile below.
const EN_FIRST = () => { try { if (!localStorage.getItem('ncdrh.lang')) localStorage.setItem('ncdrh.lang', 'en'); } catch {} };
await context.addInitScript(EN_FIRST);
const page = await context.newPage();
const errors = [], foreign = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('request', (r) => { const u = new URL(r.url()); if (u.origin !== BASE && !u.protocol.startsWith('data') && !u.protocol.startsWith('blob')) foreign.push(r.url()); });
page.on('dialog', (d) => d.accept());

let overpassBody = null;
await page.route('**/.netlify/functions/overpass', async (route) => {
  overpassBody = JSON.parse(route.request().postData());
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [
    { id: 'node/1', name: 'Riverside Motel (mock)', kind: 'motel', la: overpassBody.lat + 0.02, lo: overpassBody.lon, phone: '+1 910-555-0142', website: 'https://example.org', addr: '1 River Rd, Wilmington, 28401' },
    { id: 'node/2', name: 'Harbor Hotel (mock)', kind: 'hotel', la: overpassBody.lat + 0.001, lo: overpassBody.lon + 0.001, phone: '', website: '', addr: '' },
  ] }) });
});

let n = 0; const step = (m) => console.log(`  ✓ ${++n}. ${m}`);
const shot = (name) => page.screenshot({ path: SHOTS + name + '.png', fullPage: false });
const shotAt = async (name, sel) => { await page.evaluate((q) => { const el = document.querySelector(q); window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 150); }, sel); await shot(name); };
const go = async (hash) => { await page.goto(BASE + '/#' + hash); await page.waitForSelector('main h2'); };
const signUp = async (role, name, email, org = '') => {
  await go('signup'); await page.check(`input[name=role][value=${role}]`);
  if (org) await page.fill('#so', org);
  await page.fill('#sn', name); await page.fill('#se', email); await page.fill('#sp', 'correct-horse-9'); await page.check('input[name=terms]');
  await page.click('button[type=submit]'); await page.waitForSelector('text=Your account is ready');
};
const login = async (email) => { await go('login'); await page.fill('#le', email); await page.fill('#lp', 'correct-horse-9'); await page.click('button[type=submit]'); await page.waitForSelector('text=Hi,', { timeout: 10000 }).catch(async (e) => { console.log('login failed; page says:', (await page.textContent('main')).slice(0, 300)); throw e; }); };
const logout = async () => { await go('settings'); await page.click('#logout'); await page.waitForSelector('text=You are signed out'); };

try {
  // ---- public home + crisis bar
  await go('home');
  const crisis = await page.$$eval('.crisis a', (as) => as.map((a) => a.getAttribute('href')));
  assert.deepEqual(crisis, ['tel:911', 'tel:988', 'tel:211', 'tel:+18007332767']);
  await shot('01-home'); step('home renders with crisis bar 911 / 988 / 211 / 1-800-RED-CROSS');
  // ---- branding, contact, disclaimer
  const TAG = 'A project of C4I Veteran Services Corp.', MAIL = 'mailto:info@c4iveteranservices.org';
  const DISC = 'None of the organizations or agencies listed in this app, whether government or private, are affiliated with this app or with C4I Veteran Services Corp. This app serves as a research and referral platform to help you recover from a disaster. We have done our best to confirm all information and keep it up to date, but information changes. Please let us know if a number does not work or a link is broken: info@c4iveteranservices.org.';
  assert.equal((await page.textContent('header .brand')).trim(), 'NC Disaster Recovery Hub' + TAG);
  assert.match(await page.textContent('footer'), new RegExp('NC Disaster Recovery Hub · ' + TAG.replace(/\./g, '\\.')));
  assert.equal((await page.textContent('#footcontact')).trim(), 'Problems with the app? Email info@c4iveteranservices.org'); assert.equal(await page.getAttribute('#footcontact a', 'href'), MAIL);
  assert.match(await page.textContent('#homedisc'), /not affiliated with this app or with C4I Veteran Services Corp/); assert.ok(await page.locator('#homedisc a[href="#about"]').count());
  assert.equal(await page.getAttribute('meta[name=description]', 'content'), 'Help after fires, floods and hurricanes in North Carolina. ' + TAG);
  const mf = await (await fetch(BASE + '/manifest.webmanifest')).json(); assert.equal(mf.name, 'NC Disaster Recovery Hub'); assert.ok(mf.description.endsWith(TAG));
  step('header, footer, meta and manifest carry the name and "A project of C4I Veteran Services Corp."; footer contact mailto; short disclaimer on home');
  await page.click('footer a[href="#about"]'); await page.waitForSelector('h2:has-text("About & disclaimer")');
  assert.equal((await page.textContent('#disclaimer p')).trim(), DISC); assert.equal(await page.getAttribute('#disclaimer a', 'href'), MAIL);
  assert.match(await page.textContent('#aboutcontact'), /Problems with the app\? Email info@c4iveteranservices\.org/); assert.match(await page.textContent('main .brandline'), new RegExp(TAG.replace(/\./g, '\\.')));
  await shot('20-about-disclaimer'); step('About & disclaimer page (from the footer) has the exact disclaimer wording and contact');
  for (const h of ['login', 'signup', 'privacy']) { await go(h); assert.match(await page.textContent('main .brandline'), /NC Disaster Recovery Hub · A project of C4I Veteran Services Corp\./); }
  assert.ok(await page.locator('main a[href="#about"]').count()); step('tagline on sign-in, sign-up and privacy; disclaimer linked from privacy');
  await go('signup'); assert.equal(await page.getAttribute('#signupdisc', 'href'), '#about'); step('sign-up links to the disclaimer');
  await go('settings'); assert.match(await page.textContent('#settingscontact'), /Problems with the app\? Email info@c4iveteranservices\.org/); step('Settings shows the app-problems contact');
  await go('resources/legal'); await page.waitForSelector('h2:has-text("Free legal help")'); const rl = page.locator('[data-report]').first(); const rname = await rl.getAttribute('data-report');
  assert.equal(await rl.getAttribute('href'), MAIL + '?subject=' + encodeURIComponent('Broken link or number: ' + rname) + '&body=' + encodeURIComponent('Item: ' + rname + '\nWhat is wrong (number does not work, link broken, closed…):\n'));
  await go('county/Wake'); await page.waitForSelector('a[data-report="Wake County Emergency Management"]'); assert.ok(await page.locator('a[data-report="Wake County Department of Social Services (DSS)"]').count());
  await go('fire/county/Wake'); await page.waitForSelector('#fl li.fd [data-report]'); assert.equal(await page.locator('#fl li.fd').count(), await page.locator('#fl li.fd [data-report]').count());
  step('"Report a broken link or number" mailto with the item name in the subject on resource, county and fire entries');

  // ---- signup: person affected
  await go('signup'); await shot('02-signup');
  await page.click('button[type=submit]'); await page.waitForFunction(() => document.querySelector('#err').textContent.length > 0); assert.match(await page.textContent('#err'), /name|email|privacy/i); step('signup validates input');
  await signUp('affected', 'Jordan Lee', 'jordan@example.org');
  assert.match(await page.textContent('main'), /Person affected by a disaster/); step('register as "Person affected by a disaster" (instant access)');

  // ---- case numbers CRUD
  await go('notes/cases'); await page.click('text=+ Add a case number');
  await page.selectOption('#f_agency', 'FEMA'); await page.fill('#f_number', '4827-1193'); await page.fill('#f_contactName', 'FEMA helpline');
  await page.fill('#f_phone', '1-800-621-3362'); await page.fill('#f_opened', '2026-10-01'); await page.fill('#f_nextDate', '2026-11-03'); await page.fill('#f_details', 'Inspection scheduled.');
  await page.click('button[type=submit]'); await page.waitForSelector('text=Saved the case number');
  await page.click('text=+ Add a case number'); await page.selectOption('#f_agency', 'Insurance claim'); await page.fill('#f_agencyOther', 'Example Mutual'); await page.fill('#f_number', 'CLM-0099'); await page.click('button[type=submit]');
  await page.waitForSelector('text=CLM-0099'); assert.equal(await page.locator('#items > li').count(), 2); step('create case numbers (FEMA, insurance claim)');
  await page.locator('#items > li', { hasText: '4827-1193' }).locator('text=Edit').click();
  await page.fill('#f_number', '4827-1194'); await page.click('button[type=submit]'); await page.waitForSelector('text=4827-1194');
  assert.equal(await page.locator('text=4827-1193').count(), 0); step('edit a case number');
  await shot('03-case-numbers');
  await page.locator('#items > li', { hasText: 'CLM-0099' }).locator('button:has-text("Delete")').click(); await page.waitForSelector('text=Deleted the case number');
  assert.equal(await page.locator('#items > li').count(), 1); step('delete a case number');

  // ---- free-form notes CRUD
  await go('notes/notes'); await page.click('text=+ Write a note'); await page.fill('#f_title', 'Call list'); await page.fill('#f_body', 'Ask landlord about deposit.');
  await page.click('button[type=submit]'); await page.waitForSelector('text=Ask landlord about deposit.');
  await page.click('text=Edit'); await page.fill('#f_body', 'Ask landlord about deposit and lease.'); await page.click('button[type=submit]'); await page.waitForSelector('text=deposit and lease');
  await page.click('button:has-text("Delete")'); await page.waitForSelector('text=Deleted the note'); step('notes: create, edit, delete');

  // ---- referral tracker
  await go('notes/referrals'); await page.click('text=+ Add a referral');
  await page.fill('#f_by', 'Red Cross caseworker'); await page.fill('#f_to', 'Legal Aid of NC'); await page.fill('#f_what', 'FEMA appeal'); await page.selectOption('#f_status', 'not_started'); await page.fill('#f_followUp', '2026-10-29');
  await page.click('button[type=submit]'); await page.waitForSelector('text=Saved the referral');
  await page.click('text=+ Add a referral'); await page.fill('#f_to', 'NCWorks Career Center'); await page.selectOption('#f_status', 'contacted'); await page.click('button[type=submit]'); await page.waitForSelector('text=NCWorks Career Center');
  const legal = page.locator('#items > li', { hasText: 'Legal Aid of NC' });
  await legal.locator('select').selectOption('waiting'); await page.waitForSelector('text=Status updated');
  assert.equal(await page.locator('#items > li', { hasText: 'Legal Aid of NC' }).locator('.badge.s-waiting').count(), 1); step('referral tracker: add, change status to waiting');
  await page.locator('#items > li', { hasText: 'NCWorks' }).locator('text=Edit').click(); await page.selectOption('#f_status', 'done'); await page.click('button[type=submit]');
  await page.waitForSelector('text=1 open, 1 done'); await shotAt('04-referrals', '#items'); step('referral tracker: edit to done, open/done summary');
  await logout();

  // ---- signup: responder + share card
  await signUp('responder', 'Sam Rivera', 'sam@relief.example', 'Example Relief Team');
  assert.match(await page.textContent('main'), /Disaster responder/); step('register as "Disaster responder"');
  if (ADAPTER === 'remote') {
    // Responder starts as "pending": no share cards or submissions until an admin approves.
    assert.match(await page.textContent('main'), /responder request was sent/); assert.ok(await page.locator('#pending-note').count());
    assert.equal(await page.locator('text=Create a share card for a client').count(), 0);
    await go('share'); assert.ok(await page.locator('#pending-note').count()); assert.equal(await page.locator('#c_title').count(), 0);
    await go('submit'); assert.ok(await page.locator('#pending-note').count()); assert.equal(await page.locator('#s_title').count(), 0);
    await shot('05a-responder-pending'); step('new responder is pending: share cards and submissions blocked');
    await logout();
    // Admin (in ADMIN_EMAILS) signs up and approves.
    await signUp('affected', 'Admin', ADMIN); assert.ok(await page.locator('#adminlink').count());
    await page.click('#adminlink'); await page.waitForSelector('h3:has-text("Waiting for approval (1)")');
    const req = page.locator('[data-resp]', { hasText: 'Sam Rivera' }); assert.match(await req.textContent(), /sam@relief\.example[\s\S]*requested/);
    assert.doesNotMatch(await page.textContent('main'), /jordan|4827|Legal Aid of NC/i); await shot('15-admin-responders');
    await req.locator('button[data-act=approve]').click(); await page.waitForSelector('text=Responder approved.');
    assert.match(await page.textContent('main'), /Approved responders \(1\)[\s\S]*Sam Rivera/); step('admin (ADMIN_EMAILS) sees the request and approves the responder');
    await logout(); await login('sam@relief.example'); assert.equal(await page.locator('#pending-note').count(), 0);
  }
  await page.click('text=Create a share card for a client');
  await page.fill('#c_title', 'Your caseworker'); await page.fill('#c_phone', '919-555-0101'); await page.fill('#c_details', 'Call me after your inspection.');
  await page.click('button[type=submit]'); await page.waitForSelector('#qr svg');
  const code = (await page.textContent('#code')).trim(); assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  await shot('05-share-card'); step(`responder creates share card with QR + code ${code}`);
  if (ADAPTER === 'remote') {
    // A second phone: fresh browser profile, nothing in storage. The typed code resolves on the server.
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx2.addInitScript(EN_FIRST); const p2 = await ctx2.newPage();
    await p2.goto(BASE + '/#claim/' + code.replace('-', '')); await p2.waitForSelector('text=Save this information?');
    assert.match(await p2.textContent('main'), /Example Relief Team/); assert.equal(await p2.locator('#consent').count(), 0);
    await p2.click('a[href="#login"][data-after]'); await p2.fill('#le', 'jordan@example.org'); await p2.fill('#lp', 'correct-horse-9'); await p2.click('button[type=submit]');
    await p2.waitForSelector('#consent'); await p2.check('#consent'); await p2.click('text=Save to my notes'); await p2.waitForSelector('text=Saved to your notes');
    assert.match(await p2.textContent('#items'), /919-555-0101/);
    await p2.goto(BASE + '/#notes/notes'); await p2.waitForSelector('#items'); await ctx2.close();
    step('code typed on a different phone resolves server-side; sign-in, consent, saved');

    // ---- approved responder submits two records; admin edits+approves one and rejects the other
    const fill = async (r) => { for (const [k, v] of Object.entries(r)) { if (['kind', 'category', 'county'].includes(k)) await page.selectOption('#s_' + k, v); else await page.fill('#s_' + k, v); } };
    await go('submit');
    await page.click('button[type=submit]'); await page.waitForFunction(() => document.querySelector('#err').textContent.length > 0); assert.match(await page.textContent('#err'), /kind/i);
    await fill({ kind: 'shelter', category: 'housing', county: 'Buncombe', title: 'Test Shelter A', description: 'Overnight beds for families.', phone: '828-555-0199', sourceUrl: 'https://example.org/shelter-a' });
    await page.click('button[type=submit]'); await page.waitForSelector('text=An administrator will review it');
    await fill({ kind: 'phone', category: 'legal', county: 'Statewide', title: 'Bad Record B', phone: '800-555-0100', sourceUrl: 'https://example.org/b' });
    await page.click('button[type=submit]'); await page.waitForSelector('#mine li:nth-child(2)');
    assert.equal(await page.locator('#mine .badge.s-waiting').count(), 2); await shot('16-submit-record'); step('approved responder submits two records (both waiting for review)');
    await go('resources/housing'); assert.equal(await page.locator('text=Test Shelter A').count(), 0); step('pending records are not public');
    await logout(); await login(ADMIN);
    await go('admin/submissions'); await page.waitForSelector('h3:has-text("Waiting for review (2)")');
    const fa = page.locator('form[data-sub]').filter({ has: page.locator('input[name=title][value="Test Shelter A"]') });
    const fb = page.locator('form[data-sub]').filter({ has: page.locator('input[name=title][value="Bad Record B"]') });
    await fa.locator('input[name=title]').fill('Riverside Family Shelter'); await shotAt('17-admin-review', 'form[data-sub]');
    await fa.locator('button[data-act=approve]').click(); await page.waitForSelector('text=Edited and approved');
    await page.locator('form[data-sub] input[name=_reason]').fill('Could not verify number'); await fb.locator('button[data-act=reject]').click(); await page.waitForSelector('text=Rejected. It will not be shown.');
    assert.match(await page.textContent('main'), /Waiting for review \(0\)/); step('admin edits + approves one record, rejects the other with a reason');
    await go('admin/audit'); const log = await page.textContent('#audit');
    assert.match(log, /submission\.reject[\s\S]*submission\.approve\.edited[\s\S]*responder\.approve/); assert.match(log, new RegExp(ADMIN)); assert.doesNotMatch(log, /jordan|Riverside|828-555/i);
    await shot('18-admin-log'); step('admin actions logged (who, what, when), no client or record details');
    await go('admin/published'); assert.match(await page.textContent('main'), /Published records \(1\)[\s\S]*Riverside Family Shelter/);
    await logout();
    // ---- public: approved record merged into the resource list and the county page, labeled; rejected never shows
    await go('resources/housing'); await page.waitForSelector('[data-community]');
    const card = await page.textContent('[data-community]'); assert.match(card, /Riverside Family Shelter[\s\S]*828-555-0199/);
    assert.match(card, /Added by a verified responder, approved [A-Z][a-z]{2} \d{1,2}, \d{4}/); await shotAt('19-community-record', '[data-community]');
    step('approved record shows on the Housing page with "Added by a verified responder, approved <date>"');
    await go('county/Buncombe'); assert.match(await page.textContent('[data-community]'), /Riverside Family Shelter/); step('approved record shows on its county page');
    for (const h of ['resources/legal', 'resources/community', 'county/Wake']) { await go(h); assert.doesNotMatch(await page.textContent('main'), /Bad Record B|Test Shelter A/); }
    assert.match(await (await go('resources/community'), page.textContent('main')), /Riverside Family Shelter/); step('rejected record (and the pre-edit title) never shows anywhere');
    await login('sam@relief.example'); await go('submit');
    assert.match(await page.textContent('#mine'), /Not approved[\s\S]*Reason: Could not verify number/); assert.match(await page.textContent('#mine'), /Riverside Family Shelter[\s\S]*Approved|Approved[\s\S]*Riverside Family Shelter/);
    step('responder sees approved / not approved with the reason');
  }
  await logout();

  // ---- claim by code (consent required)
  await page.goto(BASE + '/#login'); await page.fill('#le', 'jordan@example.org'); await page.fill('#lp', 'correct-horse-9'); await page.click('button[type=submit]'); await page.waitForSelector('text=Hi, Jordan');
  await go('claim'); await page.fill('#cc', code.toLowerCase()); await page.click('text=Look up code'); await page.waitForSelector('text=Save this information?');
  await page.click('text=Save to my notes'); await page.waitForFunction(() => document.querySelector('#err').textContent.length > 0); assert.match(await page.textContent('#err'), /confirm/i);
  await page.check('#consent'); await shot('06-claim-consent'); await page.click('text=Save to my notes'); await page.waitForSelector('text=Saved to your notes');
  assert.match(await page.textContent('#items'), /Example Relief Team[\s\S]*919-555-0101/); step('client enters code, consents, card saved to private notes');
  // QR path: card data travels in the URL fragment, so it works on any device
  const payload = Buffer.from(JSON.stringify({ v: 1, c: '', x: '2099-01-01', k: { org: 'County DSS', contact: 'Ms. Diaz', phone: '828-555-0177' } })).toString('base64url');
  await page.goto(BASE + '/#claim/d/' + payload); await page.waitForSelector('text=County DSS'); await page.check('#consent'); await page.click('text=Save to my notes'); await page.waitForSelector('text=Saved to your notes'); assert.match(await page.textContent('#items'), /Ms. Diaz/);
  step('QR link (data in URL fragment) claimed with consent');

  // ---- fire department search
  await go('fire'); await page.waitForSelector('#fl li');
  await page.selectOption('#fc', 'Wake'); await page.click('#ff button[type=submit]'); await page.waitForSelector('#fsum:has-text("Wake County")');
  const wake = await page.$$eval('#fl li.fd > p.small:not(.report)', (e) => e.map((x) => x.textContent));
  assert.ok(wake.length > 10 && wake.every((t) => t.includes('Wake County'))); step(`fire search by county (Wake: ${(await page.textContent('#fsum')).split(' ')[0]} results)`);
  await page.selectOption('#fc', ''); await page.fill('#fq', '28801'); await page.click('#ff button[type=submit]'); await page.waitForSelector('#fsum:has-text("ZIP 28801")');
  const first = await page.textContent('#fl li.fd'); assert.match(first, /28801/); assert.match(await page.textContent('#fl li.fd .dist'), /mi/);
  await shotAt('07-fire-zip', '#fsum'); step('fire search by ZIP 28801 (in-ZIP first, distance shown)');
  await page.fill('#fq', 'Boone'); await page.click('#ff button[type=submit]'); await page.waitForSelector('#fl li.fd');
  assert.match(await page.textContent('#fl'), /Boone/); step('fire search by name/city (Boone)');
  await page.fill('#fq', 'Gumtree'); await page.click('#ff button[type=submit]'); await page.waitForSelector('#fl li.fd:has-text("Midway")');
  assert.match(await page.textContent('#fl li.fd'), /Midway Fire & Rescue Department, Inc\. \(Gumtree Station\)/); assert.equal(await page.locator('#fl li.fd:has-text("Gumtree") .badge.verify').count(), 0); step('merged fire department: "Gumtree" finds the Midway (Gumtree Station) listing, verified');
  await page.fill('#fq', 'Drexel'); await page.click('#ff button[type=submit]'); await page.waitForSelector('#fl li.fd:has-text("Drexel Fire Department")');
  assert.match(await page.textContent('#fl li.fd:has-text("Drexel Fire Department")'), /Burke County/); step('Burke department numbered 50-99 (Drexel 01266) is listed');
  await page.fill('#fq', 'Raft Swamp'); await page.click('#ff button[type=submit]'); await page.waitForSelector('#fl li.fd:has-text("Raft Swamp")');
  assert.match(await page.textContent('#fl li.fd:has-text("Raft Swamp")'), /Not verified[\s\S]*Closing in 2026/); step('closing department (Raft Swamp) keeps "Not verified" plus a closing note');
  await page.fill('#fq', ''); await page.click('#locme'); await page.waitForSelector('#fsum:has-text("nearest to your location")');
  assert.match(await page.textContent('#fl li.fd .small'), /Buncombe/); step('fire: sort by distance from (simulated) device location');

  // ---- location → county, county page
  await go('counties'); await page.click('#locme'); await page.waitForSelector('h2:has-text("Buncombe County")');
  assert.ok(await page.locator('text=Your county').count()); step('"Use my location" resolves county on-device (Buncombe)');
  assert.ok(await page.locator('h3:has-text("Emergency Management")').count()); assert.ok(await page.locator('h3:has-text("Department of Social Services")').count());
  assert.ok(await page.locator('h3:has-text("Health Department")').count()); assert.ok(await page.locator('h3:has-text("Register of Deeds")').count());
  assert.ok(await page.locator('#fd a.tel').count() >= 1); await shot('08-county-buncombe'); step('county page shows EM, DSS, health, Register of Deeds, fire departments');
  await go('county/Bertie'); await page.waitForSelector('h2:has-text("Bertie County")'); assert.equal(await page.locator('.badge.verify').count(), 0);
  assert.ok(await page.locator('a[href="http://bertiecounty.nc.gov/departments/em/em.html"]').count() >= 1); step('Bertie: corrected links, kept on http (site has no working https), no "Not verified" badge');
  await go('county/Washington'); await page.waitForSelector('h2:has-text("Washington County")'); assert.ok(await page.locator('.badge.verify').count() >= 1); assert.match(await page.textContent('.badge.verify'), /^Not verified$/);
  assert.match(await page.textContent('main'), /Washington County Emergency Management \(no county fire marshal listed\)/); step('Washington: fire-report contact is county EM, marked "Not verified"');
  await go('home'); assert.match(await page.textContent('main'), /Your county: Buncombe/); step('home shows saved county first');

  // ---- hotels: on-device search over /data/hotels.json; the live check is optional (Overpass mocked)
  await go('hotels'); await page.fill('#hq', '28401'); await page.click('#hf button[type=submit]'); await page.waitForSelector('li.hotel');
  const nH = await page.locator('li.hotel').count(); assert.ok(nH >= 5, 'hotels near 28401: ' + nH); assert.equal(overpassBody, null, 'on-device search sends nothing');
  const dists = await page.$$eval('li.hotel .dist', (e) => e.map((x) => parseFloat(x.textContent))); assert.deepEqual(dists, [...dists].sort((x, y) => x - y));
  assert.ok(await page.locator('li.hotel >> a:has-text("Directions")').count() === nH); assert.match(await page.textContent('main'), /OpenStreetMap data as of 2026-10-2\d/);
  await shotAt('09-hotels', '#hsum'); step(`hotel search by ZIP 28401 on the device: ${nH} results, nearest first, nothing sent`);
  // map listing buttons: plain links on every result, correct URLs, nothing fetched
  assert.equal(await page.locator('li.hotel a.gmaps').count(), nH); assert.equal(await page.locator('li.hotel a.amaps').count(), nH);
  assert.equal(await page.locator('li.hotel:has-text("Call ahead to confirm availability and price.")').count(), nH);
  const firstH = page.locator('li.hotel').first(); const gUrl = new URL(await firstH.locator('a.gmaps').getAttribute('href')), aUrl = new URL(await firstH.locator('a.amaps').getAttribute('href'));
  const hName = (await firstH.locator('h3').textContent()).trim();
  assert.equal(gUrl.origin + gUrl.pathname, 'https://www.google.com/maps/search/'); assert.equal(gUrl.searchParams.get('api'), '1'); assert.ok(gUrl.searchParams.get('query').startsWith(hName + ', ')); assert.match(gUrl.searchParams.get('query'), /\bNC\b/);
  assert.equal(aUrl.origin + aUrl.pathname, 'https://maps.apple.com/'); assert.ok(aUrl.searchParams.get('q').startsWith(hName)); assert.match(aUrl.searchParams.get('sll'), /^3[3-6]\.\d+,-7[5-9]\.\d+|^3[3-6]\.\d+,-8[0-4]\.\d+/);
  for (const a of await page.$$('li.hotel a.gmaps, li.hotel a.amaps, #hgoog, #happl')) { assert.equal(await a.getAttribute('target'), '_blank'); assert.equal(await a.getAttribute('rel'), 'noopener noreferrer'); }
  assert.equal(await page.locator('link[rel=prefetch], link[rel=preconnect], link[rel=dns-prefetch]').count(), 0);
  const area = new URL(await page.getAttribute('#hgoog', 'href')); assert.equal(area.searchParams.get('query'), 'hotels near 28401, NC'); assert.match(await page.textContent('#hgoog'), /Search hotels near 28401 on Google Maps/);
  assert.match(await page.getAttribute('#happl', 'href'), /^https:\/\/maps\.apple\.com\/\?q=hotels&sll=34\.\d{2},-77\.\d{2}$/);
  assert.equal(overpassBody, null); step('hotel results: Google Maps + Apple Maps listing buttons on every result, "Call ahead" label, area search links (no prefetch, nothing sent)');
  assert.match(await page.textContent('#tsa'), /Transitional Sheltering Assistance/); assert.ok(await page.locator('#tsa a[href="https://www.femaemergencyhotels.com/"]').count()); assert.ok(await page.locator('#tsa a[href="tel:211"]').count()); step('Disaster hotel help note: FEMA TSA, hotel lookup, Red Cross, NC 211');
  assert.equal(await page.locator('#hlive').count(), 0); assert.equal(overpassBody, null); step('live-map hotel check is hidden (config flag off by default)');
  overpassBody = null; await page.click('#hloc'); await page.waitForFunction(() => document.querySelector('#hsum')?.textContent.includes('your location'));
  assert.ok(await page.locator('li.hotel').count() >= 5); assert.equal(overpassBody, null); step('hotel search from device location runs on the device (nothing sent)');
  assert.match(await page.getAttribute('#hgoog', 'href'), /query=hotels%20near%20-?\d+\.\d{2}%2C-?\d+\.\d{2}$/); assert.match(await page.textContent('#hgoog'), /Search hotels near me on Google Maps/); step('"Search hotels near me" uses the position rounded to about 1 km');

  // ---- static pages
  await go('phone'); assert.match(await page.textContent('main'), /Lifeline[\s\S]*TextNow[\s\S]*Google Voice/); await shot('10-phone'); step('free phone number page');
  await go('resources/boardup'); assert.match(await page.textContent('.card.warn'), /assignment of benefits/i); await shotAt('11-boardup-warning', '.card.warn'); step('board-up page warning');
  await go('resources/documents'); await shot('12-documents'); await go('resources/insurance'); await page.waitForSelector('#inslist li.ins'); assert.match(await page.textContent('main'), /alphabetical/); step('documents + insurance guides');
  // ---- insurance claim phone directory
  const insAll = await page.locator('#inslist li.ins').count(); assert.equal(insAll, 60);
  const insNames = await page.$$eval('#inslist li.ins h3', (h) => h.map((x) => x.firstChild.textContent.trim())); assert.deepEqual(insNames, [...insNames].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
  const top = await page.textContent('#insdir');
  for (const t of ['Have your policy number ready.', 'Flood damage is usually NOT covered by homeowners or renters insurance.', 'NC Insurance Guaranty Association', '1-855-408-1212', 'Numbers checked Oct 22, 2026', 'not an endorsement']) assert.ok(top.includes(t), t);
  assert.ok(!(await page.textContent('main')).includes('Homeowners insurance companies in North Carolina'), 'old insurer list merged away');
  await page.fill('#insq', 'State Farm'); const sf = page.locator('#inslist li.ins:not(.hide)'); assert.equal(await sf.count(), 1);
  assert.match(await sf.textContent(), /State Farm[\s\S]*24\/7[\s\S]*Call to file a claim/); assert.equal(await sf.locator('a.btn.call').getAttribute('href'), 'tel:+18007325246');
  assert.ok(await sf.locator('a:has-text("File a claim online")').count()); assert.match(await sf.locator('p.report a').getAttribute('href'), /^mailto:info@c4iveteranservices\.org\?subject=Broken%20link%20or%20number%3A%20State%20Farm/);
  await shotAt('21-insurance-state-farm', '#insdir'); step('insurance directory: search "State Farm" -> 1 card, tel:+18007325246, online claim, report link');
  await page.fill('#insq', ''); await page.selectOption('#insp', 'flood'); const fl = page.locator('#inslist li.ins:not(.hide)'); const nFl = await fl.count(); assert.ok(nFl >= 5 && nFl < insAll);
  const flNames = await fl.locator('h3').allTextContents(); assert.ok(flNames.some((n) => /National Flood Insurance Program/.test(n))); assert.ok(!flNames.some((n) => /^State Farm/.test(n)));
  const nfip = page.locator('#inslist li.ins:not(.hide):has-text("National Flood Insurance Program")');
  assert.equal(await nfip.locator('a.btn.call').getAttribute('href'), 'tel:+18006386620'); assert.match(await nfip.locator('a.btn.call').textContent(), /policies bought directly from NFIP/);
  assert.equal(await nfip.locator('a:has-text("Help finding your flood insurer")').getAttribute('href'), 'tel:+18773362627');
  assert.ok(!(await page.textContent('#inslist')).includes('427-4661'), 'unverified NFIP number left out');
  const telHrefs = await page.$$eval('#inslist a[href^="tel:"]', (a) => a.map((x) => x.getAttribute('href'))); assert.ok(telHrefs.length > 60 && telHrefs.every((h) => /^tel:\+1\d{10}$/.test(h)), 'all claim links are tel:+1 and 10 digits');
  step(`insurance directory: flood filter -> ${nFl} companies; NFIP tel:+18006386620 and tel:+18773362627; every tel link well-formed`);
  await page.selectOption('#insp', ''); await page.fill('#insq', 'safeco'); assert.match(await page.textContent('#inslist li.ins:not(.hide)'), /Liberty Mutual's claims line/);
  await page.fill('#insq', 'allied'); assert.ok((await page.locator('#inslist li.ins:not(.hide)').allTextContents()).some((t) => /Allied \(AMCO\) policies use this Nationwide line/.test(t)));
  await page.fill('#insq', 'USAA'); assert.match(await page.textContent('#inslist li.ins:not(.hide)'), /Call customer service[\s\S]*No separate claims line listed; ask for claims/); await page.fill('#insq', '');
  step('insurance directory: shared-number notes (Safeco, Allied) and general-line wording (USAA)');
  await go('schools'); assert.ok((await page.locator('#slist li').count()) >= 115); step('school districts list');
  await go('privacy'); await shot('13-privacy'); step('privacy page');

  // ---- settings: export + delete
  await go('settings'); await shot('14-settings');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export')]);
  const exported = JSON.parse(await (await import('node:fs/promises')).readFile(await dl.path(), 'utf8'));
  assert.equal(exported.cases.length, 1); assert.equal(exported.referrals.length, 2); assert.equal(exported.notes.length, ADAPTER === 'remote' ? 3 : 2); step('export my data (JSON download)');
  await page.click('#del'); assert.match(await page.textContent('#derr'), /DELETE/); await page.fill('#dc', 'DELETE'); await page.click('#del'); await page.waitForSelector('text=were deleted');
  await go('login'); await page.fill('#le', 'jordan@example.org'); await page.fill('#lp', 'correct-horse-9'); await page.click('button[type=submit]'); await page.waitForSelector('#err:has-text("incorrect")'); step('delete account (cannot sign in afterwards)');
  await go('notes'); await page.waitForSelector('text=Please sign in'); step('private routes require sign-in');

  // ---- new tiles (English): cultural food + home care
  await go('home');
  assert.ok(await page.locator('.tile.new[href="#cultural-food"]').count() && await page.locator('.tile.new[href="#home-care"]').count());
  await page.click('.tile[href="#cultural-food"]'); await page.waitForSelector('#cfout li.food');
  const allN = Number((await page.textContent('#cfsum')).match(/\d+/)[0]); assert.ok(allN >= 50, 'cultural food count ' + allN);
  const cfHeads = await page.$$eval('#cfout > h3', (hs) => hs.map((h) => h.id)); assert.deepEqual(cfHeads, ['cf-free', 'cf-banks', 'cf-stores'], 'free first, then food banks, then stores');
  assert.equal(await page.locator('#cf-banks + p + ul li').count() >= 7, true);
  assert.match(await page.textContent('main .note'), /Call ahead\./);
  await shot('live-18-cultural-food-en');
  await page.selectOption('#cft', 'halal'); const halN = Number((await page.textContent('#cfsum')).match(/\d+/)[0]); assert.ok(halN > 0 && halN < allN);
  for (const li of await page.$$('#cfout li.food')) assert.match(await li.textContent(), /Halal/);
  await page.selectOption('#cfk', 'free'); assert.equal(await page.locator('#cf-stores').count(), 0);
  await page.selectOption('#cft', 'kosher'); await page.selectOption('#cfk', 'store'); await page.waitForSelector('#cf-stores'); assert.equal(await page.locator('#cf-free').count(), 0);
  await page.selectOption('#cft', ''); await page.selectOption('#cfk', ''); await page.fill('#cfq', 'Charlotte'); assert.ok(Number((await page.textContent('#cfsum')).match(/\d+/)[0]) > 0);
  await page.fill('#cfq', 'zzzz-no-such-place'); assert.match(await page.textContent('#cfout'), /No free food places match/);
  await page.fill('#cfq', ''); await page.selectOption('#cft', 'halal'); await shotAt('live-19-cultural-food-halal-filter', '#cff');
  step(`cultural food: ${allN} places; free food, then 7 food banks, then stores by region; type / free-or-store / text filters work`);
  await go('home'); await page.click('.tile[href="#home-care"]'); await page.waitForSelector('#hc-donts, .hc.donts');
  const hcIds = await page.$$eval('section.hc', (ss) => ss.map((x) => x.id)); assert.ok(hcIds.length >= 8, 'home care sections ' + hcIds.join());
  for (const id of hcIds) assert.ok(await page.locator(`#${id} .sources a[href^="https://"]`).count(), 'sources in ' + id);
  assert.ok(await page.locator('main a[href="#resources/insurance"]').count() && await page.locator('main a[href="#resources/boardup"]').count());
  assert.match(await page.textContent('main'), /1-888-674-6854/); assert.match(await page.textContent('.hc.donts'), /Things NOT to do|not/i);
  await shot('live-20-home-care-en');
  await page.click('[data-jump$="power"]'); await page.waitForTimeout(400); await shot('live-21-home-care-power-outage');
  await shotAt('live-22-home-care-donts', '.hc.donts');
  step(`home care: ${hcIds.length} sections, each with official sources; insurance and board-up links; USDA hotline; things not to do`);
  for (const [path, h2] of [['/cultural-food', 'Cultural & religious food'], ['/home-care-after-disaster', 'Home care after a fire or flood']]) {
    await page.goto(BASE + path); await page.waitForSelector(`main h2:has-text("${h2}")`); assert.equal(await page.getAttribute('link[rel=canonical]', 'href'), 'https://disaster-resources.app' + path);
  }
  step('both new screens load at real paths with canonical links');

  // ---- English / Spanish: picker on first open, switch, persistence, <html lang>
  {
    const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p3 = await ctx3.newPage(); const foreign3 = [], errors3 = [];
    p3.on('pageerror', (e) => errors3.push(e.message)); p3.on('console', (m) => { if (m.type() === 'error') errors3.push(m.text()); });
    p3.on('request', (r) => { const u = new URL(r.url()); if (u.origin !== BASE && !/^(data|blob):/.test(u.protocol)) foreign3.push(r.url()); });
    await p3.goto(BASE + '/'); await p3.waitForSelector('#langpick');
    assert.match(await p3.textContent('#langpick'), /Choose your language[\s\S]*Elija su idioma/);
    await p3.screenshot({ path: SHOTS + 'live-23-language-picker.png' });
    await p3.click('#langpick [data-pick="es"]'); await p3.waitForSelector('#langpick', { state: 'detached' });
    assert.equal(await p3.getAttribute('html', 'lang'), 'es'); assert.equal(await p3.evaluate(() => localStorage.getItem('ncdrh.lang')), 'es');
    const homeEs = await p3.textContent('main'); assert.match(homeEs, /Cuidado del hogar después de un incendio o inundación/); assert.match(homeEs, /Comida cultural|Alimentos culturales|comida cultural/i);
    assert.equal((await p3.textContent('#langsw')).trim(), 'English');
    assert.match(await p3.textContent('footer'), /C4I Veteran Services Corp\./);
    await p3.screenshot({ path: SHOTS + 'live-24-home-es.png' }); step('first open shows the English/Español picker; Español sets <html lang="es">, saves the choice and translates the home screen');
    await p3.reload(); await p3.waitForSelector('main h2'); assert.equal(await p3.locator('#langpick').count(), 0); assert.equal(await p3.getAttribute('html', 'lang'), 'es');
    await p3.goto(BASE + '/home-care-after-disaster'); await p3.waitForSelector('section.hc');
    const hcEs = await p3.textContent('main'); assert.match(hcEs, /No verificado|Cosas que NO debe hacer|NO debe/); assert.match(hcEs, /1-888-674-6854/);
    assert.ok(await p3.locator('a[href*="espanol.epa.gov"], a[href*="/es/"], a[href*="ready.gov/es"]').count(), 'Spanish official pages linked');
    assert.match(await p3.title(), /Cuidado del hogar/);
    await p3.screenshot({ path: SHOTS + 'live-25-home-care-es.png' });
    await p3.goto(BASE + '/cultural-food'); await p3.waitForSelector('#cfout li.food');
    const cfEs = await p3.textContent('main'); assert.match(cfEs, /Llame antes|No verificado/); assert.match(cfEs, /lugares coinciden/);
    await p3.screenshot({ path: SHOTS + 'live-26-cultural-food-es.png' });
    for (const h of ['resources/insurance', 'fire', 'hotels', 'login', 'about', 'privacy']) {
      await p3.goto(BASE + '/#' + h); await p3.waitForSelector('main h2');
      const txt = await p3.textContent('main'); assert.ok(!/\b(Sign in|Call ahead|Search|Your county|Insurance claim)\b/.test(txt.replace(/\(en inglés\)/g, '')) || h === 'about', 'English left on ' + h);
    }
    step('Spanish persists after reload and across screens (home care, cultural food, insurance, fire, hotels, sign-in, privacy); page titles translated; official Spanish pages linked');
    await p3.click('#langsw'); await p3.waitForSelector('#langsw:has-text("Español")'); assert.equal(await p3.getAttribute('html', 'lang'), 'en');
    assert.equal(await p3.evaluate(() => localStorage.getItem('ncdrh.lang')), 'en'); await p3.reload(); await p3.waitForSelector('main h2'); assert.equal(await p3.getAttribute('html', 'lang'), 'en');
    step('the header switch changes back to English and that choice persists too');
    assert.deepEqual(foreign3, [], 'no third-party requests in Spanish mode'); assert.deepEqual(errors3, []); await ctx3.close();
    step('no third-party requests or console errors in the language tests');
  }

  // ---- translation tile (EN), then Spanish in its own profile
  await go('home'); assert.ok(await page.locator('.tile.new[href="#translation"]').count()); await page.click('.tile[href="#translation"]'); await page.waitForSelector('#gtlang');
  for (const id of ['gt', 'ms', 'apple']) assert.ok(await page.locator(`#tr-app-${id} a[href^="https://"]`).count(), 'store links for ' + id);
  assert.ok(await page.locator('main a[href="https://play.google.com/store/apps/details?id=com.google.android.apps.translate"]').count());
  assert.ok(await page.locator('main a[href^="https://apps.apple.com/us/app/google-translate/id414706506"]').count());
  const trText = await page.textContent('main'); assert.match(trText, /1-800-621-3362/); assert.match(trText, /211/); assert.match(trText, /English and Spanish/i);
  assert.equal(await page.locator('main a[href^="tel:"]').count() >= 2, true);
  const before = foreign.length; await page.selectOption('#gtlang', 'vi'); assert.equal(foreign.length, before, 'choosing a language does not contact Google');
  assert.match(await page.getAttribute('#gtopen', 'href'), /^https:\/\/translate\.google\.com\/translate\?sl=auto&tl=vi&u=https%3A%2F%2Fdisaster-resources\.app/);
  assert.equal(await page.getAttribute('#gtopen', 'target'), '_blank'); assert.match(await page.textContent('#gtprivacy'), /Google/);
  await shot('live-30-translation-en'); step('translation tile: free apps with store links, phone how-tos, interpreter help (FEMA, NC 211), Google Translate only on tap');
  { const cES = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await cES.addInitScript(() => localStorage.setItem('ncdrh.lang', 'es'));
    const pES = await cES.newPage(); const fES = []; pES.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('data:')) fES.push(r.url()); });
    await pES.goto(BASE + '/#home'); await pES.waitForSelector('.tile[href="#translation"]'); await pES.click('.tile[href="#translation"]'); await pES.waitForSelector('#gtlang');
    assert.equal(await pES.getAttribute('html', 'lang'), 'es'); const tES = await pES.textContent('main'); assert.match(tES, /intérprete/i); assert.match(tES, /1-800-621-3362/); assert.doesNotMatch(tES, /Not verified\b/);
    await pES.screenshot({ path: SHOTS + 'live-31-translation-es.png' });
    await pES.goto(BASE + '/translation'); await pES.waitForSelector('#gtlang'); assert.match(await pES.title(), /traducción/i);
    assert.deepEqual(fES, []); await cES.close(); step('translation screen in Spanish (lang=es, Spanish text, own page title), no third-party requests'); }

  // ---- public account deletion page + accessibility statement
  await page.goto(BASE + '/delete-account'); await page.waitForSelector('main h2:has-text("Delete")'); assert.match(await page.textContent('main'), /info@c4iveteranservices\.org/); assert.ok(await page.locator('main a[href="#settings"]').count());
  await page.goto(BASE + '/accessibility'); await page.waitForSelector('main h2:has-text("Accessibility")'); assert.match(await page.textContent('main'), /WCAG 2\.1/); assert.ok(await page.locator('main a[href^="mailto:info@c4iveteranservices.org"]').count());
  assert.ok(await page.locator('footer a[href="#accessibility"]').count() && await page.locator('footer a[href="#delete-account"]').count()); step('public "Delete your account" page and accessibility statement, linked from the footer');

  // ---- Android: Digital Asset Links
  { const r = await fetch(BASE + '/.well-known/assetlinks.json'); assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /^application\/json/);
    const al = await r.json(); assert.equal(al[0].target.package_name, 'app.disasterresources.nchub'); assert.match(al[0].target.sha256_cert_fingerprints[0], /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    assert.match((await import('node:fs')).readFileSync(ROOT + 'netlify.toml', 'utf8'), /for = "\/.well-known\/assetlinks.json"[\s\S]*?Content-Type = "application\/json"/); step('assetlinks.json served as application/json with the app package and certificate fingerprint'); }

  // ---- push alerts: subscribe (after a tap), admin sends, device receives; unsubscribe
  if (ADAPTER === 'remote') {
    const cP = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await cP.grantPermissions(['notifications'], { origin: BASE }); await cP.addInitScript(EN_FIRST);
    const PUSH_ORIGIN = env.NCDRH_TEST_PUSH_ORIGIN;
    // Headless Chrome cannot reach a real push service, so PushManager is replaced by a fake that returns a real P-256 key.
    await cP.addInitScript((origin) => {
      if (!window.PushManager) return; const KEY = '__fakepush';
      const make = (j) => ({ endpoint: j.endpoint, toJSON: () => j, unsubscribe: async () => { localStorage.removeItem(KEY); return true; } });
      const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      window.__subscribeCalls = 0;
      PushManager.prototype.getSubscription = async function () { const j = localStorage.getItem(KEY); return j ? make(JSON.parse(j)) : null; };
      PushManager.prototype.subscribe = async function (opts) { window.__subscribeCalls++; if (!opts?.applicationServerKey?.length) throw new Error('no key');
        const k = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']); const raw = await crypto.subtle.exportKey('raw', k.publicKey);
        const j = { endpoint: origin + '/push/e2e-' + Math.random().toString(36).slice(2), expirationTime: null, keys: { p256dh: b64(raw), auth: b64(crypto.getRandomValues(new Uint8Array(16))) } };
        localStorage.setItem(KEY, JSON.stringify(j)); return make(j); };
    }, PUSH_ORIGIN);
    const pp = await cP.newPage(); const fP = []; pp.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('data:')) fP.push(r.url()); }); const eP = []; pp.on('pageerror', (e) => eP.push(e.message));
    await pp.goto(BASE + '/#home'); await pp.click('.tile[href="#alerts"]'); await pp.waitForSelector('#pf');
    assert.equal(await pp.evaluate(() => window.__subscribeCalls), 0, 'nothing is requested before a tap');
    assert.ok(await pp.isChecked('#pstate')); await pp.selectOption('#pcounty', 'Wake'); await pp.click('#padd'); await pp.waitForSelector('#pcounties li');
    await pp.screenshot({ path: SHOTS + 'live-32-alerts-choose.png' });
    await pp.click('#pon'); await pp.waitForSelector('#poff'); assert.equal(await pp.evaluate(() => window.__subscribeCalls), 1);
    assert.match(await pp.textContent('#pf h3'), /Alerts are on/); step('alerts: opt-in only after a tap; statewide + Wake County saved');
    await pp.reload(); await pp.waitForSelector('#poff'); assert.ok(await pp.locator('#pcounties li:has-text("Wake")').count()); step('alerts: device status is remembered (server status lookup)');
    // admin composes, reviews and sends
    await go('login'); await page.fill('#le', ADMIN); await page.fill('#lp', 'correct-horse-9'); await page.click('button[type=submit]'); await page.waitForSelector('header :text("Admin")'); await go('admin/alerts'); await page.waitForSelector('#pa');
    await page.selectOption('#pa_target', 'Wake'); await page.fill('#pa_title', 'Disaster Recovery Center open'); await page.fill('#pa_body', 'Wake County DRC is open today 9 to 6.');
    await page.fill('#pa_titleEs', 'Centro de Recuperación abierto'); await page.fill('#pa_bodyEs', 'El DRC del condado de Wake abre hoy de 9 a 6.'); await page.fill('#pa_url', '/county/wake');
    await page.click('#pa button[type=submit]'); await page.waitForSelector('#pa_send', { state: 'visible' }); assert.match(await page.textContent('#pa_confirm'), /1 device/);
    await page.screenshot({ path: SHOTS + 'live-33-admin-alert-confirm.png' });
    await page.click('#pa_send'); await page.waitForSelector('#pushlog li'); assert.match(await page.textContent('#pushlog'), /Wake[\s\S]*1/);
    assert.equal(pushGot.length, 1); assert.match(pushGot[0].headers.authorization, /^vapid t=/); assert.equal(pushGot[0].headers['content-encoding'], 'aes128gcm'); assert.ok(pushGot[0].len > 100);
    step('admin: compose EN+ES, confirm "1 device", send; push service received an encrypted VAPID-signed message; send log updated');
    // the service worker shows the notification (push event delivered through the DevTools protocol)
    const swTarget = await pp.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    const cdp = await cP.newCDPSession(pp); await cdp.send('ServiceWorker.enable'); let regId = null; cdp.on('ServiceWorker.workerRegistrationUpdated', (e) => { for (const r of e.registrations) if (r.scopeURL === swTarget) regId = r.registrationId; });
    await cdp.send('ServiceWorker.disable'); await cdp.send('ServiceWorker.enable'); for (let i = 0; i < 20 && !regId; i++) await pp.waitForTimeout(100);
    if (regId) { await cdp.send('ServiceWorker.deliverPushMessage', { origin: BASE, registrationId: regId, data: JSON.stringify({ title: 'Test alert', body: 'Hello', url: BASE + '/county/wake', tag: 't1', lang: 'en' }) });
      let notes = []; for (let i = 0; i < 30 && !notes.length; i++) { await pp.waitForTimeout(100); notes = await pp.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => n.title + '|' + n.body + '|' + n.data?.url)); }
      assert.deepEqual(notes, ['Test alert|Hello|' + BASE + '/county/wake']); step('service worker shows the alert as a notification (title, text, link)'); }
    else console.log('  (skipped: service worker push delivery via DevTools not available)');
    // unsubscribe
    await pp.goto(BASE + '/#alerts'); await pp.waitForSelector('#poff'); await pp.click('#poff'); await pp.waitForSelector('#pon:has-text("Turn on alerts")');
    await page.reload(); await page.waitForSelector('#pa'); await page.selectOption('#pa_target', 'statewide'); await page.fill('#pa_title', 'x'); await page.fill('#pa_body', 'y'); await page.fill('#pa_titleEs', 'x'); await page.fill('#pa_bodyEs', 'y');
    await page.click('#pa button[type=submit]'); await page.waitForSelector('#pa_confirm'); assert.match(await page.textContent('#pa_confirm'), /\b0 devices/); await page.click('#pa_cancel');
    assert.deepEqual(fP, [], 'no third-party requests from the alerts screen'); assert.deepEqual(eP, []); await cP.close(); await logout();
    step('alerts: "Turn off alerts" removes the subscription (admin now sees 0 devices)');
  }

  // ---- crawlable paths + sitemap/robots (hash links keep working)
  for (const [path, h2, title] of [['/hotels', 'Hotels & motels nearby', 'Hotels & motels nearby · '], ['/insurance', 'Insurance', 'Insurance · '], ['/county/new-hanover', 'New Hanover County', 'New Hanover County services · '], ['/fire-departments', 'Fire departments', 'Fire departments · ']]) {
    await page.goto(BASE + path); await page.waitForSelector(`main h2:has-text("${h2}")`);
    assert.ok((await page.title()).startsWith(title), path + ' title'); assert.equal(await page.getAttribute('link[rel=canonical]', 'href'), 'https://disaster-resources.app' + path);
  }
  await page.goto(BASE + '/hotels#resources/legal'); await page.waitForSelector('main h2:has-text("Free legal help")');
  const sm = await (await fetch(BASE + '/sitemap.xml')).text(); assert.match(sm, /<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/); assert.ok(!/notes|admin|share|submit|login|signup|settings|claim|\.netlify|\/api/.test(sm), 'sitemap lists public pages only');
  assert.match(await (await fetch(BASE + '/robots.txt')).text(), /Sitemap: https:\/\/disaster-resources.app\/sitemap.xml/); step('public sections load at real paths (/hotels, /insurance, /county/new-hanover) with their own title and canonical; sitemap and robots served');

  // ---- offline: service worker serves shell + data
  await page.goto(BASE + '/#fire'); await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForTimeout(1500);
  await context.setOffline(true); await page.goto(BASE + '/#fire'); await page.waitForSelector('#fl li.fd');
  await page.goto(BASE + '/#hotels'); await page.fill('#hq', '28801'); await page.click('#hf button[type=submit]'); await page.waitForSelector('li.hotel');
  await page.goto(BASE + '/#resources/insurance'); await page.waitForSelector('#inslist li.ins');
  await context.setOffline(false); step('works offline (service worker cached shell, fire, hotel and insurance data)');

  assert.deepEqual(foreign, [], 'no third-party requests'); step('no third-party requests (no CDNs, fonts, analytics)');
  assert.deepEqual(errors.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e)), []); step('no console errors');
  console.log(`\nAll ${n} e2e checks passed. Screenshots in ${SHOTS}`);
} catch (e) {
  await page.screenshot({ path: SHOTS + 'FAILED.png' }).catch(() => {});
  console.error('E2E FAILED at step', n + 1, e); process.exitCode = 1;
} finally { await browser.close(); stop(); }
