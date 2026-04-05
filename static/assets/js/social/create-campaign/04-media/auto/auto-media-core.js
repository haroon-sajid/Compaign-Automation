/* =======================================================================
   auto-media-core.js
   Social Auto-Search + Center-Crop Resize (Pexels / Unsplash / Shutterstock)
   v1.0.0 – 2025-10-06
   ======================================================================= */
;(function (w) {
  'use strict';

  /* ───────────────────────── Config: Platform Boyutları ─────────────────────────
     Her platform için “önerilen” ana varyant + istersen yedek varyantlar.
     primary: temel hedef. variants: ekstra gerekirse üretilir (opsiyonel).
  ------------------------------------------------------------------------------- */
  const PLATFORM_PROFILES = {
    twitter: {
      label: 'X (Twitter)',
      primary: { id: 'tw_16x9', w: 1600, h: 900, note: '16:9 – 1600×900 önerilir' },
      variants: [
        { id: 'tw_1200_675', w: 1200, h: 675, note: '16:9 – 1200×675 alternatif' },
        { id: 'tw_square',   w: 1080, h: 1080, note: 'Kare – 1080×1080' }
      ]
    },
    linkedin: {
      label: 'LinkedIn',
      primary: { id: 'li_191_1', w: 1200, h: 627, note: '1.91:1 – 1200×627 (Link/Görsel)' },
      variants: [
        { id: 'li_square', w: 1080, h: 1080, note: 'Kare – 1080×1080' }
      ]
    },
    instagram: {
      label: 'Instagram',
      primary: { id: 'ig_portrait', w: 1080, h: 1350, note: 'Dikey – 1080×1350 (önerilen)' },
      variants: [
        { id: 'ig_square',   w: 1080, h: 1080, note: 'Kare – 1080×1080' },
        { id: 'ig_land',     w: 1080, h: 566,  note: 'Yatay – 1080×566' }
      ]
    },
    threads: {
      label: 'Threads',
      primary: { id: 'th_portrait', w: 1080, h: 1350, note: 'Dikey – 1080×1350' },
      variants: [
        { id: 'th_square', w: 1080, h: 1080, note: 'Kare – 1080×1080' }
      ]
    },
    facebook: {
      label: 'Facebook',
      primary: { id: 'fb_link', w: 1200, h: 630, note: '1.91:1 – 1200×630' },
      variants: [
        { id: 'fb_square', w: 1080, h: 1080, note: 'Kare – 1080×1080' }
      ]
    }
  };

  /* ────────────────────────── Yardımcılar / Utils ────────────────────────── */
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  function dataUrlToBlob(dataUrl) {
    const binary = atob(dataUrl.split(',')[1]);
    const mime = dataUrl.substring(dataUrl.indexOf(':') + 1, dataUrl.indexOf(';'));
    const len = binary.length;
    const array = new Uint8Array(len);
    for (let i = 0; i < len; i++) array[i] = binary.charCodeAt(i);
    return new Blob([array], { type: mime });
  }

  async function imageFromUrl(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // CORS izinliyse canvas’a çizilebilir
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error('Image load error: ' + src));
      img.src = src;
    });
  }

  /* Center-cover + zoom (merkezden kırp, hedefe sığdır, min zoom=1.0) */
  function drawCoverZoom(image, targetW, targetH, zoom = 1.0) {
    const iw = image.naturalWidth || image.width;
    const ih = image.naturalHeight || image.height;
    const cropW = Math.max(1, iw / Math.max(1, zoom));
    const cropH = Math.max(1, ih / Math.max(1, zoom));

    // Kaynak dikdörtgeni merkeze oturt
    const sx = Math.max(0, (iw - cropW) / 2);
    const sy = Math.max(0, (ih - cropH) / 2);

    // Hedefe “cover” sığdırma: kaynak crop’u hedefe oranlayarak büyüt
    const scale = Math.max(targetW / cropW, targetH / cropH);
    const drawW = cropW * scale;
    const drawH = cropH * scale;
    const dx = (targetW - drawW) / 2;
    const dy = (targetH - drawH) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';

    // Önce crop’lu alt-canvas’a al (daha temiz kalite)
    const tmp = document.createElement('canvas');
    tmp.width = cropW;
    tmp.height = cropH;
    const tctx = tmp.getContext('2d');
    tctx.drawImage(image, sx, sy, cropW, cropH, 0, 0, cropW, cropH);

    ctx.drawImage(tmp, 0, 0, cropW, cropH, dx, dy, drawW, drawH);
    return canvas;
  }

  /* Havuz entegrasyonu (varsa) */
  async function addCanvasToPool(canvas, filename = 'image.jpg', type = 'image/jpeg', quality = 0.92) {
    const dataUrl = canvas.toDataURL(type, quality);
    const blob = dataUrlToBlob(dataUrl);
    const url = URL.createObjectURL(blob);

    // match-images entegrasyonu (varsa)
    if (typeof w.registerMediaToPool === 'function') {
      try {
        const file = new File([blob], filename, { type });
        const ok = w.registerMediaToPool(file, url, 'all');
        if (!ok) URL.revokeObjectURL(url);
      } catch (e) {
        // Bazı ortamlarda File ctor olmayabilir
        w.registerMediaToPool(null, url, 'all');
      }
    }

    return { blob, url, dataUrl };
  }

  /* ─────────────────────── Sağlayıcı (Provider) Adaptörleri ─────────────────────── */
  async function fetchPexels(query, perPage = 12) {
    if (!w.PEXELS_KEY) throw new Error('PEXELS_KEY missing');
    const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}`, {
      headers: { Authorization: w.PEXELS_KEY }
    });
    if (!res.ok) throw new Error('Pexels HTTP ' + res.status);
    const json = await res.json();
    return (json.photos || []).map(p => ({
      id: 'px_' + p.id,
      src: p.src?.large2x || p.src?.large || p.src?.original || '',
      w: p.width, h: p.height,
      author: p.photographer || '',
      author_url: p.photographer_url || '',
      license: 'Pexels License'
    })).filter(i => i.src);
  }

  async function fetchUnsplash(query, perPage = 12) {
    if (!w.UNSPLASH_KEY) throw new Error('UNSPLASH_KEY missing');
    const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}`, {
      headers: { Authorization: w.UNSPLASH_KEY } // "Client-ID XXXXX"
    });
    if (!res.ok) throw new Error('Unsplash HTTP ' + res.status);
    const json = await res.json();
    return (json.results || []).map(p => ({
      id: 'us_' + p.id,
      src: p.urls?.regular || p.urls?.full || p.urls?.raw || '',
      w: p.width, h: p.height,
      author: p.user?.name || '',
      author_url: p.user?.links?.html || '',
      license: 'Unsplash License'
    })).filter(i => i.src);
  }

  async function fetchShutterstock(query, perPage = 12) {
    if (!w.SHUTTERSTOCK_KEY) throw new Error('SHUTTERSTOCK_KEY missing');
    const url = `https://api.shutterstock.com/v2/images/search?query=${encodeURIComponent(query)}&per_page=${perPage}&sort=popular`;
    const res = await fetch(url, { headers: { Authorization: w.SHUTTERSTOCK_KEY } });
    if (!res.ok) throw new Error('Shutterstock HTTP ' + res.status);
    const json = await res.json();
    return (json.data || []).map(img => ({
      id: 'sh_' + img.id,
      // Önizleme için en büyük thumb/preview; yayın zamanı orijinal indirmeyi düşünebilirsin
      src: (img.assets?.huge_thumb?.url || img.assets?.preview?.url || ''),
      w: img.width || img.assets?.preview?.width || 0,
      h: img.height || img.assets?.preview?.height || 0,
      author: img.contributor?.id || '',
      author_url: '',
      license: 'Shutterstock – licensed'
    })).filter(i => i.src);
  }

  async function searchProvider(provider, query, perPage) {
    provider = String(provider || '').toLowerCase();
    if (provider === 'pexels')       return fetchPexels(query, perPage);
    if (provider === 'unsplash')     return fetchUnsplash(query, perPage);
    if (provider === 'shutterstock') return fetchShutterstock(query, perPage);
    throw new Error('Unknown provider: ' + provider);
  }

  /* ─────────────────────────── Çekirdek İş Akışı ───────────────────────────
     AutoMedia.run({ provider, keywords, platforms, pick, zoom, quality, addToPool })
     - keywords: string | string[]
     - platforms: ['twitter','linkedin','instagram', ...]
     - pick: her anahtar kelime için kaç görsel işlenecek (varsayılan 1)
     - zoom: merkezden kırpma katsayısı (1.0 = kırpma yok, 1.1 = %10 zoom)
     - quality: JPEG kalite (0..1)
     - addToPool: true ise işlenen görseller match-images havuzuna eklenir
  --------------------------------------------------------------------------- */
  async function run(options = {}) {
    const {
      provider = 'pexels',
      keywords = [],
      platforms = ['twitter', 'linkedin'],
      pick = 1,
      perPage = 20,
      zoom = 1.06,
      quality = 0.92,
      addToPool = true,
      generateVariants = false // true ise platformdaki tüm variants da üretilir
    } = options;

    const kwList = Array.isArray(keywords) ? keywords : String(keywords || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!kwList.length) throw new Error('No keywords provided');
    if (!platforms || !platforms.length) throw new Error('No platforms provided');

    const out = {
      startedAt: new Date().toISOString(),
      provider,
      items: [] // { keyword, source, meta, outputs:[{platform,id,w,h,blob/url/...}] }
    };

    for (const kw of kwList) {
      // 1) Görsel ara
      const results = await searchProvider(provider, kw, perPage);
      if (!results.length) {
        out.items.push({ keyword: kw, error: 'No results' });
        continue;
      }

      // 2) İlk “pick” adedi kadar görsel seç (daha gelişmiş skor algoritması eklenebilir)
      const picks = results.slice(0, Math.max(1, pick));

      for (const srcItem of picks) {
        let img;
        try { img = await imageFromUrl(srcItem.src); }
        catch (e) {
          out.items.push({ keyword: kw, error: 'image load failed', src: srcItem.src });
          continue;
        }

        const outputs = [];

        for (const pf of platforms) {
          const profile = PLATFORM_PROFILES[pf];
          if (!profile) continue;

          const primary = profile.primary;
          const allTargets = [primary].concat(generateVariants ? (profile.variants || []) : []);

          for (const tgt of allTargets) {
            const canvas = drawCoverZoom(img, tgt.w, tgt.h, zoom);
            const saveName =
              `${kw.replace(/\s+/g, '_')}_${pf}_${tgt.id}.jpg`.toLowerCase();

            const saved = await addCanvasToPool(canvas, saveName, 'image/jpeg', quality)
              .catch(() => ({ blob: dataUrlToBlob(canvas.toDataURL('image/jpeg', quality)), url: canvas.toDataURL('image/jpeg', quality) }));

            outputs.push({
              platform: pf,
              variant: tgt.id,
              w: tgt.w,
              h: tgt.h,
              note: tgt.note || '',
              url: saved.url,
              filename: saveName
            });
          }
        }

        out.items.push({
          keyword: kw,
          source: { id: srcItem.id, url: srcItem.src },
          meta: {
            author: srcItem.author || '',
            author_url: srcItem.author_url || '',
            license: srcItem.license || ''
          },
          outputs
        });

        // Çok hızlı istek olmaması için minik nefes
        await delay(80);
      }
    }

    out.completedAt = new Date().toISOString();
    return out;
  }

  /* ───────────────────────────── Zamanlama Yardımcısı ─────────────────────────────
     enqueue({ runAt: Date|string|number|{ms:...}, ...runOptions })
     - Gerçek cron/scheduler senin tarafta (backend / Service Worker / etc.)
     - Bu helper sadece “ne çalıştırılacak” tanımını normalize eder.
  ------------------------------------------------------------------------------- */
  function enqueue(payload = {}) {
    const { runAt, ...runOptions } = payload;
    let when = null;
    if (typeof runAt === 'object' && runAt && typeof runAt.ms === 'number') {
      when = Date.now() + Math.max(0, runAt.ms);
    } else if (typeof runAt === 'number') {
      when = runAt; // epoch ms
    } else if (typeof runAt === 'string' || runAt instanceof Date) {
      when = new Date(runAt).getTime();
    }
    return {
      kind: 'AutoMediaJob',
      when,
      runOptions
      // Bunu kendi queue sistemine push et: örn. localStorage / IndexedDB / backend api
    };
  }

  /* ────────────────────────────── UI Yardımcıları (opsiyonel) ─────────────────────
     Seçili platformlara göre kullanıcıya öneri metni göstermek istersen:
  ------------------------------------------------------------------------------- */
  function describeTargets(platforms = []) {
    const lines = [];
    platforms.forEach(p => {
      const pr = PLATFORM_PROFILES[p];
      if (!pr) return;
      const base = `${pr.label}: ${pr.primary.w}×${pr.primary.h} – ${pr.primary.note || ''}`;
      lines.push(base);
    });
    return lines.join('\n');
  }

  /* ─────────────────────────── Global Export ─────────────────────────── */
  w.AutoMedia = {
    run,
    enqueue,
    describeTargets,
    PLATFORM_PROFILES
  };
})(window);
