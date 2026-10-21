(function () {
  'use strict';
  var BN_LETTERS = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ'];
  // deterministic shuffle so the on-screen preview and the generated PDF use
  // exactly the same question order for every set
  function seededShuffle(list, seed) {
    var arr = list.slice();
    var t = (Number(seed) || 1) >>> 0;
    function rnd() {
      t = (t + 0x6D2B79F5) >>> 0;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    }
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }
  var MM = 96 / 25.4;
  var PAGE_H = 296 * MM;          // a hair under A4 so the slice lands in the padding
  var PAD_TOP = 8 * MM;
  var PAD_BOTTOM = 15 * MM;       // room for the absolute footer
  var MAX_H = PAGE_H - PAD_TOP - PAD_BOTTOM - 2 * MM;

  window.paperSubjects = function (rows) {
    var seen = {}, list = [];
    for (var i = 0; i < rows.length; i++) {
      var s = rows[i].s;
      if (!s) continue;
      var lbl = window.labelFor('s', s);
      if (!seen[lbl]) { seen[lbl] = true; list.push(lbl); }
    }
    return list.join(', ');
  };

  function fullOf(rec) {
    var sh = rec._sh != null ? rec._sh : rec.__shard;
    return (window.DATMAP[sh] || {})[rec.p] || {};
  }

  // stem line: number + question text. flex keeps the number glued to the
  // first line even when the source HTML wraps its text in <p>/<div> blocks
  function stemNode(rec, i, full, cls) {
    var p = window.el('p', cls || 'pq-q');
    p.appendChild(window.el('span', 'pq-n', window.bnNum(i + 1) + '.'));
    var body = window.el('span', 'pq-body');
    if (full.q) { body.innerHTML = full.q; window.eagerImgs(body); window.sizeImgs(body); }
    else body.textContent = window.textOf(rec.t || rec.q);
    window.enhanceMath(body);
    p.appendChild(body);
    return p;
  }

  function optionBox(opts) {
    var boxO = window.el('div', 'pq-opts');
    opts.forEach(function (o, oi) {
      var letter = BN_LETTERS[oi] || String.fromCharCode(65 + oi);
      var row = window.el('div', 'pq-opt');
      row.appendChild(window.el('span', 'pq-key', letter + ')'));
      var v = window.el('span', 'pq-val');
      if (o.h) { v.innerHTML = o.h; window.eagerImgs(v); window.sizeImgs(v); }
      else v.textContent = o.t || '';
      window.enhanceMath(v);
      row.appendChild(v);
      boxO.appendChild(row);
    });
    return boxO;
  }

  // question page item (no answers inline — they go to the key/solution pages)
  function questionNode(rec, i) {
    var full = fullOf(rec);
    var q = window.el('section', 'pq');
    q.appendChild(stemNode(rec, i, full));
    var opts = full.o || [];
    if (rec.ty !== 'written' && window.optsReal(opts)) q.appendChild(optionBox(opts));
    return q;
  }

  function correctOption(rec, full) {
    var opts = full.o || [];
    var idx = -1;
    opts.forEach(function (o, oi) { if (o && o.c && idx < 0) idx = oi; });
    if (idx < 0 && rec.a) idx = rec.a - 1;
    return { opts: opts, idx: idx };
  }

  // one entry of the separate solution section; returns null when there is
  // nothing to show (no correct option and no explanation)
  function solutionNode(rec, i) {
    var full = fullOf(rec);
    var co = correctOption(rec, full);
    var hasExpl = !!(full.e || full.et);
    if (co.idx < 0 || !co.opts[co.idx]) {
      if (!hasExpl) return null;
    }
    var item = window.el('section', 'psol');
    item.appendChild(stemNode(rec, i, full, 'psol-q'));
    if (co.idx >= 0 && co.opts[co.idx]) {
      var ao = co.opts[co.idx];
      var letter = BN_LETTERS[co.idx] || String.fromCharCode(65 + co.idx);
      var ap = window.el('div', 'psol-a');
      ap.appendChild(window.el('b', null, 'সঠিক উত্তর: '));
      ap.appendChild(document.createTextNode('(' + letter + ') '));
      var av = window.el('span');
      if (ao.h) { av.innerHTML = ao.h; window.eagerImgs(av); window.sizeImgs(av); }
      else av.textContent = ao.t || '';
      window.enhanceMath(av);
      ap.appendChild(av);
      item.appendChild(ap);
    }
    if (hasExpl) {
      var ep = window.el('div', 'psol-e');
      ep.appendChild(window.el('b', null, 'ব্যাখ্যা: '));
      if (full.e) {
        var ev = window.el('span');
        ev.innerHTML = full.e;
        window.eagerImgs(ev);
        window.sizeImgs(ev);
        window.enhanceMath(ev);
        ep.appendChild(ev);
      } else {
        ep.appendChild(document.createTextNode(full.et));
      }
      item.appendChild(ep);
    }
    return item;
  }

  window.buildPaper = function (rows, meta) {
    meta = meta || {};
    var withAns = meta.answers !== false;
    var qSize = Number(meta.qSize) > 0 ? Number(meta.qSize) : 11;
    var hSize = Number(meta.hSize) > 0 ? Number(meta.hSize) : 24;
    var wmText = String(meta.watermark || '').trim();
    var wmImg = String(meta.wmImage || '');
    var wmOp = Number(meta.wmOpacity);
    if (!(wmOp > 0)) wmOp = 0.1;
    var footL = String(meta.footerL || '').trim();
    var footR = String(meta.footerR || '').trim();
    var box = window.$('paper');
    if (box) box.innerHTML = '';
    var doc = window.el('div', 'paper-doc');
    doc.style.fontSize = qSize + 'px';
    // attach straight away: pagination measures real heights, and a detached
    // tree reports offsetHeight/scrollHeight of 0
    if (box) box.appendChild(doc);

    // ---------------- shared page helpers ----------------
    function newPage(topNode) {
      var page = window.el('div', 'pdf-page');
      page.style.fontSize = qSize + 'px';
      if (wmImg || wmText) {
        // watermark first so the columns (z-index:1) paint above it
        var wm = window.el('div', wmImg ? 'pdf-wm pdf-wm-img' : 'pdf-wm', wmImg ? '' : wmText);
        if (wmImg) wm.style.backgroundImage = 'url("' + wmImg + '")';
        wm.style.opacity = String(wmOp);
        page.appendChild(wm);
      }
      if (topNode) page.appendChild(topNode);
      var cols = window.el('div', 'pdf-cols');
      var left = window.el('div', 'pdf-col');
      var right = window.el('div', 'pdf-col');
      cols.appendChild(left);
      cols.appendChild(right);
      page.appendChild(cols);
      var foot = window.el('footer', 'paper-foot');
      foot.appendChild(window.el('span', 'paper-foot-l', footL));
      foot.appendChild(window.el('span', 'paper-foot-r', footR));
      page.appendChild(foot);
      doc.appendChild(page);
      return { page: page, left: left, right: right };
    }

    // measure nodes inside a real 91mm column, then remove them again
    function measure(nodes) {
      var probe = window.el('div', 'pdf-col');
      probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:91mm;';
      doc.appendChild(probe);
      var out = nodes.map(function (node) {
        probe.appendChild(node);
        var h = node.offsetHeight + 6; // section margin-bottom
        probe.removeChild(node);
        return { node: node, h: h };
      });
      doc.removeChild(probe);
      return out;
    }

    // fill each page as much as possible, then split its two columns as
    // evenly as the heights allow (reading order stays top-down)
    function paginate(items, firstMaxH) {
      var pages = [], idx = 0, n = items.length;
      while (idx < n) {
        var maxH = idx === 0 ? firstMaxH : MAX_H;
        var cum = [0];
        for (var j = idx; j < n; j++) cum.push(cum[cum.length - 1] + items[j].h);
        var bestEnd = idx + 1, bestSplit = idx + 1;
        for (var e = idx + 1; e <= n; e++) {
          var bestDiff = Infinity, found = -1;
          for (var k = idx; k <= e; k++) {
            var hL = cum[k - idx];
            var hR = cum[e - idx] - hL;
            if (hL <= maxH && hR <= maxH) {
              var diff = Math.abs(hL - hR);
              if (diff < bestDiff) { bestDiff = diff; found = k; }
            }
          }
          if (found >= 0) { bestEnd = e; bestSplit = found; }
        }
        pages.push({ from: idx, to: bestEnd, split: bestSplit });
        idx = bestEnd;
      }
      return pages;
    }

    function renderPages(pages, items, topNode, firstMaxNote) {
      if (!pages.length) { newPage(topNode); return; }
      pages.forEach(function (p, pi) {
        var cur = newPage(pi === 0 ? topNode : null);
        for (var j = p.from; j < p.to; j++) {
          (j < p.split ? cur.left : cur.right).appendChild(items[j].node);
        }
      });
    }

    function sectionHead(title) {
      var wrap = window.el('header', 'paper-head pq-sechead');
      var h = window.el('h2', null, title);
      h.style.fontSize = Math.max(14, Math.round(hSize * 0.8)) + 'px';
      wrap.appendChild(h);
      wrap.appendChild(window.el('div', 'head-rule'));
      return wrap;
    }

    function measureTop(node) {
      var probePage = window.el('div', 'pdf-page');
      probePage.style.cssText = 'position:absolute;left:-9999px;top:0;font-size:' + qSize + 'px;';
      probePage.appendChild(node);
      doc.appendChild(probePage);
      var h = node.offsetHeight;
      probePage.removeChild(node);
      doc.removeChild(probePage);
      return h;
    }

    // ---------------- header builder (per set) ----------------
    function makeHead(setLabel) {
      if (!(meta.title || meta.tutor || meta.subject || meta.marks || setLabel || meta.minutes)) return null;
      var head = window.el('header', 'paper-head');
      var h1 = window.el('h1', null, meta.title || 'নির্বাচিত প্রশ্নের পরীক্ষাপত্র');
      h1.style.fontSize = hSize + 'px';
      head.appendChild(h1);
      // tutor name sits right under the (bigger) exam name, in a much smaller face
      if (meta.tutor) {
        var tutor = window.el('p', 'paper-tutor', meta.tutor);
        tutor.style.fontSize = Math.max(10, Math.min(14, Math.round(hSize * 0.5))) + 'px';
        head.appendChild(tutor);
      }
      // subtitle/title line: kept even when empty so the header spacing stays
      // the same (an empty line shows as blank, per the requested behaviour)
      head.appendChild(window.el('p', 'paper-sub', meta.subject || ''));
      head.appendChild(window.el('div', 'head-rule'));
      var row = window.el('div', 'paper-meta-row');
      var dur = window.durationLabel(meta.minutes);
      row.appendChild(window.el('span', null, meta.marks ? 'পূর্ণমান: ' + meta.marks : ''));
      row.appendChild(window.el('span', null, setLabel ? 'সেট: ' + setLabel : ''));
      row.appendChild(window.el('span', null, dur ? 'সময়: ' + dur : ''));
      head.appendChild(row);
      head.appendChild(window.el('div', 'head-rule'));
      return head;
    }

    // ---------------- question pages (one block per set) ----------------
    var sets = meta.sets === 4 ? 4 : 1;
    var labels = ['A', 'B', 'C', 'D'];
    var seed = Number(meta.seed) || 1;
    var setOrders = [];
    for (var s = 0; s < sets; s++) {
      var order = sets > 1 ? seededShuffle(rows, seed + s * 7919) : rows;
      setOrders.push(order);
      var headNode = makeHead(sets > 1 ? labels[s] : '');
      var headH = headNode ? measureTop(headNode) : 0;
      var qItems = measure(order.map(function (rec, i) { return questionNode(rec, i); }));
      var qPages = paginate(qItems, Math.max(120, MAX_H - headH));
      renderPages(qPages, qItems, headNode);
    }

    if (withAns) {
      // ---------------- answer keys ----------------
      function keyFor(order) {
        var key = [];
        order.forEach(function (rec, i) {
          var full = fullOf(rec);
          if (rec.ty === 'written' || !window.optsReal(full.o || [])) return;
          var co = correctOption(rec, full);
          if (co.idx < 0) return;
          var letter = BN_LETTERS[co.idx] || String.fromCharCode(65 + co.idx);
          key.push(window.bnNum(i + 1) + '–' + letter);
        });
        return key;
      }
      function keyTable(key, compact) {
        var table = window.el('table', 'pq-keytable' + (compact ? ' pq-keytable-compact' : ''));
        var PER_ROW = compact ? 12 : 10, ktr = null;
        key.forEach(function (cell, i) {
          if (i % PER_ROW === 0) { ktr = window.el('tr'); table.appendChild(ktr); }
          ktr.appendChild(window.el('td', null, cell));
        });
        return table;
      }
      if (sets > 1) {
        // every set's key on ONE shared page
        var parts = setOrders.map(function (order, si) {
          return { label: labels[si], key: keyFor(order) };
        }).filter(function (part) { return part.key.length; });
        if (parts.length) {
          var kpage = newPage(sectionHead('উত্তর তালিকা — সেট A, B, C, D'));
          var wrapKeys = window.el('div', 'pq-keysets');
          parts.forEach(function (part) {
            wrapKeys.appendChild(window.el('div', 'pq-keyset-label', 'সেট ' + part.label));
            wrapKeys.appendChild(keyTable(part.key, true));
          });
          kpage.page.insertBefore(wrapKeys, kpage.page.querySelector('.pdf-cols'));
        }
      } else {
        var key = keyFor(setOrders[0]);
        if (key.length) {
          var kpage1 = newPage(sectionHead('উত্তর তালিকা'));
          kpage1.page.insertBefore(keyTable(key, false), kpage1.page.querySelector('.pdf-cols'));
        }
      }

      // ---------------- solutions for the first set only ----------------
      var solNodes = [];
      setOrders[0].forEach(function (rec, i) {
        var node = solutionNode(rec, i);
        if (node) solNodes.push(node);
      });
      if (solNodes.length) {
        var solTitle = 'উত্তর ও ব্যাখ্যাসহ সমাধান' + (sets > 1 ? ' — সেট ' + labels[0] : '');
        var solHead = sectionHead(solTitle);
        var solItems = measure(solNodes);
        var solPages = paginate(solItems, Math.max(120, MAX_H - measureTop(solHead)));
        renderPages(solPages, solItems, solHead);
      }
    }

    window.enhanceMath(doc);
    return doc;
  };
})();
