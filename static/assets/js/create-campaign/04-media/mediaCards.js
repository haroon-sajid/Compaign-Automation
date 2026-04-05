/* ──────────────────────────────────────────────────────────────
   mediaCards.js   (Create-Campaign sihirbazı, Step-4 Media)
   Bu dosya yalnızca #mediaCards kapsayıcısı ve kart seçim
   mantığını içerir.  (jQuery + diğer yardımcı fonk. zaten global)
   ────────────────────────────────────────────────────────────── */
$(function () {
    /* Sayfa ilk yüklendiğinde kartları gizle (özgün davranış) */
    $('#mediaCards').hide();

    /* Kart tıklamaları – seç / bırak + ilgili UI güncellemeleri */
    $('#mediaCards').on('click', '.media-card', function () {

        /* Kartı seç / seçimi kaldır */
        $(this).toggleClass('selected');

        /* Diğer bölümleri senkronize et (fonk. h-k hâlihazırda global) */
        if (typeof evalAutoFields === 'function') evalAutoFields();
        if (typeof refreshSummary === 'function') refreshSummary();
        if (typeof toggleMatchImagesPanel === 'function') toggleMatchImagesPanel();
    });
});
