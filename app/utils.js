(function () {
  'use strict';
  window.$ = function (id) { return document.getElementById(id); };
  window.el = function (tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);
    return n;
  };
  window.NF = new Intl.NumberFormat('en-US');
  window.COLL = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  window.COLL_CMP = window.COLL.compare;
  window.num = function (n) { return window.NF.format(n); };
  window.shardName = function (i) { return String(i).padStart(3, '0'); };
  window.isBlank = function (v) { return v === null || v === undefined; };
  window.plain = function (v) {
    if (v == null) return '';
    return String(v).replace(/<[^>]*>/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  };
  window.normOpts = function (s) {
    return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  };
  window.isWrittenRec = function (r) {
    if (window.isBlank(r.n) || r.n === 0) return true;
    var t = window.normOpts(r.ot);
    return t === 'done skip' || t === 'skip done' || t === 'done';
  };
  window.optsReal = function (opts) {
    if (!Array.isArray(opts)) return 0;
    if (opts.length === 2 && window.normOpts(opts[0]) === 'done' && window.normOpts(opts[1]) === 'skip') return 0;
    return opts.length;
  };
  window.labelFor = function (facet, key) {
    if (key === window.NONE) return '(মান নেই)';
    if (facet === 's') return window.SUBJ_LABEL[key] || key;
    if (facet === 'c') {
      var raw = String(key);
      var name = window.CHAPTER_NAME && window.CHAPTER_NAME[raw];
      return name ? name + ' (' + raw + ')' : raw;
    }
    if (facet === 'ty') return window.TYPE_LABEL[key] || key;
    return key;
  };
  window.bnNum = function (v) {
    return String(v).replace(/[0-9]/g, function (d) { return window.BN_DIGITS[+d]; });
  };
  window.paperDate = function () {
    var inEl = window.$('pdfDate');
    var raw = inEl && inEl.value;
    if (raw) return window.bnISODate(raw);
    return window.bnISODate(window.todayISO());
  };
  window.todayISO = function () {
    var d = new Date();
    var y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  };
  window.bnISODate = function (iso) {
    var parts = String(iso).split('-');
    if (parts.length !== 3) return iso;
    return window.bnNum(parts[2]) + '/' + window.bnNum(parts[1]) + '/' + window.bnNum(parts[0]);
  };

  var DUR_MIN = /^(?:m|min|mins|minute|minutes|মিনিট|মিনিঃ)/i;
  var DUR_HR = /^(?:h|hr|hrs|hour|hours|ঘণ্টা|ঘন্টা|ঘঃ)/i;
  window.parseDuration = function (str) {
    var s = String(str == null ? '' : str).replace(/[০-৯]/g, function (d) {
      return String(d.charCodeAt(0) - 0x09E6);
    });
    if (!s.trim()) return 0;
    var clock = s.match(/^\s*([0-9]{1,2})\s*[:：.]\s*([0-9]{1,2})\s*$/);
    if (clock) return parseInt(clock[1], 10) * 60 + parseInt(clock[2], 10);
    var re = /([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Zঃঀ-৿]*)/g, m, mins = 0, bare = 0, any = false;
    while ((m = re.exec(s)) !== null) {
      var n = parseFloat(m[1]);
      if (!isFinite(n)) continue;
      var unit = m[2] || '';
      if (DUR_HR.test(unit)) { mins += n * 60; any = true; }
      else if (DUR_MIN.test(unit)) { mins += n; any = true; }
      else { bare += n; any = true; }
      if (unit) re.lastIndex = m.index + m[0].length;
    }
    if (!any) return 0;
    mins += bare;
    return Math.round(mins);
  };
  window.durationLabel = function (mins) {
    var m = Math.round(Number(mins) || 0);
    if (m <= 0) return '';
    var h = Math.floor(m / 60), r = m % 60;
    var out = [];
    if (h) out.push(window.bnNum(h) + ' ঘণ্টা');
    if (r || !h) out.push(window.bnNum(r) + ' মিনিট');
    return out.join(' ');
  };
  window.debounce = function (fn, ms) {
    var t;
    return function () {
      var a = arguments, s = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(s, a); }, ms);
    };
  };
})();
