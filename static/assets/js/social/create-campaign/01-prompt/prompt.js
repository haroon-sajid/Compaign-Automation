/* ===================================================================
 *  create-campaign.prompt.js            (2025-08-05  stable r10)
 *  Prompt templates workflow – NO-modal
 * =================================================================== */
(function ($) {
  /* ───── 0) GLOBALS & HELPERS ─────────────────────────────────────── */
  const MOD = 'debug', log = (...a) => MOD === 'debug' && console.log('[PROMPT]', ...a);
  const DRAFT_KEY = 'campaignDraftV2';
  const debounce = (fn, ms = 250) => {
    let t; return Object.assign(
      (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); },
      { flush: () => { clearTimeout(t); fn(); } }
    );
  };


  function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.substring(0, name.length + 1) === (name + '=')) {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }
  const csrftoken = getCookie('csrftoken');

  /* ───── 1) DATA SOURCE ───────────────────────────────────────────── */
  // const SEED = [
  //   {
  //     id: 1, name: 'Blog Draft', system: 'You are an expert SEO writer…',
  //     user: 'Write a detailed blog draft on “{topic}”…', last: '24.04.24 11:00'
  //   },
  //   {
  //     id: 2, name: 'Tweet Flood', system: 'You are a social-media strategist…',
  //     user: 'Create a 5–7 tweet thread about “{topic}”…', last: '18.04.24 09:30'
  //   },
  //   {
  //     id: 3, name: 'LinkedIn Post', system: 'You are a professional B2B copywriter…',
  //     user: 'Draft a LinkedIn post (max 300 words)…', last: '03.04.24 14:10'
  //   }
  // ];
  // window.promptTemplates = Array.isArray(window.promptTemplates) && window.promptTemplates.length
  //   ? window.promptTemplates : [...SEED];
  // const promptTemplates = window.promptTemplates;
  window.promptTemplates = Array.isArray(window.promptTemplates) ? window.promptTemplates : [];
  const promptTemplates = window.promptTemplates;

  /* ───── 2) DOM SHORTCUTS ─────────────────────────────────────────── */
  const $ddl = $('#templateDropdown');
  const $nm = $('#templateName');
  const $sys = $('#systemPromptText');
  const $usr = $('#userPromptText');
  const $btn = $('#manageTemplatesBtn');
  const $cardN = $('#cardNew');
  const $cardE = $('#cardExisting');
  const $wrapN = $('#newControls');
  const $wrapE = $('#existingControls');
  const $link = $('#toggleSystemPrompt');
  const $gSys = $('#systemPromptGroup');
  const $back = $('#step1BackBtn');

  /* ───── 3) STYLE PATCH – mor Show/Hide link’i kalıcı ────────────── */
  if (!$('#prompt-sys-style').length) {
    $('<style id="prompt-sys-style">\
#toggleSystemPrompt,#toggleSystemPrompt:visited{color:#7c4dff;font-weight:600;cursor:pointer;transition:filter .15s;}\
#toggleSystemPrompt:hover{filter:brightness(1.25);}\
</style>').appendTo('head');
  }

  /* ───── 4) DROPDOWN HELPERS ─────────────────────────────────────── */
  function fillDDL(sel = '') {
    $ddl.empty().append('<option value="">Select template…</option>');
    promptTemplates.forEach(t => $ddl.append(
      `<option value="${t.id}" ${t.id == sel ? 'selected' : ''}>${t.name}</option>`));
  }

  /* ───── 5) DATATABLE SYNC (her zaman ilk satır) ─────────────────── */
  let ptTable = null, queueTbl = false;
  const rowObj = t => ({ id: t.id, name: t.name, sys: t.system || '—', usr: t.user, last: t.last });
  function refreshTable() {
    if (!ptTable) { queueTbl = true; return; }
    ptTable.clear().rows.add(promptTemplates.map(rowObj)).draw(false);
    ptTable.columns.adjust().draw(false);
    if (window.ptRenumber) window.ptRenumber();
  }
  $(document).on('init.dt', (e, s) => {
    if (s.sTableId === 'ptTable') {
      ptTable = new $.fn.dataTable.Api(s);
      if (queueTbl) { refreshTable(); queueTbl = false; }
    }
  });

  /* ───── 6) MODE & VISIBILITY ────────────────────────────────────── */
  let draftId = null;
  function updateVis() {
    const show = $cardN.hasClass('selected') || !!$ddl.val();
    $link.closest('.form-group').toggle(show);
    $usr.closest('.form-group').toggle(show);
    if (!show) $gSys.collapse('hide');
  }
  function resetBtn() { $btn.html('<i class="entypo-plus"></i> New Prompt'); }
  function switchMode(mode) {                           // 'new' | 'existing'
    $cardN.toggleClass('selected', mode === 'new');
    $cardE.toggleClass('selected', mode === 'existing');
    $wrapN.toggle(mode === 'new'); $wrapE.toggle(mode === 'existing');

    if (mode === 'new') {
      $ddl.val('');
      $nm.val(''); $sys.val(''); $usr.val('');
      draftId = null; setTimeout(() => $nm.focus(), 60);
    }
    // else { $nm.val(''); }

    updateVis(); resetBtn();
    if (window.refreshSummary) refreshSummary();
  }

  /* ───── 7) PROMPT UPSERT (tek merkez) ───────────────────────────── */
  // function upsertPrompt() {
  //   if (!$cardN.hasClass('selected')) return;

  //   const name = $nm.val().trim();
  //   if (!name) return;             // boş isim → kayıt yok

  //   // Eşsiz isim koruması (kendi draft’ını hariç tut)
  //   const editingId = draftId || null;
  //   const conflict = promptTemplates.some(t =>
  //     t.name && t.name.trim().toLowerCase() === name.toLowerCase() &&
  //     (editingId ? t.id !== editingId : true)
  //   );
  //   if (conflict) return; // sessiz: uyarıyı saveNewTemplate verir

  //   const tpl = {
  //     id: draftId || Math.max(0, ...promptTemplates.map(t => t.id)) + 1,
  //     name,
  //     system: $sys.val(),
  //     user: $usr.val(),
  //     last: moment().format('DD.MM.YYYY, HH:mm')
  //   };
  //   if (!draftId) { promptTemplates.unshift(tpl); draftId = tpl.id; }
  //   else {
  //     const i = promptTemplates.findIndex(t => t.id === draftId);
  //     if (i > -1) promptTemplates[i] = tpl;
  //   }
  //   fillDDL(draftId); refreshTable();
  //   if (window.refreshSummary) refreshSummary();
  // }
  function upsertPrompt() {
    if (!$cardN.hasClass('selected')) return;

    const name = $nm.val().trim();
    if (!name) return; // A name is required to create or update a draft.

    const editingId = draftId || null;
    const conflict = promptTemplates.some(t =>
      t.name && t.name.trim().toLowerCase() === name.toLowerCase() &&
      (editingId ? t.id !== editingId : true)
    );
    if (conflict) return; // Name must be unique.

    const tpl = {
      // The only change is String(...) to ensure new IDs are strings.
      id: draftId || String(Math.max(0, ...promptTemplates.map(t => Number(t.id) || 0)) + 1),
      name,
      system: $sys.val(),
      user: $usr.val(),
      last: moment().format('DD.MM.YYYY, HH:mm')
    };
    if (!draftId) {
      // ---- THIS IS A NEW DRAFT ----
      // 1. Add it to the main data array.
      promptTemplates.unshift(tpl);
      draftId = tpl.id; // Set the ID so future updates will edit this draft.

      // 2. Do a full table refresh to show the new row at the top.
      refreshTable();
    } else {
      // ---- THIS IS AN UPDATE TO AN EXISTING DRAFT ----
      // 1. Update the main data array.
      const i = promptTemplates.findIndex(t => t.id === draftId);
      if (i > -1) promptTemplates[i] = tpl;

      // 2. Find the specific row in the DataTable and update it directly.
      //    This is more efficient and prevents the "multiple row" bug.
      if (ptTable) {
        ptTable.rows().every(function () {
          const rowData = this.data();
          if (rowData && rowData.id === draftId) {
            this.data(rowObj(tpl)).draw(false); // Update row data and redraw softly.
          }
        });
      }
    }

    // Always keep the dropdown and summary in sync.
    fillDDL(draftId);
    if (window.refreshSummary) refreshSummary();
  }

  /* realtime (debounced) */
  const syncLive = debounce(upsertPrompt, 140);

  /* ───── 7b) autoSaveExistingPrompt (debounced) ──────────────────── */
  const saveExisting = debounce(function () {
    if (!$cardE.hasClass('selected')) return;
    const tplId = $ddl.val();
    if (!tplId) return;

    // First, update the local JS array immediately for a responsive UI
    const tpl = promptTemplates.find(t => t.id == tplId);
    if (!tpl) return;
    tpl.system = $sys.val();
    tpl.user = $usr.val();
    // We don't update the date here, we let the backend do it.

    // Now, call our main save function to persist to the database
    savePromptToBackend(tplId);
  }, 800);


  /* ───── 7c) Prompt template helpers (public API) ────────────────── */
  /* Bu bölüm, HTML içindeki "Prompt template helpers" fonksiyonlarının
     taşınmış ve tek otorite olacak karşılığıdır. Diğer dosyalar buradaki
     public API’yi (window.*) kullanmalıdır. */
  function _removePromptFromUI(id) {
    const ix = promptTemplates.findIndex(t => t.id == id); // Use == for type coercion
    if (ix > -1) {
      promptTemplates.splice(ix, 1);

      // If the deleted template was selected, clear the fields
      if ($ddl.val() == String(id)) {
        $ddl.val('').trigger('change');
        $sys.val(''); $usr.val('');
        $nm.val('');
        $gSys.collapse('hide');

      }

      // Refresh Dropdown and DataTable
      fillDDL();
      refreshTable();
      if (window.refreshSummary) refreshSummary();

      // If no templates are left, switch to "New" mode
      if (!promptTemplates.length) switchMode('new');
    }
  }

  function removePromptTemplate(id) {
    if (!id) return;

    if (!confirm('Are you sure you want to delete this prompt template? This action cannot be undone.')) {
      return;
    }

    const urlTemplate = $('#promptTableBox').data('delete-url-template');
    if (!urlTemplate) {
      const msg = 'Configuration error: Delete URL not found.';
      console.error(msg);
      if (typeof toastr !== 'undefined') toastr.error(msg);
      return;
    }

    const deleteUrl = urlTemplate.replace('00000000-0000-0000-0000-000000000000', id);

    $.ajax({
      url: deleteUrl,
      type: 'POST',
      headers: { 'X-CSRFToken': csrftoken },
      success: function (response) {
        log('Template deleted on backend:', response);
        if (typeof toastr !== 'undefined') toastr.success(response.message || 'Template deleted successfully.');

        // On successful deletion, update the UI
        _removePromptFromUI(id);
      },
      error: function (xhr) {
        const errorMsg = (xhr.responseJSON && xhr.responseJSON.error) ? xhr.responseJSON.error : 'An error occurred while deleting the template.';
        log('Error deleting template:', errorMsg);
        if (typeof toastr !== 'undefined') toastr.error(errorMsg);
      }
    });
  }

  $('#promptTableBox').on('click', '.delete-prompt-btn', function () {
    const templateId = $(this).data('id');
    if (templateId) {
      removePromptTemplate(templateId); // Call the main delete function
    }
  });

  function updatePromptTemplate(id, newObj) {
    const tpl = promptTemplates.find(t => t.id === +id);
    if (!tpl) return;
    Object.assign(tpl, newObj);
    tpl.last = tpl.last || moment().format('DD.MM.YYYY, HH:mm');

    fillDDL(tpl.id);
    refreshTable();
    if (window.refreshSummary) refreshSummary();
  }

  /* Dışarıdan seçimle alanları doldurmak için küçük yardımcı */
  function loadPromptTemplate(id) {
    const tpl = promptTemplates.find(t => t.id == id);
    if (!tpl) return null;
    $sys.val(tpl.system || '');
    $usr.val(tpl.user || '');
    updateVis();
    if (window.refreshSummary) refreshSummary();
    return tpl;
  }

  /* prompt-table.js vb. yerlerden çağrılacak hafif köprü */
  function refreshPromptTableAndDDL(selectedId) {
    refreshTable();
    fillDDL(selectedId || $ddl.val());
  }

  /* —— Public exports (eski HTML kodlarının beklediği isimlerle) —— */
  window.removeTemplate = removePromptTemplate;
  window.updateTemplate = updatePromptTemplate;
  window.loadTemplate = loadPromptTemplate;
  window.refreshPtTable = refreshPromptTableAndDDL;
  window.populateTemplateDropdown = function (selectedId) { fillDDL(selectedId); };

  /* setMode kullanan eski HTML kodları için geriye dönük uyumluluk */
  window.switchMode = switchMode;
  window.setMode = function (mode) {
    switchMode(mode); // merkezi mod değiştirici

    // HTML'deki setMode’un yaptığı ek UI güncellemeleri:
    $('#nextStepBtn').text(
      mode === 'new' ? 'Save Template & Next' : 'Next → Keywords'
    );
    $('#step1BackBtn').toggleClass('is-hidden', mode !== 'new');

    if (typeof isDirty !== 'undefined') { try { isDirty = false; } catch (_) { } }
    if (window.refreshSummary) setTimeout(refreshSummary, 0);
  };

  /* dropdown seçimi – alanları doldur + grup görünür/gizli */
  $ddl.on('change', function () {
    const tpl = promptTemplates.find(t => t.id == this.value);
    if (tpl) {
      $sys.val(tpl.system || '');
      $usr.val(tpl.user || '');
      $gSys.collapse('show');
    } else {
      $sys.val(''); $usr.val('');
      $gSys.collapse('hide');
    }
    updateVis();
    if (window.refreshSummary) refreshSummary();
  });

  /* Eski HTML çağrıları için minik yardımcılar */
  window.updateExistingSectionVisibility = function () {
    if (!promptTemplates.length) window.setMode('new');
  };

  /* Eski saveNewTemplate çağrılarını karşılayan sargı – güvenli akış */
  window.saveNewTemplate = function () {
    // Existing modda bu fonksiyon doğrulama yapmamalı (eski akışlar için no-op)
    if (!$cardN.hasClass('selected')) return true;

    const name = $nm.val().trim(); // #templateName
    if (!name) { alert('Template Name is required.'); return false; }

    // Kendi draft’ını hariç tutarak benzersizlik kontrolü
    const editingId = draftId || null;
    const clash = promptTemplates.some(t =>
      t.name && t.name.trim().toLowerCase() === name.toLowerCase() &&
      (editingId ? t.id !== editingId : true)
    );
    if (clash) {
      alert('Template name must be unique.');
      return false;
    }

    // Kaydet (draftId üretimi ve listeye ekleme burada)
    upsertPrompt();

    // Existing moda dön ve yeni/updated kaydı seç
    switchMode('existing');
    if (draftId) { $ddl.val(draftId).trigger('change'); }

    window.updateExistingSectionVisibility();
    return true;
  };


  /* ───── 8) EVENTS ───────────────────────────────────────────────── */
  /* kartlar */
  $cardN.on('click', () => switchMode('new'));
  $cardE.on('click', () => switchMode('existing'));

  /* New Prompt / geri tuşu */
  $btn.on('click', () => {
    if ($cardN.hasClass('selected')) {
      switchMode('existing');
      if (draftId) $ddl.val(draftId).trigger('change');
    } else switchMode('new');
  });
  $back.off().on('click', () => switchMode('existing'));

  /* inputlar → canlı sync & existing save */
  $nm.add($sys).add($usr).on('input', syncLive);

  // Keep the keydown event for the name input to prevent 'Enter' from submitting the form.
  $nm.on('keydown', e => { if (e.target === $nm[0] && e.key === 'Enter') e.preventDefault(); });

  // This line, which saves an EXISTING prompt, is correct and should remain.
  $sys.add($usr).on('input', saveExisting);   // Existing için otomatik kayıt

  function savePromptToBackend(templateIdToSave) {
    const id = templateIdToSave || ($cardN.hasClass('selected') ? draftId : $ddl.val());
    if (!id) {
      // log('No template ID found to save.');
      return;
    }

    const template = promptTemplates.find(t => t.id == id);
    if (!template) {
      log('Could not find template in memory to save with ID:', id);
      return;
    }

    // A simple check: if the ID is a long string, it's a UUID and already exists.
    const isExistingRecord = String(id).length > 5;

    const urlTemplate = $('#promptTableBox').data('update-url-template');
    const saveUrl = $('#promptTableBox').data('save-url');
    const updateUrl = isExistingRecord ? urlTemplate.replace('00000000-0000-0000-0000-000000000000', id) : null;

    const finalUrl = isExistingRecord ? updateUrl : saveUrl;

    if (!finalUrl) {
      log('Save/Update URL not found.');
      return;
    }

    const payload = {
      name: template.name,
      system_prompt: template.system,
      user_prompt: template.user,
      campaign_type: 'SOCIAL'
    };

    log(`Saving template to backend... IS_EXISTING=${isExistingRecord}`, `URL=${finalUrl}`, payload);

    // Return the $.ajax promise so other functions can know when it's done
    return $.ajax({
      url: finalUrl,
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(payload),
      headers: { 'X-CSRFToken': csrftoken },
      success: function (response) {
        log('Template saved successfully!', response);
        const newTemplateData = response.template;
        const oldId = id;

        const index = promptTemplates.findIndex(t => t.id == oldId);
        if (index > -1) {
          promptTemplates[index] = newTemplateData;
          if (!isExistingRecord) {
            draftId = newTemplateData.id;
          }
        }

        fillDDL(newTemplateData.id);
        refreshTable();
      },
      error: function (xhr) {
        const errorMsg = (xhr.responseJSON && xhr.responseJSON.error) ? xhr.responseJSON.error : 'An unknown error occurred.';
        log('Error saving template:', errorMsg);
        if (typeof toastr !== 'undefined') toastr.error(errorMsg);
        else alert('Error: ' + errorMsg);
      }
    });
  }

  /* -----  wizard adımı değişirken: kayıt + moda geçiş  ----- */
  function ensurePersistThenSwitch() {
    // Flush any pending debounced input to ensure data is current
    syncLive.flush();
    saveExisting.flush();

    if ($cardN.hasClass('selected')) {
      if (!window.saveNewTemplate()) {
        return; // Stop if client-side validation fails
      }
    }

    // Call the main save function. It will handle both new and existing prompts.
    const savePromise = savePromptToBackend();

    // We only switch UI modes after the save is confirmed successful
    if (savePromise) {
      savePromise.done(function () {
        setTimeout(() => {
          if ($('.wizard-step.active').data('step') !== 1 && draftId) {
            if ($cardN.hasClass('selected')) {
              switchMode('existing');
              $ddl.val(draftId).trigger('change');
            }
          }
        }, 60);
      });
    } else {
      // If there was nothing to save, just switch the UI (e.g., from existing mode with no changes)
      setTimeout(() => {
        if ($('.wizard-step.active').data('step') !== 1 && $cardN.hasClass('selected') && draftId) {
          switchMode('existing');
          $ddl.val(draftId).trigger('change');
        }
      }, 60);
    }
  }
  $(document).on('click', '.next-step,.prev-step,#wizardSteps li', ensurePersistThenSwitch);

  /* Show / Hide link metnini güncelle */
  $gSys.on('show.bs.collapse', () => { $link.text('Hide System Prompt ✖'); })
    .on('hide.bs.collapse', () => { $link.text('Show System Prompt ✚'); });

  /* ───── 9) AUTOSAVE (LocalStorage) ─────────────────────────────── */
  const saveDraft = debounce(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      name: $('#campaignName').val(),
      prompt: {
        templateId: $ddl.val(),
        isNew: $cardN.hasClass('selected'),
        template: { name: $cardN.hasClass('selected') ? $nm.val() : '', sys: $sys.val(), user: $usr.val() }
      }
    }));
  }, 600);
  $(document).on('input change',
    '#campaignName,#templateName,#systemPromptText,#userPromptText,#templateDropdown', saveDraft);

  /* ───── 10) SUMMARY LINK ───────────────────────────────────────── */
  if (typeof window.refreshSummary === 'function') {
    $('#campaignName,#systemPromptText,#userPromptText')
      .on('input', window.refreshSummary);
  }

  /* ───── 11) INIT ───────────────────────────────────────────────── */
  //   $(function () {
  //     fillDDL(); switchMode('existing');
  //   });
  // })(jQuery);
  $(function () {
    // Get the URL from the data attribute we added to the HTML
    const listUrl = $('#promptTableBox').data('list-url');

    if (!listUrl) {
      console.error('Prompt list URL is not defined. Check data-list-url attribute.');
      // Fallback to empty state
      fillDDL();
      switchMode('existing');
      return;
    }

    $.ajax({
      url: listUrl,
      type: 'GET',
      dataType: 'json',
      success: function (data) {
        log('Successfully loaded', data.length, 'prompt templates via AJAX.');
        // Clear any existing templates and push the new ones from the server
        window.promptTemplates.length = 0;
        window.promptTemplates.push(...data);

        // Now that the data is loaded, initialize the UI
        fillDDL();
        switchMode('existing');
        refreshTable(); // Refresh the datatable with the new data
      },
      error: function (xhr, status, error) {
        console.error("Failed to load prompt templates:", status, error);
        // Initialize with empty state on failure
        fillDDL();
        switchMode('existing');
      }
    });
  });

})(jQuery);