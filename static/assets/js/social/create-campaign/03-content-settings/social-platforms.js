/* social-platforms.js · fixed v1.5.2 (2025-10-06)
 * =========================================================
 * • Content Settings > Social Platforms
 * • Platform başına: Character Limit + Tone of Voice (tek-seçim dropdown)
 * • Approximate Word Count bloğu kaldırıldı
 * • Olaylar:
 *     platforms:changed, platforms:limits-changed, platforms:tones-changed
 * • Public API:
 *     socialPlatforms.selected(), socialPlatforms.getLimits(),
 *     socialPlatforms.getTones(), socialPlatforms.refresh()
 * ========================================================= */
(function ($, window, document) {
  'use strict';

  /* ---------- Mount ---------- */
  function ensureMount() {
    var $mount = $('#socialPlatformsMount');
    if ($mount.length) return $mount;
    var $panel = $('#socialPlatformsPanel');
    if ($panel.length) return $('<div id="socialPlatformsMount"></div>').appendTo($panel);
    return $('<div id="socialPlatformsMount"></div>').appendTo('body');
  }
  var $mount = ensureMount();

  /* ---------- Config ---------- */
  var PLATFORMS = [
    { id:'linkedin',  label:'LinkedIn',     icon:'entypo-linkedin',  max:3000 },
    { id:'x',         label:'X (Twitter)',  icon:'entypo-twitter',   max:280 },
    { id:'facebook',  label:'Facebook',     icon:'entypo-facebook',  max:63206 },
    { id:'instagram', label:'Instagram',    icon:'entypo-instagram', max:2200 },
    { id:'threads',   label:'Threads',      icon:'',                 max:500 }
  ];
  var PLACEHOLDER = 'Enter the number of characters';

  var isConnected = window.isPlatformConnected || function(){ return false; };
  var doConnect   = window.connectPlatform     || function(){ return new Promise(function(r){ setTimeout(function(){ r(true); }, 800); }); };

  // Tone seçenekleri (tek seçim)
  var TONE_OPTIONS = [
    { val:'formal',       text:'Formal' },
    { val:'funny',        text:'Funny' },
    { val:'friendly',     text:'Friendly' },
    { val:'professional', text:'Professional' },
    { val:'casual',       text:'Casual' },
    { val:'playful',      text:'Playful' },
    { val:'empathetic',   text:'Empathetic' },
    { val:'assertive',    text:'Assertive' },
    { val:'informative',  text:'Informative' },
    { val:'persuasive',   text:'Persuasive' },
    { val:'creative',     text:'Creative' },
    { val:'humorous',     text:'Humorous' },
    { val:'neutral',      text:'Neutral / Objective' }
  ];

  /* ---------- CSS ---------- */
  (function injectOnce(){
    if (document.getElementById('sp-inline-css')) return;
    var css = `
      .sp-formlabel{display:block;font-weight:600;margin-bottom:6px;color:#2b2541;font-size:14px}
      .sp-sub{color:#6b6f76;font-size:12px;margin-left:8px;font-weight:600}

      .sp-card{border:1px solid #eee;border-radius:14px;padding:14px;background:#fff;margin-bottom:16px}
      .sp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}

      .sp-chip{position:relative;display:flex;align-items:center;gap:10px;border:1px solid #E7E5F3;border-radius:12px;padding:10px 12px;background:#fff;cursor:pointer;
               transition:background .15s,border-color .15s,box-shadow .15s}
      .sp-chip:hover{background:#FAFAFE;border-color:#D9D4F4}
      .sp-chip input.sp-check{position:absolute;inset:0;opacity:0;cursor:pointer}
      .sp-icon{width:28px;height:28px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;background:#F1EEFF;color:#6c4ad0}
      .sp-icon i{font-size:18px;line-height:1}
      .sp-label{font-weight:600;color:#2b2541}
      .sp-state{margin-left:auto;display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:4px 8px;border-radius:999px;background:#f1f5f9;color:#475569}
      .sp-state i{font-size:14px}
      .sp-chip.is-selected{border-color:#B9A6FF;background:#F4F0FF;box-shadow:0 0 0 3px rgba(108,74,208,.10)}
      .sp-chip.is-connected .sp-state{background:#E9F8EF;color:#10783b}
      .sp-chip.is-notconn .sp-state{background:#FDECEC;color:#B42318}

      .sp-item{display:flex;flex-direction:column}
      .sp-limit-wrap{width:100%;display:none;margin-top:8px}
      .sp-block{border:1px solid #e4e4ee;border-radius:12px;padding:10px}
      .sp-row + .sp-row{margin-top:10px}

      .sp-limit{width:100%;border:1px solid #e4e4ee;border-radius:10px;padding:8px 10px;font-size:13px}
      .sp-limit:focus{outline:0;border-color:#b9a6ff;box-shadow:0 0 0 3px rgba(108,74,208,.12)}
      .sp-limit.is-invalid{border-color:#e23b3b;box-shadow:0 0 0 3px rgba(226,59,59,.12)}

      .sp-tone-select{width:100%}
      .select2-container--default .select2-selection--single{
         border:1px solid #e4e4ee;border-radius:10px;min-height:42px;height:42px;
         display:flex;align-items:center;padding:4px 10px;
      }
      .select2-container--default .select2-selection--single .select2-selection__rendered{line-height:30px}
      .select2-container--default .select2-selection--single .select2-selection__arrow{height:40px;right:10px}

      /* FIX: Dropdown bazı temalarda görünmüyordu (z-index) */
      .select2-container{z-index:1060}
      .select2-dropdown{z-index:1060}

      .sp-modal .modal-header{border:0;padding-bottom:0}
      .sp-modal .modal-footer{border:0;padding-top:0}
      .sp-modal .lead{color:#5a5f66}
      .sp-platform-pill{display:inline-flex;align-items:center;gap:8px;font-weight:700;padding:6px 10px;border-radius:999px;background:#f1f0ff;color:#4b3ea3}
      .sp-platform-pill i{font-size:16px}
    `;
    var s = document.createElement('style'); s.id='sp-inline-css'; s.textContent = css; document.head.appendChild(s);
  })();

  /* ---------- Modals ---------- */
  function ensureConnectModal(){
    var id='spConnectModal'; if($('#'+id).length) return $('#'+id);
    var html=`
      <div id="spConnectModal" class="modal fade sp-modal" tabindex="-1" role="dialog" aria-hidden="true">
        <div class="modal-dialog" style="max-width:560px;">
          <div class="modal-content">
            <div class="modal-header"><h4 class="modal-title">Connect account</h4></div>
            <div class="modal-body">
              <p class="lead">This account is not connected to Publisha yet. Please connect and authorize to continue.</p>
              <p class="text-muted" style="margin-bottom:.5rem;">• We’ll redirect you to the platform to grant permissions.<br>• You can revoke access anytime from Settings.</p>
              <div id="spModalSelected" class="sp-platform-pill" style="margin-top:10px;"><i class="entypo-shareable"></i> <span>Platform</span></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
              <button type="button" id="spConnectBtn" class="btn btn-purple">Connect & Authorize</button>
            </div>
          </div>
        </div>
      </div>`;
    $('body').append(html); return $('#'+id);
  }
  function ensureWarnModal(){
    var id='spWarnModal'; if($('#'+id).length) return $('#'+id);
    var html=`
      <div id="spWarnModal" class="modal fade sp-modal" tabindex="-1" role="dialog" aria-hidden="true">
        <div class="modal-dialog" style="max-width:520px;">
          <div class="modal-content">
            <div class="modal-header"><h4 class="modal-title">Character limit exceeded</h4></div>
            <div class="modal-body">
              <p class="lead" id="spWarnText">Your text exceeds the maximum characters allowed for this platform.</p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-purple" data-dismiss="modal">OK</button>
            </div>
          </div>
        </div>
      </div>`;
    $('body').append(html); return $('#'+id);
  }
  var $connectModal = ensureConnectModal(), pendingPlatform=null;
  var $warnModal    = ensureWarnModal();

  /* ---------- Render ---------- */
  function renderCard(){
    var html = [
      '<div class="sp-card" id="spCard">',
        '<label class="sp-formlabel">Social Platforms</label>',
        '<span class="sp-sub">Choose where to publish</span>',
        '<div class="sp-grid">'
    ];
    PLATFORMS.forEach(function(p){
      var iconBox = p.icon ? '<span class="sp-icon"><i class="'+p.icon+'"></i></span>' : '<span class="sp-icon" style="font-weight:800">T</span>';
      html.push(
        '<div class="sp-item" data-id="'+p.id+'" data-max="'+p.max+'">',
          '<label class="sp-chip" data-id="'+p.id+'">',
            '<input type="checkbox" class="sp-check" value="'+p.id+'">',
            iconBox,
            '<span class="sp-label">'+p.label+'</span>',
            '<span class="sp-state"><i class="entypo-cancel"></i><span class="sp-state-text">Not</span></span>',
          '</label>',

          // İç blok: Character Limit + Tone of Voice dropdown (Approx Word Count kaldırıldı)
          '<div class="sp-limit-wrap">',
            '<div class="sp-block">',
              '<div class="sp-row">',
                '<label class="sp-formlabel" style="margin-bottom:4px;">Character Limit</label>',
                '<input type="number" min="1" class="sp-limit" placeholder="'+PLACEHOLDER+'" aria-label="'+p.label+' character limit">',
              '</div>',
              '<div class="sp-row">',
                '<label class="sp-formlabel" style="margin-bottom:4px;">Tone of Voice</label>',
                // FIX: id/name ile erişilebilirlik + event targeting daha stabil
                '<select class="sp-tone-select" name="tone-'+p.id+'" id="tone-'+p.id+'" data-placeholder="Please select…"></select>',
              '</div>',
            '</div>',
          '</div>',
        '</div>'
      );
    });
    html.push('</div></div>');
    $mount.html(html.join(''));
  }
  renderCard();

  /* ---------- Tone init (görünürken, sağlam) ---------- */
  function populateToneOptions($sel){
    $sel.empty();
    $sel.append('<option></option>'); // placeholder için
    TONE_OPTIONS.forEach(function(opt){
      $sel.append('<option value="'+opt.val+'">'+opt.text+'</option>');
    });
  }

  function initToneSelect($item){
    var $sel = $item.find('.sp-tone-select');

    // Seçenekler yoksa doldur
    if(!$sel.children('option').length){
      populateToneOptions($sel);
    }

    // Daha önce select2 takılıysa temizle
    if ($.fn.select2 && $sel.hasClass('select2-hidden-accessible')) {
      try { $sel.select2('destroy'); } catch(e){}
    }

    // YENİ: Bazı temalarda dropdown görünmeme sorununa karşı parent'ı item yaptık ve z-index ekledik
    if ($.fn.select2){
      $sel.select2({
        placeholder: $sel.data('placeholder') || 'Please select…',
        allowClear: true,
        width: '100%',
        dropdownParent: $item // önce body idi
      });
    }

    $sel.data('spToneInit', true);
  }

  // YENİ: Açılır menü tıklanınca (ilk kez) tembel-init — select2 asset'leri geç yüklenirse de çalışır
  $mount.on('mousedown focus', '.sp-tone-select', function(){
    var $sel = $(this);
    if(!$sel.data('spToneInit')){
      initToneSelect($sel.closest('.sp-item'));
    }
  });

  /* ---------- State Stores ---------- */
  var limitsStore = {}; // { platformId: number }
  var tonesStore  = {}; // { platformId: string|null }

  /* ---------- Connection state ---------- */
  function applyConnState($chip, connected){
    $chip.toggleClass('is-connected', !!connected)
         .toggleClass('is-notconn', !connected);
    var $st = $chip.find('.sp-state');
    $st.find('i').attr('class', connected ? 'entypo-check' : 'entypo-cancel');
    $st.find('.sp-state-text').text(connected ? 'OK' : 'Not');
  }
  function refreshConnections(){
    var tasks=[];
    $('#spCard .sp-chip').each(function(){
      var $chip=$(this), id=$chip.data('id');
      var res=isConnected(id);
      if(res && typeof res.then==='function'){
        tasks.push(res.then(function(ok){ applyConnState($chip, !!ok); }));
      }else{
        applyConnState($chip, !!res);
      }
    });
    return Promise.all(tasks);
  }
  refreshConnections();

  /* ---------- Helpers ---------- */
  function emitChange(){
    var selected = $('#spCard .sp-check:checked').map(function(){return this.value;}).get();
    $(document).trigger('platforms:changed', [selected]);
    $(document).trigger('platforms:limits-changed', [$.extend({}, limitsStore), selected]);
    $(document).trigger('platforms:tones-changed',  [$.extend({}, tonesStore), selected]);
  }
  function showLimitWarning(label, max){
    $('#spWarnText').text(label+' allows up to '+max.toLocaleString()+' characters.');
    $warnModal.modal('show');
  }
  function validateAndSaveLimit($item){
    var id  = $item.data('id');
    var max = parseInt($item.data('max'),10);
    var $inp= $item.find('.sp-limit');
    var val = parseInt($inp.val(),10);

    $inp.removeClass('is-invalid');
    if (!isNaN(val) && val>0){
      limitsStore[id] = val;
      if (max && val > max){
        $inp.addClass('is-invalid');
        var label = $item.find('.sp-label').text().trim();
        showLimitWarning(label, max);
      }
    } else {
      delete limitsStore[id];
    }
  }

  /* ---------- Interactions ---------- */
  // select/unselect
  $mount.on('change','.sp-check', function(e){
    var $check=$(this), $item=$check.closest('.sp-item'), $chip=$item.find('.sp-chip'), id=$chip.data('id');
    var selected=$check.is(':checked');

    $chip.toggleClass('is-selected', selected);
    $item.find('.sp-limit-wrap').toggle(selected);

    var connected=$chip.hasClass('is-connected');
    if(selected && !connected){
      e.preventDefault();
      $check.prop('checked', false);
      $chip.removeClass('is-selected');
      $item.find('.sp-limit-wrap').hide();

      var p=PLATFORMS.find(function(x){return x.id===id;});
      pendingPlatform=id;
      $('#spModalSelected i').attr('class', p.icon||'entypo-shareable');
      $('#spModalSelected span').text(p.label);
      $connectModal.modal('show');
      return;
    }

    if(selected) {
      initToneSelect($item);                 // dropdown'ı görünürken ve sağlam şekilde başlat
      validateAndSaveLimit($item);
      if(!(id in tonesStore)) tonesStore[id]=null; // başlangıçta boş
    } else {
      delete limitsStore[id];
      delete tonesStore[id];
      // YENİ: select2'yi de temizle
      var $sel = $item.find('.sp-tone-select');
      if ($.fn.select2 && $sel.hasClass('select2-hidden-accessible')) {
        try { $sel.select2('destroy'); } catch(e){}
      }
      $sel.removeData('spToneInit');
    }
    emitChange();
  });

  // limit input
  $mount.on('input blur','.sp-limit', function(){
    var $item=$(this).closest('.sp-item');
    validateAndSaveLimit($item);
    emitChange();
  });

  // tone select
  $mount.on('change', '.sp-tone-select', function(){
    var $item = $(this).closest('.sp-item');
    var id    = $item.data('id');
    var val   = $(this).val() || null;   // tek seçim
    tonesStore[id] = val;
    emitChange();
  });

  // Connect modal
  $('#spConnectBtn').on('click', function(){
    if(!pendingPlatform) return;
    var id=pendingPlatform, $btn=$(this).prop('disabled',true).text('Connecting…');
    Promise.resolve(doConnect(id)).then(function(ok){
      $btn.prop('disabled',false).text('Connect & Authorize');
      if(ok){
        var $chip=$('#spCard .sp-chip[data-id="'+id+'"]');
        applyConnState($chip, true);
        $chip.addClass('is-selected').find('.sp-check').prop('checked',true);
        var $item=$chip.closest('.sp-item');
        $item.find('.sp-limit-wrap').show().find('.sp-limit').focus();

        initToneSelect($item); // bağlantı sonrası da başlat

        $(document).trigger('platform:connected',[id]);
        if(!(id in tonesStore)) tonesStore[id]=null;
        emitChange();
        $connectModal.modal('hide');
      }else{
        alert('Could not connect. Please try again.');
      }
    }).catch(function(){
      $btn.prop('disabled',false).text('Connect & Authorize');
      alert('Connection failed.');
    });
  });
  $connectModal.on('hidden.bs.modal', function(){ pendingPlatform=null; });

  /* ---------- Public API ---------- */
  window.socialPlatforms = {
    selected : function(){ return $('#spCard .sp-check:checked').map(function(){return this.value;}).get(); },
    getLimits: function(){ return $.extend({}, limitsStore); },
    getTones : function(){ return $.extend({}, tonesStore); }, // { platformId: toneVal|null }
    refresh  : refreshConnections
  };

})(jQuery, window, document);
