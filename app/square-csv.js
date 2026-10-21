(function () {
  'use strict';

  window.SQ_HEADER = 'question,type,option1,option2,option3,option4,answer,explanation,question_image,option1_image,option2_image,option3_image,option4_image,explanation_image,subject_name,paper_name,chapter_name,topic_name';

  var SQ_PAPER = { '1': '১ম পত্র', '2': '২য় পত্র', '3': '৩য় পত্র', '4': '৪র্থ পত্র', '5': '৫ম পত্র' };
  var SQ_LETTER = ['A', 'B', 'C', 'D', 'E', 'F'];
  var SQ_BUSY = ['csvGo', 'csvMnr', 'sqGo'];

  function fullOf(rec) {
    return (window.DATMAP[rec.__shard] || {})[rec.p] || {};
  }

  function imgURLs(html) {
    var out = [], re = /<img[^>]*\ssrc\s*=\s*["']([^"']+)["'][^>]*>/gi, m;
    while ((m = re.exec(String(html || '')))) if (m[1]) out.push(m[1]);
    return out;
  }

  function imgCell(html) {
    var u = imgURLs(html);
    return !u.length ? '' : (u.length === 1 ? u[0] : JSON.stringify(u));
  }

  function explainText(full) {
    if (full.et) return full.et;
    var e = String(full.e || '');
    if (!e) return '';
    return e.replace(/<img[^>]*>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function answerCell(rec, opts) {
    var out = [];
    for (var i = 0; i < opts.length; i++) if (opts[i] && opts[i].c) out.push(SQ_LETTER[i] || String(i + 1));
    if (!out.length && rec.a != null) out.push(SQ_LETTER[rec.a - 1] || String(rec.a));
    return out.join(',');
  }

  function str(v) {
    if (window.isBlank(v) || v === '' || v === 0) return '';
    return String(v);
  }

  function subjectOf(rec) {
    var key = str(rec.s);
    if (!key) return '';
    var m = /^([A-Za-z]+)-(\d+)$/.exec(key);
    if (m && window.SUBJ_LABEL[m[1].toLowerCase()]) return window.SUBJ_LABEL[m[1].toLowerCase()];
    return window.SUBJ_LABEL[key] || key;
  }

  function paperOf(rec) {
    var m = /^([A-Za-z]+)-(\d+)$/.exec(str(rec.s));
    if (!m) return '';
    return SQ_PAPER[m[2]] || (m[2] + 'ম পত্র');
  }

  function typeOf(rec) {
    if (rec.ty) return rec.ty;
    return window.isWrittenRec(rec) ? 'written' : 'mcq';
  }

  window.sqRow = function (rec) {
    var full = fullOf(rec);
    var opts = full.o || [];
    var cells = [];
    cells.push(window.csvCell(window.textOf(rec.t) || window.textOf(full.q)));
    cells.push(window.csvCell(typeOf(rec)));
    for (var i = 0; i < 4; i++) cells.push(window.csvCell(window.textOf(opts[i] ? (opts[i].t || opts[i].h) : '')));
    cells.push(window.csvCell(answerCell(rec, opts)));
    cells.push(window.csvCell(explainText(full)));
    cells.push(window.csvCell(imgCell(full.q)));
    for (var j = 0; j < 4; j++) cells.push(window.csvCell(imgCell(opts[j] ? opts[j].h : '')));
    cells.push(window.csvCell(imgCell(full.e)));
    cells.push(window.csvCell(subjectOf(rec)));
    cells.push(window.csvCell(paperOf(rec)));
    cells.push(window.csvCell(str(rec.c) ? (window.CHAPTER_NAME[rec.c] || str(rec.c)) : ''));
    cells.push(window.csvCell(str(rec.k)));
    return cells.join(',');
  };

  window.buildSquareCSV = function (rows) {
    var out = [window.SQ_HEADER];
    for (var i = 0; i < rows.length; i++) out.push(window.sqRow(rows[i]));
    return '\uFEFF' + out.join('\r\n') + '\r\n';
  };

  function setSquareBusy(on) {
    for (var i = 0; i < SQ_BUSY.length; i++) {
      var el = window.$(SQ_BUSY[i]);
      if (el) el.disabled = !!on;
    }
  }

  function squareName(from, to) {
    var el = window.$('csvName');
    var user = window.sanitizeName(el ? el.value : '');
    if (!user) return 'square-questions-' + from + '-to-' + to + '.csv';
    window.saveLastName(user);
    return user + (!/-square$/i.test(user) ? '-square' : '') + '.csv';
  }

  window.squareExportRange = function (from, to) {
    var sub = window.results.slice(from - 1, to);
    var needed = window.pendingFor(sub);
    window.csvErr('কনটেন্ট শার্ড লোড হচ্ছে…');
    setSquareBusy(true);
    Promise.all(needed.map(window.loadDat)).then(function () {
      window.csvErr('');
      setSquareBusy(false);
      window.downloadCSV(window.buildSquareCSV(sub), squareName(from, to));
      window.closeCSV();
    }).catch(function (err) {
      setSquareBusy(false);
      window.csvErr('শার্ড লোড ব্যর্থ: ' + (err && err.message ? err.message : err));
    });
  };

  window.runSquareCSV = function () {
    var rng = window.readRange();
    var n = window.results.length;
    if (isNaN(rng.from) || isNaN(rng.to) || rng.from < 1 || rng.to > n || rng.from > rng.to) {
      window.csvErr('সঠিক পরিসর দিন (১ থেকে ' + window.num(n) + '-এর মধ্যে)');
      return;
    }
    window.squareExportRange(rng.from, rng.to);
  };

  window.runSelSquare = function () {
    window.openSelExport('square');
  };

  function bindSquare() {
    if (window.$('sqGo')) window.$('sqGo').addEventListener('click', window.runSquareCSV);
    if (window.$('selSq')) window.$('selSq').addEventListener('click', window.runSelSquare);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindSquare);
  else bindSquare();
})();
