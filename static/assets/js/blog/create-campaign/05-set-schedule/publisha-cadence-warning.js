/*
  FILE / MODULE NAME
  ------------------
  Suggested filename: publisha-cadence-warning.js

  WHAT THIS MODULE DOES
  ---------------------
  - Watches "Frequency (Triggers)" and "Minutes Between Triggers" inputs.
  - If the campaign is set to post more frequently than every 12 hours,
    it shows a warning modal.

  WHEN DO WE WARN?
  ----------------
  We warn if ALL are true:
    1. frequencySelect is "minutes" or "hours"
    2. frequencyValue is a positive number
    3. effective interval < 12 hours

    - If unit == "minutes", we convert minutes -> hours and compare < 12
    - If unit == "hours", we compare the number directly < 12
    - For "days", "weeks", "months" we never warn.

  EXPECTED HTML STRUCTURE
  -----------------------
  You MUST have these elements in your HTML (ids must match unless you override via options):

    <!-- interval value -->
    <input type="number" id="frequencyValue" min="1" class="form-control-lg" placeholder="Enter time interval...">

    <!-- unit select -->
    <select id="frequencySelect" class="form-control-lg">
      <option value="minutes">Minutes</option>
      <option value="hours">Hours</option>
      <option value="days">Days</option>
      <option value="weeks">Weeks</option>
      <option value="months">Months</option>
    </select>

    <!-- modal -->
    <div class="modal-overlay" id="cadenceModal" role="alertdialog" aria-modal="true"
         aria-labelledby="cadenceModalTitle" aria-describedby="cadenceModalDesc"
         style="display:none">
      <div class="modal-card">
        <div class="modal-head">
          <div class="modal-icon"><i class="entypo-attention"></i></div>
          <div class="modal-title-block">
            <h2 class="modal-title" id="cadenceModalTitle">High-frequency posting warning</h2>
            <div class="modal-desc" id="cadenceModalDesc">
              You're scheduling posts more often than every 12 hours. This pattern can look unnatural for smaller blogs.
            </div>
          </div>
        </div>
        <div class="modal-body">
          <ul>
            <li><strong>Small / new blogs:</strong> ~1 post every 24–48h looks like healthy growth.</li>
            <li><strong>Mid-size sites:</strong> ~1 post every 6–12h can be OK if quality stays high.</li>
            <li><strong>News / large content sites:</strong> 1 post every 1–2h is normal.</li>
          </ul>
          <p style="margin-top:12px;">
            If you're not a high-volume news site, consider slowing down a bit so it feels organic and sustainable.
          </p>
        </div>
        <div class="modal-footer">
          <button type="button" class="modal-close-btn" id="cadenceModalClose">Got it</button>
        </div>
      </div>
    </div>

  You also need the modal styles from the page:
    .modal-overlay { ... }
    .modal-card { ... }
    .modal-close-btn { ... }
  (Same CSS we already defined in the full page mock. Just reuse it in your stylesheet.)

  HOW TO INITIALIZE
  -----------------
  Option 1 (recommended): Include this script at the bottom of <body> after the HTML,
  and it will auto-init.

  Option 2: If you bundle this file elsewhere, call:
      initCadenceWarning({
        frequencyValueSelector: '#frequencyValue',
        frequencyUnitSelector:  '#frequencySelect',
        modalSelector:          '#cadenceModal',
        modalCloseSelector:     '#cadenceModalClose'
      });

  NOTE
  ----
  We trigger the warning:
   - when user changes the unit select
   - when user finishes editing the number (on blur)
*/

(function () {
  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function initCadenceWarning(options) {
    options = options || {};

    // get DOM refs (allow override via options)
    var freqValueEl = qs(options.frequencyValueSelector || '#frequencyValue');
    var freqSelectEl = qs(options.frequencyUnitSelector || '#frequencySelect');
    var modalEl = qs(options.modalSelector || '#cadenceModal');
    var modalCloseEl = qs(options.modalCloseSelector || '#cadenceModalClose');

    if (!freqValueEl || !freqSelectEl || !modalEl) {
      console.warn('[CadenceWarning] Missing required elements.');
      return;
    }

    // open/close helpers
    function openModal() {
      modalEl.style.display = 'flex';
      if (modalCloseEl && modalCloseEl.focus) {
        modalCloseEl.focus();
      }
    }

    function closeModal() {
      modalEl.style.display = 'none';
    }

    if (modalCloseEl) {
      modalCloseEl.addEventListener('click', closeModal);
    }

    // click on overlay (outside card) also closes
    modalEl.addEventListener('click', function (e) {
      if (e.target === modalEl) {
        closeModal();
      }
    });

    // core check logic
    function checkCadenceAndWarn() {
      var unit = freqSelectEl.value; // "minutes" | "hours" | "days" | ...
      var rawVal = parseFloat(freqValueEl.value);

      if (isNaN(rawVal) || rawVal <= 0) {
        return; // nothing to evaluate yet
      }

      var hoursBetweenRuns;

      if (unit === 'minutes') {
        hoursBetweenRuns = rawVal / 60;
      } else if (unit === 'hours') {
        hoursBetweenRuns = rawVal;
      } else {
        // days / weeks / months won't trigger this warning
        return;
      }

      // show warning if < 12h cadence
      if (hoursBetweenRuns < 12) {
        openModal();
      }
    }

    // attach listeners
    freqSelectEl.addEventListener('change', checkCadenceAndWarn);
    freqValueEl.addEventListener('blur', checkCadenceAndWarn);

    // expose manual trigger if needed
    return {
      triggerCheck: checkCadenceAndWarn,
      closeModal: closeModal,
      openModal: openModal
    };
  }

  // auto-init on load if DOM is ready now
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      window.cadenceWarningController = initCadenceWarning();
    });
  } else {
    window.cadenceWarningController = initCadenceWarning();
  }

  // also export init for manual usage in SPA-style flows
  window.initCadenceWarning = initCadenceWarning;
})();
