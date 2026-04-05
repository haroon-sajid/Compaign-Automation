/* =================================================================== 
 * create-campaign-prompt-table.js · 2025-08-03 r8
 * Prompt Templates ➜ self-contained DataTable + toolbar
 *   – yeni kayıt her zaman listenin EN TEPEsinde
 *   – select-all, bulk delete, live search dâhil
 *   – prompt.js ile public API üzerinden entegre (removeTemplate, setMode, vb.)
 * =================================================================== */
(function ($, window, document) {
  'use strict';

  /* 0) Veri dizisi ------------------------------------------------- */
  window.promptTemplates = window.promptTemplates || [];

  /* 1) HTML iskeletini enjekte et --------------------------------- */
  const $box = $('#promptTableBox');
  if (!$box.length) return;                 // placeholder yoksa dur

  if (!$box.find('#ptTable').length) {
    $box.html(/*html*/`
      <div class="pttable-container">
        <!-- üst bar -->
        <div class="row mb-2 align-items-center">
          <div class="col-sm-4">
            <div class="dataTables_length">
              <label>Show
                <select name="pt_length" class="form-control form-control-sm">
                  <option value="10">10</option><option value="25">25</option>
                  <option value="50">50</option><option value="-1">All</option>
                </select> entries
              </label>
            </div>
          </div>
          <div class="col-sm-4 text-center">
            <div class="bulk-actions">
              <select id="ptBulkField" class="form-control"
                      style="width:auto;min-width:120px;display:inline-block;">
                <option value="" disabled selected>Bulk Actions</option>
                <option value="delete">Delete</option>
              </select>
              <button id="ptBulkApply" class="btn btn-purple">Apply</button>
            </div>
          </div>
          <div class="col-sm-4 text-right">
            <div class="dataTables_filter">
              <div class="pt-search">
                <input id="ptSearchInput" type="search"
                       class="pt-search-input" placeholder="Search…">
                <i class="entypo-search"></i>
              </div>
            </div>
          </div>
        </div>

        <!-- DataTable -->
        <table id="ptTable" class="display" style="width:100%">
          <thead>
            <tr>
              <th class="select-col"><input type="checkbox" id="ptSelectAll"></th>
              <th class="no-col">No</th>
              <th>Prompt Name</th>
              <th>System Prompt</th>
              <th>User Prompt</th>
              <th>Last Used</th>
              <th class="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    `);
  }

  /* 2) Yardımcılar ------------------------------------------------- */
  const toRow = t => ({
    id  : t.id,
    name: t.name,
    sys : t.system || '—',
    usr : t.user   || '—',
    last: t.last   || '—'
  });

  function renumber () {
    const info = ptTable.page.info();
    ptTable.column(1,{page:'current'}).nodes()
           .each((c,i)=>{ c.innerHTML = info.start + i + 1; });
  }

  /* 3) DataTable init (safe) -------------------------------------- */
  const $tbl = $('#ptTable');
  if ($.fn.DataTable.isDataTable($tbl)) { $tbl.DataTable().clear().destroy(); }

  const ptTable = $tbl.DataTable({
    dom         : 't<"datatable-bottom"ip>',
    data        : window.promptTemplates.map(toRow),
    autoWidth   : false,
    deferRender : true,
    scrollX     : true,
    pageLength  : 10,
    lengthMenu  : [[10,25,50,-1],[10,25,50,'All']],
    order       : [],                      // sıralama YOK → dizideki sıra korunur
    columns : [
      { data:null, orderable:false, className:'select-col',
        defaultContent:'<input type="checkbox" class="row-select">' },
      { data:null, className:'no-col',
        render:(d,t,r,m)=>m.row+1 },
      { data:'name' },
      { data:'sys'  },
      { data:'usr'  },
      { data:'last' },
      { data:null, orderable:false, className:'actions-col',
        defaultContent:
          '<button class="deletePt" title="Delete"><i class="entypo-trash"></i></button>' }
    ]
  });

  ptTable.on('draw', renumber);
  renumber();

  /* 4) Kontroller -------------------------------------------------- */
  $('select[name="pt_length"]').on('change',function(){
    ptTable.page.len(+this.value).draw(false);
  });

  $('#ptSearchInput').on('keyup',function(){
    ptTable.search(this.value).draw();
  });

  $('#ptSelectAll').on('change',function(){
    $('#ptTable input.row-select').prop('checked',this.checked);
  });

  /* ▼ Bulk Delete – public API üzerinden sil (removeTemplate) */
  $('#ptBulkApply').on('click', function () {
    if ($('#ptBulkField').val() !== 'delete') return;
    const ids = $('#ptTable input.row-select:checked').closest('tr')
                 .map(function(){ return ptTable.row(this).data().id; }).get();
    if (!ids.length) return alert('Select at least one template.');
    if (!confirm(`Delete ${ids.length} template(s) permanently?`)) return;

    ids.forEach(id=>{
      if (typeof window.removeTemplate === 'function') {
        window.removeTemplate(id);
      } else {
        // Emniyet şeridi: public API yoksa doğrudan veri dizisinden sil
        const ix = window.promptTemplates.findIndex(t=>t.id===id);
        if(ix>-1) window.promptTemplates.splice(ix,1);
      }
    });
    $('#ptSelectAll').prop('checked', false);
    $('#ptBulkField').val('');
    refreshAll();
  });

  /* ▼ Tekli Delete – public API üzerinden sil (removeTemplate) */
  $('#ptTable tbody').on('click','.deletePt',function(){
    const rowData = ptTable.row($(this).closest('tr')).data();
    if(!rowData) return;
    if(!confirm(`Delete template “${rowData.name}”?`)) return;

    if (typeof window.removeTemplate === 'function') {
      window.removeTemplate(rowData.id);
    } else {
      const ix = window.promptTemplates.findIndex(t=>t.id===rowData.id);
      if(ix>-1) window.promptTemplates.splice(ix,1);
    }
    refreshAll();
  });

  /* 5) Yenileme + dış API ----------------------------------------- */
  function refreshAll (keepId=null){
    ptTable.clear().rows.add(window.promptTemplates.map(toRow));
    ptTable.order([]).draw(false);   // kullanıcı Sorting’ini sıfırla → en yeni üstte
    renumber();

    /* dropdown senkron */
    const $ddl = $('#templateDropdown');
    if($ddl.length){
      const sel = keepId || $ddl.val();
      $ddl.empty().append('<option value="">Select template…</option>');
      window.promptTemplates.forEach(t=>{
        $ddl.append(`<option value="${t.id}" ${t.id==sel?'selected':''}>${t.name}</option>`);
      });
    }
    if(typeof window.refreshSummary==='function') window.refreshSummary();
  }

  /* ——— Modal seçme / silme entegrasyonları (opsiyonel ama güvenli) ——— */

  // Modal içinden şablon seçme
  $(document).on('click', '.select-template', function() {
    if (typeof window.setMode === 'function') window.setMode('existing');
    const id = $(this).data('id');
    $('#templateDropdown').val(id).trigger('change');
    $('#templateModal').modal && $('#templateModal').modal('hide');
  });

  // Modal içinden tekli silme (templateTable varsa)
  $(document).on('click', '.delete-template', function () {
    if (!confirm('Delete this template permanently?')) return;

    const id   = +$(this).data('id');
    const $row = $(this).closest('tr');

    // Eğer modal içi DataTable varsa önce UI’dan düşür
    const modalTbl = $.fn.DataTable.isDataTable('#templateTable')
      ? $('#templateTable').DataTable() : null;
    if (modalTbl) {
      modalTbl.row($row).remove().draw(false);
      modalTbl.column(0).nodes().each((c,i)=>{ c.innerHTML = i+1; });
    }

    if (typeof window.removeTemplate === 'function') {
      window.removeTemplate(id);
    } else {
      const ix = window.promptTemplates.findIndex(t=>t.id===id);
      if(ix>-1) window.promptTemplates.splice(ix,1);
    }

    if (typeof window.updateExistingSectionVisibility === 'function') {
      window.updateExistingSectionVisibility();
    }
    refreshAll();
  });

  /* dışa aç */
  window.refreshPtTable = refreshAll;
  window.ptTable        = ptTable;
  window.ptRenumber     = renumber;

})(jQuery, window, document);
