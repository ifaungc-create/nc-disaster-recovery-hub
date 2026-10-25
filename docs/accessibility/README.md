# Accessibility test results

Goal: **WCAG 2.1 Level AA**. Public statement: https://disaster-resources.app/accessibility (linked in the footer and on the About page).

Last run: **2026-10-24** (update `A11Y_TESTED` in `src/screens/legal.js` when you re-run).

## How to re-run

```bash
npm run test:a11y                                    # axe-core + keyboard + reflow + reduced motion
LIGHTHOUSE=/path/to/lighthouse node scripts/lighthouse-a11y.mjs   # Lighthouse a11y scores, EN + ES
```

## Results

### axe-core (`tests/a11y.mjs`), rules tagged wcag2a, wcag2aa, wcag21a, wcag21aa
| Check | Result |
|---|---|
| Language dialog: axe, focus trap, Escape closes | Pass |
| 28 signed-out screens, English | 0 violations |
| 28 signed-out screens, Spanish | 0 violations |
| 11 signed-in screens + 5 admin tabs, English and Spanish | 0 violations |
| Skip link works with the keyboard (EN, ES) | Pass |
| `<html lang>` matches the chosen language (EN, ES) | Pass |
| Reflow at 320 px wide and text at 200% (1.4.10, 1.4.4) | Pass |
| `prefers-reduced-motion` turns off animations | Pass |

Total: **0 findings** (0 serious/critical, 0 moderate/minor). Full output: `axe-report.json`.

### Lighthouse accessibility category
**100 / 100 on all 24 pages tested** (12 pages × English and Spanish): home, translation, alerts,
accessibility, delete-account, hotels, insurance, privacy, about, county/wake, login and sign-up.
Per-page numbers: `lighthouse-summary.json`.

## Known gaps (stated honestly on the public page too)
- Automated tools find only part of the WCAG problems. No outside accessibility expert has audited the app.
- No full manual test with screen readers (NVDA, JAWS, VoiceOver, TalkBack) has been done yet. Keyboard checks are scripted.
- Links go to outside sites (FEMA, state agencies, app stores) that we do not control and that may not be accessible.
- Google Translate copies of the page (optional link) are produced by Google, not by us.
- The Android app is a wrapper around the same website; it has not been tested separately with TalkBack.

Recommended next steps: a short screen-reader pass (VoiceOver on iPhone, TalkBack on Android) by a real user, and asking
people who use assistive technology for feedback through info@c4iveteranservices.org.
