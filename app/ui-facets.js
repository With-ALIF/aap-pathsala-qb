(function () {
  'use strict';
  window.mkOpt = function (v, label) {
    var o = document.createElement('option');
    o.value = v;
    o.textContent = label;
    return o;
  };
  window.fillSelect = function (sel, facet, current, counts) {
    if (!sel) return;
    var frag = document.createDocumentFragment();
    frag.appendChild(window.mkOpt('', 'সব'));
    var list = (window.M && window.M.facets && window.M.facets[facet]) || window.STATIC_LIST[facet] || [];
    var haveNone = counts && (counts[window.NONE] || 0) > 0;
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      var c = counts ? (counts[it.value] || 0) : null;
      if (counts && c === 0 && it.value !== current) continue;
      var lbl = window.labelFor(facet, it.value);
      if (c != null) lbl += ' (' + window.num(c) + ')';
      frag.appendChild(window.mkOpt(it.value, lbl));
    }
    if (haveNone || current === window.NONE) {
      var noneLbl = window.labelFor(facet, window.NONE);
      if (counts && counts[window.NONE] != null) noneLbl += ' (' + window.num(counts[window.NONE]) + ')';
      frag.appendChild(window.mkOpt(window.NONE, noneLbl));
    }
    sel.innerHTML = '';
    sel.appendChild(frag);
    sel.value = current || '';
  };
  window.refreshSelects = function (counts) {
    for (var i = 0; i < window.FACETS.length; i++) {
      var f = window.FACETS[i];
      if (window.MULTI_FACETS.indexOf(f) !== -1) {
        window.fillMultiList(f, counts ? counts[f] : null);
        continue;
      }
      var sel = window.$(window.FACET_ID[f]);
      if (sel) window.fillSelect(sel, f, window.state[f], counts ? counts[f] : null);
    }
    var selN = window.$('fN');
    if (selN) selN.value = window.state.n || '';
  };
  window.buildSelects = function () {
    window.refreshSelects(null);
  };
  window.fillMultiList = function (facet, counts) {
    var cfg = window.MULTI_ID[facet];
    if (!cfg) return;
    var listEl = window.$(cfg.list);
    if (!listEl) return;
    var list = (window.M && window.M.facets && window.M.facets[facet]) || [];
    var selected = window.state[facet] || [];
    var frag = document.createDocumentFragment();
    var haveNone = counts && (counts[window.NONE] || 0) > 0;
    var item = function (key, c) {
      var isChecked = selected.indexOf(key) !== -1;
      if (counts && c === 0 && !isChecked) return null;
      var row = window.el('label', 'ms-item');
      var chk = window.el('input');
      chk.type = 'checkbox';
      chk.value = key;
      chk.checked = isChecked;
      chk.onchange = function () { window.toggleMulti(facet, key, chk.checked); };
      row.appendChild(chk);
      var name = window.el('span', 'ms-name', window.labelFor(facet, key));
      row.appendChild(name);
      if (c != null) row.appendChild(window.el('span', 'ms-badge', window.num(c)));
      return row;
    };
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      var c = counts ? (counts[it.value] || 0) : null;
      var row = item(it.value, c);
      if (row) frag.appendChild(row);
    }
    if (haveNone || selected.indexOf(window.NONE) !== -1) {
      var noneRow = item(window.NONE, counts ? (counts[window.NONE] || 0) : null);
      if (noneRow) frag.appendChild(noneRow);
    }
    listEl.innerHTML = '';
    listEl.appendChild(frag);
    var btn = window.$(cfg.btn);
    var n = selected.length;
    if (n === 0) btn.textContent = 'সব';
    else if (n === 1) btn.textContent = window.labelFor(facet, selected[0]);
    else btn.textContent = n + 'টি ' + cfg.label;
    var cnt = window.$(cfg.count);
    if (cnt) cnt.textContent = n ? n + 'টি নির্বাচিত' : '';
  };
  window.toggleMulti = function (facet, key, on) {
    var arr = (window.state[facet] || []).slice();
    var idx = arr.indexOf(key);
    if (on && idx === -1) arr.push(key);
    if (!on && idx !== -1) arr.splice(idx, 1);
    window.state[facet] = arr;
    if (facet === 's') window.state.k = '';
    window.recompute();
  };
  window.clearMulti = function (facet) {
    window.state[facet] = [];
    if (facet === 's') { window.state.c = []; window.state.k = ''; }
    if (facet === 'c') window.state.k = '';
    window.recompute();
  };
})();
