/*  wizardSteps.js  – Create-Campaign sihirbazı adım denetleyicisi
   --------------------------------------------------------------
   •  jQuery’ye ve sayfadaki global yardımcı fonksiyonlara (adjustAllTables vb.)
      bağımlıdır – bunlar yüklenmişse otomatik çalışır.
   •  showStep() fonksiyonu → window.showStep olarak dışarı açılır, böylece
      sayfadaki diğer script’ler (“Next →” butonundaki handler vb.) aynen
      çağırmaya devam edebilir.
   -------------------------------------------------------------- */
(function ($) {
  'use strict';

  /* ——————————————————  Public  —————————————————— */
  window.showStep = showStep;         // diğer script’ler kullanabilsin

  /* ——————————————————  Init  —————————————————— */
  $(function () {

    /*  yatay stepper (üstteki numaralar)  */
    $('#wizardSteps').on('click', 'li', function () {
      showStep(+$(this).data('step'));
    });

    /*  “Back” (prev-step) butonları  */
    $(document).on('click', '.prev-step', function () {
      const curr = $('.wizard-step.active').data('step') || 1;
      showStep(curr - 1);
    });
  });

  /* ——————————————————  Core  —————————————————— */
  function showStep (step) {
    /* 1) Sınırla */
    const total = $('#wizardSteps li').length;
    step = Math.max(1, Math.min(step, total));

    /* 2) İçerik panelleri */
    $('.wizard-step').removeClass('active').hide();
    $('#promptTableBox').toggle(step === 1);
    $('#kwTableRow')   .toggle(step === 2);

    $(`.wizard-step[data-step="${step}"]`)
        .fadeIn(80)
        .addClass('active');

    /* 3) Dikey mini wizard */
    $('.sidebar-wizard li')
        .removeClass('active')
        .filter(`[data-step="${step}"]`).addClass('active');

    /* 4) Yatay wizardSteps barı */
    $('#wizardSteps li')
        .removeClass('active completed')
        .each(function () {
          const s = +$(this).data('step');
          if (s < step)      $(this).addClass('completed');
          else if (s === step) $(this).addClass('active');
        });

    /* 5) İlerleme çubuğu */
    $('#progressBar .progress-bar')
        .css('width', (step / total * 100) + '%');

    /* 6) Tabloları yeniden ölç (varsa) */
    if (typeof adjustAllTables === 'function') {
      setTimeout(adjustAllTables, 10);
    }

    /* 7) Diğer modüllere haber ver */
    $(document).trigger('wizardStepChanged', step);
  }

})(jQuery);
