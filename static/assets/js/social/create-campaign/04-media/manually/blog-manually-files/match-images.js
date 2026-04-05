/* =========================================================
MATCH-IMAGES – Modular v7.8.0 (2025-07-26)
---------------------------------------------------------
NEW (vs v7.7.0)
• miContentList ekranda maksimum 5 mi-row gösterilir (ROWS_PER_PAGE=5).
• 5’ten fazla satır varsa, thumb-box kolonlarının altında numaralı
paginate_button’lar (1,2,3...) + Prev/Next kontrolleri görünür.
• Pager butonları erişilebilir (aria-label) ve aktif sayfa mor dolgu ile işaretlenir.
• Prev/Next disable durumu ve klavye ile geçiş (←/→) eklenmiştir.
• CSS içinde .mi-row-pager ve .mi-page-btn temaya uyumlu şekilde tasarlandı.

Diğer tüm özellikler 7.7.0’daki gibi korunur.
========================================================= */
; (function (w, $) {
  'use strict';


    function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
  }
  /* ───────────── 0. GLOBALS / CONFIG ───────────── */
  const NO_CACHE = w.miNoCache === true;
  const imgMap = (w.imgMap = w.imgMap || { cover: {}, content: {} });
  const mediaFiles = (w.mediaFiles = w.mediaFiles || []);
  const mediaIndex = (w.mediaIndex = w.mediaIndex || new Set());
  let mediaSeq = (w.mediaSeq = w.mediaSeq || 1);
  let activeType = (w.activeMediaType || 'all'); // 'all' | 'cover' | 'content'

  let articleKeywords = (w.articleKeywords || {}); // { idx:[kw1,kw2...] }
  let coverageCache = {}; // { idx:{ matched,total,percent,set:Set } }
  let STORAGE_KEYS = { mapKey: 'imgMap', visitedKey: 'miVisited' };
  let VISITED_ON_THIS_SCOPE = false;

  /* Multi-select state (only for content tab) */
  let multiSel = new Set(); // src set
  let isDraggingSelect = false;

  /* Lasso state */
  let lassoState = {
    active: false,
    startX: 0,
    startY: 0,
    rectEl: null,
    hitDuringDrag: new Set()
  };

  w.evalSaveBtn = w.evalSaveBtn || function () { };
  w.updateDropzoneVisibility = w.updateDropzoneVisibility || function () { };

  /* ────────── SELECTORS ────────── */
  const SEL = {
    panel: '#matchImagesPanel',
    listWrap: '#miContentList',
    listBoxes: '#miContentList .thumb-box',
    rows: '#miContentList .mi-row',
    poolGrid: '#miPool',
    poolImgs: '#miPool img',
    poolWraps: '#miPool .thumb-wrap',
    dropzone: '#mediaDropzone',
    tabBar: '#miTabBar',
    shuffleBtn: '#miShuffle',
    autoBtn: '#miAuto',
    searchIn: '#miSearchInput',
    clearSearch: '#miClearSearch',
    pager: '#miPager', // eski prev/next holder
    prevBtn: '#miPrev',
    nextBtn: '#miNext',
    rowPager: '#miRowPager', // YENİ: numaralı pager
    summaryHost: '#miSummaryHost',
    footerBar: '#miFooterBar',
    clearAllBtn: '#miClearAll',
    lasso: '#miLasso'
  };

  const MEDIA_TABS = [
    { key: 'all', label: 'All' },
    { key: 'cover', label: 'Featured Image' },
    { key: 'content', label: 'Media in Content' }
  ];

  const SUMMARY_FIRST_COL = 'Keywords/Topic';

  const CHECK_SVG = `
<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"></polyline>
</svg>`;

  const CLEAR_SVG = `
<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
  <path d="M3 6h18M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6h10z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

  /* ───────────── 1. HELPERS ───────────── */
  const norm = s => (s || '').toLowerCase().replace(/[\s._-]+/g, '');
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); } };
  const fingerprint = f => [(f?.name || '').replace(/\.[^.]+$/, '').toLowerCase(), f?.size || 0, f?.lastModified || 0].join('|');
  const poolCount = () => $(SEL.poolImgs).length;

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  // function getScopeKey() {
  //   const cid = ($('#campaignId').val?.() || $('[data-campaign-id]').data?.('campaignId') || $('#campaign_id').val?.() || '').toString().trim();
  //   const path = (location.pathname || '').replace(/\s+/g, '').replace(/[^\w/]+/g, '_');
  //   return cid ? ('camp:' + cid) : ('path:' + path);
  // }
  w.getScopeKey = function () { // <-- ADD "w.getScopeKey =" HERE
    const cid = ($('#campaignId').val?.() || $('[data-campaign-id]').data?.('campaignId') || $('#campaign_id').val?.() || '').toString().trim();
    const path = (location.pathname || '').replace(/\s+/g, '').replace(/[^\w/]+/g, '_');
    return cid ? ('camp:' + cid) : ('path:' + path);
  };
  function isManualSource() {
    const ids = ['#sourceToggle', '#sourceHidden'];
    for (const id of ids) {
      const $el = $(id);
      if ($el.length) {
        const v = String($el.val?.() ?? $el.text?.() ?? $el.data?.('value') ?? '').toLowerCase();
        if (/(^manual$|^manually$|manual\-add|manual_add)/.test(v)) return true;
        if (v) return false;
      }
    }
    const $nameEl = $('input[name="source"]:checked, select[name="source"]');
    if ($nameEl.length) {
      const v = String($nameEl.val?.() ?? '').toLowerCase();
      if (/(^manual$|^manually$|manual\-add|manual_add)/.test(v)) return true;
      return false;
    }
    const dataVal = String($('#mediaCards').data?.('source') ?? '').toLowerCase();
    if (/(^manual$|^manually$|manual\-add|manual_add)/.test(dataVal)) return true;
    return false;
  }
  function isCardSelected(sel) {
    const $el = $(sel);
    return $el.hasClass('selected') || $el.is(':checked') || $el.attr('aria-pressed') === 'true';
  }

  /* ───────────── 1.1 LAYOUT ───────────── */
  function ensureLayoutStyles() {
    if ($('#miLayoutStyles').length) return;
    const css = `
#matchImagesPanel{
--mi-no-width: 36px;
--mi-thumb-size: 64px;
--mi-gap: 12px;
--mi-visible-max: 3;
--mi-list-pad-left: 0px;
--mi-accent: #6C4FF6;
--mi-accent-soft: rgba(108,79,246,.15);
--mi-ok: #22c55e;
--mi-ok-bg:#ecfdf5;
--mi-mid: #f6d94a;
--mi-mid-dark:#d1a100;
--mi-mid-bg:#fdf9ce;
--mi-bad: #ef4444;
--mi-gray:#9ca3af;
--mi-multi-bg: rgba(108,79,246,.12);
--mi-multi-outline: #6C4FF6;
position:relative;
}
#miFooterBar{
position:sticky; bottom:0; left:0; right:0;
background:#fff; border-top:1px solid #e5e7eb;
padding:12px 16px; display:flex; align-items:center; gap:16px; z-index:5;
}
#miFooterBar .mi-footer-text{ font-size:14px; white-space:nowrap; flex:0 0 auto; }
.mi-progress{ background:#f3f4f6; height:8px; border-radius:6px; overflow:hidden; position:relative; }
.mi-progress .bar{ background:var(--mi-accent); height:100%; width:0%; transition:width .25s ease; }
#miFooterBar .mi-progress{ flex:1 1 auto; }

/* Summary */
#miSummaryHost{ margin-top:28px; }
#miSummaryTable{ width:100%; border-collapse:separate; border-spacing:0 6px; font-size:13px; }
#miSummaryTable thead th{ text-align:left; font-weight:600; padding:6px 8px; color:#374151; }
#miSummaryTable tbody tr{ background:#f9fafb; }
#miSummaryTable tbody td{ padding:6px 8px; vertical-align:middle; }
#miSummaryTable .st-thumb-stack{ display:flex; gap:3px; align-items:center; }
#miSummaryTable .st-thumb{ width:22px; height:22px; border-radius:4px; overflow:hidden; }
#miSummaryTable .st-thumb img{ width:100%; height:100%; object-fit:cover; display:block; }
#miSummaryTable .st-badge{ background:#e5e7eb; font-size:11px; border-radius:10px; padding:2px 6px; line-height:1; display:inline-block; }
#miSummaryTable .status-good{ color:var(--mi-ok); font-weight:600; }
#miSummaryTable .status-mid{ color:var(--mi-mid-dark); font-weight:600; }
#miSummaryTable .status-bad{ color:var(--mi-bad); font-weight:600; }
#miSummaryTable .mi-progress{ height:6px; }

/* Matching mini bar */
.mi-mini{ background:#f3f4f6; height:4px; border-radius:4px; overflow:hidden; width:72px; display:inline-block; vertical-align:middle; }
.mi-mini .bar{ background:var(--mi-accent); height:100%; width:0%; transition:width .25s ease; }

/* Keyword chips */
.mi-kws{ margin-top:4px; display:flex; flex-wrap:wrap; gap:4px; }
.mi-chip{ font-size:11px; line-height:1; padding:4px 6px; border-radius:10px; background:#f3f4f6; color:#374151; display:flex; align-items:center; gap:3px; }
.mi-chip.ok{ background:var(--mi-accent-soft); color:#4c1d95; }
.mi-chip.partial{ background:#fde68a; color:#92400e; }
.mi-chip.none{ background:#e5e7eb; color:#6b7280; }

/* Tick */
.mi-tick{
position:absolute; right:6px; top:6px;
width:14px; height:14px;
color:var(--mi-ok);
opacity:0; transform:scale(.85);
transition:opacity .15s ease, transform .15s ease;
pointer-events:none;
}
.mi-row.checked .mi-tick{ opacity:1; transform:scale(1); }

/* KW based coloring (only in 'all') */
.mi-row.kw-full{ background: var(--mi-ok-bg); }
.mi-row.kw-partial{ background: var(--mi-mid-bg); }

/* Active-tab success highlight */
.mi-row.tab-match{ background: var(--mi-ok-bg); }

/* List rows */
#matchImagesPanel #miContentList{ padding-left: var(--mi-list-pad-left); position:relative; }
#matchImagesPanel #miContentList .mi-row{
position: relative;
display: grid;
grid-template-columns: var(--mi-no-width) 1fr var(--mi-thumb-size) var(--mi-thumb-size);
align-items: center;
gap: var(--mi-gap);
min-height: calc(var(--mi-thumb-size) + 8px);
border-bottom:1px solid #f3f4f6;
padding:6px 0;
transition: background .2s ease;
}
#matchImagesPanel #miContentList .mi-row .no{ text-align:right; opacity:.7; font-size:12px; }
#matchImagesPanel #miContentList .mi-row .title{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:13px; }
#matchImagesPanel #miContentList .mi-row.matched .title{ color:#111827; font-weight:500; }

/* Thumb boxes */
#matchImagesPanel #miContentList .thumb-box{
width:var(--mi-thumb-size); height:var(--mi-thumb-size);
border-radius:8px; background:#f6f6f8; outline:1px dashed #d7d7dd;
cursor:pointer; overflow:hidden; position:relative;
}
#matchImagesPanel #miContentList .thumb-box.filled{ background:transparent; outline:none; }
#matchImagesPanel .thumb-box.active{ box-shadow:0 0 0 2px var(--mi-accent); }

/* Content thumb stack */
#matchImagesPanel .thumb-box[data-type="content"] .thumb-stack{
width:100%; height:100%; display:flex; align-items:stretch; justify-content:center;
gap:2px; padding:2px;
}
#matchImagesPanel .thumb-box[data-type="content"] .thumb-stack .item{
flex:1 1 0; border-radius:6px; overflow:hidden; position:relative;
}
#matchImagesPanel .thumb-box[data-type="content"] .thumb-stack .item img{
width:100%; height:100%; object-fit:cover; display:block;
}
#matchImagesPanel .thumb-box[data-type="content"] .thumb-more{
position:absolute; right:4px; bottom:4px;
font-size:11px; line-height:1;
background:rgba(0,0,0,.65); color:#fff;
padding:3px 6px; border-radius:10px; pointer-events:none;
}

/* Pool */
#miPool{ display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; user-select:none; }
#miPool .thumb-wrap{
width:110px; height:80px; border-radius:8px; overflow:hidden; position:relative;
box-shadow:0 0 0 1px #e5e7eb; cursor:pointer;
transition:box-shadow .15s ease, background .15s ease;
}
#miPool img{ width:100%; height:100%; object-fit:cover; display:block; }
#miPool .thumb-del{
position:absolute; right:6px; top:6px; background:rgba(0,0,0,.55); color:#fff;
font-size:12px; line-height:1; padding:3px 5px; border-radius:10px; cursor:pointer;
}

/* Multi select visual */
#miPool .thumb-wrap.mi-sel{
box-shadow:0 0 0 3px var(--mi-multi-outline);
background:var(--mi-multi-bg);
}
#miPool .thumb-wrap.mi-sel::after{
content: attr(data-sel-order);
position:absolute; left:5px; top:5px;
background:var(--mi-multi-outline); color:#fff;
font-size:11px; line-height:1;
padding:2px 5px; border-radius:10px;
}

/* Anim */
#matchImagesPanel .thumb-box.need-select{ outline:2px dashed #f0a500 !important; animation: miPulse 1.2s ease-in-out 2; }
@keyframes miPulse{ 0%,100%{ box-shadow:0 0 0 0 rgba(240,165,0,.2); } 50% { box-shadow:0 0 0 6px rgba(240,165,0,.15); } }

/* Tabs */
.mi-tabs{ display:flex; gap:8px; margin:12px 0 8px; }
.mi-tab{ padding:6px 12px; font-size:13px; border-radius:20px; cursor:pointer; background:#f3f4f6; border:1px solid transparent; }
.mi-tab.active{ background:var(--mi-accent); color:#fff; }
#miTabInfo{ display:none; }

/* NEW: Clear All Button */
#miClearAll{
position:sticky;
left:0;
bottom:0;
margin:10px 0 0 0;
padding:6px 12px;
font-size:12px;
background:#f3f4f6;
border:1px solid #e5e7eb;
border-radius:8px;
display:inline-flex;
align-items:center;
gap:6px;
cursor:pointer;
z-index:4;
}
#miClearAll:hover{ background:#e5e7eb; }
@media (max-width:480px){
#miClearAll{ font-size:11px; padding:5px 10px; }
}

/* NEW: Lasso rectangle */
#miLasso{
position:fixed;
border:2px dashed var(--mi-multi-outline);
background:rgba(108,79,246,.08);
pointer-events:none;
z-index:9999;
display:none;
}

/* NEW: Row pager */
#miRowPager{
display:flex; flex-wrap:wrap; gap:6px;
margin:12px 0 18px;
align-items:center;
}
#miRowPager .mi-page-btn{
min-width:30px; height:28px; padding:0 10px;
border-radius:16px; border:1px solid #e5e7eb;
background:#f9fafb; font-size:12px;
cursor:pointer; line-height:26px; text-align:center;
transition:all .15s ease;
}
#miRowPager .mi-page-btn:hover{ background:#f3f4f6; }
#miRowPager .mi-page-btn.active{
background:var(--mi-accent); color:#fff; border-color:var(--mi-accent);
}
#miRowPager .mi-page-btn[disabled],
#miRowPager .mi-nav[disabled]{
opacity:.4; cursor:not-allowed;
}
#miRowPager .mi-nav{
padding:0 12px; height:28px; line-height:26px;
border-radius:16px; border:1px solid #e5e7eb;
background:#fff; font-size:12px; cursor:pointer;
}
#miRowPager .mi-nav:hover:not([disabled]){ background:#f3f4f6; }
`;
    $('<style id="miLayoutStyles"></style>').text(css).appendTo(document.head);
  }
const updateRowLayout = debounce(function () {
    const $panel = $(SEL.panel);
    if (!$panel.is(':visible')) return;
    const $search = $(SEL.searchIn);
    if (!$search.length) return;

    const panelLeft = $panel.offset().left;
    const searchLeft = $search.offset().left - panelLeft;
    const cs = getComputedStyle($panel.get(0));
    const noW = parseInt(cs.getPropertyValue('--mi-no-width')) || 36;
    const gap = parseInt(cs.getPropertyValue('--mi-gap')) || 12;
    let pad = Math.max(0, Math.round(searchLeft - (noW + gap)));
    $panel.css('--mi-list-pad-left', pad + 'px');
  }, 50);

  /* ───────────── 2. PANEL TOGGLE ───────────── */
  function togglePanel() {
    const manual = isManualSource();
    const coverSel = isCardSelected('#cardCover');
    const contSel = isCardSelected('#cardContent');
    const cardSel = coverSel || contSel;
    console.log('MI: togglePanel', { manual, coverSel, contSel, cardSel });

    /* Upload kutusu açılmadan panel görünmemeli  */
    const uploadShown = $('#mediaUploadBox').is(':visible');
    // const shouldShow = manual && cardSel && uploadShown;
    const shouldShow = true;
    console.log('  uploadShown=', uploadShown, ' | shouldShow=', shouldShow);


    if (shouldShow) {
      $(SEL.panel).stop(true, true).slideDown(120);
      console.log('  panel shown');
    } else {
      $(SEL.panel).stop(true, true).slideUp(120);
      console.log('  panel hidden');
    }



    if (shouldShow) $(SEL.searchIn).focus();

    updateTabVisibility(coverSel, contSel);
    updateRowLayout();
    console.log('  row layout updated');
  }

  /* ───────────── 3. SAVE MAP ───────────── */
  const storeMap = debounce(() => {
    if (!NO_CACHE) {
      try { localStorage.setItem(STORAGE_KEYS.mapKey, JSON.stringify(imgMap)); } catch (e) { }
      $(document).trigger('miMappingChanged', [imgMap]);
    }
    recalcAllCoverage();
  }, 200);

  function getKeywordByIndex(idx) {
  return _kwMasterList[idx] || String(idx); // fallback to stringified idx if missing
}

// Add this event listener in the initialization section of the code
function setupAutoSearchTrigger() {
  console.log("this function is called to setup auto search trigger");
  const searchWithDropdown = document.getElementById('searchModeSel');
  if (!searchWithDropdown) return;

  searchWithDropdown.addEventListener('change', function() {
    if (this.value === 'keyword') {
      // Auto trigger the keyword preview bar
      const kwPreviewBar = document.getElementById('kwPreviewBar');
      if (kwPreviewBar) {
        kwPreviewBar.style.display = 'block';
      }
      
      // Auto trigger the search using keywords
      const runKeywordSearchBtn = document.getElementById('runKeywordSearchBtn');
      if (runKeywordSearchBtn && runKeywordSearchBtn.style.display !== 'none') {
        runKeywordSearchBtn.click();
        
        // Auto trigger Auto-Match after search completes (2 seconds delay)
        setTimeout(() => {
          const autoMatchBtn = document.getElementById('miAuto');
          if (autoMatchBtn) {
            autoMatchBtn.click();
          }
        }, 2000);
      }
    }
  });
}


function setMapValue(type, idx, src) {
  const key = getKeywordByIndex(idx);
  imgMap[type][key] = src;
  storeMap();
}

function clearMapValue(type, idx) {
  const key = getKeywordByIndex(idx);
  delete imgMap[type][key];
  storeMap();
}


function getContentList(idx) {
  const key = getKeywordByIndex(idx);
  const v = imgMap.content[key];
  if (Array.isArray(v)) return v.slice();
  if (typeof v === 'string' && v) return [v];
  return [];
}

function setContentList(idx, arr) {
  const key = getKeywordByIndex(idx);
  if (arr && arr.length) {
    imgMap.content[key] = arr.slice();
  } else {
    delete imgMap.content[key];
  }
  storeMap();
}

  /* ───────────── 4. PLACE / CLEAR ───────────── */
  let $activeBox = null;

  function markVisited() { if (NO_CACHE) return; try { localStorage.setItem(STORAGE_KEYS.visitedKey, '1'); VISITED_ON_THIS_SCOPE = true; } catch (e) { } }

  // function renderCoverBox($box, src) {
  //   if (!src) {
  //     $box.empty().removeClass('filled').data('matched', 0).attr('data-matched', '0');
  //     updateRowState($box.closest('.mi-row'));
  //     return;
  //   }
  //   $box.html(`<img src="${src}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`)
  //     .addClass('filled').data('matched', 1).attr('data-matched', '1');
  //   updateRowState($box.closest('.mi-row'));
  // }
  // In match-images.js
  function renderCoverBox($box, src) {
    if (!src) {
      $box.empty().removeClass('filled').data('matched', 0).attr('data-matched', '0');
      $('#cardCover').removeClass('has-image'); // <-- ENSURE THIS LINE IS HERE
      updateRowState($box.closest('.mi-row'));
      return;
    }
    $box.html(`<img src="${src}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`)
      .addClass('filled').data('matched', 1).attr('data-matched', '1');
    $('#cardCover').addClass('has-image'); // <-- ENSURE THIS LINE IS HERE
    updateRowState($box.closest('.mi-row'));
  }

  function renderContentBox($box, list) {
    const arr = Array.isArray(list) ? list : [];
    if (!arr.length) {
      $box.empty().removeClass('filled multi').data('matched', 0).attr('data-matched', '0');
      updateRowState($box.closest('.mi-row'));
      return;
    }
    const root = document.querySelector(SEL.panel) || document.documentElement;
    const max = Math.max(1, parseInt(getComputedStyle(root).getPropertyValue('--mi-visible-max')) || 3);
    const visible = arr.slice(0, max);
    const extra = Math.max(0, arr.length - visible.length);

    const stackHtml = [
      `<div class="thumb-stack" aria-label="Selected ${arr.length} images">`,
      ...visible.map(src => `<div class="item" data-src="${src}"><img src="${src}" alt=""></div>`),
      `</div>`,
      extra ? `<span class="thumb-more">+${extra}</span>` : ''
    ].join('');

    $box.html(stackHtml).addClass('filled multi').data('matched', 1).attr('data-matched', '1');
    updateRowState($box.closest('.mi-row'));
  }

  function updateRowState($row) {
    const anyFilledAll = $row.find('.thumb-box.filled').length > 0;
    const $boxForTab = $row.find(`.thumb-box[data-type="${activeType}"]`);
    const matchTab = $boxForTab.hasClass('filled');

    let showTick = false;
    if (activeType === 'all') showTick = anyFilledAll;
    else showTick = matchTab;

    $row.toggleClass('checked', showTick);
    $row.toggleClass('tab-match', matchTab);
    $row.toggleClass('matched', matchTab);

    let $tick = $row.find('.mi-tick');
    if (!$tick.length) {
      $row.append('<span class="mi-tick">' + CHECK_SVG + '</span>');
      $tick = $row.find('.mi-tick');
    }
    $tick.toggle(showTick);
  }

  function placeImg($box, src) {
    if (!$box || !$box.length || !src) return;
    const idx = $box.data('idx');
    const type = $box.data('type');
    if (!VISITED_ON_THIS_SCOPE && !NO_CACHE) markVisited();

    if (type === 'content') {
      const arr = getContentList(idx);
      if (!arr.includes(src)) arr.push(src);
      setContentList(idx, arr);
      renderContentBox($box, arr);
    } else {
      renderCoverBox($box, src);
      setMapValue(type, idx, src);
    }

    $box.removeClass('active');
    $activeBox = null;
    w.evalSaveBtn();
  }

  function placeMulti($box, srcList) {
    if (!$box || !$box.length || !srcList || !srcList.length) return;
    srcList.forEach(src => placeImg($box, src));
  }

  // function clearBox($box) {
  //   const idx = $box.data('idx');
  //   const type = $box.data('type');

  //   if (type === 'content') {
  //     setContentList(idx, []);
  //     renderContentBox($box, []);
  //     w.evalSaveBtn();
  //     return;
  //   }
  //   $box.empty().removeClass('filled matched active').data('matched', 0).attr('data-matched', '0');
  //   clearMapValue(type, idx);
  //   updateRowState($box.closest('.mi-row'));
  //   w.evalSaveBtn();
  // }
  function clearBox($box) {
    const idx = $box.data('idx');
    const type = $box.data('type');

    if (type === 'content') {
      setContentList(idx, []);
      renderContentBox($box, []);
      w.evalSaveBtn();
      return;
    }
    // This part handles the 'cover' type
    $box.empty().removeClass('filled matched active').data('matched', 0).attr('data-matched', '0');
    $('#cardCover').removeClass('has-image'); // <-- ENSURE THIS LINE IS HERE
    clearMapValue(type, idx);
    updateRowState($box.closest('.mi-row'));
    w.evalSaveBtn();
  }
  function clearAll(type = activeType) {
    $(SEL.listBoxes).filter(`[data-type="${type}"]`).each(function () { clearBox($(this)); });
  }

  /* NEW: Clear depending on active tab (handles 'all') */
  function clearAllActive() {
    if (activeType === 'all') {
      clearAll('cover');
      clearAll('content');
    } else {
      clearAll(activeType);
    }
  }

  /* ───────────── 5. SHUFFLE / AUTO-MATCH ───────────── */
  function shuffle() {
    clearAll(activeType);
    const boxes = $(SEL.listBoxes).filter(`[data-type="${activeType}"]`).toArray();
    const imgs = $(SEL.poolImgs).toArray();
    if (!boxes.length || !imgs.length) return;
    const mix = a => a.sort(() => Math.random() - 0.5);

    if (activeType === 'content') {
      const feed = mix(imgs);
      boxes.forEach((b, i) => {
        const $b = $(b);
        const src = $(feed[i % feed.length]).attr('src');
        placeImg($b, src);
      });
      return;
    }
    const feed = imgs.length >= boxes.length
      ? mix(imgs).slice(0, boxes.length)
      : (function () { let f = []; while (f.length < boxes.length) f.push(...mix(imgs)); return f.slice(0, boxes.length); })(); boxes.forEach((b, i) => placeImg($(b), $(feed[i]).attr('src')));
  }

async function autoMatch() {
  console.log('Auto-Match started');
  const btn = document.getElementById('miAuto');
  if (!btn) return;

  btn.disabled = true;
  btn.innerHTML = '\u003ci\u003e↻\u003c/i\u003e Completing...';

  const imagePlatform = document.getElementById('imgSourceSel')?.value;
  if (!imagePlatform) {
    alert('Please select an image source (like Pexels) from the "Auto Search" section first.');
    btn.disabled = false;
    btn.innerHTML = '⚡ Auto-Match';
    return;
  }

  // Determine which boxes should be filled
  const coverSelected = document.getElementById('cardCover')?.classList.contains('selected');
  const contentSelected = document.getElementById('cardContent')?.classList.contains('selected');

  // Get all VISIBLE keyword rows
  const keywordRows = document.querySelectorAll('#miContentList .mi-row:not([style*="display: none"])');
  if (keywordRows.length === 0) {
    alert('No keywords are visible to match.');
    btn.disabled = false;
    btn.innerHTML = '⚡ Auto-Match';
    return;
  }

  // Clear the visible matches before starting
  keywordRows.forEach(row => {
    const coverBox = row.querySelector('.thumb-box[data-type="cover"]');
    const contentBox = row.querySelector('.thumb-box[data-type="content"]');

    if (coverSelected && coverBox) clearBox($(coverBox));
    if (contentSelected && contentBox) clearBox($(contentBox));
  });

  // Create API call promises for each row
  const promises = Array.from(keywordRows).map(row => {
    const keyword = row.dataset.keyword;
    const coverBox = row.querySelector('.thumb-box[data-type="cover"]');
    const contentBox = row.querySelector('.thumb-box[data-type="content"]');

    const baseUrl = window.autoMatchUrl || '/api/media/auto-match/';
    const url = `${baseUrl}?keyword=${encodeURIComponent(keyword)}&imageSourcePlatform=${imagePlatform}`;

    return fetch(url)
      .then(response => response.ok ? response.json() : null)
      .then(data => {
          if (data?.status === 'success') {
    if (Array.isArray(data.images) && data.images.length > 0) {

        // pick 2 different random images
        const rand1 = Math.floor(Math.random() * data.images.length);
        let rand2 = Math.floor(Math.random() * data.images.length);

        // ensure they are not the same
        if (rand2 === rand1 && data.images.length > 1) {
            rand2 = (rand1 + 1) % data.images.length;
        }

        const coverImage = data.images[rand1];
        const contentImage = data.images[rand2];

        if (coverSelected && coverBox) {
            placeImg($(coverBox), coverImage);
        }
        if (contentSelected && contentBox) {
            placeImg($(contentBox), contentImage);
        }

    } else if (data.imageUrl) {
        // If only ONE image returned, still apply separately
        if (coverSelected && coverBox) {
            placeImg($(coverBox), data.imageUrl);
        }
        if (contentSelected && contentBox) {
            placeImg($(contentBox), data.imageUrl); 
        }
    }
}
      })
      .catch(error => console.error(`Failed to fetch image for ${keyword}:`, error));
  });

  await Promise.all(promises);

  btn.disabled = false;
  btn.innerHTML = '⚡ Auto-Match';
}

  /* ───────────── 6. BUILD LIST + PAGINATION ───────────── */
  const ROWS_PER_PAGE = 5; // YENİ
  const LEGACY_PAGE_SIZE = 100; // summary vb. için dokunmuyoruz, sadece satır render'ı etkiler

  let _currentPage = 0;
  let _totalPages = 1;
  let _kwMasterList = [];

  function buildMiContent(kwList = []) {
    _kwMasterList = kwList.slice();
    _totalPages = Math.max(1, Math.ceil(_kwMasterList.length / ROWS_PER_PAGE));
    _currentPage = Math.min(_currentPage, _totalPages - 1);
    drawRows();
    buildNumericPager();
  }

  function drawRows() {
    const $wrap = $(SEL.listWrap);
    $wrap.empty();

    const start = _currentPage * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;
    const slice = _kwMasterList.slice(start, end);

    slice.forEach((txt, i) => {
      const idx = start + i;
      const kws = Array.isArray(articleKeywords[idx]) ? articleKeywords[idx] : [];
      const htmlRow = `
  <div class="mi-row" data-idx="${idx}"data-keyword="${escapeHtml(txt)}">
    <span class="no">${idx + 1}</span>
    <span class="title">${escapeHtml(txt)}</span>
    <div class="thumb-box" data-idx="${idx}" data-type="cover" data-matched="0"></div>
    <div class="thumb-box" data-idx="${idx}" data-type="content" data-matched="0"></div>
    ${kws.length ? renderKwChipsHTML(idx, kws) : ''}
    <span class="mi-tick">${CHECK_SVG}</span>
  </div>`;
      $wrap.append(htmlRow);
    });

    ensureClearAllButton();

    if (VISITED_ON_THIS_SCOPE && !NO_CACHE) {
      restoreMapForPage(slice, start);
    } else {
      $wrap.find('.thumb-box').removeClass('filled multi').empty();
      $wrap.find('.mi-row').removeClass('matched checked tab-match kw-full kw-partial');
    }

    applyTypeVisibility();
    updateRowLayout();
    recalcAllCoverage();
  }

  function restoreMapForPage(slice, startIndex) {
    slice.forEach((_, i) => {
      const idx = startIndex + i;

      /* cover */
const key = getKeywordByIndex(idx);
const coverSrc = imgMap.cover[key];
      if (coverSrc && imageExistsInPool(coverSrc)) {
        const $c = $(`${SEL.listBoxes}[data-type="cover"][data-idx="${idx}"]`);
        if ($c.length) renderCoverBox($c, coverSrc);
      } else { delete imgMap.cover[key]; }

      /* content */
      const v = imgMap.content[key];
      if (v) {
        const arr = (Array.isArray(v) ? v : [v]).filter(src => imageExistsInPool(src));
        if (arr.length) {
          const $ct = $(`${SEL.listBoxes}[data-type="content"][data-idx="${idx}"]`);
          if ($ct.length) renderContentBox($ct, arr);
          imgMap.content[key] = arr;
        } else { delete imgMap.content[key]; }
      }
      updateRowState($(`.mi-row[data-idx="${idx}"]`));
    });
  }

  /* --------- Numeric Pager --------- */
  function buildNumericPager() {
    let $pager = $(SEL.rowPager);
    if (!$pager.length) {
      $pager = $('<div id="miRowPager" aria-label="Rows pagination"></div>');
      // thumb-box sütunlarının altına yerleştir: listWrap'ten sonra
      $(SEL.listWrap).after($pager);
    }
    $pager.empty();

    // Prev
    const $prev = $('<button class="mi-nav mi-prev" aria-label="Previous page">&laquo;</button>')
      .prop('disabled', _currentPage === 0)
      .on('click', () => { goPage(_currentPage - 1); });
    $pager.append($prev);

    // numbers
    for (let p = 0; p < _totalPages; p++) {
      const $btn = $('<button class="mi-page-btn" type="button"></button>')
        .text(p + 1)
        .attr({ 'data-page': p, 'aria-label': `Page ${p + 1}` })
        .toggleClass('active', p === _currentPage)
        .on('click', () => { goPage(p); });
      $pager.append($btn);
    }

    // Next
    const $next = $('<button class="mi-nav mi-next" aria-label="Next page">&raquo;</button>')
      .prop('disabled', _currentPage >= _totalPages - 1)
      .on('click', () => { goPage(_currentPage + 1); });
    $pager.append($next);

    // Klavye ← →
    $(document).off('keydown.miPager').on('keydown.miPager', function (e) {
      if (e.target && /input|textarea|select/.test(e.target.tagName.toLowerCase())) return;
      if (e.key === 'ArrowRight' && _currentPage < _totalPages - 1) { goPage(_currentPage + 1); } if (e.key === 'ArrowLeft' && _currentPage > 0) { goPage(_currentPage - 1); }
    });
  }

  function goPage(p) {
    if (p < 0 || p >= _totalPages) return;
    _currentPage = p;
    drawRows();
    buildNumericPager();
  }

  /* ───────────── 6.1 KW chips ───────────── */
  function renderKwChipsHTML(idx, kws) {
    return `<div class="mi-kws" data-idx="${idx}">${kws.map(k => `<span class="mi-chip none" data-kw="${escapeHtml(k)}"><span class="icon">○</span>${escapeHtml(k)}</span>`).join('')}</div>`;
  }
  function updateKwChips(idx, matchedSet) {
    const $wrap = $(`.mi-kws[data-idx="${idx}"]`);
    if (!$wrap.length) return;
    const kws = articleKeywords[idx] || [];
    kws.forEach(kw => {
      const $chip = $wrap.find(`.mi-chip[data-kw="${CSS.escape(kw)}"]`);
      if (!$chip.length) return;
      let cls = 'none', icon = '○';
      if (matchedSet.has(kw)) { cls = 'ok'; icon = '✓'; }
      $chip.removeClass('ok partial none').addClass(cls).find('.icon').text(icon);
    });
  }

  /* ───────────── 7. TABS ───────────── */
  function ensureTabBar() {
    if ($(SEL.tabBar).length) return;
    const $bar = $('<div id="miTabBar" class="mi-tabs"></div>');
    MEDIA_TABS.forEach(t => $bar.append(`<button class="mi-tab" data-type="${t.key}">${t.label}</button>`));
    $(SEL.poolGrid).before($bar);
    $('<div id="miSummaryHost"></div>').insertAfter($(SEL.poolGrid));
  }
  function syncCardSelectionState(type) {
    const cardMap = {
      cover: '#cardCover',
      content: '#cardContent'
    };

    // First, clear the 'is-selecting' state from all cards
    $('.media-card').removeClass('is-selecting');

    // Then, apply the 'is-selecting' state to the active card
    if (cardMap[type]) {
      $(cardMap[type]).addClass('is-selecting');
      // Also update the global context variable for consistency
      window.selectionContext = cardMap[type].substring(1); // Result: 'cardCover' or 'cardContent'
    } else {
      // If the tab is 'all', no specific card is being selected
      window.selectionContext = null;
    }
  }
  // function switchTab(type) {
  //   activeType = type;
  //   w.activeMediaType = type;
  //   clearMultiSel();
  //   endLasso();
  //   $(`${SEL.tabBar} .mi-tab`).removeClass('active').filter(`[data-type="${type}"]`).addClass('active');
  //   applyTypeVisibility();
  //   updateRowLayout();
  //   renderSummaryIfNeeded();
  // }
  function switchTab(type) {
    activeType = type;
    w.activeMediaType = type;
    clearMultiSel();
    endLasso();
    $(`${SEL.tabBar} .mi-tab`).removeClass('active').filter(`[data-type="${type}"]`).addClass('active');
    applyTypeVisibility();

    syncCardSelectionState(type); // <-- ADD THIS LINE HERE

    updateRowLayout();
    renderSummaryIfNeeded();
  }
  function applyTypeVisibility() {
    $(SEL.listBoxes).hide().filter(`[data-type="${activeType}"]`).show();
    $(SEL.rows).each(function () { updateRowState($(this)); });
    updateRowLayout();
  }
  function updateTabVisibility(coverSel, contSel) {
    ensureTabBar();
    if (coverSel && contSel) {
      $(SEL.tabBar).show();
      if (!['cover', 'content', 'all'].includes(activeType)) switchTab('cover'); else switchTab(activeType);
    } else {
      const forced = coverSel ? 'cover' : 'content';
      switchTab(forced);
      $(SEL.tabBar).hide();
    }
    renderSummaryIfNeeded();
  }

  /* ───────────── 8. COVERAGE / MATCHING / SUMMARY / FOOTER ───────────── */
  function getImageTags(src) {
    const $im = $(SEL.poolImgs).filter(function () { return this.src === src; }).first();
    if (!$im.length) return [];
    const tags = ($im.data('tags') || $im.attr('data-tags') || '').toString().trim();
    if (!tags) return [];
    return Array.from(new Set(tags.split(',').map(s => s.trim()).filter(Boolean)));
  }
  function calcFallbackPercent(idx) {
    const filledCover = imgMap.cover[idx] ? 1 : 0;
    const filledMedia = getContentList(idx).length;
    const totalSlots = 1 + filledMedia;
    const percent = (filledCover + filledMedia) ? 100 : 0;
    return { matched: (filledCover + filledMedia), total: totalSlots, percent, set: new Set() };
  }
  function calcCoverageForIndex(idx) {
    const kws = articleKeywords[idx] || [];
    if (!kws.length) return (coverageCache[idx] = calcFallbackPercent(idx));

    const set = new Set();
    const fSrc = imgMap.cover[idx];
    if (fSrc) getImageTags(fSrc).forEach(t => { if (kws.includes(t)) set.add(t); });
    getContentList(idx).forEach(src => {
      getImageTags(src).forEach(t => { if (kws.includes(t)) set.add(t); });
    });

    const matched = set.size, total = kws.length;
    let percent = total ? Math.round((matched / total) * 100) : 0;
    if (percent === 0 && (fSrc || getContentList(idx).length)) {
      const fb = calcFallbackPercent(idx);
      percent = Math.max(percent, fb.percent);
    }
    return (coverageCache[idx] = { matched, total, percent, set });
  }
  function calcMatchingScore(idx) {
    const hasFeat = !!imgMap.cover[idx];
    const hasMedia = getContentList(idx).length > 0;
    return (hasFeat ? 50 : 0) + (hasMedia ? 50 : 0);
  }

  function recalcAllCoverage() {
    const $rows = $(SEL.rows);
    if (!$rows.length) return;
    $rows.each(function () {
      const idx = $(this).data('idx');
      const result = calcCoverageForIndex(idx);
      updateKwChips(idx, result.set);

      $(this).removeClass('kw-full kw-partial');
      if (activeType === 'all' && result.total > 0) {
        if (result.percent === 100) $(this).addClass('kw-full');
        else if (result.percent > 0) $(this).addClass('kw-partial');
      }
    });
    renderSummaryIfNeeded();
    updateFooterBar();
  }

  function renderSummaryIfNeeded() {
    if (activeType !== 'all') { $(SEL.summaryHost).empty(); return; }
    const $host = $(SEL.summaryHost);
    const dataRows = [];
    const totalLen = _kwMasterList.length;
    for (let idx = 0; idx < totalLen; idx++) { const title = _kwMasterList[idx] || ''; const fsrc = imgMap.cover[idx]; const mArr = getContentList(idx); const match = calcMatchingScore(idx); let statusTxt = 'Missing', statusCls = 'status-bad'; if (match === 100) { statusTxt = 'Good'; statusCls = 'status-good'; } else if (match === 50) { statusTxt = 'Needs improvement'; statusCls = 'status-mid'; } dataRows.push({ idx, title, fsrc, mArr, match, statusTxt, statusCls }); } const tableHTML = ` <table id="miSummaryTable" aria-label="Matching Summary">
          <thead>
            <tr>
              <th>${SUMMARY_FIRST_COL}</th>
              <th>Featured Image</th>
              <th>Media in Content</th>
              <th>Matching</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${dataRows.map(r => {
      const fCell = r.fsrc ? `<div class="st-thumb"><img src="${r.fsrc}" alt=""></div> 1/1` : `0/1`;
      const mediaThumbs = r.mArr.slice(0, 3).map(src => `<div class="st-thumb"><img src="${src}" alt=""></div>`).join('');
      const mediaBadge = r.mArr.length > 3 ? `<span class="st-badge">+${r.mArr.length - 3}</span>` : '';
      const mediaCell = r.mArr.length ? `<div class="st-thumb-stack">${mediaThumbs}${mediaBadge}</div> ${r.mArr.length}` : `0/0`;

      const matchBar = `<div class="mi-mini" aria-label="${r.match}%">
              <div class="bar" style="width:${r.match}%;"></div>
            </div> <span style="font-size:11px;color:#6b7280;">${r.match}%</span>`;

      return `<tr data-idx="${r.idx}">
              <td>${escapeHtml(r.title)}</td>
              <td>${fCell}</td>
              <td>${mediaCell}</td>
              <td>${matchBar}</td>
              <td class="${r.statusCls}">${r.statusTxt}</td>
            </tr>`;
    }).join('')}
          </tbody>
          </table>`;
    $host.html(`<h4 style="margin:12px 0 10px;font-size:14px;font-weight:600;">All Summary</h4>${tableHTML}`);
  }

  /* Footer */
  function ensureFooterBar() {
    if ($(SEL.footerBar).length) return;
    const html = `
          <div id="miFooterBar" role="region" aria-label="Keywords Matching">
            <span class="mi-footer-text">Keywords Matching</span>
            <div class="mi-progress">
              <div class="bar"></div>
            </div>
            <span class="mi-footer-text mi-footer-val"></span>
          </div>`;
    $(SEL.panel).append(html);
  }
  function updateFooterBar() {
    ensureFooterBar();
    let matched = 0, total = 0;
    Object.keys(coverageCache).forEach(idx => {
      matched += coverageCache[idx].matched;
      total += coverageCache[idx].total;
    });
    const percent = total ? Math.round((matched / total) * 100) : 0;
    $(`${SEL.footerBar} .mi-progress .bar`).css('width', percent + '%');
    $(`${SEL.footerBar} .mi-footer-val`).text(`${percent}% matched (${matched}/${total})`);
  }

  /* ───────────── 9. MULTI SELECT HELPERS ───────────── */
  function clearMultiSel() {
    if (!multiSel.size) return;
    multiSel.clear();
    $(SEL.poolWraps).removeClass('mi-sel').removeAttr('data-sel-order');
  }

  function toggleWrapSel($wrap) {
    const src = $wrap.find('img').attr('src');
    if (multiSel.has(src)) {
      multiSel.delete(src);
      $wrap.removeClass('mi-sel').removeAttr('data-sel-order');
    } else {
      multiSel.add(src);
      $wrap.addClass('mi-sel').attr('data-sel-order', multiSel.size);
    }
  }

  function selectWrap($wrap) {
    const src = $wrap.find('img').attr('src');
    if (multiSel.has(src)) return;
    multiSel.add(src);
    $wrap.addClass('mi-sel').attr('data-sel-order', multiSel.size);
  }

  function deselectWrap($wrap) {
    const src = $wrap.find('img').attr('src');
    if (!multiSel.has(src)) return;
    multiSel.delete(src);
    $wrap.removeClass('mi-sel').removeAttr('data-sel-order');
  }

  function currentMultiList() { return Array.from(multiSel); }

  /* ───────────── 9.1 LASSO SELECTION ───────────── */
  function ensureLassoEl() {
    if ($(SEL.lasso).length) return;
    $('<div id="miLasso"></div>').appendTo('body');
  }

  function startLasso(e) {
    if (e.button !== 0) return;
    if (activeType !== 'content') return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
    if ($(e.target).closest('.thumb-del').length) return;

    isDraggingSelect = true;
    lassoState.active = true;
    lassoState.startX = e.clientX;
    lassoState.startY = e.clientY;
    lassoState.hitDuringDrag.clear();

    ensureLassoEl();
    lassoState.rectEl = document.querySelector(SEL.lasso);
    Object.assign(lassoState.rectEl.style, {
      left: lassoState.startX + 'px',
      top: lassoState.startY + 'px',
      width: '0px',
      height: '0px',
      display: 'block'
    });

    $(document)
      .on('mousemove.miLasso', onLassoMove)
      .on('mouseup.miLasso', endLasso);
  }

  function onLassoMove(e) {
    if (!lassoState.active) return;
    const x1 = Math.min(lassoState.startX, e.clientX);
    const y1 = Math.min(lassoState.startY, e.clientY);
    const x2 = Math.max(lassoState.startX, e.clientX);
    const y2 = Math.max(lassoState.startY, e.clientY);

    const rect = { left: x1, top: y1, right: x2, bottom: y2, width: x2 - x1, height: y2 - y1 };
    Object.assign(lassoState.rectEl.style, {
      left: rect.left + 'px',
      top: rect.top + 'px',
      width: rect.width + 'px',
      height: rect.height + 'px'
    });

    $(SEL.poolWraps).each(function () {
      const el = this.getBoundingClientRect();
      const intersect = !(el.right < rect.left || el.left > rect.right || el.bottom < rect.top || el.top > rect.bottom);
      const src = $(this).find('img').attr('src');
      if (intersect && !lassoState.hitDuringDrag.has(src)) {
        lassoState.hitDuringDrag.add(src);
        if (multiSel.has(src)) {
          deselectWrap($(this));
        } else {
          selectWrap($(this));
        }
      }
    });
  }

  function endLasso() {
    if (!lassoState.active) return;
    isDraggingSelect = false;
    lassoState.active = false;
    if (lassoState.rectEl) lassoState.rectEl.style.display = 'none';
    $(document).off('mousemove.miLasso mouseup.miLasso');

    if (activeType === 'content' && multiSel.size) {
      if (!$activeBox || !$activeBox.length) {
        // kullanıcı kutu seçsin
      } else {
        placeMulti($activeBox, currentMultiList());
        clearMultiSel();
      }
    }
  }

  /* ───────────── 10. UI BINDINGS ───────────── */
  function flashSelectHint() {
    if (activeType !== 'content') return;
    const $boxes = $(SEL.listBoxes).filter('[data-type="content"]:visible').slice(0, 3);
    $boxes.addClass('need-select');
    setTimeout(() => $boxes.removeClass('need-select'), 1200);
  }

  /* NEW: ensure button creation */
  function ensureClearAllButton() {
    if ($(SEL.clearAllBtn).length) return;
    const btn = $(
      `<button id="miClearAll" type="button" title="Clear all matches in this tab">
                ${CLEAR_SVG}<span>Clear All</span>
              </button>`
    );
    $(SEL.listWrap).append(btn);
  }

  function bindUI() {
    /* Tabs */
    $(document)
      .off('click.miTabs')
      .on('click.miTabs', '.mi-tab', function () { switchTab($(this).data('type')); });

    /* Box select */
    $(document)
      .off('click.miBox')
      .on('click.miBox', '.thumb-box', function () {
        $('.thumb-box').removeClass('active');
        $activeBox = $(this).addClass('active');

        if (activeType === 'content' && multiSel.size) {
          placeMulti($activeBox, currentMultiList());
          clearMultiSel();
        }
      });

    /* Cover img click → clear */
    $(document)
      .off('click.miBoxImg')
      .on('click.miBoxImg', '.thumb-box[data-type="cover"].filled img', function (e) {
        e.stopPropagation();
        clearBox($(this).closest('.thumb-box'));
      });

    /* Content item click → remove single */
    $(document)
      .off('click.miRemoveItem')
      .on('click.miRemoveItem', '.thumb-box[data-type="content"] .thumb-stack .item', function (e) {
        e.stopPropagation();
        const $item = $(this);
        const src = $item.find('img').attr('src') || $item.data('src');
        const $box = $item.closest('.thumb-box');
        const idx = $box.data('idx');
        const arr = getContentList(idx).filter(s => s !== src);
        setContentList(idx, arr);
        renderContentBox($box, arr);
        w.evalSaveBtn();
      });

    /* Content box dblclick → clear all */
    $(document)
      .off('dblclick.miClearAllBox')
      .on('dblclick.miClearAllBox', '.thumb-box[data-type="content"]', function (e) {
        e.stopPropagation();
        clearBox($(this));
      });

    /* Pool click → place / select */
    $(document)
      .off('click.miGrid')
      .on('click.miGrid', `${SEL.poolWraps}`, function (e) {
        const $wrap = $(this);

        if (isDraggingSelect) return;

        if (activeType === 'content' && (e.ctrlKey || e.metaKey || e.shiftKey)) {
          toggleWrapSel($wrap);
          return;
        }

        if (activeType === 'content' && multiSel.size) {
          if (!$activeBox || !$activeBox.length) {
            flashSelectHint(); return;
          }
          placeMulti($activeBox, currentMultiList());
          clearMultiSel();
          return;
        }

        let target = $activeBox;
        if ((!target || !target.length) && activeType === 'content') {
          target = $(SEL.listBoxes).filter('[data-type="content"]:visible').first();
          if (!target.length) { flashSelectHint(); return; }
        }
        if ((!target || !target.length) && activeType === 'cover') {
          target = $(SEL.listBoxes).filter('[data-type="cover"]').filter((_, b) => !$(b).hasClass('filled')).first();
        }
        if (target && target.length) {
          const src = $wrap.find('img').attr('src');
          placeImg(target, src);
        }
      });

    /* Drag start */
    $(document)
      .off('dragstart.mi')
      .on('dragstart.mi', `${SEL.poolImgs}`, function (e) {
        if (activeType === 'content' && multiSel.size > 1) {
          e.originalEvent.dataTransfer.setData('text/plain', currentMultiList().join('||'));
        } else {
          e.originalEvent.dataTransfer.setData('text/plain', this.src);
        }
      });

    /* Dragover & Drop */
    $(document)
      .off('dragover.mi')
      .on('dragover.mi', '.thumb-box', e => e.preventDefault())
      .off('drop.mi')
      .on('drop.mi', '.thumb-box', e => {
        e.preventDefault();
        const $box = $(e.currentTarget);
        const data = e.originalEvent.dataTransfer.getData('text/plain');
        const parts = data.includes('||') ? data.split('||').filter(Boolean) : [data];
        if ($box.data('type') === 'content' && parts.length > 1) {
          placeMulti($box, parts);
        } else {
          placeImg($box, parts[0]);
        }
        clearMultiSel();
      });

    /* ESC → multi clear & lasso cancel */
    $(document)
      .off('keydown.miEsc')
      .on('keydown.miEsc', function (e) { if (e.key === 'Escape') { clearMultiSel(); endLasso(); } });

    /* Buttons */
    $(document)
      .off('click.miButtons')
      .on('click.miButtons', SEL.shuffleBtn, shuffle)
      .on('click.miButtons', SEL.autoBtn, autoMatch)
      .on('click.miButtons', SEL.clearAllBtn, function () { clearAllActive(); });

    /* Search */
    $(SEL.searchIn)
      .off('input.mi')
      .on('input.mi', function () {
        const q = this.value.trim().toLowerCase();
        $(SEL.rows).each(function () {
          const t = $(this).find('.title').text().toLowerCase();
          $(this).toggle(!q || t.includes(q));
        });
        updateRowLayout();
      });
    $(SEL.clearSearch)
      .off('click.mi')
      .on('click.mi', () => { $(SEL.searchIn).val('').trigger('input').focus(); });

    /* Pool delete */
    $(document)
      .off('click.miDel')
      .on('click.miDel', '.thumb-del', function (e) {
        e.stopPropagation();
        const $wrap = $(this).closest('.thumb-wrap');
        const $img = $wrap.find('img');
        const fp = $img.data('fp');
        const src = $img.attr('src');

        multiSel.delete(src);
        mediaIndex.delete(fp);
        try { if (src && src.startsWith('blob:')) URL.revokeObjectURL(src); } catch (e) { }
        $wrap.remove();
        w.updateDropzoneVisibility();
        recalcAllCoverage();
      });

    /* Source/card toggle */
    $(document)
      .off('click.miCards change.miSource')
      .on('click.miCards', '#mediaCards .media-card', () => setTimeout(togglePanel, 0))
      .on('change.miSource', '#sourceToggle, #sourceHidden, input[name="source"], select[name="source"]', togglePanel);

    /* Resize */
    $(w).off('resize.miLayout').on('resize.miLayout', updateRowLayout);

    /* Keyword events */
    $(document).off('kw.ready kw.changed').on('kw.ready kw.changed', syncKeywordsToPanel);

    /* File inputs & paste */
    // $(document)
    //   .off('change.miFile')
    //   .on('change.miFile', `${SEL.dropzone} input[type="file"]`, function () {
    //     const files = Array.from(this.files || []);
    //     files.forEach(f => { const url = URL.createObjectURL(f); registerMediaToPool(f, url, 'all'); });
    //     this.value = '';
    //   });

    // $(document)
    //   .off('change.miDZ')
    //   .on('change.miDZ', `${SEL.dropzone} .dz-hidden-input`, function () {
    //     const files = Array.from(this.files || []);
    //     files.forEach(f => { const url = URL.createObjectURL(f); registerMediaToPool(f, url, 'all'); });
    //     this.value = '';
    //   });

    $(document)
      .off('paste.miPool')
      .on('paste.miPool', function (e) {
        const items = e.originalEvent.clipboardData?.items || [];
        for (const it of items) {
          if (it.kind === 'file') {
            const f = it.getAsFile();
            if (f) {
              const url = URL.createObjectURL(f);
              registerMediaToPool(f, url, 'all');
            }
          }
        }
      });

    /* LASSO bindings */
    $(document)
      .off('mousedown.miLassoStart')
      .on('mousedown.miLassoStart', SEL.poolGrid, startLasso);
  }

  /* ───────────── 11. REGISTER TO POOL ───────────── */
  function urlToName(url) {
    try {
      const u = new URL(url, location.href);
      return decodeURIComponent(u.pathname.split('/').pop() || 'image');
    } catch (e) {
      const m = String(url || '').split('?')[0].split('#')[0].split('/').pop();
      return m || 'image';
    }
  }
  function registerMediaToPool(file, url, type = 'all') {
    if (!file && !url) return false;
    let fp = file ? fingerprint(file) : `url::${url}`;
    if (mediaIndex.has(fp)) return false;

    const base = (file?.name || urlToName(url) || '').replace(/\.[^.]+$/, '').toLowerCase();
    const $dupe = $(SEL.poolImgs).filter(function () { return (this.dataset.name || '').toLowerCase() === base; });

    if ($dupe.length && file) {
      const ok = confirm('A file with the same name already exists. Replace it?');
      if (!ok) return false;
      const oldFp = $dupe.data('fp');
      mediaIndex.delete(oldFp);
      $dupe.closest('.thumb-wrap').remove();
    }

    mediaIndex.add(fp);
    const id = 'u' + (mediaSeq++);
    const previewUrl = url || (file ? URL.createObjectURL(file) : '');

    mediaFiles.push({ id, name: (file?.name || urlToName(previewUrl)), preview: previewUrl, type });

    const $img = $('<img>', {
      src: previewUrl,
      draggable: true,
      'data-fid': id,
      'data-name': base,
      'data-fp': fp
    });

    $img.on('error', function () {
      try { if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl); } catch (e) { }
      mediaIndex.delete(fp);
      $(this).closest('.thumb-wrap').remove();
    });

    const $wrap = $('<div>', { class: 'thumb-wrap', 'data-type': type })
      .append($img)
      .append($('<span>', { class: 'thumb-del', text: '✖', title: 'Remove from pool' }));
    $(SEL.poolGrid).append($wrap);
    w.updateDropzoneVisibility();
    return true;
  }

  function imageExistsInPool(src) {
    return $(SEL.poolImgs).filter(function () { return this.src === src; }).length > 0;
  }

  /* ───────────── 12. KW SOURCE ───────────── */
  let lastKwSignature = '';
  let kwObserverBody = null;
  let kwRetryTimer = null;
  let kwRetryCount = 0;

  function readKeywordsFromPage() {
    if (Array.isArray(w.kwList) && w.kwList.length) return w.kwList.slice();
    if (Array.isArray(w.keywords) && w.keywords.length) return w.keywords.slice();

    const $wrap = $('#kwTable_wrapper');
    let list = [];

    if ($wrap.length) {
      const $table = $wrap.find('table').first();
      if ($table.length) {
        $table.find('tbody tr').each(function () {
          const txt = $(this).find('td').first().text().trim();
          if (txt) list.push(txt);
        });
      } else {
        $wrap.find('[data-kw], .kw, .keyword').each(function () {
          const txt = ($(this).data('kw') || $(this).text() || '').toString().trim();
          if (txt) list.push(txt);
        });
      }
    }
    if (!list.length) {
      const $table = $('#kwTable');
      if ($table.length) {
        $table.find('tbody tr').each(function () {
          const txt = $(this).find('td').first().text().trim();
          if (txt) list.push(txt);
        });
      }
    }
    return Array.from(new Set(list.filter(Boolean)));
  }

  function syncKeywordsToPanel() {
    const list = readKeywordsFromPage();
    const signature = list.join('||');
    if (list.length && signature !== lastKwSignature) {
      lastKwSignature = signature;
      buildMiContent(list);
      return;
    }
    updateRowLayout();
  }

  function ensureKwObservers() {
    const $wrap = $('#kwTable_wrapper');
    if ($wrap.length) {
      const mo = new MutationObserver(debounce(syncKeywordsToPanel, 100));
      mo.observe($wrap.get(0), { childList: true, subtree: true, characterData: true });
    }
    if (!kwObserverBody) {
      kwObserverBody = new MutationObserver(debounce(() => {
        if ($('#kwTable_wrapper').length || $('#kwTable').length) syncKeywordsToPanel();
      }, 150));
      kwObserverBody.observe(document.body, { childList: true, subtree: true });
    }
    const doRetry = () => {
      kwRetryCount++;
      syncKeywordsToPanel();
      if (lastKwSignature || kwRetryCount >= 10) {
        clearInterval(kwRetryTimer); kwRetryTimer = null;
      }
    };
    if (!kwRetryTimer) {
      kwRetryTimer = setInterval(doRetry, 300);
      setTimeout(() => { if (kwRetryTimer) { clearInterval(kwRetryTimer); kwRetryTimer = null; } }, 5000);
    }
  }

  /* ───────────── 13. PUBLIC API ───────────── */
  const API = {
    init,
    togglePanel,
    shuffle,
    autoMatch,
    buildMiContent,
    switchTab,
    clearAll,
    registerMediaToPool,
    syncKeywordsToPanel,
    recalcAllCoverage,
    updateFooterBar,
    clearAllActive,
    goPage
  };
  w.MatchImages = API;
  w.buildMiContent = buildMiContent;
  w.toggleMatchImagesPanel = togglePanel;
  w.registerMediaToPool = registerMediaToPool;
  w.currentPoolCount = poolCount;
  /* legacy noop */
  w.buildLists = () => { };
  w.renderMap = () => { };
  w.validateMap = () => { };

  /* ───────────── 14. INIT ───────────── */
  function init() {
    const scope = getScopeKey();
    STORAGE_KEYS = {
      mapKey: `imgMap::${scope}`,
      visitedKey: `miVisited::${scope}`
    };

    if (!NO_CACHE) {
      try { VISITED_ON_THIS_SCOPE = localStorage.getItem(STORAGE_KEYS.visitedKey) === '1'; }
      catch (e) { VISITED_ON_THIS_SCOPE = false; }
    } else {
      VISITED_ON_THIS_SCOPE = false;
    }

    /* migrate old */
    if (!NO_CACHE && !VISITED_ON_THIS_SCOPE) {
      try {
        const legacy = localStorage.getItem('imgMap');
        const legacyVisited = localStorage.getItem('miVisited') === '1';
        if (legacy && legacyVisited && !localStorage.getItem(STORAGE_KEYS.mapKey)) {
          localStorage.setItem(STORAGE_KEYS.mapKey, legacy);
          localStorage.setItem(STORAGE_KEYS.visitedKey, '1');
          VISITED_ON_THIS_SCOPE = true;
        }
      } catch (e) { }
    }
    ensureTabBar();
    ensureLayoutStyles();
    ensureLassoEl();
    bindUI();
    
    /* restore map */
    try {
      if (!NO_CACHE && VISITED_ON_THIS_SCOPE) {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.mapKey) || 'null');
        if (saved && typeof saved === 'object') {
          imgMap.cover = saved.cover || {};
          imgMap.content = saved.content || {};
        }
      } else {
        imgMap.cover = {}; imgMap.content = {};
      }
    } catch (e) { }
    
    togglePanel();
    syncKeywordsToPanel();
    ensureKwObservers();
    
    updateRowLayout();
    ensureFooterBar();
    recalcAllCoverage();
    setupAutoSearchTrigger();
  }

  $(init);

  /* ---------- LEGACY HELPERS (moved from inline <script>) ---------- */
  /*  (Bu fonksiyonların bazı eski HTML çağrıları hâlâ durduğu için
      global adları korunarak dış dosyaya taşındı.)                  */

  function allThumbBoxes() {             // eski wrapper
    return $(SEL.listBoxes);
  }
  function poolImgs() {                  // eski wrapper
    return $(SEL.poolImgs);
  }
  function clearAllMatches() {           // eski “tamamını temizle” kısayolu
    clearAllActive();                     // yeni mantığı çağırır
  }

  /* Global’a aç – eski referanslar boşa düşmesin */
  w.allThumbBoxes = allThumbBoxes;
  w.poolImgs = poolImgs;
  w.clearAllMatches = clearAllMatches;
  /* --------------------------------------------------------------- */


})(window, jQuery);