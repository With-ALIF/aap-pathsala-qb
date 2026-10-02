/* Sharded viewer for the full question bank (~210k questions).
   manifest.js  - facet values + counts, shard count
   idx/idx-NN.js - plain-text records, used for filtering/search (loaded in background)
   dat/dat-NN.js - sanitised HTML, fetched only for shards actually being viewed */
(function () {
  'use strict';

  var M = window.QB_MANIFEST;
  if (!M) { document.getElementById('list').innerHTML = '<div class="empty"><h2>সূচি লোড হয়নি</h2></div>'; return; }

  var NSHARD = M.shards, PAGE = 40;
  var IDX = window.QB_IDX, DAT = window.QB_DAT, LOADED = window.QB_LOADED;
  var FACETS = ['db', 'un', 'y', 's', 'c', 'k', 'ty'];
  var FACET_ID = { db: 'fDb', un: 'fUn', y: 'fY', c: 'fC', k: 'fK', ty: 'fTy' };   // s has its own multi-select widget
  var CTRL_ID = { n: 'fN' };         // non-facet controls that can also be cleared from a chip
  var NONE = '__none__';             // select value that means "field has no value"
  var TYPE_LABEL = { mcq: 'MCQ (নির্বাচনী)', written: 'Written (লিখিত)' };
  // facets whose values are derived at load time instead of shipped in manifest.js
  var STATIC_LIST = { ty: [{ value: 'mcq' }, { value: 'written' }] };
  var FLAT = [];                     // all index records, flattened across shards
  var DATMAP = {};                   // shard -> { pk: contentRecord }
  var pendIdx = {}, pendDat = {};    // in-flight shard loads (avoids duplicate <script> tags)

  var state = { q: '', db: '', un: '', y: '', s: [], c: '', k: '', ty: '', n: '', p: '', sort: 'default', e: false, img: false, answers: true };
  var results = [];                  // idx records matching the current filter
  var shown = 0;                     // how many results are rendered
  var indexReady = false;
  var loading = false;               // a content shard is being fetched for the visible page
  var noteOverride = null;           // transient status text (e.g. "shuffled")
  var lastSyncedHash = null;         // last hash this script wrote (ignores our own hashchange)

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; }
  var NF = new Intl.NumberFormat('en-US');
  var COLL = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  var COLL_CMP = COLL.compare;
  function num(n) { return NF.format(n); }
  function shardName(i) { return String(i).padStart(3, '0'); }
  function isBlank(v) { return v === null || v === undefined; }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = function () { s.remove(); rej(new Error('failed to load ' + src)); };
      document.head.appendChild(s);
    });
  }
  function loadIdx(i) {
    if (LOADED.idx[i]) return Promise.resolve();
    if (pendIdx[i]) return pendIdx[i];
    pendIdx[i] = loadScript('idx/idx-' + shardName(i) + '.js').then(function () {
      LOADED.idx[i] = 1;
      delete pendIdx[i];
      // QB_IDX is an array of shard-arrays; flatten into one list and stamp
      // each record with its shard so rendering can find its content shard.
      var chunk = IDX[i] || [];
      for (var j = 0; j < chunk.length; j++) {
        if (chunk[j]._sh === undefined) {
          chunk[j]._sh = i;
          chunk[j].ty = isWrittenRec(chunk[j]) ? 'written' : 'mcq';
          haystack(chunk[j]);
          FLAT.push(chunk[j]);
        }
      }
    }, function (e) { delete pendIdx[i]; throw e; });
    return pendIdx[i];
  }
  function loadDat(i) {
    if (LOADED.dat[i]) return Promise.resolve();
    if (pendDat[i]) return pendDat[i];
    pendDat[i] = loadScript('dat/dat-' + shardName(i) + '.js').then(function () {
      LOADED.dat[i] = 1;
      delete pendDat[i];
      var m = {};
      (DAT[i] || []).forEach(function (d) { m[d.p] = d; });
      DATMAP[i] = m;
    }, function (e) { delete pendDat[i]; throw e; });
    return pendDat[i];
  }

  function plain(v) {
    if (isBlank(v)) return '';
    if (Array.isArray(v)) return v.join(' ');
    return String(v);
  }
  function haystack(r) {
    if (r._h) return r._h;
    // normalise to NFC: ~1/3 of the source texts are stored in decomposed
    // form, so an un-normalised index silently misses composed queries.
    return (r._h = (plain(r.t) + ' ' + plain(r.ot) + ' ' + [r.db, r.un, r.y, r.s, r.c, r.k].filter(function (v) { return !isBlank(v); }).map(String).join(' ')).toLowerCase().normalize('NFC'));
  }

  // ---------- question type (MCQ vs Written) ----------
  function normOpts(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  // A "written" question carries no real choices: either the source row has no
  // options at all, or its only options are the Done/Skip placeholders that the
  // data-entry system attached to descriptive questions.
  function isWrittenRec(r) {
    if (isBlank(r.n) || r.n === 0) return true;
    var t = normOpts(r.ot);
    return t === 'done skip' || t === 'skip done' || t === 'done';
  }
  // true when at least one option is a real answer choice (not Done/Skip/empty)
  function optsReal(opts) {
    for (var i = 0; i < opts.length; i++) {
      var t = normOpts(opts[i] && opts[i].t);
      if (t && t !== 'done' && t !== 'skip') return true;
    }
    return false;
  }
  function labelFor(facet, key) {
    if (facet === 'ty') return TYPE_LABEL[key] || key;
    if (key === NONE) return '(নির্দিষ্ট নয়)';
    return key;
  }

  // ---------- index loading ----------
  function buildIndex() {
    var box = $('indexing');
    box.hidden = false;
    var i = 0, attempt = 0;
    (function step() {
      if (i >= NSHARD) {
        box.hidden = true;
        indexReady = true;
        recompute();
        scrollToQuestion();
        return;
      }
      var pct = Math.round((i / NSHARD) * 100);
      $('indexFill').style.width = pct + '%';
      $('indexText').textContent = 'সূচি তৈরি হচ্ছে… ' + pct + '% (' + (i + 1) + '/' + NSHARD + ')';
      loadIdx(i).then(function () {
        attempt = 0; i++; step();
      }, function (e) {
        if (attempt++ < 1) { $('indexText').textContent = 'আবার চেষ্টা করা হচ্ছে… (' + e.message + ')'; step(); return; }
        attempt = 0; i++;
        $('indexText').textContent = 'সূচি তৈরি চলছে — কিছু শার্ড লোড হয়নি (' + e.message + ')';
        step();
      });
    })();
  }

  // ---------- filtering ----------
  function facetMatch(recVal, sel) {
    if (sel === NONE) return isBlank(recVal);
    if (isBlank(recVal)) return false;
    return String(recVal) === sel;
  }

  function baseMatch(r) {
    var s = state;
    if (s.p && String(r.p) !== s.p) return false;
    if (s.n && String(r.n) !== s.n) return false;
    if (s.e && !r.e) return false;
    if (s.img && !r.hi) return false;
    if (s._terms) {
      var h = haystack(r);
      for (var i = 0; i < s._terms.length; i++) if (h.indexOf(s._terms[i]) === -1) return false;
    }
    return true;
  }

  // s (subject) is multi-select: an array of keys matched as a union (OR);
  // every other facet keeps its single-value behaviour.
  function facetPass(recVal, f) {
    var sel = state[f];
    if (f === 's') {
      if (!sel.length) return true;
      var key = isBlank(recVal) ? NONE : String(recVal);
      return sel.indexOf(key) !== -1;
    }
    if (!sel) return true;
    return facetMatch(recVal, sel);
  }

  function match(r) {
    if (!baseMatch(r)) return false;
    for (var i = 0; i < FACETS.length; i++) if (!facetPass(r[FACETS[i]], FACETS[i])) return false;
    return true;
  }

  function sortKey(r, f) {
    var m = r['_sk_' + f];
    if (m === undefined) m = r['_sk_' + f] = isBlank(r[f]) ? '' : String(r[f]);
    return m;
  }

  function sortResults() {
    var cmp = {
      'y-desc': function (a, b) { return (parseFloat(b.y) || 0) - (parseFloat(a.y) || 0); },
      'y-asc': function (a, b) { return (parseFloat(a.y) || 0) - (parseFloat(b.y) || 0); },
      'db': function (a, b) { return COLL_CMP(sortKey(a, 'db'), sortKey(b, 'db')); },
      's': function (a, b) { return COLL_CMP(sortKey(a, 's'), sortKey(b, 's')); },
      'k': function (a, b) { return COLL_CMP(sortKey(a, 'k'), sortKey(b, 'k')); }
    }[state.sort];
    if (cmp) results.sort(cmp);
  }

  // Live per-facet counts: a record is counted for facet F when it satisfies
  // every *other* filter (the facet's own filter is ignored, so a selected
  // value does not zero out its own dropdown).
  function computeFacetCounts() {
    var maps = {};
    FACETS.forEach(function (f) { maps[f] = new Map(); });
    for (var i = 0; i < FLAT.length; i++) {
      var r = FLAT[i];
      if (!baseMatch(r)) continue;
      var fails = 0, failed = null;
      for (var j = 0; j < FACETS.length; j++) {
        var f = FACETS[j];
        if (!facetPass(r[f], f)) { fails++; failed = f; }
      }
      if (fails === 0) {
        for (var k = 0; k < FACETS.length; k++) inc(maps[FACETS[k]], r[FACETS[k]]);
      } else if (fails === 1) {
        inc(maps[failed], r[failed]);
      }
    }
    return maps;
  }
  function inc(map, v) {
    var key = isBlank(v) ? NONE : String(v);
    map.set(key, (map.get(key) || 0) + 1);
  }

  function recompute() {
    if (!indexReady) return;
    var terms = state.q.normalize('NFC').trim().toLowerCase().split(/\s+/).filter(Boolean);
    state._terms = terms.length ? terms : null;
    results = FLAT.filter(match);
    sortResults();
    refreshSelects(computeFacetCounts());
    shown = 0;
    noteOverride = null;
    $('list').innerHTML = '';
    renderPage(true);
    updateStatus();
    syncURL();
  }

  // ---------- rendering ----------
  function pendingFor(recs) {
    var need = {}, out = [];
    for (var i = 0; i < recs.length; i++) {
      var sh = recs[i]._sh;
      if (!LOADED.dat[sh]) { if (!need[sh]) { need[sh] = 1; out.push(sh); } }
    }
    return out;
  }

  function noteText() {
    if (noteOverride) return noteOverride;
    if (loading) return 'প্রশ্ন লোড হচ্ছে…';
    if (!indexReady || !results.length) return '';
    if (shown >= results.length) return 'সব ' + num(results.length) + 'টি দেখানো হয়েছে';
    return 'দেখানো হয়েছে ' + num(shown) + ' / ' + num(results.length);
  }

  var renderToken = 0;
  function renderPage(reset) {
    if (!indexReady) return;
    if (reset) shown = 0;
    if (shown >= results.length) {
      loading = false;
      $('moreBtn').hidden = true;
      if (!results.length) { $('list').innerHTML = ''; $('list').appendChild(emptyBlock()); }
      $('shownNote').textContent = noteText();
      return;
    }
    var slice = results.slice(shown, shown + PAGE);
    var shards = pendingFor(slice);
    var my = ++renderToken;
    var from = shown;
    loading = shards.length > 0;
    if (loading) $('shownNote').textContent = noteText();
    Promise.all(shards.map(loadDat)).then(function () {
      if (my !== renderToken) return;               // a newer render superseded us
      loading = false;
      var frag = document.createDocumentFragment();
      slice.forEach(function (r, k) {
        var full = (DATMAP[r._sh] || {})[r.p];
        frag.appendChild(card(r, full, from + k + 1));
      });
      $('list').appendChild(frag);
      shown = from + slice.length;
      $('moreBtn').hidden = shown >= results.length;
      $('shownNote').textContent = noteText();
    }, function (e) {
      if (my !== renderToken) return;
      loading = false;
      // keep "আরও দেখান" available so the user can retry the failed shard
      $('moreBtn').hidden = false;
      $('shownNote').textContent = 'লোড ব্যর্থ: ' + e.message + ' — আবার চেষ্টা করুন';
    });
  }

  function emptyBlock() {
    var d = el('div', 'empty');
    d.appendChild(el('h2', null, 'কোনো প্রশ্ন মেলেনি'));
    d.appendChild(el('p', null, 'ফিল্টার বা সার্চ কিছু বদলে দেখুন।'));
    var b = el('button', 'icon-btn', 'সব ফিল্টার মুছুন');
    b.addEventListener('click', reset);
    d.appendChild(b);
    return d;
  }

  function card(idx, full, n) {
    var c = el('article', 'qcard');
    c.id = 'q-' + idx.p;
    var head = el('div', 'qhead');
    head.appendChild(el('span', 'qnum', n));
    var meta = el('div', 'qmeta');
    if (idx.ty === 'written') meta.appendChild(el('span', 'tag tag-w', 'Written'));
    [idx.y && ('সাল ' + idx.y), idx.db, idx.un, idx.s, idx.c, idx.k].forEach(function (t) { if (t) meta.appendChild(el('span', 'tag', t)); });
    var link = el('button', 'tag pk', '#' + idx.p);
    link.type = 'button';
    link.title = 'এই প্রশ্নের লিংক কপি করুন';
    link.addEventListener('click', function () { copyLink(idx.p); });
    meta.appendChild(link);
    head.appendChild(meta);
    c.appendChild(head);

    var body = el('div', 'qtext');
    if (full && full.q) { body.innerHTML = full.q; lazyImgs(body); } else body.textContent = plain(idx.t);
    c.appendChild(body);

    var ul = el('ul', 'opts');
    var opts = (full && full.o) || [];
    if (!opts.length && idx.n) {
      for (var i = 0; i < idx.n; i++) { opts.push({ n: i + 1, t: '', c: i + 1 === idx.a ? 1 : 0 }); }
    }
    // written questions: Done/Skip are data-entry placeholders, not choices —
    // show a "write your own answer" note instead of fake options/answer.
    if (idx.ty === 'written' && !optsReal(opts)) {
      c.appendChild(el('div', 'wnote', '✍ লিখিত উত্তর — নিজে উত্তর লিখুন'));
    } else {
      opts.forEach(function (o, oi) {
        var li = el('li', 'opt' + (o.c ? ' correct' : ''));
        li.appendChild(el('span', 'key', String.fromCharCode(64 + (o.n || oi + 1))));
        var val = el('span', 'val');
        if (o.h) { val.innerHTML = o.h; lazyImgs(val); } else val.textContent = o.t || '';
        li.appendChild(val);
        ul.appendChild(li);
      });
      c.appendChild(ul);

      var ans = el('div', 'answer-note');
      ans.appendChild(el('span', null, 'উত্তর:'));
      ans.appendChild(el('span', 'badge', idx.a ? String.fromCharCode(64 + idx.a) : '—'));
      c.appendChild(ans);
    }

    if (idx.e && full && (full.e || full.et)) {
      var ex = el('div', 'explain');
      ex.appendChild(el('h4', null, 'ব্যাখ্যা'));
      var eb = el('div');
      if (full.e) { eb.innerHTML = full.e; lazyImgs(eb); } else eb.textContent = full.et;
      ex.appendChild(eb);
      c.appendChild(ex);
    }
    return c;
  }

  // images inside question/option/explanation HTML load only when scrolled to
  function lazyImgs(node) {
    var imgs = node.getElementsByTagName('img');
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].setAttribute('loading', 'lazy');
      imgs[i].setAttribute('decoding', 'async');
    }
  }

  function copyLink(pk) {
    var url = location.href.split('#')[0] + '#p=' + encodeURIComponent(pk);
    var fallback = function () { location.hash = 'p=' + encodeURIComponent(pk); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { flashNote('লিংক কপি হয়েছে: ' + url); }, fallback);
    } else fallback();
  }
  function flashNote(msg) {
    $('shownNote').textContent = msg;
    clearTimeout(flashNote.t);
    flashNote.t = setTimeout(function () { updateStatus(); }, 3000);
  }

  // ---------- CSV export ----------
  var CSV_HEADER = 'questions,option1,option2,option3,option4,option5,answer,explanation,type,section';

  function csvCell(v) {
    var s = v == null ? '' : String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function optionCell(o) { return (o && (o.t || o.h)) || ''; }

  function csvRow(rec) {
    var full = (DATMAP[rec._sh] || {})[rec.p] || {};
    var q = plain(rec.t);
    if (!q && full.q) q = String(full.q).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    var opts = full.o || [];
    var cells = [csvCell(q)];
    for (var i = 0; i < 5; i++) cells.push(csvCell(optionCell(opts[i])));
    var ans = rec.a;
    if (ans == null) {
      for (var j = 0; j < opts.length; j++) if (opts[j] && opts[j].c) { ans = opts[j].n || j + 1; break; }
    }
    cells.push(csvCell(ans == null ? '' : ans));
    cells.push(csvCell(full.e || full.et || ''));
    cells.push('1', '1');                 // type, section (fixed, per import format)
    return cells.join(',');
  }

  function buildCSV(rows) {
    var out = [CSV_HEADER];
    for (var i = 0; i < rows.length; i++) out.push(csvRow(rows[i]));
    return '\uFEFF' + out.join('\r\n') + '\r\n';
  }

  // ---------- MNR export (prompt rules 1-17) ----------
  var MNR_HEADER = 'question,question_image,option_1,option_1_image,option_2,option_2_image,option_3,option_3_image,option_4,option_4_image,option_5,option_5_image,correct_options,explanation,explanation_image,type_id,paper_id,chapter_id,topic_id';

  var _ent = null;                    // reusable textarea for entity decoding
  function stripHTML(s) {
    if (s == null) return '';
    var t = String(s)
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>/gi, ' ')
      .replace(/<[^>]+>/g, ' ');
    if (!_ent) _ent = document.createElement('textarea');
    _ent.innerHTML = t;
    return _ent.value.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function imgURLs(html) {
    var out = [], re = /<img[^>]*\ssrc\s*=\s*["']([^"']+)["'][^>]*>/gi, m;
    while ((m = re.exec(String(html || '')))) if (m[1]) out.push(m[1]);
    return out;
  }
  // একটি ছবি -> সরাসরি URL, একাধিক -> JSON array (reference logic)
  function imgCell(html) {
    var u = imgURLs(html);
    return !u.length ? '' : (u.length === 1 ? u[0] : JSON.stringify(u));
  }

  // ক = 1, খ = 2 … position ধরে; একাধিক সঠিক হলে কমা (rule 3)
  function correctList(full, rec) {
    var out = [];
    (full.o || []).forEach(function (o, i) { if (o && o.c) out.push(i + 1); });
    if (!out.length && rec.a != null) out.push(rec.a);
    return out.join(',');
  }

  // rule 15: সব ফিল্ড ডাবল কোটেশনে, শুধু correct_options ছাড়া;
  // কিন্তু কমা থাকলে ("1,3") কোট করা না হলে CSV ভাঙবে (rule 16)
  function csvQ(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }
  function csvCorrect(v) {
    if (v === '') return '';
    return v.indexOf(',') < 0 ? v : '"' + v.replace(/"/g, '""') + '"';
  }

  // rule 7: প্রথম ট্যাগ -> ছোট হাতে, হাইফেন ছাড়া (B-1 -> b1, P-1 -> p1)
  function paperIdOf(s) {
    if (isBlank(s)) return '';
    var t = String(s).toLowerCase().replace(/-/g, '');
    return t.replace(/^(bangla|ban|ba|bn)(\d*)$/, function (m, p, d) { return 'bn' + d; });
  }

  // rule 8: দ্বিতীয় ট্যাগ -> দশমিকের পরের সংখ্যা (P-1.4 -> 4);
  // দশমিক না থাকলে ট্যাগটাই যেভাবে আছে (reference extractChapterId)
  function chapterIdOf(c, paperId) {
    if (isBlank(c)) return '';
    var tag = String(c).trim(), dot = tag.indexOf('.');
    if (dot !== -1) return tag.substring(dot + 1).trim();
    var hy = tag.indexOf('-');
    if (hy !== -1) {
      var after = tag.substring(hy + 1).trim();
      if (/^\d+$/.test(after)) {
        var flat = tag.toLowerCase().replace(/-/g, '');
        var cleaned = flat.replace(/^(bangla|ban|ba|bn)(\d*)$/, function (m, p, d) { return 'bn' + d; });
        if (paperId === flat || paperId === cleaned) return '';
        return after;
      }
      return tag;
    }
    return tag;
  }

  function mnrRow(rec) {
    var full = (DATMAP[rec._sh] || {})[rec.p] || {};
    var q = plain(rec.t) || stripHTML(full.q);          // rule 1 + rule 5
    var opts = full.o || [];
    var cells = [csvQ(q), csvQ(imgCell(full.q))];
    for (var i = 0; i < 5; i++) {                       // rules 2, 6, 12
      var o = opts[i];
      cells.push(csvQ(o ? (plain(o.t) || stripHTML(o.h)) : ''));
      cells.push(csvQ(o ? imgCell(o.h) : ''));
    }
    var paper = paperIdOf(rec.s);
    cells.push(csvCorrect(correctList(full, rec)));
    cells.push(csvQ(plain(full.et) || stripHTML(full.e)));   // rule 4: লেখা
    cells.push(csvQ(imgCell(full.e)));                       // rule 4: ছবির URL
    cells.push(csvQ(''));                                    // rule 10: type_id সবসময় খালি
    cells.push(csvQ(paper));                                 // rule 7
    cells.push(csvQ(chapterIdOf(rec.c, paper)));             // rule 8
    cells.push(csvQ(rec.k == null ? '' : String(rec.k)));    // rule 9: বাংলা টপিক হুবহু
    return cells.join(',');
  }

  function buildMNR(rows) {
    var out = [MNR_HEADER];
    for (var i = 0; i < rows.length; i++) out.push(mnrRow(rows[i]));
    return '\uFEFF' + out.join('\n');
  }

  // বাংলা সংখ্যাও চলে (১০ → 10)
  function toNums(str) {
    var s = String(str || '').replace(/[০-৯]/g, function (d) { return String(d.charCodeAt(0) - 0x09E6); });
    return (s.match(/\d+/g) || []).map(Number);
  }
  // "1 to 10", "5-50", "৬ থেকে ৩৪" — যেকোনো দুটি সংখ্যা নেওয়া হয়
  function parseRange(str) {
    var n = toNums(str);
    if (n.length < 2) return null;
    return { from: Math.min(n[0], n[1]), to: Math.max(n[0], n[1]) };
  }
  // শুরু / শেষ — দুটি আলাদা বক্স; এক বক্সে "1 to 10" লেখা থাকলেও চলবে
  function readRange() {
    var a = toNums($('csvFrom').value)[0];
    var b = toNums($('csvTo').value)[0];
    if (a != null && b != null) return { from: Math.min(a, b), to: Math.max(a, b) };
    return parseRange($('csvFrom').value + ' ' + $('csvTo').value);
  }

  function downloadCSV(csv, name) {
    // no Blob URLs (jsdom / very old engines): skip the anchor click entirely
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return false;
    try {
      var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      var a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 30000);
      return true;
    } catch (e) { return false; }
  }

  function csvExportRange(from, to, fmt) {
    var rows = results.slice(from - 1, to);
    var need = pendingFor(rows);
    if (!need.length) return Promise.resolve(fmt === 'mnr' ? buildMNR(rows) : buildCSV(rows));
    var done = 0;
    $('csvNote').textContent = 'কনটেন্ট লোড হচ্ছে 0/' + need.length + ' শার্ড…';
    return Promise.all(need.map(function (sh) {
      return loadDat(sh).then(function () {
        $('csvNote').textContent = 'কনটেন্ট লোড হচ্ছে ' + (++done) + '/' + need.length + ' শার্ড…';
      });
    })).then(function () { return fmt === 'mnr' ? buildMNR(rows) : buildCSV(rows); });
  }

  function csvErr(msg) { var e = $('csvErr'); e.textContent = msg; e.hidden = false; }

  // ---------- file name chosen by the user ----------
  var fmtIntent = readFmt();       // format Enter runs — remembered across sessions
  var lastNameTyped = '';          // fallback when localStorage is unavailable (file:// etc.)
  var exporting = false;           // one download at a time (Enter can't double-fire)

  function readFmt() {
    var v = '';
    try { v = localStorage.getItem('lastExportFmt') || ''; } catch (e) {}
    return v === 'mnr' ? 'mnr' : 'csv';
  }
  function setFmt(fmt) {
    fmtIntent = fmt === 'mnr' ? 'mnr' : 'csv';
    try { localStorage.setItem('lastExportFmt', fmtIntent); } catch (e) {}
    updateFmtHint();
    csvNamePlaceholder();
  }
  function updateFmtHint() {
    var hint = $('csvFmtHint');
    if (!hint) return;
    hint.textContent = '';
    hint.appendChild(document.createTextNode('Enter = '));
    hint.appendChild(el('b', null, fmtIntent === 'mnr' ? 'MNR Export' : 'CSV Export'));
    hint.appendChild(document.createTextNode(' — বদলাতে বোতামে ক্লিক করুন'));
    $('csvGo').classList.toggle('on', fmtIntent === 'csv');
    $('csvMnr').classList.toggle('on', fmtIntent === 'mnr');
  }

  function autoName(fmt, from, to) {
    return (fmt === 'mnr' ? 'mnr-' : 'questions-') + from + '-' + to + '.csv';
  }
  function sanitizeName(s) {
    return String(s || '').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/[\s.]+$/, '');
  }
  function nameFor(fmt, from, to) {
    var n = sanitizeName($('csvName').value);
    if (!n) return autoName(fmt, from, to);
    return /\.csv$/i.test(n) ? n : n + '.csv';
  }
  function loadLastName() {
    try { return localStorage.getItem('lastExportName') || lastNameTyped; } catch (e) { return lastNameTyped; }
  }
  function saveLastName(v) {
    lastNameTyped = v;
    try { localStorage.setItem('lastExportName', v); } catch (e) {}
  }

  function openCSV() {
    if (!indexReady) { flashNote('আগে সূচি তৈরি হতে দিন'); return; }
    $('csvErr').hidden = true;
    $('csvNote').textContent = '';
    $('csvAvail').textContent = ' এখন মোট ' + num(results.length) + 'টি ফলাফল আছে।';
    $('csvFrom').value = '';
    $('csvTo').value = '';
    $('csvName').value = loadLastName();
    $('csvName').placeholder = autoName(fmtIntent, 1, Math.max(1, Math.min(10, results.length)));
    updateFmtHint();
    $('csvModal').hidden = false;
    $('csvFrom').focus();
    $('csvFrom').select();
  }
  function closeCSV() { $('csvModal').hidden = true; }

  function runCSV(fmt) {
    fmt = fmt || 'csv';
    if (exporting) return;                    // a download is already on its way
    var total = results.length;
    if (!total) { csvErr('কোনো ফলাফল নেই — আগে ফিল্টার বদলান।'); return; }
    var r = readRange();
    if (!r) { csvErr('শুরু ও শেষ — দুটি সংখ্যা লিখুন (যেমন 1 থেকে 10)'); return; }
    if (r.from > total) { csvErr('রেঞ্জটি ফলাফলের বাইরে — সর্বোচ্চ ' + num(total) + 'টি আছে।'); return; }
    var from = Math.max(1, r.from), to = Math.min(total, r.to);
    var nm = nameFor(fmt, from, to);
    var typed = String($('csvName').value || '').trim();
    if (typed) saveLastName(typed);
    exporting = true;
    $('csvGo').disabled = true;
    $('csvMnr').disabled = true;
    csvExportRange(from, to, fmt).then(function (csv) {
      window.__lastCSV = csv;             // last generated file (also handy for debugging)
      window.__lastFmt = fmt;
      window.__lastName = nm;             // file name the download used
      var ok = downloadCSV(csv, nm);
      exporting = false;
      $('csvGo').disabled = false;
      $('csvMnr').disabled = false;
      closeCSV();
      flashNote(num(to - from + 1) + 'টি প্রশ্ন ' + (fmt === 'mnr' ? 'MNR-এ' : 'CSV-তে') + ' নেওয়া হয়েছে' + (ok ? '' : ' — ডাউনলোড ব্যর্থ'));
    }, function (e) {
      exporting = false;
      $('csvGo').disabled = false;
      $('csvMnr').disabled = false;
      csvErr('লোড ব্যর্থ: ' + e.message);
    });
  }

  // ---------- status ----------
  function updateStatus() {
    $('count').textContent = results.length === M.total
      ? num(M.total) + 'টি প্রশ্ন'
      : num(results.length) + ' / ' + num(M.total) + 'টি প্রশ্ন';

    var chips = $('chips');
    chips.innerHTML = '';
    var labels = { q: 'খুঁজুন', ty: 'ধরন', db: 'ডেটাবেস', un: 'বিশ্ববিদ্যালয়', y: 'সাল', s: 'বিষয়', c: 'অধ্যায়', k: 'টপিক', n: 'অপশন', p: 'প্রশ্ন', e: 'ব্যাখ্যা', img: 'ছবি' };
    function addChip(key, val, shown_v, clearVal) {
      var chip = el('span', 'chip');
      chip.appendChild(document.createTextNode(labels[key] + ': ' + shown_v));
      var x = el('button', null, '×');
      x.type = 'button';
      x.setAttribute('aria-label', 'ফিল্টার সরান');
      x.addEventListener('click', function () { setFilter(key, clearVal); });
      chip.appendChild(x);
      chips.appendChild(chip);
    }
    Object.keys(labels).forEach(function (key) {
      if (key === 's') {                       // one chip per selected subject
        state.s.forEach(function (v) {
          addChip('s', v, v === NONE ? '(নির্দিষ্ট নয়)' : v, v);
        });
        return;
      }
      var v = state[key];
      if (!v) return;
      var shown_v = v === true ? 'হ্যাঁ'
        : (v === NONE ? '(নির্দিষ্ট নয়)'
          : (key === 'p' ? '#' + v
            : (key === 'ty' ? (TYPE_LABEL[v] || v) : v)));
      addChip(key, v, shown_v, '');
    });
    $('shownNote').textContent = noteText();
  }

  function setFilter(key, val) {
    if (key === 'e' || key === 'img') { state[key] = val === '' ? false : true; $(key === 'e' ? 'fE' : 'fImg').checked = state[key]; }
    else if (key === 'q') { state.q = ''; $('q').value = ''; }
    else if (key === 'p') { state.p = ''; }
    else if (key === 's') {                    // clear one subject (chip ×) or all
      state.s = val === '' ? [] : state.s.filter(function (x) { return x !== val; });
      state.c = state.k = '';
    }
    else {
      state[key] = val;
      var id = FACET_ID[key] || CTRL_ID[key];
      if (id) $(id).value = val;
    }
    recompute();
  }

  // ---------- facet selects (live counts, manifest order) ----------
  function mkOpt(v, label) { var o = document.createElement('option'); o.value = v; o.textContent = label; return o; }

  function fillSelect(sel, facet, current, counts) {
    var list = (M.facets && M.facets[facet]) || STATIC_LIST[facet] || [];
    var map = counts ? counts[facet] : null;
    var frag = document.createDocumentFragment();
    frag.appendChild(mkOpt('', 'সব'));
    var seen = Object.create(null);
    list.forEach(function (f) {
      var key = f.value === null ? NONE : String(f.value);
      seen[key] = 1;
      var c = map ? (map.get(key) || 0) : f.count;
      if (map && !c && current !== key) return;      // value impossible under current filters
      frag.appendChild(mkOpt(key, labelFor(facet, key) + (c === undefined ? '' : '  (' + num(c) + ')')));
    });
    if (map) map.forEach(function (c, key) {
      if (seen[key] || (!c && current !== key)) return;
      frag.appendChild(mkOpt(key, labelFor(facet, key) + '  (' + num(c) + ')'));
    });
    sel.innerHTML = '';
    sel.appendChild(frag);
    sel.value = current || '';
    if (current && sel.value !== current) { sel.appendChild(mkOpt(current, labelFor(facet, current) + '  (0)')); sel.value = current; }
  }

  function refreshSelects(counts) {
    fillSelect($('fDb'), 'db', state.db, counts);
    fillSelect($('fUn'), 'un', state.un, counts);
    fillSelect($('fY'), 'y', state.y, counts);
    fillSubjectList(counts);
    fillSelect($('fC'), 'c', state.c, counts);
    fillSelect($('fK'), 'k', state.k, counts);
    fillSelect($('fTy'), 'ty', state.ty, counts);
  }
  function buildSelects() { refreshSelects(null); }

  // ---------- subject multi-select widget ----------
  function fillSubjectList(counts) {
    var list = (M.facets && M.facets.s) || [];
    var map = counts ? counts.s : null;
    var box = $('fSList');
    var scroll = box.scrollTop;
    var picked = state.s;
    var seen = Object.create(null);
    var frag = document.createDocumentFragment();
    function item(key, c) {
      var lab = el('label', 'ms-item');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = key;
      cb.checked = picked.indexOf(key) !== -1;
      cb.addEventListener('change', function () { toggleSubject(key, cb.checked); });
      lab.appendChild(cb);
      lab.appendChild(el('span', 'ms-txt', labelFor('s', key) + (c === undefined ? '' : '  (' + num(c) + ')')));
      frag.appendChild(lab);
    }
    list.forEach(function (f) {
      var key = f.value === null ? NONE : String(f.value);
      seen[key] = 1;
      var c = map ? (map.get(key) || 0) : f.count;
      if (map && !c && picked.indexOf(key) === -1) return;   // impossible under current filters
      item(key, c);
    });
    if (map) map.forEach(function (c, key) {
      if (seen[key] || (!c && picked.indexOf(key) === -1)) return;
      item(key, c);
    });
    box.innerHTML = '';
    box.appendChild(frag);
    box.scrollTop = scroll;

    var n = picked.length;
    $('fSBtn').textContent = n === 0 ? 'সব'
      : (n === 1 ? labelFor('s', picked[0]) : num(n) + ' টি বিষয়');
    $('fSBtn').classList.toggle('on', n > 0);
    $('fSCount').textContent = n ? num(n) + ' নির্বাচিত' : '';
  }

  function toggleSubject(key, on) {
    var i = state.s.indexOf(key);
    if (on && i === -1) state.s.push(key);
    if (!on && i !== -1) state.s.splice(i, 1);
    state.c = state.k = '';                    // chapters/topics belong to a subject
    recompute();
  }

  // ---------- URL ----------
  function syncURL() {
    var p = new URLSearchParams();
    Object.keys(state).forEach(function (k) {
      if (k === 'answers' || k[0] === '_') return;
      if (k === 's') { if (state.s.length) p.set('s', state.s.join(',')); return; }
      if (state[k] === '' || state[k] === false || state[k] === 'default') return;
      p.set(k, state[k] === true ? '1' : state[k]);
    });
    var qs = p.toString();
    if ((location.hash.replace(/^#/, '')) === qs) { lastSyncedHash = qs; return; }
    lastSyncedHash = qs;
    try {
      history.replaceState(null, '', location.pathname + location.search + (qs ? '#' + qs : ''));
    } catch (err) {
      // file:// documents can reject replaceState — fall back to the fragment
      try { if (qs) location.hash = qs; else if (location.hash) location.hash = ''; } catch (err2) {}
    }
  }
  function readURL() {
    var h = location.hash.replace(/^#/, '');
    var p = new URLSearchParams(h);
    ['q', 'db', 'un', 'y', 'c', 'k', 'ty', 'n', 'p', 'sort'].forEach(function (k) {
      state[k] = p.has(k) ? p.get(k) : (k === 'sort' ? 'default' : '');
    });
    // s= holds one or more subjects, comma separated (older #s=one still works)
    state.s = (p.get('s') || '').split(',').filter(function (v, i, a) { return v && a.indexOf(v) === i; });
    state.e = p.get('e') === '1';
    state.img = p.get('img') === '1';
  }
  function writeControls() {
    $('q').value = state.q; $('fN').value = state.n; $('fSort').value = state.sort;
    $('fE').checked = state.e; $('fImg').checked = state.img;
  }

  function reset() {
    Object.keys(state).forEach(function (k) {
      if (k === 'answers' || k[0] === '_') return;
      state[k] = (k === 'e' || k === 'img') ? false : (k === 'sort' ? 'default' : (k === 's' ? [] : ''));
    });
    writeControls(); recompute();
  }

  // ---------- wiring ----------
  function debounce(fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; }

  function applyAnswers() {
    document.body.dataset.answers = state.answers ? 'on' : 'off';
    $('answersBtn').setAttribute('aria-pressed', String(state.answers));
    $('answersBtn').textContent = state.answers ? 'উত্তর লুকান' : 'উত্তর দেখুন';
  }

  $('q').addEventListener('input', debounce(function () { state.q = $('q').value; recompute(); }, 220));
  Object.keys(FACET_ID).forEach(function (facet) {
    var id = FACET_ID[facet];
    $(id).addEventListener('change', function () {
      state[facet] = $(id).value;
      if (facet === 'db') { state.un = state.y = ''; state.s = []; state.c = state.k = ''; }
      if (facet === 'un') { state.s = []; state.c = state.k = ''; }
      if (facet === 'c') state.k = '';
      writeControls(); recompute();
    });
  });
  $('fN').addEventListener('change', function () { state.n = $('fN').value; recompute(); });
  $('fSort').addEventListener('change', function () { state.sort = $('fSort').value; recompute(); });
  $('fE').addEventListener('change', function () { state.e = $('fE').checked; recompute(); });
  $('fImg').addEventListener('change', function () { state.img = $('fImg').checked; recompute(); });

  // subject multi-select widget: open/close + clear-all
  $('fSBtn').addEventListener('click', function () {
    $('fSPop').hidden = !$('fSPop').hidden;
    $('fSBtn').setAttribute('aria-expanded', String(!$('fSPop').hidden));
  });
  $('fSClear').addEventListener('click', function () {
    if (!state.s.length) return;
    state.s = [];
    state.c = state.k = '';
    recompute();
  });
  document.addEventListener('click', function (e) {
    if ($('fSPop').hidden) return;
    if ($('msS').contains(e.target)) return;
    $('fSPop').hidden = true;
    $('fSBtn').setAttribute('aria-expanded', 'false');
  });

  $('answersBtn').addEventListener('click', function () {
    state.answers = !state.answers;
    applyAnswers();
    try { localStorage.setItem('qb-answers', state.answers ? '1' : '0'); } catch (e) {}
  });
  $('shuffleBtn').addEventListener('click', function () {
    if (!indexReady || !results.length) { flashNote('আগে ফলাফল লোড হতে দিন'); return; }
    for (var i = results.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = results[i]; results[i] = results[j]; results[j] = t; }
    shown = 0; $('list').innerHTML = '';
    noteOverride = 'এলোমেলো করা হয়েছে — ' + num(results.length) + 'টি প্রশ্ন';
    renderPage(true);
  });
  $('resetBtn').addEventListener('click', reset);
  $('csvBtn').addEventListener('click', openCSV);
  $('csvGo').addEventListener('click', function () { setFmt('csv'); runCSV('csv'); });
  $('csvMnr').addEventListener('click', function () { setFmt('mnr'); runCSV('mnr'); });
  $('csvGo').addEventListener('focus', function () { setFmt('csv'); });
  $('csvMnr').addEventListener('focus', function () { setFmt('mnr'); });
  $('csvCancel').addEventListener('click', closeCSV);
  $('csvModal').addEventListener('click', function (e) { if (e.target === $('csvModal')) closeCSV(); });
  function csvNamePlaceholder() {
    var r = readRange();
    $('csvName').placeholder = r
      ? autoName(fmtIntent, Math.max(1, r.from), Math.max(r.from, r.to))
      : autoName(fmtIntent, 1, Math.max(1, Math.min(10, results.length)));
  }
  $('csvFrom').addEventListener('input', csvNamePlaceholder);
  $('csvTo').addEventListener('input', csvNamePlaceholder);
  $('csvFrom').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); $('csvTo').focus(); $('csvTo').select(); }
  });
  $('csvTo').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); runCSV(fmtIntent); }
  });
  $('csvName').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); runCSV(fmtIntent); }
  });
  $('moreBtn').addEventListener('click', function () { renderPage(false); });
  $('themeBtn').addEventListener('click', function () {
    var n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = n;
    try { localStorage.setItem('qb-theme', n); } catch (e) {}
  });
  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    var typing = tag === 'input' || tag === 'select' || tag === 'textarea';
    if (e.key === '/' && !typing) { e.preventDefault(); $('q').focus(); $('q').select(); }
    else if (e.key === 'a' && !typing) $('answersBtn').click();
    else if (e.key === 'Escape') {
      if (!$('fSPop').hidden) { $('fSPop').hidden = true; $('fSBtn').setAttribute('aria-expanded', 'false'); }
      else if (!$('csvModal').hidden) closeCSV();
      else $('q').blur();
    }
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { if (en.some(function (x) { return x.isIntersecting; })) renderPage(false); }, { rootMargin: '800px' }).observe($('sentinel'));
  }
  window.addEventListener('hashchange', function () {
    var cur = location.hash.replace(/^#/, '');
    if (cur === lastSyncedHash) return;      // our own write, state already matches
    lastSyncedHash = cur;
    readURL(); writeControls(); recompute();
    scrollToQuestion();
  });

  function scrollToQuestion() {
    if (!state.p) return;
    var t = document.getElementById('q-' + state.p);
    if (t && t.scrollIntoView) t.scrollIntoView({ block: 'center' });
  }

  // ---------- init ----------
  (function init() {
    try {
      var s = localStorage.getItem('qb-theme');
      document.documentElement.dataset.theme = s || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } catch (e) {}
    try {
      var a = localStorage.getItem('qb-answers');
      if (a !== null) state.answers = a === '1';
    } catch (e) {}
    applyAnswers();
    $('brandSub').textContent = num(M.total) + 'টি প্রশ্ন · ' + M.shards + ' শার্ড';
    $('srcTotal').textContent = num(M.total);
    $('srcShards').textContent = M.shards;
    $('count').textContent = 'সূচি তৈরি হচ্ছে…';
    lastSyncedHash = location.hash.replace(/^#/, '');
    readURL(); writeControls(); buildSelects();
    buildIndex();
  })();
})();
