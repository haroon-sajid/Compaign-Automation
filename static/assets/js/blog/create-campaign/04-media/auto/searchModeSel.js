/* -----------------------------------------------------------------
 *  searchModeSel.js   v5   (Multi-source support added)
 * ----------------------------------------------------------------- */
; (function ($) {
  'use strict';

  /******************************************************************
   *  AYARLAR
   ******************************************************************/
  const MAX_VISIBLE = 3;   // Ön-izleme çipi sınırı
  // MODIFIED: Use an object to map sources to their API endpoints
  const API_ENDPOINTS = {
    'pexels': '/campaigns/api/media/search/pexels/',
    'unsplash': '/campaigns/api/media/search/unsplash/',
    'pixabay': '/campaigns/api/media/search/pixabay/',
    'ai': '/campaigns/api/images/ai/'  //  Use correct path
  };
  const IMAGES_PER_KEYWORD = 15; // How many images to fetch for each keyword

  /******************************************************************
   *  UI GÜNCELLEME (MODA GÖRE)
   ******************************************************************/
  function updateSearchModeUI() {
    const mode = $('#searchModeSel').val();
    const isPrompt = mode === 'prompt';
    const isKeyword = mode === 'keyword';

    $('#freeFormGroup').toggle(isPrompt);
    $('#keywordSearchGroup').toggle(isKeyword);
    // Show/hide AI image fields based on source selection
    updateAIImageFields();

    if (isKeyword) {
      renderKwPreview();
    } else {
      renderKwPreview(true);
    }
  }

  // NEW: Function to show/hide AI image fields
  function updateAIImageFields() {
    const source = $('#imgSourceSel').val();
    const isAISource = source === 'ai';

    $('#aiImageFields').toggle(isAISource);

    // Auto-fill AI prompt with keywords when switching to AI mode
    if (isAISource && !$('#aiImagePrompt').val()) {
      const keywords = getActiveKeywords();
      if (keywords.length > 0) {
        $('#aiImagePrompt').val(`Professional image for: ${keywords.join(', ')}`);
      }
    }
  }

  /******************************************************************
   *  KEYWORD ÖN-İZLEME BARINI OLUŞTUR
   ******************************************************************/
  window.renderKwPreview = function (hide = false) {
    const $bar = $('#kwPreviewBar');
    const $chips = $('#kwPreviewChips');
    const $count = $('#kwPreviewCount');
    const $btn = $('#kwPreviewToggle');

    if (hide) { $bar.hide(); return; }
    let keywords = [];
    if (window.kwTable && $.fn.dataTable) {
      try {
        keywords = kwTable.column(2, { search: 'applied' }).data().toArray();
      } catch (e) { }
    }
    if (!keywords.length) keywords = $('#keywordsManual').val() || [];

    keywords = keywords.filter(kw => kw && kw.trim() !== '');

    $chips.empty();
    keywords.forEach((kw, i) => {
      const safe = $('<div>').text(kw).html();
      $chips.append(
        `<span class="kw-chip${i >= MAX_VISIBLE ? ' extra' : ''}" title="${safe}">${safe}</span>`
      );
    });
    const extraCount = Math.max(0, keywords.length - MAX_VISIBLE);
    $count.text(keywords.length);
    if (extraCount) {
      $btn.show()
        .text(`+${extraCount} daha`)
        .data({ collapsed: true, extraCount });
    } else {
      $btn.hide();
    }

    $('#kwSearchBtnCount').text(keywords.length);

    $bar.show();
  };

  /******************************************************************
   *  HELPER: Get active keywords from the page
   ******************************************************************/
  function getActiveKeywords() {
    let keywords = [];
    if (window.kwTable && $.fn.dataTable) {
      try {
        keywords = kwTable.column(2, { search: 'applied' }).data().toArray();
      } catch (e) {
        console.error("Could not get keywords from DataTable:", e);
      }
    }
    if (!keywords.length) {
      const manualKeywords = $('#keywordsManual').val();
      if (typeof manualKeywords === 'string' && manualKeywords.trim()) {
        keywords = manualKeywords.split(',').map(kw => kw.trim());
      }
    }
    return keywords.filter(kw => kw && kw.trim() !== '');
  }

  /******************************************************************
   *  CHECK IF AI MODE IS ACTIVE
   ******************************************************************/
  function isAIModeActive() {
    // Check both the source toggle and image source selector
    const sourceToggleValue = $('#sourceHidden').val();
    const imgSourceValue = $('#imgSourceSel').val();

    console.log('AI Mode Check:', {
      sourceToggleValue: sourceToggleValue,
      imgSourceValue: imgSourceValue,
      isAISource: imgSourceValue === 'ai',
      isAIToggle: sourceToggleValue === 'ai'
    });

    return imgSourceValue === 'ai' || sourceToggleValue === 'ai';
  }

  /******************************************************************
   *  AI IMAGE GENERATION
   ******************************************************************/
  async function generateAIImage(prompt = null, style = null) {
    const finalPrompt = prompt || $('#aiImagePrompt').val().trim();
    const finalStyle = style || $('#aiImageStyle').val() || 'realistic';
    const $imagePool = $('#miPool');
    const $generateBtn = $('#generateAiImageBtn');

    if (!finalPrompt) {
      alert('Please enter a description for AI image generation.');
      return;
    }

    console.log(`AI image generation started. Prompt: ${finalPrompt}, Style: ${finalStyle}`);

    // Show loading state
    if ($generateBtn.length) {
      $generateBtn.prop('disabled', true).html('<i class="entypo-hourglass"></i> Generating...');
    }

    $('#mediaUploadBox').show();
    $('#matchImagesPanel').show();
    $('#mediaDropzone').hide();
    $imagePool.html('<p class="text-center text-muted">Generating AI image...</p>');

    try {
      const apiEndpoint = API_ENDPOINTS['ai'];
      const response = await fetch(`${apiEndpoint}?query=${encodeURIComponent(finalPrompt)}&style=${encodeURIComponent(finalStyle)}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate AI image.');
      }

      const images = await response.json();
      console.log("Received AI image from API:", images);

      // Display the generated AI image
      displayAIImageResults(images);

    } catch (error) {
      console.error('AI image generation failed:', error);
      $imagePool.html(`<p class="text-center text-danger">Error: ${error.message}</p>`);
    } finally {
      if ($generateBtn.length) {
        $generateBtn.prop('disabled', false).html('<i class="entypo-rocket"></i> Generate AI Image');
      }
    }
  }

  // NEW: Function to display AI image results
  function displayAIImageResults(images) {
    const $imagePool = $('#miPool');
    $imagePool.empty();

    if (!images || images.length === 0) {
      $imagePool.html('<p class="text-center text-muted">No AI image was generated. Please try again.</p>');
      return;
    }

    images.forEach(image => {
      const thumbHtml = `
        <div class="thumb-item" 
             data-id="ai-${Date.now()}"
             data-large-src="${image.large_image}" 
             data-small-src="${image.large_image}"  // AI images typically have one size
             data-photographer="AI Generated"
             title="AI Generated Image">
          <img src="${image.large_image}" alt="AI Generated Image">
          <div class="ai-badge">AI</div>
        </div>
      `;
      $imagePool.append(thumbHtml);
    });
  }

  /******************************************************************
   *  FREE-FORM ARAMA
   ******************************************************************/
  async function runFreeFormSearch() {
    const query = $('#freeFormInput').val().trim();
    const source = $('#imgSourceSel').val(); // e.g., 'pexels', 'unsplash', 'pixabay', 'ai'
    const $imagePool = $('#miPool');

    // MODIFIED: Handle AI source differently
    if (isAIModeActive()) {
      console.log('AI mode detected for free-form search');
      // For AI source, use the free form input as prompt
      if (!query) {
        alert('Please enter a description for AI image generation.');
        return;
      }
      await generateAIImage(query);
      return;
    }

    // MODIFIED: Centralized validation and endpoint selection
    if (!source) {
      if (!isAIModeActive()) {          // <-- add this guard
        alert('Please select an image source (e.g., Pexels.com, Unsplash.com, Pixabay.com, or AI).');
      }
      return;
    }
    if (!query) {
      alert('Please enter a search term.');
      return;
    }

    const apiEndpoint = API_ENDPOINTS[source];
    if (!apiEndpoint) {
      alert('Invalid image source selected.');
      console.error('No API endpoint configured for source:', source);
      return;
    }

    console.log(`Free-form search started. Source: ${source}, Query: ${query}`);

    $('#mediaUploadBox').show();
    $('#matchImagesPanel').show();
    $('#mediaDropzone').hide();
    $imagePool.html('<p class="text-center text-muted">Searching for images...</p>');

    try {
      // MODIFIED: Use the dynamic endpoint
      const response = await fetch(`${apiEndpoint}?query=${encodeURIComponent(query)}&per_page=20`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch images.');
      }
      const images = await response.json();
      console.log("Received images from API:", images);
      // MODIFIED: Call the generic display function
      displayImageResults(images, source);

    } catch (error) {
      console.error('Search failed:', error);
      $imagePool.html(`<p class="text-center text-danger">Error: ${error.message}</p>`);
    }

    renderKwPreview(true);
  }

  /******************************************************************
   *  BULK KEYWORD SEARCH
   ******************************************************************/
  async function runKeywordSearch() {
    const keywords = getActiveKeywords();
    const source = $('#imgSourceSel').val(); // e.g., 'pexels', 'unsplash', 'ai'
    const $imagePool = $('#miPool');

    console.log('runKeywordSearch called', {
      keywords: keywords,
      source: source,
      isAIMode: isAIModeActive()
    });

    // MODIFIED: Handle AI source differently for bulk search
    if (isAIModeActive()) {
      console.log('AI mode detected for keyword search');
      // For AI source with multiple keywords, use the first keyword or combine them
      if (keywords.length === 0) {
        alert('There are no keywords to generate AI images for. Please add some keywords first.');
        return;
      }
      const combinedPrompt = keywords.join(', ');
      await generateAIImage(`Professional images for: ${combinedPrompt}`);
      return;
    }

    // MODIFIED: Centralized validation and endpoint selection
    if (!source && !isAIModeActive()) {
      alert('Please select an image source (e.g., Pexels.com, Unsplash.com, Pixabay.com, or AI).');
      return;
    }
    if (keywords.length === 0) {
      alert('There are no keywords to search for. Please add some keywords first.');
      return;
    }

    const apiEndpoint = API_ENDPOINTS[source];
    if (!apiEndpoint) {
      alert('Invalid image source selected.');
      console.error('No API endpoint configured for source:', source);
      return;
    }

    console.log(`Keyword search started. Source: ${source}, Keywords:`, keywords);

    $('#mediaUploadBox').show();
    $('#matchImagesPanel').show();
    $('#mediaDropzone').hide();
    $imagePool.html(`<p class="text-center text-muted">Searching for ${keywords.length} keywords...</p>`);

    try {
      const promises = keywords.map(kw => {
        // MODIFIED: Use the dynamic endpoint
        const url = `${apiEndpoint}?query=${encodeURIComponent(kw)}&per_page=${IMAGES_PER_KEYWORD}`;
        return fetch(url).then(res => {
          if (!res.ok) {
            console.error(`Failed to fetch images for keyword: ${kw} from ${source}`);
            return [];
          }
          return res.json();
        });
      });

      const results = await Promise.all(promises);
      const allImages = results.flat();
      console.log(`Fetched a total of ${allImages.length} images (before deduplication).`);

      const uniqueImagesMap = new Map();
      allImages.forEach(image => {
        uniqueImagesMap.set(image.id, image);
      });
      const uniqueImages = Array.from(uniqueImagesMap.values());
      console.log(`Displaying ${uniqueImages.length} unique images.`);

      // MODIFIED: Call the generic display function
      displayImageResults(uniqueImages, source);

    } catch (error) {
      console.error('Keyword search failed:', error);
      $imagePool.html(`<p class="text-center text-danger">Error: An unexpected error occurred during the search.</p>`);
    }
  }

  // MODIFIED: Renamed function and made it generic
  function displayImageResults(images, source) {
    const $imagePool = $('#miPool');
    $imagePool.empty();

    if (!images || images.length === 0) {
      $imagePool.html('<p class="text-center text-muted">No images found for this search.</p>');
      return;
    }

    // NEW: Capitalize the source name for display
    const sourceName = source.charAt(0).toUpperCase() + source.slice(1);

    images.forEach(image => {
      // MODIFIED: Title is now dynamic based on the source
      const thumbHtml = `
        <div class="thumb-item" 
             data-id="${image.id}"
             data-large-src="${image.large_image}" 
             data-small-src="${image.small_image}"
             data-photographer="${image.photographer}"
             title="Photo by ${image.photographer} on ${sourceName}">
          <img src="${image.small_image}" alt="Photo by ${image.photographer}">
        </div>
      `;
      $imagePool.append(thumbHtml);
    });
  }

  function handleImageSelection(clickedImage) {
    if (!window.selectionContext) {
      alert('Please click "Featured Image" or "Media in Content" first to choose where to add the image.');
      return;
    }

    const $thumb = $(clickedImage);
    const largeSrc = $thumb.data('large-src');
    const smallSrc = $thumb.data('small-src');
    const $targetCard = $(`#${window.selectionContext}`);

    if (window.selectionContext === 'cardCover') {
      $targetCard.css('background-image', `url(${largeSrc})`).addClass('has-image');
    } else if (window.selectionContext === 'cardContent') {
      const MAX_CONTENT_IMAGES = 5;
      let $previewContainer = $targetCard.find('.content-image-previews');
      if ($previewContainer.find('img').length >= MAX_CONTENT_IMAGES) {
        alert(`You can only select a maximum of ${MAX_CONTENT_IMAGES} images for Media in Content.`);
        return;
      }
      if ($previewContainer.length === 0) {
        $previewContainer = $('<div class="content-image-previews"></div>');
        $targetCard.append($previewContainer);
      }
      $previewContainer.append(`<img src="${smallSrc}" data-large-src="${largeSrc}" alt="Selected content image">`);
      $targetCard.addClass('has-image');
    }

    console.log(`Image ${$thumb.data('id')} assigned to ${window.selectionContext}`);
    $targetCard.removeClass('is-selecting');
    window.selectionContext = null;
  }

  /******************************************************************
   *  DOM READY - All event handlers go inside here
   ******************************************************************/
  $(function () {

    $('#searchModeSel')
      .off('.searchMode')
      .on('change.searchMode', function () {
        updateSearchModeUI();
      })
      .trigger('change');

    // NEW: Handle image source selection change
    $('#imgSourceSel')
      .off('.sourceChange')
      .on('change.sourceChange', function () {
        updateAIImageFields();
        console.log('Image source changed to:', $(this).val());
      })
      .trigger('change');

    // NEW: Also monitor the source toggle for AI mode
    $(document).on('change', '#sourceHidden', function () {
      console.log('Source toggle changed to:', $(this).val());
      updateAIImageFields();
    });

    $('#freeFormSearchBtn').on('click', runFreeFormSearch);
    $('#freeFormInput').on('keydown', e => { if (e.key === 'Enter') runFreeFormSearch(); });

    // $('#runKeywordSearchBtn').on('click', runKeywordSearch);
    $('#runKeywordSearchBtn').on('click', function () {
      // Check if free plan AND AI mode
      if (window.userPlan === 'free' && isAIModeActive()) {
        alert('AI image generation is not available on Free plan. Please upgrade to Pro, Business, or Enterprise.');
        return;
      }
      runKeywordSearch();
    });

    // NEW: AI image generation button
    $('#generateAiImageBtn').on('click', function () {
      generateAIImage();
    });
    $('#aiImagePrompt').on('keydown', e => {
      if (e.key === 'Enter' && isAIModeActive()) {
        generateAIImage();
      }
    });

    $('#kwPreviewToggle').on('click', function () {
      const collapsed = $(this).data('collapsed');
      const extraCount = $(this).data('extraCount') || 0;

      if (collapsed) {
        $('#kwPreviewChips .extra').removeClass('extra');
        $(this).text('Daralt').data('collapsed', false);
      } else {
        $('#kwPreviewChips .kw-chip').slice(MAX_VISIBLE).addClass('extra');
        $(this).text(`+${extraCount} daha`).data('collapsed', true);
      }
    });

    $(document).on('input change', '#keywordsManual, #keywordsBulkInput', () => {
      if ($('#searchModeSel').val() === 'keyword') renderKwPreview();
    });
    if (window.kwTable && $.fn.dataTable) {
      kwTable.on('draw', () => {
        if ($('#searchModeSel').val() === 'keyword') renderKwPreview();
      });
    }

    $('#miPool').on('click', '.thumb-item', function () {
      handleImageSelection(this);
    });

  });

})(jQuery);