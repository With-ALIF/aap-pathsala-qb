(function () {
  'use strict';

  var GREEK = {
    alpha: '\\alpha', beta: '\\beta', gamma: '\\gamma', delta: '\\delta',
    theta: '\\theta', lambda: '\\lambda', mu: '\\mu', nu: '\\nu',
    pi: '\\pi', rho: '\\rho', sigma: '\\sigma', tau: '\\tau',
    phi: '\\phi', psi: '\\psi', omega: '\\omega', eta: '\\eta',
    zeta: '\\zeta', kappa: '\\kappa'
  };

  function esc(s) {
    return s.replace(/\\/g, '\\textbackslash{}')
      .replace(/([&%$#_{}^])/g, '\\$1')
      .replace(/~/g, '\\sim ')
      .replace(/</g, '\\lt ')
      .replace(/>/g, '\\gt ');
  }

  function readGroup(s, i) {
    var open = s.charAt(i);
    var close = open === '(' ? ')' : open === '[' ? ']' : open === '{' ? '}' : '';
    if (!close) return null;
    var depth = 0, j = i;
    while (j < s.length) {
      var ch = s.charAt(j);
      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) return { inner: s.slice(i + 1, j), end: j + 1 };
      }
      j++;
    }
    return null;
  }

  
  function readBody(s, i) {
    var ch = s.charAt(i);
    while (s.charAt(i) === ' ') i++;
    var ch = s.charAt(i);
    if (ch === '(' || ch === '[' || ch === '{') {
      var g = readGroup(s, i);
      return g ? { text: g.inner, next: g.end } : null;
    }
    if (ch === '-') {
      var j = i + 1;
      while (s.charAt(j) === ' ') j++;
      var m = /^\d+(\.\d+)?/.exec(s.slice(j));
      return m ? { text: '-' + m[0], next: j + m[0].length } : null;
    }
    var m2 = /^\d+(\.\d+)?/.exec(s.slice(i));
    return m2 ? { text: m2[0], next: i + m2[0].length } : null;
  }

  function tidy(t) {
    return t.replace(/−/g, '-').replace(/–/g, '-').replace(/×/g, '\\times')
      .replace(/÷/g, '\\div').replace(/ /g, ' ');
  }

  function escLatex(t) {
    return tidy(t).replace(/#/g, '\\#').replace(/&/g, '\\&').replace(/%/g, '\\%')
      .replace(/\$/g, '\\$').replace(/~/g, '\\sim');
  }

  function texOf(t) {
    var tex = window.mathLatex(tidy(String(t)), true);
    return tex == null ? escLatex(t) : tex;
  }

  var HAS = /\[\s*[(\[][^)\]]{1,60}[)\]]\s*,\s*[(\[][^)\]]{1,60}[)\]]|\(\s*[(\[][^)\]]{1,60}[)\]]\s*,\s*[(\[][^)\]]{1,60}[)\]]|\babs\s*\(|[|∣]\s*\([^)]{1,80}\)\s*,|sqrt\s*[(\[]|\broot\s*[2-9]\s*\(|[√∛∜]|\^|[A-Za-z0-9)]\s_|\bpm(?![a-zA-Z])|\bint(?![a-zA-Z])|class="mathy"|\b(?:alpha|beta|gamma|delta|theta|lambda|pi|omega|sigma|mu|rho|eta|tau|phi|psi|nu|kappa|zeta)\b|->/;

  function splitTop(s) {
    var out = [], depth = 0, cur = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') depth--;
      if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    if (cur.trim() !== '') out.push(cur.trim());
    return out;
  }

  function readRows(src, p, closeChar) {
    var rows = [], guard = 0;
    while (guard++ < 40) {
      while (src.charAt(p) === ' ') p++;
      var ch = src.charAt(p);
      if (ch === '') return null;
      if (ch === closeChar) return { rows: rows, next: p + 1 };
      if (ch !== '[' && ch !== '(') return null;
      var g = readGroup(src, p);
      if (!g) return null;
      var cells = splitTop(g.inner);
      if (!cells.length) return null;
      rows.push(cells);
      p = g.end;
      while (src.charAt(p) === ' ') p++;
      if (src.charAt(p) === ',') { p++; continue; }
      if (src.charAt(p) === closeChar) return { rows: rows, next: p + 1 };
      return null;
    }
    return null;
  }

  function readMatrix(src, i) {
    var ch = src.charAt(i);
    var det = false, res = null;
    if (ch === '[') {
      res = readRows(src, i + 1, ']');
    } else if (ch === '(') {
      res = readRows(src, i + 1, ')');
    } else if (ch === '|' || ch === '∣') {
      det = true;
      res = readRows(src, i + 1, ch);
    } else {
      var mAbs = /^abs\s*\(/.exec(src.slice(i));
      if (!mAbs) return null;
      det = true;
      res = readRows(src, i + mAbs[0].length, ')');
    }
    if (!res) return null;
    var rows = res.rows;
    if (rows.length < 2 || rows.length > 6) return null;
    var w = rows[0].length;
    if (w < 2 || w > 6) return null;
    for (var k = 1; k < rows.length; k++) if (rows[k].length !== w) return null;
    return { rows: rows, next: res.next, det: det };
  }

  function matrixLatex(rows, det) {
    var body = rows.map(function (cells) {
      return cells.map(function (c) {
        return texOf(c);
      }).join(' & ');
    }).join(' \\\\ ');
    var env = det ? 'vmatrix' : 'bmatrix';
    return '\\begin{' + env + '}' + body + '\\end{' + env + '}';
  }

  window.mathNeeds = function (s) {
    if (!s || !HAS.test(s)) return false;
    if (/[ঀ-৿]/.test(s) && /[√∛∜]/.test(s) && !/sqrt\s*[(\[]|\broot\s*[2-9]\s*\(|\^|_/.test(s)) return false;
    return true;
  };
  window.mathForced = function (el) {
    if (!el || !el.classList) return false;
    return el.classList.contains('mathy');
  };

  window.mathLatex = function (s, force) {
    if (!force && !HAS.test(s)) return null;
    var out = '', i = 0, any = false;
    var src = String(s).replace(/[−–]/g, '-').replace(/\u00a0/g, ' ');

    function take(tex, len) {
      out += tex;
      i += len;
      any = true;
    }

    while (i < src.length) {
      var rest = src.slice(i);

       if (src.charAt(i) === '[' || src.charAt(i) === '|' || src.charAt(i) === '∣' ||
          (src.charAt(i) === '(' && (src.charAt(i + 1) === '(' || src.charAt(i + 1) === '[')) ||
          /^abs\s*\(/.test(rest)) {
        var mx = readMatrix(src, i);
        if (mx) {
          take(matrixLatex(mx.rows, mx.det), mx.next - i);
          continue;
        }
      }

       var mSqrt = /^sqrt\s*[([]/.exec(rest);
      if (mSqrt) {
        var gi = i + mSqrt[0].length - 1;
        var g = readGroup(src, gi);
        if (g) {
          take('\\sqrt{' + texOf(g.inner) + '}', g.end - i);
          continue;
        }
        var tail = src.slice(gi + 1);
        var mDx = /\s+d\s*x\b/i.exec(tail);
        var inner = (mDx ? tail.slice(0, mDx.index) : tail).replace(/\s+$/, '');
        if (inner) {
          take('\\sqrt{' + texOf(inner) + '}', gi + 1 + inner.length - i);
          continue;
        }
      }

       var mSqrtBare = /^sqrt\s*([-+]?\s*[0-9]+(?:\.[0-9]+)?|[-+]?\s*[A-Za-z])/.exec(rest);
      if (mSqrtBare) {
        var bareRad = mSqrtBare[1].replace(/\s+/g, '');
        take('\\sqrt{' + texOf(bareRad) + '}', mSqrtBare[0].length);
        continue;
      }

      var mRootN = /^root\s*([2-9])\s*\(/.exec(rest);
      if (mRootN) {
        var gr = readGroup(src, i + mRootN[0].length - 1);
        if (gr) {
          take('\\sqrt[' + mRootN[1] + ']{' + texOf(gr.inner) + '}', gr.end - i);
          continue;
        }
      }

      var radCh = src.charAt(i);
      if (radCh === '√' || radCh === '∛' || radCh === '∜') {
        var radIdx = radCh === '∛' ? '3' : radCh === '∜' ? '4' : '';
        var radOpen = radCh === '∛' ? '\\sqrt[3]' : radCh === '∜' ? '\\sqrt[4]' : '\\sqrt';
        var rj = i + 1;
        while (src.charAt(rj) === ' ') rj++;
        var rch = src.charAt(rj);
        if (rch === '(' || rch === '[' || rch === '{') {
          var grp = readGroup(src, rj);
          if (grp) {
            take(radOpen + '{' + texOf(grp.inner) + '}', grp.end - i);
            continue;
          }
        }
        var mRadTerm = /^[√∛∜]\s*([-]?[0-9]+(?:\.[0-9]+)?|[-]?[A-Za-z])/.exec(rest);
        if (mRadTerm) {
          take(radOpen + '{' + texOf(mRadTerm[1]) + '}', mRadTerm[0].length);
          continue;
        }
        take(radOpen + '{}', 1);
        continue;
      }
      var mPm = /^pm(?![a-zA-Z])/.exec(rest);
      if (mPm) {
        var prev = i > 0 ? src.charAt(i - 1) : '';
        var after = rest.slice(2);
        var mathish = /^\s*[0-9(+-]/.test(after) || /^\s*sqrt\s*\(/.test(after) ||
          /^\s*(?:alpha|beta|gamma|delta|theta|lambda|pi|omega|sigma|mu|rho|eta|tau|phi|psi|nu)\b/.test(after);
        if (!/[0-9]/.test(prev) && mathish) take('\\pm', 2);
        else { out += esc(rest.charAt(0)); i += 1; }
        continue;
      }

      var mInt = /^int(?![a-zA-Z])|^int(?=[fgh]\s*\()/.exec(rest);
      if (mInt) {
        var nx = 3;
        while (rest.charAt(nx) === ' ') nx++;
        var before = i > 0 ? src.charAt(i - 1) : '';
        if (!/[ঀ-৿]/.test(rest.charAt(nx)) && !/[a-zA-Z]/.test(before)) take('\\int ', 3);
        else { out += esc(rest.charAt(0)); i += 1; }
        continue;
      }

      if (rest.charAt(0) === '_' || rest.charAt(0) === '^') {
        var mark = rest.charAt(0);
        var bd4 = readBody(src, i + 1);
        if (bd4) {
          take(mark === '_' ? '_{' + texOf(bd4.text) + '}' : '^{' + texOf(bd4.text) + '}', bd4.next - i);
          continue;
        }
      }

      var mSup = /^([A-Za-z0-9)\]])(\s*)\^/.exec(rest);
      if (mSup) {
        var bd = readBody(src, i + mSup[0].length);
        if (bd) {
          var base = src.charAt(i);
          if (base === ')' || base === ']') {
            var open = findOpen(src, i);
            if (open >= 0) base = src.slice(open, i + 1);
          }
          take(escLatex(base) + '^{' + texOf(bd.text) + '}', bd.next - i);
          continue;
        }
      }

      var mSub = /^([A-Za-z0-9)\]])(\s*)_/.exec(rest);
      if (mSub) {
        var bd2 = readBody(src, i + mSub[0].length);
        if (bd2) {
          var b2 = src.charAt(i);
          if (b2 === ')' || b2 === ']') {
            var op2 = findOpen(src, i);
            if (op2 >= 0) b2 = src.slice(op2, i + 1);
          }
          take(escLatex(b2) + '_{' + texOf(bd2.text) + '}', bd2.next - i);
          continue;
        }
      }

      var mFn = /^(cosec|sinh|cosh|tanh|sin|cos|tan|cot|sec|ln|log)(?![a-zA-Z])/.exec(rest);
      if (mFn) {
        take('\\' + mFn[1], mFn[1].length);
        continue;
      }

      var mVec = /^vec\s*([A-Za-z])(?![A-Za-z])/.exec(rest);
      if (mVec) {
        take('\\vec{' + mVec[1] + '}', mVec[0].length);
        continue;
      }

      var mG = /^[A-Za-z]+/.exec(rest);
      if (mG) {
        var w = mG[0];
        var isWord = /^[A-Za-z]+$/.test(w);
        var nx = src.charAt(i + w.length);
        var standalone = isWord && !/[A-Za-z]/.test(nx);
        var key = w.toLowerCase();
        if (standalone && Object.prototype.hasOwnProperty.call(GREEK, key) && w === key) {
          take(GREEK[key], w.length);
          continue;
        }
      }

      if (rest.charAt(0) === '-' && rest.charAt(1) === '>') { take('\\to', 2); continue; }

      out += esc(src.charAt(i));
      i += 1;
    }
    return any ? out : null;
  };

  function findOpen(s, i) {
    var close = s.charAt(i);
    if (close !== ')' && close !== ']') return -1;
    var open = close === ')' ? '(' : '[';
    var depth = 0, j = i;
    while (j >= 0) {
      var ch = s.charAt(j);
      if (ch === close) depth++;
      else if (ch === open) {
        depth--;
        if (depth === 0) return j;
      }
      j--;
    }
    return -1;
  }

  window.renderMathHtml = function (html, force) {
    if (!window.katex) return html;
    var out = '', rest = html;
    var guard = 0;
    while (guard++ < 200) {
      if (!force && !window.mathNeeds(rest)) { out += rest; break; }
      var tex = window.mathLatex(rest, force);
      if (tex == null) { out += rest; break; }
      try {
        var rendered = window.katex.renderToString(tex, {
          throwOnError: false, displayMode: false, output: 'html', strict: 'ignore'
        });
        if (rendered.indexOf('katex-error') >= 0) { out += rest; break; }
        out += rendered;
      } catch (e) {
        out += rest;
        break;
      }
      break;
    }
    return out;
  };

  window.katexInline = function (tex) {
    if (!window.katex) return null;
    try {
      return window.katex.renderToString(tex, {
        throwOnError: false, displayMode: false, output: 'html', strict: 'ignore'
      });
    } catch (e) {
      return null;
    }
  };

  function mergeRadicalIndex(root) {
    var sups = root.querySelectorAll('sup');
    for (var i = sups.length - 1; i >= 0; i--) {
      var sup = sups[i];
      if (!sup.parentNode) continue;
      var idx = (sup.textContent || '').trim();
      if (!/^(?:[2-9]|1[0-9])$/.test(idx)) continue;
      var next = sup.nextSibling;
      if (!next || next.nodeType !== 3) continue;
      var data = next.data;
      var mRad = /^(\s*)[√∛∜]\s*/.exec(data);
      if (!mRad) continue;
      var rest = data.slice(mRad[0].length);
      var operand = '', consumed = 0;
      if (rest.charAt(0) === '(' || rest.charAt(0) === '[' || rest.charAt(0) === '{') {
        var g = readGroup(rest, 0);
        if (!g) continue;
        operand = g.inner;
        consumed = g.end;
      } else {
        var mOp = /^(?:[-−–]?[0-9]+(?:\.[0-9]+)?|[A-Za-z])[^\s,;=<>]*/.exec(rest);
        if (!mOp) continue;
        operand = mOp[0];
        consumed = mOp[0].length;
      }
      var html = window.katexInline('\\sqrt[' + idx + ']{' + texOf(operand) + '}');
      if (html == null) continue;
      var span = document.createElement('span');
      span.className = 'math';
      span.innerHTML = html;
      sup.parentNode.replaceChild(span, sup);
      next.data = mRad[1] + rest.slice(consumed);
    }
  }

  window.enhanceMath = function (root) {
    if (!root || !window.katex) return;
    mergeRadicalIndex(root);
    var marks = root.querySelectorAll('sup, sub');
    for (var i = marks.length - 1; i >= 0; i--) {
      var el = marks[i];
      if (!el.parentNode) continue;
      var body = (el.textContent || '').trim();
      if (!body) continue;
      var tex = (el.nodeName === 'SUP' ? '^{' : '_{') + texOf(body) + '}';
      var html = window.katexInline(tex);
      if (html == null) continue;
      var span = document.createElement('span');
      span.className = 'math';
      span.innerHTML = html;
      el.parentNode.replaceChild(span, el);
    }
    window.renderMath(root);
  };

  window.renderMath = function (root) {
    if (!root || !window.katex) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        while (p && p !== root.parentNode) {
          var t = p.nodeName;
          if (t === 'SCRIPT' || t === 'STYLE' || t === 'TEXTAREA') return NodeFilter.FILTER_REJECT;
          if (p.classList && p.classList.contains('katex')) return NodeFilter.FILTER_REJECT;
          p = p.parentNode;
        }
        return (window.mathNeeds(n.data) || window.mathForced(n.parentNode)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var forced = window.mathForced(node.parentNode);
      var html = window.renderMathHtml(node.data, forced);
      if (html == null || html === node.data) continue;
      var span = document.createElement('span');
      span.className = 'math';
      span.innerHTML = html;
      node.parentNode.replaceChild(span, node);
    }
  };
})();