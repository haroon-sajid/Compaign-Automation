/*  sourceToggle.js  – Media adımındaki Auto Search / Manually Add anahtarı
   -------------------------------------------------------------- */
(function ($) {
  'use strict';

  $(function () {
    console.log('sourceToggle.js yüklendi');

    /* ------------------------------------------------------------
       Tüm alanların göster / gizle mantığı
       Global erişim gerektiği için window’a açıyoruz
    ----------------------------------------------------------------*/
    window.evalAutoFields = function () {
      const mode = $('#sourceHidden').val();          // '', auto, manual
      const isAuto = mode === 'auto';
      const isManual = mode === 'manual'; // Added for clarity
      const isAI = mode === 'ai'; // NEW: Add AI mode detection

      /* Hiç seçim yoksa her şeyi kapat */
      console.log('evalAutoFields:', mode);
      if (!mode) {
        $('#autoFields, #mediaUploadBox').hide();
        $('#mediaCards').toggle(false);
        if (typeof refreshSummary === 'function') refreshSummary();
        return;
      }

      console.log('Media source mode:', mode);
      console.log('Selected cards:', $('#mediaCards .media-card.selected').length);
      const anyCard = $('#mediaCards .media-card.selected').length > 0;

      /* Otomatik mod → Ek alanları göster */
      $('#autoFields').toggle((isAuto || isAI) && anyCard); // UPDATED: Include AI mode

      /* Hide Image Source field only for AI mode */
      if (isAI && anyCard) {
          // Try different selectors to find and hide the Image Source field
          $('label:contains("Image Source")').closest('.form-group').hide();
          $('label:contains("Image Source")').closest('.field-group').hide();
          $('label:contains("Image Source")').parent().hide();
      }

      // ▼▼▼ ADD THIS CODE RIGHT HERE ▼▼▼
      /* Show Image Source field for Auto mode */
      if (isAuto && anyCard) {
          // Show the Image Source field again when in Auto mode
          $('label:contains("Image Source")').closest('.form-group').show();
          $('label:contains("Image Source")').closest('.field-group').show();
          $('label:contains("Image Source")').parent().show();
      }
      // ▲▲▲ END OF ADDED CODE ▲▲▲

      /* Manuel mod → Upload kutusunu göster VE İÇERİĞİ SIFIRLA */
      $('#mediaUploadBox').toggle(isManual && anyCard);
      if (isManual && anyCard) {
        $('#mediaUploadBox').css('min-height', '40px');

        // ▼▼▼ NEW RESET LOGIC ▼▼▼
        // When switching to Manual mode, always reset the view to show the uploader.
        $('#matchImagesPanel').hide();    // Hide the panel that contains search results
        $('#mediaDropzone').show();       // Show the "drag & drop" box
        $('#miPool').empty();             // Clear any leftover images from the pool
        // ▲▲▲ END OF NEW LOGIC ▲▲▲
      }

      /* Kart paneli mutlaka açık (eğer bir mod seçiliyse) */
      $('#mediaCards').toggle(true);

      // 1. Show the entire #mediaUploadBox container as soon as "Manual" is selected.
      $('#mediaUploadBox').toggle(isManual);

      if (isManual) {
        // 2. Add a helpful prompt message if it doesn't already exist.
        //    This message will guide the user on what to do next.
        if (!$('#mediaUploadBox .prompt-message').length) {
          $('#mediaUploadBox').prepend(`
            <div class="prompt-message text-center p-5 text-muted" style="display:none;">
              <h4>Ready to Upload</h4>
              <p>Please select "Featured Image" or "Media in Content" to activate the uploader.</p>
            </div>
          `);
        }

        // 3. Decide what to show inside the #mediaUploadBox:
        //    - If a card is selected (anyCard is true), show the uploader panel.
        //    - If no card is selected, show the new prompt message.
        $('#matchImagesPanel').toggle(anyCard);
        $('#mediaUploadBox .prompt-message').toggle(!anyCard);

        // This is the original reset logic, which should still run when the uploader appears.
        if (anyCard) {
          $('#mediaDropzone').show();
          $('#miPool').empty();
        }
      }

      // --- End of Changed Section ---


      if (typeof refreshSummary === 'function') refreshSummary();
    };


    /* ------------------------------------------------------------
   AI Image Generation Logic - Same flow as Auto/Manual
---------------------------------------------------------------*/
function handleAIImageMode() {
    // Show AI fields but don't hide autoFields
    $('#aiImageFields').show();
    // REMOVED: $('#autoFields, #mediaUploadBox').hide();
    
    // Auto-fill prompt with keywords
    const keywords = getCurrentKeywords();
    if (keywords.length > 0) {
        $('#aiImagePrompt').val(`Create AI Image with ${keywords.join(', ')}`);
    }
}

function generateAIImage() {
    const prompt = $('#aiImagePrompt').val().trim();
    if (!prompt) {
        alert('Please enter a description for AI image generation.');
        return;
    }

    // Show loading state - same pattern as Auto Search
    $('#generateAiImageBtn').prop('disabled', true).html('<i class="entypo-hourglass"></i> Generating...');

    // Call backend - same pattern as Auto Search
    $.ajax({
        url: '/api/ai-image/',  // Your placeholder endpoint
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ prompt: prompt }),
        success: function(response) {
            // Show generated image in the same preview area as Auto/Manual
            displayAIImagePreview(response.image_url);
            $('#generateAiImageBtn').prop('disabled', false).html('<i class="entypo-rocket"></i> Generate AI Image');
        },
        error: function(xhr, status, error) {
            alert('AI Image generation failed: ' + error);
            $('#generateAiImageBtn').prop('disabled', false).html('<i class="entypo-rocket"></i> Generate AI Image');
        }
    });
}

function displayAIImagePreview(imageUrl) {
    // Clear existing images first - same as Auto Search reset
    $('#miPool').empty();
    
    // Add generated image to pool - same pattern as Auto Search results
    const imgElement = `
        <div class="mi-item" data-url="${imageUrl}">
            <img src="${imageUrl}" alt="AI Generated Image">
            <div class="mi-actions">
                <button class="btn-select-image" onclick="selectAIImage('${imageUrl}')">Select</button>
            </div>
        </div>
    `;
    $('#miPool').append(imgElement);
    
    // Show the match images panel - same as Auto Search
    $('#matchImagesPanel').show();
}

function selectAIImage(imageUrl) {
    // Use the EXACT SAME selection logic as Auto/Manual images
    const selectedCard = $('.media-card.selected');
    const cardType = selectedCard.attr('id'); // 'cardCover' or 'cardContent'
    
    if (cardType === 'cardCover') {
        // Set as featured image - same storage method
        selectedCard.find('.card-image img').attr('src', imageUrl);
        selectedCard.find('.card-image').data('url', imageUrl);
        // Store in hidden input like existing code
        updateMediaSummary(); // Your existing function
    } else if (cardType === 'cardContent') {
        // Add to content images - same storage method  
        addToContentImages(imageUrl); // Your existing function
    }
    
    // Refresh summary - same as other modes
    if (typeof refreshSummary === 'function') {
        refreshSummary();
    }
}

    /* ------------------------------------------------------------
       Anahtarı tıklama olayı
    ----------------------------------------------------------------*/
    $('#sourceToggle')
      .off('click.sourceToggle')                       // Eski bağ varsa sök
      .on('click.sourceToggle', '.source-opt', function () {

        const $btn = $(this);
        const isActive = $btn.hasClass('active');
        console.log('sourceToggle click:', $btn.data('val'), isActive);

        /* Aynı seçeneğe tekrar tıklandıysa ⇒ sıfırla */
        if (isActive) {
          $('.source-opt').removeClass('active');
          $('#sourceHidden').val('');
          $('#sourceToggle').removeClass('manual');
          $('#sourceToggle .source-slider').hide();
          window.evalAutoFields();
          return;
        }

        /* Yeni seçim */
        const val = $btn.data('val');                  // auto | manual
        $('.source-opt').removeClass('active');
        $btn.addClass('active');

        $('#sourceHidden').val(val);
        $('#sourceToggle')
            .toggleClass('manual', val === 'manual')          // keeps auto/manual working
            .removeAttr('data-active')                        // wipe any previous ai flag
            .attr('data-active', val === 'ai' ? 'ai' : null); // add ai flag only for ai
        $('#sourceToggle .source-slider').show();

        window.evalAutoFields();                       // UI senkronu
        $('#mediaCards').fadeIn(120);                  // Kart panelini aç

        /* Match-Images paneli bu moda bağlıysa güncelle */
        if (typeof toggleMatchImagesPanel === 'function') {
          toggleMatchImagesPanel();
        }
      });

    /* Sayfa taslağından restore edildiyse ilk durumu ayarla */
    window.evalAutoFields();
  });

// Add this function to sourceToggle.js to help with AI mode detection
window.isAIModeActive = function() {
    const sourceToggleValue = $('#sourceHidden').val();
    const imgSourceValue = $('#imgSourceSel').val();
    
    console.log('AI Mode Check from sourceToggle:', {
        sourceToggleValue: sourceToggleValue,
        imgSourceValue: imgSourceValue
    });
    
    // If AI is selected in source toggle, also update the image source selector
    if (sourceToggleValue === 'ai' && imgSourceValue !== 'ai') {
        $('#imgSourceSel').val('ai').trigger('change');
    }
    
    return sourceToggleValue === 'ai' || imgSourceValue === 'ai';
};

})(jQuery);