// Small PDF writer for the Recovery Binder. No library and no network: it builds a PDF 1.4 file in the
// browser with the two standard Helvetica fonts (WinAnsi encoding, so English and Spanish letters work)
// and baseline JPEG photos. US Letter pages, page numbers and a footer on every page.
// Characters Helvetica cannot show (for example Chinese or Arabic letters) are printed as "?".

// Helvetica and Helvetica-Bold character widths (1/1000 em) for ASCII 32..126, from the Adobe AFM files.
const W_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const W_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
// Windows-1252 codes for the few characters outside Latin-1 that people type often.
const CP1252 = { '€': 0x80, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97 };

// One character -> one byte (WinAnsi). Unknown -> '?'.
export function winAnsi(s) {
  const out = [];
  for (const ch of String(s ?? '').normalize('NFC')) {
    const c = ch.codePointAt(0);
    if (c === 9) out.push(32);
    else if (c >= 32 && c <= 126) out.push(c);
    else if (c >= 0xA0 && c <= 0xFF) out.push(c);
    else if (CP1252[ch]) out.push(CP1252[ch]);
    else if (c !== 10 && c !== 13) out.push(63);
  }
  return out;
}
const baseOf = (b) => { if (b >= 32 && b <= 126) return b; if (b >= 0xA0) { const d = String.fromCharCode(b).normalize('NFD').charCodeAt(0); if (d >= 32 && d <= 126) return d; } return 111; }; // accented letter -> its plain letter; anything else ~ 'o'
export function textWidth(s, size, bold = false) { const w = bold ? W_BOLD : W_REG; let n = 0; for (const b of winAnsi(s)) n += w[baseOf(b) - 32]; return (n * size) / 1000; }

// Splits text into lines no wider than `max` points. Keeps the person's own line breaks.
export function wrap(s, size, max, bold = false) {
  const lines = [];
  for (const para of String(s ?? '').split(/\r?\n/)) {
    const words = para.split(/ +/); let line = '';
    for (let w of words) {
      while (textWidth(w, size, bold) > max) { // a single word longer than the line: cut it
        let i = w.length; while (i > 1 && textWidth(w.slice(0, i), size, bold) > max) i--;
        if (line) { lines.push(line); line = ''; } lines.push(w.slice(0, i)); w = w.slice(i);
      }
      const next = line ? line + ' ' + w : w;
      if (textWidth(next, size, bold) <= max) line = next; else { if (line) lines.push(line); line = w; }
    }
    lines.push(line);
  }
  return lines;
}
const pdfStr = (s) => '(' + winAnsi(s).map((b) => (b === 40 || b === 41 || b === 92 ? '\\' + String.fromCharCode(b) : b < 32 || b > 126 ? '\\' + b.toString(8).padStart(3, '0') : String.fromCharCode(b))).join('') + ')';
const num = (n) => (Math.round(n * 100) / 100).toString();
const rgb = (hex) => { const h = hex.replace('#', ''); return [0, 2, 4].map((i) => num(parseInt(h.slice(i, i + 2), 16) / 255)).join(' '); };

export const PAGE_W = 612, PAGE_H = 792, MARGIN = 48;

// Builder: write top to bottom; it starts a new page when the next block does not fit.
export function createPdf({ footerLeft = '', footerRight = '', pageLabel = (i, n) => `Page ${i} of ${n}` } = {}) {
  const pages = []; const images = []; let ops = null; let y = 0;
  const bottom = MARGIN + 28; // room for the footer
  const newPage = () => { ops = []; pages.push(ops); y = PAGE_H - MARGIN; };
  newPage();
  const doc = {
    get y() { return y; }, width: PAGE_W - 2 * MARGIN, left: MARGIN,
    ensure(h) { if (y - h < bottom) newPage(); },
    newPage,
    text(s, x, yy, size = 11, { bold = false, color = '#13202E' } = {}) { ops.push(`BT ${rgb(color)} rg /${bold ? 'F2' : 'F1'} ${size} Tf ${num(x)} ${num(yy)} Td ${pdfStr(s)} Tj ET`); },
    line(x1, y1, x2, y2, color = '#D5DCE4', w = 1) { ops.push(`${rgb(color)} RG ${w} w ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S`); },
    rect(x, yy, w, h, color) { ops.push(`${rgb(color)} rg ${num(x)} ${num(yy)} ${num(w)} ${num(h)} re f`); },
    gap(h) { y -= h; },
    // A paragraph that may run over several pages.
    para(s, { size = 11, bold = false, color = '#13202E', indent = 0, lead = 1.35 } = {}) {
      const lh = size * lead;
      for (const l of wrap(s, size, doc.width - indent, bold)) { doc.ensure(lh); y -= lh; doc.text(l, MARGIN + indent, y + size * 0.25, size, { bold, color }); }
    },
    heading(s, { size = 14, color = '#12355B' } = {}) { doc.ensure(size * 1.6 + 40); y -= 8; doc.para(s, { size, bold: true, color }); y -= 4; },
    // Table: header row repeated on each new page; cells wrap.
    table(headers, rows, fractions, { size = 9.5 } = {}) {
      const ws = fractions.map((f) => f * doc.width); const pad = 5; const lh = size * 1.3;
      const drawRow = (cells, head) => {
        const wrapped = cells.map((c, i) => wrap(c, size, ws[i] - 2 * pad, head));
        const h = Math.max(...wrapped.map((l) => l.length)) * lh + 2 * pad;
        return { h, draw() { if (head) doc.rect(MARGIN, y - h, doc.width, h, '#F1F4F8'); let x = MARGIN; wrapped.forEach((ls, i) => { ls.forEach((l, j) => doc.text(l, x + pad, y - pad - (j + 1) * lh + size * 0.3, size, { bold: head, color: head ? '#4A5A6A' : '#13202E' })); x += ws[i]; }); y -= h; doc.line(MARGIN, y, MARGIN + doc.width, y); } };
      };
      const head = () => { const r = drawRow(headers, true); r.draw(); };
      doc.ensure(lh * 3 + 20); head();
      for (const cells of rows) { const r = drawRow(cells.map((c) => String(c ?? '')), false); if (y - r.h < bottom) { newPage(); head(); } r.draw(); }
    },
    // A JPEG photo (bytes + pixel size), scaled to fit `maxW` x `maxH` points.
    image(bytes, pw, ph, maxW, maxH, x = MARGIN) {
      const s = Math.min(maxW / pw, maxH / ph, 1); const w = pw * s, h = ph * s;
      const id = images.push({ bytes, pw, ph }) ; ops.push(`q ${num(w)} 0 0 ${num(h)} ${num(x)} ${num(y - h)} cm /Im${id} Do Q`);
      return { w, h };
    },
    // Finish: returns the PDF as a Uint8Array.
    finish(meta = {}) {
      const n = pages.length;
      pages.forEach((p, i) => {
        p.push(`${rgb('#D5DCE4')} RG 1 w ${MARGIN} ${MARGIN + 18} m ${PAGE_W - MARGIN} ${MARGIN + 18} l S`);
        p.push(`BT ${rgb('#4A5A6A')} rg /F1 8 Tf ${MARGIN} ${MARGIN + 6} Td ${pdfStr(footerLeft)} Tj ET`);
        const right = `${footerRight}${footerRight ? '   ' : ''}${pageLabel(i + 1, n)}`;
        p.push(`BT ${rgb('#4A5A6A')} rg /F1 8 Tf ${num(PAGE_W - MARGIN - textWidth(right, 8))} ${MARGIN + 6} Td ${pdfStr(right)} Tj ET`);
      });
      return assemble(pages, images, meta);
    },
  };
  return doc;
}

function assemble(pages, images, meta) {
  const enc = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 255);
  const chunks = []; const offsets = []; let len = 0;
  const push = (u8) => { chunks.push(u8); len += u8.length; };
  const obj = (id, body) => { offsets[id] = len; push(enc(`${id} 0 obj\n`)); for (const b of [].concat(body)) push(typeof b === 'string' ? enc(b) : b); push(enc('\nendobj\n')); };
  // Object numbers: 1 catalog, 2 pages, 3 F1, 4 F2, 5 info, then images, then page + content pairs.
  const imgBase = 6, pageBase = imgBase + images.length;
  const pageIds = pages.map((_, i) => pageBase + i * 2);
  push(enc('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'));
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${pageIds.map((i) => i + ' 0 R').join(' ')}] /Count ${pages.length} >>`);
  obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  obj(5, `<< /Title ${pdfStr(meta.title || '')} /Producer ${pdfStr(meta.producer || '')} >>`);
  images.forEach((im, i) => obj(imgBase + i, [`<< /Type /XObject /Subtype /Image /Width ${im.pw} /Height ${im.ph} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`, im.bytes, '\nendstream']));
  const xo = images.length ? `/XObject << ${images.map((_, i) => `/Im${i + 1} ${imgBase + i} 0 R`).join(' ')} >>` : '';
  pages.forEach((p, i) => {
    const content = enc(p.join('\n'));
    obj(pageIds[i], `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${xo} >> /Contents ${pageIds[i] + 1} 0 R >>`);
    obj(pageIds[i] + 1, [`<< /Length ${content.length} >>\nstream\n`, content, '\nendstream']);
  });
  const total = pageBase + pages.length * 2; const xref = len;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  push(enc(x + `trailer\n<< /Size ${total} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  const out = new Uint8Array(len); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

// Turns any image the browser can show (data: URL) into baseline RGB JPEG bytes, at most `max` pixels on the long side.
export async function toJpeg(src, max = 1600) {
  const img = new Image(); img.src = src; await img.decode();
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s));
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), pw: c.width, ph: c.height };
}
