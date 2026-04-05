// === flatpickr.init (YENİ) ===
document.addEventListener('DOMContentLoaded', function () {
  var input = document.getElementById('scheduleDate');
  if (!input) return;

  // Türkçe yerelleştirme
  if (window.flatpickr && window.flatpickr.l10ns && window.flatpickr.l10ns.tr) {
    flatpickr.localize(flatpickr.l10ns.tr);
  }

  var fp = flatpickr('#scheduleDate', {
    enableTime: true,
    time_24hr: true,
    dateFormat: 'Y-m-d H:i',     // form alanına yazılacak asıl format
    altInput: true,
    altFormat: 'd.m.Y H:i',      // kullanıcıya görünen format
    altInputClass: 'form-control form-control-lg', // Bootstrap ile aynı görünüm
    minuteIncrement: 5,
    allowInput: true,
    disableMobile: false,        // mobilde native picker olabilir
    // İstersen: bugünden önceyi kapat
    // minDate: 'today',
    defaultDate: input.value && input.value.trim() ? input.value : null,
    onChange: updateSummary,
    onReady: updateSummary
  });

  function updateSummary(selectedDates, dateStr) {
    var sumEl = document.getElementById('sumSchedule');
    if (!sumEl) return;
    // Kullanıcıya görünen alt input varsa onu yaz, yoksa formatlı değeri kullan
    var shown = fp && fp.altInput && fp.altInput.value ? fp.altInput.value : (dateStr || input.value || '-');
    sumEl.textContent = shown || '-';
  }
});
// === /flatpickr.init ===
