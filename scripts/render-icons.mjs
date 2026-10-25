// Renders PNG icons/graphics from SVG with the system Chrome (no extra tools): notification badge,
// Android launcher + splash PNGs, Play Store 512 icon and 1024x500 feature graphic.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
const ROOT = new URL('..', import.meta.url).pathname;
const HOUSE = 'M32 12 10 31h6v19h32V31h6z', HEART = 'M32 46s-10-6.3-10-12.4A5.6 5.6 0 0 1 32 30a5.6 5.6 0 0 1 10 3.6C42 39.7 32 46 32 46z';
const mark = (rx = 14) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="${rx}" fill="#12355B"/><path d="${HOUSE}" fill="#fff"/><path d="${HEART}" fill="#1F5C99"/></svg>`;
const mono = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="8 8 48 48"><path fill-rule="evenodd" d="${HOUSE} ${HEART}" fill="#fff"/></svg>`;
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const render = async (svgOrHtml, w, h, out, transparent = false) => {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const html = svgOrHtml.startsWith('<svg') ? `<style>html,body{margin:0;background:transparent}svg{display:block;width:${w}px;height:${h}px}</style>${svgOrHtml}` : svgOrHtml;
  await p.setContent(html); mkdirSync(dirname(ROOT + out), { recursive: true });
  await p.screenshot({ path: ROOT + out, omitBackground: transparent }); await p.close();
};
await render(mono, 96, 96, 'public/icons/badge-96.png', true);
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, s] of Object.entries(dens)) {
  await render(mark(14), 48 * s, 48 * s, `android/app/src/main/res/mipmap-${d}/ic_launcher.png`, true);
  await render(mono, 24 * s, 24 * s, `android/app/src/main/res/drawable-${d}/ic_notification_icon.png`, true);
}
await render(mark(14), 300, 300, 'android/app/src/main/res/drawable-nodpi/splash.png', true);
await render(mark(0), 512, 512, 'docs/play-store/graphics/icon-512.png');
await render(`<!doctype html><html><body style="margin:0;width:1024px;height:500px;background:#12355B;font-family:Arial,Helvetica,sans-serif;color:#fff;display:flex;align-items:center;gap:48px;padding:0 64px;box-sizing:border-box">
${mark(28).replace('<svg ', '<svg style="width:240px;height:240px;flex:none" ')}
<div><div style="font-size:56px;font-weight:700;line-height:1.1">NC Disaster<br>Recovery Hub</div>
<div style="font-size:28px;margin-top:18px;line-height:1.3">Shelter, county help, free legal aid<br>and your case numbers in one place</div>
<div style="font-size:20px;margin-top:18px;opacity:.85">English · Español</div></div></body></html>`, 1024, 500, 'docs/play-store/graphics/feature-graphic-1024x500.png');
await b.close(); console.log('icons rendered');
