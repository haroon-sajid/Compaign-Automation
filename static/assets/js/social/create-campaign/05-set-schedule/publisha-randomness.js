/*
  FILE / MODULE NAME
  ------------------
  Suggested filename: publisha-randomness.js

  WHAT THIS MODULE DOES
  ---------------------
  1) Enforces the business rules for the pair:
        - Randomness (%)  <input type="number" id="randomnessPercent">
        - Lock Exact Time? <select id="randomnessLock">
             "no"  => Allow randomness (1..100, user-editable)
             "yes" => Keep exact time (forces 0, not editable)
     While typing, users can clear with Backspace; invalid chars are blocked.
     On blur, values are normalized to 1..100 (or default 20 if left empty).

  2) Optionally injects the purple “Heads-up” info callout under the controls.

  HOW TO INTEGRATE INTO ANY HTML
  ------------------------------
  A) Add these two elements somewhere in your form (ids MUST match or pass custom selectors via options):
        <input  id="randomnessPercent" type="number" value="20">
        <select id="randomnessLock">
          <option value="no" selected>Allow randomness</option>
          <option value="yes">Keep exact time</option>
        </select>

  B) Include the script after the elements exist in the DOM:
        <script src="/js/publisha-randomness.js"></script>

  C) Initialize (either rely on auto-init below, or call manually):
        initRandomnessControls({
          // Optional. Where to insert the callout (CSS selector of a node).
          calloutTarget: '#randomnessPercent',   // inserts right after this node
          injectCallout: true                    // set false to skip adding the callout
        });

  D) Provide (or reuse) these minimal styles somewhere in your CSS (the module will add a sane default if missing):
        .is-disabled{background:#f1f1f5!important;color:#8a8896!important;cursor:not-allowed!important}
        .schedule-callout{background:#fff;border:1px solid rgba(90,49,255,.25);border-left:4px solid #5a31ff;border-radius:8px;padding:12px 14px;
          font:13px/1.5 Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2c2a3f;box-shadow:0 8px 16px rgba(0,0,0,.06);margin-top:12px}
        .schedule-callout .schedule-callout-icon{color:#5a31ff;font-size:16px;margin-right:8px}
        .schedule-callout .inline-code{background:#f6f5ff;border:1px solid rgba(90,49,255,.25);border-radius:4px;padding:0 4px}

*/

(function () {
  function qs(sel, root) { return (root || document).querySelector(sel); }

  function ensureBaseStyles() {
    if (document.getElementById('publisha-randomness-base-styles')) return;
    var css = `
.is-disabled{background:#f1f1f5!important;color:#8a8896!important;cursor:not-allowed!important}
.schedule-callout{background:#fff;border:1px solid rgba(90,49,255,.25);border-left:4px solid #5a31ff;border-radius:8px;padding:12px 14px;
  font:13px/1.5 Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2c2a3f;box-shadow:0 8px 16px rgba(0,0,0,.06);margin-top:12px}
.schedule-callout .callout-body{display:flex;align-items:flex-start;gap:8px}
.schedule-callout .schedule-callout-icon{color:#5a31ff;font-size:16px;line-height:1.2}
.schedule-callout .inline-code{background:#f6f5ff;border:1px solid rgba(90,49,255,.25);border-radius:4px;padding:0 4px}
    `.trim();
    var style = document.createElement('style');
    style.id = 'publisha-randomness-base-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function buildCalloutNode() {
    var div = document.createElement('div');
    div.className = 'schedule-callout';
    div.innerHTML = `
      <div class="callout-body">
        <div class="schedule-callout-icon">i</div>
        <div>
          <strong>Heads-up:</strong> If search indexing is <em>disabled</em> for this project
          (e.g. <span class="inline-code">meta robots="noindex"</span> or
          <span class="inline-code">robots.txt</span> <span class="inline-code">Disallow</span>),
          your posting cadence won’t affect search engines. Once indexing is enabled, avoid spam-like patterns:
          keep intervals <strong>≥ 60 minutes</strong> (typical: <strong>6–24 hours</strong>), use
          <strong>Randomness</strong> to add ±15–30% jitter, and maintain a steady cadence instead of bursts.
          Check impact in <em>Search Console → Crawl stats</em>.
        </div>
      </div>
    `;
    return div;
  }

  function attachCallout(targetEl) {
    if (!targetEl) return;
    // avoid duplicates if init is called multiple times
    var next = targetEl.nextElementSibling;
    if (next && next.classList && next.classList.contains('schedule-callout')) return;
    targetEl.insertAdjacentElement('afterend', buildCalloutNode());
  }

  function initRandomnessControls(options) {
    options = options || {};
    ensureBaseStyles();

    var randInput = options.randomnessSelector
      ? qs(options.randomnessSelector)
      : document.getElementById('randomnessPercent');

    var randLock = options.lockSelector
      ? qs(options.lockSelector)
      : document.getElementById('randomnessLock');

    if (!randInput || !randLock) {
      console.warn('[RandomnessControls] Missing #randomnessPercent or #randomnessLock');
      return;
    }

    // Optionally inject callout (default: true if a target is found)
    var shouldInject = options.injectCallout !== false;
    var calloutTarget = options.calloutTarget ? qs(options.calloutTarget) : randInput;
    if (shouldInject && calloutTarget) attachCallout(calloutTarget);

    function setLockedState(isLocked) {
      if (isLocked) {
        randInput.value = 0;
        randInput.min = 0;                  // min irrelevant while disabled
        randInput.setAttribute('aria-disabled', 'true');
        randInput.classList.add('is-disabled');
        randInput.readOnly = true;
        randInput.disabled = true;
      } else {
        randInput.disabled = false;
        randInput.readOnly = false;
        randInput.removeAttribute('aria-disabled');
        randInput.classList.remove('is-disabled');
        randInput.min = 1;

        // keep empty if user cleared; otherwise coerce to >=1
        var v = parseInt(randInput.value, 10);
        if (!isNaN(v) && v < 1) randInput.value = 1;
      }
    }

    function handleLockChange() {
      var lockVal = randLock.value; // "no" or "yes"
      setLockedState(lockVal === 'yes');
    }

    // Allow clearing with Backspace; strip non-digits while typing
    function handleRandomnessInput() {
      if (randInput.disabled) return;
      var cleaned = randInput.value.replace(/[^0-9]/g, '');
      if (cleaned === '') {
        randInput.value = '';
        return;
      }
      randInput.value = cleaned;
    }

    // Normalize on blur: default 20 if empty, clamp 1..100, remove leading zeros
    function handleRandomnessBlur() {
      if (randInput.disabled) return;
      var v = parseInt(randInput.value, 10);
      if (isNaN(v)) { randInput.value = 20; return; }
      if (v < 1) { randInput.value = 1; return; }
      if (v > 100) { randInput.value = 100; return; }
      randInput.value = String(v);
    }

    // Block "-", "+", "e", "E", "."
    function handleRandomnessKeyDown(e) {
      if (randInput.disabled) return;
      var disallowed = ['e', 'E', '+', '-', '.'];
      if (disallowed.includes(e.key)) e.preventDefault();
    }

    randLock.addEventListener('change', handleLockChange);
    randInput.addEventListener('keydown', handleRandomnessKeyDown);
    randInput.addEventListener('input', handleRandomnessInput);
    randInput.addEventListener('blur', handleRandomnessBlur);

    // initial sync
    handleLockChange();
  }

  // Expose to global scope
  window.initRandomnessControls = initRandomnessControls;

  // Auto-init if elements are already in DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      // Default behavior: try to init with callout under #randomnessPercent
      initRandomnessControls({ injectCallout: true, calloutTarget: '#randomnessPercent' });
    });
  } else {
    initRandomnessControls({ injectCallout: true, calloutTarget: '#randomnessPercent' });
  }
})();
