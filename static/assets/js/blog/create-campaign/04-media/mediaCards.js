/* ──────────────────────────────────────────────────────────────
   mediaCards.js   (Create-Campaign sihirbazı, Step-4 Media)
   Bu dosya yalnızca #mediaCards kapsayıcısı ve kart seçim
   mantığını içerir.  (jQuery + diğer yardımcı fonk. zaten global)
   ────────────────────────────────────────────────────────────── */

/* ──────────────────────────────────────────────────────────────
   mediaCards.js   (Create-Campaign sihirbazı, Step-4 Media)
   Bu dosya yalnızca #mediaCards kapsayıcısı ve kart seçim
   mantığını içerir.  (jQuery + diğer yardımcı fonk. zaten global)
   ────────────────────────────────────────────────────────────── */
$(function () {
    /* Sayfa ilk yüklendiğinde kartları gizle (özgün davranış) */
    $('#mediaCards').hide();

    /* Kart tıklamaları – seç / bırak + ilgili UI güncellemeleri */
    $('#mediaCards').off('click', '.media-card').on('click', '.media-card', function (e) {
        e.preventDefault();
        e.stopPropagation();
        
        const $clickedCard = $(this);
        const cardId = $clickedCard.attr('id');
        
        /* Kartı seç / seçimi kaldır */
        $clickedCard.toggleClass('selected');
        
        /* Hidden input değerlerini güncelle */
        if (cardId === 'cardCover') {
            $('#mediaSelectionCover').val($clickedCard.hasClass('selected') ? '1' : '');
        } else if (cardId === 'cardContent') {
            $('#mediaSelectionContent').val($clickedCard.hasClass('selected') ? '1' : '');
        }

        /* Diğer bölümleri senkronize et (fonk. h-k hâlihazırda global) */
        if (typeof evalAutoFields === 'function') evalAutoFields();
        if (typeof refreshSummary === 'function') refreshSummary();
        if (typeof toggleMatchImagesPanel === 'function') toggleMatchImagesPanel();
    });
});