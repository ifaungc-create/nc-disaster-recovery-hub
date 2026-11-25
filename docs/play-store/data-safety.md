# Data safety form — draft answers (owner to review before submitting)

Based on the app's privacy page (https://disaster-resources.app/privacy) and the code as of 2026-10-24.
The Android app is the website in a Chrome window; the wrapper itself collects nothing.
Play counts data as "collected" when it leaves the device. Data that stays on the phone (location, saved
county, language, offline lists) is **not** collected.

## Overview questions
| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS only, HSTS on the domain) |
| Do you provide a way for users to request that their data is deleted? | **Yes** — in the app (Settings → Delete my account) and at https://disaster-resources.app/delete-account |
| Shared with third parties? | **No.** Netlify (hosting) and browser push services only process data on our behalf to deliver the service; Play does not count service providers as sharing. |

## Data types collected
| Category → type | Collected | Optional? | Purpose | Notes |
|---|---|---|---|---|
| Personal info → **Name** | Yes | Optional (only if you create an account) | Account management | Shown back to you; responders' names appear on their share cards |
| Personal info → **Email address** | Yes | Optional | Account management | Sign-in |
| Personal info → Other info (organization, account type) | Yes | Optional | Account management, App functionality | Organization only for responders |
| App activity → **Other user-generated content** | Yes | Optional | App functionality | Private notes, case numbers, referrals (encrypted per account); responders' resource submissions (reviewed before publishing) |
| Device or other IDs | Yes | Optional (only if alerts are turned on) | App functionality (push notifications) | The browser's push address for the device, the chosen topics and language. Not linked to the account. Declared to be safe; it is not an advertising ID. |
| Location | **No** | — | — | Matched to a county on the device; not sent to the server |
| Financial, Health, Messages, Photos, Audio, Files, Calendar, Contacts, Web browsing, App info and performance (crash logs, diagnostics) | **No** | — | — | No analytics, crash reporting or ads SDKs |

For every collected type: **Is this data processed ephemerally?** No. **Is it required?** No (optional) —
the public resource lists work without an account or alerts.

## Security practices
- Data is encrypted in transit: Yes.
- Users can request deletion: Yes (see above).
- Do not tick "Independent security review" (none has been done).

## Things to double-check
- Password: stored only as a salted hash; Play has no separate "password" type — covered by account management.
- Anti-abuse rate-limit counters are scrambled, short-lived and not linked to a person (not collected user data).
- If analytics, crash reporting, maps or any SDK is ever added, this form must be updated first.

## Changes needed BEFORE "Ask C4I for a ride" is turned on (added 2026-11-24)

Ride requests ship switched off (Admin > Rides). While they are off, nothing above changes. The Recovery Binder
stays on the device (not collected) and the "Ride with Uber" link is a plain link (nothing sent). Before an
administrator turns ride requests on, update this form in Play Console (and the App Store privacy details):

| Category → type | Collected | Shared | Optional? | Purpose |
|---|---|---|---|---|
| Location → **Precise location** | Yes | **Yes** (ride company, to book the ride) | Optional (only if the person taps "Use my location" on a ride request) | App functionality |
| Personal info → **Phone number** | Yes | **Yes** (ride company) | Optional (ride requests only) | App functionality |
| Personal info → **Name** | already Yes | **Yes** (first name to the ride company) | Optional | App functionality |
| Personal info → **Address** (typed pickup and drop-off) | Yes | **Yes** (ride company) | Optional | App functionality |

Overview answer "Shared with third parties?" becomes **Yes** (only with the person's consent, only to book a ride).
Ride requests are deleted 30 days after they are sent. The iPhone app's location message
(NSLocationWhenInUseUsageDescription) was updated in the repo; the current App Store build still says the location
stays on the phone, so the iPhone app does not offer "Use my location" on ride requests until a new build ships.
