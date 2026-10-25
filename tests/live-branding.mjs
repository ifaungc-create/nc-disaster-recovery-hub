// Live check: branding, contact, disclaimer, report links, hidden live-hotel button. Read-only (no accounts).
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const BASE = (process.env.LIVE_URL || 'https://disaster-resources-lltd.netlify.app').replace(/\/$/, '');
const SHOTS = new URL('../screenshots/', import.meta.url).pathname;
const TAG = 'A project of C4I Veteran Services Corp.', MAIL = 'mailto:info@c4iveteranservices.org';
const DISC = 'None of the organizations or agencies listed in this app, whether government or private, are affiliated with this app or with C4I Veteran Services Corp. This app serves as a research and referral platform to help you recover from a disaster. We have done our best to confirm all information and keep it up to date, but information changes. Please let us know if a number does not work or a link is broken: info@c4iveteranservices.org.';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['geolocation'], geolocation: { latitude: 35.5951, longitude: -82.5515 } });
const page = await ctx.newPage(); const foreign = [];
page.on('request', (r) => { const u = new URL(r.url()); if (u.origin !== BASE && !/^(data|blob):/.test(u.protocol)) foreign.push(r.url()); });
let n = 0; const step = (m) => console.log(`  ✓ ${++n}. ${m}`);
const go = async (h, sel = 'main h2') => { await page.goto(BASE + '/#' + h); await page.waitForFunction((x) => decodeURIComponent(location.hash.slice(1)) === x, h); await page.waitForSelector(sel); await page.waitForTimeout(400); };
try {
  await go('home', '#homedisc');
  assert.equal((await page.textContent('header .brand')).trim(), 'NC Disaster Recovery Hub' + TAG);
  assert.equal((await page.textContent('#footcontact')).trim(), 'Problems with the app? Email info@c4iveteranservices.org'); assert.equal(await page.getAttribute('#footcontact a', 'href'), MAIL);
  assert.match(await page.textContent('#homedisc'), /not affiliated with this app or with C4I Veteran Services Corp/);
  assert.equal(await page.getAttribute('meta[name=description]', 'content'), 'Help after fires, floods and hurricanes in North Carolina. ' + TAG);
  assert.equal(await page.getAttribute('meta[property="og:title"]', 'content'), 'NC Disaster Recovery Hub · ' + TAG);
  const mf = await (await fetch(BASE + '/manifest.webmanifest')).json(); assert.ok(mf.description.endsWith(TAG));
  await page.screenshot({ path: SHOTS + 'live-06-home-branding.png' });
  await page.evaluate(() => document.querySelector('#homedisc').scrollIntoView({ block: 'center' })); await page.screenshot({ path: SHOTS + 'live-07-home-disclaimer.png' });
  step('home: header tagline, short disclaimer, footer contact, meta + manifest');
  await page.click('footer a[href="#about"]'); await page.waitForSelector('#disclaimer');
  assert.equal((await page.textContent('#disclaimer p')).trim(), DISC); assert.equal(await page.getAttribute('#disclaimer a', 'href'), MAIL);
  await page.screenshot({ path: SHOTS + 'live-08-about-disclaimer.png' }); step('About & disclaimer page: exact wording, mailto');
  for (const h of ['login', 'signup', 'privacy']) { await go(h, 'main .brandline'); assert.match(await page.textContent('main .brandline'), /A project of C4I Veteran Services Corp\./); }
  await go('signup', '#signupdisc'); step('tagline on sign-in, sign-up, privacy; sign-up links to the disclaimer');
  await go('settings', '#settingscontact'); assert.match(await page.textContent('#settingscontact'), /Problems with the app\? Email info@c4iveteranservices\.org/); step('Settings contact');
  await go('resources/legal', '[data-report]'); const r1 = await page.getAttribute('[data-report]', 'href'); assert.ok(r1.startsWith(MAIL + '?subject=Broken%20link%20or%20number%3A%20'));
  await go('county/Bertie', 'a[data-report="Bertie County Emergency Management"]');
  await go('fire/county/Wake', '#fl li.fd [data-report]'); const fr = await page.getAttribute('#fl li.fd [data-report]', 'data-report');
  step(`report links live (resource subject: ${decodeURIComponent(r1.split('subject=')[1].split('&')[0])}; fire: ${fr})`);
  await go('hotels', '#hloc'); await page.click('#hloc'); await page.waitForSelector('li.hotel'); assert.equal(await page.locator('#hlive').count(), 0);
  step(`hotels: ${(await page.textContent('#hsum')).trim()}; live-map button hidden`);
  assert.deepEqual(foreign, []); step('no third-party requests');
} catch (e) { console.error('LIVE BRANDING FAILED at step', n + 1, e.message); process.exitCode = 1; } finally { await b.close(); }
