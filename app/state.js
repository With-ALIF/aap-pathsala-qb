(function () {
  'use strict';
  window.M = window.QB_MANIFEST;
  if (!window.M) {
    var el = document.getElementById('list');
    if (el) el.innerHTML = '<div class="empty"><h2>সূচি লোড হয়নি</h2></div>';
    return;
  }
  window.NSHARD = window.M.shards;
  window.PAGE = 40;
  window.IDX = window.QB_IDX;
  window.DAT = window.QB_DAT;
  window.LOADED = window.QB_LOADED;
  window.FACETS = ['db', 'un', 'y', 's', 'c', 'k', 'ty'];
  window.FACET_ID = { db: 'fDb', un: 'fUn', y: 'fY', k: 'fK', ty: 'fTy' };
  window.MULTI_FACETS = ['s', 'c'];
  window.MULTI_ID = {
    s: { field: 'msS', btn: 'fSBtn', pop: 'fSPop', list: 'fSList', count: 'fSCount', clear: 'fSClear', label: 'বিষয়' },
    c: { field: 'msC', btn: 'fCBtn', pop: 'fCPop', list: 'fCList', count: 'fCCount', clear: 'fCClear', label: 'অধ্যায়' }
  };
  window.CTRL_ID = { n: 'fN' };
  window.NONE = '__none__';
  window.TYPE_LABEL = { mcq: 'MCQ (নির্বাচনী)', written: 'Written (লিখিত)' };
  window.SUBJ_LABEL = {
    'b': 'জীববিজ্ঞান', 'B-1': 'জীববিজ্ঞান ১ম পত্র', 'B-2': 'জীববিজ্ঞান ২য় পত্র',
    'ba': 'বাংলা', 'Ba-1': 'বাংলা ১ম পত্র', 'Ba-2': 'বাংলা ২য় পত্র',
    'c': 'রসায়ন', 'C-1': 'রসায়ন ১ম পত্র', 'C-2': 'রসায়ন ২য় পত্র',
    'm': 'উচ্চতর গণিত', 'M-1': 'উচ্চতর গণিত ১ম পত্র', 'M-2': 'উচ্চতর গণিত ২য় পত্র',
    'p': 'পদার্থবিজ্ঞান', 'P-1': 'পদার্থবিজ্ঞান ১ম পত্র', 'P-2': 'পদার্থবিজ্ঞান ২য় পত্র',
    'e': 'ইংরেজি', 'En-Tex': 'ইংরেজি টেক্সট', 'En-Wri': 'ইংরেজি রাইটিং', 'Eng-Grm': 'ইংরেজি ব্যাকরণ',
    'gk': 'সাধারণ জ্ঞান', 'GK-BD': 'সাধারণ জ্ঞান — বাংলাদেশ', 'GK-Int': 'সাধারণ জ্ঞান — আন্তর্জাতিক',
    'ICT': 'তথ্য ও যোগাযোগ প্রযুক্তি', 'IQ': 'বুদ্ধিমত্তা পরীক্ষা (IQ)',
    'FMT': 'ফ্রি মক টেস্ট (FMT)', 'Live': 'লাইভ ক্লাস', 'Weekly': 'সাপ্তাহিক পরীক্ষা',
    'EXTRA': 'অতিরিক্ত প্রশ্ন',
    'সাধারন গণিত': 'সাধারণ গণিত', 'সাধারন বিজ্ঞান': 'সাধারণ বিজ্ঞান'
  };
  window.STATIC_LIST = { ty: [{ value: 'mcq' }, { value: 'written' }] };
  window.BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  window.FLAT = [];
  window.DATMAP = {};
  window.pendIdx = {};
  window.pendDat = {};
  window.state = { q: '', db: '', un: '', y: '', s: [], c: [], k: '', ty: '', n: '', p: '', sort: 'default', e: false, img: false, answers: true };
  window.results = [];
  window.shown = 0;
  window.indexReady = false;
  window.loading = false;
  window.noteOverride = null;
  window.lastSyncedHash = null;
  window.selMap = Object.create(null);
  window.selOrder = [];
})();
