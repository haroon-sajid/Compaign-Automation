/* =========================================================
 *  next-step-button.js                         (v1.1 – 04 Aug 2025)
 *  – “Next / Save & Queue” butonlarının mantığı
 *  – Tarayıcı hata düzeltildi (IIFE eklendi)
 * ========================================================= */

(function () {

    /* Erken çıkış: jQuery veya DataTables yoksa pasif kal */
    if (!window.$ || !$.fn || !$.fn.DataTable) {
        console.error('jQuery veya DataTables yüklenemedi – wizard pasif.');
        return;                     // ← artık YASAL çünkü fonksiyon içindeyiz
    }

    /* Global kilit – çift tıklamayı engeller */
    let nextStepLock = false;
    const DEBOUNCE_MS = 800;

    /* Ana tıklama yakalayıcı */
    $(document).on('click', '.next-step', async function () {

        if (nextStepLock) return;   // hâlihazırda çalışıyorsa çık
        nextStepLock = true;

        const $btn  = $(this);
        const label = $btn.text();

        /* 1) UI: butonu kilitle & spinner göster */
        $btn.prop('disabled', true).html(label + ' ⌛');

        /* 2) Aktif adımı tespit et */
        const curr = $('.wizard-step.active').data('step');

        /* 3) Adıma özel kontroller -------------------------------- */
        if (curr === 2 && typeof syncKeywords === 'function') {
            syncKeywords();                     // Step-2 textarea → tablo
        }

        if (curr === 1 && $('#cardNew').hasClass('selected')
            && typeof saveNewTemplate === 'function') {
            const ok = saveNewTemplate();       // Step-1 “New Prompt”
            if (!ok) return release();          // kayıt reddedildi
        }

        /* --- Step-4 görsel eşleşmesi (REV-2) --------------------- */
        if (curr === 4) {
            const mode = $('#sourceHidden').val();  // '' | auto | manual
            if (mode === 'manual') {
                const unmatched =
                    $('#miContentList .thumb-box[data-matched="0"]').length;
                if (unmatched) {
                    const proceed = confirm(
`There are ${unmatched} keywords without an associated image.
Are you sure you want to proceed without matching them?`);
                    if (!proceed) return release();
                }
            }
        }

        /* 4) Adım geçişi */
        if (typeof showStep === 'function') showStep(curr + 1);
        if (curr + 1 === 4 && typeof refreshMiContentList === 'function') {
            refreshMiContentList();
        }

        /* 4. adım (Media) hariç tablo/medya kutularını gizle */
        if (curr + 1 !== 4) {
            $('#mediaUploadBox, #matchImagesPanel').hide();
        }

        /* 5) Debounce: belirlenen süre sonra butonu serbest bırak */
        setTimeout(release, DEBOUNCE_MS);

        /* ------- Yardımcı ------- */
        function release () {
            nextStepLock = false;
            $btn.prop('disabled', false).text(label);
        }
    });

})();  // ← IIFE bitti
