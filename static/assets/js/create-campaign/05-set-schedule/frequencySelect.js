/*  /assets/js/create-campaign/05-set-schedule/frequencySelect.js
    v1.0 – 03 Ağu 2025  |  All frequency-select logic extracted */

(function ($) {
  'use strict';

  $(function () {

    const $select = $('#frequencySelect');
    const $value  = $('#frequencyValue');
    const $group  = $('#freqValueGroup');
    const $label  = $('#freqValueLabel');

    /* ▼▼ Ana değişiklik — seçime göre etiket & grup ▼▼ */
    function handleFreqChange () {
      const val = $select.val();                               // minutes|hours|…
      $label.text(`${val.charAt(0).toUpperCase() + val.slice(1)} Between Triggers`);
      $group.show();                                           // sayısal input’u görünür yap
      if (typeof refreshSummary === 'function') refreshSummary(); // özet kartı senkron
    }

    /* — Event binding — */
    $select.on('change', handleFreqChange);

    /* Negatif / 0 değer engeli */
    $value.on('input', function () {
      const n = parseInt(this.value, 10);
      this.setCustomValidity(isNaN(n) || n < 1
        ? 'Please enter a valid number'
        : '');
    });

    /* Sayfa açılışındaki varsayılan / draft değerini yansıt */
    if ($select.val()) handleFreqChange();
  });
})(jQuery);
