/* create-campaign.tags-category-seoplugin.js v2.6.5 (28.07.2025)
- Tags, Category ve SEO Plugin tek panelde responsive grid
- KW mini preview (kwTable/kwData'dan max 3 chip + “+n” etiketi)
- DataTables yoksa güvenli fallback
- Tema uyumu: kırmızı/danger sınıfları mor palete (#6C3082) çekildi
- Dinamik eklenen elemanlara da mor uygulatmak için MutationObserver eklendi
- ÜST "Preview" alanı tamamen kaldırıldı (sadece Keywords Preview kaldı)
- FIX: Category & SEO Plugin seçimleri Summary Card’a anlık ve güvenli yansır
- FIX: SEO değerleri mükerrer olmayacak, Category değişince anında güncellenecek
- v2.6.4:
* patchRefreshSummary(): refreshSummary bulunduğu an wrap’lenip her çağrı sonrası rewriteContentSettingsLine() tetiklenir
* Select değişimlerinde hem gizli input güncellenir hem de safeRefreshSummary() direkt çağrılır
* rewriteContentSettingsLine(): “Content Settings:” yoksa ekler; varsa parse edip Category/SEO’yu tekil/güncel yazar
- v2.6.5:
* “SEO:” etiketi “SEO Plugin:” olarak değiştirildi.
* Temp satırından (örn. “Temp: 1.00”) sonra gelen her şey regex ile siliniyor.
* Content Settings satırı yeniden inşa edilirken Category/SEO Plugin tekrarları kesin olarak temizleniyor.
*/
(function () {
'use strict';

/* ---------- EARLY GUARDS ---------- */
if (typeof window === 'undefined') return;
var $ = window.jQuery;
if (!$) {
document.addEventListener('DOMContentLoaded', function () {
if (window.jQuery) init(window.jQuery);
});
return;
}
init($);

/* =============================================================== */
function init($) {

/* ---------- CONFIG ---------- */
const CATEGORY_OPTIONS = [
{ value: 'economy', label: 'Economy' },
{ value: 'news', label: 'News' }
];
const SEO_PLUGIN_OPTIONS = [
{ value: 'rankmath', label: 'Rank Math' },
{ value: 'yoast', label: 'Yoast SEO' },
{ value: 'smartcrawl', label: 'Smart Crawl' }
];

const DEFAULT_TAG_COUNT = 8;
const KW_PREVIEW_MAX = 3;

/* Global state */
window.tagConfig = window.tagConfig || {
mode: 'auto',
count: DEFAULT_TAG_COUNT,
sources: ['keywords'],
manualList: [],
include: '',
globalTags: [],
allowOverride: true
};

/* ---------- HELPERS ---------- */
function el(tag, attrs = {}, html = '') {
const e = document.createElement(tag);
Object.keys(attrs).forEach(k => e.setAttribute(k, attrs[k]));
if (html) e.innerHTML = html;
return e;
}
const ucFirst = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

/* Tema renkleri */
const PURPLE = '#6C3082';
const PURPLE_LIGHT = '#ece9f3';
const PURPLE_DARK = '#4b3f58';
const GREY_BORDER = '#d3cadf';
const BG_SOFT = '#faf9fc';

/* ---------- SUMMARY LINE REWRITER ---------- */
function rewriteContentSettingsLine() {
const $sum = $('#sumContent');
if (!$sum.length) return;

let original = $sum.text() || '';

// TEMP sonrası her şeyi temizle
original = original.replace(/(Temp\s*:\s*[\d.,]+).*/is, '$1');

const lower = original.toLowerCase();
const marker = 'content settings:';

const cat = $('#categorySelect').val() || '';
const seo = $('#seoPluginSelect').val() || '';

// Oluşturulacak/eklenecek tokenlar
const tokensToAdd = [];
if (cat) tokensToAdd.push('Category: ' + ucFirst(cat));
if (seo) tokensToAdd.push('SEO Plugin: ' + ucFirst(seo));

let newTxt = original;

// Satır var mı?
const csIdx = lower.indexOf(marker);
if (csIdx === -1) {
// Yoksa sona ekle (Temp varsa Temp'ten önce ekleyelim)
const tempMatch = original.match(/(Temp\s*:\s*[\d.,]+)/i);
if (tempMatch) {
const beforeTemp = original.slice(0, tempMatch.index).trimEnd();
const tempStr = tempMatch[0];
const joiner = beforeTemp ? '\n' : '';
newTxt = `${beforeTemp}${joiner}${tokensToAdd.join(', ')}\n${tempStr}`;
} else {
const prefix = original.trim();
const joiner = prefix ? '\n' : '';
newTxt = `${prefix}${joiner}Content Settings: ${tokensToAdd.join(', ')}`;
}
} else {
// Var, düzenle
const before = original.slice(0, csIdx);
let after = original.slice(csIdx); // "Content Settings: ...."
const parts = after.split(':');
const header = parts.shift(); // "Content Settings"
let payload = parts.join(':').trim(); // geri kalan

// payload'ı virgülle parçala ve Category/SEO Plugin kaldır
let tokens = payload.split(',').map(s => s.trim()).filter(Boolean);
tokens = tokens.filter(t =>
!/^category:/i.test(t) &&
!/^seo\s*plugin:/i.test(t) &&
!/^seo:/i.test(t)
);

tokens.push(...tokensToAdd);

// Tekilleştir
const seen = new Set();
tokens = tokens.filter(t => {
const key = t.toLowerCase();
if (seen.has(key)) return false;
seen.add(key);
return true;
});

const rebuilt = `${header}: ${tokens.join(', ')}`;
newTxt = before + rebuilt;

// Temp kısmını geri ekle (varsa)
const tempMatch = original.match(/(Temp\s*:\s*[\d.,]+)/i);
if (tempMatch) {
newTxt = newTxt.replace(/(Temp\s*:\s*[\d.,]+).*/is, '$1'); // güvence
if (!/Temp\s*:/i.test(newTxt)) newTxt += '\n' + tempMatch[0];
}
}

if (newTxt !== original) $sum.text(newTxt);
}

/* ---------- PATCH refreshSummary ---------- */
let _patchedRS = false;
function patchRefreshSummary() {
if (_patchedRS) return;
if (typeof window.refreshSummary === 'function') {
const _orig = window.refreshSummary;
window.refreshSummary = function (...args) {
const ret = _orig.apply(this, args);
try {
setTimeout(rewriteContentSettingsLine, 0);
} catch (e) { console.warn('[metaPanel] rewrite after RS fail:', e); }
return ret;
};
_patchedRS = true;
}
}
// watcher: refreshSummary sonradan gelirse wrap et
const _rsWatcher = setInterval(() => {
if (!_patchedRS && typeof window.refreshSummary === 'function') {
patchRefreshSummary();
clearInterval(_rsWatcher);
}
}, 400);

/* ---------- SAFE SUMMARY TRIGGER ---------- */
let _summaryWaiter = null;
function safeRefreshSummary() {
try {
if (typeof window.refreshSummary === 'function') {
patchRefreshSummary(); // garanti olsun
window.refreshSummary();
setTimeout(rewriteContentSettingsLine, 0);
return;
}
} catch (e) {
console.warn('[metaPanel] refreshSummary call error:', e);
}

// refreshSummary yoksa doğrudan rewrite yap
rewriteContentSettingsLine();

// Fonksiyon sonradan gelirse bir kere daha çağır
if (!_summaryWaiter) {
_summaryWaiter = setInterval(() => {
if (typeof window.refreshSummary === 'function') {
clearInterval(_summaryWaiter);
_summaryWaiter = null;
try {
patchRefreshSummary();
window.refreshSummary();
setTimeout(rewriteContentSettingsLine, 0);
} catch (e) { console.warn(e); }
}
}, 400);
}
}
function saveToAutosave() { safeRefreshSummary(); }

function chip(text, selected, extraClass = '') {
const cls = 'chip' + (selected ? ' selected' : '') + (extraClass ? ' ' + extraClass : '');
return el('span', { class: cls, 'data-val': text }, text);
}

/* ---------- CSS INJECTION ---------- */
function injectStyleOnce() {
if (document.getElementById('metaPanelExtraCss')) return;
const css = `
/* ---------- BASE ---------- */
.meta-panel .chips-wrap{display:flex;flex-wrap:wrap;gap:6px;}
.meta-panel .chip{
background:${PURPLE_LIGHT};
color:${PURPLE_DARK};
padding:4px 10px;
border-radius:16px;
font-size:13px;
line-height:18px;
cursor:pointer;
transition:all .12s;
user-select:none;
}
.meta-panel .chip.selected{
background:${PURPLE};
color:#fff;
}
.meta-panel .chip.more{
cursor:pointer;
font-weight:600;
background:${PURPLE_LIGHT};
color:${PURPLE};
}
.meta-panel .chip.kw-mini{
background:#f4f3f7;
color:#444;
cursor:default;
}
.meta-panel .chip.kw-more{
background:#f4f3f7;
color:${PURPLE};
font-weight:600;
cursor:default;
}

.meta-panel .segmented{
display:inline-flex;
border:1px solid ${GREY_BORDER};
border-radius:8px;
overflow:hidden;
margin:6px 0 12px;
}
.meta-panel .segmented button{
background:${BG_SOFT};
border:0;
padding:6px 14px;
font-size:13px;
color:${PURPLE_DARK};
cursor:pointer;
transition:background .12s,color .12s;
}
.meta-panel .segmented button.active{
background:${PURPLE};
color:#fff;
}

.meta-panel .meta-card{
background:#fff;
border:1px solid #dddbe5;
border-radius:12px;
padding:18px 20px;
margin-bottom:18px;
box-shadow:0 1px 2px rgba(0,0,0,.04);
}
.meta-panel .meta-card h3{
margin:0 0 12px;
font-size:16px;
font-weight:600;
color:#3a2f46;
display:flex;
align-items:center;
gap:6px;
}
.meta-panel .meta-select{
width:100%;
padding:8px 10px;
border:1px solid ${GREY_BORDER};
border-radius:8px;
font-size:14px;
}
.meta-panel .tag-input{
width:100%;
padding:7px 10px;
border:1px solid ${GREY_BORDER};
border-radius:8px;
font-size:13px;
margin-bottom:8px;
}
.meta-panel .advanced-toggle{
display:inline-block;
margin-top:6px;
font-size:12px;
color:${PURPLE};
cursor:pointer;
}
.meta-panel .advanced-box{
display:none;
margin-top:8px;
padding:10px 12px;
background:${BG_SOFT};
border:1px dashed #d9d4e2;
border-radius:8px;
}
.meta-panel .meta-gear{
float:right;
font-size:18px;
cursor:pointer;
color:${PURPLE};
}

#kwMiniPreview{margin-top:8px;}
#kwMiniPreviewLabel{
font-size:11px;
color:#8a8096;
margin-top:6px;
display:block;
}

/* form elements */
.meta-panel input[type="checkbox"],
.meta-panel input[type="radio"]{
accent-color:${PURPLE};
}

/* ----- Force purple for Bootstrap/Neon "danger" reds inside metaPanel ----- */
#metaPanel .badge-danger,
#metaPanel .btn-danger,
#metaPanel .label-danger,
#metaPanel .tag-box .mode-btn.active,
#metaPanel .sources .badge{
background:${PURPLE} !important;
border-color:${PURPLE} !important;
color:#fff !important;
}
`;
document.head.appendChild(el('style', { id: 'metaPanelExtraCss' }, css));
}

/* Hidden mirrors */
function buildHiddenMirrors() {
if (!document.getElementById('categorySelect')) {
document.body.appendChild(el('input', { type: 'hidden', id: 'categorySelect', value: '' }));
}
if (!document.getElementById('seoPluginSelect')) {
document.body.appendChild(el('input', { type: 'hidden', id: 'seoPluginSelect', value: '' }));
}
if (!document.getElementById('tagsSelect')) {
document.body.appendChild(el('input', { type: 'hidden', id: 'tagsSelect', value: '' }));
}
}

/* ---------- KEYWORD MINI PREVIEW ---------- */
function getKeywordArray() {
try {
if ($.fn.DataTable && $.fn.DataTable.isDataTable('#kwTable') && window.kwTable) {
return window.kwTable.column(2).data().toArray().filter(Boolean);
}
} catch (e) { /* ignore */ }

if (Array.isArray(window.kwData) && window.kwData.length) {
return window.kwData.map(r => r.kw).filter(Boolean);
}

const ta = document.getElementById('keywordsBulkInput');
if (ta) return ta.value.split(/\n/).map(s => s.trim()).filter(Boolean);

return [];
}

function renderKwMiniPreview() {
const $box = $('#kwMiniPreview');
if (!$box.length) return;

const list = getKeywordArray();
$box.empty();

if (!list.length) {
$('#kwMiniPreviewLabel').hide();
return;
}
$('#kwMiniPreviewLabel').show();

list.slice(0, KW_PREVIEW_MAX).forEach(t => $box.append(chip(t, false, 'kw-mini')));
const rest = list.length - KW_PREVIEW_MAX;
if (rest > 0) $box.append(chip('+' + rest, false, 'kw-more'));
}

/* ---------- TAGS CARD ---------- */
function renderTagsCard(parent) {
const card = el('div', { class: 'meta-card', id: 'metaTagsCard' });
card.innerHTML = `
<h3><i class="entypo-tag"></i> Tags</h3>

<div class="segmented" id="tagModeSeg">
  <button data-mode="auto" class="${window.tagConfig.mode === 'auto' ? 'active' : ''}">Auto</button>
  <button data-mode="manual" class="${window.tagConfig.mode === 'manual' ? 'active' : ''}">Manual</button>
</div>

<!-- AUTO -->
<div id="autoPanel" style="display:${window.tagConfig.mode === 'auto' ? 'block' : 'none'};">
  <label style="font-size:13px;margin-bottom:4px;display:block;">Tag Count</label>
  <input type="number" id="tagCountInput" class="tag-input" min="0" max="30" value="${window.tagConfig.count}">

  <label style="font-size:13px;margin:10px 0 4px;display:block;">Sources</label>
  <div class="chips-wrap" id="tagSourceWrap"></div>
</div>

<!-- MANUAL -->
<div id="manualPanel" style="display:${window.tagConfig.mode === 'manual' ? 'block' : 'none'};">
  <input id="tagManualInput" class="tag-input" placeholder="Type tag & press Enter">
  <div class="chips-wrap" id="tagManualChips"></div>

  <span class="advanced-toggle" id="tagAdvToggle">Advanced ▾</span>
  <div class="advanced-box" id="tagAdvBox">
    <label style="font-size:13px;margin-bottom:4px;display:block;">Include (must contain)</label>
    <input id="tagIncludeInput" class="tag-input" placeholder="growth, ai, ...">

    <label style="font-size:13px;margin:10px 0 4px;display:block;">Global Tags (for all contents)</label>
    <input id="tagGlobalInput" class="tag-input" placeholder="tag1, tag2, ...">

    <div style="margin-top:8px;">
      <label style="font-size:13px;display:flex;align-items:center;gap:6px;">
        <input type="checkbox" id="allowOverrideCb" ${window.tagConfig.allowOverride ? 'checked' : '' }>
        Allow per-content override
      </label>
    </div>
  </div>
</div>

<span id="kwMiniPreviewLabel" class="small fw-600 d-block mb-1" style="margin-top:10px;display:none;">Keywords Preview</span>
<div id="kwMiniPreview" class="chips-wrap kw-mini"></div>
`;
parent.appendChild(card);

/* Sources chips */
const $srcWrap = $('#tagSourceWrap');
['keywords'].forEach(src => {
$srcWrap.append(chip(src, window.tagConfig.sources.includes(src)));
});

/* Manual chips */
const $manWrap = $('#tagManualChips');
window.tagConfig.manualList.forEach(t => $manWrap.append(chip(t, true)));

/* Events */
$('#tagModeSeg button').on('click', function () {
$('#tagModeSeg button').removeClass('active');
$(this).addClass('active');
const mode = this.dataset.mode;
window.tagConfig.mode = mode;
$('#autoPanel').toggle(mode === 'auto');
$('#manualPanel').toggle(mode === 'manual');
renderPreview();
saveToAutosave();
});

// Auto inputs
$('#tagCountInput').on('input', function () {
window.tagConfig.count = +this.value || 0;
renderPreview();
saveToAutosave();
});

$('#tagSourceWrap').on('click', '.chip', function () {
const val = this.dataset.val;
const idx = window.tagConfig.sources.indexOf(val);
if (idx > -1) {
window.tagConfig.sources.splice(idx, 1);
this.classList.remove('selected');
} else {
window.tagConfig.sources.push(val);
this.classList.add('selected');
}
renderPreview();
saveToAutosave();
});

// Manual add
$('#tagManualInput').on('keydown', function (e) {
if (e.key === 'Enter') {
e.preventDefault();
const t = this.value.trim();
if (!t) return;
if (!window.tagConfig.manualList.includes(t)) {
window.tagConfig.manualList.push(t);
$('#tagManualChips').append(chip(t, true));
renderPreview();
saveToAutosave();
}
this.value = '';
}
});

// Manual chip remove
$('#tagManualChips').on('click', '.chip', function () {
const val = this.dataset.val;
window.tagConfig.manualList = window.tagConfig.manualList.filter(x => x !== val);
this.remove();
renderPreview();
saveToAutosave();
});

// Advanced toggle
$('#tagAdvToggle').on('click', function () {
const show = $('#tagAdvBox').is(':visible');
$('#tagAdvBox').slideToggle(120);
this.textContent = show ? 'Advanced ▾' : 'Advanced ▴';
});

$('#tagIncludeInput')
.val(window.tagConfig.include)
.on('input', function () {
window.tagConfig.include = this.value;
renderPreview();
saveToAutosave();
});

$('#tagGlobalInput')
.val(window.tagConfig.globalTags.join(', '))
.on('input', function () {
window.tagConfig.globalTags = this.value.split(',').map(s => s.trim()).filter(Boolean);
renderPreview();
saveToAutosave();
});

$('#allowOverrideCb').on('change', function () {
window.tagConfig.allowOverride = this.checked;
saveToAutosave();
});

function renderPreview() {
let list = [];

if (window.tagConfig.mode === 'manual') {
list = window.tagConfig.manualList.slice();
} else {
const kwArr = getKeywordArray();
list = kwArr.slice(0, window.tagConfig.count);
}

if (window.tagConfig.include) {
const inc = window.tagConfig.include.toLowerCase();
list = list.filter(t => t.toLowerCase().includes(inc));
}

list = Array.from(new Set([...list, ...window.tagConfig.globalTags]));

window.tagList = list;
$('#tagsSelect').val(list.join(', '));

const $prev = $('#tagPreview');
if ($prev.length) {
$prev.empty();
list.forEach(t => $prev.append(chip(t, true)));
}

safeRefreshSummary();
renderKwMiniPreview();
}

renderPreview();

$(document).on('kwSyncDone', function () {
renderKwMiniPreview();
if (window.tagConfig.mode === 'auto') {
let list = getKeywordArray().slice(0, window.tagConfig.count);
if (window.tagConfig.include) {
const inc = window.tagConfig.include.toLowerCase();
list = list.filter(t => t.toLowerCase().includes(inc));
}
list = Array.from(new Set([...list, ...window.tagConfig.globalTags]));
window.tagList = list;
$('#tagsSelect').val(list.join(', '));

const $prev = $('#tagPreview');
if ($prev.length) {
$prev.empty();
list.forEach(t => $prev.append(chip(t, true)));
}
safeRefreshSummary();
}
});
}

/* ---------- CATEGORY CARD ---------- */
function renderCategoryCard(parent) {
const card = el('div', { class: 'meta-card', id: 'metaCategoryCard' });
card.innerHTML = `
<h3><i class="entypo-folder"></i> Category</h3>
<select id="metaCategorySelect" class="meta-select">
  <option value="">Select category…</option>
</select>
<span class="advanced-toggle" id="newCatBtn" style="margin-top:10px;">+ New category</span>
`;
parent.appendChild(card);

const $sel = $('#metaCategorySelect');
CATEGORY_OPTIONS.forEach(o => $sel.append(`<option value="${o.value}">${o.label}</option>`));

const current = $('#categorySelect').val() || '';
if (current) $sel.val(current);

$sel.on('change', function () {
$('#categorySelect').val(this.value).trigger('change');
safeRefreshSummary();
});

$('#newCatBtn').on('click', function () {
const name = prompt('New category name:');
if (!name) return;
const val = name.toLowerCase().replace(/\s+/g, '-');
CATEGORY_OPTIONS.push({ value: val, label: name });
$sel.append(`<option value="${val}">${name}</option>`).val(val).trigger('change');
});
}

/* ---------- SEO PLUGIN CARD ---------- */
function renderSeoCard(parent) {
const card = el('div', { class: 'meta-card', id: 'metaSeoCard' });
card.innerHTML = `
<h3><i class="entypo-flash"></i> SEO Plugin</h3>
<span class="meta-gear entypo-cog" id="seoSettingsBtn" title="Plugin Settings"></span>
<select id="metaSeoSelect" class="meta-select">
  <option value="">Select plugin…</option>
</select>
`;
parent.appendChild(card);

const $sel = $('#metaSeoSelect');
SEO_PLUGIN_OPTIONS.forEach(o => $sel.append(`<option value="${o.value}">${o.label}</option>`));

const curVal = $('#seoPluginSelect').val() || '';
if (curVal) $sel.val(curVal);

$sel.on('change', function () {
$('#seoPluginSelect').val(this.value).trigger('change');
safeRefreshSummary();
});

$('#seoSettingsBtn').on('click', function () {
alert('Plugin settings modalını burada açabilirsiniz (henüz eklenmedi).');
});
}

/* ---------- FORCE PURPLE HELPERS ---------- */
function forcePurpleDanger(el) {
el.style.setProperty('background', PURPLE, 'important');
el.style.setProperty('border-color', PURPLE, 'important');
el.style.setProperty('color', '#fff', 'important');
}
function scanDanger(root = document) {
root.querySelectorAll(
'#metaPanel .badge-danger, #metaPanel .btn-danger, #metaPanel .label-danger, #metaPanel .tag-box .mode-btn.active, #metaPanel .sources .badge'
).forEach(forcePurpleDanger);
}

/* ---------- INIT DOM READY ---------- */
$(function () {
const holder = document.getElementById('metaPanel');
if (!holder) return;

injectStyleOnce();
buildHiddenMirrors();

// Delegasyon – summary güvenli tetikleme (hidden mirrors)
$(document).on('change input', '#categorySelect,#seoPluginSelect', safeRefreshSummary);

const wrapper = el('section', { class: 'meta-panel' });
holder.appendChild(wrapper);

renderTagsCard(wrapper);
renderCategoryCard(wrapper);
renderSeoCard(wrapper);

/* İlk tarama */
scanDanger();

/* Dinamik eklemeleri yakala */
const mo = new MutationObserver(muts => {
muts.forEach(m => {
m.addedNodes.forEach(n => {
if (!(n instanceof HTMLElement)) return;
if (n.matches &&
(n.matches('.badge-danger, .btn-danger, .label-danger') ||
n.matches('#metaPanel .tag-box .mode-btn.active, #metaPanel .sources .badge'))) {
forcePurpleDanger(n);
}
scanDanger(n);
});
});
});
mo.observe(holder, { childList: true, subtree: true });

// Başlangıçta patch dene
patchRefreshSummary();

safeRefreshSummary();
renderKwMiniPreview();
});
}
})();