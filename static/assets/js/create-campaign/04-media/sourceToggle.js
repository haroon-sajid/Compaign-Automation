/*  sourceToggle.js  – Media adımındaki Auto Search / Manually Add anahtarı
   -------------------------------------------------------------- */
(function ($) {
  'use strict';

  $(function () {

    /* ► Başlangıçta kaydırma çubuğunu gizle */
    $('#sourceToggle .source-slider').hide();

    /* ------------------------------------------------------------
       Tüm alanların göster / gizle mantığı
       Global erişim gerektiği için window’a açıyoruz
    ----------------------------------------------------------------*/
    window.evalAutoFields = function () {
      const mode = $('#sourceHidden').val();          // '', auto, manual
      const isAuto = mode === 'auto';

      /* Hiç seçim yoksa her şeyi kapat */
      if (!mode) {
        $('#autoFields, #mediaUploadBox').hide();
        $('#mediaCards').toggle(false);
        if (typeof refreshSummary === 'function') refreshSummary();
        return;
      }

      const anyCard = $('#mediaCards .media-card.selected').length > 0;

      /* Manuel mod → Upload kutusunu göster */
      $('#mediaUploadBox').toggle(!isAuto && anyCard);
      if (!isAuto && anyCard) $('#mediaUploadBox').css('min-height', '40px');

      /* Otomatik mod → Ek alanları göster */
      $('#autoFields').toggle(isAuto && anyCard);

      $('#mediaCards').toggle(true);                  // Kart paneli mutlaka açık

      if (typeof refreshSummary === 'function') refreshSummary();
    };

    /* ------------------------------------------------------------
       Anahtarı tıklama olayı
    ----------------------------------------------------------------*/
    $('#sourceToggle')
      .off('click.sourceToggle')                       // Eski bağ varsa sök
      .on('click.sourceToggle', '.source-opt', function () {

        const $btn = $(this);
        const isActive = $btn.hasClass('active');

        /* Aynı seçeneğe tekrar tıklandıysa ⇒ sıfırla */
        if (isActive) {
          $('.source-opt').removeClass('active');
          $('#sourceHidden').val('');
          $('#sourceToggle').removeClass('manual');
          $('#sourceToggle .source-slider').hide();
          window.evalAutoFields();
          return;
        }

        /* Yeni seçim */
        const val = $btn.data('val');                  // auto | manual
        $('.source-opt').removeClass('active');
        $btn.addClass('active');

        $('#sourceHidden').val(val);
        $('#sourceToggle').toggleClass('manual', val === 'manual');
        $('#sourceToggle .source-slider').show();

        window.evalAutoFields();                       // UI senkronu
        $('#mediaCards').fadeIn(120);                  // Kart panelini aç

        /* Match-Images paneli bu moda bağlıysa güncelle */
        if (typeof toggleMatchImagesPanel === 'function') {
          toggleMatchImagesPanel();
        }
      });

    /* Sayfa taslağından restore edildiyse ilk durumu ayarla */
    window.evalAutoFields();
  });
})(jQuery);
