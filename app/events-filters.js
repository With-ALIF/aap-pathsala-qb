(function () {
  'use strict';
  window.bindFilterEvents = function () {
    var qEl = window.$('q');
    if (qEl) {
      qEl.addEventListener('input', window.debounce(function () {
        window.state.p = '';
        window.state.q = qEl.value;
        window.recompute();
      }, 220));
    }
    Object.keys(window.FACET_ID).forEach(function (facet) {
      var id = window.FACET_ID[facet];
      var el = window.$(id);
      if (!el) return;
      el.addEventListener('change', function () {
        window.state[facet] = el.value;
        if (facet === 'db') { window.state.un = window.state.y = ''; window.state.s = []; window.state.c = []; window.state.k = ''; }
        if (facet === 'un') { window.state.s = []; window.state.c = []; window.state.k = ''; }
        window.writeControls();
        window.recompute();
      });
    });
    if (window.$('fN')) window.$('fN').addEventListener('change', function () { window.state.n = window.$('fN').value; window.recompute(); });
    if (window.$('fSort')) window.$('fSort').addEventListener('change', function () { window.state.sort = window.$('fSort').value; window.recompute(); });
    if (window.$('fE')) window.$('fE').addEventListener('change', function () { window.state.e = window.$('fE').checked; window.recompute(); });
    if (window.$('fImg')) window.$('fImg').addEventListener('change', function () { window.state.img = window.$('fImg').checked; window.recompute(); });
    window.MULTI_FACETS.forEach(function (facet) {
      var cfg = window.MULTI_ID[facet];
      if (!cfg) return;
      var btn = window.$(cfg.btn), pop = window.$(cfg.pop), field = window.$(cfg.field);
      if (btn && pop) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var open = !pop.hidden;
          pop.hidden = open;
          btn.setAttribute('aria-expanded', String(!open));
          if (!open) window.clampPop(pop);
        });
        document.addEventListener('click', function (e) {
          if (!pop.hidden && field && !field.contains(e.target)) {
            pop.hidden = true;
            btn.setAttribute('aria-expanded', 'false');
          }
        });
      }
      var clear = window.$(cfg.clear);
      if (clear) {
        clear.addEventListener('click', function () {
          if (!(window.state[facet] || []).length) return;
          window.clearMulti(facet);
        });
      }
    });
    if (window.$('resetBtn')) window.$('resetBtn').addEventListener('click', window.reset);
  };
})();
