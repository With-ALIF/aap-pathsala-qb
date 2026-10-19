(function () {
  'use strict';
  var registry = [];

  function find(key, val) {
    for (var i = 0; i < registry.length; i++) if (registry[i][key] === val) return registry[i];
    return null;
  }
  function labelOf(sel) {
    var i = sel.selectedIndex;
    return i >= 0 && sel.options[i] ? sel.options[i].textContent : '';
  }
  function closeAll(keep) {
    for (var i = 0; i < registry.length; i++) {
      var d = registry[i];
      if (d.pop === keep || d.pop.hidden) continue;
      d.pop.hidden = true;
      d.btn.setAttribute('aria-expanded', 'false');
    }
  }
  function closeMulti() {
    if (!window.MULTI_ID) return;
    Object.keys(window.MULTI_ID).forEach(function (f) {
      var cfg = window.MULTI_ID[f];
      var p = cfg && window.$(cfg.pop), b = cfg && window.$(cfg.btn);
      if (p && !p.hidden) {
        p.hidden = true;
        if (b) b.setAttribute('aria-expanded', 'false');
      }
    });
  }
  function build(d) {
    var sel = d.sel;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < sel.options.length; i++) {
      var o = sel.options[i];
      var b = window.el('button', 'dd-opt' + (i === sel.selectedIndex ? ' on' : ''));
      b.type = 'button';
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', String(i === sel.selectedIndex));
      b.dataset.v = o.value;
      b.textContent = o.textContent;
      frag.appendChild(b);
    }
    d.pop.textContent = '';
    d.pop.appendChild(frag);
  }
  function open(d) {
    closeAll(d.pop);
    closeMulti();
    build(d);
    d.pop.hidden = false;
    d.btn.setAttribute('aria-expanded', 'true');
    if (window.clampPop) window.clampPop(d.pop);
    var on = d.pop.querySelector('.dd-opt.on');
    if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
    d.btn.focus();
  }
  function toggle(d) {
    if (d.pop.hidden) open(d);
    else {
      d.pop.hidden = true;
      d.btn.setAttribute('aria-expanded', 'false');
      d.btn.focus();
    }
  }
  window.closeDropdowns = function () { closeAll(); };
  window.syncDropdowns = function () {
    for (var i = 0; i < registry.length; i++) registry[i].btn.textContent = labelOf(registry[i].sel);
  };
  window.initSelectDropdowns = function () {
    var sels = document.querySelectorAll('.filters select');
    Array.prototype.forEach.call(sels, function (sel) {
      if (!sel.id) return;
      var dd = window.el('div', 'dd');
      sel.parentNode.insertBefore(dd, sel);
      dd.appendChild(sel);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ms-btn dd-btn';
      btn.id = 'ddbtn-' + sel.id;
      btn.setAttribute('aria-haspopup', 'listbox');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', 'ddpop-' + sel.id);
      btn.textContent = labelOf(sel);
      var pop = document.createElement('div');
      pop.className = 'ms-pop dd-pop';
      pop.id = 'ddpop-' + sel.id;
      pop.setAttribute('role', 'listbox');
      pop.hidden = true;
      dd.appendChild(btn);
      dd.appendChild(pop);
      sel.setAttribute('tabindex', '-1');
      var d = { sel: sel, btn: btn, pop: pop };
      registry.push(d);

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        toggle(d);
      });
      var lab = document.querySelector('label[for="' + sel.id + '"]');
      if (lab) lab.addEventListener('click', function (e) {
        e.preventDefault();
        toggle(d);
      });
      btn.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        if (d.pop.hidden) open(d);
        var t = d.pop.querySelector('.dd-opt.on') || d.pop.querySelector('.dd-opt');
        if (t) t.focus();
      });
      pop.addEventListener('keydown', function (e) {
        var opts = Array.prototype.slice.call(d.pop.querySelectorAll('.dd-opt'));
        var i = opts.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          opts[Math.min(i + 1, opts.length - 1)].focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (i > 0) opts[i - 1].focus();
          else d.btn.focus();
        } else if (e.key === 'Escape') {
          closeAll();
          d.btn.focus();
        } else if (e.key === 'Tab') {
          closeAll();
          d.btn.focus();
        }
      });
      pop.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('.dd-opt') : null;
        if (!b) return;
        if (d.sel.value !== b.dataset.v) {
          d.sel.value = b.dataset.v;
          d.sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
        d.btn.textContent = labelOf(d.sel);
        closeAll();
        d.btn.focus();
      });
    });
    window.syncDropdowns();
  };
  document.addEventListener('click', function (e) {
    if (!registry.length) return;
    if (e.target && e.target.closest && e.target.closest('.dd')) return;
    // labels of wrapped selects are handled by their own toggle handler
    if (e.target && e.target.tagName === 'LABEL') {
      var fid = e.target.getAttribute('for');
      for (var i = 0; i < registry.length; i++) if (registry[i].sel.id === fid) return;
    }
    closeAll();
  }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAll();
  });
})();
