/* -----------------------------------------------------------------
 *  searchModeSel.js   v3   (max 3 preview + “+N daha”)
 * ----------------------------------------------------------------- */
;(function ($) {
  'use strict';

  /******************************************************************
   *  AYARLAR
   ******************************************************************/
  const MAX_VISIBLE = 3;   // Ön-izleme çipi sınırı

  /******************************************************************
   *  FREE-FORM GÖSTER / GİZLE
   ******************************************************************/
  function toggleFreeForm () {
    const isPrompt = $('#searchModeSel').val() === 'prompt';
    $('#freeFormGroup').toggle(isPrompt);
  }

  /******************************************************************
   *  KEYWORD ÖN-İZLEME BARINI OLUŞTUR
   *  ---------------------------------------------------------------
   *  hide == true  → tamamen gizle
   ******************************************************************/
  window.renderKwPreview = function (hide = false) {
    const $bar   = $('#kwPreviewBar');
    const $chips = $('#kwPreviewChips');
    const $count = $('#kwPreviewCount');
    const $btn   = $('#kwPreviewToggle');

    if (hide) { $bar.hide(); return; }

    /* 1) Kaynak keyword listesi */
    let keywords = [];
    if (window.kwTable && $.fn.dataTable) {
      try {
        keywords = kwTable.column(2, { search: 'applied' }).data().toArray();
      } catch (e) {}
    }
    if (!keywords.length) keywords = $('#keywordsManual').val() || [];

    /* 2) Çipleri üret */
    $chips.empty();
    keywords.forEach((kw, i) => {
      const safe = $('<div>').text(kw).html();
      $chips.append(
        `<span class="kw-chip${ i >= MAX_VISIBLE ? ' extra' : '' }" title="${safe}">${safe}</span>`
      );
    });

    /* 3) Sayaç ve +N/Collapse butonu */
    const extraCount = Math.max(0, keywords.length - MAX_VISIBLE);
    $count.text(keywords.length);

    if (extraCount) {
      $btn.show()
          .text(`+${extraCount} daha`)
          .data({ collapsed:true, extraCount });
    } else {
      $btn.hide();
    }

    /* 4) Bar’ı göster */
    $bar.show();
  };

  /*  Toggle +N ⇄ Daralt  */
  $('#kwPreviewToggle').on('click', function () {
    const collapsed  = $(this).data('collapsed');
    const extraCount = $(this).data('extraCount') || 0;

    if (collapsed) {                     // → GENİŞLET
      $('#kwPreviewChips .extra').removeClass('extra');
      $(this).text('Daralt').data('collapsed', false);
    } else {                             // → DARALT
      $('#kwPreviewChips .kw-chip').slice(MAX_VISIBLE).addClass('extra');
      $(this).text(`+${extraCount} daha`).data('collapsed', true);
    }
  });

  /******************************************************************
   *  FREE-FORM ARAMA
   ******************************************************************/
  function runFreeFormSearch () {
    const q = $('#freeFormInput').val().trim();
    if (!q) { alert('Lütfen aramak istediğiniz komutu yazın.'); return; }

    /*  Buraya kendi arama fonksiyonunuzu bağlayın  */
    // searchImagesWithPrompt(q);
    console.log('[Free-form search]', q);

    /* Free-form aramada ön-izlemeyi gizle */
    renderKwPreview(true);
  }

  /******************************************************************
   *  DOM READY
   ******************************************************************/
  $(function () {

    /* searchModeSel değiştiğinde UI güncellemeleri */
    $('#searchModeSel')
      .off('.freeForm')
      .on('change.freeForm', function () {
        toggleFreeForm();
        if (this.value === 'keyword')  renderKwPreview();
        else                           renderKwPreview(true);
      })
      .trigger('change');

    /* Free-form arama tetikleri */
    $('#freeFormSearchBtn' ).on('click', runFreeFormSearch);
    $('#freeFormInput'     ).on('keydown', e => { if (e.key === 'Enter') runFreeFormSearch(); });

    /* Keyword değişimleri → preview güncelle (Keyword modu aktifse) */
    $(document).on('input change', '#keywordsManual, #keywordsBulkInput', () => {
      if ($('#searchModeSel').val() === 'keyword') renderKwPreview();
    });
    if (window.kwTable && $.fn.dataTable) {
      kwTable.on('draw', () => {
        if ($('#searchModeSel').val() === 'keyword') renderKwPreview();
      });
    }
  });

})(jQuery);
