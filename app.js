(function () {
  'use strict';
  var files = [
    'app/state.js',
    'app/chapters.js',
    'app/math.js',
    'app/utils.js',
    'app/loader.js',
    'app/indexer.js',
    'app/filter.js',
    'app/card.js',
    'app/render.js',
    'app/selection.js',
    'app/csv.js',
    'app/mnr.js',
    'app/export.js',
    'app/paper.js',
    'app/pdf.js',
    'app/ui-facets.js',
    'app/ui-status.js',
    'app/ui-url.js',
    'app/dropdown.js',
    'app/events-filters.js',
    'app/events-actions.js',
    'app/init.js'
  ];
  for (var i = 0; i < files.length; i++) {
    document.write('<script src="' + files[i] + '"><\/script>');
  }
})();
