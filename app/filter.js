(function () {
  'use strict';
  window.facetMatch = function (recVal, sel) {
    if (!sel) return true;
    if (sel === window.NONE) return window.isBlank(recVal);
    return recVal === sel;
  };
  window.baseMatch = function (r) {
    if (window.state.p && String(r.p) !== window.state.p) return false;
    if (window.state.n && String(r.__n) !== window.state.n) return false;
    if (window.state.e && !r.e) return false;
    if (window.state.img && !r.img) return false;
    return true;
  };
  window.facetPass = function (recVal, f) {
    if (window.MULTI_FACETS.indexOf(f) !== -1) {
      var sel = window.state[f];
      if (!sel || !sel.length) return true;
      return sel.indexOf(recVal) !== -1;
    }
    var one = window.state[f];
    if (!one) return true;
    if (one === window.NONE) return window.isBlank(recVal);
    return recVal === one;
  };
  window.match = function (r) {
    if (!window.baseMatch(r)) return false;
    for (var i = 0; i < window.FACETS.length; i++) {
      var f = window.FACETS[i];
      if (!window.facetPass(r[f], f)) return false;
    }
    return true;
  };
  window.sortKey = function (r, f) {
    var v = r[f];
    return v == null ? '' : String(v);
  };
  window.sortResults = function () {
    var s = window.state.sort;
    if (s === 'default') return;
    if (s === 'shuffle') {
      for (var i = window.results.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = window.results[i];
        window.results[i] = window.results[j];
        window.results[j] = tmp;
      }
      return;
    }
    var desc = s.slice(-5) === '-desc';
    var f = desc ? s.slice(0, -5) : s;
    window.results.sort(function (a, b) {
      var d;
      if (f === 'p' || f === 'y') {
        d = (a[f] || 0) - (b[f] || 0);
      } else {
        d = window.COLL_CMP(window.sortKey(a, f), window.sortKey(b, f));
      }
      return desc ? -d : d;
    });
  };
  window.inc = function (map, v) {
    var k = window.isBlank(v) ? window.NONE : v;
    map[k] = (map[k] || 0) + 1;
  };
  window.computeFacetCounts = function () {
    var counts = {};
    for (var i = 0; i < window.FACETS.length; i++) counts[window.FACETS[i]] = {};
    for (var j = 0; j < window.FLAT.length; j++) {
      var r = window.FLAT[j];
      if (!window.baseMatch(r)) continue;
      for (var fi = 0; fi < window.FACETS.length; fi++) {
        var f = window.FACETS[fi];
        var pass = true;
        for (var fj = 0; fj < window.FACETS.length; fj++) {
          if (fi === fj) continue;
          if (!window.facetPass(r[window.FACETS[fj]], window.FACETS[fj])) { pass = false; break; }
        }
        if (pass) window.inc(counts[f], r[f]);
      }
    }
    return counts;
  };
  window.recompute = function () {
    if (!window.indexReady) return;
    var out = [];
    for (var i = 0; i < window.FLAT.length; i++) {
      var r = window.FLAT[i];
      if (window.match(r)) out.push(r);
    }
    window.results = out;
    window.sortResults();
    window.renderPage(true);
    window.refreshSelects(window.computeFacetCounts());
    window.updateStatus();
    window.updateSelAllBtn();
    window.syncURL();
  };
  window.pendingFor = function (recs) {
    var needed = {};
    for (var i = 0; i < recs.length; i++) {
      var s = recs[i]._sh != null ? recs[i]._sh : recs[i].__shard;
      if (s != null && !isNaN(s) && !window.LOADED.dat[s]) needed[s] = true;
    }
    return Object.keys(needed).map(Number);
  };
  window.noteText = function () {
    if (window.noteOverride) return window.noteOverride;
    var n = window.results.length;
    var total = window.FLAT.length;
    var parts = [];
    parts.push(window.num(n) + ' / ' + window.num(total) + 'টি প্রশ্ন');
    if (window.state.sort === 'shuffle') parts.push('(এলোমেলো)');
    if (window.loading) parts.push('(লোড হচ্ছে…)');
    return parts.join(' ');
  };
})();
