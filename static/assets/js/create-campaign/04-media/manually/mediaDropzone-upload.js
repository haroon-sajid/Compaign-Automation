/* ------------------------------------------------------------------
   mediaDropzone-upload.js
   – Yalnızca “dosya seç / sürükle-bırak / güvenlik kontrolleri /
      havuza thumbnail ekleme / dropzone görünürlüğü” işlevlerini içerir
   – Match-Images eşleştirme, keyword senkronu vb. bu dosyada bulunmaz
   ------------------------------------------------------------------*/
;(() => {
  'use strict';

  /* —————————————————— Ayarlar —————————————————— */
  const MAX_BYTES          = 25 * 1024 * 1024;   // 25 MB
  const MAX_SIDE           = 8_000;              // 8 000 px
  const MAX_UPLOAD_AT_ONCE = 500;                // tek batch
  const MAX_TOTAL_IN_POOL  = 500;                // havuz tavanı

  const ALLOWED_TYPES = [
    'image/jpeg','image/pjpeg','image/jpg',
    'image/png','image/x-png',
    'image/webp','image/avif','image/gif',
    'video/mp4'
  ];

  /* —————————————————— Elemanlar —————————————————— */
  const $DZ        = $('#mediaDropzone');
  const $browse    = $('#mediaBrowseBtn');
  const $fileInp   = $('#mediaFileInput');
  const $pool      = $('#miPool');
  const $gallery   = $('#mediaGallery');
  const $uploadBox = $('#mediaUploadBox');

  /* —————————————————— Yardımcılar —————————————————— */
  const fpOf = f => [
    f.name.replace(/\.[^.]+$/,'').toLowerCase(),
    f.size,
    f.lastModified
  ].join('|');

  const mediaIndex = new Set();             // duplicate engeli

  const currentPoolCount = () =>
    $pool.find('.thumb-wrap').length || $gallery.find('img').length;

  /* Thumbnail ekle + duplicate kontrolü */
  function addToPool (file, url) {
    const fp = fpOf(file);
    if (mediaIndex.has(fp)) return false;

    mediaIndex.add(fp);
    $pool.append(`
      <div class="thumb-wrap">
        <img src="${url}" draggable="false" data-fp="${fp}">
        <button class="thumb-del" type="button">&times;</button>
      </div>
    `);
    return true;
  }

  /* Dropzone’u (boş / dolu) gizle-göster */
  function updateDropzoneVisibility () {
    $DZ.toggle(!$pool.find('.thumb-wrap').length);
  }

  /* Güvenlik filtresi */
  function checkSafety (files, cb) {
    const safe = [];
    let pending = files.length;
    const done = () => (--pending === 0) && cb(safe);

    files.forEach(f => {
      /* Boyut */
      if (f.size > MAX_BYTES) return done();

      /* MIME */
      if (f.type && !ALLOWED_TYPES.includes(f.type)) return done();

      /* Görüntü değilse piksel kontrolü gerekmez */
      if (!f.type.startsWith('image/')) { safe.push(f); return done(); }

      /* Piksel kontrolü */
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        if (img.width <= MAX_SIDE && img.height <= MAX_SIDE) safe.push(f);
        URL.revokeObjectURL(url);
        done();
      };
      img.onerror = () => { URL.revokeObjectURL(url); done(); };
      img.src = url;
    });
  }

  /* Ana karşılayıcı */
  function handleFiles (e) {
    /* Safari boş FileList fix’i */
    if (e.originalEvent && e.originalEvent.dataTransfer &&
        !e.originalEvent.dataTransfer.files.length) {
      e.originalEvent.dataTransfer.files = e.target.files;
    }

    const files = Array.from(
      e.target.files || e.originalEvent.dataTransfer.files
    );
    if (!files.length) return;

    /* Havuz / batch limitleri */
    if (files.length > MAX_UPLOAD_AT_ONCE)
      return alert(`En fazla ${MAX_UPLOAD_AT_ONCE} dosya seçebilirsiniz.`);
    if (currentPoolCount() + files.length > MAX_TOTAL_IN_POOL)
      return alert(`Havuz toplamda ${MAX_TOTAL_IN_POOL} ögeyle sınırlıdır.`);

    /* Güvenlik */
    checkSafety(files, queue => {
      if (!queue.length) return alert('Hiçbir dosya güvenlik testini geçemedi.');

      queue.forEach(f => {
        const url = URL.createObjectURL(f);
        if (!addToPool(f, url)) URL.revokeObjectURL(url);   // duplicate
        /* ▶ Sunucuya gerçek upload gerekiyorsa burada yapabilirsiniz */
      });

      updateDropzoneVisibility();
      $fileInp.val('');                // aynı dosyayı tekrar seçebilmek için
      $(document).trigger('media:uploaded', [queue]); // diğer modüllere haber ver
    });
  }

  /* —————————————————— PUBLIC ALIASES ——————————————————
     Diğer modüller hâlâ eski isimleri kullanıyorsa bozulma olmasın  */
  window.handleMediaFiles         = handleFiles;
  window.updateDropzoneVisibility = updateDropzoneVisibility;

  /* —————————————————— Event Binding —————————————————— */
  /* Dropzone */
  $DZ
    .on('click', () => $fileInp.click())
    .on('dragenter dragover', e => { e.preventDefault(); $DZ.addClass('dragover'); })
    .on('dragleave dragend drop', e => { e.preventDefault(); $DZ.removeClass('dragover'); })
    .on('drop', handleFiles);

  /* Browse… butonu & native input */
  $browse.on('click', e => { e.preventDefault(); $fileInp.click(); });
  $fileInp.on('change', handleFiles);

  /* Havuz drag-drop (miPool, mediaGallery, sağ panel) */
  $('#mediaGallery, #miPool, .mi-right')
    .on('click', () => $fileInp.click())
    .on('dragenter dragover', e => { e.preventDefault(); $(e.currentTarget).addClass('dragover'); })
    .on('dragleave dragend drop', e => { e.preventDefault(); $(e.currentTarget).removeClass('dragover'); })
    .on('drop', handleFiles);

  /* Havuzdan silme */
  $(document).on('click', '#miPool .thumb-del', function () {
    const $wrap = $(this).closest('.thumb-wrap');
    mediaIndex.delete($wrap.find('img').data('fp'));
    $wrap.remove();
    updateDropzoneVisibility();
    $(document).trigger('media:removed');
  });

  /* İlk yüklemede durum kontrolü */
  $(updateDropzoneVisibility);
})();
