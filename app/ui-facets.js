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
    if (window.syncDropdowns) window.syncDropdowns();
  };
  window.buildSelects = function () {
    window.refreshSelects(null);
  };
    window.UN_ALIASES = {
    'DU': ['ঢাকা বিশ্ববিদ্যালয়', 'ঢাকা', 'dhaka', 'du'],
    'BUET': ['বুয়েট', 'বাংলাদেশ প্রকৌশল', 'buet', 'engineering'],
    'RU': ['রাজশাহী বিশ্ববিদ্যালয়', 'রাজশাহী', 'rajshahi', 'ru'],
    'CU': ['চট্টগ্রাম বিশ্ববিদ্যালয়', 'চট্টগ্রাম', 'চট্রগ্রাম', 'chittagong', 'cu'],
    'JU': ['জাহাঙ্গীরনগর বিশ্ববিদ্যালয়', 'জাহাঙ্গীরনগর', 'জাবি', 'jahangirnagar', 'ju'],
    'KU': ['খুলনা বিশ্ববিদ্যালয়', 'খুলনা', 'khulna', 'ku'],
    'RUET': ['রুয়েট', 'ruet'],
    'KUET': ['কুয়েট', 'kuet'],
    'CUET': ['চুয়েট', 'cuet'],
    'SUST': ['শাবিপ্রবি', 'শাহজালাল', 'sust', 'shahjalal'],
    'BUTEX': ['বুটেক্স', 'butex', 'টেক্সটাইল', 'textile'],
    'BUP': ['বিইউপি', 'bup'],
    'JnU': ['জবি', 'জগন্নাথ', 'জগন্নাথ বিশ্ববিদ্যালয়', 'jnu', 'jagannath'],
    'IUT': ['আইইউটি', 'iut'],
    'GST': ['জিএসটি', 'গুচ্ছ', 'gst', 'guccho'],
    'HSTU': ['হাবিপ্রবি', 'হাজী দানেশ', 'hstu'],
    'MBSTU': ['মাভাবিপ্রবি', 'ভাসানী', 'mbstu'],
    'PUST': ['পাবিপ্রবি', 'পাবনা বিজ্ঞান', 'pust'],
    'NSTU': ['নোবিপ্রবি', 'নোয়াখালী বিজ্ঞান', 'nstu'],
    'JUST': ['যবিপ্রবি', 'যশোর বিজ্ঞান', 'just'],
    'CoU': ['কুবি', 'কুমিল্লা বিশ্ববিদ্যালয়', 'cou', 'comilla'],
    'BRAC': ['ব্র্যাক', 'brac'],
    'NSU': ['নর্থ সাউথ', 'nsu'],
    'AIUB': ['আইইউবি', 'aiub'],
    'AUST': ['আহছানউল্লা', 'aust'],
    'AFMC': ['এএফএমসি', 'afmc'],
    'MAT': ['ম্যাটস', 'mat'],
    'DAT': ['ড্যাট', 'dat'],
    'BCS': ['বিসিএস', 'bcs'],
    'Primary': ['প্রাথমিক', 'প্রাইমারি', 'primary'],
    'NTRCA': ['এনটিআরসিএ', 'ntrca'],
    'BAU': ['বাকৃবি', 'কৃষি বিশ্ববিদ্যালয়', 'bau'],
    'SAU': ['শেকৃবি', 'শেরেবাংলা কৃষি', 'sau'],
    'CVASU': ['সিভাসু', 'cvasu'],
    'MIST': ['এমআইএসটি', 'mist'],
    'DCC': ['ঢাকা সিটি কলেজ', 'dcc'],
    'NDC': ['নটর ডেম', 'ndc'],
    'DRMC': ['রেসিডেন্সিয়াল', 'drmc'],
    'VNSC': ['ভিকারুননিসা', 'vnsc'],
    'HCC': ['হলি ক্রস', 'hcc'],
    'MC': ['এমসি কলেজ', 'mc'],
    'Nursing': ['নার্সিং', 'nursing'],
    'Agri': ['কৃষি গুচ্ছ', 'agri', 'agriculture'],
    'CKRUET': ['চুয়েট কুয়েট রুয়েট', 'ckruet'],
    'DU.7Clg': ['৭ কলেজ', 'সাত কলেজ', '7 college', '7clg'],
    'DU.TECH': ['প্রযুক্তি ইউনিট', 'টেকনোলজি', 'tech'],
    'কুমিল্লা বোর্ড': ['comilla board', 'cumilla'],
    'চট্রগ্রাম বোর্ড': ['chittagong board', 'ctg'],
    'ঢাকা বোর্ড': ['dhaka board'],
    'দিনাজপুর বোর্ড': ['dinajpur board'],
    'বরিশাল বোর্ড': ['barisal board'],
    'ময়মনসিংহ বোর্ড': ['mymensingh board'],
    'যশোর বোর্ড': ['jessore board'],
    'রাজশাহী বোর্ড': ['rajshahi board'],
    'সম্মিলিত বোর্ড': ['combined board'],
    'সিলেট বোর্ড': ['sylhet board'],
    'BruR': ['রোকেয়া বিশ্ববিদ্যালয়', 'বেরোবি', 'brur'],
    'IU': ['ইসলামী বিশ্ববিদ্যালয়', 'ইবি', 'iu'],
    'JKKNIU': ['নজরুল বিশ্ববিদ্যালয়', 'জাককানইবি', 'jkkniu'],
    'BSMRSTU': ['বশেমুরবিপ্রবি', 'bsmrstu'],
    'PSTU': ['পটুয়াখালী বিজ্ঞান ও প্রযুক্তি', 'পবিপ্রবি', 'pstu']
  };

  window.filterUnList = function (query) {
    var listEl = window.$('fUnList');
    if (!listEl) return;
    var q = (query || '').trim().toLowerCase();
    var items = Array.prototype.slice.call(listEl.querySelectorAll('.ms-item'));
    if (!items.length) return;

    var matched = [];
    var unmatched = [];

    for (var i = 0; i < items.length; i++) {
      var row = items[i];
      var chk = row.querySelector('input');
      var key = chk ? chk.value : '';
      var valLower = String(key).toLowerCase();
      var label = window.labelFor('un', key).toLowerCase();

      if (!q) {
        row.hidden = false;
        matched.push({ row: row, score: 0, order: i });
        continue;
      }

      var score = 999;
      if (valLower === q || label === q) {
        score = 0;
      } else if (valLower.indexOf(q) === 0 || label.indexOf(q) === 0) {
        score = 10;
      } else if (valLower.indexOf(q) !== -1 || label.indexOf(q) !== -1) {
        score = 20;
      }

      if (score > 0 && window.UN_ALIASES && window.UN_ALIASES[key]) {
        var aliases = window.UN_ALIASES[key];
        for (var a = 0; a < aliases.length; a++) {
          var al = aliases[a].toLowerCase();
          if (al === q) {
            score = Math.min(score, 1);
          } else if (al.indexOf(q) === 0) {
            score = Math.min(score, 11);
          } else if (al.indexOf(q) !== -1) {
            score = Math.min(score, 21);
          }
        }
      }

      if (score < 999) {
        row.hidden = false;
        matched.push({ row: row, score: score, order: i });
      } else {
        row.hidden = true;
        unmatched.push(row);
      }
    }

    if (q) {
      matched.sort(function (a, b) {
        if (a.score !== b.score) return a.score - b.score;
        return a.order - b.order;
      });

      var frag = document.createDocumentFragment();
      for (var m = 0; m < matched.length; m++) frag.appendChild(matched[m].row);
      for (var u = 0; u < unmatched.length; u++) frag.appendChild(unmatched[u]);
      listEl.appendChild(frag);
    }

    var emptyEl = listEl.querySelector('.ms-empty-search');
    if (matched.length === 0) {
      if (!emptyEl) {
        emptyEl = window.el('div', 'ms-empty-search', 'কোনো বিশ্ববিদ্যালয় পাওয়া যায়নি');
        listEl.appendChild(emptyEl);
      }
      emptyEl.hidden = false;
    } else if (emptyEl) {
      emptyEl.hidden = true;
    }
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
    if (btn) {
      if (n === 0) btn.textContent = 'সব';
      else if (n === 1) btn.textContent = window.labelFor(facet, selected[0]);
      else btn.textContent = n + 'টি ' + cfg.label;
    }
    var cnt = window.$(cfg.count);
    if (cnt) cnt.textContent = n ? n + 'টি নির্বাচিত' : '';
  };
  window.toggleMulti = function (facet, key, on) {
    var arr = (window.state[facet] || []).slice();
    var idx = arr.indexOf(key);
    if (on && idx === -1) arr.push(key);
    if (!on && idx !== -1) arr.splice(idx, 1);
    window.state[facet] = arr;
    if (facet === 'un') { window.state.un2 = []; window.state.sh = []; window.state.s = []; window.state.c = []; window.state.k = ''; }
    if (facet === 's') window.state.k = '';
    window.recompute();
  };
  window.clearMulti = function (facet) {
    window.state[facet] = [];
    if (facet === 'un') { window.state.un2 = []; window.state.sh = []; window.state.s = []; window.state.c = []; window.state.k = ''; }
    if (facet === 's') { window.state.c = []; window.state.k = ''; }
    if (facet === 'c') window.state.k = '';
    window.recompute();
  };
})();
