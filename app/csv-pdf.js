(function () {
  'use strict';

  // This page is deliberately separate from the question-bank browser. It
  // loads only the shared paper/PDF engine; CSV rows never touch the bank,
  // the saved-question store, or the normal PDF preset.
  var SHARD = '__csvpdf';
  var MAX_BYTES = 5 * 1024 * 1024;
  var MAX_ROWS = 2000;
  var OPT_KEY = 'qb_csvpdf_opts';
  var DUR_KEY = 'qb_csvpdf_duration';
  var WM_KEY = 'qb_csvpdf_wmimg';
  var readToken = 0;
  var prefetchToken = 0;
  var prefetchCache = Object.create(null);
  var current = null;

  // Shared paper/pdf modules expect these globals. This page has no bank
  // manifest, so provide only the small surface they need.
  window.DATMAP = window.DATMAP || {};
  window.BN_DIGITS = window.BN_DIGITS || ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  window.NONE = window.NONE || '__none__';
  window.pdfImportRows = null;
  window.pdfImportName = '';
  window.pdfSeedOverride = 0;
  window.selRecs = function () { return []; };
  window.pendingFor = function () { return []; };
  window.loadDat = function () { return Promise.resolve(); };
  window.sanitizeName = function (s) {
    return String(s == null ? '' : s)
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 90);
  };

  function $(id) { return document.getElementById(id); }
  function bn(v) { return window.bnNum(v == null ? 0 : v); }
  function setText(id, text) {
    var el = $(id);
    if (el) el.textContent = text == null ? '' : String(text);
  }
  function clearNode(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  }
  function sizeLabel(n) {
    n = Number(n) || 0;
    if (!n) return '০ বাইট';
    if (n >= 1048576) return bn((n / 1048576).toFixed(1)) + ' MB';
    return bn(Math.max(1, Math.round(n / 1024))) + ' KB';
  }

  // ---------------- status / busy ----------------
  var statusTimer = 0;
  window.flashNote = function (msg) {
    var el = $('csvPdfStatus');
    if (!el) return;
    el.hidden = false;
    el.textContent = msg || '';
    el.className = 'csvpdf-status';
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () {
      if (!document.body.classList.contains('csvpdf-busy')) el.hidden = true;
    }, 4500);
  };
  window.setSelBusy = function (on, label) {
    var el = $('csvPdfStatus');
    document.body.classList.toggle('csvpdf-busy', !!on);
    if (!el) return;
    if (on) {
      clearTimeout(statusTimer);
      el.hidden = false;
      el.className = 'csvpdf-status csvpdf-status-busy';
      el.textContent = label || 'কাজ চলছে…';
    } else {
      el.hidden = false;
      el.className = 'csvpdf-status csvpdf-status-ok';
      el.textContent = 'প্রস্তুত';
      clearTimeout(statusTimer);
      statusTimer = setTimeout(function () { el.hidden = true; }, 2500);
    }
  };

  // The shared PDF renderer calls this with a percentage while it prepares
  // the paper and rasterises each page. It is a no-op on pages that do not
  // provide a progress UI.
  var progressHideTimer = 0;
  window.onPdfProgress = function (percent, label, mode) {
    var box = $('csvPdfProgress');
    if (!box) return;
    clearTimeout(progressHideTimer);
    if (percent == null || percent < 0) {
      box.hidden = true;
      document.body.classList.remove('csvpdf-progressing');
      return;
    }
    percent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    box.hidden = false;
    document.body.classList.add('csvpdf-progressing');
    var status = $('csvPdfStatus');
    if (status) status.hidden = true;
    var head = $('csvPdfProgressHead');
    if (head) head.textContent = mode === 'preview' ? 'প্রিভিউ তৈরি হচ্ছে' : 'PDF তৈরি হচ্ছে';
    var phase = $('csvPdfProgressPhase');
    if (phase) phase.textContent = label || 'প্রস্তুত হচ্ছে…';
    var pct = $('csvPdfProgressPct');
    if (pct) pct.textContent = bn(percent) + '%';
    var fill = $('csvPdfProgressFill');
    if (fill) fill.style.width = percent + '%';
    var bar = $('csvPdfProgressBar');
    if (bar) bar.setAttribute('aria-valuenow', String(percent));
    var detail = $('csvPdfProgressDetail');
    if (detail) {
      if (percent >= 100) detail.textContent = mode === 'preview' ? 'প্রিভিউ প্রস্তুত' : 'PDF ফাইল প্রস্তুত';
      else if (/পেজ|পৃষ্ঠা/.test(label || '')) detail.textContent = 'প্রতিটি পৃষ্ঠা ছবিতে রূপান্তর করা হচ্ছে…';
      else detail.textContent = 'অনুগ্রহ করে অপেক্ষা করুন…';
    }
    var live = $('csvPdfProgressLive');
    if (live) live.textContent = percent >= 100 ? '✓' : '';
    if (percent >= 100) {
      progressHideTimer = setTimeout(function () {
        box.hidden = true;
        document.body.classList.remove('csvpdf-progressing');
      }, 900);
    }
  };

  // ---------------- preferences (separate from the main PDF preset) ----------------
  window.loadPdfOpts = function () {
    try { return JSON.parse(localStorage.getItem(OPT_KEY) || '{}') || {}; } catch (e) { return {}; }
  };
  window.savePdfOpts = function () {
    function v(id) { var el = $(id); return el ? String(el.value || '').trim() : ''; }
    var qEl = $('pdfQSize'), hEl = $('pdfHSize'), opEl = $('pdfWmOp');
    var ansEl = $('pdfAns'), setsEl = $('pdfSets'), imgEl = $('pdfImages');
    try {
      localStorage.setItem(OPT_KEY, JSON.stringify({
        title: v('pdfTitleIn'),
        tutor: v('pdfTutor'),
        subject: v('pdfSubj'),
        marks: v('pdfMarks'),
        sets: !!(setsEl && setsEl.checked),
        qSize: qEl && Number(qEl.value) > 0 ? Number(qEl.value) : 11,
        hSize: hEl && Number(hEl.value) > 0 ? Number(hEl.value) : 24,
        watermark: v('pdfWm'),
        wmTransparency: opEl && Number(opEl.value) > 0 ? Number(opEl.value) : 90,
        footerL: v('pdfFootL'),
        footerR: v('pdfFootR'),
        answers: !(ansEl && ansEl.value === 'no'),
        images: !!(imgEl && imgEl.checked)
      }));
    } catch (e) {}
  };
  window.loadLastDuration = function () {
    try { return localStorage.getItem(DUR_KEY) || ''; } catch (e) { return ''; }
  };
  window.saveLastDuration = function (v) {
    try { if (v) localStorage.setItem(DUR_KEY, v); } catch (e) {}
  };
  window.loadPdfWmImage = function () {
    try { return localStorage.getItem(WM_KEY) || ''; } catch (e) { return ''; }
  };
  window.savePdfWmImage = function (dataUrl) {
    try {
      if (dataUrl) localStorage.setItem(WM_KEY, dataUrl);
      else localStorage.removeItem(WM_KEY);
    } catch (e) {}
  };

  // ---------------- safe HTML + resized remote images ----------------
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function looksLikeHtml(s) {
    return /<\/?[a-zA-Z][^>]*>/.test(String(s == null ? '' : s));
  }
  function sanitizeHtml(raw) {
    var source = String(raw == null ? '' : raw);
    try {
      var doc = new DOMParser().parseFromString(source, 'text/html');
      var blocked = {
        SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, LINK: 1,
        META: 1, BASE: 1, FORM: 1, INPUT: 1, BUTTON: 1, TEXTAREA: 1,
        SELECT: 1, OPTION: 1, VIDEO: 1, AUDIO: 1, SOURCE: 1, TRACK: 1
      };
      function clean(node) {
        var kids = Array.prototype.slice.call(node.childNodes);
        for (var i = 0; i < kids.length; i++) {
          var child = kids[i];
          if (child.nodeType === 8) { node.removeChild(child); continue; }
          if (child.nodeType !== 1) continue;
          if (blocked[child.tagName]) { node.removeChild(child); continue; }
          var attrs = Array.prototype.slice.call(child.attributes);
          for (var a = 0; a < attrs.length; a++) {
            var attr = attrs[a];
            var name = String(attr.name || '').toLowerCase();
            var val = String(attr.value || '');
            if (/^on/.test(name) || name === 'srcdoc' || name === 'formaction' || name === 'id') {
              child.removeAttribute(attr.name);
            } else if ((name === 'href' || name === 'src' || name === 'xlink:href' || name === 'poster') &&
                       /^\s*(?:javascript|vbscript|data:text\/html)/i.test(val)) {
              child.removeAttribute(attr.name);
            } else if (name === 'style' && /expression|javascript:|@import|behavior/i.test(val)) {
              child.removeAttribute(attr.name);
            }
          }
          clean(child);
        }
      }
      if (doc.body) clean(doc.body);
      return doc.body ? doc.body.innerHTML : '';
    } catch (e) {
      return escapeHtml(source.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
    }
  }
  function proxyImageHtml(html) {
    return String(html == null ? '' : html).replace(
      /(<img\b[^>]*?(?:^|\s)src\s*=\s*["'])(https?:\/\/testmozusercontent\.com\/[^"']+)(["'])/gi,
      function (m, pre, url, post) {
        var original = canonicalUrl(url);
        var proxy = 'https://images.weserv.nl/?url=' + encodeURIComponent(original) +
          '&w=1000&output=jpg&q=82';
        return pre + proxy + post + ' data-orig-src="' +
          original.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"';
      }
    );
  }
  window.addEventListener('error', function (e) {
    var img = e && e.target;
    if (!img || img.tagName !== 'IMG' || !img.getAttribute) return;
    var original = img.getAttribute('data-orig-src');
    if (!original || img.getAttribute('data-orig-tried')) return;
    img.setAttribute('data-orig-tried', '1');
    img.src = original;
  }, true);
  function htmlOf(v) {
    var s = String(v == null ? '' : v).replace(/\r\n?/g, '\n').trim();
    if (!s) return '';
    if (!looksLikeHtml(s)) return proxyImageHtml(escapeHtml(s).replace(/\n/g, '<br>'));
    return proxyImageHtml(sanitizeHtml(s));
  }
  function plainOfHtml(html) {
    if (!html) return '';
    try {
      var d = document.createElement('div');
      d.innerHTML = String(html)
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/(?:p|div|li|tr|h[1-6])>/gi, ' ');
      return String(d.textContent || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
    } catch (e) {
      return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }
  function plainOf(v) { return plainOfHtml(htmlOf(v)); }
  function meaningful(v) {
    var s = String(v == null ? '' : v).trim();
    if (!s) return false;
    if (/<img\b/i.test(s)) return true;
    return !!plainOf(s);
  }

  // ---------------- CSV parsing ----------------
  function detectDelimiter(text) {
    var first = '';
    var lines = String(text || '').split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].trim()) { first = lines[i]; break; }
    }
    var counts = { ',': 0, ';': 0, '\t': 0 };
    var inQuote = false;
    for (var j = 0; j < first.length; j++) {
      var c = first.charAt(j);
      if (c === '"') inQuote = !inQuote;
      else if (!inQuote && counts[c] != null) counts[c]++;
    }
    var best = ',';
    if (counts[';'] > counts[best]) best = ';';
    if (counts['\t'] > counts[best]) best = '\t';
    return best;
  }
  function parseRows(text, delim) {
    var rows = [];
    var row = [];
    var cell = '';
    var inQuote = false;
    function pushRow() {
      row.push(cell);
      var empty = true;
      for (var x = 0; x < row.length; x++) {
        if (String(row[x] == null ? '' : row[x]).trim() !== '') { empty = false; break; }
      }
      if (!empty) rows.push(row);
      row = [];
      cell = '';
    }
    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if (inQuote) {
        if (c === '"') {
          if (text.charAt(i + 1) === '"') { cell += '"'; i++; }
          else inQuote = false;
        } else {
          cell += c;
        }
      } else if (c === '"' && cell === '') {
        inQuote = true;
      } else if (c === delim) {
        row.push(cell);
        cell = '';
      } else if (c === '\n') {
        pushRow();
      } else if (c === '\r') {
        if (text.charAt(i + 1) === '\n') i++;
        pushRow();
      } else {
        cell += c;
      }
    }
    if (cell !== '' || row.length) pushRow();
    return rows;
  }

  // ---------------- header / field mapping ----------------
  function normKey(s) {
    return String(s == null ? '' : s)
      .replace(/^\uFEFF/, '')
      .toLowerCase()
      .replace(/[\s_\-]+/g, '')
      .trim();
  }
  var Q_NAMES = ['questions', 'question', 'questiontext', 'questiontitle', 'প্রশ্ন', 'problem', 'stem'];
  var A_NAMES = ['answer', 'answers', 'answerkey', 'correctanswer', 'correctanswers', 'correctanswerkey',
    'correctoption', 'correctoptions', 'ans', 'উত্তর', 'সঠিকউত্তর'];
  var E_NAMES = ['explanation', 'explain', 'solution', 'explanationtext', 'ব্যাখ্যা', 'সমাধান'];
  var T_NAMES = ['type', 'questiontype'];
  var S_NAMES = ['section', 'topic', 'chapter', 'subject', 'subjectname', 'papername',
    'chaptername', 'topicname', 'বিভাগ', 'বিষয়', 'অধ্যায়'];
  var OPT_NAMES = [
    ['option1', 'optiona', 'opt1', 'choice1', 'choicea'],
    ['option2', 'optionb', 'opt2', 'choice2', 'choiceb'],
    ['option3', 'optionc', 'opt3', 'choice3', 'choicec'],
    ['option4', 'optiond', 'opt4', 'choice4', 'choiced'],
    ['option5', 'optione', 'opt5', 'choice5', 'choicee']
  ];
  function findColumn(header, names) {
    var wanted = {};
    for (var i = 0; i < names.length; i++) wanted[names[i]] = true;
    for (var j = 0; j < header.length; j++) {
      if (wanted[normKey(header[j])]) return j;
    }
    return -1;
  }
  function looksLikeHeader(row) {
    var strong = 0;
    for (var j = 0; j < row.length; j++) {
      var key = normKey(row[j]);
      if (Q_NAMES.indexOf(key) !== -1) return true;
      if (A_NAMES.indexOf(key) !== -1 || E_NAMES.indexOf(key) !== -1 || T_NAMES.indexOf(key) !== -1) {
        strong++;
      } else {
        for (var i = 0; i < OPT_NAMES.length; i++) {
          if (OPT_NAMES[i].indexOf(key) !== -1) { strong++; break; }
        }
      }
    }
    return strong >= 2;
  }
  function mapHeader(header) {
    return {
      q: findColumn(header, Q_NAMES),
      opts: OPT_NAMES.map(function (names) { return findColumn(header, names); }),
      a: findColumn(header, A_NAMES),
      e: findColumn(header, E_NAMES),
      ty: findColumn(header, T_NAMES),
      sec: findColumn(header, S_NAMES)
    };
  }
  function cellAt(row, idx) {
    if (idx == null || idx < 0 || idx >= row.length) return '';
    return row[idx] == null ? '' : String(row[idx]);
  }
  function toEnglishDigits(s) {
    return String(s || '').replace(/[০-৯]/g, function (d) {
      return String(d.charCodeAt(0) - 0x09E6);
    });
  }
  function parseAnswer(raw, opts) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return 0;
    var first = s.split(/[,;|]/)[0].trim();
    var token = first.replace(/^[\(\[]\s*/, '').replace(/\s*[\)\]]$/, '').trim();
    token = token.replace(/^(?:correct\s+)?(?:option|opt|ans(?:wer)?)\s*[:\-]?\s*/i, '');
    var m = token.match(/^([0-9]+|[A-Ea-e]|[১-৫]|[কখগঘঙ])\s*[\.:]?$/);
    if (m) {
      var t = m[1];
      if (/^[০-৯]$/.test(t)) return parseInt(toEnglishDigits(t), 10);
      if (/^[0-9]+$/.test(t)) return parseInt(t, 10);
      if (/^[A-Ea-e]$/.test(t)) return t.toUpperCase().charCodeAt(0) - 64;
      var bi = 'কখগঘঙ'.indexOf(t);
      if (bi >= 0) return bi + 1;
    }
    var wanted = window.normOpts(plainOf(s));
    for (var i = 0; i < opts.length; i++) {
      if (window.normOpts(plainOf(opts[i])) === wanted) return i + 1;
    }
    return 0;
  }
  function typeOf(raw, opts) {
    var t = normKey(raw);
    if (/^(written|লিখিত|subjective|2)$/.test(t)) return 'written';
    return opts.length ? 'mcq' : 'written';
  }

  // ---------------- build imported rows ----------------
  function buildState(text, name) {
    text = String(text == null ? '' : text).replace(/^\uFEFF/, '').replace(/\u0000/g, '');
    var warnings = [];
    if (/\uFFFD/.test(text)) {
      warnings.push('ফাইলটি UTF-8 হিসেবে সঠিকভাবে পড়া যায়নি — UTF-8 এনকোডিং-এ CSV রপ্তানি করুন।');
    }
    var delim = detectDelimiter(text);
    var all = parseRows(text, delim);
    if (!all.length) throw new Error('ফাইলটি খালি মনে হচ্ছে');
    var header = null;
    var data = all;
    if (looksLikeHeader(all[0])) {
      header = all[0];
      data = all.slice(1);
    } else {
      warnings.push('হেডার সারি পাওয়া যায়নি — কলামগুলো অবস্থান ধরে নেওয়া হয়েছে।');
    }
    if (data.length > MAX_ROWS) {
      throw new Error('সর্বোচ্চ ' + bn(MAX_ROWS) + 'টি প্রশ্নের CSV সমর্থিত');
    }
    var map = header ? mapHeader(header) : {
      q: 0,
      opts: [1, 2, 3, 4, 5],
      a: 6,
      e: 7,
      ty: 8,
      sec: 9
    };
    if (map.q < 0) throw new Error('CSV-তে প্রশ্নের কলাম (questions) পাওয়া যায়নি');

    var rows = [];
    var dat = Object.create(null);
    var invalid = 0;
    var mcq = 0;
    var written = 0;
    var noAns = 0;
    var images = 0;
    var qImages = 0;
    var eImages = 0;

    for (var i = 0; i < data.length; i++) {
      var row = data[i] || [];
      var rowNo = header ? i + 2 : i + 1;
      if (!row.some(function (c) { return String(c == null ? '' : c).trim(); })) continue;
      var qRaw = cellAt(row, map.q);
      if (!meaningful(qRaw)) {
        invalid++;
        if (warnings.length < 30) warnings.push('সারি ' + bn(rowNo) + ': প্রশ্নের লেখা নেই');
        continue;
      }

      var rawOpts = map.opts.map(function (idx) { return cellAt(row, idx); });
      var ansPos = parseAnswer(cellAt(row, map.a), rawOpts);
      var kept = [];
      for (var oi = 0; oi < rawOpts.length; oi++) {
        if (meaningful(rawOpts[oi])) kept.push({ raw: rawOpts[oi], pos: oi + 1 });
      }
      var answer = 0;
      if (ansPos > 0) {
        for (var ki = 0; ki < kept.length; ki++) {
          if (kept[ki].pos === ansPos) { answer = ki + 1; break; }
        }
      }

      var ty = typeOf(cellAt(row, map.ty), kept);
      var explRaw = cellAt(row, map.e);
      var opts = [];
      for (var k = 0; k < kept.length; k++) {
        var h = htmlOf(kept[k].raw);
        opts.push({ n: k + 1, h: h, t: plainOfHtml(h), c: answer === k + 1 ? 1 : 0 });
      }
      if (ty === 'written') written++; else mcq++;
      if (ty !== 'written' && !answer) {
        noAns++;
        if (warnings.length < 30) warnings.push('সারি ' + bn(rowNo) + ': সঠিক উত্তর শনাক্ত হয়নি');
      }

      var p = -(rows.length + 1);
      var qHtml = htmlOf(qRaw);
      var explHtml = explRaw && meaningful(explRaw) ? htmlOf(explRaw) : '';
      var qImgHtml = qHtml + opts.map(function (op) { return op.h; }).join(' ');
      var rowQImages = (qImgHtml.match(/<img\b/gi) || []).length;
      var rowEImages = (explHtml.match(/<img\b/gi) || []).length;
      qImages += rowQImages;
      eImages += rowEImages;
      images += rowQImages + rowEImages;
      var full = {
        p: p,
        q: qHtml,
        o: opts,
        a: answer || null,
        e: explHtml,
        et: explHtml ? plainOfHtml(explHtml) : ''
      };
      var rec = {
        p: p,
        _sh: SHARD,
        __shard: SHARD,
        t: plainOfHtml(qHtml),
        n: opts.length,
        a: answer || null,
        ty: ty,
        e: full.e ? 1 : 0,
        k: String(cellAt(row, map.sec) || '').trim()
      };
      dat[p] = full;
      rows.push(rec);
    }

    if (!rows.length) throw new Error('কোনো বৈধ প্রশ্ন পাওয়া যায়নি');
    if (images >= 30) {
      warnings.push('এই CSV-তে ' + bn(images) + 'টি ছবি আছে — PDF তৈরি হতে সময় লাগতে পারে। ' +
        'দ্রুত PDF-এর জন্য সেটিংসে “ব্যাখ্যার ছবি যুক্ত করুন” বন্ধ করুন।');
    }
    window.DATMAP[SHARD] = dat;
    return {
      name: name || '',
      rows: rows,
      dat: dat,
      invalid: invalid,
      warnings: warnings,
      mcq: mcq,
      written: written,
      noAns: noAns,
      images: images,
      qImages: qImages,
      eImages: eImages
    };
  }

  // ---------------- image prefetch ----------------
  window.csvStopPrefetch = function () { prefetchToken++; };
  var imagePromises = Object.create(null);
  function canonicalUrl(url) {
    return String(url == null ? '' : url)
      .replace(/&amp;/gi, '&')
      .replace(/&#0*38;/gi, '&');
  }
  function imageUrlsFromHtml(html, seen) {
    // Match the actual src attribute only. A loose \bsrc also matches
    // data-orig-src (the fallback URL), which made prefetch warm the wrong
    // URL and left the resized proxy images uncached.
    var re = /<img\b[^>]*?(?:^|\s)src\s*=\s*["']([^"']+)["']/gi;
    var m;
    while ((m = re.exec(String(html || '')))) {
      var url = canonicalUrl(m[1]);
      if (/^https?:\/\//i.test(url)) seen[url] = 1;
    }
  }
  function fullHtml(full) {
    var html = String(full.q || '') + String(full.e || '');
    (full.o || []).forEach(function (op) { html += String(op.h || ''); });
    return html;
  }
  function collectImageUrls(st, includeExplanation) {
    var seen = Object.create(null);
    Object.keys((st && st.dat) || {}).forEach(function (key) {
      var full = st.dat[key] || {};
      var html = includeExplanation === false
        ? String(full.q || '') + (full.o || []).map(function (op) { return String(op.h || ''); }).join(' ')
        : fullHtml(full);
      imageUrlsFromHtml(html, seen);
    });
    return Object.keys(seen);
  }
  function collectImageUrlsFromRows(rows, includeExplanation) {
    var seen = Object.create(null);
    (rows || []).forEach(function (rec) {
      var sh = rec._sh != null ? rec._sh : rec.__shard;
      var full = (window.DATMAP[sh] || {})[rec.p] || {};
      var html = includeExplanation === false
        ? String(full.q || '') + (full.o || []).map(function (op) { return String(op.h || ''); }).join(' ')
        : fullHtml(full);
      imageUrlsFromHtml(html, seen);
    });
    return Object.keys(seen);
  }
  function proxyOriginal(url) {
    var m = /[?&]url=([^&]+)/.exec(String(url || ''));
    if (!m) return '';
    try { return canonicalUrl(decodeURIComponent(m[1])); } catch (e) { return ''; }
  }
  function rememberSize(url, img) {
    if (!img || !img.naturalWidth || !img.naturalHeight || !window.IMG_SIZE) return;
    window.IMG_SIZE[url] = [img.naturalWidth, img.naturalHeight];
  }
  function loadImage(url, timeoutMs) {
    var u = canonicalUrl(url);
    if (!u) return Promise.resolve(false);
    if (window.IMG_SIZE && window.IMG_SIZE[u]) return Promise.resolve(true);
    if (imagePromises[u]) return imagePromises[u];
    var p = new Promise(function (resolve) {
      var im = new Image();
      var done = false;
      var timer = 0;
      var original = proxyOriginal(u);
      function finish(ok) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (ok) {
          prefetchCache[u] = im;
          rememberSize(u, im);
          if (original) rememberSize(original, im);
        } else {
          delete imagePromises[u];
        }
        resolve(!!ok);
      }
      timer = setTimeout(function () { finish(false); }, timeoutMs || 20000);
      im.onload = function () {
        finish(!!(im.naturalWidth && im.naturalHeight));
      };
      im.onerror = function () {
        if (original && !im.__origTried) {
          im.__origTried = true;
          try { im.src = original; } catch (e) { finish(false); }
          return;
        }
        finish(false);
      };
      try {
        im.src = u;
      } catch (e) {
        finish(false);
      }
      if (im.complete && im.naturalWidth && im.naturalHeight) finish(true);
    });
    imagePromises[u] = p;
    return p;
  }
  function prefetchImages(st) {
    if (!st) return;
    var token = ++prefetchToken;
    var urls = collectImageUrls(st, true);
    if (!urls.length) return;
    var idx = 0;
    var active = 0;
    function next() {
      if (token !== prefetchToken) return;
      while (active < 4 && idx < urls.length) {
        var url = urls[idx++];
        if (prefetchCache[url] || (window.IMG_SIZE && window.IMG_SIZE[url])) continue;
        active++;
        loadImage(url, 20000).then(function () {
          active--;
          next();
        }, function () {
          active--;
          next();
        });
      }
    }
    next();
  }
  // Called by the PDF renderer before layout. Waiting here makes pagination
  // use real image aspect ratios instead of the zero-size placeholders that
  // a not-yet-loaded <img> has. Without this an image-heavy CSV can paginate
  // one way and then overflow or cut off when the images arrive.
  window.csvEnsureImages = function (rows, includeExplanation) {
    var urls = rows && rows.length
      ? collectImageUrlsFromRows(rows, includeExplanation)
      : (current ? collectImageUrls(current, includeExplanation) : []);
    if (!urls.length) return Promise.resolve();
    var pending = [];
    for (var i = 0; i < urls.length; i++) {
      if (!(window.IMG_SIZE && window.IMG_SIZE[urls[i]]) && !prefetchCache[urls[i]]) {
        pending.push(urls[i]);
      }
    }
    if (!pending.length) return Promise.resolve();
    var done = 0;
    var reporting = true;
    var jobs = pending.map(function (url) {
      return loadImage(url, 20000).then(function (ok) {
        done++;
        if (reporting && typeof window.onPdfProgress === 'function') {
          try {
            window.onPdfProgress(8, 'ছবি লোড হচ্ছে… (' + bn(done) + '/' + bn(pending.length) + ')',
              window.pdfProgressMode || 'pdf');
          } catch (e) {}
        }
        return ok;
      }, function () { return false; });
    });
    var all = Promise.all(jobs).then(function (value) {
      reporting = false;
      return value;
    }, function () {
      reporting = false;
    });
    var timer = new Promise(function (resolve) {
      setTimeout(function () {
        // Once layout has started, a late image must not move the progress
        // bar back to the image-loading phase.
        reporting = false;
        resolve();
      }, 20000);
    });
    return Promise.race([all, timer]).then(function () {
      reporting = false;
    });
  };

  // ---------------- UI ----------------
  function setNote(msg, isError) {
    var note = $('csvImportNote');
    if (!note) return;
    note.textContent = msg || '';
    note.className = 'modal-sub csv-import-note' + (isError ? ' modal-err' : '');
  }
  function showFile(file) {
    var drop = $('csvImportDrop');
    if (drop) drop.classList.add('has-file');
    setText('csvImportFileName', (file.name || 'CSV') + ' · ' + sizeLabel(file.size));
  }
  function chip(label, value, warn) {
    var c = window.el('span', 'csv-chip' + (warn ? ' warn' : ''));
    c.appendChild(window.el('b', null, bn(value)));
    c.appendChild(document.createTextNode(' ' + label));
    return c;
  }
  function resetUi() {
    readToken++;
    if (window.csvStopPrefetch) window.csvStopPrefetch();
    current = null;
    window.csvPdfState = null;
    if (window.endPdfImport) window.endPdfImport();
    var result = $('csvImportResult');
    if (result) result.hidden = true;
    setText('csvImportFileName', 'কোনো ফাইল বাছা হয়নি');
    var drop = $('csvImportDrop');
    if (drop) drop.classList.remove('has-file', 'is-drag');
    var file = $('csvImportFile');
    if (file) file.value = '';
    var go = $('csvImportGo');
    if (go) go.disabled = true;
    setNote('', false);
    clearNode($('csvImportStats'));
    clearNode($('csvImportPreview'));
    var warn = $('csvImportWarn');
    if (warn) { warn.hidden = true; clearNode(warn); }
    setText('csvImportSummary', '');
  }
  function renderState(st) {
    var result = $('csvImportResult');
    if (result) result.hidden = false;
    setText('csvImportSummary', bn(st.rows.length) + 'টি প্রশ্ন পাওয়া গেছে' +
      (st.invalid ? ' · ' + bn(st.invalid) + 'টি সারি বাদ' : ''));
    var stats = $('csvImportStats');
    clearNode(stats);
    if (stats) {
      stats.appendChild(chip('মোট', st.rows.length));
      stats.appendChild(chip('MCQ', st.mcq));
      stats.appendChild(chip('লিখিত', st.written));
      if (st.images) stats.appendChild(chip('ছবি', st.images));
      if (st.noAns) stats.appendChild(chip('উত্তরহীন', st.noAns, true));
    }

    var prev = $('csvImportPreview');
    clearNode(prev);
    if (prev) {
      var letters = ['ক', 'খ', 'গ', 'ঘ', 'ঙ'];
      var limit = Math.min(5, st.rows.length);
      for (var i = 0; i < limit; i++) {
        var rec = st.rows[i];
        var row = window.el('div', 'csv-prev-row');
        row.appendChild(window.el('span', 'csv-prev-n', bn(i + 1)));
        var txt = rec.t || '(শুধু ছবি)';
        if (txt.length > 95) txt = txt.slice(0, 94) + '…';
        row.appendChild(window.el('span', 'csv-prev-t', txt));
        var meta = rec.ty === 'written' ? 'লিখিত' :
          (bn(rec.n) + 'টি অপশন' + (rec.a ? ' · উত্তর ' + (letters[rec.a - 1] || '') : ''));
        row.appendChild(window.el('span', 'csv-prev-m', meta));
        prev.appendChild(row);
      }
      if (st.rows.length > limit) {
        var more = window.el('div', 'csv-prev-row');
        more.appendChild(window.el('span', 'csv-prev-n', '…'));
        more.appendChild(window.el('span', 'csv-prev-t', 'আরও ' + bn(st.rows.length - limit) + 'টি প্রশ্ন আছে'));
        prev.appendChild(more);
      }
    }

    var warn = $('csvImportWarn');
    if (warn) {
      clearNode(warn);
      if (st.warnings.length) {
        warn.hidden = false;
        warn.appendChild(window.el('b', null, 'সতর্কতা'));
        var ul = window.el('ul');
        var shown = Math.min(6, st.warnings.length);
        for (var w = 0; w < shown; w++) ul.appendChild(window.el('li', null, st.warnings[w]));
        if (st.warnings.length > shown) {
          ul.appendChild(window.el('li', null, 'আরও ' + bn(st.warnings.length - shown) + 'টি সতর্কতা আছে'));
        }
        warn.appendChild(ul);
      } else {
        warn.hidden = true;
      }
    }
    var go = $('csvImportGo');
    if (go) go.disabled = false;
    setNote('প্রস্তুত — PDF সেটিংসে গিয়ে সেট, ছবি ও ওয়াটারমার্ক ঠিক করুন।', false);
    window.flashNote('CSV প্রস্তুত — PDF সেটিংস খুলুন');
  }

  function csvImportRead(file) {
    if (!file) return;
    resetUi();
    var token = ++readToken;
    showFile(file);
    if (file.size > MAX_BYTES) {
      setNote('ফাইলটি অনেক বড় — সর্বোচ্চ ' + bn(MAX_BYTES / 1048576) + ' MB CSV দিন।', true);
      return;
    }
    if (!file.size) {
      setNote('ফাইলটি খালি মনে হচ্ছে।', true);
      return;
    }
    var isCsvName = /\.(csv|txt)$/i.test(file.name || '');
    var isCsvType = !file.type || /csv|comma-separated-values|text\/plain|ms-excel/i.test(file.type);
    if (/\.(xls|xlsx)$/i.test(file.name || '')) {
      setNote('Excel ফাইল সমর্থিত নয় — Google Sheets/Excel থেকে CSV হিসেবে সেভ করে দিন।', true);
      return;
    }
    if (!isCsvName && !isCsvType) {
      setNote('শুধু CSV (বা TXT) ফাইল বাছুন।', true);
      return;
    }
    setNote('ফাইল পড়া হচ্ছে…', false);
    var reader = new FileReader();
    reader.onload = function () {
      if (token !== readToken) return;
      try {
        var st = buildState(String(reader.result || ''), file.name || 'CSV');
        current = st;
        window.csvPdfState = st;
        renderState(st);
        prefetchImages(st);
      } catch (err) {
        current = null;
        window.csvPdfState = null;
        var result = $('csvImportResult');
        if (result) result.hidden = true;
        var go = $('csvImportGo');
        if (go) go.disabled = true;
        setNote('CSV পড়া যায়নি — ' + (err && err.message ? err.message : String(err)), true);
        window.flashNote('CSV পড়া যায়নি');
      }
    };
    reader.onerror = function () {
      if (token !== readToken) return;
      setNote('ফাইলটি পড়া যায়নি — আবার চেষ্টা করুন।', true);
    };
    reader.readAsText(file, 'UTF-8');
  }
  window.csvImportRead = csvImportRead;

  function csvImportStartPdf() {
    var st = current;
    if (!st || !st.rows.length) return;
    window.pdfImportRows = st.rows;
    window.pdfImportName = st.name || '';
    window.openPdfModal();
    var title = $('pdfTitleIn');
    if (title) {
      var base = String(st.name || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      title.value = base || '';
    }
    if (st.eImages >= 30) {
      var note = $('pdfNote');
      if (note) {
        note.textContent = 'এই CSV-তে ' + bn(st.eImages) + 'টি ব্যাখ্যা-ছবি আছে — ছবিগুলো PDF-এর জন্য auto resize/cache করা হবে।';
        note.className = 'modal-note';
      }
    }
  }
  window.csvImportStartPdf = csvImportStartPdf;

  function csvImportSample() {
    try {
      var data = [
        ['বাংলাদেশের রাজধানী কোনটি?', 'ঢাকা', 'চট্টগ্রাম', 'খুলনা', 'রাজশাহী', '', '1', 'ঢাকা বাংলাদেশের রাজধানী।', '1', '1'],
        ['২ + ৩ = কত?', '৪', '৫', '৬', '৭', '', '2', '২ ও ৩ যোগ করলে ৫ হয়।', '1', '1'],
        ['নিচের কোনটি প্রাণী?', 'গরু', 'পাথর', 'বই', 'কলম', '', '1', '', '1', '1']
      ];
      var lines = [window.CSV_HEADER || 'questions,option1,option2,option3,option4,option5,answer,explanation,type,section'];
      for (var i = 0; i < data.length; i++) {
        lines.push(data[i].map(function (v) { return window.csvCell(v); }).join(','));
      }
      window.downloadBlob(new Blob(['\uFEFF' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8;' }), 'rayvila-sample.csv');
      setNote('নমুনা CSV নামানো হয়েছে — ফাইলটি খুলে ফরম্যাট দেখুন।', false);
    } catch (e) {
      setNote('নমুনা CSV তৈরি করা যায়নি।', true);
    }
  }

  // ---------------- PDF control bindings ----------------
  function bindUpload() {
    var input = $('csvImportFile');
    var drop = $('csvImportDrop');
    if (input) {
      input.addEventListener('change', function () {
        var f = input.files && input.files[0];
        if (f) csvImportRead(f);
        input.value = '';
      });
    }
    if (drop && input) {
      drop.addEventListener('click', function (e) {
        if (e.target && e.target.closest && e.target.closest('button, a')) return;
        input.click();
      });
      drop.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          input.click();
        }
      });
      drop.addEventListener('dragenter', function (e) {
        e.preventDefault();
        drop.classList.add('is-drag');
      });
      drop.addEventListener('dragover', function (e) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        drop.classList.add('is-drag');
      });
      drop.addEventListener('dragleave', function (e) {
        if (!e.relatedTarget || !drop.contains(e.relatedTarget)) drop.classList.remove('is-drag');
      });
      drop.addEventListener('drop', function (e) {
        e.preventDefault();
        drop.classList.remove('is-drag');
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) csvImportRead(f);
      });
    }
    window.addEventListener('dragover', function (e) { if (e.dataTransfer) e.preventDefault(); });
    window.addEventListener('drop', function (e) { if (e.dataTransfer) e.preventDefault(); });

    var sample = $('csvImportSample');
    if (sample) sample.addEventListener('click', csvImportSample);
    var go = $('csvImportGo');
    if (go) go.addEventListener('click', csvImportStartPdf);
  }

  function bindPdf() {
    if ($('pdfCancel')) $('pdfCancel').addEventListener('click', function () { window.closePdf(); });
    if ($('pdfModal')) {
      $('pdfModal').addEventListener('click', function (e) {
        if (e.target === $('pdfModal')) window.closePdf();
      });
    }
    if ($('pdfGo')) $('pdfGo').addEventListener('click', window.pdfGo);
    if ($('pdfPreviewBtn')) $('pdfPreviewBtn').addEventListener('click', window.pdfPreview);
    if ($('pdfPrevClose')) $('pdfPrevClose').addEventListener('click', window.closePdfPreview);
    if ($('pdfPrevGo')) {
      $('pdfPrevGo').addEventListener('click', function () {
        window.pdfGo();
      });
    }
    if ($('pdfPreview')) {
      $('pdfPreview').addEventListener('click', function (e) {
        if (e.target === $('pdfPreview')) window.closePdfPreview();
      });
    }
    ['pdfQSize', 'pdfHSize', 'pdfWmOp'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', window.updateSizeLabels);
    });

    var wmFile = $('pdfWmImg');
    if (wmFile) {
      wmFile.addEventListener('change', function () {
        var f = wmFile.files && wmFile.files[0];
        if (!f) return;
        if (!/^image\//.test(f.type || '')) {
          window.flashNote('শুধু ছবি (PNG/JPG) ফাইল দিন');
          wmFile.value = '';
          return;
        }
        function applyWm(dataUrl) {
          window.pdfWmImage = dataUrl;
          window.savePdfWmImage(window.pdfWmImage);
          window.updateWmImgHint();
        }
        var fr = new FileReader();
        fr.onload = function () {
          var raw = String(fr.result || '');
          window.pdfWmImageName = f.name || '';
          var img = new Image();
          img.onload = function () {
            var MAX = 1200;
            var w = img.naturalWidth || img.width;
            var h = img.naturalHeight || img.height;
            if (!w || !h || w <= MAX) return applyWm(raw);
            var c = document.createElement('canvas');
            c.width = MAX;
            c.height = Math.max(1, Math.round(h * (MAX / w)));
            var ctx = c.getContext('2d');
            if (!ctx) return applyWm(raw);
            ctx.drawImage(img, 0, 0, c.width, c.height);
            try { applyWm(c.toDataURL('image/png')); } catch (e) { applyWm(raw); }
          };
          img.onerror = function () { applyWm(raw); };
          img.src = raw;
        };
        fr.readAsDataURL(f);
      });
    }
    if ($('pdfWmImgClear')) {
      $('pdfWmImgClear').addEventListener('click', function () {
        window.pdfWmImage = '';
        window.pdfWmImageName = '';
        window.savePdfWmImage('');
        if (wmFile) wmFile.value = '';
        window.updateWmImgHint();
      });
    }
    if ($('pdfSaveClose')) $('pdfSaveClose').addEventListener('click', window.closePdfSave);
    if ($('pdfSaveModal')) {
      $('pdfSaveModal').addEventListener('click', function (e) {
        if (e.target === $('pdfSaveModal')) window.closePdfSave();
      });
    }
    if ($('pdfSaveLink')) {
      $('pdfSaveLink').addEventListener('click', function () {
        if ($('pdfSaveNote')) $('pdfSaveNote').textContent = 'ডাউনলোড শুরু হয়েছে — Downloads ফোল্ডারে দেখুন।';
      });
    }
    if ($('pdfTime')) {
      $('pdfTime').addEventListener('input', window.updateDurationHint);
      $('pdfTime').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); window.pdfGo(); }
      });
    }
    var imgToggle = $('pdfImages');
    if (imgToggle) {
      imgToggle.addEventListener('change', function () {
        if (imgToggle.checked && current) prefetchImages(current);
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if ($('pdfSaveModal') && !$('pdfSaveModal').hidden) { window.closePdfSave(); return; }
      if ($('pdfPreview') && !$('pdfPreview').hidden) { window.closePdfPreview(); return; }
      if ($('pdfModal') && !$('pdfModal').hidden) window.closePdf();
    });
  }

  function bindTheme() {
    var btn = $('themeBtn');
    if (btn) {
      btn.addEventListener('click', function () {
        var next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem('qb-theme', next); } catch (e) {}
        if (window.updateThemeIcon) window.updateThemeIcon();
      });
    }
  }

  function init() {
    try {
      var saved = localStorage.getItem('qb-theme');
      document.documentElement.dataset.theme = saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } catch (e) {}
    if (window.hydrateIcons) window.hydrateIcons(document);
    if (window.updateThemeIcon) window.updateThemeIcon();
    bindUpload();
    bindPdf();
    bindTheme();
    setNote('Rayvila CSV বেছে নিন — ফাইলটি শুধু এই ব্রাউজারেই প্রসেস হবে।', false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
