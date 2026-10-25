// Single source of truth for the app name and other branding. Change it here and it updates the UI,
// <title>, meta tags and manifest.
export const APP_NAME = 'NC Disaster Recovery Hub';
export const APP_SHORT_NAME = 'NC Recovery Hub';
// Canonical production address (DNS on Cloudflare, pointed at a new Netlify site; see README).
// Used for share-card QR codes, the canonical link and social meta tags.
export const SITE_URL = 'https://disaster-resources.app';
export const APP_TAGLINE = 'A project of C4I Veteran Services Corp.';
export const APP_DESCRIPTION = 'Help after fires, floods and hurricanes in North Carolina. A project of C4I Veteran Services Corp.';
// Contact for app problems and broken links/numbers (mailto links only; no forms, no tracking).
export const CONTACT_EMAIL = 'info@c4iveteranservices.org';
// Disclaimer shown on the About & disclaimer page (exact wording approved by C4I).
export const DISCLAIMER = 'None of the organizations or agencies listed in this app, whether government or private, are affiliated with this app or with C4I Veteran Services Corp. This app serves as a research and referral platform to help you recover from a disaster. We have done our best to confirm all information and keep it up to date, but information changes. Please let us know if a number does not work or a link is broken: info@c4iveteranservices.org.';
// Optional live OpenStreetMap hotel check (Overpass mirrors). OFF: public mirrors time out from Netlify.
// Turn on by building with VITE_HOTEL_LIVE_CHECK=1.
export const HOTEL_LIVE_CHECK = import.meta.env?.VITE_HOTEL_LIVE_CHECK === '1';
export const THEME_COLOR = '#12355B';
// Date the bundled resource data (counties, fire departments, schools, links) was collected/checked.
export const DATA_DATE = '2026-10-22';
// Share cards expire after this many days.
export const SHARE_CARD_DAYS = 30;
// Hotel search radius (meters).
export const HOTEL_RADIUS_M = 16000;
