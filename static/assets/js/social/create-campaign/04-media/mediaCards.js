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

$(document).ready(function () {
    const $dropzoneForm = $('#mediaUploadDropzone');

    if (!$dropzoneForm.length || typeof Dropzone === 'undefined') {
        return;
    }

    Dropzone.autoDiscover = false;

    const uploadUrl = $dropzoneForm.attr('action') || '/campaigns/upload-media/';
    const previewContainer = $('.media-preview');

    new Dropzone('#mediaUploadDropzone', {
        url: uploadUrl,
        paramName: 'file',
        autoProcessQueue: true,
        uploadMultiple: false,
        parallelUploads: 1,
        maxFiles: 1,
        maxFilesize: 50,
        acceptedFiles: 'video/*,video/mp4,video/webm,video/quicktime',
        addRemoveLinks: true,
        clickable: true,
        init: function () {
            this.on('addedfile', function (file) {
                if (this.files.length > 1) {
                    this.removeFile(this.files[0]);
                }

                const isVideo = file.type && file.type.startsWith('video/');
                const fileReader = new FileReader();

                fileReader.onload = function (e) {
                    const previewHtml = isVideo
                        ? `<video controls class="video-preview" style="max-width: 100%; max-height: 200px;">
                                <source src="${e.target.result}" type="${file.type}">
                                Your browser does not support the video tag.
                           </video>`
                        : `<img src="${e.target.result}" class="img-preview" style="max-width: 100%; max-height: 200px;"/>`;

                    previewContainer.html(previewHtml);
                };

                fileReader.readAsDataURL(file);
            });

            this.on('sending', function (_file, _xhr, formData) {
                const csrfToken = $('[name=csrfmiddlewaretoken]').val();
                if (csrfToken) {
                    formData.append('csrfmiddlewaretoken', csrfToken);
                }
            });

            this.on('success', function (_file, response) {
                $('.media-upload-container').data('media-url', response.url);
            });

            this.on('error', function (_file, errorMessage) {
                const message = typeof errorMessage === 'string'
                    ? errorMessage
                    : (errorMessage?.error || 'Error uploading file.');
                alert(message);
            });
        }
    });
});