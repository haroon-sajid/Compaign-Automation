/* =========================================================
MATCH-IMAGES – Social Media v9.1.0 (2025-10-06)
---------------------------------------------------------
• Platformlar Content Settings’den canlı okunur.
• Image Pool filtre çipleri: All + seçili platformlar.
  – Aktif çipte yüklenen medya o platformla ETİKETLENİR.
  – Etiketler hem .plat-* sınıfı hem data-plats’te kalıcıdır.
  – Observer, Dropzone yeniden çizse bile etiketleri KORUR.
• Satır başına platform sayısı kadar TEK görsellik “content” kutusu.
• Shuffle / Auto-Match platform bazlı çalışır.
• “All” dışı sekmede yüklenen medya, sekme değiştirip geri gelince KAYBOLMAZ.
• Başlık satırı (hücre başlıkları) eklendi.
• Responsive: havuz ve liste aynı akışta; taşma yok.
• Keywords Matching: Anahtar kelime yoksa “dolu kutu oranı”na geri düş.
========================================================= */
; (function (w, $) {
  'use strict';

  /* ───────────── 0. GLOBALS / CONFIG ───────────── */
  const NO_CACHE = w.miNoCache === true;

  /* imgMap:
  {
    cover: { [idx]: src },
    contentByPlat: { x:{[idx]:src}, facebook:{}, ... } // TEK görsel
  }
  */
  const imgMap = (w.imgMap = w.imgMap || { cover: {}, contentByPlat: {} });

  /* Havuz kayıt hafızası (dış kullanımla çakışmasın) */
  const mediaFiles = (w.mediaFiles = w.mediaFiles || []); // [{id,name,preview}]
  const mediaIndex = (w.mediaIndex = w.mediaIndex || new Set());
  let mediaSeq = (w.mediaSeq = w.mediaSeq || 1);

  let articleKeywords = (w.articleKeywords || {}); // { idx:[kw...] }
  let coverageCache = {};
  let STORAGE_KEYS = { mapKey: 'imgMap', visitedKey: 'miVisited' };
  let VISITED_ON_THIS_SCOPE = false;

  /* Platformlar */
  const PLATFORM_META = {
    x: { key: 'x', label: 'X (Twitter)', short: 'X' },
    facebook: { key: 'facebook', label: 'Facebook', short: 'Facebook' },
    linkedin: { key: 'linkedin', label: 'LinkedIn', short: 'LinkedIn' },
    instagram: { key: 'instagram', label: 'Instagram', short: 'Instagram' },
    threads: { key: 'threads', label: 'Threads', short: 'Threads' },
  };
  let selectedPlats = [];
  let activePoolFilter = 'all';
  let selectedPlatSignature = '';

  /* UI state */
  let $activeBox = null;
  let lastUploadPlat = 'all'; // Son upload’ta hangi chip aktiftir?

  w.evalSaveBtn = w.evalSaveBtn || function () { };
  w.updateDropzoneVisibility = w.updateDropzoneVisibility || function () { };

  /* ────────── SELECTORS ────────── */
  const SEL = {
    panel: '#matchImagesPanel',
    listWrap: '#miContentList',
    rows: '#miContentList .mi-row',
    header: '#miPlatHeader',
    poolGrid: '#miPool',
    poolImgs: '#miPool img',
    poolWraps: '#miPool .thumb-wrap',
    dropzone: '#mediaDropzone',
    searchIn: '#miSearchInput',
    clearSearch: '#miClearSearch',
    rowPager: '#miRowPager',
    summaryHost: '#miSummaryHost',
    footerBar: '#miFooterBar',
    clearAllBtn: '#miClearAll',
    shuffleBtn: '#miShuffle',
    autoBtn: '#miAuto',
    poolFilters: '#miPoolFilters',
  };

  const CHECK_SVG = `
<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"></polyline>
</svg>`;

  const CLEAR_SVG = `
<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
  <path d="M3 6h18M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6h10z"
        fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

  /* ───────────── 1. HELPERS ───────────── */
  const stripExt = s => String(s || '').replace(/\.[a-z0-9]+$/i, '');
  function normalizeForMatch(s) {
    if (!s) return '';
    s = stripExt(String(s));
    s = s.normalize ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s; // diakritikleri kaldır
    s = s.replace(/[’'“”"`~!@#$%^&*()=+[\]{}\\|;:,.<>/?‒–—−·•]/g, ' ');
    s = s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '').trim();
    return s;
  }
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); } };
  const fingerprint = f => [(f?.name || '').replace(/\.[^.]+$/, '').toLowerCase(), f?.size || 0, f?.lastModified || 0].join('|');
  function escapeHtml(str) { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }

  function getScopeKey() {
    const cid = ($('#campaignId').val?.() || $('[data-campaign-id]').data?.('campaignId') || $('#campaign_id').val?.() || '').toString().trim();
    const path = (location.pathname || '').replace(/\s+/g, '').replace(/[^\w/]+/g, '_');
    return cid ? ('camp:' + cid) : ('path:' + path);
  }
  function isManualSource() {
    const byHidden = String($('#sourceHidden').val?.() || '').toLowerCase();
    if (byHidden) return /manual/.test(byHidden);
    const $btn = $('#sourceToggle .source-opt.active').first();
    if ($btn.length) return /manual/.test(String($btn.data('val') || '').toLowerCase());
    const dataVal = String($('#mediaCards').data?.('source') ?? '').toLowerCase();
    if (/manual/.test(dataVal)) return true;
    return false;
  }

  function markVisited() { if (NO_CACHE) return; try { localStorage.setItem(STORAGE_KEYS.visitedKey, '1'); VISITED_ON_THIS_SCOPE = true; } catch (e) { } }

  /* ───────────── 1.1 LAYOUT / CSS ───────────── */
  function ensureLayoutStyles() {
    if ($('#miLayoutStyles').length) return;
    const css = `
#matchImagesPanel{
  --mi-no-width: 28px;
  --mi-thumb-size: 64px;
  --mi-gap: 12px;
  --mi-list-pad-left: 0px;
  --mi-accent:#6C4FF6;
  position:relative;
}

/* Liste ve havuz tek akışta */
#miContentList{ display:block; width:100%; position:relative; z-index:2; }
#miPlatHeader{ display:grid; grid-template-columns: 28px minmax(180px, 1fr) repeat(6, var(--mi-thumb-size)); gap:var(--mi-gap); margin:6px 0 4px; }
#miPlatHeader .hcell{ font-size:11px; color:#6b7280; text-align:center; }

#miPool{ display:flex; flex-wrap:wrap; gap:12px; margin-top:8px; width:100%; position:relative; z-index:1; clear:both; }

/* Footer */
#miFooterBar{ position:sticky; bottom:0; left:0; right:0; background:#fff; border-top:1px solid #e5e7eb;
  padding:12px 16px; display:flex; align-items:center; gap:16px; z-index:5; }
#miFooterBar .mi-footer-text{ font-size:14px; white-space:nowrap; flex:0 0 auto; }
.mi-progress{ background:#f3f4f6; height:8px; border-radius:6px; overflow:hidden; position:relative; }
.mi-progress .bar{ background:var(--mi-accent); height:100%; width:0%; transition:width .25s ease; }
#miFooterBar .mi-progress{ flex:1 1 auto; }

/* Pager */
#miRowPager{ display:flex; flex-wrap:wrap; gap:6px; margin:12px 0 18px; align-items:center; }
#miRowPager .mi-page-btn{ min-width:30px; height:28px; padding:0 10px; border-radius:16px; border:1px solid #e5e7eb; background:#f9fafb; font-size:12px; cursor:pointer; line-height:26px; text-align:center; transition:all .15s ease; }
#miRowPager .mi-page-btn.active{ background:var(--mi-accent); color:#fff; border-color:var(--mi-accent); }
#miRowPager .mi-page-btn[disabled], #miRowPager .mi-nav[disabled]{ opacity:.4; cursor:not-allowed; }
#miRowPager .mi-nav{ padding:0 12px; height:28px; line-height:26px; border-radius:16px; border:1px solid #e5e7eb; background:#fff; font-size:12px; cursor:pointer; }

/* Pool chipleri */
#miPoolFilters{ display:flex; gap:6px; margin:6px 0 10px; flex-wrap:wrap; }
#miPoolFilters .pf-chip{ border:1px solid #e5e7eb; background:#fff; border-radius:14px; padding:4px 10px; font-size:12px; cursor:pointer; user-select:none; }
#miPoolFilters .pf-chip.active{ background:var(--mi-accent); color:#fff; border-color:var(--mi-accent); }
#miPoolFilters .pf-chip.drop-hover{ outline:2px dashed var(--mi-accent); }

/* Satır grid */
#miContentList .mi-row{
  position:relative;
  display:grid;
  grid-template-columns: 28px minmax(180px, 1fr) repeat(6, var(--mi-thumb-size));
  gap: var(--mi-gap);
  align-items:center;
  margin-bottom:10px;
}
#miContentList .mi-row .no{ color:#6b7280; }
#miContentList .mi-row .title{ font-weight:600; color:#111827; min-width:0; }
#miContentList .mi-row .mi-tick{ color:#10b981; display:none; }
#miContentList .mi-row.matched .mi-tick{ display:block; position:absolute; right:-20px; }

/* Kutular */
.thumb-box{ width:var(--mi-thumb-size); height:var(--mi-thumb-size);
  border:2px dashed #d1d5db; border-radius:12px; background:#f9fafb;
  display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden; }
.thumb-box.filled{ border-style:solid; border-color:#d1d5db; background:#fff; }
.thumb-box .plat-badge{ position:absolute; top:-18px; left:0; font-size:11px; color:#6b7280; }
.thumb-one, .thumb-one img{ width:100%; height:100%; }
.thumb-one img{ object-fit:cover; display:block; }

/* Pool kartı */
#miPool .thumb-wrap{ width:128px; height:128px; border-radius:12px; overflow:hidden; position:relative; display:inline-block; background:#f3f4f6; }
#miPool .thumb-wrap img{ width:100%; height:100%; object-fit:cover; display:block; }
#miPool .thumb-wrap .thumb-del{ position:absolute; top:6px; right:6px; background:rgba(0,0,0,.55); color:#fff; font-size:11px;
  border-radius:10px; padding:2px 6px; cursor:pointer; line-height:14px; }

/* Mobil uyum */
@media (max-width: 900px){
  #matchImagesPanel{ --mi-thumb-size: 56px; }
  #miContentList .mi-row, #miPlatHeader{ grid-template-columns: 22px minmax(120px, 1fr) repeat(6, var(--mi-thumb-size)); }
  #miPool .thumb-wrap{ width:112px; height:112px; }
}
@media (max-width: 600px){
  #matchImagesPanel{ --mi-thumb-size: 48px; }
  #miContentList .mi-row, #miPlatHeader{ grid-template-columns: 18px minmax(100px, 1fr) repeat(4, var(--mi-thumb-size)); }
  #miPool .thumb-wrap{ width:100px; height:100px; }
}
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
    const noW = parseInt(cs.getPropertyValue('--mi-no-width')) || 28;
    const gap = parseInt(cs.getPropertyValue('--mi-gap')) || 12;
    let pad = Math.max(0, Math.round(searchLeft - (noW + gap)));
    $panel.css('--mi-list-pad-left', pad + 'px');
  }, 50);

  /* ───────────── 2. PLATFORM & PANEL ───────────── */
  function readSelectedPlatforms() {
    let arr = [];
    try {
      if (w.socialPlatforms && typeof w.socialPlatforms.selected === 'function') {
        arr = w.socialPlatforms.selected();
      }
    } catch (e) { }
    const map = { 'x': 'x', 'twitter': 'x', 'facebook': 'facebook', 'linkedin': 'linkedin', 'instagram': 'instagram', 'threads': 'threads' };
    const normed = (arr || []).map(v => String(v).toLowerCase()).map(v => map[v] || v).filter(k => PLATFORM_META[k]);
    const uniq = Array.from(new Set(normed));
    const signature = uniq.join('|');
    const changed = signature !== selectedPlatSignature;
    selectedPlats = uniq.length ? uniq : []; // hiç yoksa boş bırak, sadece All göster
    selectedPlatSignature = selectedPlats.join('|');
    return changed;
  }

  function ensurePoolFilters() {
    let $bar = $(SEL.poolFilters);
    if (!$bar.length) {
      $bar = $('<div id="miPoolFilters" aria-label="Image Pool filters"></div>');
      $(SEL.poolGrid).before($bar);
    }
    $bar.empty();
    const items = [['all', 'All']].concat(selectedPlats.map(k => [k, PLATFORM_META[k].short]));
    if (!items.some(([k]) => k === activePoolFilter)) activePoolFilter = 'all';

    items.forEach(([k, label]) => {
      const $chip = $(`<button type="button" class="pf-chip" data-plat="${k}" draggable="true">${label}</button>`)
        .toggleClass('active', k === activePoolFilter)
        .on('click', () => { switchPoolFilter(k); })
        .on('dragover', (e) => { e.preventDefault(); $chip.addClass('drop-hover'); })
        .on('dragleave', () => $chip.removeClass('drop-hover'))
        .on('drop', (e) => {
          e.preventDefault(); $chip.removeClass('drop-hover');
          const src = e.originalEvent.dataTransfer.getData('text/plain');
          if (!src) return;
          if (k === 'all') { tagImageForPlatformBySrc(src, null, true); }
          else { tagImageForPlatformBySrc(src, k, true); }
          filterPoolByActive();
        });
      $bar.append($chip);
    });
  }

  function switchPoolFilter(k) {
    activePoolFilter = k;
    lastUploadPlat = k;
    $(`${SEL.poolFilters} .pf-chip`).removeClass('active').filter(`[data-plat="${k}"]`).addClass('active');
    filterPoolByActive();
  }

  /* data-plats + plat-* class birlikte tutulur */
  function getWrapPlats($wrap) {
    const dat = String($wrap.attr('data-plats') || '').trim();
    return new Set(dat ? dat.split(',').filter(Boolean) : []);
  }
  function setWrapPlats($wrap, set) {
    const arr = Array.from(set);
    $wrap.attr('data-plats', arr.join(','));
    $wrap.removeClass(function (i, c) { return (c.match(/(^|\s)plat-\S+/g) || []).join(' '); });
    arr.forEach(p => $wrap.addClass('plat-' + p));
  }
  function tagImageForPlatformBySrc(src, plat, replace = false) {
    const $wrap = $(SEL.poolWraps).filter(function () { return $(this).find('img').attr('src') === src; }).first();
    if (!$wrap.length) return;
    const set = replace ? new Set() : getWrapPlats($wrap);
    if (plat) { set.add(plat); } else { set.clear(); }
    setWrapPlats($wrap, set);
  }

  /* Yardımcı: Görsel bu platform için kullanılabilir mi? */
  function imageAllowedForPlatform(src, plat) {
    const $wrap = $(SEL.poolWraps).filter(function () { return $(this).find('img').attr('src') === src; }).first();
    if (!$wrap.length) return true;
    const set = getWrapPlats($wrap);
    if (set.size === 0) return true;          // etiketsiz -> tüm platformlara açık
    return set.has(plat);                      // etiketli -> sadece ilgili platform
  }

  /* Pool görünürlüğü */
  function filterPoolByActive() {
    const k = activePoolFilter;
    $(SEL.poolWraps).each(function () {
      const show = (k === 'all') || $(this).hasClass('plat-' + k);
      $(this).toggle(show);
    });
  }

  /* Panel aç/kapat + canlı platform güncelle */
  function togglePanel() {
    const changed = readSelectedPlatforms();
    ensurePoolFilters();
    if (changed) { drawRows(); renderHeaderRow(); }
    const manual = isManualSource();
    if (manual) {
      if (!$('#mediaUploadBox').is(':visible')) {
        $('#mediaUploadBox').stop(true, true).slideDown(120).css('min-height', '40px');
      }
      $(SEL.panel).stop(true, true).slideDown(120);
      $(SEL.searchIn).focus();
    } else {
      $(SEL.panel).stop(true, true).slideUp(120);
    }
    updateRowLayout();
  }

  /* ───────────── 3. PERSISTENCE ───────────── */
  const storeMap = debounce(() => {
    if (!NO_CACHE) {
      try { localStorage.setItem(STORAGE_KEYS.mapKey, JSON.stringify(imgMap)); } catch (e) { }
      $(document).trigger('miMappingChanged', [imgMap]);
    }
    recalcAllCoverage();
  }, 200);

  /* Content (platform başına tek görsel) */
  function getContentSrc(idx, plat) {
    imgMap.contentByPlat[plat] = imgMap.contentByPlat[plat] || {};
    return imgMap.contentByPlat[plat][idx] || '';
  }
  function setContentSrc(idx, plat, src) {
    imgMap.contentByPlat[plat] = imgMap.contentByPlat[plat] || {};
    if (src) imgMap.contentByPlat[plat][idx] = src;
    else delete imgMap.contentByPlat[plat][idx];
    storeMap();
  }

  /* ───────────── 4. RENDER HELPERS ───────────── */
  function renderCoverBox($box, src) {
    if (!src) {
      $box.empty().removeClass('filled').attr('data-matched', '0');
      updateRowState($box.closest('.mi-row'));
      return;
    }
    let mediaHtml = `<img src="${src}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`;
    if (src.match(/\.(mp4|webm|ogg)$/i) || src.startsWith('data:video/')) {
      mediaHtml = `<video class="media-preview" muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:8px;">
                     <source src="${src}">
                   </video>`;
    }
    $box.html(mediaHtml)
      .addClass('filled').attr('data-matched', '1');
    updateRowState($box.closest('.mi-row'));
  }

  function renderContentBoxSingle($box, src) {
    if (!src) {
      $box.empty().removeClass('filled').attr('data-matched', '0');
      updateRowState($box.closest('.mi-row'));
      return;
    }
    let contentHtml = `<img src="${src}" alt="">`;
    if (src.match(/\.(mp4|webm|ogg)$/i) || src.startsWith('data:video/')) {
      contentHtml = `<video src="${src}" muted playsinline style="width:100%;height:100%;object-fit:cover;"></video>`;
    }
    $box.html(`<div class="thumb-one" data-src="${src}" title="Click to clear">${contentHtml}</div>`)
      .addClass('filled').attr('data-matched', '1');
    updateRowState($box.closest('.mi-row'));
  }

  function updateRowState($row) {
    const filled = $row.find('.thumb-box.filled').length > 0;
    $row.toggleClass('matched', filled);
    let $tick = $row.find('.mi-tick');
    if (!$tick.length) {
      $row.append('<span class="mi-tick">' + CHECK_SVG + '</span>');
      $tick = $row.find('.mi-tick');
    }
    $tick.toggle(filled);
  }

  function placeImg($box, src) {
    if (!$box || !$box.length || !src) return;
    const idx = $box.data('idx');
    const type = $box.data('type'); // 'cover' | 'content'
    const plat = $box.data('plat');

    if (!VISITED_ON_THIS_SCOPE && !NO_CACHE) markVisited();

    if (type === 'content') {
      setContentSrc(idx, plat, src);
      renderContentBoxSingle($box, src);
    } else {
      renderCoverBox($box, src);
      imgMap.cover[idx] = src;
      storeMap();
    }
    $('.thumb-box').removeClass('active');
    $activeBox = null;
    w.evalSaveBtn();
  }

  function clearBox($box) {
    const idx = $box.data('idx');
    const type = $box.data('type');
    const plat = $box.data('plat');

    if (type === 'content') {
      setContentSrc(idx, plat, '');
      renderContentBoxSingle($box, '');
      w.evalSaveBtn();
      return;
    }
    $box.empty().removeClass('filled active').attr('data-matched', '0');
    delete imgMap.cover[idx];
    updateRowState($box.closest('.mi-row'));
    storeMap();
    w.evalSaveBtn();
  }

  function clearAll() {
    $(SEL.rows).each(function () {
      const idx = $(this).data('idx');
      delete imgMap.cover[idx];
      selectedPlats.forEach(p => setContentSrc(idx, p, ''));
    });
    $(`${SEL.listWrap} .thumb-box`).removeClass('filled').empty().attr('data-matched', '0');
    storeMap();
  }

  /* ───────────── 5. SHUFFLE / AUTO-MATCH ───────────── */
  function imgsForPlatform(p) {
    const platSel = $(`${SEL.poolWraps}.plat-${p} img`).toArray();
    if (platSel.length) return platSel;
    const noneSel = $(SEL.poolWraps).filter(function () { return !/\bplat-/.test(this.className); }).find('img').toArray();
    return noneSel.length ? noneSel : $(SEL.poolImgs).toArray();
  }

  function shuffle() {
    if (!selectedPlats.length) return;
    $(SEL.rows).each(function () {
      const row = this;
      selectedPlats.forEach((p) => {
        const list = imgsForPlatform(p);
        if (!list.length) return;
        const src = $(list[Math.floor(Math.random() * list.length)]).attr('src');
        placeImg($(row).find(`.thumb-box[data-type="content"][data-plat="${p}"]`), src);
      });
    });
  }

  function autoMatch() {
    // Havuzdan key->src indeksini kur
    const poolIndex = new Map();
    $(SEL.poolImgs).each(function () {
      const dn = this.dataset?.name || '';
      const fromSrc = (this.src || '').split('/').pop().split('?')[0].split('#')[0];
      const key = normalizeForMatch(dn) || normalizeForMatch(fromSrc);
      if (key && !poolIndex.has(key)) poolIndex.set(key, this.src);
    });
    if (poolIndex.size === 0) return;

    $(SEL.rows).each(function () {
      const $row = $(this);
      const titleRaw = ($row.find('.title').text() || '').trim();
      const key = normalizeForMatch(titleRaw);
      const src = poolIndex.get(key);
      if (!src) return;

      selectedPlats.forEach(p => {
        if (imageAllowedForPlatform(src, p)) {
          const $box = $row.find(`.thumb-box[data-plat="${p}"]`);
          if ($box.length) placeImg($box, src);
        }
      });
    });
  }

  /* ───────────── 6. BUILD LIST + PAGINATION ───────────── */
  const ROWS_PER_PAGE = 5;
  let _currentPage = 0, _totalPages = 1, _kwMasterList = [];

  function buildMiContent(kwList = []) {
    readSelectedPlatforms();
    _kwMasterList = kwList.slice();
    _totalPages = Math.max(1, Math.ceil(_kwMasterList.length / ROWS_PER_PAGE));
    _currentPage = Math.min(_currentPage, _totalPages - 1);
    drawRows();
    renderHeaderRow();
    buildNumericPager();
  }

  function renderHeaderRow() {
    let $h = $(SEL.header);
    if (!$h.length) {
      $h = $('<div id="miPlatHeader" aria-hidden="true"></div>');
      $(SEL.listWrap).before($h);
    }
    const cells = ['<div class="hcell"></div>', '<div class="hcell" style="text-align:left;padding-left:2px;">Topic</div>']
      .concat(selectedPlats.map(p => `<div class="hcell">${escapeHtml(PLATFORM_META[p]?.short || p)}</div>`));
    $h.html(cells.join(''));
  }

  function makePlatBoxesHTML(idx) {
    return selectedPlats.map(p => {
      const label = PLATFORM_META[p]?.short || p;
      return `<div class="thumb-box" data-idx="${idx}" data-type="content" data-plat="${p}" data-matched="0">
      <span class="plat-badge">${escapeHtml(label)}</span>
    </div>`;
    }).join('');
  }

  function drawRows() {
    const $wrap = $(SEL.listWrap);
    $wrap.empty();

    const start = _currentPage * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;
    const slice = _kwMasterList.slice(start, end);

    slice.forEach((txt, i) => {
      const idx = start + i;
      const htmlRow = `
    <div class="mi-row" data-idx="${idx}">
      <span class="no">${idx + 1}</span>
      <span class="title">${escapeHtml(txt || '')}</span>
      ${makePlatBoxesHTML(idx)}
      <span class="mi-tick">${CHECK_SVG}</span>
    </div>`;
      $wrap.append(htmlRow);
    });

    ensureClearAllButton();
    restoreMapForPage(slice, start);
    updateRowLayout();
    recalcAllCoverage();
  }

  function restoreMapForPage(slice, startIndex) {
    slice.forEach((_, i) => {
      const idx = startIndex + i;

      const coverSrc = imgMap.cover[idx];
      if (!imageExistsInPool(coverSrc)) delete imgMap.cover[idx];

      selectedPlats.forEach(p => {
        const src = getContentSrc(idx, p);
        const $box = $(`${SEL.listWrap} .thumb-box[data-plat="${p}"][data-idx="${idx}"]`);
        if (!$box.length) return;
        if (src && imageExistsInPool(src)) {
          renderContentBoxSingle($box, src);
        } else {
          setContentSrc(idx, p, '');
          renderContentBoxSingle($box, '');
        }
        updateRowState($(`.mi-row[data-idx="${idx}"]`));
      });
    });
  }

  /* --------- Numeric Pager --------- */
  function buildNumericPager() {
    let $pager = $(SEL.rowPager);
    if (!$pager.length) {
      $pager = $('<div id="miRowPager" aria-label="Rows pagination"></div>');
      $(SEL.listWrap).after($pager);
    }
    $pager.empty();

    const $prev = $('<button class="mi-nav mi-prev" aria-label="Previous page">&laquo;</button>')
      .prop('disabled', _currentPage === 0)
      .on('click', () => { goPage(_currentPage - 1); });
    $pager.append($prev);

    for (let p = 0; p < _totalPages; p++) {
      const $btn = $('<button class="mi-page-btn" type="button"></button>')
        .text(p + 1)
        .attr({ 'data-page': p, 'aria-label': `Page ${p + 1}` })
        .toggleClass('active', p === _currentPage)
        .on('click', () => { goPage(p); });
      $pager.append($btn);
    }

    const $next = $('<button class="mi-nav mi-next" aria-label="Next page">&raquo;</button>')
      .prop('disabled', _currentPage >= _totalPages - 1)
      .on('click', () => { goPage(_currentPage + 1); });
    $pager.append($next);

    $(document).off('keydown.miPager').on('keydown.miPager', function (e) {
      if (e.target && /input|textarea|select/.test(e.target.tagName.toLowerCase())) return;
      if (e.key === 'ArrowRight' && _currentPage < _totalPages - 1) { goPage(_currentPage + 1); }
      if (e.key === 'ArrowLeft' && _currentPage > 0) { goPage(_currentPage - 1); }
    });
  }
  function goPage(p) { if (p < 0 || p >= _totalPages) return; _currentPage = p; drawRows(); renderHeaderRow(); buildNumericPager(); }

  /* ───────────── 7. COVERAGE (özet) ───────────── */
  function getImageTags(src) {
    const $im = $(SEL.poolImgs).filter(function () { return this.src === src; }).first();
    if (!$im.length) return [];
    const tags = ($im.data('tags') || $im.attr('data-tags') || '').toString().trim();
    if (!tags) return [];
    return Array.from(new Set(tags.split(',').map(s => s.trim()).filter(Boolean)));
  }

  /* Toplam anahtar kelime var mı? (global) */
  function hasAnyKeyword() {
    return Object.values(articleKeywords).some(arr => Array.isArray(arr) && arr.length);
  }

  function calcCoverageForIndex(idx) {
    // 1) Anahtar kelime varsa: tag bazlı hesap
    const kws = Array.isArray(articleKeywords[idx]) ? articleKeywords[idx] : [];
    if (kws.length) {
      const set = new Set();
      selectedPlats.forEach(p => {
        const s = getContentSrc(idx, p);
        getImageTags(s).forEach(t => { if (kws.includes(t)) set.add(t); });
      });
      const matched = set.size, total = kws.length;
      const percent = Math.round((matched / total) * 100);
      return (coverageCache[idx] = { matched, total, percent, set });
    }

    // 2) Anahtar kelime yoksa: dolu kutu oranı
    let totalSlots = selectedPlats.length;
    let filled = 0;
    selectedPlats.forEach(p => { if (getContentSrc(idx, p)) filled++; });
    const matched = filled, total = totalSlots;
    const percent = total ? Math.round((matched / total) * 100) : 0;
    return (coverageCache[idx] = { matched, total, percent, set: new Set() });
  }

  function recalcAllCoverage() {
    const $rows = $(SEL.rows);
    if (!$rows.length) return;

    $rows.each(function () {
      const idx = $(this).data('idx');
      const result = calcCoverageForIndex(idx);
      $(this).toggleClass('kw-full', result.percent === 100)
        .toggleClass('kw-partial', result.percent > 0 && result.percent < 100);
    });

    // Footer toplamı
    let matched = 0, total = 0;
    Object.keys(coverageCache).forEach(idx => {
      matched += coverageCache[idx].matched;
      total += coverageCache[idx].total;
    });
    const percent = total ? Math.round((matched / total) * 100) : 0;
    updateFooterBar(percent, matched, total);
  }

  function ensureFooterBar() {
    if ($(SEL.footerBar).length) return;
    const html = `
  <div id="miFooterBar" role="region" aria-label="Keywords Matching">
    <span class="mi-footer-text">Keywords Matching</span>
    <div class="mi-progress"><div class="bar"></div></div>
    <span class="mi-footer-text mi-footer-val"></span>
  </div>`;
    $(SEL.panel).append(html);
  }
  function updateFooterBar(percent, matched, total) {
    ensureFooterBar();
    $(`${SEL.footerBar} .mi-progress .bar`).css('width', (percent || 0) + '%');
    $(`${SEL.footerBar} .mi-footer-val`).text(`${percent || 0}% matched (${matched || 0}/${total || 0})`);
  }

  /* ───────────── 8. POOL REGISTER & FILTER ───────────── */
  function urlToName(url) {
    try { const u = new URL(url, location.href); return decodeURIComponent(u.pathname.split('/').pop() || 'image'); }
    catch (e) { const m = String(url || '').split(/[?#]/)[0].split('/').pop(); return m || 'image'; }
  }

  function registerMediaToPool(file, url) {
    if (!file && !url) return false;
    let fp = file ? fingerprint(file) : `url::${url}`;
    if (mediaIndex.has(fp)) return false;

    const base = (file?.name || urlToName(url) || '').replace(/\.[^.]+$/, '').toLowerCase();

    mediaIndex.add(fp);
    const id = 'u' + (mediaSeq++);
    const previewUrl = url || (file ? URL.createObjectURL(file) : '');

    mediaFiles.push({ id, name: (file?.name || urlToName(previewUrl)), preview: previewUrl });

    const isVideo = (file && file.type.startsWith('video/')) || (url && url.match(/\.(mp4|webm|ogg)$/i));
    let $mediaEl;
    if (isVideo) {
      $mediaEl = $('<video>', { src: previewUrl, class: 'media-preview', muted: true, playsinline: true, draggable: true, 'data-fid': id, 'data-name': base, 'data-fp': fp });
      $mediaEl.on('mouseover', function () { this.play(); }).on('mouseout', function () { this.pause(); this.currentTime = 0; });
    } else {
      $mediaEl = $('<img>', { src: previewUrl, draggable: true, 'data-fid': id, 'data-name': base, 'data-fp': fp });
    }

    const $wrap = $('<div>', { class: 'thumb-wrap' });
    $wrap.append($mediaEl).append($('<span>', { class: 'thumb-del', text: '✖', title: 'Remove from pool' }));

    const initialPlats = new Set(lastUploadPlat === 'all' ? [] : [lastUploadPlat]);
    setWrapPlats($wrap, initialPlats);

    $(SEL.poolGrid).append($wrap);

    $mediaEl.on('error', function () {
      try { if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl); } catch (e) { }
      mediaIndex.delete(fp);
      $wrap.remove();
    });

    w.updateDropzoneVisibility();
    filterPoolByActive();
    return true;
  }

  function imageExistsInPool(src) { return !!src && $(SEL.poolImgs).filter(function () { return this.src === src; }).length > 0; }

  /* ───────────── 9. UI BINDINGS ───────────── */
  function ensureClearAllButton() {
    if ($(SEL.clearAllBtn).length) return;
    const btn = $(`<button id="miClearAll" type="button" title="Clear all matches">${CLEAR_SVG}<span>Clear All</span></button>`);
    $(SEL.listWrap).append(btn);
  }

  function bindUI() {
    // Kutular
    $(document).off('click.miBox').on('click.miBox', '.thumb-box', function () {
      $('.thumb-box').removeClass('active');
      $activeBox = $(this).addClass('active');
    });

    // Kutu içini tıklayınca temizle
    $(document).off('click.miOne').on('click.miOne', '.thumb-one', function (e) {
      e.stopPropagation();
      clearBox($(this).closest('.thumb-box'));
    });

    // Havuz tıklama/drag-drop
    $(document).off('click.miGrid').on('click.miGrid', `${SEL.poolWraps}`, function () {
      const src = $(this).find('img').attr('src');
      let $target = $activeBox;
      if (!$target || !$target.length) {
        const $cand = $(SEL.rows).find('.thumb-box').filter((_, b) => !$(b).hasClass('filled')).first();
        if ($cand.length) $target = $cand;
      }
      if ($target && $target.length) placeImg($target, src);
    });

    $(document).off('dragstart.mi').on('dragstart.mi', `${SEL.poolImgs}`, function (e) {
      e.originalEvent.dataTransfer.setData('text/plain', this.src);
    });
    $(document).off('dragover.mi').on('dragover.mi', '.thumb-box', e => e.preventDefault());
    $(document).off('drop.mi').on('drop.mi', '.thumb-box', e => {
      e.preventDefault();
      const $box = $(e.currentTarget);
      const src = e.originalEvent.dataTransfer.getData('text/plain');
      placeImg($box, src);
    });

    // Butonlar
    $(document).off('click.miButtons')
      .on('click.miButtons', SEL.shuffleBtn, shuffle)
      .on('click.miButtons', SEL.autoBtn, autoMatch)
      .on('click.miButtons', SEL.clearAllBtn, clearAll);

    // Arama
    $(SEL.searchIn).off('input.mi').on('input.mi', function () {
      const q = this.value.trim().toLowerCase();
      $(SEL.rows).each(function () {
        const t = $(this).find('.title').text().toLowerCase();
        $(this).toggle(!q || t.includes(q));
      });
      updateRowLayout();
    });
    $(SEL.clearSearch).off('click.mi').on('click.mi', () => { $(SEL.searchIn).val('').trigger('input').focus(); });

    // Havuzdan sil
    $(document).off('click.miDel').on('click.miDel', '.thumb-del', function (e) {
      e.stopPropagation();
      const $wrap = $(this).closest('.thumb-wrap');
      const $img = $wrap.find('img');
      const fp = $img.data('fp');
      const src = $img.attr('src');

      mediaIndex.delete(fp);
      try { if (src && src.startsWith('blob:')) URL.revokeObjectURL(src); } catch (e) { }
      $wrap.remove();

      $(SEL.rows).find(`.thumb-one img[src="${src}"]`).each(function () {
        clearBox($(this).closest('.thumb-box'));
      });

      w.updateDropzoneVisibility();
      recalcAllCoverage();
    });

    // Upload
    $(document).off('change.miFile').on('change.miFile', `${SEL.dropzone} input[type="file"]`, function () {
      lastUploadPlat = activePoolFilter;
      const files = Array.from(this.files || []);
      files.forEach(f => { const url = URL.createObjectURL(f); registerMediaToPool(f, url); });
      this.value = '';
    });
    $(document).off('change.miDZ').on('change.miDZ', `${SEL.dropzone} .dz-hidden-input`, function () {
      lastUploadPlat = activePoolFilter;
      const files = Array.from(this.files || []);
      files.forEach(f => { const url = URL.createObjectURL(f); registerMediaToPool(f, url); });
      this.value = '';
    });
    $(document).off('paste.miPool').on('paste.miPool', function (e) {
      lastUploadPlat = activePoolFilter;
      const items = e.originalEvent.clipboardData?.items || [];
      for (const it of items) {
        if (it.kind === 'file') {
          const f = it.getAsFile();
          if (f) { const url = URL.createObjectURL(f); registerMediaToPool(f, url); }
        }
      }
    });

    ensurePoolFilters();
    ensurePoolObserver();
  }

  /* ───────────── 10. INIT & LIVE WATCH ───────────── */
  function poolCount() { return $(SEL.poolImgs).length; }

  function ensureKwObservers() {
    const $wrap = $('#kwTable_wrapper');
    if ($wrap.length) {
      const mo = new MutationObserver(debounce(syncKeywordsToPanel, 100));
      mo.observe($wrap.get(0), { childList: true, subtree: true, characterData: true });
    }
  }

  let platPollTimer = null;
  function ensurePlatformLiveWatch() {
    const poll = () => {
      const changed = readSelectedPlatforms();
      if (changed) {
        ensurePoolFilters();
        drawRows();
        renderHeaderRow();
        filterPoolByActive();
      }
    };
    if (platPollTimer) clearInterval(platPollTimer);
    platPollTimer = setInterval(poll, 800);
  }

  /* Pool DOM’u izleyici */
  let poolObserver = null;
  function ensurePoolObserver() {
    if (poolObserver) return;
    const root = document.querySelector(SEL.poolGrid);
    if (!root) return;
    poolObserver = new MutationObserver((muts) => {
      muts.forEach(m => {
        m.addedNodes && m.addedNodes.forEach(node => {
          if (!(node instanceof HTMLElement)) return;
          const $wrap = $(node).is('.thumb-wrap') ? $(node) : $(node).find('.thumb-wrap');
          $wrap.each(function () {
            const set = getWrapPlats($(this));
            if (!set.size && activePoolFilter !== 'all') {
              set.add(activePoolFilter);
              setWrapPlats($(this), set);
            } else {
              setWrapPlats($(this), set);
            }
          });
        });
      });
      filterPoolByActive();
    });
    poolObserver.observe(root, { childList: true, subtree: true });
  }

  function readKeywordsFromPage() {
    if (Array.isArray(w.kwList) && w.kwList.length) return w.kwList.slice();
    if (Array.isArray(w.keywords) && w.keywords.length) return w.keywords.slice();
    const $table = $('#kwTable tbody');
    const list = [];
    if ($table.length) {
      $table.find('tr').each(function () {
        const txt = $(this).find('td').first().text().trim();
        if (txt) list.push(txt);
      });
    }
    return Array.from(new Set(list.filter(Boolean)));
  }

  function syncKeywordsToPanel() {
    const list = readKeywordsFromPage();
    buildMiContent(list.length ? list : ['']);
  }

  function init() {
    const scope = getScopeKey();
    STORAGE_KEYS = { mapKey: `imgMap::${scope}`, visitedKey: `miVisited::${scope}` };

    if (!NO_CACHE) {
      try { VISITED_ON_THIS_SCOPE = localStorage.getItem(STORAGE_KEYS.visitedKey) === '1'; }
      catch (e) { VISITED_ON_THIS_SCOPE = false; }
    } else {
      VISITED_ON_THIS_SCOPE = false;
    }

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

    ensureLayoutStyles();
    bindUI();
    ensureFooterBar();

    try {
      if (!NO_CACHE) {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.mapKey) || 'null');
        if (saved && typeof saved === 'object') {
          imgMap.cover = saved.cover || {};
          imgMap.contentByPlat = saved.contentByPlat || {};
        }
      }
    } catch (e) { }

    togglePanel();
    syncKeywordsToPanel();
    ensureKwObservers();
    ensurePlatformLiveWatch();
    updateRowLayout();
    recalcAllCoverage();
  }

  $(init);

  /* ---------- PUBLIC API ---------- */
  const API = {
    init, togglePanel, shuffle, autoMatch, buildMiContent,
    clearAll, registerMediaToPool, syncKeywordsToPanel,
    recalcAllCoverage, updateFooterBar: (p, m, t) => updateFooterBar(p, m, t), goPage, poolCount
  };
  w.MatchImages = API;
  w.toggleMatchImagesPanel = togglePanel;
  w.registerMediaToPool = registerMediaToPool;
  w.currentPoolCount = poolCount;

  /* ---------- LEGACY NO-OPs ---------- */
  w.buildMiContent = buildMiContent;
  w.buildLists = () => { };
  w.renderMap = () => { };
  w.validateMap = () => { };

})(window, jQuery);
