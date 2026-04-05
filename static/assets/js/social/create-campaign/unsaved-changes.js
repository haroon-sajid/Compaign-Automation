/*!
 * unsaved-changes.js
 * Create-Campaign sihirbazında taslak veriyi korumak için
 * "sayfadan ayrılma" uyarılarını ve kirli (dirty) bayrağını yönetir
 * ---------------------------------------------------------------
 * Gereksinimler: jQuery (≥2.2.4) – sayfada zaten yüklü
 */
(function ($) {
  'use strict';

  $(function () {

    /* ——————————————————————————————————————————
       KİRLİ BAYRAK & ENTER ENGELLEYİCİLERİ
    —————————————————————————————————————————— */
    let isDirty = false;

    // “Enter” ile formun yanlışlıkla submit edilmesini engelle
    $('#templateName').on('keydown', preventEnterInInputs);
    $('form').on('keydown', 'input', preventEnterGlobal);

    // Yalnızca “New Prompt” modunda alanlardaki değişiklikleri takip et
    $('#templateName, #systemPromptText, #userPromptText')
      .on('input', trackDirtyFields);

    /* ——————————————————————————————————————————
       SAYFADAN AYRILMA UYARISI
    —————————————————————————————————————————— */
    const beforeUnloadHandler = function (e) {
      if (!hasUnsavedData()) return;          // Kaydedilecek veri yoksa sessizce çık
      const msg = 'You have unsaved data that will be lost. Do you want to save it before leaving?';
      e.preventDefault();
      e.returnValue = msg;
      return msg;                             // Eski tarayıcılar için
    };
    window.addEventListener('beforeunload', beforeUnloadHandler);

    // Kampanya “Save & Queue” ile gönderilince uyarıyı kaldır
    $('#publishForm').on('submit', function () {
      window.removeEventListener('beforeunload', beforeUnloadHandler);
    });

    /* ——————————————————————————————————————————
       YARDIMCI FONKSİYONLAR
    —————————————————————————————————————————— */
    function preventEnterInInputs(e) {
      if (e.key === 'Enter') e.preventDefault();
    }

    function preventEnterGlobal(e) {
      if (e.key === 'Enter' && !$(e.target).is('textarea')) e.preventDefault();
    }

    function trackDirtyFields() {
      if (!$('#cardNew').hasClass('selected')) {
        isDirty = false;
        return;
      }
      const name = $('#templateName').val().trim();
      const sys  = $('#systemPromptText').val().trim();
      const user = $('#userPromptText').val().trim();
      isDirty = Boolean(name || sys || user);
    }

    function hasUnsavedData() {
      return Boolean(
        $('#campaignName').val().trim()     ||
        $('#templateName').val().trim()     ||
        $('#systemPromptText').val().trim() ||
        $('#userPromptText').val().trim()   ||
        $('#templateDropdown').val()
      );
    }

  });
})(jQuery);
