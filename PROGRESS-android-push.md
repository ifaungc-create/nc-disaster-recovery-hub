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
- [ ] Final commit + report
