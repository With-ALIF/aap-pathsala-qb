(function () {
  'use strict';
  window.emptyBlock = function () {
    var d = window.el('div', 'empty');
    d.appendChild(window.el('h2', null, 'কোনো প্রশ্ন মেলেনি'));
    d.appendChild(window.el('p', null, 'ফিল্টার বা সার্চ কিছু বদলে দেখুন।'));
    var b = window.el('button', 'icon-btn', 'সব ফিল্টার মুছুন');
    b.addEventListener('click', window.reset);
    d.appendChild(b);
    return d;
  };
  window.card = function (idx, full, n) {
    var c = window.el('article', 'qcard');
    c.id = 'q-' + idx.p;
    c.dataset.pk = String(idx.p);
    c.dataset.shard = String(idx.__shard);
    var head = window.el('div', 'qhead');
    var isSel = !!window.selMap[idx.p];
    var chk = window.el('input', 'qsel');
    chk.type = 'checkbox';
    chk.checked = isSel;
    chk.title = 'প্রশ্নপত্র বা CSV-এর জন্য নির্বাচন করুন';
    chk.setAttribute('aria-label', 'প্রশ্ন #' + window.num(n) + ' নির্বাচন করুন');
    if (isSel) c.classList.add('selected');
    chk.addEventListener('change', function () { window.toggleSel(idx, chk.checked); });
    head.appendChild(chk);
    head.appendChild(window.el('span', 'qnum', n));
    var meta = window.el('div', 'qmeta');
    if (idx.ty === 'written') meta.appendChild(window.el('span', 'tag tag-w', 'Written'));
    var metaItems = [idx.y && ('সাল ' + idx.y), idx.db, idx.un, idx.s, idx.c, idx.k];
    for (var mi = 0; mi < metaItems.length; mi++) {
      var t = metaItems[mi];
      if (t) meta.appendChild(window.el('span', 'tag', t));
    }
    var link = window.el('button', 'tag pk', '#' + idx.p);
    link.type = 'button';
    link.title = 'এই প্রশ্নের লিংক কপি করুন';
    link.addEventListener('click', function () { window.copyLink(idx.p); });
    meta.appendChild(link);
    head.appendChild(meta);
    c.appendChild(head);
    var body = window.el('div', 'qtext');
    if (full && full.q) {
      body.innerHTML = full.q;
      window.lazyImgs(body);
    } else {
      body.textContent = window.textOf(idx.t || idx.q);
    }
    window.enhanceMath(body);
    c.appendChild(body);
    var ul = window.el('ul', 'opts');
    var opts = (full && full.o) || [];
    if (!opts.length && idx.n) {
      opts = [];
      for (var i = 0; i < idx.n; i++) {
        opts.push({ n: i + 1, t: '', c: i + 1 === idx.a ? 1 : 0 });
      }
    }
    if (idx.ty === 'written' && !window.optsReal(opts)) {
      c.appendChild(window.el('div', 'wnote', '✍ লিখিত উত্তর — নিজে উত্তর লিখুন'));
    } else {
      for (var oi = 0; oi < opts.length; oi++) {
        var o = opts[oi];
        var li = window.el('li', 'opt' + (o.c ? ' correct' : ''));
        li.appendChild(window.el('span', 'key', String.fromCharCode(64 + (o.n || oi + 1))));
        var val = window.el('span', 'val');
        if (o.h) {
          val.innerHTML = o.h;
          window.lazyImgs(val);
        } else {
          val.textContent = o.t || '';
        }
        li.appendChild(val);
        ul.appendChild(li);
      }
      window.enhanceMath(ul);
      c.appendChild(ul);
      var ans = window.el('div', 'answer-note');
      ans.appendChild(window.el('span', null, 'উত্তর:'));
      ans.appendChild(window.el('span', 'badge', idx.a ? String.fromCharCode(64 + idx.a) : '—'));
      c.appendChild(ans);
    }
    if (idx.e && full && (full.e || full.et)) {
      var ex = window.el('div', 'explain');
      ex.appendChild(window.el('h4', null, 'ব্যাখ্যা'));
      var eb = window.el('div');
      if (full.e) {
        eb.innerHTML = full.e;
        window.lazyImgs(eb);
      } else {
        eb.textContent = full.et;
      }
      window.enhanceMath(eb);
      ex.appendChild(eb);
      c.appendChild(ex);
    }
    return c;
  };
  window.copyLink = function (pk) {
    var url = location.href.split('#')[0] + '#p=' + encodeURIComponent(pk);
    var fallback = function () { location.hash = 'p=' + encodeURIComponent(pk); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { window.flashNote('লিংক কপি হয়েছে: ' + url); }, fallback);
    } else {
      fallback();
    }
  };
  window.flashNote = function (msg) {
    var noteEl = window.$('shownNote');
    if (noteEl) noteEl.textContent = msg;
    clearTimeout(window.flashNote.t);
    window.flashNote.t = setTimeout(function () { window.updateStatus(); }, 3000);
  };
})();

