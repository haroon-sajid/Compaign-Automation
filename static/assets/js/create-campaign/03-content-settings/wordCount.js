/*  wordCount.js  –  Create-Campaign sihirbazı
   ------------------------------------------------------------------
   • Word Count alanını (id="wordCount") bağımsız yöneten tüm mantık
   • Otomatik geri-yükleme (draft), otomatik kaydetme ve canlı doğrulama
   • Global helper:  window.getWordCount()
   ------------------------------------------------------------------ */
;(function ($) {
  'use strict';

  /* ——— Yardımcılar ——— */
  const DRAFT_KEY = 'campaignDraftV2';

  /* Basit debounce */
  function debounce (fn, ms = 300) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  /* Dışarı açılan kısayol  */
  function getWordCount () {
    return $('#wordCount').val().trim();
  }
  window.getWordCount = getWordCount;

  /* ——— Başlat ——— */
  $(function () {

    /* 1) Taslaktan geri yükle ------------------------------------ */
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (draft?.settings?.wordCnt) {
        $('#wordCount').val(draft.settings.wordCnt);
      }
    } catch (err) {
      console.warn('[wordCount] Draft restore failed →', err);
    }

    /* 2) HTML5 aralık doğrulaması (300-4000) ---------------------- */
    $('#wordCount').on('input', function () {
      const n = +this.value;
      this.setCustomValidity(
        isNaN(n) || n < 300 || n > 4000
          ? 'Please enter a value between 300 and 4000'
          : ''
      );
    });

    /* 3) Değişiklikleri otomatik kaydet + özet kartını yenile ------ */
    $('#wordCount').on(
      'input change',
      debounce(function () {
        try {
          /* Taslak objesini oku/güncelle */
          const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
          draft.settings = draft.settings || {};
          draft.settings.wordCnt = getWordCount();
          localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } catch (err) {
          console.warn('[wordCount] Draft save failed →', err);
        }

        /* Özet kartı / ön izleme senkronu */
        if (typeof refreshSummary === 'function') refreshSummary();
      })
    );
  });
})(jQuery);
