# Live hotel phone, website and open status: API options (research only, not built)

Checked 2026-10-22. Prices are list prices in USD (TomTom in EUR) per 1,000 billable requests. Confirm in the vendor console before committing.

**Assumed design:** one server-side call per hotel search, from a Netlify function. The function gets the typed place or the position rounded to about 1 km. It receives no user ID, logs no location, and the vendor sees only Netlify's IP. One request returns up to about 20 places.

## Google Places API (New)

- **Fields and SKUs** ([Text Search docs](https://developers.google.com/maps/documentation/places/web-service/text-search)):
  - Phone (`nationalPhoneNumber`), `websiteUri`, `currentOpeningHours` and `rating` bill as **Text Search Enterprise**.
  - `businessStatus`, address and location are Pro.
  - Reviews are Enterprise + Atmosphere.
  - A request bills at the highest SKU among the fields asked for.
- **Prices** (from the [pricing list](https://developers.google.com/maps/billing-and-pricing/pricing), up to 100k events):

  | SKU | Free per month | Price per 1,000 |
  | --- | --- | --- |
  | Text Search Pro | 5,000 | $32 |
  | Text Search Enterprise | 1,000 | $35 |
  | Enterprise + Atmosphere | 1,000 | $40 |
  | Place Details Enterprise | 1,000 | $20 |
  | Text Search IDs-only | Unlimited, free | — |

  The free caps are per SKU per month: Essentials 10,000, Pro 5,000, Enterprise 1,000. They replaced the old $200 monthly credit. A billing account is required.
- **Rules** ([policies](https://developers.google.com/maps/documentation/places/web-service/policies), [service terms §14](https://cloud.google.com/maps-platform/terms/maps-service-terms)):
  - Show the Google Maps logo, or the text "Google Maps" where space is limited, and keep Google content visually distinct.
  - Show third-party and review author attributions.
  - The app must publish Terms and a Privacy Policy that incorporate Google's.
  - Results can be shown without a map, but never on a non-Google map.
- **Caching:** no caching or prefetching of content. Place IDs may be kept indefinitely. Latitude and longitude may be kept for up to 30 days. Phones, websites and hours must be fetched live, so the current per-cell Blobs cache would not be allowed.
- **Cost:**
  - Option A, one Enterprise Text Search per search: **1,000 searches/mo ≈ $0**; **10,000 ≈ $315/mo**.
  - Option B, free IDs-only search plus Place Details only when someone taps (assume 3 taps per search): 1,000 ≈ $40, 10,000 ≈ $580.

## Foursquare Places API (new, places-api.foursquare.com)

- **Prices** (rates since June 1, 2026, per [developer notice](https://docs.foursquare.com/developer/reference/upcoming-changes) and [pricing page](https://foursquare.com/pricing/)):
  - Pro: first 500 calls a month free, then $15 per 1,000 (up to 100k).
  - Premium: $18.75 per 1,000, no free calls.
  - Parts of the marketing page still say "up to 10,000 free".
- **Field tiers** ([response fields](https://docs.foursquare.com/fsq-developers-places/reference/response-fields)):
  - Pro includes `tel`, `website` and `email`.
  - Hours, rating, photos and tips are Premium.
- **Cost:**
  - Phone and website only (Pro): 1,000 ≈ $7.50, 10,000 ≈ $142.50.
  - With hours (Premium): 1,000 ≈ $18.75, 10,000 ≈ $187.50.
- **Rules:** attribution and caching terms are not checked; read the Foursquare terms before caching.
- **Free offline option:** the FSQ OS Places open dataset (Apache 2.0, monthly) might be able to fill in phones and websites in the on-device list. Not verified.

## HERE Geocoding & Search (Discover/Browse)

- **Prices:** 5,000 free a month, then $2.75 per 1,000, per HERE's Base Plan pricing as shown in the search index. The pricing page did not render for a direct check, so this is Not verified.
- Results include phone, website and opening hours when HERE has them.
- **Cost:** 1,000 ≈ $0, 10,000 ≈ $13.75.
- **Rules:** caching and attribution terms are not checked.

## TomTom Places Search API (Orbis)

- **Prices:** 5,000 free Discover requests a month ([pricing page](https://docs.tomtom.com/pricing/)). The paid rate of about €18 per 1,000 is from the search index only, so it is Not verified.
- **Cost:** 1,000 ≈ €0, 10,000 ≈ €90.
- **Rules:** caching and attribution terms are not checked.

## Summary

| Option | 1,000 searches/mo | 10,000 searches/mo | Phone, website, hours | Main constraint |
| --- | --- | --- | --- | --- |
| Google Text Search Enterprise | ≈ $0 | ≈ $315 | Yes, best NC coverage | No caching; Google attribution and terms |
| Foursquare Pro / Premium | $7.50 / $18.75 | $142.50 / $187.50 | Pro: phone + website; hours are Premium | Free tier cut to 500 calls |
| HERE Discover | ≈ $0 | ≈ $13.75 | When available | Coverage and terms to check |
| TomTom Places Search | ≈ €0 | ≈ €90 | When available | Paid rate Not verified |

The current approach costs $0 and shares nothing until a person taps: the Google Maps and Apple Maps listing buttons open the live listing directly.
