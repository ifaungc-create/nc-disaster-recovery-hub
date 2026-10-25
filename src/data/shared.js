// Validation and helpers shared by the local adapter and the server function, so both behave the same.
export const ROLES = { affected: 'Person affected by a disaster', responder: 'Disaster responder', admin: 'Administrator' };
export const KINDS = ['cases', 'notes', 'referrals'];
export const AGENCIES = ['Red Cross', 'FEMA', 'Insurance claim', 'SBA', 'NCEM', 'Other'];
export const REF_STATUS = { not_started: 'Not started', contacted: 'Contacted', waiting: 'Waiting', done: 'Done' };
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const newCode = (rand) => Array.from({ length: 8 }, () => CODE_ALPHABET[rand(CODE_ALPHABET.length)]).join('');
export const normCode = (c = '') => String(c).toUpperCase().replace(/[^A-Z0-9]/g, '');
export const fmtCode = (c = '') => (c.length === 8 ? c.slice(0, 4) + '-' + c.slice(4) : c);
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const date = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');

export function err(message, code = 400) { return Object.assign(new Error(message), { code }); }

export function validateSignup(u = {}) {
  const email = str(u.email, 200).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw err('Enter a valid email address.');
  if (String(u.password || '').length < 8) throw err('Password must be at least 8 characters.');
  const name = str(u.name, 120); if (!name) throw err('Please enter your name (a first name is fine).');
  if (u.role !== 'affected' && u.role !== 'responder') throw err('Choose how you are using this app.');
  if (u.termsAccepted !== true) throw err('Please read and accept the privacy notice.');
  return { email, name, role: u.role, org: u.role === 'responder' ? str(u.org, 160) : '' };
}

// Whitelist fields per record kind; anything else is dropped.
export function cleanItem(kind, o = {}) {
  if (kind === 'cases') {
    const agency = AGENCIES.includes(o.agency) ? o.agency : 'Other';
    const number = str(o.number, 80); if (!number) throw err('Enter the case or claim number.');
    return { agency, agencyOther: agency === 'Other' || agency === 'Insurance claim' ? str(o.agencyOther, 120) : '', number, contactName: str(o.contactName, 120), phone: str(o.phone, 40), email: str(o.email, 160), opened: date(o.opened), nextDate: date(o.nextDate), details: str(o.details, 4000) };
  }
  if (kind === 'notes') {
    const title = str(o.title, 160), body = str(o.body, 20000); if (!title && !body) throw err('Write something in the note first.');
    const n = { title, body };
    if (o.fromCard && typeof o.fromCard === 'object') n.fromCard = cleanCard(o.fromCard);
    return n;
  }
  if (kind === 'referrals') {
    const to = str(o.to, 160); if (!to) throw err('Enter who you were referred to.');
    return { by: str(o.by, 160), to, what: str(o.what, 400), status: REF_STATUS[o.status] ? o.status : 'not_started', followUp: date(o.followUp), phone: str(o.phone, 40), details: str(o.details, 4000) };
  }
  throw err('Unknown record type.');
}

// Share card: only information about the responder/organization, never the client.
export function cleanCard(c = {}) {
  const card = { title: str(c.title, 120), org: str(c.org, 160), contact: str(c.contact, 120), phone: str(c.phone, 40), email: str(c.email, 160), url: /^https:\/\//i.test(str(c.url, 300)) ? str(c.url, 300) : '', details: str(c.details, 1500), issued: date(c.issued) };
  if (!card.org && !card.contact) throw err('Add your organization or your name.');
  return card;
}
export function cardToNote(card, code) {
  const lines = [card.org && `Organization: ${card.org}`, card.contact && `Contact: ${card.contact}`, card.phone && `Phone: ${card.phone}`, card.email && `Email: ${card.email}`, card.url && `Website: ${card.url}`, card.details && `\n${card.details}`, code ? `\n(Saved from share code ${fmtCode(code)})` : '(Saved from a QR code)'].filter(Boolean);
  return { title: card.title || `Info from ${card.org || card.contact}`, body: lines.join('\n'), fromCard: card };
}

// ---------- community records (submitted by approved responders, published after admin approval)
export const NC_COUNTIES = ["Alamance", "Alexander", "Alleghany", "Anson", "Ashe", "Avery", "Beaufort", "Bertie", "Bladen", "Brunswick", "Buncombe", "Burke", "Cabarrus", "Caldwell", "Camden", "Carteret", "Caswell", "Catawba", "Chatham", "Cherokee", "Chowan", "Clay", "Cleveland", "Columbus", "Craven", "Cumberland", "Currituck", "Dare", "Davidson", "Davie", "Duplin", "Durham", "Edgecombe", "Forsyth", "Franklin", "Gaston", "Gates", "Graham", "Granville", "Greene", "Guilford", "Halifax", "Harnett", "Haywood", "Henderson", "Hertford", "Hoke", "Hyde", "Iredell", "Jackson", "Johnston", "Jones", "Lee", "Lenoir", "Lincoln", "Macon", "Madison", "Martin", "McDowell", "Mecklenburg", "Mitchell", "Montgomery", "Moore", "Nash", "New Hanover", "Northampton", "Onslow", "Orange", "Pamlico", "Pasquotank", "Pender", "Perquimans", "Person", "Pitt", "Polk", "Randolph", "Richmond", "Robeson", "Rockingham", "Rowan", "Rutherford", "Sampson", "Scotland", "Stanly", "Stokes", "Surry", "Swain", "Transylvania", "Tyrrell", "Union", "Vance", "Wake", "Warren", "Washington", "Watauga", "Wayne", "Wilkes", "Wilson", "Yadkin", "Yancey"];
export const SUB_KINDS = { organization: 'Organization', service: 'Service', shelter: 'Shelter', phone: 'Phone number', link: 'Link' };
export const SUB_CATEGORIES = { housing: 'Housing & shelter', relocating: 'Relocating', legal: 'Free legal help', jobs: 'Jobs & income', documents: 'Replacing documents', relief: 'Relief organizations', 'fire-report': 'Fire reports', insurance: 'Insurance', boardup: 'Board-up & cleanup', other: 'Other' };
export const RESPONDER_STATUS = { pending: 'Waiting for approval', approved: 'Approved', denied: 'Not approved', revoked: 'Access removed' };
const https = (v, max = 300) => { const s = str(v, max); return /^https:\/\/[^\s<>"']+\.[^\s<>"']+$/i.test(s) ? s : ''; };
export function cleanSubmission(o = {}) {
  const r = { kind: SUB_KINDS[o.kind] ? o.kind : '', category: SUB_CATEGORIES[o.category] ? o.category : '', county: o.county === 'Statewide' || NC_COUNTIES.includes(o.county) ? o.county : '',
    title: str(o.title, 160), description: str(o.description, 2000), phone: str(o.phone, 40), url: https(o.url), sourceUrl: https(o.sourceUrl) };
  if (!r.kind) throw err('Choose what kind of record this is.');
  if (!r.category) throw err('Choose a category.');
  if (!r.county) throw err('Choose a county, or Statewide.');
  if (!r.title) throw err('Enter a name or title.');
  if (r.phone && !/^[0-9()+.\-\s]{3,40}$/.test(r.phone)) throw err('Enter the phone number using digits only (dashes and spaces are fine).');
  if (o.url && !r.url) throw err('The link must start with https://');
  if (!r.sourceUrl) throw err('Enter a source link (https://) where an admin can check this information.');
  if (!r.phone && !r.url && !r.description) throw err('Add a phone number, a link or a description.');
  return r;
}
