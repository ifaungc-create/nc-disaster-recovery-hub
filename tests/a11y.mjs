// Accessibility audit: axe-core (WCAG 2.0/2.1 A + AA rules) on every screen, in English and Spanish,
// signed out and signed in (admin, so admin screens are covered), plus the first-visit language dialog.
// Extra checks: touch targets ≥ 48 CSS px, no sideways scrolling at 320 px wide (WCAG 1.4.10 reflow)
// and with text at 200% (1.4.4), keyboard (skip link, dialog focus trap + Escape), reduced motion.
// Fails on any serious or critical violation. Writes a JSON report to a11y-report.json.
import { chromium } from 'playwright-core';
import { spawn, execSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { PUBLIC_PAGES } from '../src/paths.js';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 4176, BASE = `http://localhost:${PORT}`;
const AXE = readFileSync(join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
const BLOBS = mkdtempSync(join(tmpdir(), 'ncdrh-a11y-blobs-'));
const ADMIN = 'dn22@c4iveteranservices.org';
const env = { ...process.env, VITE_DATA_ADAPTER: 'remote', NCDRH_BLOBS_DIR: BLOBS, NCDRH_DEV_INSECURE_SECRETS: '1', ADMIN_EMAILS: ADMIN };
delete env.APP_SESSION_SECRET; delete env.DATA_ENCRYPTION_KEY;
if (!process.env.SKIP_BUILD) execSync('npx vite build', { cwd: ROOT, stdio: 'ignore', env });
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'], detached: true, env });
let serverOut = ''; server.stdout.on('data', (d) => { serverOut += d; }); // the operator log, where one-time admin codes are written
const lastCode = () => [...serverOut.matchAll(/\[admin-code\][^\n]*: ([A-Z2-9]{5}-[A-Z2-9]{5}) \(single use/g)].pop()?.[1];
const stop = () => { try { process.kill(-server.pid); } catch {} rmSync(BLOBS, { recursive: true, force: true }); };
for (let i = 0; i < 80; i++) { try { await fetch(BASE); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const report = []; const problems = []; let n = 0; const ok = (m) => console.log(`  ✓ ${++n}. ${m}`);
const newCtx = async (lang, opts = {}) => { const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, bypassCSP: true, ...opts }); if (lang) await c.addInitScript((l) => { try { localStorage.setItem('ncdrh.lang', l); } catch {} }, lang); return c; };
const axe = async (page, label) => {
  if (!(await page.evaluate(() => !!window.axe))) await page.evaluate(AXE);
  const r = await page.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }, resultTypes: ['violations'] }));
  for (const v of r.violations) { report.push({ screen: label, id: v.id, impact: v.impact, tags: v.tags, help: v.help, nodes: v.nodes.slice(0, 5).map((x) => x.target.join(' ')) }); if (['serious', 'critical'].includes(v.impact)) problems.push(`${label}: ${v.id} (${v.impact}) ${v.help} → ${v.nodes.slice(0, 3).map((x) => x.target.join(' ')).join(' | ')}`); }
  const small = await page.evaluate(() => [...document.querySelectorAll('button, .btn, input:not([type=hidden]), select, textarea, a.rowlink, a.tile, nav a, summary, label.opt, [role=button]')].filter((e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed').map((e) => { const b = e.getBoundingClientRect(); const box = (e.type === 'checkbox' || e.type === 'radio') && e.closest('label') ? e.closest('label').getBoundingClientRect() : b; return { t: e.tagName + (e.id ? '#' + e.id : '') + (e.className ? '.' + String(e.className).split(' ')[0] : ''), w: Math.round(box.width), h: Math.round(box.height) }; }).filter((x) => x.w > 0 && (x.h < 48 || x.w < 48)));
  if (small.length) { report.push({ screen: label, id: 'target-size-48', impact: 'moderate', nodes: small.slice(0, 8).map((s) => `${s.t} ${s.w}x${s.h}`) }); problems.push(`${label}: touch targets < 48px → ${small.slice(0, 6).map((s) => `${s.t} ${s.w}x${s.h}`).join(', ')}`); }
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (wide > 1) problems.push(`${label}: page scrolls sideways by ${wide}px`);
};
const go = async (page, hash) => { await page.goto(BASE + '/#' + hash); await page.waitForSelector('main h2'); await page.waitForTimeout(250); };
const hashes = ['home', 'login', 'signup', 'reset', 'resources', ...PUBLIC_PAGES.map((p) => p.route).filter((r) => r && r !== 'resources'), 'county/Wake', 'county/New Hanover', 'phone'];
const uniq = [...new Set(hashes)];
const signedIn = ['home', 'settings', 'notes/cases', 'notes/cases/new', 'notes/referrals', 'notes/referrals/new', 'share', 'submit', 'alerts', 'admin', 'delete-account'];

try {
  // a second account for the admin Accounts screen
  assert.equal((await fetch(BASE + '/.netlify/functions/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'createUser', args: [{ email: 'qa-a11y@example.org', password: 'correct-horse-9', name: 'QA Person', role: 'affected', termsAccepted: true }] }) })).status, 200);
  // ---- first visit: language dialog
  { const c = await newCtx(null); const p = await c.newPage(); await p.goto(BASE + '/'); await p.waitForSelector('#langpick');
    await axe(p, 'language dialog');
    assert.equal(await p.evaluate(() => document.activeElement?.dataset.pick), 'en');
    for (let i = 0; i < 4; i++) await p.keyboard.press('Tab');
    assert.ok(await p.evaluate(() => !!document.activeElement.closest('#langpick')), 'focus stays inside the language dialog');
    await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Shift+Tab');
    assert.ok(await p.evaluate(() => !!document.activeElement.closest('#langpick')), 'focus stays inside (backwards)');
    await p.keyboard.press('Escape'); await p.waitForSelector('#langpick', { state: 'detached' });
    assert.equal(await p.getAttribute('html', 'lang'), 'en'); ok('language dialog: no axe violations, focus trapped, Escape closes (keeps English)');
    await c.close(); }

  for (const lang of ['en', 'es']) {
    const c = await newCtx(lang); const p = await c.newPage(); p.on('dialog', (d) => d.accept());
    for (const h of uniq) await (go(p, h).then(() => axe(p, `${lang} #${h}`)));
    ok(`${lang.toUpperCase()}: ${uniq.length} signed-out screens audited`);
    // keyboard: skip link is first and moves focus to main
    await go(p, 'home'); const hashBefore = await p.evaluate(() => location.hash);
    assert.equal(await p.evaluate(() => document.querySelector('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])').className), 'skip', 'skip link is the first focusable element');
    await p.focus('.skip'); assert.ok(await p.evaluate(() => document.querySelector('.skip').getBoundingClientRect().left >= 0), 'skip link becomes visible on focus'); await p.keyboard.press('Enter');
    assert.equal(await p.evaluate(() => document.activeElement.id), 'main', 'skip link moves focus to main'); assert.equal(await p.evaluate(() => location.hash), hashBefore, 'skip link does not change the screen'); ok(`${lang.toUpperCase()}: skip link works by keyboard`);
    assert.equal(await p.getAttribute('html', 'lang'), lang); ok(`${lang.toUpperCase()}: <html lang> is "${lang}"`);
    // sign in (admin) and audit private screens
    if (lang === 'en') { await go(p, 'signup'); await p.check('input[name=role][value=affected]'); await p.fill('#sn', 'Ada Admin'); await p.fill('#se', ADMIN); await p.fill('#sp', 'correct-horse-9'); await p.check('input[name=terms]'); await p.click('button[type=submit]'); await p.waitForSelector('main h2'); await p.waitForTimeout(800);
      await go(p, 'settings'); await p.waitForSelector('#claimcard'); await axe(p, 'en #settings (admin not confirmed yet)');
      await p.click('#claimstart'); await p.waitForFunction(() => document.querySelector('#claimmsg').textContent.length > 0); for (let i = 0; i < 20 && !lastCode(); i++) await p.waitForTimeout(100);
      await p.fill('#claimcode', lastCode()); await p.click('#claimf button[type=submit]'); await p.waitForSelector('#claimcard', { state: 'detached' }); }
    else { await go(p, 'login'); await p.fill('#le', ADMIN); await p.fill('#lp', 'correct-horse-9'); await p.click('button[type=submit]'); await p.waitForTimeout(1200); }
    await go(p, 'admin'); await p.waitForSelector('nav.tabs'); await go(p, 'alerts'); await p.waitForSelector('#pf');
    for (const h of signedIn) await (go(p, h).then(() => axe(p, `${lang} #${h} (signed in)`)));
    const tabs = ['responders', 'submissions', 'published', 'alerts', 'accounts', 'admins', 'audit'];
    for (const tb of tabs) { await go(p, 'admin/' + tb); await p.waitForTimeout(400); await axe(p, `${lang} #admin/${tb}`); }
    await go(p, 'admin/alerts'); await p.click('#pa button[type=submit]'); await p.waitForTimeout(300); await axe(p, `${lang} #admin/alerts (empty submit)`);
    await p.fill('#pa_title', 'Test'); await p.fill('#pa_body', 'Body'); await p.fill('#pa_titleEs', 'Prueba'); await p.fill('#pa_bodyEs', 'Texto'); await p.click('#pa button[type=submit]'); await p.waitForSelector('#pa_send', { state: 'visible' }); await axe(p, `${lang} #admin/alerts (confirm step)`);
    // alerts: several counties, no Spanish (warning shown in the confirm step)
    await go(p, 'admin/alerts'); await p.reload(); await p.waitForSelector('#pa'); await p.check('#pa_cty'); for (const c of ['Wake', 'Buncombe']) { await p.selectOption('#pa_county', c); await p.click('#pa_add'); }
    await p.fill('#pa_title', 'Test'); await p.fill('#pa_body', 'Body'); await p.click('#pa button[type=submit]'); await p.waitForSelector('#pa_nospanish'); await axe(p, `${lang} #admin/alerts (counties, no Spanish warning)`);
    // accounts: find an account, see reset + delete
    await go(p, 'admin/accounts'); await p.fill('#ua_email', 'qa-a11y@example.org'); await p.click('#ua button[type=submit]'); await p.waitForSelector('#ua_del'); await axe(p, `${lang} #admin/accounts (account found, delete form)`);
    await p.click('#ua_del button[type=submit]'); await p.waitForFunction(() => document.querySelector('#ua_derr').textContent.length > 0); await axe(p, `${lang} #admin/accounts (delete without confirmation)`);
    await p.click('#ua_reset'); await p.waitForSelector('#ua_code'); await axe(p, `${lang} #admin/accounts (reset code shown)`);
    // administrators: add form error, temporary password panel, then the forced password change for that admin (separate context)
    await go(p, 'admin/admins'); await p.click('#ad button[type=submit]'); await p.waitForTimeout(200); await axe(p, `${lang} #admin/admins (empty add)`);
    await p.fill('#ad_name', 'QA Admin ' + lang); await p.fill('#ad_email', `qa-a11y-admin-${lang}@example.org`); await p.click('#ad button[type=submit]'); await p.waitForSelector('#ad_pw'); await axe(p, `${lang} #admin/admins (temporary password shown)`);
    { const temp = await p.inputValue('#ad_pw'); const c2 = await newCtx(lang); const p2 = await c2.newPage(); await go(p2, 'login'); await p2.fill('#le', `qa-a11y-admin-${lang}@example.org`); await p2.fill('#lp', temp); await p2.click('button[type=submit]'); await p2.waitForSelector('#cpf');
      await axe(p2, `${lang} #set-password`); await p2.click('#cpf button[type=submit]'); await p2.waitForTimeout(200); await axe(p2, `${lang} #set-password (error)`);
      await p2.setViewportSize({ width: 320, height: 640 }); const w = await p2.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (w > 1) problems.push(`${lang} #set-password @320px: sideways scroll ${w}px`); await c2.close(); }
    await p.setViewportSize({ width: 320, height: 640 }); { const w = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (w > 1) problems.push(`${lang} #admin/admins (temp password) @320px: sideways scroll ${w}px`); } await p.setViewportSize({ width: 390, height: 844 });
    // form errors are announced: submit an empty case form
    await go(p, 'notes/cases/new'); await p.click('main button[type=submit]'); await p.waitForTimeout(300); await axe(p, `${lang} #notes/cases/new (after empty submit)`);
    assert.ok(await p.evaluate(() => [...document.querySelectorAll('main [role=alert], main [aria-live]')].some((e) => e.textContent.trim())), 'form error is in a live region');
    ok(`${lang.toUpperCase()}: ${signedIn.length} signed-in screens + ${tabs.length} admin tabs audited`);
    // reflow at 320px and 200% text
    await p.setViewportSize({ width: 320, height: 640 });
    for (const h of ['home', 'hotels', 'translation', 'alerts', 'settings', 'resources/housing']) { await go(p, h); const w = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (w > 1) problems.push(`${lang} #${h} @320px: sideways scroll ${w}px`); }
    await p.setViewportSize({ width: 640, height: 900 });
    for (const h of ['home', 'hotels', 'translation', 'alerts', 'settings', 'accessibility']) { await go(p, h); await p.evaluate(() => { document.documentElement.style.fontSize = '200%'; }); await p.waitForTimeout(100); const w = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (w > 1) problems.push(`${lang} #${h} text 200%: sideways scroll ${w}px`); }
    ok(`${lang.toUpperCase()}: reflow at 320px and text at 200% checked`);
    await c.close();
  }
  // reduced motion
  { const c = await newCtx('en', { reducedMotion: 'reduce' }); const p = await c.newPage(); await go(p, 'home');
    const anim = await p.evaluate(() => [...document.querySelectorAll('*')].filter((e) => { const s = getComputedStyle(e); return (parseFloat(s.transitionDuration) > 0.011) || (s.animationName !== 'none' && parseFloat(s.animationDuration) > 0.011); }).map((e) => e.tagName + '.' + e.className).slice(0, 5));
    if (anim.length) problems.push('reduced motion: still animated → ' + anim.join(', ')); else ok('prefers-reduced-motion turns off animations and transitions');
    assert.equal(await p.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'auto'); await c.close(); }
} catch (e) { problems.push('ERROR ' + (e.stack || e)); }
finally {
  writeFileSync(join(ROOT, 'a11y-report.json'), JSON.stringify(report, null, 1)); await browser.close(); stop();
  const minor = report.filter((r) => !['serious', 'critical'].includes(r.impact));
  console.log(`\naxe: ${report.length} findings (${report.length - minor.length} serious/critical, ${minor.length} moderate/minor). Report: a11y-report.json`);
  if (problems.length) { console.error('\nA11Y PROBLEMS:\n' + [...new Set(problems)].join('\n')); process.exitCode = 1; } else console.log(`All ${n} accessibility checks passed`);
}
