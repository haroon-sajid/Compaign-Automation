/* assets/js/create-campaign/06-output/outputPreview.js
   -----------------------------------------------------
   “Output Preview” panelini (Step-6) güncel tutan modül.
   ----------------------------------------------------- */
;(function ($) {
  'use strict';

  /* ————— Build preview once and whenever the wizard adım
     değiştirildiğinde çağrılır ————— */
  function buildPreview () {
    const preview = `
      <strong>Campaign:</strong> ${$('#campaignName').val() || '-'}<br>
      <strong>User Prompt:</strong> ${$('#userPromptText').val() || '-'}<br>
      <strong>System Prompt:</strong> ${$('#systemPromptText').val() || '-'}<br>
      <strong>Keywords:</strong> ${($('#keywordsManual').val() || []).join(', ') || '-'}<br>
      <strong>Template:</strong> ${$('#templateDropdown option:selected').text() || '-'}<br>
      <strong>Tone:</strong> ${$('#toneHidden').val() || '-'}<br>
      <strong>Word Count:</strong> ${typeof getWordCount === 'function' ? getWordCount() : '-'}<br>
      <strong>Schedule:</strong> ${$('#scheduleDate').val() || '-'}
        (${ $('#frequencySelect option:selected').text() || '-' })
    `;

    $('#outputPreview').html(preview);
  }

  /* DOM hazır olduğunda bağla */
  $(function () {
    /* İlk açılışta ön-izlemeyi bir kere üret */
    buildPreview();

    /* Wizard adımları arasında geçiş yapıldığında güncelle */
    $(document).on('click', '.next-step, .prev-step', buildPreview);

    /* İlgili form alanları değiştikçe de canlı güncellemek istiyorsan
       aşağıdaki satırı yorumdan çıkarabilirsin. */
    // $(document).on('input change', '#appCreateCampaign input, #appCreateCampaign textarea, #appCreateCampaign select', buildPreview);
  });

})(jQuery);
