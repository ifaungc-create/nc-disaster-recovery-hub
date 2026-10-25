// Live check of the Translation page's "Open in Google Translate" button (needs internet; contacts Google).
// Opens https://disaster-resources.app/translation, picks each language, taps the button, and checks that
// the new tab shows the app translated (not blank, not the English original) and that in-app links stay
// inside the translation. Usage: node tests/live-translate.mjs [lang ...]   (default: vi zh-CN ar ko es)
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const BASE = process.env.BASE || 'https://disaster-resources.app';
const langs = process.argv.slice(2).length ? process.argv.slice(2) : ['vi', 'zh-CN', 'ar', 'ko', 'es'];
const SHOTS = process.env.SHOTS_DIR || 'screenshots/';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { if (location.hostname === 'disaster-resources.app') localStorage.setItem('ncdrh.lang', 'en'); });
const page = await ctx.newPage();
await page.goto(BASE + '/translation'); await page.waitForSelector('#gtlang');
const english = 'Free translation apps';
let failed = 0;
for (const lang of langs) {
  try {
    await page.selectOption('#gtlang', lang);
    const href = await page.getAttribute('#gtopen', 'href');
    assert.match(href, new RegExp(`^https://disaster--resources-app\\.translate\\.goog/translation\\?_x_tr_sl=auto&_x_tr_tl=${lang}&`));
    const [tab] = await Promise.all([ctx.waitForEvent('page'), page.click('#gtopen')]);
    const errs = []; tab.on('pageerror', (e) => errs.push(e.message));
    await tab.waitForLoadState('load');
    await tab.waitForSelector('#tr-apps-h', { timeout: 30000 });
    await tab.waitForFunction((en) => { const h = document.querySelector('#tr-apps-h'); return h && h.innerText.trim() && h.innerText.trim() !== en; }, english, { timeout: 30000 });
    const h = (await tab.innerText('#tr-apps-h')).trim();
    assert.equal(await tab.locator('#langpick').count(), 0, 'no language dialog in the translated copy');
    // In-app link (bottom nav "Help") must stay on the translated host.
    await tab.locator('nav.bottom a[href="#resources"]').click(); await tab.waitForTimeout(3000);
    const u = new URL(tab.url()); assert.ok(u.hostname.endsWith('.translate.goog'), 'stayed in translation: ' + tab.url()); assert.equal(u.hash, '#resources');
    const h2 = (await tab.innerText('main h2')).trim();
    assert.notEqual(h2, 'Resources', 'Help screen is translated');
    console.log(`ok - ${lang}: "${english}" -> "${h}"; Help screen -> "${h2}" (${tab.url()})`);
    if (lang === langs[0]) { await tab.goBack(); await tab.waitForTimeout(3000); await tab.screenshot({ path: SHOTS + 'live-40-translate-fix.png' }); }
    if (errs.length) console.log('  page errors:', errs.join(' | ').slice(0, 300));
    await tab.close();
  } catch (e) { failed++; console.log(`FAIL - ${lang}: ${e.message.split('\n')[0]}`); }
}
await browser.close();
console.log(failed ? `${failed} of ${langs.length} failed` : `All ${langs.length} languages translated`);
process.exit(failed ? 1 : 0);
