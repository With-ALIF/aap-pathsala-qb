(function () {
  'use strict';
  window.haystack = function (r) {
    var parts = [window.plain(r.q)];
    if (Array.isArray(r.o)) {
      for (var i = 0; i < r.o.length; i++) parts.push(window.plain(r.o[i]));
    }
    if (r.c) parts.push(window.plain(r.c));
    if (r.k) parts.push(window.plain(r.k));
    if (r.un) parts.push(window.plain(r.un));
    return parts.join(' ').toLowerCase();
  };
  window.buildIndex = function () {
    for (var i = 0; i < window.FLAT.length; i++) {
      var r = window.FLAT[i];
      r.__h = window.haystack(r);
      if (!r.ty) r.ty = window.isWrittenRec(r) ? 'written' : 'mcq';
      r.__n = window.optsReal(r.o);
    }
    window.indexReady = true;
    window.refreshSelects(null);
    window.recompute();
  };
})();
