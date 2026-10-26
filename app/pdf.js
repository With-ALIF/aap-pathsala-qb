(function () {
  'use strict';
  // CSV-imported rows are used exactly like selected bank rows for one PDF
  // session. They are kept separate so the bank selection is never modified.
  window.pdfRows = function () {
    return (window.pdfImportRows && window.pdfImportRows.length) ? window.pdfImportRows : window.selRecs();
  };
  window.endPdfImport = function () {
    window.pdfImportRows = null;
    window.pdfImportName = '';
    var qb = window.$('pdfQuickbar');
    if (qb) qb.hidden = false;
    var badge = window.$('pdfSourceBadge');
    if (badge) badge.hidden = true;
  };
  window.openPdfModal = function () {
    var isImport = !!(window.pdfImportRows && window.pdfImportRows.length);
    var rows = window.pdfRows();
    if (!rows.length) {
      window.flashNote('আগে অন্তত একটি প্রশ্ন নির্বাচন করুন');
      return;
    }
    window.$('pdfNote').textContent = '';
    window.$('pdfNote').className = 'modal-note';
    var opts = window.loadPdfOpts();
    window.applyPdfOpts(opts);
    window.updateSizeLabels();
    window.pdfWmImage = window.loadPdfWmImage();
    window.updateWmImgHint();
    window.pdfSeed = Number(window.pdfSeedOverride) || (Math.floor(Math.random() * 1000000000) + 1);
    window.pdfSeedOverride = 0;
    var tEl = window.$('pdfTime');
    if (tEl && !tEl.value) tEl.value = window.loadLastDuration();
    window.updateDurationHint();
    if (isImport) {
      window.$('pdfAvail').textContent = 'CSV থেকে ' + window.bnNum(rows.length) + 'টি প্রশ্ন' +
        (window.pdfImportName ? ' — ' + window.pdfImportName : '') +
        '। এগুলো শুধু এই PDF-এর জন্য ব্যবহৃত হবে।';
    } else {
      window.$('pdfAvail').textContent = 'নির্বাচিত ' + window.bnNum(rows.length) + 'টি প্রশ্ন দিয়ে একটি সম্পূর্ণ পরীক্ষাপত্র তৈরি হবে।';
    }
    var quickbar = window.$('pdfQuickbar');
    if (quickbar) quickbar.hidden = isImport;
    var sourceBadge = window.$('pdfSourceBadge');
    if (sourceBadge) sourceBadge.hidden = !isImport;
    window.$('pdfModal').hidden = false;
    window.$('pdfTitleIn').focus();
  };
  window.loadPdfOpts = function () {
    try { return JSON.parse(localStorage.getItem('qb_pdf_opts') || '{}') || {}; } catch (e) { return {}; }
  };
  window.applyPdfOpts = function (o) {
    o = o || {};
    function setTxt(id, v) {
      var el = window.$(id);
      if (el && v != null) el.value = String(v);
    }
    setTxt('pdfTitleIn', o.title);
    setTxt('pdfTutor', o.tutor);
    setTxt('pdfSubj', o.subject);
    setTxt('pdfMarks', o.marks);
    setTxt('pdfWm', o.watermark);
    setTxt('pdfFootL', o.footerL);
    setTxt('pdfFootR', o.footerR);
    if (o.minutes != null) {
      var tEl = window.$('pdfTime');
      var mins = Number(o.minutes);
      if (tEl) tEl.value = mins > 0 ? window.durationLabel(mins) : '';
    }
    var ans = window.$('pdfAns');
    if (ans) ans.value = o.answers === false ? 'no' : 'yes';
    var setsEl = window.$('pdfSets');
    if (setsEl) setsEl.checked = (o.sets === 4 || o.sets === true);
    var qEl = window.$('pdfQSize');
    if (qEl && Number(o.qSize) > 0) qEl.value = String(o.qSize);
    var hEl = window.$('pdfHSize');
    if (hEl && Number(o.hSize) > 0) hEl.value = String(o.hSize);
    var oEl = window.$('pdfWmOp');
    var trans = Number(o.wmTransparency);
    if (!(trans > 0) && Number(o.wmOpacity) > 0) trans = Math.round((1 - Number(o.wmOpacity)) * 100);
    if (oEl && trans > 0) oEl.value = String(trans);
  };
  window.savePdfOpts = function () {
    function v(id) { var el = window.$(id); return el ? String(el.value || '').trim() : ''; }
    var qEl = window.$('pdfQSize'), hEl = window.$('pdfHSize'), opEl = window.$('pdfWmOp');
    var ansEl = window.$('pdfAns');
    var setsEl = window.$('pdfSets');
    try {
      localStorage.setItem('qb_pdf_opts', JSON.stringify({
        title: v('pdfTitleIn'),
        tutor: v('pdfTutor'),
        subject: v('pdfSubj'),
        marks: v('pdfMarks'),
        sets: !!(setsEl && setsEl.checked),
        qSize: qEl && Number(qEl.value) > 0 ? Number(qEl.value) : 11,
        hSize: hEl && Number(hEl.value) > 0 ? Number(hEl.value) : 24,
        watermark: v('pdfWm'),
        wmTransparency: opEl && Number(opEl.value) > 0 ? Number(opEl.value) : 90,
        footerL: v('pdfFootL'),
        footerR: v('pdfFootR'),
        answers: !(ansEl && ansEl.value === 'no')
      }));
    } catch (e) {}
  };
  window.updateSizeLabels = function () {
    function lbl(outId, valId, suffix) {
      var out = window.$(outId), el = window.$(valId);
      if (out && el) out.textContent = window.bnNum(el.value) + suffix;
    }
    lbl('pdfQSizeOut', 'pdfQSize', 'px');
    lbl('pdfHSizeOut', 'pdfHSize', 'px');
    lbl('pdfWmOpOut', 'pdfWmOp', '%');
  };
  window.readPdfMeta = function (rows) {
    function v(id) { var el = window.$(id); return el ? String(el.value || '').trim() : ''; }
    var tRaw = v('pdfTime');
    var mins = window.parseDuration(tRaw);
    if (tRaw && !mins) {
      window.$('pdfNote').textContent = 'সময়টা বোঝা যায়নি — যেমন "৬০ মিনিট", "1 ঘণ্টা", "90 min" লিখুন।';
      window.$('pdfNote').className = 'modal-note modal-err';
      var tEl = window.$('pdfTime');
      if (tEl) tEl.focus();
      return null;
    }
    if (mins) window.saveLastDuration(tRaw);
    var qEl = window.$('pdfQSize'), hEl = window.$('pdfHSize'), opEl = window.$('pdfWmOp');
    var trans = opEl ? Number(opEl.value) : 90;
    if (!(trans >= 0 && trans <= 100)) trans = 90;
    var wmOp = (100 - trans) / 100;
    if (!(wmOp > 0.01)) wmOp = 0.02;
    var ansEl = window.$('pdfAns');
    var setsEl = window.$('pdfSets');
    return {
      title: v('pdfTitleIn') || (window.pdfImportRows && window.pdfImportRows.length
        ? 'পরীক্ষাপত্র'
        : 'নির্বাচিত প্রশ্নের পরীক্ষাপত্র'),
      tutor: v('pdfTutor'),
      subject: v('pdfSubj'),
      minutes: mins,
      marks: v('pdfMarks'),
      sets: setsEl && setsEl.checked ? 4 : 1,
      seed: window.pdfSeed || 1,
      qSize: qEl && Number(qEl.value) > 0 ? Number(qEl.value) : 11,
      hSize: hEl && Number(hEl.value) > 0 ? Number(hEl.value) : 24,
      watermark: v('pdfWm'),
      wmImage: window.pdfWmImage || '',
      wmOpacity: wmOp,
      footerL: v('pdfFootL'),
      footerR: v('pdfFootR'),
      answers: !(ansEl && ansEl.value === 'no')
    };
  };
  window.updateDurationHint = function () {
    var hint = window.$('pdfTimeHint');
    if (!hint) return;
    var tEl = window.$('pdfTime');
    var raw = tEl ? String(tEl.value || '').trim() : '';
    if (!raw) { hint.textContent = 'খালি রাখলে হেডারে সময় দেখাবে না।'; hint.className = 'modal-sub'; return; }
    var mins = window.parseDuration(raw);
    if (!mins) { hint.textContent = 'বোঝা যায়নি — যেমন "৬০ মিনিট", "1 ঘণ্টা", "90 min" লিখুন।'; hint.className = 'modal-sub modal-err'; return; }
    hint.textContent = 'হেডারে দেখাবে: সময়: ' + window.durationLabel(mins);
    hint.className = 'modal-sub';
  };
  window.loadLastDuration = function () {
    try { return localStorage.getItem('qb_pdf_duration') || ''; } catch (e) { return ''; }
  };
  window.saveLastDuration = function (v) {
    try { if (v) localStorage.setItem('qb_pdf_duration', v); } catch (e) {}
  };
  window.loadPdfWmImage = function () {
    try { return localStorage.getItem('qb_pdf_wmimg') || ''; } catch (e) { return ''; }
  };
  window.savePdfWmImage = function (dataUrl) {
    try {
      if (dataUrl) localStorage.setItem('qb_pdf_wmimg', dataUrl);
      else localStorage.removeItem('qb_pdf_wmimg');
    } catch (e) {}
  };
  window.updateWmImgHint = function () {
    var hint = window.$('pdfWmImgHint');
    if (hint) {
      hint.textContent = window.pdfWmImage
        ? 'ছবিটি সব পাতায় ওয়াটারমার্ক হিসেবে বসবে (টেক্সট ওয়াটারমার্কের বদলে)।'
        : 'ছবি দিলে সব পাতায় ওয়াটারমার্ক হিসেবে বসবে; না দিলে টেক্সট ওয়াটারমার্ক ব্যবহার হবে।';
    }
    var name = window.$('pdfWmImgName');
    if (name) {
      name.textContent = window.pdfWmImage
        ? (window.pdfWmImageName || 'ওয়াটারমার্ক ছবি যুক্ত আছে')
        : 'কোনো ছবি নেই';
    }
    var wrap = window.$('pdfWmImgPrevWrap');
    var prev = window.$('pdfWmImgPrev');
    if (wrap && prev) {
      if (window.pdfWmImage) {
        prev.src = window.pdfWmImage;
        wrap.removeAttribute('hidden');
      } else {
        prev.removeAttribute('src');
        wrap.setAttribute('hidden', '');
      }
    }
    var box = document.querySelector('#pdfModal .pdf-upload');
    if (box) box.classList.toggle('has-img', !!window.pdfWmImage);
    var clear = window.$('pdfWmImgClear');
    if (clear) clear.disabled = !window.pdfWmImage;
  };
  // keepImport is used by the preview flow: the modal closes, but the
  // imported rows stay alive until preview's download/close action.
  window.closePdf = function (keepImport) {
    window.$('pdfModal').hidden = true;
    if (!keepImport) window.endPdfImport();
  };
  window.pdfGo = function () {
    var rows = window.pdfRows();
    if (!rows.length) return;
    var meta = window.readPdfMeta(rows);
    if (!meta) return;
    window.savePdfOpts();
    window.closePdfPreview();
    window.closePdf(true);
    // rows/dat are captured above; the import can now be forgotten
    window.endPdfImport();
    window.generatePdf(rows, meta);
  };
  window.pdfPreview = function () {
    var rows = window.pdfRows();
    if (!rows.length) {
      window.flashNote('আগে অন্তত একটি প্রশ্ন নির্বাচন করুন');
      return;
    }
    var meta = window.readPdfMeta(rows);
    if (!meta) return;
    window.savePdfOpts();
    window.closePdf(true);
    window.buildPdfNode(rows, meta).then(function (node) {
      var scroll = window.$('pdfPrevScroll');
      if (!scroll) return;
      scroll.innerHTML = '';
      scroll.appendChild(node.cloneNode(true));
      var head = window.$('pdfPrevHead');
      if (head) {
        head.textContent = 'প্রিভিউ — ' + (meta.sets === 4 ? '৪টি সেট (A, B, C, D)' : (meta.answers !== false ? 'উত্তরসহ' : 'উত্তর ছাড়া')) +
          ' · ' + window.num(rows.length) + 'টি প্রশ্ন';
      }
      var pv = window.$('pdfPreview');
      if (pv) pv.hidden = false;
      scroll.scrollTop = 0;
      var c = window.$('pdfPrevClose');
      if (c) { try { c.focus(); } catch (e) {} }
      window.flashNote('প্রিভিউ দেখানো হচ্ছে — ভালো লাগলে “PDF নামান” চাপুন');
    }).catch(function (err) {
      console.error('[pdf] preview failed', err);
      window.closePdfPreview();
      window.endPdfImport();
      window.flashNote('প্রিভিউ তৈরি হয়নি — ' + (err && err.message ? err.message : String(err)));
    }).then(function () {
      document.body.classList.remove('pdf-render');
      window.setSelBusy(false);
      var container = window.$('paper');
      if (container) container.innerHTML = '';
    });
  };
  window.closePdfPreview = function () {
    var pv = window.$('pdfPreview');
    if (pv) pv.hidden = true;
    var scroll = window.$('pdfPrevScroll');
    if (scroll) scroll.innerHTML = '';
    window.endPdfImport();
  };
  function pdfRasterScale() {
    var cores = navigator.hardwareConcurrency || 4;
    return cores >= 8 ? 1.5 : 1.25;
  }
  var PDF_OPT = {
    margin: [0, 0, 0, 0],
    image: { type: 'jpeg', quality: 0.82 },
    enableLinks: false,
    html2canvas: {
      scale: pdfRasterScale(),
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: '#ffffff',
      imageTimeout: 8000,
      scrollX: 0,
      scrollY: 0
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: [] }
  };
  var PDF_BLANK_INK = 15;
  function pdfFontsSettled() {
    if (!document.fonts || !document.fonts.ready) return Promise.resolve();
    var jobs = [document.fonts.ready];
    ['11px "SolaimanLipi"', '600 11px "SolaimanLipi"', '700 11px "SolaimanLipi"', '16px "KaTeX_Main"', 'italic 16px "KaTeX_Math"', '16px "KaTeX_AMS"', '16px "KaTeX_Size1"'].forEach(function (f) {
      try {
        var p = document.fonts.load(f);
        if (p && p.catch) p.catch(function () {});
        jobs.push(p);
      } catch (e) {}
    });
    return Promise.all(jobs);
  }
  function pdfPageCanvas(pageEl) {
    return pdfSvgToImg(pageEl).then(function () {
      var w = html2pdf().set(PDF_OPT).from(pageEl);
      return w.to('canvas').then(function () { return w.prop.canvas; });
    });
  }

  function pdfSvgToImg(root) {
    if (!root || !window.XMLSerializer || !document.createElement) return Promise.resolve();
    var svgs = root.querySelectorAll('.katex svg');
    if (!svgs.length) return Promise.resolve();
    var jobs = [];
    for (var i = 0; i < svgs.length; i++) jobs.push(pdfOneSvg(svgs[i]));
    return Promise.all(jobs);
  }
  function pdfOneSvg(svg) {
    return new Promise(function (resolve) {
      var rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return resolve();
      var vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
      var vh = vb.length === 4 && vb[3] ? vb[3] : 0;
      if (!vh) return resolve();
      var ratio = rect.width / rect.height;
      var cropW = vh * ratio;
      var scale = 2;
      var cw = Math.max(1, Math.round(rect.width * scale));
      var ch = Math.max(1, Math.round(rect.height * scale));
      var txt = '<svg xmlns="http://www.w3.org/2000/svg" width="' + cw + '" height="' + ch +
        '" viewBox="0 0 ' + cropW + ' ' + vh + '" preserveAspectRatio="none">' + svg.innerHTML + '</svg>';
      var im = new Image();
      im.onload = function () {
        try {
          var c = document.createElement('canvas');
          c.width = cw;
          c.height = ch;
          var ctx = c.getContext('2d');
          if (!ctx) return resolve();
          ctx.drawImage(im, 0, 0, cw, ch);
          var out = document.createElement('img');
          out.src = c.toDataURL('image/png');
          out.setAttribute('width', String(rect.width));
          out.setAttribute('height', String(rect.height));
          out.style.width = rect.width + 'px';
          out.style.height = rect.height + 'px';
          svg.parentNode.replaceChild(out, svg);
        } catch (e) {}
        resolve();
      };
      im.onerror = function () { resolve(); };
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(txt);
    });
  }
  function pdfCanvasInk(canvas) {
    try {
      var w = 240;
      var h = 340;
      var thumb = document.createElement('canvas');
      thumb.width = w;
      thumb.height = h;
      var tctx = thumb.getContext('2d', { willReadFrequently: true });
      if (!tctx) return -1;
      tctx.fillStyle = '#ffffff';
      tctx.fillRect(0, 0, w, h);
      tctx.drawImage(canvas, 0, 0, w, h);
      var data = tctx.getImageData(0, 0, w, h).data;
      var dark = 0;
      for (var i = 0; i < data.length; i += 4) {
        if (data[i] < 230 || data[i + 1] < 230 || data[i + 2] < 230) dark++;
      }
      return dark;
    } catch (e) {
      return -1;
    }
  }
  function pdfPageChecked(pageEl, idx, total) {
    var attempt = 0;
    function once() {
      attempt++;
      return pdfPageCanvas(pageEl).then(function (canvas) {
        if (!canvas) throw new Error('পাতা রেন্ডার হয়নি');
        var ink = pdfCanvasInk(canvas);
        if (ink === -1 || ink >= PDF_BLANK_INK) return canvas;
        console.error('[pdf] blank page ' + (idx + 1) + '/' + total + ' (attempt ' + attempt + ', ink=' + ink + ')');
        if (attempt < 3) {
          return new Promise(function (res) { setTimeout(res, 150); }).then(once);
        }
        if (pageEl.textContent.trim() || pageEl.querySelector('img, table')) return canvas;
        var err = new Error('পাতা ' + window.num(idx + 1) + ' রেন্ডার হয়নি');
        err.pdfPage = idx + 1;
        throw err;
      });
    }
    return once();
  }
  function pdfFitCanvas(src) {
    var w = src.width;
    var h = Math.floor(w * 297 / 210);
    if (src.height === h) return src;
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(src, 0, 0);
    return c;
  }
  function pdfPagesToBlob(pages) {
    var list = Array.prototype.slice.call(pages);
    if (!list.length) throw new Error('PDF তৈরি হয়নি');
    var total = list.length;
    window.setSelBusy(true, 'পেজ ' + window.num(1) + '/' + window.num(total) + ' রেন্ডার…');
    return pdfPageChecked(list[0], 0, total).then(function (canvas0) {
      var fitted0 = pdfFitCanvas(canvas0);
      var w0 = html2pdf().set(PDF_OPT).from(fitted0);
      return w0.to('pdf').then(function () { return w0.prop.pdf; });
    }).then(function (master) {
      var rest = list.slice(1);
      var jpegs = new Array(rest.length);
      var lanes = (navigator.hardwareConcurrency || 4) >= 8 ? 2 : 1;
      var cursor = 0;
      var done = 1;
      function worker() {
        if (cursor >= rest.length) return Promise.resolve();
        var i = cursor++;
        return pdfPageChecked(rest[i], i + 1, total).then(function (canvas) {
          var fitted = pdfFitCanvas(canvas);
          jpegs[i] = fitted.toDataURL('image/jpeg', 0.82);
          done++;
          window.setSelBusy(true, 'পেজ ' + window.num(done) + '/' + window.num(total) + ' রেন্ডার…');
          return worker();
        });
      }
      var jobs = [];
      for (var li = 0; li < Math.min(lanes, rest.length); li++) jobs.push(worker());
      return Promise.all(jobs).then(function () {
        for (var i = 0; i < jpegs.length; i++) {
          master.addPage();
          master.addImage(jpegs[i], 'JPEG', 0, 0, 210, 297);
        }
        return master.output('blob');
      });
    });
  }
  function pdfNeedsManualTap() {
    var ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return true;
    if (/FBAN|FBAV|FB_IAB|Instagram|Line\/|WhatsApp|MicroMessenger|Twitter/i.test(ua)) return true;
    return /Android/i.test(ua) && /\bwv\b/i.test(ua);
  }
  function pdfSizeLabel(bytes) {
    var n = Number(bytes) || 0;
    if (!n) return '';
    if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
    return Math.max(1, Math.round(n / 1024)) + ' KB';
  }
  var saveUrl = '';
  function revokeSaveUrl() {
    var u = saveUrl;
    saveUrl = '';
    if (u) { try { URL.revokeObjectURL(u); } catch (e) {} }
  }
  function scheduleRevoke(url) {
    setTimeout(function () {
      if (saveUrl === url) revokeSaveUrl();
    }, 60000);
  }
  window.closePdfSave = function () {
    var modal = window.$('pdfSaveModal');
    if (modal) modal.hidden = true;
    if (saveUrl) scheduleRevoke(saveUrl);
  };
  window.openPdfSave = function (blob, name) {
    revokeSaveUrl();
    var url = '';
    try { url = URL.createObjectURL(blob); } catch (e) { url = ''; }
    saveUrl = url;
    var modal = window.$('pdfSaveModal');
    var link = window.$('pdfSaveLink');
    var open = window.$('pdfSaveOpen');
    if (window.$('pdfSaveHead')) window.$('pdfSaveHead').textContent = 'PDF তৈরি হয়েছে';
    if (link) {
      link.textContent = 'PDF নামান';
      if (url) { link.href = url; link.removeAttribute('aria-disabled'); }
      else { link.removeAttribute('href'); link.setAttribute('aria-disabled', 'true'); }
      link.setAttribute('download', name);
    }
    if (open) {
      if (url) { open.href = url; open.removeAttribute('aria-disabled'); }
      else { open.removeAttribute('href'); open.setAttribute('aria-disabled', 'true'); }
    }
    if (window.$('pdfSaveName')) {
      window.$('pdfSaveName').textContent = name + (blob && blob.size ? ' · ' + pdfSizeLabel(blob.size) : '');
    }
    if (!modal) {
      var plain = window.downloadBlob(blob, name);
      window.flashNote(plain ? 'PDF সরাসরি নামানো হয়েছে' : 'PDF তৈরি হয়েছে, কিন্তু ডাউনলোড শুরু হয়নি');
      return;
    }
    if (!url) {
      var legacy = window.downloadBlob(blob, name);
      if (window.$('pdfSaveHint')) {
        window.$('pdfSaveHint').textContent = legacy
          ? 'ফাইলটি সেভ হয়েছে।'
          : 'এই ব্রাউজারে সরাসরি PDF সেভ সমর্থিত নয় — Ctrl/Cmd + P চেপে “Save as PDF” বেছে নিন।';
      }
      if (window.$('pdfSaveNote')) window.$('pdfSaveNote').textContent = '';
      modal.hidden = false;
      return;
    }
    var auto = false;
    if (url && !pdfNeedsManualTap()) {
      try { auto = window.downloadBlob(blob, name); } catch (e) { auto = false; }
    }
    if (window.$('pdfSaveHint')) {
      window.$('pdfSaveHint').textContent = auto
        ? 'ডাউনলোড শুরু হয়েছে। ফাইলটি না এলে নিচের বোতামে চাপ দিন।'
        : 'ফাইলটি তৈরি হয়েছে — নিচের বোতামে চাপ দিলেই নামবে। মোবাইলে নতুন ট্যাবে খুলে গেলে Share → Save to Files দিয়ে সেভ করুন।';
    }
    if (window.$('pdfSaveNote')) {
      window.$('pdfSaveNote').textContent = auto
        ? 'ফাইলটি একবার না নামলে “PDF নামান” বোতামে চাপুন।'
        : '';
    }
    modal.hidden = false;
    try { if (link) link.focus(); } catch (e) {}
    window.flashNote(auto ? 'PDF ডাউনলোড শুরু হয়েছে' : 'PDF তৈরি হয়েছে — “PDF নামান” চাপুন');
  };
  window.openPdfError = function (message) {
    revokeSaveUrl();
    var modal = window.$('pdfSaveModal');
    var link = window.$('pdfSaveLink');
    var open = window.$('pdfSaveOpen');
    if (link) {
      link.removeAttribute('href');
      link.setAttribute('aria-disabled', 'true');
      link.textContent = 'PDF নামান';
    }
    if (open) {
      open.removeAttribute('href');
      open.setAttribute('aria-disabled', 'true');
    }
    if (window.$('pdfSaveHead')) window.$('pdfSaveHead').textContent = 'PDF ফাইল তৈরি করা যায়নি';
    if (window.$('pdfSaveHint')) {
      window.$('pdfSaveHint').textContent = 'সরাসরি PDF তৈরি করতে সমস্যা হয়েছে — ' +
        message + '। প্রিন্ট প্রিভিউ থেকে “Save as PDF” বেছে নিলেও ফাইলটি পাওয়া যাবে।';
    }
    if (window.$('pdfSaveName')) window.$('pdfSaveName').textContent = '';
    if (window.$('pdfSaveNote')) window.$('pdfSaveNote').textContent = '';
    if (modal) modal.hidden = false;
    else window.flashNote('PDF তৈরি করা যায়নি: ' + message);
  };
  window.buildPdfNode = function (rows, meta) {
    var needed = window.pendingFor(rows);
    window.setSelBusy(true, 'শার্ড লোড হচ্ছে…');
    window.flashNote('পরীক্ষাপত্রের জন্য শার্ড লোড হচ্ছে…');
    var loadPromise = needed.length ? Promise.all(needed.map(window.loadDat)) : Promise.resolve();
    return loadPromise.then(function () {
      window.setSelBusy(true, 'ছবি লোড হচ্ছে…');
      window.flashNote('পরীক্ষাপত্র প্রস্তুত হচ্ছে…');
      var container = window.$('paper');
      if (!container) throw new Error('প্রিন্ট এলাকা পাওয়া যায়নি');
      container.innerHTML = '';
      document.body.classList.add('pdf-render');
      var fontPromise = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
      var node = null;
      function buildPass(wait) {
        node = window.buildPaper(rows, meta);
        window.eagerImgs(node);
        return window.imagesReady(node, wait);
      }
      return fontPromise.then(function () {
        return buildPass(1500);
      }).then(function () {
        return pdfFontsSettled();
      }).then(function () {
        return buildPass(1000).then(pdfFontsSettled);
      }).then(function () {
        return node;
      });
    });
  };
  window.generatePdf = function (rows, meta) {
    if (!rows || !rows.length) {
      window.flashNote('আগে অন্তত একটি প্রশ্ন নির্বাচন করুন');
      return;
    }
    window.buildPdfNode(rows, meta).then(function (node) {
      var baseName = meta.title || 'exam-paper';
      var safe = window.sanitizeName(baseName) || 'exam-paper';
      var filename = safe + '-' + rows.length + 'q-' + (meta.sets === 4 ? '4sets-' : '') + window.todayISO() + '.pdf';
      window.setSelBusy(true, 'PDF রূপান্তর…');
      window.flashNote('PDF রূপান্তর হচ্ছে…');
      if (typeof html2pdf !== 'function') throw new Error('html2pdf লাইব্রেরি অনুপস্থিত');
      var pages = node.querySelectorAll('.pdf-page');
      if (!pages.length) throw new Error('পাতা তৈরি হয়নি');
      return pdfPagesToBlob(pages).then(function (blob) {
        window.setSelBusy(false);
        window.openPdfSave(blob, filename);
      });
    }).catch(function (err) {
      console.error('[pdf] generate failed', err);
      var reason = err && err.message ? err.message : String(err);
      try { window.openPdfError(reason); } catch (e2) {}
      window.flashNote('সরাসরি PDF তৈরি হয়নি — প্রিন্ট ডায়ালগ খোলা হচ্ছে: ' + reason);
      try {
        var oldT = document.title;
        document.title = (meta.title || 'exam-paper') + '-' + rows.length + 'q';
        document.body.classList.add('printing');
        window.print();
        document.title = oldT;
      } catch (e) {}
    }).then(function () {
      document.body.classList.remove('pdf-render');
      document.body.classList.remove('printing');
      window.setSelBusy(false);
      var container = window.$('paper');
      if (container) container.innerHTML = '';
      var stray = document.querySelectorAll('.html2pdf__overlay');
      for (var si = 0; si < stray.length; si++) {
        if (stray[si].parentNode) stray[si].parentNode.removeChild(stray[si]);
      }
    });
  };
})();
