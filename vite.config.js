import { defineConfig } from 'vite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { PUBLIC_PAGES, countyPage } from './src/paths.js';
import { OFFICIAL_SOURCES } from './src/content/official-sources.js';
import { APP_NAME, APP_SHORT_NAME, APP_TAGLINE, APP_DESCRIPTION, THEME_COLOR, SITE_URL } from './src/config.js';

// On Netlify builds (NETLIFY=true) the server-backed adapter is the default; locally the on-device
// adapter stays the default. VITE_DATA_ADAPTER=local|remote always wins.
process.env.VITE_DATA_ADAPTER ||= process.env.NETLIFY === 'true' ? 'remote' : 'local';

const manifest = () => JSON.stringify({
  name: APP_NAME, short_name: APP_SHORT_NAME, description: APP_DESCRIPTION,
  id: '/', start_url: '/', scope: '/', display: 'standalone', background_color: '#FFFFFF', theme_color: THEME_COLOR,
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: '/icons/mark.svg', sizes: 'any', type: 'image/svg+xml' },
  ],
}, null, 2);

// Runs the Netlify Functions in-process for `vite` and `vite preview`, so the app works locally
// with no Netlify CLI and no site. Nothing here logs request bodies (coordinates stay unlogged).
// Storage: the official Netlify Blobs local server (same sandbox `netlify dev` uses), on disk in
// NCDRH_BLOBS_DIR (default .netlify/blobs-local). Dev-only fixed secrets are used unless real ones are set.
const functionsMiddleware = () => {
  const ready = (async () => {
    if (!process.env.APP_SESSION_SECRET || !process.env.DATA_ENCRYPTION_KEY) process.env.NCDRH_DEV_INSECURE_SECRETS = '1';
    const { startLocalBlobs } = await import(new URL('./netlify/functions/lib/local-blobs.js', import.meta.url).href);
    return startLocalBlobs(process.env.NCDRH_BLOBS_DIR || new URL('./.netlify/blobs-local', import.meta.url).pathname);
  });
  let started;
  const handler = async (req, res, next) => {
    const m = /^\/\.netlify\/functions\/(api|overpass)(?:\?|$)/.exec(req.url || '');
    if (!m) return next();
    try {
      await (started ||= ready());
      const mod = await import(new URL(`./netlify/functions/${m[1]}.js`, import.meta.url).href);
      const chunks = []; for await (const c of req) chunks.push(c);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const r = await mod.default(new Request('http://localhost' + req.url, { method: req.method, headers: req.headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body }), { ip: req.headers['x-test-client-ip'] || req.socket.remoteAddress });
      res.statusCode = r.status; r.headers.forEach((v, k) => res.setHeader(k, v));
      res.end(Buffer.from(await r.arrayBuffer()));
    } catch (e) { res.statusCode = 500; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ error: 'Function error' })); }
  };
  return {
    name: 'local-netlify-functions',
    configureServer(s) { s.middlewares.use(handler); },
    configurePreviewServer(s) { s.middlewares.use(handler); },
  };
};

const branding = () => ({
  name: 'branding',
  transformIndexHtml: { order: 'pre', handler: (html) => html.replaceAll('%SITE_URL%', SITE_URL).replaceAll('%APP_NAME%', APP_NAME).replaceAll('%APP_SHORT_NAME%', APP_SHORT_NAME).replaceAll('%APP_DESCRIPTION%', APP_DESCRIPTION).replaceAll('%APP_TAGLINE%', APP_TAGLINE).replaceAll('%THEME_COLOR%', THEME_COLOR) },
  configureServer(s) { s.middlewares.use('/manifest.webmanifest', (_q, r) => { r.setHeader('content-type', 'application/manifest+json'); r.end(manifest()); }); },
  generateBundle() { this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifest() }); },
});

// Crawlable copies of the app shell for the public sections (/hotels, /insurance, /county/wake …), written as dist/<path>.html.
// Same JS and CSS as /index.html; <title>, description, canonical, Open Graph and structured data differ, and
// #app holds a plain-HTML version of the page (heading, summary, links; county offices with phone numbers)
// so search engines and slow connections see real content before the app starts. main.js replaces #app on
// first render. Listed in public/sitemap.xml (scripts/make-sitemap.mjs).
const ORG = { '@type': 'NGO', '@id': 'https://c4iveteranservices.org/#org', name: 'C4I Veteran Services Corp.', url: 'https://c4iveteranservices.org/' };
// Meta description: page summary plus tagline when it fits in 160 characters, else the summary alone, cut at a word.
export const metaDesc = (d) => {
  const both = `${d} ${APP_TAGLINE}`; if (both.length <= 160) return both; if (d.length <= 160) return d;
  return d.slice(0, 157).replace(/[\s,;:]+\S*$/, '') + '…';
};
const publicPages = () => {
  let outDir = 'dist';
  const attr = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const tel = (p) => (p ? `<a href="tel:${attr(String(p).replace(/[^\d+]/g, ''))}">${attr(p)}</a>` : '');
  const link = (u, label) => (u ? `<a href="${attr(u)}" rel="noopener">${attr(label)}</a>` : '');
  const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
  return {
    name: 'public-pages', apply: 'build',
    configResolved(c) { outDir = c.build.outDir; },
    closeBundle() {
      const html = readFileSync(`${outDir}/index.html`, 'utf8');
      const counties = JSON.parse(readFileSync(new URL('./public/data/counties.json', import.meta.url), 'utf8'));
      const countyPages = counties.map((c) => ({ ...countyPage(c.name), county: c }));
      const sections = PUBLIC_PAGES.filter((p) => !['/about', '/accessibility', '/delete-account', '/privacy', '/alerts'].includes(p.path));
      const nav = `<nav aria-label="Sections"><h2>Find help</h2><ul>${sections.map((p) => `<li><a href="${p.path}">${attr(p.title)}</a></li>`).join('')}</ul></nav>`;
      const countyList = `<h2>North Carolina counties</h2><ul class="cols">${countyPages.map((p) => `<li><a href="${p.path}">${attr(p.county.name)} County</a></li>`).join('')}</ul>`;
      const office = (title, o) => (o ? `<li><strong>${attr(o.name || o.title || title)}</strong>${o.phone ? ' · ' + tel(o.phone) : ''}${o.afterHours ? ' · after hours ' + tel(o.afterHours) : ''}${o.address ? '<br>' + attr(o.address) : ''}${o.url ? '<br>' + link(o.url, 'Website') : ''}</li>` : '');
      const countyBody = (c) => `<h2>County offices</h2><ul>${office('Emergency management', c.em)}${office('Department of Social Services', c.dss)}${office('Health department', c.health)}${office('Register of Deeds', c.rod)}${office('Fire marshal', c.fireMarshal)}${c.website?.url ? `<li><strong>${attr(c.name)} County government</strong><br>${link(c.website.url, 'Website')}</li>` : ''}</ul>${(c.ltrg || []).length ? `<h2>Long-term recovery groups</h2><ul>${c.ltrg.map((g) => `<li>${g.url ? link(g.url, g.name) : attr(g.name)}</li>`).join('')}</ul>` : ''}<p><a href="/fire-departments">Fire departments</a> · <a href="/school-districts">School districts</a> · <a href="/counties">All counties</a></p>`;
      // Official sources, readable without JavaScript (English): not-a-government notice, then each group.
      const sourcesBody = () => `<p><strong>Not a government app.</strong> ${attr(APP_NAME)} is a project of C4I Veteran Services Corp., a 501(c)(3) nonprofit. It is not a government agency and does not represent FEMA, the State of North Carolina, any county or any agency listed here.</p>` +
        [['nc', 'North Carolina government'], ['federal', 'Federal government'], ['tribal', 'Tribal government'], ['other', 'Other organizations (not government)']].map(([g, h]) => `<h2>${h}</h2><ul>${OFFICIAL_SOURCES.filter((s) => s.group === g).map((s) => `<li><strong>${attr(s.name.en)}</strong>${s.url ? '<br>' + link(s.url, s.url) : ''}<br>${attr(s.uses.en)}</li>`).join('')}</ul>`).join('');
      const body = (pg, extra) => `<div class="prerender"><p class="small"><a href="/">${attr(APP_NAME)}</a> · ${attr(APP_TAGLINE)}</p><h1>${attr(pg.title)}</h1><p>${attr(pg.desc)}</p>${extra || ''}${nav}</div>`;
      const site = { '@context': 'https://schema.org', '@graph': [{ '@type': 'WebSite', '@id': SITE_URL + '/#site', name: APP_NAME, url: SITE_URL + '/', inLanguage: ['en', 'es'], publisher: { '@id': ORG['@id'] } }, ORG] };
      const crumbs = (items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE_URL + path })) });
      const write = (file, pg, url, extra, extraLd) => {
        const title = pg.path === '/' ? `${APP_NAME} · Disaster help in North Carolina` : `${pg.title} · ${APP_NAME}`, desc = metaDesc(pg.desc);
        const out = html
          .replace(/<title>[^<]*<\/title>/, `<title>${attr(title)}</title>`)
          .replace(/(<meta name="description" content=")[^"]*"/, `$1${attr(desc)}"`)
          .replace(/(<meta property="og:description" content=")[^"]*"/, `$1${attr(desc)}"`)
          .replace(/(<meta property="og:title" content=")[^"]*"/, `$1${attr(title)}"`)
          .replace(/(<link rel="canonical" href=")[^"]*"/, `$1${url}"`)
          .replace(/(<meta property="og:url" content=")[^"]*"/, `$1${url}"`)
          .replace('</head>', `${ld(site)}${extraLd ? ld(extraLd) : ''}\n</head>`)
          .replace(/<div id="app">[\s\S]*?<\/div>(?=\s*(<\/body>|<script))/, `<div id="app">${body(pg, extra)}</div>`);
        if (out === html || !out.includes(`href="${url}"`) || !out.includes('class="prerender"')) throw new Error('public-pages: could not rewrite ' + file);
        writeFileSync(file, out);
      };
      // Home (/index.html is also the app shell for hash routes; its content is replaced on load like the others).
      write(`${outDir}/index.html`, { path: '/', title: 'Help after a disaster in North Carolina', desc: 'Find shelter, phone numbers for your county, free legal help and step-by-step guides after a fire, flood or hurricane. Keep your case numbers and notes in one private place.' }, SITE_URL + '/', countyList);
      for (const pg of [...PUBLIC_PAGES, ...countyPages]) {
        const url = SITE_URL + pg.path;
        // <path>.html: Netlify serves it at the extensionless URL (/hotels) with no trailing-slash redirect.
        mkdirSync(`${outDir}${pg.path.replace(/\/[^/]+$/, '')}`, { recursive: true });
        const extra = pg.county ? countyBody(pg.county) : pg.path === '/counties' ? countyList : pg.path === '/official-sources' ? sourcesBody() : '';
        const trail = pg.county ? crumbs([['Home', '/'], ['County services', '/counties'], [`${pg.county.name} County`, pg.path]]) : crumbs([['Home', '/'], [pg.title, pg.path]]);
        write(`${outDir}${pg.path}.html`, pg, url, extra, trail);
      }
    },
  };
};

export default defineConfig({ plugins: [branding(), functionsMiddleware(), publicPages()], server: { port: 5174 }, build: { target: 'es2020' } });
