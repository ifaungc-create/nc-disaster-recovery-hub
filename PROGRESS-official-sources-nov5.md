# Official sources page — Nov 5, 2026

Google Play rejected the app on Nov 5, 2026 under Misleading Claims ("Missing Source Link for Government Information").
The Android app is a TWA of https://disaster-resources.app, so this web change reaches it without a new build.

## What changed
- New screen **Official sources** (`#sources`, crawlable at `/official-sources`; `?lang=es` opens it in Spanish):
  not-a-government notice first, then North Carolina / Federal / Tribal government agencies with their official
  URLs, then "Other organizations (not government)". Data: `src/content/official-sources.js` (links checked 2026-11-05).
- Linked from: the footer on every screen, Settings, About, the home disclaimer card, the Resources index and every
  resource category page, Get a phone number, County services and each county page, School districts, Fire
  departments, Hotels, Cultural food, Home care and Translation. Each resource item that links to a government
  website shows "Source: <agency> (official site)" with a link to that agency's official page.
- Home screen now starts its disclaimer card with "Not a government app."
- Service worker cache bumped to `ncdrh-v10` so installed copies update.
- Link fixes (EN and ES data): NC DOJ price gouging, State Dept lost/stolen passport, Salvation Army Carolinas, SBA disaster.
- Play listing v3 (docs/play-store/listing-*.md).

## Needs native review
All new Spanish text (official-sources.js names and uses, new keys in src/i18n/es.js, the Spanish Play listing) needs
review by a native speaker.

## Links that could not be checked by script
- fema.gov, ready.gov, fcc.gov, cdc.gov, fsis.usda.gov, ssa.gov, nclbgc.org and travel.state.gov block scripted requests
  (403). Checked in a browser or by fetch where possible; travel.state.gov stays behind Cloudflare for scripts.
- consumer.ftc.gov answers 404 to scripts; the sources page uses identitytheft.gov (FTC) instead. The resource link to
  consumer.ftc.gov/articles/credit-freezes-and-fraud-alerts was left as is.
- ncvoad.org was down on Nov 5 (certificate error, then HTTP 500). NC VOAD is listed without a link; the existing
  in-app NC VOAD links were left in place. Recheck.
