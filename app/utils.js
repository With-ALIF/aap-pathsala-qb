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
  window.clampPop = function (pop) {
    pop.style.left = '';
    var m = 8;
    var vw = document.documentElement.clientWidth;
    var r = pop.getBoundingClientRect();
    var shift = 0;
    if (r.right > vw - m) shift = vw - m - r.right;
    if (r.left + shift < m) shift = m - r.left;
    if (shift) pop.style.left = shift + 'px';
  };
  window.debounce = function (fn, ms) {
    var t;
    return function () {
      var a = arguments, s = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(s, a); }, ms);
    };
  };
  window.LUCIDE = {
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/>',
    shuffle: '<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
    rotateCcw: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    fileText: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    listChecks: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
    sliders: '<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>',
    droplet: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
    type: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    folderOpen: '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>'
  };
  window.iconSvg = function (name) {
    var body = window.LUCIDE[name];
    if (!body) return '';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + '</svg>';
  };
  window.setIcon = function (el, name) {
    if (!el) return;
    el.removeAttribute('data-ic');
    el.innerHTML = window.iconSvg(name);
  };
  window.hydrateIcons = function (root) {
    var nodes = (root || document).querySelectorAll('[data-ic]');
    for (var i = 0; i < nodes.length; i++) {
      var name = nodes[i].getAttribute('data-ic');
      if (name) window.setIcon(nodes[i], name);
    }
  };
  window.updateThemeIcon = function () {
    var ico = window.$('themeIco');
    if (!ico) return;
    var dark = document.documentElement.dataset.theme === 'dark';
    window.setIcon(ico, dark ? 'sun' : 'moon');
  };
})();
