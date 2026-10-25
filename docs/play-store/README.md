# Google Play release checklist — NC Disaster Recovery Hub

Package `app.disasterresources.nchub` · bundle `android/release/app-release.aab` · see `android/README.md`.
Drafts in this folder: `listing-en.md`, `listing-es.md`, `data-safety.md`, `content-rating.md`, `graphics/`.
Everything here is a **draft for the owner to review**; nothing has been submitted.

Rules checked 2026-10-24 (Eastern time) against Play Console Help:
- Target API: new apps and updates must target Android 16 / API 36 from Aug 31, 2026 (extension to Nov 1, 2026 on request).
  This app targets 36. https://support.google.com/googleplay/android-developer/answer/11926878
- Personal developer accounts created after Nov 13, 2023 must run a **closed test with at least 12 testers opted in
  for 14 days in a row** before they can apply for production. https://support.google.com/googleplay/android-developer/answer/14151465
- Organization accounts (recommended for C4I Veteran Services Corp.) need a **D-U-N-S number** for the organization and
  have no 12-tester rule. One-time registration fee: US$25.

## 1. Developer account (owner)
- [ ] Create a Play Console account at https://play.google.com/console/signup — choose **Organization** and use the
      D-U-N-S number of C4I Veteran Services Corp. (look it up or request it free from Dun & Bradstreet; it can take days).
- [ ] Verify identity, the organization's website and the contact email/phone as Play asks.
- [ ] Add a second person (Users and permissions) so the account is not tied to one login.

## 2. Create the app
- [ ] Create app → name **NC Disaster Recovery Hub**, default language English (United States), App, Free.
- [x] Upload `android/release/app-release.aab` to **Internal testing** first. Accept **Play App Signing**.
      Done 2026-10-25: Play app ID 4974956770726627957, internal release 1 (1.0.0) uploaded.
- [x] (2026-10-25: app signing SHA-256 89:47:EB:…:AB:CE:EC added next to upload key 94:38:DA:…:B4:31 and deployed) Copy the **App signing key SHA-256** (App signing page) and add it to `public/.well-known/assetlinks.json`
      (keep the upload one). Deploy the website. Install from the internal test link and confirm there is no address bar.

## 3. App content (Policy → App content)
- [ ] Privacy policy: `https://disaster-resources.app/privacy`
- [ ] App access: some features need a free account → choose "All or some functionality is restricted" and give
      reviewers a working login. Create one yourself (Create account → "I was affected") and paste the email/password
      into Play Console only. Do not put it in this repo.
- [ ] Ads: **No ads**.
- [ ] Content rating: answer the IARC questionnaire — see `content-rating.md`.
- [ ] Target audience: **18 and over** (the app is for adults dealing with disaster recovery; not designed for children).
- [ ] Data safety: see `data-safety.md`. Account deletion URL: `https://disaster-resources.app/delete-account`.
- [ ] Government apps: answer **No** — the app is not made by or for a government agency. The listing says so.
- [ ] News app: **No** (it is a resource directory; optional alerts are notices from the project, not news publishing).
- [ ] Financial features / Health: **None** (it lists where to get help; it does not provide financial or medical services).

## 4. Store listing
- [ ] Copy text from `listing-en.md` (and `listing-es.md` as a Spanish (Latin America) — es-419 — translation, optional).
- [ ] App icon 512×512: `graphics/icon-512.png`
- [ ] Feature graphic 1024×500: `graphics/feature-graphic-1024x500.png`
- [ ] Phone screenshots 1080×1920: `graphics/phone/en-*.png` (Spanish set: `es-*.png` for the es-419 listing).
      Re-create with `node scripts/play-screenshots.mjs` (sample case numbers are made up).
- [ ] Category and contact: email `info@c4iveteranservices.org`, website `https://disaster-resources.app`.

## 5. User-generated content (UGC) — what reviewers look for
Responders (accounts approved by an admin) can submit resource listings. Nothing a user submits is public until an
administrator reviews it in **Admin → Submissions** (approve, edit or reject; every action is in the audit log).
Each public listing has "Report a broken link or number", and the footer/About page give the contact email.
Private notes are never shown to anyone else. Users cannot message each other. Signing up requires accepting
the terms. If Play asks, point to the moderation queue, the report link and `info@c4iveteranservices.org`.

## 6. Testing and release
- [ ] Internal testing: install on at least one Android 13+ phone and one older phone (Android 7–12). Check:
      opens without an address bar; Alerts → Turn on alerts → Android asks for notification permission;
      an admin test alert arrives with the app icon; tapping it opens the right page; Back button leaves the app;
      offline: the shell and saved lists open with no signal.
- [ ] (Personal account only) Closed test with ≥12 testers for 14 continuous days, then *Apply for production*.
- [ ] Production release → roll out. Review usually takes a few days.

## 7. Every later release
Content changes need **no** Play release (they ship with the website). A new AAB is needed only for wrapper
changes (icon, name, Android version targets). Then raise `versionCode` in `android/app/build.gradle`, rebuild
(see `android/README.md`) and upload. Each year check the new target API rule (usually announced for Aug 31).
