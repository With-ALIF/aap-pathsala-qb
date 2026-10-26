(function () {
  'use strict';
  window.bindActionEvents = function () {
    if (window.$('answersBtn')) {
      window.$('answersBtn').addEventListener('click', function () {
        window.state.answers = !window.state.answers;
        window.applyAnswers();
        try { localStorage.setItem('qb-answers', window.state.answers ? '1' : '0'); } catch (e) {}
      });
    }
    if (window.$('shuffleBtn')) {
      window.$('shuffleBtn').addEventListener('click', function () {
        if (!window.indexReady || !window.results.length) { window.flashNote('আগে ফলাফল লোড হতে দিন'); return; }
        for (var i = window.results.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var t = window.results[i];
          window.results[i] = window.results[j];
          window.results[j] = t;
        }
        window.shown = 0;
        window.$('list').innerHTML = '';
        window.noteOverride = 'এলোমেলো করা হয়েছে — ' + window.num(window.results.length) + 'টি প্রশ্ন';
        window.renderPage(true);
      });
    }
    if (window.$('themeBtn')) {
      window.$('themeBtn').addEventListener('click', function () {
        var n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = n;
        if (window.updateThemeIcon) window.updateThemeIcon();
        try { localStorage.setItem('qb-theme', n); } catch (e) {}
      });
    }
    if (window.$('moreBtn')) {
      window.$('moreBtn').addEventListener('click', function () { window.renderPage(false); });
    }
    var toTop = window.$('toTop');
    var syncToTop = function () {
      if (!toTop) return;
      var on = window.scrollY > 400;
      if (on && toTop.hidden) {
        toTop.hidden = false;
        window.requestAnimationFrame(function () { toTop.classList.add('show'); });
      } else if (!on && !toTop.hidden) {
        toTop.classList.remove('show');
        toTop.hidden = true;
      }
    };
    window.addEventListener('scroll', window.debounce(function () {
      syncToTop();
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 800) {
        if (window.shown < window.results.length) window.renderPage(false);
      }
    }, 100));
    syncToTop();
    if (toTop) {
      toTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
    window.addEventListener('hashchange', function () {
      var cur = location.hash.replace(/^#/, '');
      if (cur === window.lastSyncedHash) return;
      window.lastSyncedHash = cur;
      window.readURL();
      window.writeControls();
      window.recompute();
      window.scrollToQuestion();
    });
    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase();
      var inInput = tag === 'input' || tag === 'select' || tag === 'textarea';
      if (e.key === 'a' && !inInput && !e.ctrlKey && !e.metaKey) {
        if (window.$('answersBtn')) window.$('answersBtn').click();
      } else if (e.key === 'Escape') {
        var closed = false;
        window.MULTI_FACETS.forEach(function (facet) {
          var cfg = window.MULTI_ID[facet];
          if (!cfg) return;
          var pop = window.$(cfg.pop);
          if (pop && !pop.hidden) {
            pop.hidden = true;
            var b = window.$(cfg.btn);
            if (b) b.setAttribute('aria-expanded', 'false');
            closed = true;
          }
        });
        if (closed) return;
        if (window.$('csvImportModal') && !window.$('csvImportModal').hidden) window.closeCsvImport();
        else if (window.$('paperSaveModal') && !window.$('paperSaveModal').hidden) window.closePaperSave();
        else if (window.$('papersModal') && !window.$('papersModal').hidden) window.closePapers();
        else if (window.$('pdfSaveModal') && !window.$('pdfSaveModal').hidden) window.closePdfSave();
        else if (window.$('pdfPreview') && !window.$('pdfPreview').hidden) window.closePdfPreview();
        else if (window.$('selExpModal') && !window.$('selExpModal').hidden) window.closeSelExport();
        else if (!window.$('csvModal').hidden) window.closeCSV();
        else if (!window.$('pdfModal').hidden) window.closePdf();
      }
    });
    if (window.$('csvBtn')) window.$('csvBtn').addEventListener('click', window.openCSV);
    if (window.$('csvCancel')) window.$('csvCancel').addEventListener('click', window.closeCSV);
    if (window.$('csvModal')) {
      window.$('csvModal').addEventListener('click', function (e) {
        if (e.target === window.$('csvModal')) window.closeCSV();
      });
    }
    var fmtInputs = document.querySelectorAll('input[name="csvFmt"]');
    for (var i = 0; i < fmtInputs.length; i++) {
      fmtInputs[i].addEventListener('change', function () {
        window.updateFmtHint();
        window.csvNamePlaceholder();
      });
    }
    if (window.$('csvFrom')) {
      window.$('csvFrom').addEventListener('input', window.csvNamePlaceholder);
      window.$('csvFrom').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); window.$('csvTo').focus(); window.$('csvTo').select(); }
      });
    }
    if (window.$('csvTo')) {
      window.$('csvTo').addEventListener('input', window.csvNamePlaceholder);
      window.$('csvTo').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); window.runCSV(window.readFmt()); }
      });
    }
    if (window.$('csvName')) {
      window.$('csvName').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); window.runCSV(window.readFmt()); }
      });
    }
    if (window.$('csvGo')) {
      window.$('csvGo').addEventListener('click', function () {
        window.runCSV('standard');
      });
    }
    if (window.$('csvMnr')) {
      window.$('csvMnr').addEventListener('click', function () {
        window.runCSV('mnr');
      });
    }
    var selCsv = window.$('selCsv') || window.$('selCsvBtn');
    if (selCsv) selCsv.addEventListener('click', function () { window.openSelExport('standard'); });
    var selMnr = window.$('selMnr') || window.$('selMnrBtn');
    if (selMnr) selMnr.addEventListener('click', function () { window.openSelExport('mnr'); });
    if (window.$('selExpGo')) {
      window.$('selExpGo').addEventListener('click', function () {
        window.runSelExport(window.selFmt || 'standard');
      });
    }
    if (window.$('selExpCancel')) window.$('selExpCancel').addEventListener('click', window.closeSelExport);
    if (window.$('selExpModal')) {
      window.$('selExpModal').addEventListener('click', function (e) {
        if (e.target === window.$('selExpModal')) window.closeSelExport();
      });
    }
    if (window.$('selExpName')) {
      window.$('selExpName').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); window.runSelExport(window.selFmt || 'standard'); }
      });
    }
    var selPdf = window.$('selPdf') || window.$('selPdfBtn');
    if (selPdf) selPdf.addEventListener('click', window.openPdfModal);
    var selClear = window.$('selClear') || window.$('selClearBtn');
    if (selClear) selClear.addEventListener('click', window.clearAllSel);
    if (window.$('selAll')) window.$('selAll').addEventListener('click', window.selectAllResults);
    if (window.$('selView')) window.$('selView').addEventListener('click', window.openSelTab);
    if (window.$('tabList')) window.$('tabList').addEventListener('click', function () { window.setTab('list'); });
    if (window.$('tabSel')) window.$('tabSel').addEventListener('click', function () { window.setTab('sel'); });
    if (window.$('pdfCancel')) {
      window.$('pdfCancel').addEventListener('click', function () { window.closePdf(); });
    }
    if (window.$('pdfModal')) {
      window.$('pdfModal').addEventListener('click', function (e) {
        if (e.target === window.$('pdfModal')) window.closePdf();
      });
    }
    if (window.$('pdfGo')) window.$('pdfGo').addEventListener('click', window.pdfGo);
    if (window.$('pdfPreviewBtn')) window.$('pdfPreviewBtn').addEventListener('click', window.pdfPreview);
    if (window.$('pdfPrevClose')) window.$('pdfPrevClose').addEventListener('click', window.closePdfPreview);
    if (window.$('pdfPrevGo')) {
      window.$('pdfPrevGo').addEventListener('click', function () {
        // pdfGo() closes the preview itself; closing it first would clear a
        // CSV-imported row set before the PDF gets a chance to read it.
        window.pdfGo();
      });
    }
    if (window.$('pdfPreview')) {
      window.$('pdfPreview').addEventListener('click', function (e) {
        if (e.target === window.$('pdfPreview')) window.closePdfPreview();
      });
    }
    ['pdfQSize', 'pdfHSize', 'pdfWmOp'].forEach(function (id) {
      var el = window.$(id);
      if (el) el.addEventListener('input', window.updateSizeLabels);
    });
    var wmFile = window.$('pdfWmImg');
    if (wmFile) {
      wmFile.addEventListener('change', function () {
        var f = wmFile.files && wmFile.files[0];
        if (!f) return;
        if (!/^image\//.test(f.type || '')) {
          if (window.flashNote) window.flashNote('শুধু ছবি (PNG/JPG) ফাইল দিন');
          wmFile.value = '';
          return;
        }
        function applyWm(dataUrl) {
          window.pdfWmImage = dataUrl;
          window.savePdfWmImage(window.pdfWmImage);
          window.updateWmImgHint();
        }
        var fr = new FileReader();
        fr.onload = function () {
          var raw = String(fr.result || '');
          window.pdfWmImageName = f.name || '';
          var img = new Image();
          img.onload = function () {
            var MAX = 1200;
            var w = img.naturalWidth || img.width;
            var h = img.naturalHeight || img.height;
            if (!w || !h || w <= MAX) return applyWm(raw);
            var c = document.createElement('canvas');
            c.width = MAX;
            c.height = Math.max(1, Math.round(h * (MAX / w)));
            var ctx = c.getContext('2d');
            if (!ctx) return applyWm(raw);
            ctx.drawImage(img, 0, 0, c.width, c.height);
            try { applyWm(c.toDataURL('image/png')); } catch (e) { applyWm(raw); }
          };
          img.onerror = function () { applyWm(raw); };
          img.src = raw;
        };
        fr.readAsDataURL(f);
      });
    }
    if (window.$('pdfWmImgClear')) {
      window.$('pdfWmImgClear').addEventListener('click', function () {
        window.pdfWmImage = '';
        window.pdfWmImageName = '';
        window.savePdfWmImage('');
        if (wmFile) wmFile.value = '';
        window.updateWmImgHint();
      });
    }
    if (window.$('pdfSaveClose')) window.$('pdfSaveClose').addEventListener('click', window.closePdfSave);
    if (window.$('pdfSaveModal')) {
      window.$('pdfSaveModal').addEventListener('click', function (e) {
        if (e.target === window.$('pdfSaveModal')) window.closePdfSave();
      });
    }
    if (window.$('pdfSaveLink')) {
      window.$('pdfSaveLink').addEventListener('click', function () {
        if (window.$('pdfSaveNote')) {
          window.$('pdfSaveNote').textContent = 'ডাউনলোড শুরু হয়েছে — ফাইলটি Downloads ফোল্ডারে দেখুন।';
        }
      });
    }
    if (window.$('pdfTime')) {
      window.$('pdfTime').addEventListener('input', window.updateDurationHint);
      window.$('pdfTime').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); window.pdfGo(); }
      });
    }
    if (window.bindCsvImportEvents) window.bindCsvImportEvents();
    if (window.bindPaperEvents) window.bindPaperEvents();
  };
  window.bindEvents = function () {
    window.bindFilterEvents();
    window.bindActionEvents();
  };
})();
