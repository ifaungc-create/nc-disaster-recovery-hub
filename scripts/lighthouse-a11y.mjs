// Lighthouse accessibility scores for key pages in English and Spanish (needs Lighthouse CLI; path via LIGHTHOUSE env).
import { chromium } from 'playwright-core';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
const ROOT = new URL("..", import.meta.url).pathname; const BASE = "http://localhost:4177";
const env = { ...process.env, VITE_DATA_ADAPTER: 'remote', NCDRH_BLOBS_DIR: '/tmp/lhblobs', NCDRH_DEV_INSECURE_SECRETS: '1' };
const srv = spawn('npx', ['vite', 'preview', '--port', '4177', '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true, env });
for (let i = 0; i < 80; i++) { try { await fetch(BASE); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
const out = {}; mkdirSync('/tmp/lh', { recursive: true });
for (const lang of ['en', 'es']) {
  const chrome = spawn('/usr/bin/google-chrome', ['--headless=new', '--no-sandbox', '--remote-debugging-port=9333', `--user-data-dir=/tmp/lhprof-${lang}`, 'about:blank'], { stdio: 'ignore', detached: true });
  await new Promise((r) => setTimeout(r, 2000));
  const b = await chromium.connectOverCDP('http://localhost:9333'); const pg = await b.contexts()[0].newPage(); await pg.goto(BASE + '/'); await pg.evaluate((l) => localStorage.setItem('ncdrh.lang', l), lang); await pg.close(); await b.close();
  for (const path of ['/', '/translation', '/alerts', '/accessibility', '/delete-account', '/hotels', '/insurance', '/privacy', '/about', '/county/wake', '/#login', '/#signup']) {
    const f = `/tmp/lh/${lang}${path.replace(/[\/#]/g, '_')}.json`;
    try { execFileSync(process.env.LIGHTHOUSE || 'lighthouse', [BASE + path, '--port=9333', '--disable-storage-reset', '--only-categories=accessibility', '--output=json', '--output-path=' + f, '--quiet', '--form-factor=mobile'], { stdio: 'ignore', timeout: 120000 }); } catch (e) { out[lang + path] = 'ERR'; continue; }
    const j = JSON.parse(readFileSync(f)); const fails = Object.values(j.audits).filter((a) => a.score === 0 && a.scoreDisplayMode === 'binary').map((a) => a.id);
    out[lang + path] = Math.round(j.categories.accessibility.score * 100) + (fails.length ? ' fails: ' + fails.join(',') : '');
  }
  try { process.kill(-chrome.pid); } catch {}
}
try { process.kill(-srv.pid); } catch {}
console.log(JSON.stringify(out, null, 1));
