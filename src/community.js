// Community records: added by approved responders, published only after an admin approves them.
// Fetched from the server and cached on the device so they still show offline.
import { api } from './data/index.js';
import { SUB_KINDS } from './data/shared.js';
import { esc, tel, ext, fmtDate, report } from './ui.js';
import { t } from './i18n/index.js';

const CKEY = 'ncdrh.community.v1';
let mem = null, at = 0;
export async function getCommunity() {
  if (mem && Date.now() - at < 60_000) return mem;
  try { mem = await api.listCommunity(); at = Date.now(); try { localStorage.setItem(CKEY, JSON.stringify(mem)); } catch {} }
  catch { try { mem = JSON.parse(localStorage.getItem(CKEY)) || []; } catch { mem = []; } }
  return Array.isArray(mem) ? mem : [];
}
export const clearCommunityCache = () => { mem = null; at = 0; };
export const communityLabel = (r) => t('Added by a verified responder, approved {date}', { date: fmtDate(r.approvedAt) });
export const communityCard = (r) => `<div class="card community" data-community="${esc(r.id)}"><h3>${esc(r.title)}</h3>
  <p class="small">${esc(t(SUB_KINDS[r.kind] || ''))}${r.county ? ' · ' + esc(r.county === 'Statewide' ? t('Statewide') : t('{name} County', { name: r.county })) : ''}</p>
  ${r.description ? `<p style="white-space:pre-wrap">${esc(r.description)}</p>` : ''}${tel(t('Call'), r.phone)}
  <div class="links">${r.url ? ext(t('Website'), r.url) : ''}${ext(t('Source'), r.sourceUrl)}</div>
  <p><span class="badge community-label">${esc(communityLabel(r))}</span></p>${report(r.title)}</div>`;
export const communityBlock = (list, heading) => (list.length ? `<h3 class="community-h">${esc(heading)}</h3>${list.map(communityCard).join('')}
  <p class="small">${t('These were sent in by approved responders and checked by an administrator. Confirm details before you go.')}</p>` : '');
