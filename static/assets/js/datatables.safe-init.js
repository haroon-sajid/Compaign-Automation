/* datatable-safe-init */
if (window.$ && $.fn && $.fn.DataTable) {
  $.extend($.fn.dataTable.defaults, { retrieve: true, destroy: true });
}


/* adjustAllTables – moved from HTML inline */
window.adjustAllTables = function () {
  if (!$.fn || !$.fn.DataTable) return;
  const tables = $.fn.dataTable.tables(true);
  $(tables).each(function () {
    if (!$.fn.DataTable.isDataTable(this)) return;
    const api = $(this).DataTable();
    api.columns.adjust();
    api.draw(false);
  });
};

/* Sekme geçişlerinde ve fontlar yüklendiğinde yeniden ölç */
$(document).on('shown.bs.tab', 'a[data-toggle="tab"]', window.adjustAllTables);
if (document && document.fonts && document.fonts.ready) {
  document.fonts.ready.then(window.adjustAllTables);
}
