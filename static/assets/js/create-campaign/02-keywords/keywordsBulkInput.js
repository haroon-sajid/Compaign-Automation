/*  keyword-table.js  */
/*  -----------------------------------------------------------
    Keywords DataTable + textarea / Select2 senkronizasyonu
    – Yayınlanan olaylar:
        • kw.ready   & kwTableReady
        • kw.changed & kwSyncDone
    – Match-Images entegrasyonu: window.kwList / window.keywords güncellenir
    ----------------------------------------------------------- */
;(function ($, w) {
'use strict';

/* ═════ 0. GLOBAL STATE ═════════════════════════════════════ */
w.kwData      = w.kwData      || [];   // [{ kw , cluster , last }]
w.clusterData = w.clusterData || [];   // [{ name , kwCount , last }]
w.kwList      = w.kwList      || [];   // kelime dizisi (Match-Images okur)
w.keywords    = w.keywords    || [];   // eski ad geriye dönük uyumluluk
let kwTable   = null;
w.kwTable     = null;                  // Match-Images erişir
w.syncKeywords= syncKeywords;          // dış API

/* ═════ 1. DATATABLE KURULUMU ═══════════════════════════════ */
function initDataTable () {
  if (!$.fn.DataTable) { console.error('[KW] DataTables bulunamadı'); return; }

  kwTable = $('#kwTable').DataTable({
    data: kwData,
    columns: [
      { data:null, orderable:false, width:'34px', className:'select-col',
        render:()=>'',
        createdCell:td=> $(td).html('<input type="checkbox" class="row-select">')
      },
      { data:null, className:'no-col', width:'36px',
        render:(d,t,r,meta)=> meta.row + 1
      },
      { data:'kw',       title:'Keyword' },
      { data:'cluster',  title:'Cluster', defaultContent:'-' },
      { data:'last',     title:'Last Used', defaultContent:'-' },
      { data:null, orderable:false, className:'actions-col', width:'60px',
        render:()=>
          '<button type="button" class="btn btn-xs btn-danger kw-del" title="Delete">✖</button>'
      }
    ],
    pageLength:25,
    order:[[2,'asc']],
    dom:'<"top"lfr>t<"bottom"ip>',
    language:{ emptyTable:'No keywords …', lengthMenu:'Show _MENU_' }
  });

  /* sıra numarası her draw’da güncelle */
  kwTable.on('draw', ()=>{
    const info = kwTable.page.info();
    kwTable.column(1,{page:'current'}).nodes().each((c,i)=>{
      c.innerHTML = info.start + i + 1;
    });
  });

  /* satır sil */
  $('#kwTable').on('click','.kw-del',function(){
    kwTable.row($(this).closest('tr')).remove().draw(false);
    triggerSyncDone();
  });

  /* select-all */
  $('#kwSelectAll').on('change', function(){
    $('#kwTable tbody .row-select').prop('checked', this.checked);
  });

  /* bulk actions */
  $('#kwBulkApply').on('click', function(){
    const act = $('#kwBulkField').val();
    const $sel= kwTable.rows().nodes().to$().find('.row-select:checked').closest('tr');
    if (!act || !$sel.length) return;

    if (act==='delete'){
      kwTable.rows($sel).remove().draw(false);

    } else if (act==='assign'){
      const target = $('#kwBulkWrapper select').val();
      if (!target) return alert('Select a cluster first.');
      $sel.each(function(){
        const d = kwTable.row(this).data();
        d.cluster = target;
        kwTable.row(this).data(d).invalidate();
      });
      kwTable.draw(false);
    }
    triggerSyncDone();
  });

  /* bulk-UI toggle */
  $('#kwBulkField').on('change', function(){
    if (this.value==='assign'){
      const opts = clusterData.map(c=>`<option value="${c.name}">${c.name}</option>`).join('');
      $('#kwBulkWrapper').html(`<select class="form-control">${opts}</select>`);
    } else { $('#kwBulkWrapper').empty(); }
  });

  w.kwTable = kwTable;

  /* tablo hazır olayları */
  $(document).trigger('kwTableReady');
  $(document).trigger('kw.ready');
}

/* ═════ 2. SENKRON FONKSİYONLARI ═════════════════════════════ */
const dedupe = arr=> Array.from(new Set(arr));
const split  = s=> s.split(/\r?\n/).map(t=>t.trim()).filter(Boolean);

function buildRows (list){
  const stamp = moment().format('DD-MMM-YY HH:mm');
  return list.map(kw=>({ kw, cluster:'-', last:stamp }));
}

function syncKeywords () {
  if (!kwTable) return;

  const tArea = split($('#keywordsBulkInput').val());
  const manual= ($('#keywordsManual').val()||[]).map(s=>s.trim()).filter(Boolean);
  const merged= dedupe( tArea.concat(manual) );

  /* global dizi güncelle – Match-Images buradan okur */
  w.kwList   = merged.slice();
  w.keywords = merged.slice();   // backward-compat

  /* tablo ile karşılaştır; gerekirse güncelle */
  const sig  = merged.join('|');
  if (kwTable.data().toArray().map(r=>r.kw).join('|') === sig) return;

  kwTable.clear().rows.add( buildRows(merged) ).draw(false);
  triggerSyncDone();
}

function tableToTextarea (){
  if (!kwTable) return;
  $('#keywordsBulkInput').val( kwTable.column(2).data().toArray().join('\n') );
}

function triggerSyncDone (){
  tableToTextarea();
  $(document).trigger('kwSyncDone');  // yeni isim
  $(document).trigger('kw.changed');  // eski isim (Match-Images dinliyor)
}

/* ═════ 3. EVENT BINDING ═════════════════════════════════════ */
const debounce = (fn,ms=250)=>{ let t; return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);} };

$(document).on('input', '#keywordsBulkInput', debounce(syncKeywords,300));
$('#keywordsManual').on('change',             debounce(syncKeywords,100));

/* ═════ 4. BAŞLAT ════════════════════════════════════════════ */
$(initDataTable);
$(syncKeywords);

})(jQuery, window);
