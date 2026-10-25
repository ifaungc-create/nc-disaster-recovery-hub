# Progress: fixes of Oct 25, 2026

## Step 0 (priority): admin manual made private — DONE Sun Oct 25 02:38 EDT
- manuals/source/build.py now builds a PUBLIC manual (Parts 1–3 + appendices, no admin section, no server setting names)
  and a PRIVATE Admin Guide in /workspace/manuals/private/ only (not in any git repo or the website folder).
- Guard in build.py fails the build if public PDFs contain ADMIN_EMAILS / APP_SESSION_SECRET / DATA_ENCRYPTION_KEY / VAPID_* / "Administrator Guide" etc.
- Website: public manual replaced, Manuals page text updated (EN/ES); commit 931f8ad pushed to main (no force-push).
- Website deploy 6adda3b130c63b168d98da9c READY; live PDFs 200, live manual has 0 admin-only matches; Admin-Guide URL 404.
- NOTE: old full manual (with admin section) remains in website repo history at commit 7f92a05 (history not rewritten, per instructions).

## Next: app issues 1–6

## App issues 1–6 — code + tests DONE Sun Oct 25 ~03:10 EDT
- 1 Admin deletion (Admin → Accounts: find, type email again, reason; audit has uid + reason only). Self-delete also clears codes and turns off alerts on the device.
- 2 Admin claim needs a one-time code (function log); admin recovery from sign-in page; admin-issued reset codes for everyone else. Codes: HMAC-hashed, single use, expire (2 h / 30 min), 5 tries.
- 3 Spanish: 160 new strings (responder form, admin tabs, new screens). Needs native-speaker review.
- 4 Alerts: multi-county, statewide reaches everyone with alerts on, test to own device, empty-Spanish warning.
- 5 Edit published records in place, logged with changed fields.
- 6 README rewritten for all of the above + redeploy-after-env-change note; repo described as public.
- Tests: functions 124, push 19, i18n 8, e2e remote 86, e2e local 63, a11y 12 (0 axe findings). All green.

## Deployed + manuals v1.1 + website — DONE Sun Oct 25 ~03:20 EDT
- App: commit 89f9d43 pushed; production deploy 6adda99831dd083f73d89141 (rollback: 6add8f21dd667bc722bf3acd). Live smoke passed (sign-up, reset with code EN/ES, admin screens, alerts UI). QA account removed via self-service delete.
- Admin dn22: the function log shows an admin recovery code was issued for an existing account at 03:04 EDT (expires about 03:34 EDT). The code was not read. The owner can request a fresh one from the sign-in screen.
- Manuals Version 1.1 (October 2026): fixed-gap statements removed; new Admin → Accounts chapter (private guide only); C4I Veteran Services Corp. logo on cover, headers and back page (1.6 in cover / 1.8 in back, about 450 ppi). Public guard passed. Private guide only at /workspace/manuals/private/.
- Website: commit 138c79c pushed to main (no force). Logo in footer + home "About C4I" (alt EN "C4I Veteran Services Corp. logo", ES "Logotipo de C4I Veteran Services Corp."). Alerts page updated. Deploy 6addac0a898440b4ab80d9ef READY; 24 pages 200, 0 axe findings, no foreign requests; PDFs 200 and match local; Admin-Guide URL 404.
