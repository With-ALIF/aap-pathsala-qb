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

  window.setTab = function (tab) {
    window.tab = tab === 'sel' ? 'sel' : 'list';
    var onSel = window.tab === 'sel';
    var list = window.$('list');
    var pane = window.$('selPane');
    if (list) list.hidden = onSel;
    if (pane) pane.hidden = !onSel;
    var tl = window.$('tabList');
    var ts = window.$('tabSel');
    if (tl) {
      tl.classList.toggle('on', !onSel);
      tl.setAttribute('aria-selected', String(!onSel));
    }
    if (ts) {
      ts.classList.toggle('on', onSel);
      ts.setAttribute('aria-selected', String(onSel));
    }
    if (onSel) window.renderSelPane();
  };

  window.renderSelPane = function () {
    var pane = window.$('selPane');
    if (!pane || window.tab !== 'sel') return;
    var recs = window.selRecs();
    pane.innerHTML = '';
    if (!recs.length) {
      pane.appendChild(window.emptyBlock());
      var e = pane.querySelector('.empty p');
      if (e) e.textContent = 'এখনো কোনো প্রশ্ন নির্বাচন করা হয়নি — চেকবক্সে টিক দিলে এখানে দেখা যাবে।';
      return;
    }
    var bar = window.el('div', 'sel-bar');
    bar.appendChild(window.el('span', 'sel-bar-count', window.num(recs.length) + 'টি নির্বাচিত প্রশ্ন — প্রশ্ন, অপশন, উত্তর ও ব্যাখ্যা সহ'));
    var clr = window.el('button', 'icon-btn', 'সব মুছুন');
    clr.type = 'button';
    clr.addEventListener('click', window.clearAllSel);
    bar.appendChild(clr);
    pane.appendChild(bar);

    var needed = window.pendingFor(recs);
    var list = window.el('div', 'sel-list-full');
    var loading = window.el('div', 'sel-loading', 'কনটেন্ট লোড হচ্ছে… (0/' + needed.length + ' শার্ড)');
    list.appendChild(loading);
    pane.appendChild(list);

    var draw = function () {
      loading.remove();
      var frag = document.createDocumentFragment();
      recs.forEach(function (rec, i) {
        var full = window.DATMAP[rec.__shard] && window.DATMAP[rec.__shard][rec.p];
        var c = window.card(rec, full, i + 1);
        c.removeAttribute('id');

        var drop = function () {
          c.remove();
          if (!list.querySelector('.qcard')) {
            list.remove();
            window.renderSelPane();
          } else {
            window.reindexSelPane();
          }
        };

        var chk = c.querySelector('.qsel');
        if (chk) {
          chk.addEventListener('change', function () {
            if (!chk.checked) drop();
          });
        }

        var rm = window.el('button', 'sel-drop', 'সরান');
        rm.type = 'button';
        rm.title = 'এই প্রশ্নটি নির্বাচন থেকে সরান';
        rm.setAttribute('aria-label', 'প্রশ্ন #' + (i + 1) + ' নির্বাচন থেকে সরান');
        rm.addEventListener('click', function () {
          window.toggleSel(rec, false);
          drop();
        });
        var head = c.querySelector('.qhead');
        if (head) head.appendChild(rm);

        frag.appendChild(c);
      });
      window.lazyImgs(frag);
      list.appendChild(frag);
    };

    if (!needed.length) { draw(); return; }
    var done = 0;
    Promise.all(needed.map(window.loadDat)).then(function () {
      loading.textContent = 'কনটেন্ট লোড হচ্ছে… (' + (++done) + '/' + needed.length + ' শার্ড)';
      draw();
    }).catch(function (err) {
      loading.textContent = 'লোড ব্যর্থ: ' + (err && err.message ? err.message : err);
    });
  };

  window.reindexSelPane = function () {
    var pane = window.$('selPane');
    if (!pane) return;
    var cards = pane.querySelectorAll('.sel-list-full .qcard');
    for (var i = 0; i < cards.length; i++) {
      var n = cards[i].querySelector('.qnum');
      if (n) n.textContent = String(i + 1);
    }
  };

  window.openSelTab = function () {
    if (!window.selOrder.length) { window.flashNote('আগে কিছু প্রশ্ন নির্বাচন করুন'); return; }
    window.setTab('sel');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  window.closeSelTab = function () {
    window.setTab('list');
  };

  window.updateSelBar = function () {
    var bar = window.$('selBar');
    var cnt = window.$('tabSelCount');
    var n = window.selOrder.length;
    if (cnt) cnt.textContent = window.num(n);
    if (!bar) return;
    if (!n) {
      bar.hidden = true;
      if (window.tab === 'sel') window.setTab('list');
      return;
    }
    bar.hidden = false;
    window.$('selCount').textContent = window.num(n) + 'টি প্রশ্ন নির্বাচিত';
  };

  window.clearAllSel = function () {
    if (!window.selOrder.length) return;
    var nodes = document.querySelectorAll('#list .qcard.selected, #list .q-card.selected');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.remove('selected');
      var chk = nodes[i].querySelector('.qsel, .q-sel');
      if (chk) chk.checked = false;
    }
    window.selMap = Object.create(null);
    window.selOrder = [];
    window.saveSel();
    window.updateSelBar();
    window.flashNote('সব নির্বাচন মুছে ফেলা হয়েছে');
  };
})();
