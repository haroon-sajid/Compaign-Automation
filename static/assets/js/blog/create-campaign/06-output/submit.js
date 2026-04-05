/* Publisha → n8n "Publish" submit (preflight-free, Option B) */
(function ($) {
  'use strict';

  // A variable to hold the redirect URL, accessible by different functions.
  let successRedirectUrl = null;

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

  // ======= SETTINGS =======
  const TIMEOUT_MS = 40000; // 40s

  // ======= MINI TOAST (fallback if toastr is missing) =======
  function notify(type, msg) {
    if (window.toastr && typeof window.toastr[type] === 'function') {
      window.toastr[type](msg);
      return;
    }
    const box = document.createElement('div');
    box.textContent = msg;
    box.style.cssText =
      'position:fixed;right:16px;top:16px;z-index:99999;padding:10px 14px;border-radius:10px;' +
      'color:#fff;font:14px/1.35 Inter,system-ui,Segoe UI,Arial;background:' +
      (type === 'success' ? '#5b35f2' : '#d9534f') + ';box-shadow:0 6px 18px rgba(0,0,0,.18)';
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 4000);
  }

  // ======= HELPERS =======
  const $el = (id) => document.getElementById(id);

  function slugify(str) {
    const s = String(str || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase();
    return s || ('cmp-' + Date.now());
  }

  // ======= KEYWORDS =======
  function getKeywords() {
    if (Array.isArray(window.kwData) && window.kwData.length) {
      return window.kwData.map(r => r.kw).filter(Boolean);
    }
    const t = $el('keywordsBulkInput');
    const raw = t ? (t.value || '') : '';
    return raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  }

  // ======= BUILD PAYLOAD =======
  function buildPayload(status) {
    let coverImg = {};
    let contentImgs = {};

    try {
      const rawData = localStorage.getItem('imgMap::path:/campaigns/create/');
      if (rawData) {
        const parsedData = JSON.parse(rawData);
        coverImg = Object.entries(parsedData.cover || {}).map(([key, url]) => ({ keyword: key, url }));
        contentImgs = Object.entries(parsedData.content || {}).map(([key, urls]) => ({ keyword: key, urls }));
      }
    } catch (err) {
      console.error("[buildPayload] Failed to parse media:", err);
    }

    const nameRaw = ($el('campaignName')?.value || '').trim();
    const cmpId = slugify(nameRaw);
    let tagsPayload = null;
    if (window.tagConfig) {
      const mode = window.tagConfig.mode;
      if (mode === 'auto') {
        tagsPayload = { mode: 'auto', count: window.tagConfig.count || 0 };
      } else if (mode === 'manual') {
        tagsPayload = {
          mode: 'manual',
          manual: window.tagConfig.manualList || [],
          include: window.tagConfig.include || '',
          global: window.tagConfig.globalTags || [],
        };
      }
    }

    return {
      campaign: {
        id: cmpId,
        name: nameRaw,
        type: 'BLOG',
        status: "QUEUED",
        post_creation_status: status || 'QUEUED'
      },
      prompt: {
        name: $el('templateName')?.value || '',
        templateId: $el('templateDropdown')?.value || null,
        system: $el('systemPromptText')?.value || '',
        user: $el('userPromptText')?.value || '',
      },
      keywords: getKeywords(),
      settings: {
        wordCount: +($el('wordCount')?.value || 0),
        tone: $el('toneHidden')?.value || '',
        temperature: parseFloat($el('temperatureHidden')?.value || '1'),
        tags: tagsPayload,
        category: $el('category-selector')?.value || '',
        seoPlugin: $el('seoPluginSelect')?.value || '',
      },
      media: {
        mode: $el('sourceHidden')?.value || 'auto',
        selected: Array.from(document.querySelectorAll('#mediaCards .media-card.selected')).map(c => c.id),
        content: contentImgs,
        coverImg: coverImg,
      },
      schedule: {
        start: $el('scheduleDate')?.value || '',
        every: $el('frequencySelect')?.value || '',
        interval: $el('frequencyValue')?.value || '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        // Normalize randomness fields: avoid sending NaN -> JSON null.
        // Read elements safely and apply sensible defaults.
        randomnessPercent: (function(){
          const el = document.getElementById('randomnessPercent');
          const raw = el ? el.value : null;
          const n = parseInt(raw, 10);
          return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
        })(),
        randomnessLock: (function(){
          const el = document.getElementById('randomnessLock');
          return el && typeof el.value === 'string' ? el.value : 'no';
        })(),
        randomnessValue: (function(){
          const el = document.getElementById('randomnessPercent');
          const raw = el ? el.value : null;
          const n = parseInt(raw, 10);
          return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
        })()
      },
      client: {
        origin: location.origin,
        path: location.pathname,
        ts: new Date().toISOString(),
      },
    };
  }

  // ======= REUSABLE SUBMIT LOGIC =======
  async function handleFormSubmit(status, buttonElement) {
    if (buttonElement.dataset.busy === '1') return;

    const originalText = buttonElement.textContent;
    buttonElement.dataset.busy = '1';
    buttonElement.disabled = true;
    buttonElement.textContent = 'Saving...';

    const url = '/campaigns/create/';
    const payload = buildPayload(status);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let hasError = false;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const json = await res.json();

      if (!res.ok) {
        hasError = true;
        notify('error', json.error || `Request failed with status ${res.status}.`);
      } else {
        // --- SUCCESS ---

        // ✅ =================================================================
        // ✅ Disarm the "unsaved changes" prompt before we try to redirect.
        // ✅ =================================================================
        if (typeof window.isFormDirty !== 'undefined') {
          window.isFormDirty = false;
        }

        if (json.redirect_url) {
          successRedirectUrl = json.redirect_url;
          localStorage.removeItem('imgMap::path:/campaigns/create/');

          if (status === 'QUEUED') {
            $('#queueSuccessModal').modal('show');
          } else {
            notify('success', json.message || 'Draft saved successfully!');
            setTimeout(() => {
              window.onbeforeunload = null;
              window.location.href = successRedirectUrl;
            }, 1500);
          }
        }
      }
    } catch (err) {
      hasError = true;
      notify('error', 'A network error occurred. Please try again.');
    } finally {
      clearTimeout(timer);
      if (hasError) {
        buttonElement.dataset.busy = '0';
        buttonElement.disabled = false;
        buttonElement.textContent = originalText;
      }
    }
  }

  // ======= BIND EVENTS =======
  function bindSubmit() {
    const draftBtn = $el('saveDraftBtn');
    const queueBtn = $el('saveQueueBtn');

    if (!draftBtn || !queueBtn) return;

    draftBtn.addEventListener('click', function (e) {
      e.preventDefault();
      handleFormSubmit('DRAFT', this);
    });

    queueBtn.addEventListener('click', function (e) {
      e.preventDefault();
      handleFormSubmit('QUEUED', this);
    });

    $('#queueSuccessModal').on('hidden.bs.modal', function () {
      if (successRedirectUrl) {
        window.location.href = successRedirectUrl;
      }
    });
  }

  // Bind when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindSubmit);
  } else {
    bindSubmit();
  }

})(jQuery);