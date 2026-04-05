/*  tone.js  ───────────────────────────────────────────────────────────
 *  Handles “Tone of Voice” grid selection, state-sync and restoration
 *  Author: Publisha
 *  ------------------------------------------------------------------*/
const Tone = (() => {
    const gridSel = '#wsToneGrid';
    const inputSel = '#toneHidden';
    const ACTIVE = 'active';

    /* — İç yardımcı — */
    function applyToUI(val = '') {
        const $items = $(`${gridSel} .tone-item`);
        $items.removeClass(ACTIVE);
        if (val) {                       // geçerli bir ton varsa işaretle
            $(`${gridSel} .tone-item[data-value="${val}"]`).addClass(ACTIVE);
        }
        $(inputSel).val(val);
    }

    /* — Olay bağlayıcı — */
    function bind() {
        $(document).on('click', `${gridSel} .tone-item`, function () {
            const val = $(this).data('value');
            applyToUI(val);                  // UI + gizli input güncelle
            $(inputSel).trigger('change');   // autosave & benzeri dinleyiciler
            if (typeof refreshSummary === 'function') refreshSummary();
        });
    }

    /* — Haricî çağrılara açık API — */
    function set(val) { applyToUI(val); }

    /* — Başlatıcı — */
    function init() {
        bind();                     // olaylar
        applyToUI($(inputSel).val());   // sayfa ilk açıldığında gizli input’u oku
    }

    return { init, set };
})();

/*  DOM hazır olunca başlat */
$(document).ready(Tone.init);
