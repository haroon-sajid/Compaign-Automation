/* Publisha → n8n "Publish" submit (preflight-free, Option B) */
(function () {
  'use strict';
  function getCsrfToken() {
    return document.cookie.split('; ')
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1];
  }

  // ======= DEBUG FLAGS (check from console) =======
  window.__PUBLISHA_SUBMIT_LOADED = 'loading';
  window.__PUBLISHA_SUBMIT_BOUND = false;

  // ======= SETTINGS =======
  const N8N_DEFAULT_URL_TEST = 'https://musesymphony.app.n8n.cloud/webhook-test/publish';
  const N8N_DEFAULT_URL_PROD = 'https://musesymphony.app.n8n.cloud/webhook/publish';
  const USE_PROD = false;

  const N8N_URL = localStorage.getItem('N8N_WEBHOOK_URL') ||
    (USE_PROD ? N8N_DEFAULT_URL_PROD : N8N_DEFAULT_URL_TEST);
  const N8N_KEY = localStorage.getItem('N8N_WEBHOOK_KEY') || '';

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
  const $ = (id) => document.getElementById(id);

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
    const t = $('keywordsBulkInput');
    const raw = t ? (t.value || '') : '';
    return raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  }

  // ======= BUILD PAYLOAD =======
  function buildPayload() {
    const autoTags = Array.isArray(window.tagList) ? window.tagList : [];
    const manualTags = (window.tagConfig && Array.isArray(window.tagConfig.globalTags))
      ? window.tagConfig.globalTags : [];
    const allTags = [...new Set([...autoTags, ...manualTags].filter(Boolean))];

    const nameRaw = ($('campaignName')?.value || '').trim();
    const cmpId = slugify(nameRaw);

    return {
      campaign: {
        id: cmpId,               // helpful for UI & n8n normalization
        name: nameRaw
      },
      prompt: {
        templateId: $('templateDropdown')?.value || null,
        system: $('systemPromptText')?.value || '',
        user: $('userPromptText')?.value || '',
      },
      keywords: getKeywords(),
      settings: {
        wordCount: +($('wordCount')?.value || 0),
        tone: $('toneHidden')?.value || '',
        temperature: parseFloat($('temperatureHidden')?.value || '1'),
        tags: allTags,
        category: $('categorySelect')?.value || '',
        seoPlugin: $('seoPluginSelect')?.value || '',
      },
      media: {
        mode: $('sourceHidden')?.value || '',
        selected: Array.from(document.querySelectorAll('#mediaCards .media-card.selected')).map(c => c.id),
      },
      schedule: {
        start: $('scheduleDate')?.value || '',
        every: $('frequencySelect')?.value || '',
        interval: $('frequencyValue')?.value || '',
        // Defensive: ensure we never send NaN/null for randomness values.
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

  // ======= BIND SUBMIT + “.btn-next shield” (Option B) =======
  // function bindSubmit() {
  //   const form = $('campaignWizardForm');
  //   const btn = $('saveQueueBtn');
  //   if (!form || !btn) {
  //     console.warn('[submit] campaignWizardForm or saveQueueBtn not found.');
  //     return;
  //   }

  //   // Shield: intercept the wizard’s .btn-next click and trigger a real form submit
  //   btn.addEventListener('click', function (e) {
  //     if (!e.isTrusted) return; // ignore programmatic clicks
  //     e.preventDefault();
  //     e.stopPropagation();
  //     if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
  //     if (typeof form.requestSubmit === 'function') form.requestSubmit();
  //     else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  //   }, true); // capture so we run before other handlers

  //   // Real submit handler
  //   form.addEventListener('submit', async function (e) {
  //     e.preventDefault();
  //     if (btn.dataset.busy === '1') return;

  //     // Lock UI
  //     const originalText = btn.textContent;
  //     btn.dataset.busy = '1';
  //     btn.disabled = true;
  //     btn.classList.add('disabled');
  //     btn.textContent = originalText + ' ⌛';

  //     // URL (+ optional key)
  //     const url = N8N_KEY ? `${N8N_URL}?key=${encodeURIComponent(N8N_KEY)}` : N8N_URL;

  //     // Payload → x-www-form-urlencoded
  //     const payload = buildPayload();
  //     const body = 'payload=' + encodeURIComponent(JSON.stringify(payload));
  //     console.log(' payload', payload);
  //     // Timeout
  //     const controller = new AbortController();
  //     const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  //     try {
  //       console.log('[n8n publish] POST', url, payload);
  //       const res = await fetch(url, {
  //         method: 'POST',
  //         headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
  //         body,
  //         mode: 'cors',
  //         credentials: 'omit',
  //         cache: 'no-store',
  //         referrerPolicy: 'no-referrer',
  //         signal: controller.signal,
  //       });

  //       const text = await res.text().catch(() => '');
  //       let json; try { json = text ? JSON.parse(text) : null; } catch { json = null; }

  //       if (!res.ok) {
  //         console.error('[n8n publish] HTTP', res.status, json || text);
  //         notify('error', `Queue failed (${res.status}). Open DevTools → Network to inspect the response.`);
  //         return;
  //       }

  //       console.log('[n8n publish] OK', json || text);
  //       notify('success', 'Queued successfully. Track progress in n8n → Executions.');

  //       // ➜ Hand-off for “All Campaigns”: announce the new campaign as Pending
  //       localStorage.setItem('publisha_recent_campaign', JSON.stringify({
  //         id: payload.campaign?.id || undefined,
  //         name: payload.campaign?.name || '',
  //         status: 'pending',
  //         keywords: payload.keywords || [],
  //         schedule: { firstPublishAt: payload.schedule?.start || '' },
  //         createdAt: new Date().toISOString(),
  //         owner: (window.currentUser && window.currentUser.name) || 'You'
  //       }));

  //       try { localStorage.removeItem('campaignDraftV2'); } catch (_) { }

  //     } catch (err) {
  //       console.error('[n8n publish] network error', err);
  //       notify('error', 'Network error while queuing.');
  //     } finally {
  //       clearTimeout(timer);
  //       btn.dataset.busy = '0';
  //       btn.disabled = false;
  //       btn.classList.remove('disabled');
  //       btn.textContent = originalText;
  //     }
  //   });
  //   console.log('[llll] handler bound to campaignWizardForm');
  //   window.__PUBLISHA_SUBMIT_BOUND = true;
  //   console.log('[submit] handler bound');
  // }
  function bindSubmit() {
    const form = $('campaignWizardForm');
    const btn = $('saveQueueBtn');
    if (!form || !btn) {
      console.warn('[submit] campaignWizardForm or saveQueueBtn not found.');
      return;
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (btn.dataset.busy === '1') return;

      const originalText = btn.innerHTML; // Use innerHTML to preserve icon
      btn.dataset.busy = '1';
      btn.disabled = true;
      btn.classList.add('disabled');
      btn.innerHTML = originalText.replace('Save &amp; Queue', 'Saving...');

      const payload = buildPayload();
      console.log('Sending payload to Django:', payload);

      try {
        // --- CHANGED: Fetch call now targets our Django view ---
        const response = await fetch(form.action, { // Use the form's action URL
          method: 'POST',
          headers: {
            'Content-Type': 'application/json', // Set content type to JSON
            'X-CSRFToken': getCsrfToken(),      // Add the CSRF token header
          },
          body: JSON.stringify(payload), // Send the payload as a JSON string
        });

        if (!response.ok) {
          // Try to get error message from backend
          const errorData = await response.json().catch(() => ({ 'error': 'An unknown error occurred.' }));
          console.error('[Django Submit] HTTP Error:', response.status, errorData);
          notify('error', `Save failed (${response.status}): ${errorData.detail || errorData.error}`);
          return;
        }

        // --- SUCCESS ---
        const result = await response.json();
        console.log('[Django Submit] OK', result);
        notify('success', result.message || 'Campaign queued successfully!');

        // Redirect on success
        if (result.redirect_url) {
          window.location.href = result.redirect_url;
        }

      } catch (err) {
        console.error('[Django Submit] Network error:', err);
        notify('error', 'A network error occurred while saving.');
      } finally {
        btn.dataset.busy = '0';
        btn.disabled = false;
        btn.classList.remove('disabled');
        btn.innerHTML = originalText;
      }
    });

    console.log('[submit] JSON handler bound to campaignWizardForm');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindSubmit);
  } else {
    bindSubmit();
  }


  // Bind when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindSubmit);
  } else {
    bindSubmit();
  }

  window.__PUBLISHA_SUBMIT_LOADED = 'ready';
})();
