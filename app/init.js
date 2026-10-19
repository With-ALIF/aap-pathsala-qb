(function () {
  'use strict';
  window.init = function () {
    if (!window.M) return;
    try {
      var s = localStorage.getItem('qb-theme');
      document.documentElement.dataset.theme = s || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } catch (e) {}
    try {
      var a = localStorage.getItem('qb-answers');
      if (a !== null) window.state.answers = a === '1';
    } catch (e) {}
    window.applyAnswers();
    if (window.$('brandSub')) window.$('brandSub').textContent = window.num(window.M.total) + 'টি প্রশ্ন · ' + window.M.shards + ' শার্ড';
    if (window.$('srcTotal')) window.$('srcTotal').textContent = window.num(window.M.total);
    if (window.$('srcShards')) window.$('srcShards').textContent = window.M.shards;
    if (window.$('count')) window.$('count').textContent = 'সূচি তৈরি হচ্ছে…';
    window.lastSyncedHash = location.hash.replace(/^#/, '');
    window.readURL();
    window.writeControls();
    window.buildSelects();
    if (window.initSelectDropdowns) window.initSelectDropdowns();
    window.bindEvents();
    window.$('indexing').hidden = false;
    var loadedCount = 0;
    var fill = window.$('indexFill');
    var text = window.$('indexText');
    var promises = [];
    for (var i = 0; i < window.NSHARD; i++) {
      (function (idx) {
        promises.push(window.loadIdx(idx).then(function () {
          loadedCount++;
          var pct = Math.round((loadedCount / window.NSHARD) * 100);
          fill.style.width = pct + '%';
          text.textContent = 'সূচি তৈরি হচ্ছে… ' + pct + '% (' + loadedCount + '/' + window.NSHARD + ')';
        }));
      })(i);
    }
    Promise.all(promises).then(function () {
      window.buildIndex();
      window.$('indexing').hidden = true;
      window.restoreSel();
      window.scrollToQuestion();
    }).catch(function (err) {
      text.textContent = 'সূচি লোড ব্যর্থ: ' + (err && err.message ? err.message : err);
    });
  };
  window.init();
})();
