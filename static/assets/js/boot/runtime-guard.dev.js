(function () {
  // Prod'da çalışmasın: domain/desen kontrolü (ihtiyacınıza göre uyarlayın)
  var isDev = /localhost|\.local|\.test|\.dev$/i.test(location.hostname);
  if (!isDev) return;

  var scripts = Array.prototype.map.call(document.scripts, function (s) { return s.src || ''; });

  // 1) Bootstrap JS çoğaltma kontrolü
  var boots = scripts.filter(function (src) { return /(^|\/)bootstrap(\.min)?\.js(\?|$)/i.test(src); });
  if (boots.length > 1) {
    console.warn('[Guard] Multiple Bootstrap JS detected:', boots);
  }

  // 2) jQuery kontrolü + versiyon bilgisi
  if (!window.jQuery) {
    console.warn('[Guard] jQuery not found yet. Load jQuery before plugins.');
  } else {
    console.info('[Guard] jQuery version:', jQuery.fn && jQuery.fn.jquery);

    // 3) jQuery Migrate var mı?
    var hasMigrate = !!(jQuery.migrateVersion || (window.jQuery.migrateWarnings));
    if (hasMigrate) {
      console.warn('[Guard] jQuery Migrate detected. Remove it in production and update deprecated APIs.');
    }
  }

  // 4) Sık karşılaşılan eklenti sırası
  var orderHints = [
    /jquery(\.min)?\.js/i,
    /jquery-ui(\.min)?\.js/i,
    /bootstrap(\.min)?\.js/i
  ];
  var firstIndex = scripts.findIndex(function (s) { return orderHints[0].test(s); });
  var uiIndex    = scripts.findIndex(function (s) { return orderHints[1].test(s); });
  var bsIndex    = scripts.findIndex(function (s) { return orderHints[2].test(s); });
  if (firstIndex === -1 || uiIndex === -1 || bsIndex === -1) return;

  if (!(firstIndex < uiIndex && uiIndex < bsIndex)) {
    console.warn('[Guard] Script order looks off. Expected jQuery → jQuery UI → Bootstrap.');
  }
})();
