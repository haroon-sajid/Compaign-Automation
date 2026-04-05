/* =======================================================================
   AUTO-SAVE v3  (LocalStorage) – External file
   ======================================================================= */
$(function () {

  /* -------------------- Config -------------------- */
  const KEY   = 'campaignDraftV2';   // localStorage anahtarı
  let   timer = null;                // debounce tutucu
  let   isRestoring = false;         // geri yüklenirken tetikleme

  /* ----------- Helpers ----------- */
  const safe = v => v ?? '';

  /*  Collect current wizard state (null-safe)  */
  function collectState () {
    return {
      step : $('.wizard-step.active').data('step') || 1,

      /* Campaign */
      name : safe($('#campaignName').val()),

      /* Prompt */
      prompt : {
        templateId : $('#templateDropdown').val() || '',
        template   : {
          name : safe($('#templateName').val()),
          sys  : safe($('#systemPromptText').val()),
          user : safe($('#userPromptText').val())
        }
      },

      /* Keywords & clusters */
      keywords : {
        list     : window.kwData      ? [...window.kwData]      : [],
        clusters : window.clusterData ? [...window.clusterData] : []
      },

      /* Content settings */
      settings : {
        tone : safe($('#toneHidden').val()),
        temp : safe($('#temperatureHidden').val())
      },

      /* Media */
      media : {
        mode  : safe($('#sourceHidden').val()),           // auto | manual
        cards : $('#mediaCards .media-card.selected').map((_, c) => c.id).get()
      },

      /* Schedule */
      schedule : {
        start : safe($('#scheduleDate').val()),
        freq  : safe($('#frequencySelect').val()),
        gap   : safe($('#frequencyValue').val())
      }
    };
  }

  /*  Persist state (with 400 KB guard)  */
  function saveState () {
    try {
      const payload = JSON.stringify(collectState());
      if (payload.length < 400_000) localStorage.setItem(KEY, payload);
    } catch (err) {
      console.warn('[Autosave] Taslak kaydedilemedi →', err);
    }
  }

  /*  Debounced save on any form edit  */
  $(document).on('input change', 'input, textarea, select', () => {
    if (isRestoring) return;         // restore sırasında tetikleme
    clearTimeout(timer);
    timer = setTimeout(saveState, 1000);
  });

  /*  Restore draft on page load  */
  try {
    const draft = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (draft && typeof draft === 'object') {
      isRestoring = true;

      /* ►► Campaign */
      $('#campaignName').val(draft.name);

      /* ►► Prompt */
      $('#templateDropdown').val(draft.prompt?.templateId).trigger('change');
      $('#templateName').val(draft.prompt?.template?.name);
      $('#systemPromptText').val(draft.prompt?.template?.sys);
      $('#userPromptText').val(draft.prompt?.template?.user);

      /* ►► Content settings */
      if (draft.settings?.tone) {
        $('#toneHidden').val(draft.settings.tone).trigger('change');
      }
      if (draft.settings?.temp) {
        $('#useTempAdjust').prop('checked', true).trigger('change');
        $('#temperatureSlider').val(draft.settings.temp).trigger('input');
      }

      /* ►► Media */
      draft.media.cards.forEach(id => $('#' + id).addClass('selected'));
      $('#sourceHidden').val(draft.media.mode);

      /* ►► Schedule */
      $('#scheduleDate').val(draft.schedule.start);
      $('#scheduleDate').on('dp.change change input', refreshSummary);
      $('#frequencySelect').val(draft.schedule.freq).trigger('change');
      $('#frequencyValue').val(draft.schedule.gap);

      /* Sync side-panel + dynamic areas (varsa) */
      if (typeof refreshSummary  === 'function') refreshSummary();
      if (typeof evalAutoFields === 'function') evalAutoFields();
    }
  } catch (err) {
    console.warn('[Autosave] Taslak okunamadı →', err);
  } finally {
    isRestoring = false;
  }

  /*  Clean draft on hard-refresh / tab close  */
  window.addEventListener('unload', () => {
    localStorage.removeItem(KEY);
    $('#campaignName').val('');   // input’u da sıfırla
  });

}); /* /$(function) */
