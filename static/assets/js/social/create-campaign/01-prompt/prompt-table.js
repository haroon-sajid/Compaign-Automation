/* ===================================================================
 * create-campaign-prompt-table.js · 2025-08-05 r9 (Refactored)
 * Prompt Templates ➜ self-contained DataTable + toolbar
 *   – Relies on the public API from create-campaign.prompt.js for all
 *     data mutations (e.g., deletion) and state management.
 *   – This script now focuses SOLELY on DataTable initialization and toolbar events.
 * =================================================================== */
(function ($, window, document) {
  'use strict';

  /* 0) Veri dizisi ------------------------------------------------- */
  // The global array is populated by the main prompt.js script
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
  // This helper is no longer needed here as the main script provides the row object
  // const toRow = t => ({...});

  function renumber() {
    const info = ptTable.page.info();
    ptTable.column(1, { page: 'current' }).nodes()
      .each((c, i) => { c.innerHTML = info.start + i + 1; });
  }

  /* 3) DataTable init (safe) -------------------------------------- */
  const $tbl = $('#ptTable');
  if ($.fn.DataTable.isDataTable($tbl)) { $tbl.DataTable().clear().destroy(); }

  const ptTable = $tbl.DataTable({
    dom: 't<"datatable-bottom"ip>',
    // The data is now populated by refreshTable() in the main script,
    // but initializing with the current state is good practice.
    data: window.promptTemplates.map(t => ({
      id: t.id, name: t.name, sys: t.system || '—', usr: t.user, last: t.last
    })),
    autoWidth: false,
    deferRender: true,
    scrollX: true,
    pageLength: 10,
    lengthMenu: [[10, 25, 50, -1], [10, 25, 50, 'All']],
    order: [],                      // No initial sorting, preserves array order
    columns: [
      {
        data: null, orderable: false, className: 'select-col',
        defaultContent: '<input type="checkbox" class="row-select">'
      },
      {
        data: null, className: 'no-col',
        render: (d, t, r, m) => m.row + 1
      },
      { data: 'name' },
      { data: 'sys' },
      { data: 'usr' },
      { data: 'last' },
      {
        data: null, orderable: false, className: 'actions-col',
        // --- CHANGED: Use a render function to add the data-id attribute ---
        // This button now uses the 'delete-prompt-btn' class, which is handled
        // by the delegated event listener in create-campaign.prompt.js
        render: function (data, type, full, meta) {
          return `<button class="delete-prompt-btn" title="Delete" data-id="${full.id}"><i class="entypo-trash"></i></button>`;
        }
      }
    ]
  });

  ptTable.on('draw', renumber);
  renumber();

  /* 4) Kontroller -------------------------------------------------- */
  $('select[name="pt_length"]').on('change', function () {
    ptTable.page.len(+this.value).draw(false);
  });

  $('#ptSearchInput').on('keyup', function () {
    ptTable.search(this.value).draw();
  });

  $('#ptSelectAll').on('change', function () {
    $('#ptTable input.row-select').prop('checked', this.checked);
  });

  /* ▼ Bulk Delete – Call the public API (window.removeTemplate) */
  $('#ptBulkApply').on('click', function () {
    if ($('#ptBulkField').val() !== 'delete') return;
    const ids = $('#ptTable input.row-select:checked').closest('tr')
      .map(function () { return ptTable.row(this).data().id; }).get();

    if (!ids.length) {
      if (typeof toastr !== 'undefined') toastr.warning('Please select at least one template to delete.');
      else alert('Select at least one template.');
      return;
    }

    // Call the public API for each ID. The API will handle confirmation and UI updates.
    // NOTE: This will show a confirmation prompt for each selected item.
    // A future improvement could be a `removeMultipleTemplates(ids)` API function.
    ids.forEach(id => {
      if (typeof window.removeTemplate === 'function') {
        window.removeTemplate(id);
      }
    });

    // --- REMOVED --- The unnecessary refreshAll() call is gone.
    // The main script will update the table row-by-row upon successful deletion.
    $('#ptSelectAll').prop('checked', false);
    $('#ptBulkField').val('');
  });

  /* ▼ Tekli Delete – REMOVED */
  // The single delete button is now handled by the delegated event listener
  // in `create-campaign.prompt.js` because we added the `.delete-prompt-btn` class.
  // This avoids duplicate event handlers.
  // $('#ptTable tbody').on('click', '.deletePt', function () { ... });

  /* 5) Yenileme + dış API ----------------------------------------- */
  // --- REMOVED --- The `refreshAll` function is no longer needed.
  // All UI updates are now driven by the main `create-campaign.prompt.js` script
  // via its `refreshTable` and `fillDDL` functions.
  // function refreshAll(keepId = null) { ... }

  /* ——— Modal event handlers (legacy integration) ——— */
  // These are simplified to only call the public APIs without manual refresh calls.
  $(document).on('click', '.select-template', function () {
    if (typeof window.setMode === 'function') window.setMode('existing');
    const id = $(this).data('id');
    $('#templateDropdown').val(id).trigger('change');
    $('#templateModal').modal && $('#templateModal').modal('hide');
  });

  $(document).on('click', '.delete-template', function () {
    const id = $(this).data('id');
    if (id && typeof window.removeTemplate === 'function') {
      // The API function handles confirmation and all UI updates.
      window.removeTemplate(id);
    }
  });

  /* Dışa aç (Expose public API) */
  // Expose the DataTable instance for external access if needed.
  window.ptTable = ptTable;
  // Expose the renumbering function so the main script can call it after a full redraw.
  window.ptRenumber = renumber;

})(jQuery, window, document);