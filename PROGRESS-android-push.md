# Progress: translation / a11y / Android TWA / push / git / deploy (2026-10-24/25)

- [x] Translation tile + /translation (EN/ES), links verified 2026-10-25 (all 200; FEMA via browser UA)
- [x] NC 211 wording aligned with nc211.org/about ("available in most languages")
- [x] Accessibility: axe 0 findings (12 checks), Lighthouse 100 on 24 pages; docs/accessibility/ written
- [x] Android TWA AAB: android/release/app-release.aab (gitignored); keystore in /home/box/secrets/nc-disaster-hub/android
- [x] Web push + admin compose/confirm/log; e2e 79/79, local e2e 63/63, unit 84+16, i18n 8
- [x] docs/play-store/ checklist, data safety, content rating, listings, graphics
- [x] git init + secret scan + commit bd3fa61 (local only; gh not logged in)
- [x] Production deploy 6add7fe94cca755a483c545a READY (from clean git archive, no data-raw HTML)
- [x] Live: assetlinks application/json, /translation /alerts /accessibility /delete-account 200, pushKey OK, CSP+HSTS
- [x] Live smoke 12/12 + branding 7/7 pass (tests updated for language dialog + static hotel list); live-34..39 site screenshots
- [x] Final commit + report
- [x] 2026-10-25: Play app signing SHA-256 added to assetlinks.json (both keys), Play app 4974956770726627957 internal release 1 (1.0.0)
- [x] 2026-10-25: Fixed Translation page "Open in Google Translate" (was a blank "Loading…" page: Google's translate.goog proxy loads our /assets JS+CSS cross-origin and we sent no CORS header). Added `Access-Control-Allow-Origin: https://disaster--resources-app.translate.goog` on /assets/* and /data/* only (CSP/X-Frame-Options unchanged), link straight to the proxy URL, keep "#route" links inside the translation, no language dialog there, header wraps long words. Deploys 6add8dd64bd68d297c214b53 + 6add8f21dd667bc722bf3acd. Live check: `node tests/live-translate.mjs` (21 languages pass; screenshots/live-40-translate-fix.png)
