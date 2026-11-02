(function () {
  'use strict';
  window.bindFilterEvents = function () {
    Object.keys(window.FACET_ID).forEach(function (facet) {
      var id = window.FACET_ID[facet];
      var el = window.$(id);
      if (!el) return;
      el.addEventListener('change', function () {
        window.state[facet] = el.value;
        if (facet === 'db') { window.state.un = []; window.state.un2 = []; window.state.sh = []; window.state.y = ''; window.state.s = []; window.state.c = []; window.state.k = ''; }
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
    
    // University Search events in Filter Menu
    var unSearch = window.$('fUnSearch');
    var unPopSearch = window.$('fUnPopSearch');
    var unClearInput = window.$('fUnClearInput');
    var unPop = window.$('fUnPop');
    var unBtn = window.$('fUnBtn');

    if (unSearch && unPop) {
      var openUnPop = function () {
        if (unPop.hidden) {
          unPop.hidden = false;
          if (unBtn) unBtn.setAttribute('aria-expanded', 'true');
          unSearch.setAttribute('aria-expanded', 'true');
          if (window.clampPop) window.clampPop(unPop);
        }
      };

      var closeUnPop = function () {
        if (!unPop.hidden) {
          unPop.hidden = true;
          if (unBtn) unBtn.setAttribute('aria-expanded', 'false');
          unSearch.setAttribute('aria-expanded', 'false');
          var sel = window.state.un || [];
          var sText = sel.length === 0 ? '' : (sel.length === 1 ? window.labelFor('un', sel[0]) : (sel.length + 'টি বিশ্ববিদ্যালয়'));
          unSearch.value = sText;
          if (unPopSearch) unPopSearch.value = '';
          if (window.filterUnList) window.filterUnList('');
          if (unClearInput) unClearInput.hidden = !(unSearch.value || sText);
        }
      };

      unSearch.addEventListener('focus', function () {
        openUnPop();
        unSearch.select();
      });

      unSearch.addEventListener('click', function (e) {
        e.stopPropagation();
        openUnPop();
      });

      unSearch.addEventListener('input', function () {
        openUnPop();
        var q = unSearch.value;
        if (unPopSearch) unPopSearch.value = q;
        if (window.filterUnList) window.filterUnList(q);
        if (unClearInput) unClearInput.hidden = !q && !(window.state.un || []).length;
      });

      unSearch.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          openUnPop();
          var listEl = window.$('fUnList');
          if (listEl) {
            var first = listEl.querySelector('.ms-item:not([hidden]) input');
            if (first) first.focus();
          }
        } else if (e.key === 'Escape') {
          closeUnPop();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          openUnPop();
          var firstChk = unPop.querySelector('.ms-item:not([hidden]) input');
          if (firstChk) firstChk.focus();
        }
      });

      if (unPopSearch) {
        unPopSearch.addEventListener('input', function () {
          var q = unPopSearch.value;
          unSearch.value = q;
          if (window.filterUnList) window.filterUnList(q);
          if (unClearInput) unClearInput.hidden = !q && !(window.state.un || []).length;
        });

        unPopSearch.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            var listEl = window.$('fUnList');
            if (listEl) {
              var first = listEl.querySelector('.ms-item:not([hidden]) input');
              if (first) first.focus();
            }
          } else if (e.key === 'Escape') {
            closeUnPop();
            unSearch.focus();
          }
        });
      }

      if (unClearInput) {
        unClearInput.addEventListener('click', function (e) {
          e.stopPropagation();
          unSearch.value = '';
          if (unPopSearch) unPopSearch.value = '';
          if (window.filterUnList) window.filterUnList('');
          if ((window.state.un || []).length) {
            window.clearMulti('un');
          }
          unClearInput.hidden = true;
          unSearch.focus();
        });
      }

      document.addEventListener('click', function (e) {
        var msUn = window.$('msUn');
        if (msUn && !msUn.contains(e.target)) {
          closeUnPop();
        }
      });
    }

    if (window.$('resetBtn')) window.$('resetBtn').addEventListener('click', window.reset);
  };
})();
