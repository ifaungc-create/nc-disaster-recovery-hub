import { chromium } from 'playwright-core';
const BASE = 'https://disaster-resources-lltd.netlify.app', SHOTS = '/workspace/nc-disaster-hub/screenshots/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['geolocation'] });
await ctx.addInitScript(() => { try { if (!localStorage.getItem('ncdrh.lang')) localStorage.setItem('ncdrh.lang', 'en'); } catch {} });
const page = await ctx.newPage(); const foreign = [], posts = [];
page.on('request', (r) => { const u = new URL(r.url()); if (u.origin !== BASE && !/^(data|blob):/.test(u.protocol)) foreign.push(r.url()); if (r.method() === 'POST') posts.push(u.pathname); });
const out = {};
for (const [city, la, lo] of [['Asheville', 35.5951, -82.5515], ['Raleigh', 35.7796, -78.6382], ['Wilmington', 34.2257, -77.9447]]) {
  // fresh browser profile per city (the app accepts a cached position up to 5 minutes old)
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['geolocation'], geolocation: { latitude: la, longitude: lo } });
  await c2.addInitScript(() => { try { if (!localStorage.getItem('ncdrh.lang')) localStorage.setItem('ncdrh.lang', 'en'); } catch {} });
  const p2 = await c2.newPage(); p2.on('request', (r) => { const u = new URL(r.url()); if (u.origin !== BASE && !/^(data|blob):/.test(u.protocol)) foreign.push(r.url()); if (r.method() === 'POST') posts.push(city + ' ' + u.pathname); });
  await p2.goto(BASE + '/#hotels'); await p2.waitForSelector('#hloc');
  await p2.click('#hloc'); await p2.waitForFunction(() => document.querySelector('li.hotel') || /No hotels/.test(document.querySelector('#hsum').textContent), null, { timeout: 30000 });
  out[city] = { summary: await p2.textContent('#hsum'), first: (await p2.locator('li.hotel h3').first().textContent()), firstMi: await p2.locator('li.hotel .dist').first().textContent(), withCall: await p2.locator('li.hotel a:has-text("Call")').count() };
  if (city === 'Asheville') { await p2.evaluate(() => window.scrollTo(0, document.querySelector('#hsum').getBoundingClientRect().top + window.scrollY - 150)); await p2.screenshot({ path: SHOTS + 'live-04-hotels-asheville.png' }); }
  if (city !== 'Wilmington') await c2.close(); else { var wil = p2; }
}
out.postsDuringOnDevice = posts.slice();
// optional live check once (Wilmington)
await wil.click('#hlive'); await wil.waitForFunction(() => /added|nothing new|not available|did not|try again|Too many/i.test(document.querySelector('#hlivesum').textContent), null, { timeout: 30000 }).catch(() => {});
out.liveCheck = await wil.textContent('#hlivesum');
out.dataNote = (await wil.textContent('main')).match(/OpenStreetMap data as of [^.]*/)?.[0];
await page.goto(BASE + '/#county/Bertie'); await page.waitForSelector('main h2:has-text("Bertie")');
out.bertieBadges = await page.$$eval('.badge.verify', (e) => [...new Set(e.map((x) => x.textContent))]);
out.bertieNote = (await page.textContent('main .note'))?.slice(0, 120);
await page.screenshot({ path: SHOTS + 'live-05-bertie-not-verified.png' });
await page.goto(BASE + '/#fire'); await page.waitForSelector('#fl li');
out.fireIntro = (await page.textContent('main p')).match(/older listings marked "[^"]+"/)?.[0];
// find a flagged (v=0) department via the data, then search for it
const flagged = await page.evaluate(async () => (await (await fetch('/data/fire-departments.json')).json()).find((f) => f.v === 0));
await page.fill('#fq', flagged.n); await page.click('#ff button[type=submit]'); await page.waitForSelector('#fl li.fd');
const li = page.locator('#fl li.fd', { hasText: flagged.n }).first(); out.fireFlagged = { name: flagged.n, badge: await li.locator('.badge.verify').textContent() };
for (const h of ['resources/housing', 'phone', 'schools', 'resources/legal']) { await page.goto(BASE + '/#home'); await page.goto(BASE + '/#' + h); await page.waitForSelector('main h2'); await page.waitForTimeout(300); out['toVerifyText_' + h] = /to verify/i.test(await page.textContent('main')); out['badges_' + h] = await page.$$eval('.badge.verify', (e) => [...new Set(e.map((x) => x.textContent))].filter((t) => !/due/i.test(t))); }
out.foreign = foreign;
console.log(JSON.stringify(out, null, 1)); await b.close();
