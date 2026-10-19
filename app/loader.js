(function () {
  'use strict';
  window.loadScript = function (src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = rej;
      document.head.appendChild(s);
    });
  };
  window.loadIdx = function (i) {
    if (window.LOADED.idx[i]) return Promise.resolve();
    if (window.pendIdx[i]) return window.pendIdx[i];
    var p = window.loadScript('idx/idx-' + window.shardName(i) + '.js').then(function () {
      window.LOADED.idx[i] = true;
      delete window.pendIdx[i];
      var shard = window.IDX[i] || [];
      for (var j = 0; j < shard.length; j++) {
        var r = shard[j];
        r.__shard = i;
        r._sh = i;
        window.FLAT.push(r);
      }
    });
    window.pendIdx[i] = p;
    return p;
  };
  window.loadDat = function (i) {
    if (window.LOADED.dat[i]) return Promise.resolve();
    if (window.pendDat[i]) return window.pendDat[i];
    var p = window.loadScript('dat/dat-' + window.shardName(i) + '.js').then(function () {
      window.LOADED.dat[i] = true;
      delete window.pendDat[i];
      var shard = window.DAT[i] || [];
      var map = window.DATMAP[i] = {};
      for (var j = 0; j < shard.length; j++) {
        var r = shard[j];
        map[r.p] = r;
      }
    });
    window.pendDat[i] = p;
    return p;
  };
})();
