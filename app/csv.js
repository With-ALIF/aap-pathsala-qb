(function () {
  'use strict';

  var _ent = null;
  window.textOf = function (v) {
    if (v == null) return '';
    var s = String(v).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!/[<&]/.test(String(v))) return s;
    if (!_ent) _ent = document.createElement('textarea');
    _ent.innerHTML = String(v);
    return (_ent.value || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
  };

  window.CSV_HEADER = 'questions,option1,option2,option3,option4,option5,answer,explanation,type,section';

  window.csvCell = function (v) {
    var s = v == null ? '' : String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  window.optionCell = function (o) { return (o && (o.t || o.h)) || ''; };

  window.csvRow = function (rec) {
    var full = (window.DATMAP[rec.__shard] || {})[rec.p] || {};
    var q = window.textOf(rec.t);
    if (!q && full.q) q = window.textOf(full.q);
    var opts = full.o || [];
    var cells = [window.csvCell(q)];
    for (var i = 0; i < 5; i++) cells.push(window.csvCell(window.textOf(window.optionCell(opts[i]))));
    var ans = rec.a;
    if (ans == null) {
      for (var j = 0; j < opts.length; j++) if (opts[j] && opts[j].c) { ans = opts[j].n || j + 1; break; }
    }
    cells.push(window.csvCell(ans == null ? '' : ans));
    cells.push(window.csvCell(full.et || window.textOf(full.e) || ''));
    cells.push('1', '1');
    return cells.join(',');
  };

  window.buildCSV = function (rows) {
    var out = [window.CSV_HEADER];
    for (var i = 0; i < rows.length; i++) out.push(window.csvRow(rows[i]));
    return '\uFEFF' + out.join('\r\n') + '\r\n';
  };
window.stripHTML = function (s) {
    return window.textOf(s);
  };

  window.downloadCSV = function (csv, name) {
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    window.downloadBlob(blob, name);
  };
  window.downloadBlob = function (blob, name) {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return false;
    try {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 30000);
      return true;
    } catch (e) { return false; }
  };
})();