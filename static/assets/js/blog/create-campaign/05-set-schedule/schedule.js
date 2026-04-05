// === schedule.js — flatpickr + End Condition (2025-08-05) ===
document.addEventListener('DOMContentLoaded', function () {
  var $ = window.jQuery || function(s){return document.querySelector(s);};

  // ----- Flatpickr init for First Publish -----
  var input = document.getElementById('scheduleDate');
  var fp = null;

  if (input) {
    // TR locale (varsa)
    if (window.flatpickr && window.flatpickr.l10ns && window.flatpickr.l10ns.tr) {
      flatpickr.localize(flatpickr.l10ns.tr);
    }

    fp = flatpickr('#scheduleDate', {
      enableTime      : true,
      time_24hr       : true,
      dateFormat      : 'Y-m-d H:i',
      altInput        : true,
      altFormat       : 'd.m.Y H:i',
      altInputClass   : 'form-control form-control-lg',
      minuteIncrement : 5,
      allowInput      : true,
      disableMobile   : false,
      defaultDate     : input.value && input.value.trim() ? input.value : null,
      onChange        : updateScheduleSummary,
      onReady         : updateScheduleSummary
    });
  }

  // ----- End Condition controls -----
  var endSel   = document.getElementById('endConditionSelect');
  var endWrap  = document.getElementById('endConditionWrap');
  var endLabel = document.getElementById('endConditionLabel');
  var endInput = document.getElementById('endConditionValue');

  // flatpickr instance for "until date"
  var fpUntil = null;

  function configureEndConditionUI() {
    if (!endSel) return;
    var v = endSel.value;

    if (v === 'never') {
      endWrap.style.display = 'none';
      destroyUntilPicker();
      endInput.value = '';
    } else if (v === 'after') {
      endWrap.style.display = '';
      endLabel.textContent = 'N runs';
      endInput.type = 'number';
      endInput.min  = '1';
      endInput.placeholder = 'Enter N (e.g., 10)';
      destroyUntilPicker();
    } else if (v === 'until') {
      endWrap.style.display = '';
      endLabel.textContent = 'Until date & time';
      endInput.type = 'text';
      endInput.placeholder = 'YYYY-MM-DD HH:mm';

      // init date-time picker on demand
      if (window.flatpickr && !fpUntil) {
        fpUntil = flatpickr(endInput, {
          enableTime   : true,
          time_24hr    : true,
          dateFormat   : 'Y-m-d H:i',
          altInput     : true,
          altFormat    : 'd.m.Y H:i',
          altInputClass: 'form-control form-control-lg',
          onChange     : updateScheduleSummary,
          onReady      : updateScheduleSummary
        });
      }
    }
    updateScheduleSummary();
  }

  function destroyUntilPicker() {
    if (fpUntil) { try { fpUntil.destroy(); } catch(e){}; fpUntil = null; }
  }

  if (endSel) {
    endSel.addEventListener('change', configureEndConditionUI);
  }
  if (endInput) {
    endInput.addEventListener('input', updateScheduleSummary);
    endInput.addEventListener('change', updateScheduleSummary);
  }

  // ----- Frequency handlers (mevcut alanlarla uyumlu) -----
  var freqSel = document.getElementById('frequencySelect');
  var freqGrp = document.getElementById('freqValueGroup');
  var freqLbl = document.getElementById('freqValueLabel');
  var freqInp = document.getElementById('frequencyValue');

  function configureFrequencyUI() {
    if (!freqSel || !freqGrp) return;
    var v = freqSel.value;
    var map = {
      minutes: 'Minutes Between Triggers',
      hours  : 'Hours Between Triggers',
      days   : 'Days Between Triggers',
      weeks  : 'Weeks Between Triggers',
      months : 'Every N months'
    };
    if (v === 'months' || v === 'weeks' || v === 'days' || v === 'hours' || v === 'minutes') {
      freqGrp.style.display = '';
      freqLbl.textContent = map[v] || 'Every';
    } else {
      freqGrp.style.display = 'none';
      if (freqInp) freqInp.value = '';
    }
    updateScheduleSummary();
  }

  if (freqSel)  freqSel.addEventListener('change', configureFrequencyUI);
  if (freqInp) { freqInp.addEventListener('input', updateScheduleSummary); freqInp.addEventListener('change', updateScheduleSummary); }

  // ----- Summary updater (#sumSchedule) -----
  function updateScheduleSummary() {
    var el = document.getElementById('sumSchedule');
    if (!el) return;

    // Start date (pretty)
    var startPretty = '-';
    if (fp && fp.altInput && fp.altInput.value) {
      startPretty = fp.altInput.value;
    } else if (input && input.value) {
      startPretty = input.value;
    }

    // Frequency short description
    var freqTxt = '';
    if (freqSel && freqSel.value) {
      var unit = freqSel.value;
      var every = (freqInp && freqInp.value) ? parseInt(freqInp.value, 10) : null;
      if (every && !Number.isNaN(every)) {
        // e.g., "every 10 minutes"
        freqTxt = `, every ${every} ${unit}`;
      } else {
        // e.g., " (minutes)" if value yoksa
        freqTxt = ` (${unit})`;
      }
    }

    // End condition text
    var endTxt = '';
    if (endSel) {
      var v = endSel.value;
      if (v === 'never') {
        endTxt = ', End: never';
      } else if (v === 'after') {
        var n = (endInput && endInput.value) ? parseInt(endInput.value, 10) : null;
        endTxt = `, End: after ${n || '?'} runs`;
      } else if (v === 'until') {
        var shown = '';
        if (fpUntil && fpUntil.altInput && fpUntil.altInput.value) {
          shown = fpUntil.altInput.value;
        } else if (endInput && endInput.value) {
          shown = endInput.value;
        } else {
          shown = '?';
        }
        endTxt = `, End: until ${shown}`;
      }
    }

    el.textContent = `${startPretty}${freqTxt}${endTxt}`;
    // İsteğe bağlı: global refreshSummary() varsa tetikle
    if (typeof window.refreshSummary === 'function') {
      try { window.refreshSummary(); } catch(e){}
    }
  }

  // ----- Boot -----
  configureFrequencyUI();
  configureEndConditionUI();
  updateScheduleSummary();
});
// === /schedule.js ===
