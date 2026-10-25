# NC Disaster Recovery Hub (prototype)

**Created by Donnell Nichols. A project of C4I Veteran Services Corp.**

Open source under the [MIT License](LICENSE). Please keep the credit to Donnell Nichols and C4I Veteran Services Corp. when you reuse this code; see [NOTICE.md](NOTICE.md) for credits and data licenses (hotel and store data © OpenStreetMap contributors, ODbL).


A mobile-first PWA for people in North Carolina affected by fires, floods and hurricanes, and for the responders who help them.
**Branding:** the name is "NC Disaster Recovery Hub" with the tagline "A project of C4I Veteran Services Corp.". Both live in `src/config.js` (`APP_NAME`, `APP_TAGLINE`, `APP_DESCRIPTION`) and appear in:
- the header on every screen
- the sign-in, sign-up, privacy and About & disclaimer pages
- the footer, the manifest description and the meta/Open Graph tags

**Contact and disclaimer:**
- **Contact:** `CONTACT_EMAIL` (info@c4iveteranservices.org) appears as "Problems with the app? Email …" in the footer, in Settings and on the About & disclaimer page (`#about`).
- **Disclaimer:** the page carries the exact approved text (`DISCLAIMER`). It is linked from the footer, sign-up and privacy, and the home screen shows a short version.
- **Report links:** every resource, county office, fire department, school and community entry has a "Report a broken link or number" mailto with the item name in the subject.

**Live hotel check:** the "Check the live map" hotel button is off (`HOTEL_LIVE_CHECK`). To turn it on, build with `VITE_HOTEL_LIVE_CHECK=1`.

**Status: live** at https://disaster-resources.app (Netlify site `disaster-resources-lltd`, deployed with the Netlify connector; sitemap added in deploy `6ada195d8d46c43aa4f58281`, 2026-10-22). Nothing was pushed to GitHub, and no Salesforce org is involved.
The structure follows `/workspace/c4i-hub-app`: Vite plus vanilla JS, a hash router with a `screens` object, data adapters in `src/data/`, and Netlify Functions using HMAC session tokens. That project was not modified.

## Features

| Area | What it does |
|---|---|
| **Accounts** | Server-side on Netlify Blobs (encrypted). *Person affected by a disaster* gets in right away; *Disaster responder* waits for admin approval. Admins come from `ADMIN_EMAILS`, but an admin email gets admin rights only after it is proven with a one-time code (see *Admin access* below). Forgotten passwords are reset with a one-time code an admin gives by phone or in person (no email service). Admins can find an account by email and delete it permanently. Sessions end when the app closes unless you tick "keep me signed in". No cookies. |
| **Responder records + admin** | Approved responders submit organizations, services, shelters, numbers and links with a source URL. Admins approve (optionally editing), reject, edit after publishing, or unpublish them; approved records appear in resource sections and county pages labeled "Added by a verified responder, approved <date>". Admin actions are logged. |
| **Share cards** (responders) | A responder makes a card with their own contact details and next steps. The client gets it from a **QR code** or an **8-character short code** (e.g. `FH74-BE8T`). The client must tick a consent box before anything is saved, and the card becomes a note in the client's private notes. The responder never sees client data; they only see a save count. Cards expire after 30 days and can be turned off. The form warns responders not to include client PII. The QR code carries the card in the URL *fragment* (`#claim/d/…`), so it works on any device with no server, and the fragment is never sent to a server. |
| **My Notes** (private) | **Case numbers** by agency (Red Cross, FEMA, insurance claim, SBA, NCEM, Other), each with a contact, phone, email, date opened and next-step date. **Free-form notes.** **Referral tracker**: referred by, referred to, for what, status (not started / contacted / waiting / done), follow-up date with due and past-due badges, and quick status changes. Full create, edit and delete. |
| **Resources** | Housing & shelter, relocating, free legal help, jobs & income (NCWorks, DUA), step-by-step document replacement (SSA card, NCDMV license/ID, NC birth certificate through Vital Records or the Register of Deeds, bank and credit cards with fraud alerts and freezes, passport, Medicaid/Medicare/EBT cards), relief organizations, how to get a fire report (local FD, county fire marshal, what OSFM does), insurance (coverage basics, claims, NCDOI help line, NFIP, NCJUA/NCIUA, and a neutral alphabetical insurer list with a disclaimer), and board-up/cleanup companies (a prominent warning about work authorizations, AOB and direction-to-pay forms, citing NCDOI; uncovered costs; your right to choose the vendor; contractor license lookup). |
| **County pages** (100) | Emergency management (plus alert signup), DSS (plus after-hours number), health department, Register of Deeds (plus online certificate ordering), county website, county fire marshal or emergency services, long-term recovery groups (35 counties), school districts, and the nearest fire departments. EBCI emergency management appears for Jackson, Swain, Graham, Cherokee and Haywood. |
| **School districts** | All 115 NC LEAs (100 county + 15 city) plus 2 state schools, with website and phone. |
| **Fire department locator** | Every NC fire department and station from static JSON. Search by name/city, ZIP or county, with a county filter and distance sort from your location or a ZIP centroid. Each result has a non-emergency phone and directions. |
| **Hotels & motels nearby** | **On-device search** of `public/data/hotels.json`: 2,079 named `tourism=hotel|motel` places (525 motels) in 93 counties, from the OpenStreetMap extract dated **2026-10-21 00:05 UTC** (download.openstreetmap.fr `us-south/north-carolina.osm.pbf`, built with `scripts/build_hotels.py`, pyosmium). Searches use your location (only when you tap) or a ZIP code / city, sort by distance, and cover 10 miles, widening to 25 miles if fewer than 5 are found. **No location leaves the phone**, and it works offline (precached). An **optional** "Check the live map" button calls `netlify/functions/overpass.js`. That function snaps the position to a 0.1° (~10 km) cell and tries public mirrors in order: overpass.private.coffee (formerly kumi.systems), then maps.mail.ru. overpass-api.de is excluded because its policy asks netlify.app apps not to use it. Each mirror gets a 4.5 s timeout, with a 9 s budget overall, an identifying User-Agent and `out center tags 200`. Results are cached per cell in Blobs for a day. It logs only mirror host, status, timing and cache hit/miss. Each result has Call (when listed), **Check on Google Maps**, **Apple Maps** and Directions buttons, a Website, Chain website or Email link when the data has one, and "Call ahead to confirm availability and price." The map buttons are plain links (`target=_blank`, `rel="noopener noreferrer"`, no prefetch): Google `https://www.google.com/maps/search/?api=1&query=<name, address>` and Apple `https://maps.apple.com/?q=<name, address>&sll=<lat,lon>`, so the place's live listing (phone, website, hours, reviews) opens only when tapped. Above the list, "Search hotels near me / near <ZIP or town> on Google Maps" (and Apple Maps) uses the typed place or the position rounded to 2 decimals (~1 km). A "Disaster hotel help" card covers FEMA TSA (femaemergencyhotels.com lookup, confirmed linked from fema.gov), DisasterAssistance.gov, the FEMA Helpline, NC 211 and the Red Cross. Data fields: phones from `phone`, `contact:phone`, `contact:mobile`, `mobile`; website from `website`, `contact:website`, `url` (https only); chain site from `brand:website`/`operator:website`, or the https origin that at least 3 properties of the same `brand:wikidata` link to; `email`; full address from `addr:*`. Counts (2026-10-21 extract): 997 with a phone, 899 with their own website plus 269 with a chain website (1,168 any), 95 with email, 1,750 with a full street address (number, street, city, ZIP). See `docs/hotel-live-data-options.md` for the cost of a live phone/website API. |
| **Get a phone number** | Lifeline (FCC), TextNow and Google Voice, with honest requirements. No in-app phone number (see below). |
| **Use my location → county** | Point-in-polygon against bundled Census county boundaries, **on the device**. Saves the county and coordinates rounded to ~100 m in localStorage so county services and nearby fire departments show first. "Forget my location" is in Settings. |
| **Crisis bar** | Always on screen: 911, 988, NC 211 (with 1-888-892-1162 in its label) and Red Cross 1-800-RED-CROSS (1-800-733-2767). |
| **Privacy** | No analytics, trackers, ad SDKs, cookies, third-party fonts or CDNs (the e2e test fails on any non-same-origin request). There is a plain-language privacy page. Settings has "Download my data" (JSON export) and "Delete my account" (type DELETE to confirm). A strict CSP is set in `netlify.toml`. |
| **Translation & interpreters** (`/translation`) | Free translation apps with official store links (Google Translate, Microsoft Translator, Apple Translate, Google Lens), step-by-step use of the translation built into iPhone, Android, Pixel and Samsung phones, free-interpreter rights only as far as the linked sources say (FEMA helpline languages, health programs that get federal money, NC 211), a note that the app itself is English/Spanish, and an **optional** "Open in Google Translate" link that is only followed when tapped (with a privacy note). Content: `src/content/translation.js`. |
| **Alerts (Web Push)** (`/alerts`) | Opt-in only after a tap. Everyone who turns alerts on gets statewide alerts; they can also add up to 10 counties. Works in the PWA, the Android app and on iPhone/iPad (iOS/iPadOS 16.4+ after Add to Home Screen). Stores only the push address, topics and language (encrypted, not linked to an account); "Turn off alerts" deletes it. Admins send to Statewide or to several counties at once, compose EN+ES (a warning shows if the Spanish is empty), can send a test to their own device only, and confirm before sending; every send is logged. Not an emergency alert system (the screen says so). |
| **Accessibility** (`/accessibility`) | WCAG 2.1 AA target, tested with axe-core and Lighthouse in English and Spanish; statement page with the contact email, linked from the footer and About. |
| **Android app** | Trusted Web Activity in `android/` (package `app.disasterresources.nchub`, target SDK 36). See `android/README.md` and `docs/play-store/`. |
| **Account deletion page** (`/delete-account`) | Public page (required by Google Play) explaining in-app deletion and email requests. |
| **Offline** | The service worker precaches the shell, built assets and all `/data/*.json`, so resources, county pages and the fire finder work offline. |

Design: calm navy/white, high contrast, 18px base text, 48–56px tap targets, mobile-first with a fixed bottom nav, and a text plus SVG mark (`public/icons/mark.svg`; PNG icons are generated from it by `npm run icons`).

## How to run

```bash
cd /workspace/nc-disaster-hub
npm install
npm run dev          # http://localhost:5174, on-device adapter; functions run in-process via a Vite plugin
VITE_DATA_ADAPTER=remote npm run dev   # server adapter on a local Netlify Blobs server (.netlify/blobs-local)
npm run build        # dist/ (on-device adapter; on Netlify NETLIFY=true selects the server adapter)
npm run preview      # http://localhost:4174, production build, functions in-process too
npm test             # unit (77) + e2e on Netlify Blobs (45 checks) + e2e on-device (34 checks)
npm run test:unit    # functions against the official Netlify Blobs local server, in a temp folder
npm run test:e2e     # Playwright on the production build, server adapter, Blobs local server
npm run test:e2e:local   # same suite, on-device adapter (admin steps skipped)
npm run test:a11y    # axe-core on every screen in English and Spanish, including the admin screens
npm test             # all of the above
npm run data         # rebuild public/data/*.json from data-raw/ (no network), then public/sitemap.xml (lastmod = today)
npm run sitemap      # only rewrite public/sitemap.xml; pass a date to pin lastmod: npm run sitemap -- 2026-10-22
python3 scripts/linkcheck.py [extra-urls.json] [--retry]   # re-check links (network)
```

Local dev and tests use `BlobsServer` from `@netlify/blobs/server` (the library's official local mode) with a small test shim (`netlify/functions/lib/local-blobs.js`). The shim makes the local server's conditional writes atomic and gives it content-hash ETags like production. They run with built-in throwaway secrets (`NCDRH_DEV_INSECURE_SECRETS=1`), which production refuses. `netlify dev` also works once the site is linked; it was not used here because linking is a site action.

The e2e tests use `playwright-core` with the system Chrome (`/usr/bin/google-chrome`) at a 390×844 mobile viewport. Screenshots go to `screenshots/`, including the pending responder, admin, submission and published-record screens (05a, 15–19).

## Storage, security and configuration

When deployed on Netlify the app is built with `VITE_DATA_ADAPTER=remote` (set in `netlify.toml`). All accounts and data are kept server-side in **Netlify Blobs**, in one site-scoped store (`ncdrh` by default). The on-device adapter (`src/data/local.js`, localStorage only) stays available for dev and offline demos: `npm run dev` uses it unless `VITE_DATA_ADAPTER=remote` is set. A Netlify build bundles only the remote adapter.

| Topic | How it works |
|---|---|
| Passwords | scrypt N=2^17, r=8, p=1, 64-byte key, random salt (about 0.3 s per hash). The cost is stored in each hash. Compared with `timingSafeEqual`. An unknown email still runs a dummy hash so timing does not reveal which emails exist. Emails are normalized (trim, NFKC, lowercase), and duplicates are blocked by an atomic `onlyIfNew` write. |
| Sessions | HMAC-SHA256 bearer tokens (12 h) signed with `APP_SESSION_SECRET`, kept in sessionStorage (or localStorage with "keep me signed in"). No cookies. Every call re-checks that the user still exists. |
| Encryption at rest | AES-256-GCM. Each user's notes, cases, referrals and share-card list use their own key, derived with HKDF from `DATA_ENCRYPTION_KEY` + the user id. Each share card has its own key per code. The blob key is bound as AAD, so a blob copied to another key fails to decrypt. Emails are stored only as an HMAC blind index. |
| Concurrency | Every write is a conditional write (`onlyIfMatch` ETag / `onlyIfNew`) with up to 10 retries using jittered backoff; after that the API answers 409 and nothing is lost. Strong consistency reads. |
| Share codes | Server-side, so a typed code works on any phone. 30-day expiry, revocable, consent checkbox required, save count only. The responder never sees who saved it. |
| Rate limits | Per IP **hash** (HMAC of the IP, truncated; raw IPs are never stored) in fixed windows: login 10 per 15 min, register 5 per hour, share-code lookup 30 per 15 min, hotel search 30 per 15 min. Over the limit → 429 with `Retry-After`. |
| Logging | Functions log only `[api] failed <action> <error name>`, plus `[admin-code]` lines that carry a one-time admin code and the first 8 characters of the account id (see *Admin access*). No emails, notes, coordinates or IPs. |
| Limits / validation | 64 KB request body, 1,000 records per type, 300 share cards, 2 MB per blob. Every field is validated and trimmed server-side (`src/data/shared.js`, used by both adapters). |
| Export / delete | Export returns JSON of everything (including records you submitted). Delete (by the person in Settings, or by an admin in **Admin → Accounts**) removes every blob for the user: account, email index, data, share cards, submissions, responder request and any open one-time code. The admin deletion is logged with the account id and reason only, never the name or email. Alert subscriptions are not linked to accounts, so they are not part of this; the app turns off alerts on the device when a person deletes their own account. Records an admin already published stay public; they carry no submitter identity. |
| Cleanup | `netlify/functions/cleanup.js` runs hourly (scheduled function). It deletes old rate-limit windows, share cards expired more than 7 days ago, and expired one-time codes. |
| One-time codes | Password reset (2 hours), admin recovery and admin claim (30 minutes). Format `XXXXX-XXXXX`; case and spaces don't matter. Stored only as an HMAC hash (`code/<uid>`), single use, 5 wrong tries end the code, a new code replaces the old one. Using a reset or recovery code signs the account out everywhere. |
| Fail closed | If `APP_SESSION_SECRET` or `DATA_ENCRYPTION_KEY` is missing or too short, the API answers 503 and stores nothing. The dev-only escape hatch `NCDRH_DEV_INSECURE_SECRETS=1` is ignored when `CONTEXT=production`. |

Blob keys: `user/<uid>` (sealed), `email/<hmac>` → uid, `data/<uid>` (sealed), `card/<code>` (sealed, expiry in metadata), `resp/<uid>` and `sub/<uid>/<id>` (sealed with the admin-queue key), `community/approved` (plaintext; public on purpose), `audit/<time>-<rand>`, `code/<uid>` (hashed one-time code), `rl/<group>/<window>/<iphash>`.

### Responder approval, record submissions and the admin area

- **Affected people** get instant access. **Responders** register as *pending*. Until an admin approves them they can use the app like anyone else, but share cards and record submissions are blocked by the server (403) and the UI shows a "waiting for admin approval" notice.
- **Approved responders** can submit records at `#submit`: an organization, service, shelter, phone number or link, with a category, a county or Statewide, a description, phone/link and a required https **source URL**. Submissions are visible only to the submitter and admins until approved. A responder can have at most 50 pending.
- **Admins** are accounts whose normalized email is listed in `ADMIN_EMAILS` **and** that proved the email with a one-time code (see *Admin access*). Both are checked on every request, so removing an email takes effect immediately. The admin area at `#admin` has six tabs:
  - **Responders:** pending requests (approve, or deny with an optional reason), approved responders (revoke), and denied/revoked responders (approve after all). Deny and revoke also turn off all of that responder's share codes.
  - **Submissions:** each pending record is an editable form. Approve (with or without edits), or reject with an optional reason the responder sees.
  - **Published:** edit a published record in place (with an optional reason; the changed fields go in the Log) or unpublish it.
  - **Alerts:** see *Sending an alert* below.
  - **Accounts:** find an account by email; give a password reset code (or, for another admin address, a claim code); delete the account permanently after typing its email again.
  - **Log:** the last 100 admin actions.
- Approved records are merged into the matching resource section (by category) and the matching county page (by county). There is also an "Added by verified responders" list. Each record is labeled **"Added by a verified responder, approved <date>"** and cached on the device for offline use. Rejected and pending records are never returned by the public API.
- The **audit log** stores the admin email, the action, a target id (`user:<uid>` / `submission:<id>`), the time and the optional reason. It never stores client data or record contents.
- **Responders and admins never see client notes.** No API returns another user's notes, cases or referrals. Admin screens show only responder name/email/org and submitted public records.
- On-device mode has no admin: responders are treated as approved, and submissions need the online version.

### Admin access (claiming, recovery) and password reset

There is no email service, so proof of an email works through the server's own log, which only people with access to the Netlify site can read.

- **Claim admin:** register (or sign in) with the admin email. **Settings → Confirm admin access → Write a code to the server log.** Open Netlify → the site → **Logs → Functions → api** and find the line `[admin-code] Admin claim code for account …: XXXXX-XXXXX`. Type the code in Settings. Until then the account is an ordinary account and the admin area says so.
- **Admin recovery** (forgot the password, or someone else registered the admin email first): on the sign-in page, **Forgot your password? → Administrators: get a recovery code**. The code appears in the function log; enter it with a new password on the same page. This also confirms admin access, and if the address belongs to an account that never confirmed it, that account's password is replaced and its sessions are ended.
- **Everyone else:** an admin opens **Admin → Accounts**, finds the account, checks who they are by phone or in person, and taps **Give a password reset code**. The person enters email, code and a new password at **Sign in → Forgot your password?**. Every session for that account is signed out.
- A confirmed admin can also give a claim code for another address in `ADMIN_EMAILS` from **Admin → Accounts**.
- Limits: codes sit in plain text in the function log until they expire (30 minutes); asking again replaces an open code (rate-limited to 10 per hour per IP).

### Environment variables

Set these in the Netlify UI (**Site configuration → Environment variables**), scope **Functions** (or All), for the Production context and any deploy previews you use. Do **not** put secrets in `netlify.toml`. Build-time variables from `netlify.toml` are not passed to functions at runtime. **After you add or change a variable, redeploy** (Deploys → Trigger deploy → Deploy site, or a new CLI deploy): running functions keep the old values until the next deploy.

| Name | Secret? | Required | Value / how to generate |
|---|---|---|---|
| `APP_SESSION_SECRET` | **Secret** | Yes | 32+ characters. `openssl rand -base64 48`. Rotating it signs everyone out and resets rate-limit counters, and that is all it affects. |
| `DATA_ENCRYPTION_KEY` | **Secret** | Yes | Exactly 32 bytes, base64. `openssl rand -base64 32`. **Back it up offline.** If it is lost or changed, all stored accounts and notes become unreadable. Rotation is not implemented. |
| `ADMIN_EMAILS` | Not secret (but keep private) | Yes, for admin features | Comma-separated emails, e.g. `dn22@c4iveteranservices.org`. Case and spaces don't matter. |
| `SCRYPT_LOG_N` | No | Optional | Password hash cost exponent, 15–18 (default 17). |
| `NCDRH_BLOBS_STORE` | No | Optional | Blobs store name (default `ncdrh`). |
| `OVERPASS_URL` | No | Optional | Comma-separated Overpass mirrors for the optional live hotel check (default: overpass.private.coffee, then maps.mail.ru). |
| `VITE_DATA_ADAPTER` | No | Already set in `netlify.toml` | `remote`. |
| `NODE_VERSION` | No | Already set in `netlify.toml` | `22` (`@netlify/blobs` needs Node ≥ 22.12). |
| `VAPID_PUBLIC_KEY` | No | Yes, for alerts | Web Push application server key (base64url). Generate a pair with `npx web-push generate-vapid-keys`. |
| `VAPID_PRIVATE_KEY` | **Secret** | Yes, for alerts | The matching private key. Changing the pair invalidates every existing alert subscription (people must turn alerts on again). Without the keys, alerts fail closed (HTTP 503). |
| `VAPID_SUBJECT` | No | Yes, for alerts | `mailto:info@c4iveteranservices.org` (push services contact this address about problems). |
| `NCDRH_DEV_INSECURE_SECRETS`, `NCDRH_BLOBS_DIR` | – | **Never set on Netlify** | Dev/test only: built-in throwaway secrets and the local Blobs folder. |

Netlify Blobs needs no keys. Functions on Netlify get the Blobs context automatically.

### Deploy to the new Netlify site (`disaster-resources-lltd`)

Site: `disaster-resources-lltd`, site ID `18e940b2-6480-491e-b478-a649e9cab395`, https://disaster-resources-lltd.netlify.app (visitor access protection off; deployed to production with the Netlify connector).

1. **Env vars** (Functions scope, Production): `APP_SESSION_SECRET`, `DATA_ENCRYPTION_KEY`, `ADMIN_EMAILS=dn22@c4iveteranservices.org`. Store copies of both secrets in a password manager.
2. **Deploy** the repo with the build from `netlify.toml` (`npm run build`, publish `dist`, functions `netlify/functions`). Use either a Git-linked deploy or a CLI deploy (`netlify deploy --build --prod --site 18e940b2-6480-491e-b478-a649e9cab395` after `npm ci`). The scheduled `cleanup` function runs only on the published production deploy.
3. **Smoke test while SSO protection is still on:** open the site, sign up as an affected person, add a note, then export and delete. Check **Logs → Functions** shows no errors (a 503 on `/api` means a secret is missing or malformed). Same-origin function calls carry the SSO session; to verify on the live site.
4. **Claim the admin account:** register `dn22@c4iveteranservices.org` and confirm it with a code from the function log (see *Admin access*). Registering the email alone gives no admin rights, and the admin recovery code takes the address back if someone else registered it first.
5. **Custom domain:** in Netlify, **Domain management → Add a domain** → `disaster-resources.app`, and add `www.disaster-resources.app`. Make the apex primary. Then add the DNS records below, wait for verification, and let Netlify provision the Let's Encrypt certificate (HTTPS → force).
6. Turn **visitor protection off** only when you are ready for the public. Print QR codes only after the domain works, because they point at `https://disaster-resources.app`.

### Cloudflare DNS for disaster-resources.app

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `@` (disaster-resources.app) | `75.2.60.5` | **DNS only** (grey cloud) |
| CNAME | `www` | `disaster-resources-lltd.netlify.app` | **DNS only** (grey cloud) |

- Remove any other A/AAAA/CNAME records for `@` and `www`.
- Keep the proxy off. Netlify must answer the certificate challenge itself, and it advises against putting another CDN in front of its own.
- If a CAA record exists, it must allow `letsencrypt.org`.
- `netlify.toml` 301-redirects `www` to the apex.

The canonical URL is `SITE_URL` in `src/config.js` (`https://disaster-resources.app`). It is used for share-card QR codes (except on localhost), the canonical link and the Open Graph tags.

### What is still not real

| Piece | Status |
|---|---|
| Hotel data freshness | The on-device list is a snapshot. Refresh it with `python3 scripts/build_hotels.py north-carolina.osm.pbf north-carolina.state.txt` (needs `pip install osmium shapely`). The optional live check depends on volunteer-run public mirrors. |
| Email verification, self-service password reset by email | Not built (needs an email provider). Instead, admins give one-time reset codes and admin emails are proven with a code from the function log. Ordinary accounts' emails are not verified. |
| Alert subscriptions and accounts | Not linked. An admin deleting an account cannot turn off alerts on that person's device; the person can tap "Turn off alerts", and dead addresses are removed when a send fails. |
| Encryption key rotation | Not built. |
| Backups | Netlify Blobs has no point-in-time restore here. Decide on a periodic export if needed. |

## Data sources (all fetched 2026-10-22 unless noted)

| Data | Source | Notes |
|---|---|---|
| Fire departments, `public/data/fire-departments.json` | NC OSFM (NCDOI) ArcGIS: *OSFM_Fire_Stations_FL* (2,166 records, last edited 2023-08-30) and *Fire_Dept_by_Senate_Region* (1,212 departments, 2023-03-24), cross-checked against the **OSFM Department Directory PDF dated 2026-10-07** (ncosfm.gov) for current names and phones | 2,093 listings (2,083 stations + 10 department-level entries); **1,213 fire departments (FDIDs)**, 1,212 confirmed current: 1,211 in the Oct 2026 directory plus Sherrills Ford-Terrell (01815, confirmed on its official site; missing from the PDF text). Rescue squads, EMS, county EM offices and county contact rows in the directory are excluded. 10 directory departments have no station point (no coordinates, so no distance). 4 listings have no phone. Types: Combination 1,052, Volunteer 621, Paid 355, not listed 65. All 100 counties covered. Merged, renamed and closed departments are handled by the research corrections below. |
| County EM | NC DPS / NCEM county emergency management directory | 5 gaps filled from county sites (Caswell, Cherokee, Madison, Mitchell, Robeson) |
| County DSS | NCDHHS Local DSS directory (map data CSV + county pages) | 4 gaps filled from county sites (Avery, Granville, Guilford, Randolph) |
| Health departments | NCDHHS Division of Public Health, local health department list | |
| Register of Deeds | NC Association of Registers of Deeds (ncard.us) county pages | Including online certificate ordering links |
| County websites | NC.gov county government websites list | |
| County fire marshal / emergency services | OSFM Department Directory (2026-10-07) | Washington County has no entry |
| Long-term recovery groups | NC VOAD (ncvoad.org/coads-ltrgs/) | 35 counties; group names and URLs only, no personal contacts |
| School districts | NC DPI School Report Card dataset 2024-25 (`rcd_location`) | EDDIE (apps.schools.nc.gov) is behind a bot challenge, which was not bypassed |
| County boundaries | U.S. Census TIGERweb (simplified) | On-device county lookup |
| ZIP / city centroids | U.S. Census 2024 Gazetteer (ZCTA, places) | Offline ZIP/city lookup |
| Insurance claim phone directory, `public/data/insurers.json` | Research pass 2026-10-22 (`/workspace/nc-disaster-hub-verify/insurers.json`, notes in `insurers-summary.md`): 60 companies and programs (all groups in the NCDOI 2025 homeowners market share report with about 0.08% share or more, plus NCJUA/NCIUA, NFIP, private flood and the NC Insurance Guaranty Association). Every primary number was seen on the company's own site or an official regulator or government page. | Shown in Resources → Insurance as one alphabetical, searchable list (by name and by product: homeowners, renters, flood, condo), no ranking. 45 dedicated claims lines and 15 general lines ("Call customer service", with "No separate claims line listed; ask for claims"). Verified special lines (catastrophe, flood, after-hours) are secondary call buttons; unverified extra numbers (`verified: false`, e.g. NFIP 1-800-427-4661, Frontline hurricane lines) are left out. Replaces the earlier 18-company link list. Precached for offline use. |
| Resource phones and links | Official agency pages (FEMA, SSA, NCDMV, NC Vital Records, NCDOI, NCJUA/NCIUA, Legal Aid NC, NCBA, DES, NCHFA, Renew NC, ReBuild NC, FCC, CFPB/FTC, State Dept., Medicare, NC Medicaid, NCDHHS EBT, NCLBGC, Pisgah Legal) | 74 resource URLs checked; see `data-raw/linkcheck.json` and `data-raw/resources_verified_by_webfetch.json` |

**Link checking:** `scripts/linkcheck.py` uses curl with a browser UA. Results:
- `ok`: any 2xx/3xx.
- `blocked`: 401/403/429, which is common on .gov## Research corrections (2026-10-22)

`data-raw/research_corrections_2026-10-22.json` is the re-verification pass (241 corrections, each with its source and confidence). `data-raw/local_corrections.json` holds 4 follow-ups (Washington EM link, Washington fire-report contact flag, Raft Swamp closing note). `scripts/build_data.py` applies both to the built JSON on every rebuild, only at medium, medium-high or high confidence, and only when the built value still equals the correction's `old` value. The result of each one is written to `data-raw/corrections_applied.json`. The 9 corrections for `src/content/resources.js` were applied by hand to that file.

The fire filter used to drop every FDID ending in 50-99, which hid most departments in Burke, Carteret, Craven, Moore, Pitt, Rowan and Surry. Now it keeps FDIDs ending 00-49, any FDID in the OSFM fire-department map layer, and fire-named entries that are not EMS-only units or fire marshal offices. `data-raw/parse_osfm.py` also no longer glues the chief's first-name fragment onto names, joins wrapped names whose second line ends in a ZIP code, and drops county contact rows whose "FDID" is a ZIP code.

## Coverage

- **Counties: 100 of 100 complete.** Complete means EM, DSS, health and Register of Deeds each have a phone, and all five links are ok or blocked. 87 counties have every link strictly 2xx/3xx.
- **Fire:** 2,093 listings, 1,213 FDIDs (1,212 current), 100/100 counties.
- **Schools:** 115 LEAs + 2 state schools; all 117 links ok.
- **Tests (2026-10-25):**
  - Unit: 124 function tests, 19 push tests and 8 i18n checks passed. They run against the Netlify Blobs local server and cover accounts, isolation, concurrent writes, size limits, encryption at rest, share cards, rate limits, cleanup, export/delete, fail-closed config, responder approval, submissions, admin edit/approve/reject/unpublish/edit-published, the audit log, revoke, admin claim and recovery codes, password reset codes (wrong, expired, reused, replaced, raced, cross-account), admin account deletion, alert targeting (statewide, several counties), test sends and the hotel function.
  - e2e (Blobs): 86 passed. Includes: admin email gets no rights until claimed with a log code → responder approval → submissions → edit after publishing → password reset with an admin code → admin deletes an account → admin screens in Spanish → alerts to two counties, statewide warning without Spanish, test send to own device only.
  - e2e (on-device): 63 passed.
  - Accessibility: 12 checks passed, 0 axe findings, English and Spanish, including the new Settings, reset, Accounts and Alerts screens.

## Everything marked "Not verified" (shown to users as a "Not verified" badge)

- **Fire (1 listing):** Raft Swamp Fire and Rescue (07816, Robeson). It is closing after a failed state inspection but still responds until Robeson County sets new districts. The listing shows a closing note. Re-check with Robeson County Emergency Management.
- **Washington County fire-report contact (1):** the OSFM directory lists no county fire marshal. The app shows Washington County Emergency Management, 252-793-4114 (medium confidence). Call to confirm who handles fire reports and investigations.
- **County links, school links, resource phones:** none left. Everything else was confirmed or corrected by the research pass.
- **Not automatically checkable (blocked to curl, confirmed by a browser or other fetch):** ssa.gov, travel.state.gov, fcc.gov, consumer.ftc.gov, nclbgc.org, farmers.com, fema.gov (403 to browser-like agents, 200 with a plain agent).

3463 and NC Disaster Case Management 844-746-2326. Both were found only on Pisgah Legal's page.
  - TextNow and Google Voice 911 limitations: confirm the wording against current provider help pages.
- **Not automatically checkable (blocked to curl, confirmed by browser fetch):** ssa.gov, travel.state.gov, fcc.gov, consumer.ftc.gov, nclbgc.org, farmers.com.
  - fema.gov returned 403 and was not separately confirmed.

## Monthly check (all information)

Once a month, re-check everything the app shows and rebuild:

1. **County pages:** EM, DSS, health, Register of Deeds, websites, alert sign-up and vital-records links, and their phones (`scripts/linkcheck.py`, then `npm run data`). Re-check the http-only hosts in `data-raw/overrides.json`.
2. **Fire departments:** download the current OSFM department directory PDF, re-run `data-raw/parse_osfm.py` and `npm run data`, and review `data-raw/corrections_applied.json` for corrections that no longer apply. Follow up on Raft Swamp and the Washington County fire-report contact.
3. **School districts:** DPI data and links.
4. **Resource phones and links** in `src/content/resources.js` (FEMA, NCDOI, legal aid, DES, vital records, TSA hotel lookup, Red Cross, NC 211 and the rest).
5. **Insurance claim lines** (`public/data/insurers.json`): call-check or re-verify every primary claims number, the special lines (catastrophe, flood, after-hours), online-claim links and websites against each company's own site or NCDOI. Re-check the NFIP numbers on floodsmart.gov/contact, look for insolvencies (point those to the NC Insurance Guaranty Association) and refresh the company list when NCDOI publishes a new market share report. Update the `generated` date so the app's "Numbers checked" date is right.
6. **Hotels:** download a fresh OpenStreetMap NC extract and re-run `scripts/build_hotels.py`.
7. **Reports:** go through the "Report a broken link or number" emails sent to info@c4iveteranservices.org.
8. **Cultural food places** (`public/data/cultural-food.json`, built by `scripts/build_cultural_food.py` from `data-raw/cultural-food/`): re-check every pantry/meal program's phone, hours and page against the organization's own site, open every store website, re-run `scripts/extract_cultural_food_osm.py` on a fresh OpenStreetMap NC extract, then `python3 scripts/build_cultural_food.py`. Places marked "Not verified" (OpenStreetMap only) should be confirmed or removed. Check that each `openstreetmap.org/way/...` link opens the right place.
9. **Home care after fire or flood** (`src/content/homecare.js`): open every source link (Ready.gov, CDC, EPA and EPA en español, USDA FSIS, Red Cross, NCDOI, NC State and UGA Extension, American Cleaning Institute) and confirm the advice still matches, plus the USDA Meat and Poultry Hotline 1-888-674-6854.
10. **Spanish:** `npm run test:unit` runs `tests/i18n.test.mjs`. If English text changes, run `node scripts/i18n-extract.mjs` and add the Spanish in `src/i18n/es.js`; mirror any change to `src/content/resources.js` in `src/content/resources.es.js`. Have a native speaker review new text.
11. **Sitemap:** `npm run data` rewrites `public/sitemap.xml` with today's `lastmod`. If you only changed `src/content/resources.js`, `insurers.json` or hotels, run `npm run sitemap` yourself. Deploy, then check https://disaster-resources.app/sitemap.xml.

12. **Translation page** (`src/content/translation.js`): open every app-store link (Google Play and App Store pages for each app), the Apple/Google/Samsung how-to sources, FEMA's language-access page and the NC 211 page; confirm the steps still match current iOS/Android menus, the FEMA Helpline number (1-800-621-3362) and that NC 211 still offers interpreters. Update `CHECKED` in that file.
13. **Accessibility:** `npm run test:a11y` (axe, keyboard, reflow, target size) and `LIGHTHOUSE=$(which lighthouse) node scripts/lighthouse-a11y.mjs` (needs Chrome). Update `A11Y_TESTED` in `src/screens/legal.js` when you re-test, and answer any accessibility emails.
14. **Alerts:** in Admin → Alerts look at the subscriber count and the send log; use **Send test to my device only** to check delivery. **Android:** check Play Console for policy notices and the yearly target-API deadline (see `docs/play-store/README.md`).

## Search engines (sitemap, robots, crawlable paths)

- The app routes by hash (`#hotels`), and search engines ignore hash fragments. So each public section also has a real path. Hash links keep working everywhere.
- `src/paths.js` lists the public paths and the screen each one opens: `/hotels`, `/fire-departments`, `/counties`, `/school-districts`, `/resources`, `/housing`, `/relocating`, `/legal`, `/jobs`, `/documents`, `/relief`, `/fire-report`, `/insurance`, `/board-up-cleanup`, `/phone`, `/about`, `/privacy` and `/county/<name>` for all 100 counties (for example `/county/new-hanover`). `main.js` uses the path only when there is no hash, so `/hotels#county/Wake` opens Wake County.
- At build time the `public-pages` plugin in `vite.config.js` writes `dist/<path>.html`, a copy of the shell with its own `<title>`, meta description, canonical and Open Graph URL. Netlify serves these at the extensionless URL with a 200. The SPA fallback in `netlify.toml` is not forced, so real files (`/sitemap.xml`, `/robots.txt`, these pages) win over it.
- `public/sitemap.xml` is generated by `scripts/make-sitemap.mjs`: the home page, the 19 sections (including `/cultural-food` and `/home-care-after-disaster`) and the 100 county pages, 120 URLs. It lists public pages only, never account, notes, share, submit, admin or API URLs. `public/robots.txt` allows crawling, disallows `/api/`, `/.netlify/` and the account and admin paths, and points to the sitemap.
- Submit `https://disaster-resources.app/sitemap.xml` in Google Search Console (Sitemaps) and Bing Webmaster Tools (Sitemaps). Ownership verification for either uses a DNS TXT record in Cloudflare or an HTML file in `public/`; neither needs a script on the page. Never add analytics or verification JavaScript.

## A phone number inside the app? (Twilio + WebRTC)

The app does **not** give out numbers. What it would take:

- **Build:**
  - Twilio Programmable Voice with the Voice JavaScript SDK (WebRTC) in the PWA.
  - A server function that mints short-lived Access Tokens, plus TwiML apps for inbound and outbound calls.
  - One purchased number per person.
  - Messaging for SMS, which needs A2P 10DLC brand and campaign registration (fees and weeks of vetting).
  - Push notifications for incoming calls. Web push on iOS only works for installed PWAs, and background ringing is unreliable.
  - E911 address registration per number.
- **Costs (Twilio US list prices as of Aug 2026):**
  - Local number $1.15/month (toll-free $2.15).
  - Outbound to PSTN $0.0140/min; inbound $0.0085/min.
  - App-to-app (WebRTC client) $0.0040/min.
  - Emergency calling $0.75/month per number.
  - Recording $0.0025/min.
  - TURN relay $0.40/GB.
  - Rough estimate: about $1.90/month per person just to hold a number with E911. Add about $3.20 for 200 minutes of outbound calls, plus SMS and 10DLC fees.
- **Privacy implications:**
  - Call logs, numbers called, SMS content and voicemail would sit with Twilio and with us. That data is subpoena-able and makes the app a much more sensitive data holder.
  - E911 needs a street address.
  - Numbers have to be recycled when people leave.
  - Abuse and fraud monitoring and a support line become necessary.
- **Recommendation:** Point people to Lifeline, TextNow and Google Voice for now, which is what the app does. Revisit only with a funded partner and a counsel-reviewed privacy plan.

## Open decisions

1. **Backend: decided.** Netlify Blobs, separate from C4I and Salesforce. Still open: retention and backups (periodic export?), and the breach-notice plan.
2. **App name: decided.** "NC Disaster Recovery Hub", a project of C4I Veteran Services Corp.
3. **Domain: decided.** https://disaster-resources.app. Print QR codes only after it resolves with HTTPS.
4. **Responder verification: decided (manual admin approval).** Open: should more admins be added to `ADMIN_EMAILS`? Should approval also check agency email domains?
5. **Email verification and password reset by email:** needs an email provider (not chosen). Until then, admin-issued one-time codes and log codes for admins (see *Admin access*).
6. **Encryption key custody:** who holds the offline backup of `DATA_ENCRYPTION_KEY`?
7. **Data maintenance:** county, fire and school data are a snapshot from 2026-10-22. Someone needs to own refreshing it, for example quarterly with `npm run data` plus a link check. Responder submissions can now fill gaps between refreshes.
8. **Hotel data refresh:** re-run `scripts/build_hotels.py` as part of the monthly check below.

## Sending an alert (admins)

1. Sign in with an email listed in `ADMIN_EMAILS` → **Admin → Alerts**.
2. Choose who gets it: **Statewide** (every device with alerts on, including people who only picked counties) or **Counties**: add one or more counties; a device gets it once if it chose any of them.
3. Write a short title (80 characters max) and message (300 max) in English. Spanish is optional but strongly recommended: fill in **both** the Spanish title and message (or neither). If both are empty, the review step shows a warning but you can still send. Devices set to Spanish get the Spanish text; if there is none they get the English. Optional link when tapped: a page of this app (e.g. `/county/wake`) or an `https://` address.
4. Optional: **Send test to my device only** (turn on alerts on this device first). The test is marked [TEST] / [PRUEBA], goes only to this device and is logged.
5. Tap **Review before sending** — the app shows how many devices will get it. Check the text, then **Send now** (or **Change the message**). Sending cannot be undone.
6. **Sent alerts** lists every alert (time, target, devices matched/sent/failed, who sent it). Addresses that no longer work are removed automatically.

Use alerts for recovery news (a Disaster Recovery Center opening, FEMA deadlines, new county resources). Never for emergencies or warnings: people must rely on Wireless Emergency Alerts and 911. Do not put personal information in an alert.

## Accessibility

Target: WCAG 2.1 AA. `npm run test:a11y` checks every public screen in English and Spanish plus the signed-in and admin screens with axe-core (WCAG 2.0/2.1 A+AA and best practices; zero findings required), the language dialog (focus trap, Escape), the skip link, form errors announced in a live region, 48 px tap targets, 320 px reflow, 200 % text and reduced motion. `scripts/lighthouse-a11y.mjs` runs Lighthouse's accessibility audit (results in `docs/accessibility/`). Known limits are listed on the `/accessibility` page and in `docs/accessibility/README.md`.

## Android app and Google Play

`android/` holds the Trusted Web Activity project; build instructions, signing and keystore backup are in `android/README.md`. The Play Console checklist and drafts (listing EN/ES, Data safety, content rating, graphics, screenshots) are in `docs/play-store/`. `public/.well-known/assetlinks.json` (served as `application/json`) links the site to the app; add the Play App Signing SHA-256 to it after the first upload.

## Source control

The repository is **public** (MIT license), so nothing secret may be committed. `.gitignore` keeps out `node_modules`, `dist`, `.netlify`, `.env*`, keystores, keys, Android build output and saved third-party web pages in `data-raw/` (they can contain other sites' API keys). Secrets live outside the repo (Netlify environment variables; the Android upload key in a password manager).
