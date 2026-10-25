// Google Play phone screenshots (1080x1920 PNG, 9:16) in English and Spanish, taken from a local build.
// Sample case numbers are clearly made up. Run: node scripts/play-screenshots.mjs
import { chromium } from 'playwright-core';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const ROOT = new URL('..', import.meta.url).pathname, BASE = 'http://localhost:4178', OUT = ROOT + 'docs/play-store/graphics/phone/';
mkdirSync(OUT, { recursive: true });
const BLOBS = mkdtempSync(join(tmpdir(), 'ncdrh-shots-'));
const env = { ...process.env, VITE_DATA_ADAPTER: 'remote', NCDRH_BLOBS_DIR: BLOBS, NCDRH_DEV_INSECURE_SECRETS: '1', ADMIN_EMAILS: 'nobody@example.org' };
execSync('npx vite build', { cwd: ROOT, stdio: 'ignore', env });
const server = spawn('npx', ['vite', 'preview', '--port', '4178', '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true, env });
for (let i = 0; i < 60; i++) { try { await fetch(BASE); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  for (const lang of ['en', 'es']) {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await ctx.addInitScript((l) => localStorage.setItem('ncdrh.lang', l), lang);
    const p = await ctx.newPage(); let n = 0;
    const snap = async (name) => { await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}${lang}-${++n}-${name}.png` }); };
    const open = async (url, sel = 'main h2') => { await p.goto(BASE + url); await p.waitForSelector(sel); await p.evaluate(() => window.scrollTo(0, 0)); };
    await open('/#home'); await snap('home');
    await open('/county/wake'); await snap('county');
    await open('/translation', '#gtlang'); await snap('translation');
    await open('/alerts', '#pf, #pushnot'); await snap('alerts');
    await open('/hotels'); await snap('hotels');
    // Private notes with made-up sample case numbers.
    await open('/#signup'); await p.check('input[name=role][value=affected]'); await p.fill('#sn', lang === 'es' ? 'Ana' : 'Sam'); await p.fill('#se', `sample-${lang}@example.org`);
    await p.fill('#sp', 'sample-pass-123'); await p.check('input[name=terms]'); await p.click('button[type=submit]'); await p.waitForSelector('#adminlink, .tabs, main h2');
    await p.waitForTimeout(800);
    for (const [ag, num, other] of [['FEMA', '0000-0000 (sample)'], ['Insurance claim', 'SAMPLE-123', lang === 'es' ? 'Su aseguradora' : 'Your insurer']]) {
      await open('/#notes/cases/new', '#f_agency');
      await p.selectOption('#f_agency', ag); if (other) await p.fill('#f_agencyOther', other); await p.fill('#f_number', num); await p.click('button[type=submit]'); await p.waitForTimeout(500);
    }
    await open('/#notes/cases'); await snap('case-numbers');
    await ctx.close();
  }
  console.log('Play screenshots written to', OUT);
} finally { await browser.close(); try { process.kill(-server.pid); } catch {} rmSync(BLOBS, { recursive: true, force: true }); }
