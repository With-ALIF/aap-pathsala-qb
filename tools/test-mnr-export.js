const fs = require('fs');

// Load a shard
const dat005 = fs.readFileSync('dat/dat-005.js', 'utf8');
const idx005 = fs.readFileSync('idx/idx-005.js', 'utf8');

const window = {
  DATMAP: { 5: {} },
  QB_DAT: { 5: [] },
  SUBJ_LABEL: {},
  UNIT_LABEL: {},
  SET_LABEL: {},
  isBlank: v => v === null || v === undefined
};

// Evaluate dat-005 to populate window.DATMAP
const datScript = dat005.replace('window.QB_DAT[5]=', 'window.QB_DAT[5]=');
eval(datScript);
for (const item of window.QB_DAT[5]) {
  window.DATMAP[5][item.p] = item;
}

// Function definitions as in mnr.js
function stripHTML(s) {
  if (s == null) return '';
  let str = String(s);
  str = str.replace(/<img[^>]*>/gi, '');
  str = str.replace(/<span class="katex-mathml">[\s\S]*?<\/span>/gi, '');
  str = str.replace(/<sup[^>]*>([\s\S]*?)<\/sup>/gi, (m, inner) => {
    const t = inner.replace(/<[^>]*>/g, '').trim();
    return t ? '^{' + t + '}' : '';
  });
  str = str.replace(/<sub[^>]*>([\s\S]*?)<\/sub>/gi, (m, inner) => {
    const t = inner.replace(/<[^>]*>/g, '').trim();
    return t ? '_{' + t + '}' : '';
  });
  str = str.replace(/<[^>]*>/g, ' ');
  str = str.replace(/&nbsp;/gi, ' ')
           .replace(/&amp;/gi, '&')
           .replace(/&lt;/gi, '<')
           .replace(/&gt;/gi, '>')
           .replace(/&quot;/gi, '"')
           .replace(/&#39;/gi, "'")
           .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(d));
  return str.replace(/\s+/g, ' ').trim();
}

function imgURLs(html) {
  if (!html) return [];
  const str = String(html).trim();
  if (/^https?:\/\/[^\s"'<>]+\.(?:png|jpe?g|gif|webp|svg)(?:\?[^\s"'<>]*)?$/i.test(str)) {
    return [str];
  }
  const out = [], re = /<img[^>]+src=["']?([^"'\s>]+)/gi;
  let m;
  while ((m = re.exec(str))) {
    if (m[1]) out.push(m[1].replace(/["']$/, ''));
  }
  return out;
}
function imgCell(html) {
  const u = imgURLs(html);
  return !u.length ? '' : (u.length === 1 ? u[0] : JSON.stringify(u));
}

function explainText(full) {
  let t = stripHTML(full.et);
  if (!t) t = stripHTML(full.e);
  if (/^https?:\/\/[^\s]+$/i.test(t)) return '';
  return t;
}

function explainImg(full) {
  let u = imgURLs(full.e);
  if (!u.length && full.et) u = imgURLs(full.et);
  return !u.length ? '' : (u.length === 1 ? u[0] : JSON.stringify(u));
}

function csvQ(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }
function csvCorrect(v) {
  if (v === '') return '';
  return v.indexOf(',') < 0 ? v : '"' + v.replace(/"/g, '""') + '"';
}

function correctList(full, rec) {
  const out = [];
  (full.o || []).forEach((o, i) => { if (o && o.c) out.push(i + 1); });
  if (!out.length && rec && rec.a != null) out.push(rec.a);
  return out.join(',');
}

function paperIdOf(s) {
  if (window.isBlank(s)) return '';
  const t = String(s).toLowerCase().replace(/-/g, '');
  return t.replace(/^(bangla|ban|ba|bn)(\d*)$/, (m, p, d) => 'bn' + d);
}

function chapterIdOf(c, paperId) {
  if (window.isBlank(c)) return '';
  const tag = String(c).trim(), dot = tag.indexOf('.');
  if (dot !== -1) return tag.substring(dot + 1).trim();
  const hy = tag.indexOf('-');
  if (hy !== -1) {
    const after = tag.substring(hy + 1).trim();
    if (/^\d+$/.test(after)) {
      const flat = tag.toLowerCase().replace(/-/g, '');
      const cleaned = flat.replace(/^(bangla|ban|ba|bn)(\d*)$/, (m, p, d) => 'bn' + d);
      if (paperId === flat || paperId === cleaned) return '';
      return after;
    }
    return tag;
  }
  return tag;
}

function mnrRow(rec) {
  const full = (window.DATMAP[rec.__shard] || {})[rec.p] || {};
  const q = (full && full.q ? stripHTML(full.q) : '') || rec.t || '';
  const opts = full.o || [];
  const cells = [csvQ(q), csvQ(imgCell(full.q))];
  for (let i = 0; i < 5; i++) {
    const o = opts[i];
    const optText = o ? ((o.h ? stripHTML(o.h) : '') || o.t || '') : '';
    cells.push(csvQ(optText));
    cells.push(csvQ(o ? imgCell(o.h) : ''));
  }
  const paper = paperIdOf(rec.s);
  cells.push(csvCorrect(correctList(full, rec)));
  cells.push(csvQ(explainText(full)));
  cells.push(csvQ(explainImg(full)));
  cells.push(csvQ(''));
  cells.push(csvQ(paper));
  cells.push(csvQ(chapterIdOf(rec.c, paper)));
  cells.push(csvQ(rec.k == null ? '' : String(rec.k)));
  return cells.join(',');
}

// Test question 443278 (Matrix question)
const rec = {
  p: 443278,
  __shard: 5,
  s: "M-1",
  c: "M-1.1",
  k: "প্রশ্নমালা - 1.1.A"
};

const row = mnrRow(rec);
console.log('Result MNR Row:\n', row);

// Check if latex/math is preserved
if (row.includes('A=[(0,a,b),(-1,0,3),(2,c,0)]') && row.includes('https://testmozusercontent.com/ugc/2024-08-13/ec053270-6314-4dce-8db6-7370fbc0b236-image.png')) {
  console.log('✓ PASS: LaTeX math and image URL correctly handled!');
} else {
  console.error('FAIL');
  process.exit(1);
}

