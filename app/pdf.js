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
      var node = window.buildPaper(rows, meta);
      node.style.fontFamily = '"Hind Siliguri", "Noto Sans Bengali", "Kalpurush", "Nirmala UI", "Siyam Rupali", "SolaimanLipi", sans-serif';
      node.style.letterSpacing = '0px';
      window.eagerImgs(node);
      document.body.classList.add('pdf-render');
      var fontPromise = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
      return fontPromise.then(function () {
        return window.imagesReady(node, 1500);
      }).then(function () {
        return new Promise(function (res) { setTimeout(res, 250); });
      }).then(function () {
        var baseName = meta.title || 'exam-paper';
        var safe = window.sanitizeName(baseName) || 'exam-paper';
        var filename = safe + '-' + rows.length + 'q-' + window.todayISO() + '.pdf';
        window.setSelBusy(true, 'PDF রূপান্তর…');
        window.flashNote('PDF রূপান্তর হচ্ছে…');
        if (typeof html2pdf === 'function') {
          var opt = {
            margin: [8, 8, 8, 8],
            filename: filename,
            image: { type: 'jpeg', quality: 0.95 },
            enableLinks: false,
            html2canvas: {
              scale: 2,
              useCORS: true,
              allowTaint: true,
              logging: false,
              letterRendering: false
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'] }
          };
          return html2pdf().set(opt).from(node).save().then(function () {
            window.flashNote('PDF সরাসরি নামানো হয়েছে');
          });
        }
        throw new Error('html2pdf লাইব্রেরি অনুপস্থিত');
      });
    }).catch(function (err) {
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
    });
  };
})();
