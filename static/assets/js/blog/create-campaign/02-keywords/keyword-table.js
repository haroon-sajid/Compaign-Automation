/* keyword-table.js – v4.3 (2025-10-16)
 * =========================================================
 * • Tek tablo (Clusters yok, nav yok)
 * • Sütunlar: Select | No | Keyword | Last Used | Actions
 * • Üst bar: Show / Bulk Actions / Search (DataTable entegre)
 * • Kaynak: #keywordsBulkInput satırları (tekilleştirilmiş)
 * • Düzenle → Last Used güncellenir (DD.MM.YYYY, HH:mm)
 * • Tablonun eni, içinde bulunduğu col-lg-9 sütunuyla birebir
 * ========================================================= */
(function ($, window, document) {
  'use strict';

  /* ---------- STATE ---------- */
  window.kwData  = window.kwData  || [];   // [{id, kw, last}]
  window.kwTable = window.kwTable || null;

  /* ---------- HELPERS ---------- */
  const nowStr   = () => moment().format('DD.MM.YYYY, HH:mm');
  const debounce = (fn, ms=350) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(null,a),ms);} };

  /* ---------- MINIMAL CSS (tek dosyadan hızlı düzeltme) ---------- */
  (function injectOnce(){
    if (document.getElementById('kwtable-inline-css')) return;
    const css = `
      #kwTable { table-layout: fixed; width: 100%; }
      #kwTable th, #kwTable td { vertical-align: middle; }
      #kwTable .select-col { width: 36px; text-align:center; }
      #kwTable .no-col     { width: 64px; text-align:center; }
      #kwTable .actions-col{ width: 110px; text-align:center; white-space:nowrap; }
      #kwTable td.actions-col button { background:none; border:0; margin:0 6px; padding:0; font-size:16px; cursor:pointer; }

      /* DataTables padding & toolbar */
      #kwTable.dataTable thead th, #kwTable.dataTable tbody td { padding: 12px 14px; }
      .pttable-container .dataTables_length label,
      .pttable-container .dataTables_filter { margin: 0; }
      .pttable-container .pt-search { position: relative; }
      .pttable-container .pt-search .entypo-search {
        position:absolute; right:10px; top:50%; transform:translateY(-50%); pointer-events:none;
      }
      .pttable-container .pt-search-input { padding-right:28px; }

      /* Kart üst/alt boşlukları */
      #kwTableBoxSecondary { width:100%; }
    `;
    const style = document.createElement('style');
    style.id = 'kwtable-inline-css';
    style.textContent = css;
    document.head.appendChild(style);
  })();

  /* ---------- MOUNT NOKTASI ---------- */
  const $box = $('#kwTableBoxSecondary');
  if (!$box.length) return;

  /* ---------- HTML ENJEKSİYONU ---------- */
  if (!$box.find('#kwTable').length) {
    $box.html(/*html*/`
      <div class="pttable-container">
        <div class="row mb-2 align-items-center">
          <div class="col-sm-4">
            <div class="dataTables_length">
              <label>Show
                <select name="kw_length" class="form-control form-control-sm">
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="-1">All</option>
                </select> entries
              </label>
            </div>
          </div>

          <div class="col-sm-4 text-center">
            <div class="bulk-actions">
              <select id="kwBulkField" class="form-control" style="width:auto;min-width:140px;display:inline-block;">
                <option value="" disabled selected>Bulk Actions</option>
                <option value="delete">Delete</option>
              </select>
              <button id="kwBulkApply" class="btn btn-purple" style="margin-left:8px;">Apply</button>
            </div>
          </div>

          <div class="col-sm-4 text-right">
            <div class="dataTables_filter">
              <div class="pt-search">
                <input id="kwSearchInput" type="search" class="pt-search-input" placeholder="Search…">
                <i class="entypo-search"></i>
              </div>
            </div>
          </div>
        </div>

        <table id="kwTable" class="display" style="width:100%">
          <thead>
            <tr>
              <th class="select-col"><input type="checkbox" id="kwSelectAll"></th>
              <th class="no-col">No</th>
              <th>Keyword</th>
              <th>Last Used</th>
              <th class="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    `);
  }

  const $tbl = $('#kwTable');

  /* ---------- DATATABLE INIT ---------- */
  function renumber () {
    if (!window.kwTable) return;
    const info = window.kwTable.page.info();
    window.kwTable.column(1, { page:'current' }).nodes()
      .each((cell, i) => { cell.innerHTML = info.start + i + 1; });
  }

  if ($.fn.DataTable.isDataTable($tbl)) { $tbl.DataTable().clear().destroy(); }

  window.kwTable = $tbl.DataTable({
    dom         : 't<"datatable-bottom d-flex justify-content-between align-items-center mt-2"ip>',
    data        : window.kwData,
    autoWidth   : false,
    deferRender : true,
    paging      : true,
    pageLength  : 10,
    lengthMenu  : [[10,25,50,-1],[10,25,50,'All']],
    order       : [],                    // başlangıç sırasını koru
    columns     : [
      { data:null, orderable:false, className:'select-col',
        defaultContent:'<input type="checkbox" class="kw-row-select">' },
      { data:null, className:'no-col', orderable:false,
        render:(d,t,r,m)=> m.row + 1 },
      { data:'kw',   title:'Keyword',    orderable:true,  width:null },
      { data:'last', title:'Last Used',  orderable:true,  width:'160px', defaultContent:'-' },
      { data:null,   className:'actions-col', orderable:false,
        defaultContent:
          '<button class="kw-edit" title="Edit"><i class="entypo-pencil"></i></button>' +
          '<button class="kw-del"  title="Delete"><i class="entypo-trash"></i></button>' }
    ],
    columnDefs: [
      { targets: [0,1,4], searchable:false }
    ]
  });

  window.kwTable.on('draw', renumber);
  renumber();
  window.kwTable.columns.adjust();

  /* ---------- GİRDİ OKUYUCULARI ---------- */
  function readBulkLines() {
    return ($('#keywordsBulkInput').val() || '')
      .split(/\r?\n/).map(t=>t.trim()).filter(Boolean);
  }
  function readManualSelect() {
    const $m = $('#keywordsManual'); // opsiyonel
    if (!$m.length) return [];
    const v = $m.val();
    return Array.isArray(v) ? v : [];
  }

  /* ---------- SENKRON ---------- */
  function syncKeywords () {
    const bulkLines  = readBulkLines();
    const manualSel  = readManualSelect();

    const seen = new Set(), ordered = [];
    [...bulkLines, ...manualSel].forEach(k=>{
      const s = String(k), low = s.toLowerCase();
      if (!seen.has(low)) { seen.add(low); ordered.push(s); }
    });

    const prevByKw = Object.create(null);
    (window.kwData || []).forEach(r => { prevByKw[r.kw.toLowerCase()] = r; });

    window.kwData.length = 0;
    ordered.forEach((kw, i) => {
      const prev = prevByKw[kw.toLowerCase()];
      window.kwData.push({ id:i+1, kw, last: prev ? prev.last : '-' });
    });

    window.kwTable.clear().rows.add(window.kwData).order([]).draw(false);
    window.kwTable.columns.adjust();

    const $wrapCard = $('#kwTableBoxSecondary').closest('.kw-card');
    if (window.kwData.length) { $wrapCard.show(); } else { $wrapCard.hide(); }

    $(document).trigger('kw:updated', [ ordered ]);
    $(document).trigger('kwSyncDone');
  }
  window.syncKeywords = syncKeywords;

  /* Canlı input bağları */
  $(document).on('input',  '#keywordsBulkInput', debounce(syncKeywords, 300));
  $(document).on('change', '#keywordsManual',    syncKeywords);

  /* ---------- BULK ACTIONS ---------- */
  $('#kwBulkApply').on('click',function(){
    const action = $('#kwBulkField').val();
    if(!action) return;

    const $rows = $('#kwTable tbody .kw-row-select:checked').closest('tr');
    if(!$rows.length) return alert('Select at least one row.');

    if(action==='delete'){
      if (!confirm(`Delete ${$rows.length} keyword(s)?`)) return;
      $rows.each(function(){
        const rowData = window.kwTable.row(this).data();
        const ix = window.kwData.findIndex(d=>d.id===rowData.id);
        if (ix>-1) window.kwData.splice(ix,1);
      });
      window.kwTable.rows($rows).remove().draw(false);
      $('#kwSelectAll').prop('checked', false);

      const $wrapCard = $('#kwTableBoxSecondary').closest('.kw-card');
      if (!window.kwData.length) $wrapCard.hide();
    }
    $('#kwBulkField').val('');
  });

  /* ---------- SATIR AKSİYONLARI ---------- */
  $(document).on('click', '.kw-del', function(){
    if(!confirm('Delete this keyword?')) return;
    const row = window.kwTable.row($(this).closest('tr'));
    const data= row.data();
    const ix  = window.kwData.findIndex(d=>d.id===data.id);
    if (ix>-1) window.kwData.splice(ix,1);
    row.remove().draw(false);

    const $wrapCard = $('#kwTableBoxSecondary').closest('.kw-card');
    if (!window.kwData.length) $wrapCard.hide();
  });

  $(document).on('click', '.kw-edit', function(){
    const row = window.kwTable.row($(this).closest('tr'));
    const data= row.data();
    const val = prompt('Edit keyword:', data.kw);
    if (val && val.trim()) {
      data.kw   = val.trim();
      data.last = nowStr();
      row.invalidate().draw(false);
      const ref = window.kwData.find(r=>r.id===data.id);
      if (ref) { ref.kw = data.kw; ref.last = data.last; }
      $(document).trigger('kw:updated', [ window.kwData.map(x=>x.kw) ]);
    }
  });

  /* ---------- MASTER CHECKBOX ---------- */
  $(document).on('change', '#kwSelectAll', function(){
    $('#kwTable tbody .kw-row-select').prop('checked', this.checked);
  });

  /* ---------- SHOW & SEARCH ---------- */
  $(document).on('change', 'select[name="kw_length"]', function(){
    window.kwTable.page.len(+this.value).draw(false);
    window.kwTable.columns.adjust();
  });
  $(document).on('input', '#kwSearchInput', function(){
    window.kwTable.search(this.value).draw();
  });

  /* ---------- BOOT ---------- */
  const $wrapCard = $('#kwTableBoxSecondary').closest('.kw-card');
  if (!(window.kwData && window.kwData.length)) { $wrapCard.hide(); }
  syncKeywords();

})(jQuery, window, document);
