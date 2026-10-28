(function () {
  'use strict';

  // Imported questions live in their own synthetic shard so the normal PDF
  // pipeline (pendingFor -> DATMAP -> buildPaper) can read them unchanged.
  var SHARD = '__csv';
  var MAX_BYTES = 5 * 1024 * 1024;
  var MAX_ROWS = 1000;
  var readToken = 0;

  function $(id) { return window.$(id); }
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

  // ---------------- safe HTML ----------------
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
  // CSV can contain formatting and images (the app's own export does), but it
  // must not be able to run scripts or handlers inside the preview/PDF DOM.
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
  function htmlOf(v) {
    var s = String(v == null ? '' : v).replace(/\r\n?/g, '\n').trim();
    if (!s) return '';
    if (!looksLikeHtml(s)) return escapeHtml(s).replace(/\n/g, '<br>');
    return sanitizeHtml(s);
  }
  // The shared textOf() helper treats a <textarea> as a raw-text element and
  // can leave tags in the string; imported content needs reliable plain text.
  function plainOfHtml(html) {
    if (!html) return '';
    try {
      var d = document.createElement('div');
      // textContent does not create a gap for <br>/block breaks, so add one
      // before flattening formatted HTML back to a one-line label/summary.
      d.innerHTML = String(html)
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/(?:p|div|li|tr|h[1-6])>/gi, ' ');
      return String(d.textContent || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
    } catch (e) {
      return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }
  function plainOf(v) {
    return plainOfHtml(htmlOf(v));
  }
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
    // A single "answer"/"type" cell can be ordinary data; require two such
    // markers when the first row has no recognizable question column.
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
    // Multi-answer formats (for example Square CSV) are reduced to the first
    // answer because the PDF answer key is a single-choice key.
    var first = s.split(/[,;|]/)[0].trim();
    var token = first.replace(/^[\(\[]\s*/, '').replace(/\s*[\)\]]$/, '').trim();
    token = token.replace(/^(?:correct\s+)?(?:option|opt|ans(?:wer)?)\s*[:\-]?\s*/i, '');
    var m = token.match(/^[\(\[]?\s*([0-9]+|[A-Ea-e]|[১-৫]|[কখগঘঙ])\s*[\)\]]?[\.:]?$/);
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

  // ---------------- build the rows the paper renderer understands ----------------
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
        'দ্রুত PDF-এর জন্য সেটিংসে “ব্যাখ্যার ছবি যুক্ত করুন” বন্ধ রাখুন।');
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

  // ---------------- modal state / rendering ----------------
  function resetImport() {
    readToken++;
    window.csvImportState = null;
    var result = $('csvImportResult');
    if (result) result.hidden = true;
    setText('csvImportFileName', 'কোনো ফাইল বাছা হয়নি');
    var drop = $('csvImportDrop');
    if (drop) drop.classList.remove('has-file', 'is-drag');
    var file = $('csvImportFile');
    if (file) file.value = '';
    var go = $('csvImportGo');
    if (go) go.disabled = true;
    var note = $('csvImportNote');
    if (note) {
      note.textContent = '';
      note.className = 'modal-sub csv-import-note';
    }
    clearNode($('csvImportStats'));
    clearNode($('csvImportPreview'));
    var warn = $('csvImportWarn');
    if (warn) { warn.hidden = true; clearNode(warn); }
    setText('csvImportSummary', '');
    $('csvImportModal') && $('csvImportModal').removeAttribute('data-busy');
  }

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

  // The testmoz image host can be slow when a paper has 100+ pictures. Warm
  // the browser cache while the user is still on the CSV/PDF settings screen,
  // so preview and PDF generation do not have to start every download.
  var prefetchToken = 0;
  function prefetchCsvImages(st) {
    var token = ++prefetchToken;
    var seen = {};
    Object.keys(st.dat || {}).forEach(function (key) {
      var full = st.dat[key] || {};
      var html = String(full.q || '') + String(full.e || '');
      (full.o || []).forEach(function (op) { html += String(op.h || ''); });
      var re = /<img\b[^>]*\bsrc=["']([^"']+)["']/gi;
      var m;
      while ((m = re.exec(html))) {
        var url = m[1];
        if (/^https?:\/\//i.test(url)) seen[url] = 1;
      }
    });
    var urls = Object.keys(seen);
    if (!urls.length) return;
    window.__csvImgPrefetch = window.__csvImgPrefetch || {};
    var cache = window.__csvImgPrefetch;
    var idx = 0;
    var active = 0;
    function next() {
      if (token !== prefetchToken) return;
      while (active < 4 && idx < urls.length) {
        var url = urls[idx++];
        if (cache[url]) continue;
        active++;
        (function (u) {
          var im = new Image();
          var done = false;
          var timer = setTimeout(function () { finish(false); }, 20000);
          function finish(ok) {
            if (done) return;
            done = true;
            clearTimeout(timer);
            active--;
            if (ok) cache[u] = im;
            next();
          }
          im.onload = function () { finish(true); };
          im.onerror = function () { finish(false); };
          im.src = u;
        })(url);
      }
    }
    next();
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
      var limit = Math.min(4, st.rows.length);
      for (var i = 0; i < limit; i++) {
        var rec = st.rows[i];
        var row = window.el('div', 'csv-prev-row');
        row.appendChild(window.el('span', 'csv-prev-n', bn(i + 1)));
        var txt = rec.t || '(শুধু ছবি)';
        if (txt.length > 90) txt = txt.slice(0, 89) + '…';
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
        var shown = Math.min(5, st.warnings.length);
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
    setNote('প্রস্তুত — PDF সেটিংসে গিয়ে হেডার, সেট ও ওয়াটারমার্ক ঠিক করুন।', false);
  }

  window.openCsvImport = function () {
    if (window.endPdfImport) window.endPdfImport();
    resetImport();
    var modal = $('csvImportModal');
    if (modal) modal.hidden = false;
    var drop = $('csvImportDrop');
    if (drop) { try { drop.focus(); } catch (e) {} }
  };
  window.closeCsvImport = function () {
    readToken++;
    var modal = $('csvImportModal');
    if (modal) modal.hidden = true;
  };

  window.csvImportRead = function (file) {
    if (!file) return;
    resetImport();
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
        window.csvImportState = st;
        renderState(st);
        // For a huge explanation-image set the PDF starts with those images
        // off, so do not spend bandwidth preloading all of them.
        if (st.eImages < 30) prefetchCsvImages(st);
      } catch (err) {
        window.csvImportState = null;
        var result = $('csvImportResult');
        if (result) result.hidden = true;
        var go = $('csvImportGo');
        if (go) go.disabled = true;
        setNote('CSV পড়া যায়নি — ' + (err && err.message ? err.message : String(err)), true);
      }
    };
    reader.onerror = function () {
      if (token !== readToken) return;
      setNote('ফাইলটি পড়া যায়নি — আবার চেষ্টা করুন।', true);
    };
    reader.readAsText(file, 'UTF-8');
  };

  window.csvImportStartPdf = function () {
    var st = window.csvImportState;
    if (!st || !st.rows.length) return;
    window.pdfImportRows = st.rows;
    window.pdfImportName = st.name || '';
    window.closeCsvImport();
    window.openPdfModal();
    // A filename is a better starting title than the generic fallback. Always
    // use this CSV's name — a previous imported/normal title must not linger.
    var title = $('pdfTitleIn');
    if (title) {
      var base = String(st.name || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      title.value = base || '';
    }
    // A 200-question CSV can carry 100+ explanation screenshots. Waiting for
    // all of them makes a PDF feel stuck, so start fast by default; the user
    // can switch images back on in the same settings screen.
    var imgToggle = $('pdfImages');
    var fastDefault = st.eImages >= 30;
    if (imgToggle) {
      imgToggle.checked = !fastDefault && window.loadPdfOpts().images !== false;
    }
    if (fastDefault) {
      var note = $('pdfNote');
      if (note) {
        note.textContent = 'অনেক ব্যাখ্যা-ছবি আছে — দ্রুত PDF-এর জন্য ছবি বন্ধ রাখা হয়েছে।';
        note.className = 'modal-note';
      }
    }
  };

  window.csvImportSample = function () {
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
      var ok = window.downloadCSV('\uFEFF' + lines.join('\r\n') + '\r\n', 'rayvila-sample.csv');
      if (ok === false) setNote('নমুনা CSV নামানো যায়নি — ব্রাউজারের ডাউনলোড অনুমতি দিন।', true);
      else setNote('নমুনা CSV নামানো হয়েছে — ফাইলটি খুলে ফরম্যাট দেখুন।', false);
    } catch (e) {
      setNote('নমুনা CSV তৈরি করা যায়নি।', true);
    }
  };

  window.bindCsvImportEvents = function () {
    var btn = $('csvImportBtn');
    if (btn) btn.addEventListener('click', window.openCsvImport);
    var close = $('csvImportClose');
    if (close) close.addEventListener('click', window.closeCsvImport);
    var cancel = $('csvImportCancel');
    if (cancel) cancel.addEventListener('click', window.closeCsvImport);
    var modal = $('csvImportModal');
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) window.closeCsvImport();
      });
      // dropping a file outside the drop zone must not navigate away from the app
      modal.addEventListener('dragover', function (e) {
        if (e.dataTransfer) e.preventDefault();
      });
      modal.addEventListener('drop', function (e) {
        if (e.dataTransfer) e.preventDefault();
      });
    }
    var input = $('csvImportFile');
    var drop = $('csvImportDrop');
    if (input) {
      input.addEventListener('change', function () {
        var f = input.files && input.files[0];
        if (f) window.csvImportRead(f);
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
        if (f) window.csvImportRead(f);
      });
    }
    var sample = $('csvImportSample');
    if (sample) sample.addEventListener('click', window.csvImportSample);
    var go = $('csvImportGo');
    if (go) go.addEventListener('click', window.csvImportStartPdf);
    var imgToggle = $('pdfImages');
    if (imgToggle) {
      imgToggle.addEventListener('change', function () {
        var note = $('pdfNote');
        if (imgToggle.checked) {
          if (note && /অনেক ব্যাখ্যা-ছবি/.test(note.textContent)) {
            note.textContent = '';
            note.className = 'modal-note';
          }
          if (window.csvImportState) prefetchCsvImages(window.csvImportState);
        }
      });
    }
  };
})();
