(function () {
  'use strict';
  window.buildIndex = function () {
    for (var i = 0; i < window.FLAT.length; i++) {
      var r = window.FLAT[i];
      if (!r.ty) r.ty = window.isWrittenRec(r) ? 'written' : 'mcq';
      r.__n = window.optsReal(r.o);
    }
    window.indexReady = true;
    window.refreshSelects(null);
    window.recompute();
  };
})();
