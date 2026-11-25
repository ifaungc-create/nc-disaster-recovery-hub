// My Recovery Binder: everything an agency will ask for, in one place, and a PDF the family can hand to
// any agency. Works without an account. Saved only on this device (localStorage, and photos in the iPhone
// app's own storage). Nothing is uploaded. If the person is signed in, the PDF can also include the case
// numbers and referrals from My Notes (read from their account, then used only on the phone).
import { ctx } from '../ctx.js';
import { api } from '../data/index.js';
import { REF_STATUS } from '../data/shared.js';
import { $, $$, esc, fmtDate, today, download } from '../ui.js';
import { t, getLang, setLang } from '../i18n/index.js';
import { can, isNative, listDocs, addDoc, docDataUrl, sharePdf } from '../native.js';
import { createPdf, toJpeg } from '../pdf.js';

const KEY = 'ncdrh.binder.v1';
const empty = () => ({ household: { names: '', address: '', phone: '', what: '', date: '' }, cases: [], people: [], docs: {}, notes: '', updatedAt: '' });
export function loadBinder() { try { const b = JSON.parse(localStorage.getItem(KEY)); return b && typeof b === 'object' ? { ...empty(), ...b, household: { ...empty().household, ...(b.household || {}) } } : empty(); } catch { return empty(); } }
function saveBinder(b) { b.updatedAt = new Date().toISOString(); try { localStorage.setItem(KEY, JSON.stringify(b)); return true; } catch { return false; } }
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const cut = (v, n) => String(v ?? '').trim().slice(0, n);

// The documents people are asked for most often after a disaster.
const DOCS = [['id'], ['ssn'], ['birth'], ['insurance'], ['lease'], ['bank'], ['meds']];
const DOC_LABEL = { id: () => t('Photo ID or driver license'), ssn: () => t('Social Security cards'), birth: () => t('Birth certificates'), insurance: () => t('Insurance policy'), lease: () => t('Lease or deed'), bank: () => t('Bank and benefit information'), meds: () => t('List of medications') };
const DOC_STATE = { kept: () => t('I have it'), lost: () => t('Lost'), unsure: () => t('Not sure') };

const SECTIONS = ['household', 'cases', 'people', 'photos', 'docs', 'notes'];
const started = (b, photoCount) => ({ household: Object.values(b.household).some((v) => String(v).trim()), cases: b.cases.length > 0, people: b.people.length > 0, photos: photoCount > 0, docs: Object.values(b.docs).some(Boolean), notes: !!b.notes.trim() });

// Photos picked on the website or Android for one PDF only. Kept in memory, never saved or sent.
let picked = [];

const ICON = { household: 'M3 11l9-7 9 7M5 10v10h14V10', cases: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3', people: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 11a3 3 0 1 0 0-6M22 20c0-2.6-1.7-4.9-4-5.7', photos: 'M3 7h4l2-3h6l2 3h4v13H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', docs: 'M6 3h9l4 4v14H6zM14 3v5h5', notes: 'M4 20h4L19 9l-4-4L4 16z' };
const sec = (id, title, status, open, inner) => `<details class="bsec" id="sec-${id}"${open ? ' open' : ''}><summary><span class="bico" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${ICON[id]}"/></svg></span><span class="btitle"><b>${title}</b><span class="small">${status}</span></span></summary><div class="bbody">${inner}</div></details>`;
const inp = (id, label, value, type = 'text', extra = '') => `<label for="${id}">${label} <span class="small">${t('(optional)')}</span></label><input id="${id}" type="${type}" value="${esc(value)}"${type === 'tel' ? ' inputmode="tel" autocomplete="off"' : ''}${extra}>`;

async function binder(parts) {
  const b = loadBinder(); const openSec = SECTIONS.includes(parts[0]) ? parts[0] : 'household';
  const native = can.photos(); const docs = native ? await listDocs() : [];
  const photoCount = native ? docs.length : picked.length;
  const st = started(b, photoCount); const n = Object.values(st).filter(Boolean).length;
  const me = ctx.me;
  const status = (id, word) => (st[id] ? word : t('Not started'));
  const caseRows = b.cases.map((c) => `<li data-case="${esc(c.id)}"><b>${esc(c.agency || t('Agency'))}</b>: <span class="code">${esc(c.number)}</span>${c.contact ? `<br><span class="small">${esc(c.contact)}${c.phone ? ' · ' + esc(c.phone) : ''}</span>` : c.phone ? `<br><span class="small">${esc(c.phone)}</span>` : ''}${c.opened ? `<br><span class="small">${t('Opened {date}', { date: esc(fmtDate(c.opened)) })}</span>` : ''}<button class="btn secondary small" type="button" data-delcase="${esc(c.id)}">${t('Delete')}</button></li>`).join('');
  const peopleRows = b.people.map((p) => `<li data-person="${esc(p.id)}"><b>${esc(p.who)}</b>${p.phone ? ` · <a href="tel:${esc(p.phone.replace(/[^\d+]/g, ''))}">${esc(p.phone)}</a>` : ''}${p.date ? `<br><span class="small">${esc(fmtDate(p.date))}</span>` : ''}${p.next ? `<p class="small" style="white-space:pre-wrap">${t('Next step:')} ${esc(p.next)}</p>` : ''}<button class="btn secondary small" type="button" data-delperson="${esc(p.id)}">${t('Delete')}</button></li>`).join('');
  const docRows = DOCS.map(([id]) => { const v = b.docs[id] || ''; return `<fieldset class="bdoc"><legend>${DOC_LABEL[id]()}</legend><div class="bdocopts">${Object.keys(DOC_STATE).map((s) => `<label class="opt"><input type="radio" name="doc_${id}" value="${s}" ${v === s ? 'checked' : ''}> ${DOC_STATE[s]()}</label>`).join('')}</div>${v === 'lost' ? `<p class="small breplace"><a href="#resources/g-documents">${t('How to replace it')}</a></p>` : ''}</fieldset>`; }).join('');
  const lostN = Object.values(b.docs).filter((v) => v === 'lost').length, keptN = Object.values(b.docs).filter((v) => v === 'kept').length;
  const photosInner = native
    ? `<p class="small">${t('Take photos of every room before you clean up. Insurance and FEMA ask for them.')}</p>
       ${docs.length ? `<div class="bthumbs">${docs.map((d) => `<label class="bthumb"><input type="checkbox" data-usephoto="${esc(d.id)}" checked>${d.thumb ? `<img src="${esc(d.thumb)}" alt="${esc(d.label || t(d.kind === 'document' ? 'Document' : 'Damage'))}">` : ''}<span class="small">${esc(d.label || t(d.kind === 'document' ? 'Document' : 'Damage'))}</span></label>`).join('')}</div><p class="small">${t('Checked photos go into the PDF.')}</p>` : `<p class="small">${t('No photos yet.')}</p>`}
       <div class="actions"><button class="btn" type="button" id="bcam">${t('Take a photo')}</button><button class="btn secondary" type="button" id="blib">${t('Choose from Photos')}</button></div><p class="err" role="alert" id="bpherr"></p>`
    : `<p class="small">${t('Take photos of every room before you clean up. Insurance and FEMA ask for them.')}</p>
       <label for="bpick">${t('Add photos to the PDF')} <span class="small">${t('(optional)')}</span></label><input id="bpick" type="file" accept="image/*" multiple>
       <p class="small" id="bpicked">${picked.length ? t('{n} photos will go into the PDF.', { n: picked.length }) : ''}</p>
       <p class="small">${t('Photos you choose here are used only to make the PDF on this device. They are not saved in the app and not uploaded.')}</p>`;

  return { html: `<h2>${t('My Recovery Binder')}</h2>
    <p>${t('Everything an agency will ask you for, in one place. Tell your story once.')}</p>
    <div class="note" id="bprivacy"><b>${t('Saved only on this phone.')}</b> ${t('Nothing here is uploaded. Anyone who uses this phone or browser can see it, so erase it when you are done if the phone is shared.')}</div>
    <div class="bprog" aria-hidden="true"><span style="width:${Math.round((n / 6) * 100)}%"></span></div>
    <p class="small" id="bcount">${t('{n} of 6 started', { n })}</p>
    <p class="small" role="status" aria-live="polite" id="bsaved"></p>
    ${sec('household', t('My household'), status('household', t('Started')), openSec === 'household', `
      <label for="bh_names">${t('Names of everyone in the household')} <span class="small">${t('(optional)')}</span></label><textarea id="bh_names" rows="3">${esc(b.household.names)}</textarea>
      ${inp('bh_address', t('Address of the damaged home'), b.household.address, 'text', ' autocomplete="street-address"')}
      ${inp('bh_phone', t('Best phone number to reach you'), b.household.phone, 'tel')}
      ${inp('bh_what', t('What happened (fire, flood, storm…)'), b.household.what)}
      ${inp('bh_date', t('Date it happened'), b.household.date, 'date')}`)}
    ${sec('cases', t('Case numbers'), status('cases', t('{n} saved', { n: b.cases.length })), openSec === 'cases', `
      ${b.cases.length ? `<ul class="list" id="bcases">${caseRows}</ul>` : ''}
      <form id="bcf" class="bform" novalidate><h3>${t('Add a case number')}</h3>
        ${inp('bc_agency', t('Agency or company'), '', 'text', ` placeholder="${t('FEMA, insurance, Red Cross, county…')}"`)}
        <label for="bc_number">${t('Case, claim or application number')}</label><input id="bc_number" required>
        ${inp('bc_contact', t('Contact person'), '')}${inp('bc_phone', t('Phone'), '', 'tel')}${inp('bc_opened', t('Date opened'), '', 'date')}
        <p class="err" role="alert" id="bcerr"></p><button class="btn secondary" type="submit">${t('Add this number')}</button></form>
      ${me ? `<p class="small">${t('Your case numbers and referrals in My Notes can go into the PDF too (see below).')}</p>` : ''}`)}
    ${sec('people', t('Who I have talked to'), status('people', t('{n} saved', { n: b.people.length })), openSec === 'people', `
      <p class="small">${t('For each call or visit: the person, their agency, their phone number, the date, and what they told you to do next.')}</p>
      ${b.people.length ? `<ul class="list" id="bpeople">${peopleRows}</ul>` : ''}
      <form id="bpf" class="bform" novalidate><h3>${t('Add a person')}</h3>
        <label for="bp_who">${t('Name and agency')}</label><input id="bp_who" required placeholder="${t('e.g. Ms. Lee, Red Cross')}">
        ${inp('bp_phone', t('Phone'), '', 'tel')}${inp('bp_date', t('Date'), today(), 'date')}
        <label for="bp_next">${t('What they told you to do next')} <span class="small">${t('(optional)')}</span></label><textarea id="bp_next" rows="2"></textarea>
        <p class="err" role="alert" id="bperr"></p><button class="btn secondary" type="submit">${t('Add this person')}</button></form>`)}
    ${sec('photos', t('Photos of damage'), status('photos', t('{n} photos', { n: photoCount })), openSec === 'photos', photosInner)}
    ${sec('docs', t('My documents'), status('docs', t('{lost} lost, {kept} kept', { lost: lostN, kept: keptN })), openSec === 'docs', `<p class="small">${t('Mark what you still have and what was lost. Lost items get a "how to replace it" link.')}</p>${docRows}`)}
    ${sec('notes', t('Notes'), status('notes', t('Started')), openSec === 'notes', `<label for="bn_notes">${t('Anything else you want every agency to know, written once.')}</label><textarea id="bn_notes" rows="6">${esc(b.notes)}</textarea>`)}

    <div class="card" id="bpdf"><h3>${t('Make my binder PDF')}</h3>
      <p class="small">${t('One file with everything above, to show, email or print for any agency. It is made on this phone; nothing is sent to us.')}</p>
      <label for="bp_lang">${t('Language of the PDF')}</label><select id="bp_lang"><option value="en" ${getLang() === 'en' ? 'selected' : ''} lang="en">English</option><option value="es" ${getLang() === 'es' ? 'selected' : ''} lang="es">Español</option></select>
      ${me ? `<label class="opt"><input type="checkbox" id="bp_mynotes" checked><span>${t('Also include my case numbers and referrals from My Notes')}</span></label>` : `<p class="small">${t('Signed in? The PDF can also include the case numbers and referrals you saved in My Notes.')}</p>`}
      <button class="btn" type="button" id="bmake">${t('Make my binder PDF')}</button>
      <p class="small" role="status" aria-live="polite" id="bpdfmsg"></p>
      <div class="actions hide" id="bpdfout"><a class="btn" id="bdl" href="#" download>${t('Download the PDF')}</a><button class="btn secondary hide" type="button" id="bshare">${t('Share')}</button></div></div>
    <details class="card" id="berase"><summary>${t('Erase the binder from this phone')}</summary><p>${t('This deletes everything in the binder on this phone. Photos in the iPhone app stay in My Notes > Photos. This cannot be undone.')}</p><button class="btn danger" type="button" id="beraseb">${t('Erase the binder')}</button></details>`,
  bind() {
    const said = (m) => { $('#bsaved').textContent = m; };
    const keep = () => { said(saveBinder(b) ? t('Saved on this phone.') : t('Could not save on this phone. Storage may be full or turned off.')); };
    // Household and notes: saved as the person types.
    const hh = { bh_names: 'names', bh_address: 'address', bh_phone: 'phone', bh_what: 'what', bh_date: 'date' };
    Object.entries(hh).forEach(([id, k]) => { $('#' + id).addEventListener('input', (e) => { b.household[k] = cut(e.target.value, k === 'names' ? 1000 : 300); keep(); }); });
    $('#bn_notes').addEventListener('input', (e) => { b.notes = cut(e.target.value, 8000); keep(); });
    // Documents: saved on change; a "how to replace it" link appears under a lost one (no re-render, so focus stays put).
    $$('.bdoc input[type=radio]').forEach((r) => (r.onchange = () => { b.docs[r.name.slice(4)] = r.value; keep();
      const fs = r.closest('.bdoc'); const link = fs.querySelector('.breplace');
      if (r.value === 'lost' && !link) fs.insertAdjacentHTML('beforeend', `<p class="small breplace"><a href="#resources/g-documents">${t('How to replace it')}</a></p>`);
      else if (r.value !== 'lost' && link) link.remove(); }));
    $('#bcf').onsubmit = (e) => { e.preventDefault(); const number = cut($('#bc_number').value, 80);
      if (!number) { $('#bcerr').textContent = t('Enter the case or claim number.'); $('#bc_number').focus(); return; }
      b.cases.push({ id: rid(), agency: cut($('#bc_agency').value, 120), number, contact: cut($('#bc_contact').value, 120), phone: cut($('#bc_phone').value, 40), opened: /^\d{4}-\d{2}-\d{2}$/.test($('#bc_opened').value) ? $('#bc_opened').value : '' });
      keep(); ctx.flash = t('Saved on this phone.'); go('cases'); };
    $('#bpf').onsubmit = (e) => { e.preventDefault(); const who = cut($('#bp_who').value, 160);
      if (!who) { $('#bperr').textContent = t('Enter the name of the person or agency.'); $('#bp_who').focus(); return; }
      b.people.push({ id: rid(), who, phone: cut($('#bp_phone').value, 40), date: /^\d{4}-\d{2}-\d{2}$/.test($('#bp_date').value) ? $('#bp_date').value : '', next: cut($('#bp_next').value, 1000) });
      keep(); ctx.flash = t('Saved on this phone.'); go('people'); };
    $$('[data-delcase]').forEach((x) => (x.onclick = () => { if (!confirm(t('Delete this case number? This cannot be undone.'))) return; b.cases = b.cases.filter((c) => c.id !== x.dataset.delcase); keep(); go('cases'); }));
    $$('[data-delperson]').forEach((x) => (x.onclick = () => { if (!confirm(t('Delete this person from the binder?'))) return; b.people = b.people.filter((p) => p.id !== x.dataset.delperson); keep(); go('people'); }));
    if (native) {
      const add = (src) => async () => { $('#bpherr').textContent = ''; try { if (await addDoc(src, '', 'damage')) { ctx.flash = t('Photo saved on this phone.'); go('photos'); } } catch (x) { $('#bpherr').textContent = t(x.message || 'Something went wrong. Please try again.'); } };
      $('#bcam').onclick = add('camera'); $('#blib').onclick = add('photos');
    } else {
      $('#bpick').onchange = (e) => { picked = [...e.target.files].filter((f) => /^image\//.test(f.type)).slice(0, 30); $('#bpicked').textContent = picked.length ? t('{n} photos will go into the PDF.', { n: picked.length }) : ''; };
    }
    $('#beraseb').onclick = () => { if (!confirm(t('Erase everything in the binder on this phone? This cannot be undone.'))) return; try { localStorage.removeItem(KEY); } catch {} picked = []; ctx.flash = t('The binder was erased from this phone.'); go('household'); };
    let url = '';
    $('#bmake').onclick = async () => {
      const btn = $('#bmake'), msg = $('#bpdfmsg'); btn.disabled = true; msg.textContent = t('Making the PDF…'); $('#bpdfout').classList.add('hide');
      try {
        const lang = $('#bp_lang').value === 'es' ? 'es' : 'en';
        let mine = { cases: [], referrals: [] };
        if (me && $('#bp_mynotes')?.checked) { const [cases, referrals] = await Promise.all([api.list(me.id, 'cases'), api.list(me.id, 'referrals')]); mine = { cases, referrals }; }
        const useIds = new Set($$('[data-usephoto]').filter((c) => c.checked).map((c) => c.dataset.usephoto));
        const photos = native ? docs.filter((d) => useIds.has(d.id)).map((d) => ({ src: () => docDataUrl(d), label: d.label, date: d.date })) : picked.map((f) => ({ src: () => fileUrl(f), label: f.name.replace(/\.[a-z0-9]+$/i, ''), date: f.lastModified ? new Date(f.lastModified).toISOString() : '' }));
        const bytes = await makeBinderPdf(loadBinder(), mine, photos, lang);
        const name = `recovery-binder-${today()}.pdf`;
        if (isNative() && can.share()) { await sharePdf(name, bytes, t('My Recovery Binder')); msg.textContent = t('Your PDF is ready.'); return; }
        if (url) URL.revokeObjectURL(url);
        const blob = new Blob([bytes], { type: 'application/pdf' }); url = URL.createObjectURL(blob);
        const dl = $('#bdl'); dl.href = url; dl.download = name; $('#bpdfout').classList.remove('hide');
        const file = typeof File === 'function' ? new File([blob], name, { type: 'application/pdf' }) : null;
        const sh = $('#bshare');
        if (file && navigator.canShare?.({ files: [file] })) { sh.classList.remove('hide'); sh.onclick = () => navigator.share({ files: [file], title: t('My Recovery Binder') }).catch(() => {}); }
        msg.textContent = t('Your PDF is ready ({size} KB).', { size: Math.max(1, Math.round(bytes.length / 1024)) });
        dl.focus();
      } catch (x) { msg.textContent = t('The PDF could not be made. Please try again.'); console.warn('[binder] pdf failed', x?.name); }
      finally { btn.disabled = false; }
    };
  } };
}
const go = (s) => { if (location.hash === '#binder/' + s) ctx.render(); else ctx.go('binder/' + s); };
const fileUrl = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });

// Words for the PDF in the language the person chose (may differ from the app's language).
function words(lang, b, mine) {
  const prev = getLang(); if (lang !== prev) setLang(lang);
  try {
    const first = b.household.names.split(/\r?\n|,/)[0]?.trim();
    const agencyName = (c) => `${t(c.agency)}${c.agencyOther ? ': ' + c.agencyOther : ''}`;
    return {
      title: t('Recovery Binder'),
      prepared: first ? t('Prepared {date} for {name}', { date: fmtDate(today()), name: first }) : t('Prepared {date}', { date: fmtDate(today()) }),
      household: t('My household'),
      kv: [[t('Household'), b.household.names], [t('Best phone'), b.household.phone], [t('Damaged home'), b.household.address], [t('What happened'), [b.household.what, b.household.date ? fmtDate(b.household.date) : ''].filter(Boolean).join(', ')]].filter(([, v]) => String(v).trim()),
      cases: t('Case numbers'), casesHead: [t('Agency'), t('Case or claim number'), t('Contact'), t('Opened')],
      caseRows: [...b.cases.map((c) => [c.agency, c.number, [c.contact, c.phone].filter(Boolean).join(', '), c.opened ? fmtDate(c.opened) : '']),
        ...mine.cases.map((c) => [agencyName(c), c.number, [c.contactName, c.phone, c.email].filter(Boolean).join(', '), c.opened ? fmtDate(c.opened) : ''])],
      people: t('Who I have talked to'), peopleHead: [t('Date'), t('Person and agency'), t('Phone'), t('What they said to do next')],
      peopleRows: b.people.map((p) => [p.date ? fmtDate(p.date) : '', p.who, p.phone, p.next]),
      referrals: t('Referrals'), refHead: [t('Referred to'), t('For what'), t('Phone'), t('Status')],
      refRows: mine.referrals.map((r) => [[r.to, r.by ? t('Referred by {name}', { name: r.by }) : ''].filter(Boolean).join('\n'), r.what, r.phone, t(REF_STATUS[r.status] || '')]),
      docs: t('Documents'), docsHead: [t('Document'), t('Status')],
      docRows: DOCS.filter(([id]) => b.docs[id]).map(([id]) => [DOC_LABEL[id](), DOC_STATE[b.docs[id]]()]),
      notes: t('Notes'), notesText: b.notes,
      photos: t('Photos of damage'), taken: (d) => (d ? t('Taken {date}', { date: fmtDate(d.slice(0, 10)) }) : ''),
      empty: t('Nothing was filled in yet.'),
      footerLeft: t('Made with NC Disaster Recovery Hub · disaster-resources.app'), footerRight: t('A free project of C4I Veteran Services Corp.'),
      page: (i, n) => (lang === 'es' ? `Página ${i} de ${n}` : `Page ${i} of ${n}`),
    };
  } finally { if (lang !== prev) setLang(prev); }
}

export async function makeBinderPdf(b, mine, photos, lang) {
  const W = words(lang, b, mine);
  const doc = createPdf({ footerLeft: W.footerLeft, footerRight: W.footerRight, pageLabel: W.page });
  // Title block
  doc.gap(6); doc.para(W.title, { size: 22, bold: true, color: '#12355B' }); doc.para(W.prepared, { size: 11, color: '#4A5A6A' });
  doc.gap(6); doc.line(doc.left, doc.y, doc.left + doc.width, doc.y, '#12355B', 2.5); doc.gap(8);
  let any = false;
  if (W.kv.length) { any = true; doc.heading(W.household); for (const [k, v] of W.kv) { doc.para(k, { size: 8.5, color: '#4A5A6A' }); doc.para(v, { size: 12, bold: true }); doc.gap(4); } }
  if (W.caseRows.length) { any = true; doc.heading(W.cases); doc.table(W.casesHead, W.caseRows, [0.24, 0.28, 0.3, 0.18]); }
  if (W.peopleRows.length) { any = true; doc.heading(W.people); doc.table(W.peopleHead, W.peopleRows, [0.15, 0.3, 0.18, 0.37]); }
  if (W.refRows.length) { any = true; doc.heading(W.referrals); doc.table(W.refHead, W.refRows, [0.34, 0.3, 0.18, 0.18]); }
  if (W.docRows.length) { any = true; doc.heading(W.docs); doc.table(W.docsHead, W.docRows, [0.65, 0.35]); }
  if (W.notesText.trim()) { any = true; doc.heading(W.notes); doc.para(W.notesText, { size: 11 }); }
  if (photos.length) {
    any = true; doc.ensure(290); doc.heading(W.photos);
    const colW = (doc.width - 16) / 2, maxH = 230; let col = 0, rowH = 0;
    for (const p of photos) {
      let img; try { img = await toJpeg(await p.src()); } catch { continue; }
      const s = Math.min(colW / img.pw, maxH / img.ph, 1); const h = img.ph * s;
      if (col === 0) { doc.ensure(h + 30); rowH = 0; }
      const x = doc.left + col * (colW + 16); const top = doc.y;
      doc.image(img.bytes, img.pw, img.ph, colW, maxH, x);
      const cap = [p.label, W.taken(p.date)].filter(Boolean).join(' · ');
      if (cap) doc.text(cap.slice(0, 70), x, top - h - 12, 8.5, { color: '#4A5A6A' });
      rowH = Math.max(rowH, h + 22);
      if (col === 1) { doc.gap(rowH); col = 0; } else col = 1;
    }
    if (col === 1) doc.gap(rowH);
  }
  if (!any) doc.para(W.empty, { size: 12, color: '#4A5A6A' });
  return doc.finish({ title: W.title, producer: 'NC Disaster Recovery Hub' });
}

export const binderScreens = { binder };
