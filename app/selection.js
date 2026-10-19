(function () {
  'use strict';
  window.toggleSel = function (rec, on) {
    var pk = rec.p;
    if (on) {
      if (!window.selMap[pk]) {
        window.selMap[pk] = rec;
        window.selOrder.push(pk);
      }
    } else {
      if (window.selMap[pk]) {
        delete window.selMap[pk];
        var idx = window.selOrder.indexOf(pk);
        if (idx >= 0) window.selOrder.splice(idx, 1);
      }
    }
    var node = document.getElementById('q-' + pk) || window.$('list').querySelector('[data-pk="' + pk + '"]');
    if (node) {
      node.classList.toggle('selected', !!on);
      var chk = node.querySelector('.qsel, .q-sel');
      if (chk) chk.checked = !!on;
    }
    window.saveSel();
    window.updateSelBar();
  };
  window.selRecs = function () {
    var out = [];
    for (var i = 0; i < window.selOrder.length; i++) {
      var r = window.selMap[window.selOrder[i]];
      if (r) out.push(r);
    }
    return out;
  };
  window.updateSelBar = function () {
    var bar = window.$('selBar');
    if (!bar) return;
    var n = window.selOrder.length;
    if (!n) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    window.$('selCount').textContent = window.num(n) + 'টি প্রশ্ন নির্বাচিত';
  };
  window.saveSel = function () {
    try { localStorage.setItem('qb_sel', JSON.stringify(window.selOrder)); } catch (e) {}
  };
  window.restoreSel = function () {
    try {
      var raw = localStorage.getItem('qb_sel');
      if (!raw) return;
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      var byPk = {};
      for (var i = 0; i < window.FLAT.length; i++) byPk[window.FLAT[i].p] = window.FLAT[i];
      for (var j = 0; j < arr.length; j++) {
        var pk = arr[j];
        var r = byPk[pk];
        if (r && !window.selMap[pk]) {
          window.selMap[pk] = r;
          window.selOrder.push(pk);
        }
      }
      window.updateSelBar();
    } catch (e) {}
  };
  window.setSelBusy = function (on, label) {
    var ids = ['selCsv', 'selMnr', 'selPdf', 'selClear', 'selCsvBtn', 'selMnrBtn', 'selPdfBtn', 'selClearBtn', 'pdfGo'];
    for (var i = 0; i < ids.length; i++) {
      var b = window.$(ids[i]);
      if (b) {
        b.disabled = !!on;
        if (ids[i] === 'selPdf' || ids[i] === 'selPdfBtn' || ids[i] === 'pdfGo') {
          if (on) {
            if (!b.dataset.origText) b.dataset.origText = b.textContent;
            b.textContent = label || 'PDF তৈরি হচ্ছে…';
          } else if (b.dataset.origText) {
            b.textContent = b.dataset.origText;
            delete b.dataset.origText;
          }
        }
      }
    }
  };
})();
