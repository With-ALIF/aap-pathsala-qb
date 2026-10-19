(function () {
  'use strict';

  window.MNR_HEADER = 'question,question_image,option_1,option_1_image,option_2,option_2_image,option_3,option_3_image,option_4,option_4_image,option_5,option_5_image,correct_options,explanation,explanation_image,type_id,paper_id,chapter_id,topic_id';

  function stripHTML(s) {
    return window.stripHTML(s);
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

  function correctList(full, rec) {
    var out = [];
    (full.o || []).forEach(function (o, i) { if (o && o.c) out.push(i + 1); });
    if (!out.length && rec && rec.a != null) out.push(rec.a);
    return out.join(',');
  }

  function csvQ(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }
  function csvCorrect(v) {
    if (v === '') return '';
    return v.indexOf(',') < 0 ? v : '"' + v.replace(/"/g, '""') + '"';
  }

  window.paperIdOf = function (s) {
    if (window.isBlank(s)) return '';
    var t = String(s).toLowerCase().replace(/-/g, '');
    return t.replace(/^(bangla|ban|ba|bn)(\d*)$/, function (m, p, d) { return 'bn' + d; });
  };

  window.chapterIdOf = function (c, paperId) {
    if (window.isBlank(c)) return '';
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
  };

  window.mnrRow = function (rec) {
    var full = (window.DATMAP[rec.__shard] || {})[rec.p] || {};
    var q = window.textOf(rec.t) || stripHTML(full.q);
    var opts = full.o || [];
    var cells = [csvQ(q), csvQ(imgCell(full.q))];
    for (var i = 0; i < 5; i++) {
      var o = opts[i];
      cells.push(csvQ(o ? (window.textOf(o.t) || stripHTML(o.h)) : ''));
      cells.push(csvQ(o ? imgCell(o.h) : ''));
    }
    var paper = window.paperIdOf(rec.s);
    cells.push(csvCorrect(correctList(full, rec)));
    cells.push(csvQ(full.et || stripHTML(full.e)));
    cells.push(csvQ(imgCell(full.e)));
    cells.push(csvQ(''));
    cells.push(csvQ(paper));
    cells.push(csvQ(window.chapterIdOf(rec.c, paper)));
    cells.push(csvQ(rec.k == null ? '' : String(rec.k)));
    return cells.join(',');
  };

  window.buildMNR = function (rows) {
    var out = [window.MNR_HEADER];
    for (var i = 0; i < rows.length; i++) out.push(window.mnrRow(rows[i]));
    return '\uFEFF' + out.join('\n');
  };

  window.toNums = function (str) {
    var s = String(str || '').replace(/[০-৯]/g, function (d) { return String(d.charCodeAt(0) - 0x09E6); });
    return (s.match(/\d+/g) || []).map(Number);
  };
  window.parseRange = function (str) {
    var n = window.toNums(str);
    if (n.length < 2) return null;
    return { from: Math.min(n[0], n[1]), to: Math.max(n[0], n[1]) };
  };
  window.readRange = function () {
    var a = window.toNums(window.$('csvFrom').value)[0];
    var b = window.toNums(window.$('csvTo').value)[0];
    if (a != null && b != null) return { from: Math.min(a, b), to: Math.max(a, b) };
    return window.parseRange(window.$('csvFrom').value + ' ' + window.$('csvTo').value);
  };
})();