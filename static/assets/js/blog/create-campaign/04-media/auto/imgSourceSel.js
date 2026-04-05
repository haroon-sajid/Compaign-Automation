/*  ──────────────────────────────────────────────────────────────
 *  imgSourceSel.js
 *  – <select id="imgSourceSel"> kontrollerinin tamamı
 *  – v1.0 (Ağustos 2025)
 *  ────────────────────────────────────────────────────────────── */
;(function ($) {
  $(function () {

    /* ▼ 1)  Kaynak seçildiğinde Search-Mode’u senkronize et */
    $('#imgSourceSel').on('change.imgSourceSel', function () {

    });

    /* ▼ 2)  Step-4’ten çıkarken “Image Source” seçilmiş mi kontrol et */
    $(document).on('click.imgSourceSel', '.next-step', function (e) {
      const $btn        = $(this);
      const activeStep  = +$('.wizard-step.active').data('step');
      if (activeStep !== 4) return;                       // Yalnız “Media” adımı

      const mode   = $('#sourceHidden').val();            // auto | manual | ''
      if (mode !== 'auto') return;                        // Sadece Auto-Search

      if ($('#imgSourceSel').val()) return;               // Seçiliyse sorun yok

      /* ▼ Kullanıcıyı uyar + ilerlemeyi engelle */
      e.preventDefault();
      e.stopImmediatePropagation();
      alert('Auto Search kullanırken lütfen önce “Image Source” seçin.');
      /* Buton kilidini anında geri aç (ana handler’a gitmeden) */
      setTimeout(() => {
        $btn.prop('disabled', false).text($btn.text().replace(' ⌛', ''));
      }, 30);
    });

  });
})(jQuery);
