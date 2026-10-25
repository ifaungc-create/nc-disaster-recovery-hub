// Renders public/icons/mark.svg to PNG app icons with the system Chrome (no network).
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const svg = readFileSync(new URL('../public/icons/mark.svg', import.meta.url), 'utf8');
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await b.newPage();
for (const [name, size, pad] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['icon-512-maskable.png', 512, 0.12], ['apple-touch-icon.png', 180, 0]]) {
  await p.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * (1 - 2 * pad));
  await p.setContent(`<body style="margin:0;background:#12355B;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</body>`);
  await p.screenshot({ path: new URL(`../public/icons/${name}`, import.meta.url).pathname });
}
await b.close(); console.log('icons done');
