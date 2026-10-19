(function () {
  'use strict';
  var BN_LETTERS = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ'];
  var MM = 96 / 25.4;
  var PAGE_H = 296 * MM;        // a hair under A4 so the slice lands in the padding
  var PAD = 8 * MM;
  var MAX_H = PAGE_H - PAD * 2 - 3 * MM;

  window.paperSubjects = function (rows) {
    var seen = {}, list = [];
    for (var i = 0; i < rows.length; i++) {
      var s = rows[i].s;
      if (!s) continue;
      var lbl = window.labelFor('s', s);
      if (!seen[lbl]) { seen[lbl] = true; list.push(lbl); }
    }
    return list.join(', ');
  };

  function questionNode(rec, i) {
    var sh = rec._sh != null ? rec._sh : rec.__shard;
    var full = (window.DATMAP[sh] || {})[rec.p] || {};
    var q = window.el('section', 'pq');
    var qt = window.el('p', 'pq-q');
    qt.appendChild(window.el('span', 'pq-n', window.bnNum(i + 1) + '.'));
    var qbody = window.el('span', 'pq-body');
    if (full.q) { qbody.innerHTML = full.q; window.eagerImgs(qbody); } else qbody.textContent = window.textOf(rec.t || rec.q);
    window.enhanceMath(qbody);
    qt.appendChild(qbody);
    q.appendChild(qt);
    var opts = full.o || [];
    var mcq = rec.ty !== 'written' && window.optsReal(opts);
    if (mcq) {
      var maxLen = 0;
      opts.forEach(function (o) {
        var h = (o && o.h) || '';
        var L = /<img[\s>]/i.test(h) ? 999 : window.stripHTML(h || (o && o.t) || '').length;
        if (L > maxLen) maxLen = L;
      });
      var optMode = maxLen <= 18 ? 'inline' : (maxLen <= 50 ? 'half' : 'stack');
      var boxO = window.el('div', 'pq-opts ' + optMode);
      var correct = null;
      opts.forEach(function (o, oi) {
        var letter = BN_LETTERS[oi] || String.fromCharCode(65 + oi);
        var row = window.el('div', 'pq-opt');
        row.appendChild(window.el('span', 'pq-key', '(' + letter + ')'));
        var v = window.el('span', 'pq-val');
        if (o.h) { v.innerHTML = o.h; window.eagerImgs(v); } else v.textContent = o.t || '';
        window.enhanceMath(v);
        row.appendChild(v);
        boxO.appendChild(row);
        if (o.c && correct == null) correct = letter;
      });
      q.appendChild(boxO);
    }
    return { node: q, mcq: mcq, correct: correct };
  }

  function solutionNode(rec, i) {
    var sh = rec._sh != null ? rec._sh : rec.__shard;
    var full = (window.DATMAP[sh] || {})[rec.p] || {};
    var item = window.el('div', 'psol');
    var qp = window.el('p', 'psol-q');
    qp.appendChild(window.el('span', 'pq-n', window.bnNum(i + 1) + '.'));
    var qb2 = window.el('span', 'pq-body');
    if (full.q) { qb2.innerHTML = full.q; window.eagerImgs(qb2); } else qb2.textContent = window.textOf(rec.t || rec.q);
    window.enhanceMath(qb2);
    qp.appendChild(qb2);
    item.appendChild(qp);
    var opts2 = full.o || [];
    var mcq2 = rec.ty !== 'written' && window.optsReal(opts2);
    if (mcq2) {
      var letter2 = null, otext2 = '';
      opts2.forEach(function (o, oi) {
        if (o && o.c && letter2 == null) {
          letter2 = BN_LETTERS[oi] || String.fromCharCode(65 + oi);
          otext2 = window.textOf(o.t) || window.stripHTML(o.h);
        }
      });
      if (!letter2 && rec.a) {
        letter2 = BN_LETTERS[rec.a - 1] || String.fromCharCode(64 + rec.a);
        var ro = opts2[rec.a - 1];
        if (ro) otext2 = window.textOf(ro.t) || window.stripHTML(ro.h);
      }
      var ap = window.el('p', 'psol-a');
      ap.appendChild(window.el('span', 'psol-alabel', 'সঠিক উত্তর: '));
      ap.appendChild(document.createTextNode(letter2 ? '(' + letter2 + ')' + (otext2 ? ' ' + otext2 : '') : '—'));
      item.appendChild(ap);
    }
    if (full.e || full.et) {
      var ep = window.el('div', 'psol-e');
      ep.appendChild(window.el('span', 'psol-alabel', 'ব্যাখ্যা: '));
      if (full.e) {
        var eb2 = window.el('span');
        eb2.innerHTML = full.e;
        window.eagerImgs(eb2);
        window.enhanceMath(eb2);
        ep.appendChild(eb2);
      } else {
        ep.appendChild(document.createTextNode(full.et));
      }
      window.enhanceMath(ep);
      item.appendChild(ep);
    }
    return item;
  }

  window.buildPaper = function (rows, meta) {
    meta = meta || {};
    var box = window.$('paper');
    if (box) box.innerHTML = '';
    var doc = window.el('div', 'paper-doc');
    // attach straight away: pagination measures real heights, and a detached
    // tree reports offsetHeight/scrollHeight of 0
    if (box) box.appendChild(doc);

    function newPage(headerNode) {
      var page = window.el('div', 'pdf-page');
      if (headerNode) page.appendChild(headerNode);
      var cols = window.el('div', 'pdf-cols');
      var left = window.el('div', 'pdf-col');
      var right = window.el('div', 'pdf-col');
      cols.appendChild(left);
      cols.appendChild(right);
      page.appendChild(cols);
      doc.appendChild(page);
      return { page: page, left: left, right: right, max: MAX_H };
    }

    // put a node in the left column, spill to the right, then to a new page
    function place(cur, node) {
      cur.left.appendChild(node);
      if (cur.left.scrollHeight <= cur.max) return cur;
      cur.left.removeChild(node);
      cur.right.appendChild(node);
      if (cur.right.scrollHeight <= cur.max) return cur;
      cur.right.removeChild(node);
      var next = newPage(null);
      next.left.appendChild(node);
      return next;
    }

    // ---------------- header + questions ----------------
    var head = window.el('header', 'paper-head');
    head.appendChild(window.el('h1', null, meta.title || 'নির্বাচিত প্রশ্নের পরীক্ষাপত্র'));
    var dur = window.durationLabel(meta.minutes);
    var metaBits = [];
    if (meta.subject) metaBits.push('বিষয়: ' + meta.subject);
    metaBits.push('মোট প্রশ্ন: ' + window.bnNum(rows.length) + 'টি');
    if (dur) metaBits.push('সময়: ' + dur);
    metaBits.push('তারিখ: ' + (meta.date || window.paperDate()));
    head.appendChild(window.el('p', 'paper-meta', metaBits.join('   |   ')));
    head.appendChild(window.el('p', 'paper-note', 'সঠিক উত্তর নির্বাচন করুন। উত্তর ও ব্যাখ্যাসহ সমাধান প্রশ্নপত্রের পরের অংশে দেওয়া আছে।'));

    var cur = newPage(head);
    cur.max = Math.max(120, MAX_H - head.offsetHeight);

    var key = [];
    rows.forEach(function (rec, i) {
      var made = questionNode(rec, i);
      cur = place(cur, made.node);
      if (made.mcq) {
        var letter = made.correct;
        if (!letter && rec.a) letter = BN_LETTERS[rec.a - 1] || String.fromCharCode(64 + rec.a);
        key.push(window.bnNum(i + 1) + '–' + (letter || '—'));
      }
    });

    // ---------------- answer key (own pages) ----------------
    if (key.length) {
      var kpage = newPage(null);
      kpage.max = MAX_H;
      var sec = window.el('section', 'pq-keysec');
      sec.appendChild(window.el('h2', null, 'উত্তর তালিকা'));
      var table = window.el('table', 'pq-keytable');
      sec.appendChild(table);
      kpage.page.insertBefore(sec, kpage.page.firstChild);
      // every answer stays on this single page — 10 columns per row keeps even
      // a few hundred MCQs inside one A4 sheet
      var PER_ROW = 10;
      var ktr = null;
      key.forEach(function (cell, i) {
        if (i % PER_ROW === 0) { ktr = window.el('tr'); table.appendChild(ktr); }
        ktr.appendChild(window.el('td', null, cell));
      });
    }

    // ---------------- solutions (own pages) ----------------
    var solHead = window.el('h2', 'pq-solhead', 'উত্তর ও ব্যাখ্যাসহ সমাধান');
    var sc = newPage(solHead);
    sc.max = Math.max(120, MAX_H - solHead.offsetHeight);
    var lastPage = sc;
    rows.forEach(function (rec, i) {
      lastPage = place(lastPage, solutionNode(rec, i));
    });

    // ---------------- footer ----------------
    var foot = window.el('footer', 'paper-foot', 'প্রশ্নব্যাংক আর্কাইভ — অফলাইন নির্বাচিত প্রশ্ন পরীক্ষাপত্র');
    lastPage.right.appendChild(foot);
    if (lastPage.right.scrollHeight > lastPage.max) {
      lastPage.right.removeChild(foot);
      var fp = newPage(null);
      fp.left.appendChild(foot);
    }

    window.enhanceMath(doc);
    return doc;
  };
})();