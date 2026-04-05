/*  summary-card.js  */
/*  Sticky “Summary” kartını günceller — v1.0  */

(function ($) {
  /* — Yardımcılar — */
  const clip = str => (str.length > 80 ? str.slice(0, 77) + '…' : str);
  const ucFirst = s => s.charAt(0).toUpperCase() + s.slice(1);

  /* — Ana fonksiyon (global erişim için window’a açıyoruz) — */
  window.refreshSummary = function refreshSummary() {
    /* 1 ) Campaign & Prompt */
    $('#sumCampaignName').text($('#campaignName').val().trim() || '-');

    const sysTxt = $('#systemPromptText').val().trim();
    const usrTxt = $('#userPromptText').val().trim();
    $('#sumSystemPrompt').text(sysTxt ? clip(sysTxt) : '-');
    $('#sumPrompt').text(usrTxt ? clip(usrTxt) : '-');

    /* 2 ) Keywords */
    const kwArr =
      (window.kwData && window.kwData.length
        ? window.kwData.map(k => k.kw)
        : $('#keywordsManual').val() || []
      ) || [];
    $('#sumKeywords').text(kwArr.length ? kwArr.join(', ') : '-');

    /* 3 ) Content Settings */
    const parts = [];
    const wCnt = $('#wordCount').val();
    if (wCnt) parts.push(`${wCnt} words`);

    const toneVal = $('#toneHidden').val();
    if (toneVal) parts.push(`Tone: ${ucFirst(toneVal)}`);

    const autoTags = Array.isArray(window.tagList) ? window.tagList : [];
    const manualTags =
      window.tagConfig && Array.isArray(window.tagConfig.globalTags)
        ? window.tagConfig.globalTags
        : [];
    const allTags = [...new Set([...autoTags, ...manualTags])];
    if (allTags.length) parts.push(`Tags: ${allTags.join(', ')}`);

const catValue = $('#category-selector').val(); // e.g., "5"
const catText = $('#category-selector option:selected').text(); // e.g., "fifth"

console.log('Category value:', catValue);
console.log('Category name:', catText);

if (catValue) parts.push(`Category: ${ucFirst(catText)}`);

    const seo = $('#seoPluginSelect').val();
    if (seo) parts.push(`SEO: ${ucFirst(seo)}`);

    const tempVal = $('#temperatureHidden').val();
    if (tempVal) parts.push(`Temp: ${parseFloat(tempVal).toFixed(2)}`);

    $('#sumContent').text(parts.length ? parts.join(', ') : '—');

    /* 4 ) Media */
    const srcVal = $('#sourceHidden').val(); // '', 'auto', 'manual'
    const mediaLbl =
      srcVal === 'auto'
        ? 'Auto Image Search'
        : srcVal === 'manual'
        ? 'Manually Add Image'
        : '–';
    $('#sumMedia').text(mediaLbl);

    /* 5 ) Schedule */
    const start = $('#scheduleDate').val().trim();
    const freqU = $('#frequencySelect').val();
    const gap = $('#frequencyValue').val();
    let schedTxt = start || '-';
    if (start && gap) schedTxt += `, every ${gap} ${ucFirst(freqU)}`;
    $('#sumSchedule').text(schedTxt);

    /* 6 ) Step text (yatay wizard adımına göre) */
    const step = +$('#wizardSteps li.active').data('step') || 1;
    $('#sumStepText').text(`Step ${step} / 6 ✓`);
  };

  /* — Olay dinleyicileri — */
  function bindSummaryEvents() {
    /* Anlık alan değişiklikleri */
    const inputSel =
      '#campaignName, #systemPromptText, #userPromptText, ' +
      '#wordCount, #toneHidden, #tagsSelect, #categorySelect, ' +
      '#seoPluginSelect, #temperatureHidden';

    $(document).on('input change', inputSel, window.refreshSummary);

    /* Takvim / frekans alanları */
    $(document).on(
      'change input keyup',
      '#frequencySelect, #frequencyValue, #scheduleDate',
      window.refreshSummary
    );

    /* DataTable yeniden çizildiğinde veya KW senkronu bittiğinde */
    $(document).on('kwSyncDone', window.refreshSummary);
    $(document).on('dtLoaded', () => {
      if (
        window.kwTable &&
        $.fn.DataTable.isDataTable('#kwTable') &&
        !window._kwTableHooked
      ) {
        window.kwTable.on('draw', window.refreshSummary);
        window._kwTableHooked = true;
      }
    });

    /* Sayfa ilk açılışta */
    window.refreshSummary();
  }

  /* DOM hazır → bağlantıları kur */
  $(bindSummaryEvents);
})(jQuery);
