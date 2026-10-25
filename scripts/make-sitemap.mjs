// Writes public/sitemap.xml (and checks public/robots.txt points at it) from src/paths.js and
// public/data/counties.json. Public pages only: no account, notes, share, submit, admin or API URLs.
// Usage: node scripts/make-sitemap.mjs [YYYY-MM-DD]   (lastmod; default: today, America/New_York)
// Run it after any data rebuild (npm run sitemap) so lastmod moves with the data.
import { readFileSync, writeFileSync } from 'node:fs';
import { PUBLIC_PAGES, countyPage } from '../src/paths.js';

const SITE = 'https://disaster-resources.app';
const lastmod = process.argv[2] || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
if (!/^\d{4}-\d{2}-\d{2}$/.test(lastmod)) throw new Error('lastmod must be YYYY-MM-DD');
const root = new URL('../', import.meta.url);
const counties = JSON.parse(readFileSync(new URL('public/data/counties.json', root), 'utf8'));
const urls = [
  { loc: SITE + '/', pr: '1.0' },
  ...PUBLIC_PAGES.map((p) => ({ loc: SITE + p.path, pr: '0.8' })),
  ...counties.map((c) => ({ loc: SITE + countyPage(c.name).path, pr: '0.6' })),
];
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${lastmod}</lastmod><priority>${u.pr}</priority></url>`).join('\n')}
</urlset>
`;
writeFileSync(new URL('public/sitemap.xml', root), xml);
if (!readFileSync(new URL('public/robots.txt', root), 'utf8').includes(`Sitemap: ${SITE}/sitemap.xml`)) throw new Error('public/robots.txt is missing the Sitemap line');
console.log(`public/sitemap.xml: ${urls.length} URLs, lastmod ${lastmod}`);
