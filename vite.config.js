import { defineConfig } from 'vite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { PUBLIC_PAGES, countyPage } from './src/paths.js';
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
// Same JS and CSS as /index.html; only <title>, description, canonical and Open Graph tags differ.
// main.js maps the path to the matching screen. Listed in public/sitemap.xml (scripts/make-sitemap.mjs).
const publicPages = () => {
  let outDir = 'dist';
  const attr = (t) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return {
    name: 'public-pages', apply: 'build',
    configResolved(c) { outDir = c.build.outDir; },
    closeBundle() {
      const html = readFileSync(`${outDir}/index.html`, 'utf8');
      const counties = JSON.parse(readFileSync(new URL('./public/data/counties.json', import.meta.url), 'utf8'));
      const pages = [...PUBLIC_PAGES, ...counties.map((c) => countyPage(c.name))];
      for (const pg of pages) {
        const url = SITE_URL + pg.path, title = `${pg.title} · ${APP_NAME}`, desc = `${pg.desc} ${APP_TAGLINE}`;
        const out = html
          .replace(/<title>[^<]*<\/title>/, `<title>${attr(title)}</title>`)
          .replace(/(<meta name="description" content=")[^"]*"/, `$1${attr(desc)}"`)
          .replace(/(<meta property="og:description" content=")[^"]*"/, `$1${attr(desc)}"`)
          .replace(/(<meta property="og:title" content=")[^"]*"/, `$1${attr(title)}"`)
          .replace(/(<link rel="canonical" href=")[^"]*"/, `$1${url}"`)
          .replace(/(<meta property="og:url" content=")[^"]*"/, `$1${url}"`);
        if (out === html || !out.includes(`href="${url}"`)) throw new Error('public-pages: could not rewrite head for ' + pg.path);
        // <path>.html: Netlify serves it at the extensionless URL (/hotels) with no trailing-slash redirect.
        mkdirSync(`${outDir}${pg.path.replace(/\/[^/]+$/, '')}`, { recursive: true });
        writeFileSync(`${outDir}${pg.path}.html`, out);
      }
    },
  };
};

export default defineConfig({ plugins: [branding(), functionsMiddleware(), publicPages()], server: { port: 5174 }, build: { target: 'es2020' } });
