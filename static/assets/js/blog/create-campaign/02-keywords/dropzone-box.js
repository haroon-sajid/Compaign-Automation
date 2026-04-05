/*  dropzone-box.js  ©2025 Publisha
 *  Keywords adımındaki CSV / Excel (XLS, XLSX) drop-zone
 *  ----------------------------------------------------
 *  • 5 000 satıra kadar içe aktarır
 *  • Çift kaydı otomatik temizler
 *  • PDF veya desteklenmeyen dosyaları nazikçe reddeder
 *  • Yeni: minimalist “Browse File” düğmesi + tam ortalama + hafif hover/drag efektleri
 *  ---------------------------------------------------- */

$(function () {

  /*═══════════════ DROP-ZONE MARKUP ═══════════════════*/
  (function initMarkup () {
    const $dz   = $('#csvDropzone');
    const $file = $('#csvFile');                           // gizli input

    $dz.empty().append(`
       <div class="dz-inner">
         <span class="entypo-upload dz-ico"></span>
         <p class="dz-txt">Drag &amp; drop file<br><em>or</em></p>
         <button type="button" class="dz-browse-btn">Browse File</button>
       </div>
    `).append($file);

    /* Stiller yalnızca bir kez eklenir */
    if (!document.getElementById('dzStyles')){
      $('head').append(`
        <style id="dzStyles">
          #csvDropzone{
            display:flex;align-items:center;justify-content:center;
            text-align:center;min-height:160px;
            transition:background .15s,border-color .15s;
          }
          #csvDropzone:hover        {background:#fafafa}
          #csvDropzone.dragover     {background:#f4f4f4!important;border-color:#999!important}
          .dz-inner>.dz-ico         {font-size:32px;margin-bottom:6px;color:#777}
          .dz-inner>.dz-txt         {margin:0 0 10px;font-weight:500;color:#666}
          .dz-browse-btn{
            background:#f5f5f5;border:1px solid #c8c8c8;color:#444;
            padding:6px 18px;font-size:14px;border-radius:6px;
            transition:background .15s,color .15s;
          }
          .dz-browse-btn:hover      {background:#e8e8e8;color:#222}
        </style>`);
    }
  })();

  /*═══════════════ AYARLAR ═══════════════*/
  const MAX_ROWS    = 5000;
  const ALLOWED_EXT = ['csv', 'xls', 'xlsx'];
  const CSV_DELIMS  = [',',';','\t','|'];

  /*═══════════════ YARDIMCILAR ═══════════*/
  const clean = s => String(s).replace(/<[^>]*>/g,'').replace(/[\r\n]+/g,' ').trim();
  const firstCol = rows => {
    const out=[];for(const r of rows){
      if(!r)continue;const kw=clean(Array.isArray(r)?r[0]:r);
      if(kw)out.push(kw);if(out.length===MAX_ROWS)break;}
    return out;
  };

  /*═══════════════ CSV / EXCEL PARSER ════*/
  async function parseFile (file){
    const ext=file.name.split('.').pop().toLowerCase();
    if(ext==='csv'){
      return new Promise((res,rej)=>{
        const fr=new FileReader();
        fr.onload=e=>{
          try{
            const txt=e.target.result.replace(/^\uFEFF/,'');
            const delim=CSV_DELIMS.sort((a,b)=>txt.split(a).length-txt.split(b).length).pop();
            const rows=txt.split(/\r?\n/).map(l=>l.split(delim));
            res(firstCol(rows));
          }catch(err){rej(err);}
        };
        fr.onerror=rej;fr.readAsText(file,'utf-8');
      });
    }
    return new Promise((res,rej)=>{
      const fr=new FileReader();
      fr.onload=e=>{
        try{
          const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
          const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,blankrows:false});
          res(firstCol(rows));
        }catch(err){rej(err);}
      };
      fr.onerror=rej;fr.readAsArrayBuffer(file);
    });
  }

  /*═══════════════ ANA İŞLEV ═════════════*/
  async function handle (file){
    const ext=file.name.split('.').pop().toLowerCase();
    if(!ALLOWED_EXT.includes(ext)) return alert('Only CSV, XLS or XLSX files are supported.');

    try{
      const kws=await parseFile(file);
      if(!kws.length) return alert('The file does not contain any valid rows.');

      const $ta=$('#keywordsBulkInput');
      const merged=[...new Set([...$ta.val().split(/\r?\n/).map(s=>s.trim()).filter(Boolean),...kws])];
      $ta.val(merged.join('\n')).trigger('input');
      window.syncKeywords&&window.syncKeywords();

      $('#csvDropzone').html(`<span class="badge badge-success">✔ ${file.name} imported (${kws.length} rows)</span>`);
    }catch(err){
      console.error('[dropzone-box]',err);
      alert('The file could not be read. Please make sure it is not corrupted.');
    }
  }

  /*═══════════════ EVENTLER ══════════════*/
  $('#csvDropzone')
    .off('click dragenter dragover dragleave dragend drop')
    .on('click','.dz-browse-btn',()=>$('#csvFile').click())
    .on('dragenter dragover',e=>{e.preventDefault();$('#csvDropzone').addClass('dragover');})
    .on('dragleave dragend drop',e=>{e.preventDefault();$('#csvDropzone').removeClass('dragover');})
    .on('drop',e=>{
      e.preventDefault();
      const f=e.originalEvent.dataTransfer.files[0];
      f&&handle(f);
    });

  $('#csvFile').off('change').on('change',function(){
    this.files[0]&&handle(this.files[0]);
    this.value='';
  });

});
