/*  summary-card.js  */
/*  Sticky “Summary” kartını günceller — v1.4 (Start: prefix for schedule)  */

(function ($) {
  /* — Helpers — */
  const clip = str => (str && str.length > 80 ? str.slice(0, 77) + '…' : (str || ''));
  const ucFirst = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  /* Read pretty date from flatpickr alt input if present */
  function getPrettyDateFrom(inputSel) {
    const $raw = $(inputSel);
    if (!$raw.length) return '';
    const $siblings = $raw.siblings('input.flatpickr-input[readonly], input[readonly][class*="flatpickr"]');
    const altVal = ($siblings.first().val() || '').trim();
    if (altVal) return altVal;
    return ($raw.val() || '').trim();
  }

  /* Platform character count resolver */
  function getPlatformCharCount(id) {
    let $in = $(`.sp-char-input[data-platform="${id}"]`);
    if (!$in.length) $in = $(`#spChars_${id}`);
    if (!$in.length) {
      const $chip = $(`#spCard .sp-chip[data-id="${id}"]`);
      if ($chip.length) {
        $in = $chip.find('input[type="number"]');
        if (!$in.length) {
          const $next = $chip.next();
          if ($next && $next.find) $in = $next.find('input[type="number"]');
        }
      }
    }
    const raw = ($in.val() || '').toString().trim();
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  /* Collect selected platforms + char counts */
  function collectPlatformSummaries() {
    let selectedIds = [];
    if (window.socialPlatforms && typeof window.socialPlatforms.selected === 'function') {
      try { selectedIds = window.socialPlatforms.selected() || []; } catch (e) { selectedIds = []; }
    }
    if (!selectedIds.length) {
      selectedIds = $('#spCard .sp-check:checked').map(function () { return this.value; }).get();
    }
    return selectedIds.map(id => {
      const $chip = $(`#spCard .sp-chip[data-id="${id}"]`);
      const label = ($chip.find('.sp-label').text() || ucFirst(id) || '').trim();
      return { id, label, count: getPlatformCharCount(id) };
    });
  }

  /* Build schedule summary string (Start + frequency + End Condition) */
  function buildScheduleSummary() {
    const startPretty = getPrettyDateFrom('#scheduleDate') || '-';
    let text = `Start: ${startPretty}`;

    const unit = ($('#frequencySelect').val() || '').trim(); // minutes/hours/days/weeks/months
    const gapRaw = ($('#frequencyValue').val() || '').trim();
    const gapNum = gapRaw ? parseInt(gapRaw, 10) : null;

    if (unit) {
      if (gapNum && !Number.isNaN(gapNum)) {
        text += `, every ${gapNum} ${unit}`;
      } else {
        text += ` (${unit})`;
      }
    }

    const endSelVal = ($('#endConditionSelect').val() || 'never').trim();
    if (endSelVal === 'never') {
      text += ', End: never';
    } else if (endSelVal === 'after') {
      const n = parseInt(($('#endConditionValue').val() || '').trim(), 10);
      text += `, End: after ${Number.isFinite(n) ? n : '?'} runs`;
    } else if (endSelVal === 'until') {
      const untilPretty =
        getPrettyDateFrom('#endConditionValue') ||
        ($('#endConditionValue').val() || '?').trim();
      text += `, End: until ${untilPretty || '?'}`;
    }

    return text;
  }

  /* — Main (global) — */
  window.refreshSummary = function refreshSummary() {
    // 1) Campaign & Prompts
    $('#sumCampaignName').text(($('#campaignName').val() || '').trim() || '-');

    const sysTxt = ($('#systemPromptText').val() || '').trim();
    const usrTxt = ($('#userPromptText').val() || '').trim();
    $('#sumSystemPrompt').text(sysTxt ? clip(sysTxt) : '-');
    $('#sumPrompt').text(usrTxt ? clip(usrTxt) : '-');

    // 2) Keywords
    const kwArr =
      (window.kwData && window.kwData.length
        ? window.kwData.map(k => k.kw)
        : ($('#keywordsManual').val() || [])
      ) || [];
    $('#sumKeywords').text(kwArr.length ? kwArr.join(', ') : '-');

    // 3) Content Settings (order: Platforms → Temp → Tone → (optional extras))
    const parts = [];

    const platItems = collectPlatformSummaries();
    if (platItems.length) {
      parts.push(
        'Platforms: ' + platItems.map(p => `${p.label}: ${p.count} chars`).join(', ')
      );
    }

    const tempVal = $('#temperatureHidden').val();
    if (tempVal) parts.push(`Temp: ${parseFloat(tempVal).toFixed(2)}`);

    const toneVal = $('#toneHidden').val();
    if (toneVal) parts.push(`Tone: ${ucFirst(toneVal)}`);

    const autoTags = Array.isArray(window.tagList) ? window.tagList : [];
    const manualTags =
      window.tagConfig && Array.isArray(window.tagConfig.globalTags)
        ? window.tagConfig.globalTags
        : [];
    const allTags = [...new Set([...autoTags, ...manualTags])];
    if (allTags.length) parts.push(`Tags: ${allTags.join(', ')}`);

    const cat = $('#categorySelect').val();
    if (cat) parts.push(`Category: ${ucFirst(cat)}`);

    const seo = $('#seoPluginSelect').val();
    if (seo) parts.push(`SEO: ${ucFirst(seo)}`);

    $('#sumContent').text(parts.length ? parts.join(', ') : '—');

    // 4) Media
    const srcVal = $('#sourceHidden').val(); // '', 'auto', 'manual'
    const mediaLbl =
      srcVal === 'auto'
        ? 'Auto Image Search'
        : srcVal === 'manual'
        ? 'Manually Add Image'
        : '–';
    $('#sumMedia').text(mediaLbl);

    // 5) Schedule (with Start: prefix and End Condition)
    $('#sumSchedule').text(buildScheduleSummary());

    // 6) Step label
    const step = +($('#wizardSteps li.active').data('step') || 1);
    $('#sumStepText').text(`Step ${step} / 6 ✓`);
  };

  /* — Bindings — */
  function bindSummaryEvents() {
    const inputSel =
      '#campaignName, #systemPromptText, #userPromptText, ' +
      '#toneHidden, #tagsSelect, #categorySelect, ' +
      '#seoPluginSelect, #temperatureHidden';
    $(document).on('input change', inputSel, window.refreshSummary);

    $(document).on(
      'change input keyup',
      '#frequencySelect, #frequencyValue, #scheduleDate, #endConditionSelect, #endConditionValue',
      window.refreshSummary
    );

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

    $(document).on('platforms:changed platform:connected', window.refreshSummary);
    $(document).on('input change', '.sp-char-input, #spCard input[type="number"]', window.refreshSummary);

    window.refreshSummary();
  }

  $(bindSummaryEvents);
})(jQuery);
