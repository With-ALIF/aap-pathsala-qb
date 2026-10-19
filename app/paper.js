(function () {
  'use strict';
  var BN_LETTERS = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ'];
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
  window.buildPaper = function (rows, meta) {
    meta = meta || {};
    var box = window.$('paper');
    if (box) box.innerHTML = '';
    var doc = window.el('div', 'paper-doc');
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
    doc.appendChild(head);
    var cols = window.el('div', 'paper-cols');
    doc.appendChild(cols);
    var key = [];
    rows.forEach(function (rec, i) {
      var sh = rec._sh != null ? rec._sh : rec.__shard;
      var full = (window.DATMAP[sh] || {})[rec.p] || {};
      var q = window.el('section', 'pq');
      var qt = window.el('p', 'pq-q');
      qt.appendChild(window.el('span', 'pq-n', window.bnNum(i + 1) + '.'));
      var qbody = window.el('span', 'pq-body');
      if (full.q) { qbody.innerHTML = full.q; window.eagerImgs(qbody); } else qbody.textContent = window.plain(rec.t || rec.q);
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
          row.appendChild(v);
          boxO.appendChild(row);
          if (o.c && correct == null) correct = letter;
        });
        q.appendChild(boxO);
      }
      cols.appendChild(q);
      if (mcq) {
        var ansLetter = correct;
        if (!ansLetter && rec.a) ansLetter = BN_LETTERS[rec.a - 1] || String.fromCharCode(64 + rec.a);
        key.push(window.bnNum(i + 1) + '–' + (ansLetter || '—'));
      }
    });
    if (key.length) {
      var sec = window.el('section', 'pq-keysec');
      sec.appendChild(window.el('h2', null, 'উত্তর তালিকা'));
      var table = window.el('table', 'pq-keytable');
      var tr = null;
      key.forEach(function (cell, i) {
        if (i % 5 === 0) { tr = window.el('tr'); table.appendChild(tr); }
        tr.appendChild(window.el('td', null, cell));
      });
      sec.appendChild(table);
      doc.appendChild(sec);
    }
    var sol = window.el('section', 'pq-solsec');
    sol.appendChild(window.el('h2', 'pq-solhead', 'উত্তর ও ব্যাখ্যাসহ সমাধান'));
    var solCols = window.el('div', 'sol-cols');
    sol.appendChild(solCols);
    rows.forEach(function (rec, i) {
      var sh = rec._sh != null ? rec._sh : rec.__shard;
      var full = (window.DATMAP[sh] || {})[rec.p] || {};
      var item = window.el('div', 'psol');
      var qp = window.el('p', 'psol-q');
      qp.appendChild(window.el('span', 'pq-n', window.bnNum(i + 1) + '.'));
      var qb2 = window.el('span', 'pq-body');
      if (full.q) { qb2.innerHTML = full.q; window.eagerImgs(qb2); } else qb2.textContent = window.plain(rec.t || rec.q);
      qp.appendChild(qb2);
      item.appendChild(qp);
      var opts2 = full.o || [];
      var mcq2 = rec.ty !== 'written' && window.optsReal(opts2);
      if (mcq2) {
        var letter2 = null, otext2 = '';
        opts2.forEach(function (o, oi) {
          if (o && o.c && letter2 == null) {
            letter2 = BN_LETTERS[oi] || String.fromCharCode(65 + oi);
            otext2 = window.plain(o.t) || window.stripHTML(o.h);
          }
        });
        if (!letter2 && rec.a) {
          letter2 = BN_LETTERS[rec.a - 1] || String.fromCharCode(64 + rec.a);
          var ro = opts2[rec.a - 1];
          if (ro) otext2 = window.plain(ro.t) || window.stripHTML(ro.h);
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
          ep.appendChild(eb2);
        } else {
          ep.appendChild(document.createTextNode(full.et));
        }
        item.appendChild(ep);
      }
      solCols.appendChild(item);
    });
    doc.appendChild(sol);
    var foot = window.el('footer', 'paper-foot', 'প্রশ্নব্যাংক আর্কাইভ — অফলাইন নির্বাচিত প্রশ্ন পরীক্ষাপত্র');
    doc.appendChild(foot);
    if (box) box.appendChild(doc);
    return doc;
  };
})();
