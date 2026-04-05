/* keyword-table.js – v3.9  (2025-08-05)
 * =========================================================
 *  • Keyword textarea / (ops.) manual Select2 → DataTable senkronu
 *  • Clusters: sayım, tablo, overview (sol tablo + sağ liste)
 *  • Bulk actions (delete / assign), satır numaralandırma
 *  • “Use Clustering” kapalıyken cluster arayüzü gizlenir ve atamalar temizlenir
 *  • Üst bar: Show entries & Search kutuları DataTable’a bağlı
 *  • Dış entegrasyonlar için olaylar:  $(document).on('kw:updated', ...)
 * ========================================================= */

(function ($, window, document) {
  'use strict';

  /* ---------- GLOBAL STATE ---------- */
  window.kwData        = window.kwData        || [];   // [{id, kw, cluster, last}]
  window.clusterData   = window.clusterData   || [];   // [{name, kwCount, last}]
  window.kwTable       = window.kwTable       || null;
  window.clustersTable = window.clustersTable || null;

  /* ---------- HELPERS ---------- */
  const nowStr  = () => moment().format('DD.MM.YYYY, HH:mm');
  const debounce= (fn, ms=350) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(null,a),ms);} };
  const $kwTbl  = $('#kwTable');
  const $clTbl  = $('#clustersTable');

  /* ========= 1) DATATABLES  ====================================== */
  // KW table
  if ($.fn.DataTable.isDataTable($kwTbl)) { $kwTbl.DataTable().clear().destroy(); }
  window.kwTable = $kwTbl.DataTable({
    dom      : 't',
    ordering : false,                 // eklenme sırası korunur
    data     : window.kwData,
    autoWidth: false,
    deferRender: true,
    columns  : [
      {data:null, className:'select-col', orderable:false,
        defaultContent:'<input type="checkbox" class="kw-row-select">'},
      {data:null,  className:'no-col', orderable:false},      // sıra#
      {data:'kw',  title:'Keyword'},
      {data:'cluster', defaultContent:'-', title:'Cluster'},
      {data:'last',    defaultContent:'-', title:'Last Used'},
      {data:null,   className:'actions-col', orderable:false,
        defaultContent:
          `<button class="kw-edit entypo-pencil" title="Edit"></button>
           <button class="kw-del  entypo-trash"  title="Delete"></button>`}
    ],
    createdRow: (row,data,idx)=>$('td:eq(1)',row).text(idx+1)
  });

  // CL table
  if ($.fn.DataTable.isDataTable($clTbl)) { $clTbl.DataTable().clear().destroy(); }
  window.clustersTable = $clTbl.DataTable({
    dom       : 't',
    ordering  : false,
    data      : window.clusterData,
    autoWidth : false,
    deferRender: true,
    columns   : [
      {data:null, className:'select-col', orderable:false,
        defaultContent:'<input type="checkbox" class="cl-row-select">'},
      {data:null, className:'no-col', orderable:false},
      {data:'name',     title:'Cluster'},
      {data:'kwCount',  title:'# Keywords'},
      {data:'last',     title:'Last Updated'},
      {data:null, className:'actions-col', orderable:false,
        defaultContent:
          `<button class="cl-edit entypo-pencil" title="Rename"></button>
           <button class="cl-del  entypo-trash"  title="Delete"></button>`}
    ],
    createdRow: (row,data,idx)=>$('td:eq(1)',row).text(idx+1)
  });

  /* ========= 2) KEYWORD SINK  ==================================== */
  function readBulkLines() {
    return ($('#keywordsBulkInput').val() || '')
      .split(/\r?\n/)
      .map(t=>t.trim())
      .filter(Boolean);
  }
  function readManualSelect() {
    // Opsiyonel: #keywordsManual yoksa boş dizi dön
    const $m = $('#keywordsManual');
    if (!$m.length) return [];
    const v = $m.val();
    return Array.isArray(v) ? v : [];
  }

  function syncKeywords () {
    const bulkLines = readBulkLines();
    const manualSel = readManualSelect();

    // Sırayla birleştir + tekilleştir (case-insensitive)
    const seen = new Set();
    const ordered = [];
    [...bulkLines, ...manualSel].forEach(k=>{
      const low = String(k).toLowerCase();
      if(!seen.has(low)){
        seen.add(low);
        ordered.push(String(k));
      }
    });

    // kwData’yı yeniden kur (mevcut cluster atamalarını korumaya çalış)
    const prevByKw = Object.create(null);
    window.kwData.forEach(r=>{ prevByKw[r.kw.toLowerCase()] = r; });

    window.kwData.length = 0;
    ordered.forEach((kw,i)=>{
      const prev = prevByKw[kw.toLowerCase()];
      window.kwData.push({
        id: i+1,
        kw,
        cluster: prev ? prev.cluster : '',
        last: prev ? prev.last : '-'
      });
    });

    // Tabloyu güncelle + cluster sayıları
    window.kwTable.clear().rows.add(window.kwData).draw(false);
    rebuildClusterData();    // clusterData güncellensin
    refreshClusterTable();   // cluster tablosunu tazele
    renderClusterOverview(); // overview panelini güncelle

    // Diğer modüllere haber ver (ör. Media -> Keyword Preview)
    $(document).trigger('kw:updated', [ ordered ]);
    $(document).trigger('kwSyncDone');
  }
  window.syncKeywords = syncKeywords;

  $('#keywordsBulkInput').on('input',  debounce(syncKeywords, 400));
  $('#keywordsManual')    .on('change', syncKeywords);

  /* ========= 3) CLUSTER CORE ===================================== */
  function rebuildClusterData () {
    const map = Object.create(null);     // {cluster:{name, kwCount, last}}
    window.kwData.forEach(r=>{
      if(!r.cluster) return;
      const c = map[r.cluster] ||= {name:r.cluster, kwCount:0, last:'-'};
      c.kwCount++;
    });

    window.clusterData.length = 0;
    Object.values(map).forEach(c=> window.clusterData.push(c));
  }

  function refreshClusterTable(){
    rebuildClusterData();
    window.clustersTable.clear().rows.add(window.clusterData).draw(false);
  }

  // Dışarı aç
  window.rebuildClusterData  = rebuildClusterData;
  window.refreshClusterTable = refreshClusterTable;

  /* ========= 4) BULK ACTIONS (KEYWORDS) =========================== */
  // Bulk "Assign" seçeneği için dinamik cluster seçici
  function renderBulkAssignSelector() {
    const id = 'kwBulkAssignSel';
    const $wrap = $('#kwBulkWrapper').empty();
    if (!window.clusterData.length) {
      $wrap.html('<em class="text-muted" style="margin-left:8px;">No clusters</em>');
      return;
    }
    const html = [
      `<select id="${id}" class="form-control" style="display:inline-block;width:auto;min-width:160px;margin-left:8px;">`,
      `<option value="">(none)</option>`,
      ...window.clusterData.map(c=>`<option value="${c.name}">${c.name}</option>`),
      `</select>`
    ].join('');
    $wrap.html(html);
  }

  $('#kwBulkField').on('change', function(){
    const v = $(this).val();
    if (v === 'assign') renderBulkAssignSelector();
    else $('#kwBulkWrapper').empty();
  });

  $('#kwBulkApply').on('click',function(){
    const action = $('#kwBulkField').val();
    if(!action) return;

    const $rows = $('#kwTable tbody .kw-row-select:checked').closest('tr');
    if(!$rows.length) return alert('Select at least one row.');

    if(action==='delete'){
      $rows.each(function(){
        const rowData = window.kwTable.row(this).data();
        const ix = window.kwData.findIndex(d=>d.id===rowData.id);
        if (ix>-1) window.kwData.splice(ix,1);
      });
      window.kwTable.rows($rows).remove().draw(false);

    }else if(action==='assign'){
      const clName = ($('#kwBulkAssignSel').val() || '');
      $rows.each(function(){
        const d = window.kwTable.row(this).data();
        d.cluster = clName;
      });
      window.kwTable.rows($rows).invalidate().draw(false);
    }
    refreshClusterTable();
    renderClusterOverview();
    $('#kwSelectAll').prop('checked', false);
  });

  /* ========= 5) ROW-LEVEL ACTIONS ================================ */
  $(document).on('click','.kw-del',function(){
    if(!confirm('Delete this keyword?')) return;
    const row = window.kwTable.row($(this).closest('tr'));
    const data= row.data();
    const ix  = window.kwData.findIndex(d=>d.id===data.id);
    if (ix>-1) window.kwData.splice(ix,1);
    row.remove().draw(false);
    refreshClusterTable();
    renderClusterOverview();
  });

  $(document).on('click','.kw-edit',function(){
    const row = window.kwTable.row($(this).closest('tr'));
    const data= row.data();
    const val = prompt('Edit keyword:', data.kw);
    if(val && val.trim()){
      data.kw = val.trim();
      data.last = nowStr();
      row.invalidate().draw(false);
      // kwData’daki karşılığını da güncelle
      const ref = window.kwData.find(r=>r.id===data.id);
      if (ref) { ref.kw = data.kw; ref.last = data.last; }
      renderClusterOverview();
      $(document).trigger('kw:updated', [ window.kwData.map(x=>x.kw) ]);
    }
  });

  // Cluster sil / yeniden adlandır (clustersTable tarafında)
  $(document).on('click','.cl-del',function(){
    if(!confirm('Delete this cluster and un-assign keywords?')) return;
    const row = window.clustersTable.row($(this).closest('tr'));
    const cl  = row.data().name;
    window.kwData.forEach(r=>{ if(r.cluster===cl) r.cluster=''; });
    row.remove().draw(false);
    refreshClusterTable();
    window.kwTable.rows().invalidate().draw(false);
    renderClusterOverview();
  });

  $(document).on('click','.cl-edit',function(){
    const row = window.clustersTable.row($(this).closest('tr'));
    const data= row.data();
    const nu  = (prompt('Rename cluster:', data.name)||'').trim();
    if (!nu) return;

    // isim çakışması kontrolü
    if (window.clusterData.some(c=>c.name.toLowerCase()===nu.toLowerCase())) {
      alert('Cluster already exists'); return;
    }
    // kwData içindeki atamaları da güncelle
    window.kwData.forEach(r=>{ if(r.cluster===data.name) r.cluster=nu; });
    data.name = nu;
    row.invalidate().draw(false);
    refreshClusterTable();
    window.kwTable.rows().invalidate().draw(false);
    renderClusterOverview();
  });

  /* ========= 6) “USE CLUSTERING” TOGGLE =========================== */
  $('#clustersBox').hide();                       // başlangıçta gizli
  function toggleClusteringUI (on){
    $('#clustersBox').toggle(on);
    if(!on){            // kapatınca tüm cluster atamalarını temizle
      window.kwData.forEach(r=>r.cluster='');
      window.kwTable.rows().invalidate().draw(false);
      refreshClusterTable();
      renderClusterOverview();
    }
    // Select2 hidden select genişlik bug fix (varsa)
    const $sel = $('#clusterSelect');
    if (on) {
      setTimeout(function () {
        const $c = $sel.next('.select2-container');
        $c.css({display:'block', width:'100%', visibility:'visible'});
      }, 0);
    }
  }
  $('#useClustering').on('change',function(){
    toggleClusteringUI( this.checked );
  });
  toggleClusteringUI( $('#useClustering').is(':checked') );   // sayfa açılışı

  /* ========= 7) CLUSTER PLAYGROUND (New Cluster) ================== */
  $(document).on('click','#addClusterBtn',function(){
    const name = (prompt('Cluster name:')||'').trim();
    if(!name) return;

    if(window.clusterData.some(c=>c.name.toLowerCase()===name.toLowerCase())){
      alert('Cluster already exists'); return;
    }

    window.clusterData.push({name, kwCount:0, last:'-'});
    // Gizli select’e ekle (Select2 kullanıyor olabilirsiniz)
    const $sel = $('#clusterSelect');
    if ($sel.length) {
      $sel.append(new Option(name, name, true, true)).trigger('change');
    }
    refreshClusterTable();
    renderClusterOverview();
  });

  /* ========= 8) KEYWORD / CLUSTER SEKME GEÇİŞİ ==================== */
  $('.kw-nav').on('click','.kw-nav-btn',function(){
    const isKw = $(this).index()===0;
    $('.kw-nav-btn').removeClass('active');
    $(this).addClass('active');
    $('#kwTableBoxSecondary').toggle(isKw);
    $('#clustersTableBox')   .toggle(!isKw);

    // Clusters sekmesine geçince overview’u da güncelle
    if (!isKw) renderClusterOverview();
  });

  /* ========= 9) MASTER CHECKBOXES ================================ */
  $('#kwSelectAll').on('change', function(){
    $('#kwTable tbody .kw-row-select').prop('checked', this.checked);
  });
  $('#clSelectAll').on('change', function(){
    $('#clustersTable tbody .cl-row-select').prop('checked', this.checked);
  });

  /* ========= 10) ÜST BAR: SHOW ENTRIES & SEARCH =================== */
  $('select[name="kw_length"]').on('change', function(){
    window.kwTable.page.len(+this.value).draw(false);
  });
  $('select[name="cl_length"]').on('change', function(){
    window.clustersTable.page.len(+this.value).draw(false);
  });

  $('#kwSearchInput').on('input', function(){
    window.kwTable.search(this.value).draw();
  });
  $('#clSearchInput').on('input', function(){
    window.clustersTable.search(this.value).draw();
  });

  /* ========= 11) CLUSTER OVERVIEW (sağ panel) ===================== */
  function renderClusterOverview() {
    const $box = $('#clusterOverviewBox');
    if (!$box.length) return;               // HTML’de yoksa atla

    // Data yoksa paneli gizle
    if (!window.clusterData.length) { $box.hide(); return; }
    $box.show();

    // Sol tabloyu (basit HTML) doldur
    const $tbody = $('#clusterOverviewTable tbody').empty();
    window.clusterData.forEach(c=>{
      const tr = $(`<tr data-cl="${c.name}"><td>${c.name}</td><td style="text-align:right;">${c.kwCount}</td></tr>`);
      $tbody.append(tr);
    });

    // Varsayılan olarak ilk cluster’ı seçip sağ listeyi doldur
    const first = window.clusterData[0];
    if (first) {
      $('#clusterOverviewTable tbody tr').removeClass('selected')
        .filter(`[data-cl="${first.name}"]`).addClass('selected');
      loadClusterKeywords(first.name);
    }
  }

  function loadClusterKeywords (name) {
    const list = window.kwData
      .filter(r=>r.cluster===name)
      .map(r=>r.kw);
    $('#coTitle').text(`Keywords – ${name}`);
    const $ul = $('#coKeywords').empty();
    if (!list.length) {
      $ul.append('<li class="text-muted">No keywords</li>');
    } else {
      list.forEach(k=> $ul.append(`<li>${k}</li>`));
    }
  }

  // Dışarı aç (HTML inline kodlarından çağrılabiliyor)
  window.loadClusterKeywords = loadClusterKeywords;

  // Sol overview satır tıklaması
  $(document).on('click','#clusterOverviewTable tbody tr',function(){
    $('#clusterOverviewTable tbody tr').removeClass('selected');
    $(this).addClass('selected');
    loadClusterKeywords($(this).data('cl'));
  });

  /* ========= 12) INITIAL BOOT ==================================== */
  // İlk senkron (boş olsa da tablolar hazırlansın)
  syncKeywords();

})(jQuery, window, document);
