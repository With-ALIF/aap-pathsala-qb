(function () {
  'use strict';
  window.lazyImgs = function (node) {
    var imgs = node.querySelectorAll('img:not([loading])');
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].setAttribute('loading', 'lazy');
      imgs[i].setAttribute('decoding', 'async');
    }
  };
  // Intrinsic sizes of images we have already seen, keyed by absolute URL.
  // The PDF paginator measures column heights synchronously, so an <img> that
  // has not decoded yet reports zero height; the page then gets overfilled and
  // the tail is clipped. Remembering the size lets a rebuild reserve the box.
  window.IMG_SIZE = window.IMG_SIZE || {};
  function rememberImg(img) {
    if (img && img.src && img.naturalWidth && img.naturalHeight) {
      window.IMG_SIZE[img.src] = [img.naturalWidth, img.naturalHeight];
    }
  }
  window.sizeImgs = function (node) {
    var imgs = node.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (img.getAttribute('width') && img.getAttribute('height')) continue;
      var size = window.IMG_SIZE[img.src];
      if (!size && img.complete) size = [img.naturalWidth, img.naturalHeight];
      if (size && size[0] && size[1]) {
        img.setAttribute('width', size[0]);
        img.setAttribute('height', size[1]);
      } else if (!img.__sizeHooked) {
        img.__sizeHooked = true;
        img.addEventListener('load', function () {
          rememberImg(this);
          if (!this.getAttribute('width') && this.naturalWidth) {
            this.setAttribute('width', this.naturalWidth);
            this.setAttribute('height', this.naturalHeight);
          }
        }, { once: true });
      }
    }
  };
  window.eagerImgs = function (node) {
    var imgs = node.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].setAttribute('loading', 'eager');
      imgs[i].removeAttribute('decoding');
      if (imgs[i].complete) rememberImg(imgs[i]);
      imgs[i].addEventListener('load', function () { rememberImg(this); }, { once: true });
    }
  };
  window.imagesReady = function (root, timeoutMs) {
    var imgs = Array.prototype.slice.call(root.querySelectorAll('img'));
    if (!imgs.length) return Promise.resolve();
    var wait = imgs.map(function (img) {
      if (img.complete && img.naturalWidth !== 0) return Promise.resolve();
      return new Promise(function (res) {
        var done = false;
        var tick = function () { if (!done) { done = true; res(); } };
        img.addEventListener('load', tick, { once: true });
        img.addEventListener('error', tick, { once: true });
        if (img.decode) {
          img.decode().then(tick).catch(tick);
        }
      });
    });
    var all = Promise.all(wait);
    if (!timeoutMs) return all;
    var timer = new Promise(function (res) { setTimeout(res, timeoutMs); });
    return Promise.race([all, timer]);
  };
  window.renderPage = function (reset) {
    var list = window.$('list');
    if (reset) {
      list.innerHTML = '';
      window.shown = 0;
    }
    if (!window.results.length) {
      list.appendChild(window.emptyBlock());
      return;
    }
    var start = window.shown;
    var end = Math.min(start + window.PAGE, window.results.length);
    if (start >= end) return;
    var slice = window.results.slice(start, end);
    var needed = window.pendingFor(slice);
    var frag = document.createDocumentFragment();
    for (var i = start; i < end; i++) {
      var rec = window.results[i];
      var full = window.DATMAP[rec.__shard] && window.DATMAP[rec.__shard][rec.p];
      frag.appendChild(window.card(rec, full, i + 1));
    }
    window.lazyImgs(frag);
    list.appendChild(frag);
    window.shown = end;
    if (needed.length) {
      window.loading = true;
      window.updateStatus();
      Promise.all(needed.map(window.loadDat)).then(function () {
        window.loading = false;
        for (var j = start; j < end; j++) {
          var r = window.results[j];
          var f = window.DATMAP[r.__shard] && window.DATMAP[r.__shard][r.p];
          if (f) {
            var old = document.getElementById('q-' + r.p) || list.querySelector('[data-pk="' + r.p + '"]');
            if (old) {
              var replacement = window.card(r, f, j + 1);
              window.lazyImgs(replacement);
              list.replaceChild(replacement, old);
            }
          }
        }
        window.updateStatus();
      }).catch(function () {
        window.loading = false;
        window.updateStatus();
      });
    }
  };
})();
