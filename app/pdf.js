(function () {
  'use strict';
  window.openPdfModal = function () {
    var rows = window.selRecs();
    if (!rows.length) {
      window.flashNote('আগে অন্তত একটি প্রশ্ন নির্বাচন করুন');
      return;
    }
    window.$('pdfNote').textContent = '';
    window.$('pdfCount').value = window.bnNum(rows.length) + 'টি (' + window.num(rows.length) + ')';
    window.$('pdfSubj').value = window.paperSubjects(rows);
    var dEl = window.$('pdfDate');
    if (!dEl.value) dEl.value = window.todayISO();
    var tEl = window.$('pdfTime');
    if (tEl && !tEl.value) tEl.value = window.loadLastDuration();
    window.updateDurationHint();
    window.$('pdfAvail').textContent = 'নির্বাচিত ' + window.num(rows.length) + 'টি প্রশ্ন দিয়ে একটি সম্পূর্ণ পরীক্ষাপত্র তৈরি হবে।';
    window.$('pdfModal').hidden = false;
    window.$('pdfTitleIn').focus();
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
  window.closePdf = function () {
    window.$('pdfModal').hidden = true;
  };
  window.pdfGo = function () {
    var rows = window.selRecs();
    if (!rows.length) return;
    var tEl = window.$('pdfTime');
    var tRaw = tEl ? String(tEl.value || '').trim() : '';
    var mins = window.parseDuration(tRaw);
    if (tRaw && !mins) {
      window.$('pdfNote').textContent = 'সময়টা বোঝা যায়নি — যেমন "৬০ মিনিট", "1 ঘণ্টা", "90 min" লিখুন।';
      if (tEl) tEl.focus();
      return;
    }
    if (mins) window.saveLastDuration(tRaw);
    var meta = {
      title: (window.$('pdfTitleIn') && window.$('pdfTitleIn').value.trim()) || 'নির্বাচিত প্রশ্নের পরীক্ষাপত্র',
      subject: (window.$('pdfSubj') && window.$('pdfSubj').value.trim()) || window.paperSubjects(rows),
      date: window.paperDate(),
      minutes: mins
    };
    window.closePdf();
    window.generatePdf(rows, meta);
  };
  var PDF_OPT = {
    margin: [0, 0, 0, 0],
    image: { type: 'jpeg', quality: 0.95 },
    enableLinks: false,
    html2canvas: {
      scale: 1,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      imageTimeout: 15000
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: [] }
  };
  var PDF_BLANK_INK = 40;
  function pdfFontsSettled() {
    if (!document.fonts || !document.fonts.ready) return Promise.resolve();
    var jobs = [document.fonts.ready];
    ['11px "Hind Siliguri"', '600 11px "Hind Siliguri"', '16px "KaTeX_Main"', 'italic 16px "KaTeX_Math"', '16px "KaTeX_AMS"', '16px "KaTeX_Size1"'].forEach(function (f) {
      try {
        var p = document.fonts.load(f);
        if (p && p.catch) p.catch(function () {});
        jobs.push(p);
      } catch (e) {}
    });
    return Promise.all(jobs);
  }
  // rasterize one .pdf-page on its own (~794x1122px canvas — far below the
  // browser canvas-size limits that blanked the old one-shot render)
  function pdfPageCanvas(pageEl) {
    var w = html2pdf().set(PDF_OPT).from(pageEl);
    return w.to('canvas').then(function () { return w.prop.canvas; });
  }
  // count sampled non-white pixels; -1 when the canvas is tainted
  function pdfCanvasInk(canvas) {
    try {
      var data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      var dark = 0;
      for (var i = 0; i < data.length; i += 64) {
        if (data[i] < 230 || data[i + 1] < 230 || data[i + 2] < 230) dark++;
      }
      return dark;
    } catch (e) {
      return -1;
    }
  }
  function pdfPageChecked(pageEl, idx, total) {
    return pdfPageCanvas(pageEl).then(function (canvas) {
      if (!canvas) throw new Error('পাতা রেন্ডার হয়নি');
      var ink = pdfCanvasInk(canvas);
      if (ink === -1 || ink >= PDF_BLANK_INK) return canvas;
      console.error('[pdf] blank page ' + (idx + 1) + '/' + total + ', retrying (' + canvas.width + 'x' + canvas.height + ' ink=' + ink + ')');
      return pdfPageCanvas(pageEl).then(function (canvas2) {
        var ink2 = canvas2 ? pdfCanvasInk(canvas2) : -1;
        if (!canvas2 || (ink2 !== -1 && ink2 < PDF_BLANK_INK)) {
          var err = new Error('পাতা ' + window.num(idx + 1) + ' রেন্ডার হয়নি');
          err.pdfPage = idx + 1;
          throw err;
        }
        return canvas2;
      });
    });
  }
  // top-aligned pad/crop to the A4 ratio so each page maps 1:1 onto a sheet
  function pdfFitCanvas(src) {
    var w = src.width;
    var h = Math.floor(w * 297 / 210);
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
    var master = null;
    var chain = Promise.resolve();
    Array.prototype.forEach.call(pages, function (pageEl, i) {
      chain = chain.then(function () {
        window.setSelBusy(true, 'পেজ ' + window.num(i + 1) + '/' + window.num(pages.length) + ' রেন্ডার…');
        return pdfPageChecked(pageEl, i, pages.length).then(function (canvas) {
          var fitted = pdfFitCanvas(canvas);
          if (!master) {
            // first page goes through the worker so the jsPDF doc is built
            // exactly as before; its canvas is one A4 slice (1:1, no tail page)
            var w0 = html2pdf().set(PDF_OPT).from(fitted);
            return w0.to('pdf').then(function () { master = w0.prop.pdf; });
          }
          master.addPage();
          master.addImage(fitted.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 297);
        });
      });
    });
    return chain.then(function () {
      if (!master) throw new Error('PDF তৈরি হয়নি');
      return master.output('blob');
    });
  }
  window.generatePdf = function (rows, meta) {
    if (!rows || !rows.length) {
      window.flashNote('আগে অন্তত একটি প্রশ্ন নির্বাচন করুন');
      return;
    }
    var needed = window.pendingFor(rows);
    window.setSelBusy(true, 'শার্ড লোড হচ্ছে…');
    window.flashNote('পরীক্ষাপত্রের জন্য শার্ড লোড হচ্ছে…');
    var loadPromise = needed.length ? Promise.all(needed.map(window.loadDat)) : Promise.resolve();
    loadPromise.then(function () {
      window.setSelBusy(true, 'ছবি লোড হচ্ছে…');
      window.flashNote('পরীক্ষাপত্র প্রস্তুত হচ্ছে…');
      var container = window.$('paper');
      if (!container) return;
      container.innerHTML = '';
      // the paper has to be laid out before it is built: pagination measures
      // column heights, and a display:none node measures as zero
      document.body.classList.add('pdf-render');
      var fontPromise = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
      var node = null;                 // shared by every step below
      // buildPaper paginates by measuring, so it must run when fonts and
      // images are already settled — otherwise the pages grow after they
      // have been counted and the tail spills onto near-empty pages.
      var passes = 2, i = 0;
      function buildPass(wait) {
        node = window.buildPaper(rows, meta);
        window.eagerImgs(node);
        return window.imagesReady(node, wait);
      }
      return fontPromise.then(function () {
        return buildPass(2500);
      }).then(function () {
        return (i++ < passes - 1) ? buildPass(1000) : null;
      }).then(function () {
        return new Promise(function (res) { setTimeout(res, 300); });
      }).then(function () {
        // KaTeX fonts start loading while buildPaper renders math — after the
        // first fonts.ready — so wait again or glyphs can paint blank
        return pdfFontsSettled();
      }).then(function () {
        var baseName = meta.title || 'exam-paper';
        var safe = window.sanitizeName(baseName) || 'exam-paper';
        var filename = safe + '-' + rows.length + 'q-' + window.todayISO() + '.pdf';
        window.setSelBusy(true, 'PDF রূপান্তর…');
        window.flashNote('PDF রূপান্তর হচ্ছে…');
        if (typeof html2pdf !== 'function') throw new Error('html2pdf লাইব্রেরি অনুপস্থিত');
        var pages = node.querySelectorAll('.pdf-page');
        if (!pages.length) throw new Error('পাতা তৈরি হয়নি');
        // each .pdf-page is rasterized on its own small canvas and glued into
        // one jsPDF doc — one giant multi-page canvas used to hit the browser
        // canvas-size limit and come back silently white
        return pdfPagesToBlob(pages).then(function (blob) {
          var ok = window.downloadBlob(blob, filename);
          window.flashNote(ok ? 'PDF সরাসরি নামানো হয়েছে' : 'PDF তৈরি হয়েছে, ডাউনলোড শুরু হয়নি');
        });
      });
    }).catch(function (err) {
      console.error('[pdf] generate failed', err);
      window.flashNote('সরাসরি PDF না নামলে প্রিন্ট ডায়ালগ খোলা হচ্ছে: ' + (err && err.message ? err.message : err));
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
      // an html2canvas failure can leave its invisible overlay behind, which
      // would swallow every click on the page
      var stray = document.querySelectorAll('.html2pdf__overlay');
      for (var si = 0; si < stray.length; si++) {
        if (stray[si].parentNode) stray[si].parentNode.removeChild(stray[si]);
      }
    });
  };
})();
