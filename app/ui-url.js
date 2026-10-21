(function () {
  'use strict';
  window.syncURL = function () {
    var parts = [];
    if (window.state.p) parts.push('p=' + encodeURIComponent(window.state.p));
    if (window.state.q) parts.push('q=' + encodeURIComponent(window.state.q));
    for (var i = 0; i < window.FACETS.length; i++) {
      var f = window.FACETS[i];
      if (window.MULTI_FACETS.indexOf(f) !== -1) {
        if (window.state[f].length) parts.push(f + '=' + encodeURIComponent(window.state[f].join(',')));
      } else if (window.state[f]) {
        parts.push(f + '=' + encodeURIComponent(window.state[f]));
      }
    }
    if (window.state.n) parts.push('n=' + encodeURIComponent(window.state.n));
    if (window.state.e) parts.push('e=1');
    if (window.state.img) parts.push('img=1');
    if (window.state.sort && window.state.sort !== 'default') parts.push('sort=' + encodeURIComponent(window.state.sort));
    var newHash = parts.length ? '#' + parts.join('&') : '';
    if (location.hash !== newHash) {
      window.lastSyncedHash = newHash;
      try {
        history.replaceState(null, '', newHash || location.pathname + location.search);
      } catch (err) {
        location.hash = newHash;
      }
    }
  };
  window.readURL = function () {
    var raw = location.hash.replace(/^#/, '');
    var params = new URLSearchParams(raw);
    ['q', 'db', 'y', 'k', 'ty', 'n', 'p', 'sort'].forEach(function (k) {
      window.state[k] = params.has(k) ? params.get(k) : (k === 'sort' ? 'default' : '');
    });
    window.MULTI_FACETS.forEach(function (f) {
      window.state[f] = (params.get(f) || '').split(',').filter(function (v, i, a) { return v && a.indexOf(v) === i; });
    });
    window.state.e = params.get('e') === '1';
    window.state.img = params.get('img') === '1';
    window.writeControls();
  };
  window.writeControls = function () {
    if (window.$('q')) window.$('q').value = window.state.q;
    Object.keys(window.FACET_ID || {}).forEach(function (facet) {
      var sel = window.$(window.FACET_ID[facet]);
      if (sel && window.state[facet] !== undefined) sel.value = window.state[facet] || '';
    });
    if (window.$('fN')) window.$('fN').value = window.state.n;
    if (window.$('fSort')) window.$('fSort').value = window.state.sort;
    if (window.$('fE')) window.$('fE').checked = window.state.e;
    if (window.$('fImg')) window.$('fImg').checked = window.state.img;
    if (window.syncDropdowns) window.syncDropdowns();
  };
  window.reset = function () {
    Object.keys(window.state).forEach(function (k) {
      if (k === 'answers' || k[0] === '_') return;
      window.state[k] = (k === 'e' || k === 'img') ? false : (k === 'sort' ? 'default' : (window.MULTI_FACETS.indexOf(k) !== -1 ? [] : ''));
    });
    window.writeControls();
    window.refreshSelects(null);
    window.recompute();
  };
  window.applyAnswers = function () {
    document.body.dataset.answers = window.state.answers ? 'on' : 'off';
    var btn = window.$('answersBtn');
    if (btn) {
      btn.setAttribute('aria-pressed', String(window.state.answers));
      btn.textContent = window.state.answers ? 'উত্তর লুকান' : 'উত্তর দেখান';
    }
  };
  window.scrollToQuestion = function () {
    if (!window.state.p) return;
    var target = document.getElementById('q-' + window.state.p) || window.$('list').querySelector('[data-pk="' + window.state.p + '"]');
    if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
})();
