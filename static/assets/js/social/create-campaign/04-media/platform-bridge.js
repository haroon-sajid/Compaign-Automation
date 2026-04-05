/* platform-bridge.js — Content Settings → Media köprüsü (Social)
   - Content Settings panelindeki seçimleri dinler
   - Media adımına "platforms.changed" olayı ile güncel listeyi yollar
   - localStorage ile seçimi kalıcı kılar
*/
(function (w, $) {
  'use strict';

  const LS_KEY = 'publisha:selectedPlatforms';

  // Content Settings tarafı: butonlar/toggle’lar social-platforms.js içinde render ediliyor varsayımı
  // Seçim değiştiğinde ".sp-item.active" gibi bir sınıf bırakıldığını kabul ediyoruz.
  function readSelectedFromContentSettings () {
    const set = new Set();
    // data-platform="twitter|linkedin|facebook|instagram|threads"
    $('[data-sp-grid] .sp-item.active,[data-sp-grid] .sp-item[aria-pressed="true"]').each(function () {
      const k = ($(this).data('platform') || '').toString().trim().toLowerCase();
      if (k) set.add(k);
    });
    // Fallback: hidden input
    $('input[name="selected_platforms"]').each(function(){
      const v = ($(this).val()||'').toString().split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
      v.forEach(k=>set.add(k));
    });
    return Array.from(set);
  }

  function persist(list){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(list||[])); }catch(e){}
  }
  function restore(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    }catch(e){ return []; }
  }

  // Media adımına yayınla
  function emitToMedia(list){
    $(document).trigger('platforms.changed', [ list ]);
  }

  // Dışarı açık API
  function getSelectedPlatforms(){
    // Önce Content Settings’ten oku, boşsa storage dön
    const live = readSelectedFromContentSettings();
    if (live.length) { persist(live); return live; }
    return restore();
  }

  // Content Settings tarafındaki değişimleri yakala
  function bind(){
    // social-platforms.js seçim düğmeleri
    $(document).off('click.pb toggle.pb change.pb', '[data-sp-grid] .sp-item, [data-sp-grid] input, [data-sp-grid] button')
      .on('click.pb toggle.pb change.pb', '[data-sp-grid] .sp-item, [data-sp-grid] input, [data-sp-grid] button', function(){
        const list = readSelectedFromContentSettings();
        persist(list);
        emitToMedia(list);
      });
    // Sayfa ilk yüklemesi
    $(function(){
      emitToMedia(getSelectedPlatforms());
    });
  }

  // Global export
  w.PlatformBridge = {
    getSelectedPlatforms,
    emitToMedia
  };

  bind();

})(window, jQuery);
