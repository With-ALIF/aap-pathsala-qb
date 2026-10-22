(function () {
  'use strict';
  window.updateStatus = function () {
    var total = window.FLAT.length;
    var brandSub = window.$('brandSub');
    if (brandSub) brandSub.textContent = window.num(total) + 'টি প্রশ্ন';
    var countEl = window.$('count');
    if (countEl) {
      countEl.textContent = window.results.length === window.M.total
        ? window.num(window.M.total) + 'টি প্রশ্ন'
        : window.num(window.results.length) + ' / ' + window.num(window.M.total) + 'টি প্রশ্ন';
    }
    var shownNote = window.$('shownNote');
    if (shownNote) shownNote.textContent = window.noteText();
    var chips = window.$('chips');
    if (!chips) return;
    chips.innerHTML = '';
    var labels = { ty: 'ধরন', db: 'ডেটাবেস', un: 'বিশ্ববিদ্যালয়', y: 'সাল', s: 'বিষয়', c: 'অধ্যায়', k: 'টপিক', n: 'অপশন', p: 'প্রশ্ন', e: 'ব্যাখ্যা', img: 'ছবি' };
    Object.keys(labels).forEach(function (key) {
      if (window.MULTI_FACETS.indexOf(key) !== -1) {
        (window.state[key] || []).forEach(function (v) {
          window.addChip(key, v, v === window.NONE ? '(নির্দিষ্ট নয়)' : window.labelFor(key, v), v);
        });
        return;
      }
      var v = window.state[key];
      if (!v) return;
      var shown_v = v === true ? 'হ্যাঁ' : (v === window.NONE ? '(নির্দিষ্ট নয়)' : (key === 'p' ? '#' + v : (key === 'ty' ? (window.TYPE_LABEL[v] || v) : v)));
      window.addChip(key, v, shown_v, '');
    });
  };
  window.addChip = function (key, val, shown_v, clearVal) {
    var labels = { ty: 'ধরন', db: 'ডেটাবেস', un: 'বিশ্ববিদ্যালয়', y: 'সাল', s: 'বিষয়', c: 'অধ্যায়', k: 'টপিক', n: 'অপশন', p: 'প্রশ্ন', e: 'ব্যাখ্যা', img: 'ছবি' };
    var chip = window.el('span', 'chip');
    chip.appendChild(document.createTextNode((labels[key] || key) + ': ' + shown_v + ' '));
    var x = window.el('button', null, '✕');
    x.type = 'button';
    x.setAttribute('aria-label', (labels[key] || key) + ' ফিল্টার মুছুন');
    x.onclick = function () { window.setFilter(key, clearVal); };
    chip.appendChild(x);
    window.$('chips').appendChild(chip);
  };
  window.setFilter = function (key, val) {
    if (key === 'e' || key === 'img') {
      window.state[key] = val === '' ? false : true;
      var chk = window.$(key === 'e' ? 'fE' : 'fImg');
      if (chk) chk.checked = window.state[key];
    } else if (key === 'p') {
      window.state.p = '';
    } else if (window.MULTI_FACETS.indexOf(key) !== -1) {
      window.state[key] = val === '' ? [] : window.state[key].filter(function (x) { return x !== val; });
      if (key === 'un') { window.state.s = []; window.state.c = []; window.state.k = ''; }
      if (key === 's') { window.state.c = []; window.state.k = ''; }
      if (key === 'c') window.state.k = '';
    } else {
      window.state[key] = val;
      var id = window.FACET_ID[key] || window.CTRL_ID[key];
      if (id && window.$(id)) window.$(id).value = val;
    }
    window.recompute();
  };
})();
