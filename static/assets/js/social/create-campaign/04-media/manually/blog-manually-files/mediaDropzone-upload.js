; (() => {
  'use strict';

  /* —————————————————— Elemanlar —————————————————— */
  const $DZ = $('#mediaDropzone');
  const $fileInp = $('#mediaFileInput');
  const $pool = $('#miPool');

  /* —————————————————— Ayarlar ve Yardımcılar (No logs needed here) —————————————————— */
  const MAX_BYTES = 25 * 1024 * 1024, MAX_SIDE = 8_000, MAX_UPLOAD_AT_ONCE = 500, MAX_TOTAL_IN_POOL = 500;
  const ALLOWED_TYPES = ['image/jpeg', 'image/pjpeg', 'image/jpg', 'image/png', 'image/x-png', 'image/webp', 'image/avif', 'image/gif', 'video/mp4'];
  const fpOf = f => [f.name.replace(/\.[^.]+$/, '').toLowerCase(), f.size, f.lastModified].join('|');
  const mediaIndex = new Set();
  const currentPoolCount = () => $pool.find('.thumb-wrap').length || $('#mediaGallery').find('img').length;
  function addToPool(file, url) { const fp = fpOf(file); if (mediaIndex.has(fp)) return false; mediaIndex.add(fp); $pool.append(`<div class="thumb-wrap"><img src="${url}" draggable="false" data-fp="${fp}"><button class="thumb-del" type="button">&times;</button></div>`); return true; }
  function updateDropzoneVisibility() { $DZ.toggle(!$pool.find('.thumb-wrap').length); }
  function checkSafety(files, cb) { const safe = []; let pending = files.length; const done = () => (--pending === 0) && cb(safe); files.forEach(f => { if (f.size > MAX_BYTES) return done(); if (f.type && !ALLOWED_TYPES.includes(f.type)) return done(); if (!f.type.startsWith('image/')) { safe.push(f); return done(); } const url = URL.createObjectURL(f); const img = new Image(); img.onload = () => { if (img.width <= MAX_SIDE && img.height <= MAX_SIDE) safe.push(f); URL.revokeObjectURL(url); done(); }; img.onerror = () => { URL.revokeObjectURL(url); done(); }; img.src = url; }); }

  /* —————————————————— Ana Karşılayıcı (MAIN FUNCTION WITH LOGS) —————————————————— */
  function handleFiles(e) {
    const callId = Date.now(); // Unique ID for this specific call

    // --- START OF LOGS ---
    console.log(`%c[${callId}] handleFiles CALLED`, 'color: green; font-weight: bold;', {
      eventType: e.type,
      target: e.target,
      originalEvent: e.originalEvent
    });
    // --- END OF LOGS ---

    if (e.originalEvent && e.originalEvent.dataTransfer && !e.originalEvent.dataTransfer.files.length) { e.originalEvent.dataTransfer.files = e.target.files; }
    const files = Array.from(e.target.files || e.originalEvent.dataTransfer.files);

    if (!files.length) {
      console.log(`[${callId}] No files found, exiting.`);
      return;
    }

    console.log(`[${callId}] Found ${files.length} file(s) to process.`);

    if (files.length > MAX_UPLOAD_AT_ONCE) return alert(`En fazla ${MAX_UPLOAD_AT_ONCE} dosya seçebilirsiniz.`);
    if (currentPoolCount() + files.length > MAX_TOTAL_IN_POOL) return alert(`Havuz toplamda ${MAX_TOTAL_IN_POOL} ögeyle sınırlıdır.`);

    checkSafety(files, queue => {
      console.log(`[${callId}] Security check passed. Adding ${queue.length} file(s) to the pool.`);
      if (!queue.length) return alert('Hiçbir dosya güvenlik testini geçemedi.');

      // queue.forEach(f => {
      //   const url = URL.createObjectURL(f);
      //   if (!addToPool(f, url)) URL.revokeObjectURL(url);
      // });

      if (!queue.length) {
        alert('Hiçbir dosya güvenlik testini geçemedi.');
        return;
      }

      // We need to handle file reading asynchronously to create persistent data URLs
      let processedCounter = 0;
      const totalFiles = queue.length;

      // This function will be called after each file is processed
      const onFileProcessed = () => {
        processedCounter++;
        // When all files are done, update the UI
        // if (processedCounter === totalFiles) {
        //   updateDropzoneVisibility();
        //   $fileInp.val(''); // Clear the file input
        //   $(document).trigger('media:uploaded', [queue]);
        //   console.log(`%c[${callId}] handleFiles FINISHED`, 'color: red; font-weight: bold;');
        // }
      };

      // Process each file from the queue
      queue.forEach(f => {
        // To make URLs persistent for storage, we convert IMAGES to Base64 data URLs.
        // Other file types (like videos) will still use temporary blob URLs to avoid memory issues.
        if (f.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = function (e) {
            const dataUrl = e.target.result;
            addToPool(f, dataUrl); // Add the persistent URL to the pool
            onFileProcessed();
          };
          reader.onerror = function () {
            console.error("Failed to read file:", f.name);
            onFileProcessed(); // Mark as processed even on error
          }
          reader.readAsDataURL(f);
        } else {
          // For non-images, use the original method (temporary blob URL)
          const url = URL.createObjectURL(f);
          if (!addToPool(f, url)) {
            URL.revokeObjectURL(url);
          }
          onFileProcessed();
        }
      });
      // Remove these lines (99-102):
      updateDropzoneVisibility();
      $fileInp.val('');
      $(document).trigger('media:uploaded', [queue]);
      console.log(`%c[${callId}] handleFiles FINISHED`, 'color: red; font-weight: bold;');
      
      updateDropzoneVisibility();
      $fileInp.val('');
      $(document).trigger('media:uploaded', [queue]);
      console.log(`%c[${callId}] handleFiles FINISHED`, 'color: red; font-weight: bold;');
    });
  }

  window.handleMediaFiles = handleFiles;
  window.updateDropzoneVisibility = updateDropzoneVisibility;

  /* —————————————————— Event Binding —————————————————— */

  $fileInp.off('change').on('change', handleFiles);

  $(document).on('click', '#addMoreImagesBtn', function () {
    $fileInp.click(); // Programmatically click the hidden file input
  });

  $('#mediaDropzone')
    .off('click')
    .on('click', e => {
      // We can keep the safety checks just in case.
      if ($(e.target).is($fileInp)) { return; }
      if ($(e.target).closest('.thumb-del').length) { return; }
      $fileInp.click();
    });

  $('#mediaDropzone, .mi-right')
    .off('dragenter dragover drop dragleave dragend')
    .on('dragenter dragover', e => { e.preventDefault(); $(e.currentTarget).addClass('dragover'); })
    .on('dragleave dragend drop', e => { e.preventDefault(); $(e.currentTarget).removeClass('dragover'); })
    .on('drop', handleFiles);

  $(document)
    .off('click', '#miPool .thumb-del')
    .on('click', '#miPool .thumb-del', function (e) {
      e.stopPropagation();
      const $wrap = $(this).closest('.thumb-wrap');
      mediaIndex.delete($wrap.find('img').data('fp'));
      $wrap.remove();
      updateDropzoneVisibility();
      $(document).trigger('media:removed');
    });

  $(updateDropzoneVisibility);
})();