/*
 * One-off data patch: copy the raw dump's `un2` (unit / stream) and `sh`
 * (set / short label) into the Tier 1 index, then add both as manifest facets.
 *
 * Usage:  node tools/patch-unit-set-facets.js
 */
'use strict';

var fs = require('fs');
var path = require('path');
var readline = require('readline');

var ROOT = path.resolve(__dirname, '..');
var RAW_DIR = path.join(ROOT, 'raw');
var IDX_DIR = path.join(ROOT, 'idx');
var MANIFEST = path.join(ROOT, 'manifest.js');

var NONE = '__none__';
var NUMERIC_PLACEHOLDERS = { '26': true, '40': true };

function normUn2(value) {
  if (value == null) return null;
  var s = String(value).trim();
  if (!s || NUMERIC_PLACEHOLDERS[s]) return null;
  var unit = /^Unit\s*-\s*([A-Za-z])$/i.exec(s);
  if (unit) return 'Unit-' + unit[1].toUpperCase();
  // Source typo that belongs to the same VAP stream.
  if (/^vapa$/i.test(s)) return 'VAP';
  return s;
}

function normSh(value) {
  if (value == null) return null;
  var s = String(value).trim();
  if (!s || NUMERIC_PLACEHOLDERS[s]) return null;
  return s;
}

function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

function facetRows(counts) {
  return Object.keys(counts).sort(naturalCompare).map(function (key) {
    return { value: key === NONE ? null : key, count: counts[key] };
  });
}

function bump(counts, value) {
  var key = value == null ? NONE : value;
  counts[key] = (counts[key] || 0) + 1;
}

function readRaw() {
  return new Promise(function (resolve, reject) {
    var files = fs.readdirSync(RAW_DIR).filter(function (f) {
      return /^part-\d+\.jsonl$/.test(f);
    }).sort();
    if (!files.length) return reject(new Error('No raw/part-*.jsonl files found'));

    var byPk = new Map();
    var un2Counts = {};
    var shCounts = {};
    var total = 0;

    (function next(i) {
      if (i >= files.length) {
        return resolve({ byPk: byPk, un2Counts: un2Counts, shCounts: shCounts, total: total });
      }
      var rl = readline.createInterface({
        input: fs.createReadStream(path.join(RAW_DIR, files[i])),
        crlfDelay: Infinity
      });
      rl.on('line', function (line) {
        if (!line.trim()) return;
        var rec;
        try { rec = JSON.parse(line); } catch (e) { return; }
        var un2 = normUn2(rec.un2);
        var sh = normSh(rec.sh);
        byPk.set(rec.p, { un2: un2, sh: sh });
        bump(un2Counts, un2);
        bump(shCounts, sh);
        total++;
      });
      rl.on('error', reject);
      rl.on('close', function () { next(i + 1); });
    })(0);
  });
}

function parseIdx(text, file) {
  var m = /^window\.QB_IDX\[(\d+)\]=([\s\S]*);\s*$/.exec(text);
  if (!m) throw new Error('Unexpected index format: ' + file);
  return { id: Number(m[1]), rows: JSON.parse(m[2]) };
}

function patchIndexes(byPk) {
  var files = fs.readdirSync(IDX_DIR).filter(function (f) {
    return /^idx-\d+\.js$/.test(f);
  }).sort();
  var written = 0;
  var missing = 0;
  files.forEach(function (file) {
    var full = path.join(IDX_DIR, file);
    var parsed = parseIdx(fs.readFileSync(full, 'utf8'), file);
    parsed.rows.forEach(function (row) {
      var extra = byPk.get(row.p);
      if (!extra) {
        missing++;
        row.un2 = null;
        row.sh = null;
        return;
      }
      row.un2 = extra.un2;
      row.sh = extra.sh;
    });
    fs.writeFileSync(full, 'window.QB_IDX[' + parsed.id + ']=' + JSON.stringify(parsed.rows) + ';\r\n');
    written++;
    process.stdout.write('patched ' + file + '\r');
  });
  if (missing) console.warn('\nWarning: ' + missing + ' index rows had no raw record.');
  return written;
}

function patchManifest(raw) {
  var text = fs.readFileSync(MANIFEST, 'utf8');
  var m = /^window\.QB_MANIFEST=([\s\S]*);\s*$/.exec(text);
  if (!m) throw new Error('Unexpected manifest format');
  var manifest = JSON.parse(m[1]);
  manifest.generated = new Date().toISOString();
  manifest.total = raw.total;
  manifest.facets.un2 = facetRows(raw.un2Counts);
  manifest.facets.sh = facetRows(raw.shCounts);
  fs.writeFileSync(MANIFEST, 'window.QB_MANIFEST=' + JSON.stringify(manifest) + ';\r\n');
  return manifest;
}

readRaw().then(function (raw) {
  console.log('\nRead ' + raw.total + ' raw records.');
  var files = patchIndexes(raw.byPk);
  console.log('\nPatched ' + files + ' index shards.');
  var manifest = patchManifest(raw);
  console.log('Manifest facets: ' + Object.keys(manifest.facets).join(', '));
  console.log('Unit values: ' + manifest.facets.un2.length + ', set values: ' + manifest.facets.sh.length);
}).catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
