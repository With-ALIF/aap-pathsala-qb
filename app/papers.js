(function () {
  'use strict';
  // saved papers: the selected question ids + every PDF setting, kept in
  // localStorage so they survive reloads on this browser
  var KEY = 'qb_saved_papers_v1';
  var MAX = 60;
  var MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

  function readAll() {
    try {
      var arr = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function writeAll(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
    catch (e) { return false; }
  }
  function findPaper(id) {
    var list = readAll();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function fmtDate(ts) {
    var d = ts ? new Date(Number(ts)) : new Date();
    if (isNaN(d.getTime())) return '';
    return window.bnNum(d.getDate()) + ' ' + MONTHS[d.getMonth()] + ' ' + window.bnNum(d.getFullYear());
  }
  function defaultName(count) {
    var d = new Date();
    return 'পরীক্ষাপত্র ' + window.bnNum(count) + 'টি প্রশ্ন — ' +
      window.bnNum(d.getDate()) + ' ' + MONTHS[d.getMonth()] + ' ' + window.bnNum(d.getFullYear());
  }
  function compactRows(rows) {
    return rows.map(function (r) {
      var sh = r._sh != null ? r._sh : r.__shard;
      return { p: r.p, sh: sh, ty: r.ty, s: r.s };
    });
  }
  function rowsOf(entry) {
    var saved = entry && entry.rows ? entry.rows : [];
    var out = [];
    for (var i = 0; i < saved.length; i++) {
      var r = saved[i];
      if (!r || r.p == null) continue;
      var sh = r.sh != null ? r.sh : (r._sh != null ? r._sh : r.__shard);
      out.push({ p: r.p, __shard: sh, _sh: sh, ty: r.ty, s: r.s });
    }
    return out;
  }
  function normalizeMeta(m) {
    m = m || {};
    return {
      title: m.title || 'নির্বাচিত প্রশ্নের পরীক্ষাপত্র',
      tutor: m.tutor || '',
      subject: m.subject || '',
      minutes: Number(m.minutes) || 0,
      marks: m.marks || '',
      sets: m.sets === 4 ? 4 : 1,
      seed: Number(m.seed) || 1,
      qSize: Number(m.qSize) > 0 ? Number(m.qSize) : 11,
      hSize: Number(m.hSize) > 0 ? Number(m.hSize) : 24,
      watermark: m.watermark || '',
      wmOpacity: Number(m.wmOpacity) > 0 ? Number(m.wmOpacity) : 0.1,
      footerL: m.footerL || '',
      footerR: m.footerR || '',
      answers: m.answers !== false
    };
  }
  function pickMeta(m) {
    m = m || {};
    return {
      title: m.title || '',
      tutor: m.tutor || '',
      subject: m.subject || '',
      minutes: Number(m.minutes) || 0,
      marks: m.marks || '',
      sets: m.sets === 4 ? 4 : 1,
      seed: Number(m.seed) || 1,
      qSize: Number(m.qSize) > 0 ? Number(m.qSize) : 11,
      hSize: Number(m.hSize) > 0 ? Number(m.hSize) : 24,
      watermark: m.watermark || '',
      wmOpacity: Number(m.wmOpacity) > 0 ? Number(m.wmOpacity) : 0.1,
      footerL: m.footerL || '',
      footerR: m.footerR || '',
      answers: m.answers !== false
    };
  }

  window.updatePapersCount = function () {
    var n = readAll().length;
    ['papersCount', 'pdfPapersCount'].forEach(function (id) {
      var el = window.$(id);
      if (!el) return;
      el.textContent = window.bnNum(n);
      if (n) el.removeAttribute('hidden');
      else el.setAttribute('hidden', '');
    });
  };

  // ---------------- save current selection + settings ----------------
  window.saveCurrentPaper = function () {
    var rows = window.selRecs();
    if (!rows.length) {
      window.flashNote('আগে অন্তত একটি প্রশ্ন নির্বাচন করুন');
      return;
    }
    var meta = window.readPdfMeta(rows);
    if (!meta) return;
    window.__paperDraft = { rows: rows.slice(), meta: meta };
    var nameEl = window.$('paperSaveName');
    var auto = (meta.title && meta.title !== 'নির্বাচিত প্রশ্নের পরীক্ষাপত্র')
      ? meta.title : defaultName(rows.length);
    nameEl.value = auto;
    window.$('paperSaveNote').textContent = '';
    window.$('paperSaveInfo').textContent =
      window.bnNum(rows.length) + 'টি প্রশ্ন · ' +
      (meta.answers !== false ? 'উত্তরসহ' : 'উত্তর ছাড়া') +
      (meta.sets === 4 ? ' · ৪টি সেট' : '') +
      (meta.marks ? ' · পূর্ণমান ' + meta.marks : '') +
      (meta.minutes ? ' · সময় ' + window.durationLabel(meta.minutes) : '');
    window.$('paperSaveModal').hidden = false;
    try { nameEl.focus(); nameEl.select(); } catch (e) {}
  };
  window.closePaperSave = function () {
    window.$('paperSaveModal').hidden = true;
    window.__paperDraft = null;
  };
  window.confirmSavePaper = function () {
    var draft = window.__paperDraft;
    if (!draft) return;
    var nameEl = window.$('paperSaveName');
    var name = String(nameEl.value || '').trim() || defaultName(draft.rows.length);
    var list = readAll();
    var at = Date.now();
    var entry = {
      id: 'p' + at + '_' + Math.random().toString(36).slice(2, 7),
      name: name,
      savedAt: at,
      count: draft.rows.length,
      rows: compactRows(draft.rows),
      meta: pickMeta(draft.meta)
    };
    var existing = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].name === name) { existing = i; break; }
    }
    var wasUpdate = existing >= 0;
    if (wasUpdate) {
      entry.id = list[existing].id;
      list[existing] = entry;
    } else {
      list.push(entry);
    }    if (list.length > MAX) list = list.slice(list.length - MAX);
    if (!writeAll(list)) {
      window.$('paperSaveNote').textContent =
        'সেভ করা যায়নি — এই ব্রাউজারের স্টোরেজ পূর্ণ। কিছু পুরোনো সেভ করা প্রশ্ন মুছে আবার চেষ্টা করুন।';
      return;
    }
    window.savePdfOpts();
    window.closePaperSave();
    window.updatePapersCount();
    window.flashNote(wasUpdate
      ? 'প্রশ্ন আপডেট হয়েছে — উপরের “সেভ প্রশ্ন সমূহ” বোতাম থেকে আবার খুলুন'
      : 'প্রশ্ন সেভ হয়েছে — উপরের “সেভ প্রশ্ন সমূহ” বোতাম থেকে আবার খুলুন');
  };

  // ---------------- saved papers list ----------------
  window.openPapers = function () {
    window.renderPapers();
    window.$('papersModal').hidden = false;
    var btn = window.$('papersClose');
    try { if (btn) btn.focus(); } catch (e) {}
  };
  window.closePapers = function () {
    window.$('papersModal').hidden = true;
  };
  window.renderPapers = function () {
    var box = window.$('savedList');
    if (!box) return;
    box.innerHTML = '';
    var list = readAll().slice().sort(function (a, b) {
      return (Number(b.savedAt) || 0) - (Number(a.savedAt) || 0);
    });
    if (!list.length) {
      var empty = window.el('div', 'saved-empty');
      empty.appendChild(window.el('p', null, 'এখনো কোনো প্রশ্ন সেভ করা হয়নি।'));
      empty.appendChild(window.el('p', null, 'প্রশ্ন সিলেক্ট করে PDF মডালে “প্রশ্ন সেভ করুন” চাপুন।'));
      box.appendChild(empty);
      return;
    }
    list.forEach(function (p) {
      var card = window.el('div', 'saved-card');
      var main = window.el('div', 'saved-main');
      main.appendChild(window.el('div', 'saved-name', p.name || 'নামহীন'));
      var m = p.meta || {};
      var n = Number(p.count) || (p.rows ? p.rows.length : 0);
      var bits = [window.bnNum(n) + 'টি প্রশ্ন'];
      bits.push(m.answers === false ? 'উত্তর ছাড়া' : 'উত্তরসহ');
      if (m.sets === 4) bits.push('৪টি সেট');
      if (m.marks) bits.push('পূর্ণমান ' + m.marks);
      bits.push(fmtDate(p.savedAt));
      main.appendChild(window.el('div', 'saved-meta', bits.join(' · ')));
      card.appendChild(main);

      var act = window.el('div', 'saved-actions');
      var pdfBtn = window.el('button', 'icon-btn primary', 'PDF');
      pdfBtn.type = 'button';
      pdfBtn.title = 'এই সেটিংসেই আবার PDF নামান';
      pdfBtn.addEventListener('click', function () { window.regeneratePaper(p.id); });

      var editBtn = window.el('button', 'icon-btn', 'এডিট');
      editBtn.type = 'button';
      editBtn.title = 'প্রশ্ন সিলেকশন ও সেটিংস লোড করে এডিট করুন';
      editBtn.addEventListener('click', function () { window.editPaper(p.id); });

      var delBtn = window.el('button', 'icon-btn saved-del', 'মুছুন');
      delBtn.type = 'button';
      delBtn.addEventListener('click', function () {
        if (!delBtn.dataset.armed) {
          delBtn.dataset.armed = '1';
          delBtn.classList.add('armed');
          delBtn.textContent = 'নিশ্চিত?';
          setTimeout(function () {
            if (!delBtn.isConnected) return;
            delete delBtn.dataset.armed;
            delBtn.classList.remove('armed');
            delBtn.textContent = 'মুছুন';
          }, 2500);
          return;
        }
        window.deletePaper(p.id);
      });

      act.appendChild(pdfBtn);
      act.appendChild(editBtn);
      act.appendChild(delBtn);
      card.appendChild(act);
      box.appendChild(card);
    });
  };

  // ---------------- actions ----------------
  // a list action replaces whatever PDF/preview dialog is open behind it
  function closePdfOverlays() {
    if (window.$('pdfPreview') && !window.$('pdfPreview').hidden && window.closePdfPreview) window.closePdfPreview();
    if (window.$('pdfSaveModal') && !window.$('pdfSaveModal').hidden && window.closePdfSave) window.closePdfSave();
    if (window.$('pdfModal') && !window.$('pdfModal').hidden) window.closePdf();
  }
  window.regeneratePaper = function (id) {
    var p = findPaper(id);
    if (!p) return;
    var rows = rowsOf(p);
    if (!rows.length) { window.flashNote('এই সেভে কোনো প্রশ্ন নেই'); return; }
    window.closePapers();
    closePdfOverlays();
    window.flashNote('সেভ করা প্রশ্ন থেকে PDF তৈরি হচ্ছে…');
    window.generatePdf(rows, normalizeMeta(p.meta));
  };

  function restoreSelection(rows) {
    // clear the checkboxes of the previous selection (if the list is rendered)
    var old = document.querySelectorAll('#list .qcard.selected');
    for (var i = 0; i < old.length; i++) {
      old[i].classList.remove('selected');
      var chk = old[i].querySelector('.qsel, .q-sel');
      if (chk) chk.checked = false;
    }
    window.selMap = Object.create(null);
    window.selOrder = [];
    rows.forEach(function (r) {
      if (window.selMap[r.p]) return;
      window.selMap[r.p] = r;
      window.selOrder.push(r.p);
    });
    window.saveSel();
    window.updateSelBar();
    rows.forEach(function (r) {
      var node = document.getElementById('q-' + r.p);
      if (!node) return;
      node.classList.add('selected');
      var chk = node.querySelector('.qsel, .q-sel');
      if (chk) chk.checked = true;
    });
  }
  window.editPaper = function (id) {
    var p = findPaper(id);
    if (!p) return;
    var rows = rowsOf(p);
    if (!rows.length) { window.flashNote('এই সেভে কোনো প্রশ্ন নেই'); return; }
    var meta = normalizeMeta(p.meta);
    restoreSelection(rows);
    // push the saved settings back into the PDF form so the next export is
    // identical, then open the selection tab for editing
    window.applyPdfOpts(meta);
    window.savePdfOpts();
    window.updateDurationHint();
    window.updateSizeLabels();
    window.pdfSeedOverride = meta.seed;
    window.closePapers();
    closePdfOverlays();
    window.setTab('sel');
    window.scrollTo({ top: 0, behavior: 'auto' });
    window.flashNote('প্রশ্ন লোড হয়েছে — এডিট করে “PDF নামান” চাপুন');
  };
  window.deletePaper = function (id) {
    var list = readAll().filter(function (p) { return p.id !== id; });
    if (!writeAll(list)) { window.flashNote('মুছতে সমস্যা হয়েছে — আবার চেষ্টা করুন'); return; }
    window.renderPapers();
    window.updatePapersCount();
    window.flashNote('সেভ করা প্রশ্ন মুছে ফেলা হয়েছে');
  };

  window.bindPaperEvents = function () {
    if (window.$('papersBtn')) window.$('papersBtn').addEventListener('click', window.openPapers);
    if (window.$('pdfPapersBtn')) window.$('pdfPapersBtn').addEventListener('click', window.openPapers);
    if (window.$('pdfSavePaper')) window.$('pdfSavePaper').addEventListener('click', window.saveCurrentPaper);
    if (window.$('papersClose')) window.$('papersClose').addEventListener('click', window.closePapers);
    if (window.$('papersModal')) {
      window.$('papersModal').addEventListener('click', function (e) {
        if (e.target === window.$('papersModal')) window.closePapers();
      });
    }
    if (window.$('paperSaveCancel')) window.$('paperSaveCancel').addEventListener('click', window.closePaperSave);
    if (window.$('paperSaveModal')) {
      window.$('paperSaveModal').addEventListener('click', function (e) {
        if (e.target === window.$('paperSaveModal')) window.closePaperSave();
      });
    }
    if (window.$('paperSaveGo')) window.$('paperSaveGo').addEventListener('click', window.confirmSavePaper);
    if (window.$('paperSaveName')) {
      window.$('paperSaveName').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); window.confirmSavePaper(); }
      });
    }
    window.updatePapersCount();
  };
})();
