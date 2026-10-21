(function () {
  'use strict';
  window.csvExportRows = function (rows, fmt) {
    if (fmt === 'square') return window.buildSquareCSV(rows);
    return fmt === 'mnr' ? window.buildMNR(rows) : window.buildCSV(rows);
  };
  window.csvExportRange = function (from, to, fmt) {
    var sub = window.results.slice(from - 1, to);
    var needed = window.pendingFor(sub);
    window.csvErr('কন্টেন্ট শার্ড লোড হচ্ছে…');
    if (window.$('csvGo')) window.$('csvGo').disabled = true;
    if (window.$('csvMnr')) window.$('csvMnr').disabled = true;
    Promise.all(needed.map(window.loadDat)).then(function () {
      window.csvErr('');
      if (window.$('csvGo')) window.$('csvGo').disabled = false;
      if (window.$('csvMnr')) window.$('csvMnr').disabled = false;
      var content = window.csvExportRows(sub, fmt);
      window.downloadCSV(content, window.nameFor(fmt, from, to));
      window.closeCSV();
    }).catch(function (err) {
      if (window.$('csvGo')) window.$('csvGo').disabled = false;
      if (window.$('csvMnr')) window.$('csvMnr').disabled = false;
      window.csvErr('শার্ড লোড ব্যর্থ: ' + (err && err.message ? err.message : err));
    });
  };
  window.csvErr = function (msg) {
    var e = window.$('csvErr');
    if (e) {
      e.textContent = msg;
      e.hidden = !msg;
    }
  };
  window.readFmt = function () {
    var r = document.querySelector('input[name="csvFmt"]:checked');
    return r ? r.value : 'standard';
  };
  window.setFmt = function (fmt) {
    var r = document.querySelector('input[name="csvFmt"][value="' + fmt + '"]');
    if (r) r.checked = true;
    window.updateFmtHint();
  };
  window.updateFmtHint = function () {
    var fmt = window.readFmt();
    var isMnr = fmt === 'mnr';
    if (window.$('fmtStandardHint')) window.$('fmtStandardHint').hidden = isMnr;
    if (window.$('fmtMnrHint')) window.$('fmtMnrHint').hidden = !isMnr;
  };
  window.autoName = function (fmt, from, to) {
    var ext = (fmt === 'mnr' ? '-mnr' : '') + '.csv';
    return 'questions-' + from + '-to-' + to + ext;
  };
  window.sanitizeName = function (s) {
    var v = String(s || '').trim().replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '-');
    return v.replace(/\.csv$/i, '');
  };
  window.nameFor = function (fmt, from, to) {
    var user = window.sanitizeName(window.$('csvName').value);
    if (!user) return window.autoName(fmt, from, to);
    window.saveLastName(user);
    var ext = (fmt === 'mnr' && !/-mnr$/i.test(user) ? '-mnr' : '') + '.csv';
    return user + ext;
  };
  window.loadLastName = function () {
    try { return localStorage.getItem('qb_csv_name') || ''; } catch (e) { return ''; }
  };
  window.saveLastName = function (v) {
    try { if (v) localStorage.setItem('qb_csv_name', v); } catch (e) {}
  };
  window.openCSV = function () {
    window.csvErr('');
    var n = window.results.length;
    if (window.$('csvAvail')) {
      window.$('csvAvail').textContent = 'মোট ' + window.num(n) + 'টি প্রশ্ন বর্তমান ফিল্টারে পাওয়া গেছে।';
    }
    if (window.$('csvFrom')) {
      window.$('csvFrom').value = '1';
      window.$('csvFrom').max = String(n);
    }
    if (window.$('csvTo')) {
      window.$('csvTo').value = String(n);
      window.$('csvTo').max = String(n);
    }
    var last = window.loadLastName();
    if (window.$('csvName')) {
      window.$('csvName').value = last;
      window.csvNamePlaceholder();
    }
    if (window.$('csvGo')) window.$('csvGo').disabled = false;
    if (window.$('csvMnr')) window.$('csvMnr').disabled = false;
    if (window.$('csvModal')) {
      window.$('csvModal').hidden = false;
    }
    if (window.$('csvFrom')) window.$('csvFrom').focus();
  };
  window.closeCSV = function () {
    if (window.$('csvModal')) window.$('csvModal').hidden = true;
  };
  window.runCSV = function (fmt) {
    var rng = window.readRange();
    var n = window.results.length;
    if (isNaN(rng.from) || isNaN(rng.to) || rng.from < 1 || rng.to > n || rng.from > rng.to) {
      window.csvErr('সঠিক পরিসর দিন (১ থেকে ' + window.num(n) + '-এর মধ্যে)');
      return;
    }
    window.csvExportRange(rng.from, rng.to, fmt);
  };
  window.autoSelName = function (fmt) {
    var d = new Date();
    var stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    var pfx = fmt === 'mnr' ? 'selected-mnr-' : fmt === 'square' ? 'selected-square-' : 'selected-questions-';
    return pfx + stamp + '.csv';
  };
  window.selFmtLabel = function (fmt) {
    if (fmt === 'mnr') return 'MNR';
    if (fmt === 'square') return 'Square CSV';
    return 'Rayvila CSV';
  };
  window.selFmtSuffix = function (fmt) {
    if (fmt === 'mnr') return '-mnr';
    if (fmt === 'square') return '-square';
    return '';
  };
  window.selErr = function (msg) {
    var e = window.$('selExpErr');
    if (e) {
      e.textContent = msg;
      e.hidden = !msg;
    }
  };
  window.selNote = function (msg) {
    var e = window.$('selExpNote');
    if (e) e.textContent = msg || '';
  };
  window.openSelExport = function (fmt) {
    var n = window.selOrder.length;
    if (!n) { window.flashNote('আগে কিছু প্রশ্ন নির্বাচন করুন'); return; }
    window.selFmt = fmt;
    window.selErr('');
    window.selNote('');
    if (window.$('selExpTitle')) window.$('selExpTitle').textContent = window.selFmtLabel(fmt) + ' — নির্বাচিত প্রশ্ন';
    if (window.$('selExpCount')) {
      window.$('selExpCount').textContent = window.num(n) + 'টি নির্বাচিত প্রশ্ন এক্সপোর্ট হবে।';
    }
    var auto = window.autoSelName(fmt);
    if (window.$('selExpName')) {
      window.$('selExpName').value = '';
      window.$('selExpName').placeholder = auto;
    }
    if (window.$('selExpSub')) {
      window.$('selExpSub').textContent = 'নাম খালি রাখলে ' + auto + ' নামে নামবে; শেষে .csv না থাকলে যোগ হবে।';
    }
    if (window.$('selExpGo')) window.$('selExpGo').disabled = false;
    if (window.$('selExpModal')) window.$('selExpModal').hidden = false;
    if (window.$('selExpName')) window.$('selExpName').focus();
  };
  window.closeSelExport = function () {
    if (window.$('selExpModal')) window.$('selExpModal').hidden = true;
  };
  window.selNameFor = function (fmt) {
    var el = window.$('selExpName');
    var user = window.sanitizeName(el ? el.value : '');
    if (!user) return window.autoSelName(fmt);
    window.saveLastName(user);
    var suf = window.selFmtSuffix(fmt);
    return user + (suf && !new RegExp(suf.replace('-', '\\-') + '$', 'i').test(user) ? suf : '') + '.csv';
  };
  window.runSelExport = function (fmt) {
    var rows = window.selRecs();
    if (!rows.length) { window.closeSelExport(); return; }
    var needed = window.pendingFor(rows);
    window.setSelBusy(true);
    window.selErr('শার্ড লোড হচ্ছে…');
    window.selNote('');
    if (window.$('selExpGo')) window.$('selExpGo').disabled = true;
    Promise.all(needed.map(window.loadDat)).then(function () {
      window.setSelBusy(false);
      if (window.$('selExpGo')) window.$('selExpGo').disabled = false;
      var content = window.csvExportRows(rows, fmt);
      window.downloadCSV(content, window.selNameFor(fmt));
      window.closeSelExport();
      window.flashNote('CSV নামানো হয়েছে');
    }).catch(function (err) {
      window.setSelBusy(false);
      if (window.$('selExpGo')) window.$('selExpGo').disabled = false;
      window.selErr('শার্ড লোড ব্যর্থ: ' + (err && err.message ? err.message : err));
    });
  };
  window.csvNamePlaceholder = function () {
    var rng = window.readRange();
    var ph = window.autoName('standard', rng.from || 1, rng.to || window.results.length);
    if (window.$('csvName')) window.$('csvName').placeholder = ph;
  };
})();
