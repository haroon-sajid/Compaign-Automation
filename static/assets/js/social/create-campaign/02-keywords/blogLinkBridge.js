/* blogLinkBridge.js — v1.5 (social)
   - Checkboxlar tema rengine göre boyanır
   - "new" badge sarı (#FACC15) renkte sabit kalır
*/

(function (window, document, $) {
  'use strict';

  // —— Tema Checkbox Stili —— //
  function getThemeAccent() {
    const root = getComputedStyle(document.documentElement);
    const candidates = [
      '--theme-accent',
      '--accent-color',
      '--primary',
      '--brand',
      '--brand-500',
      '--color-accent'
    ];
    for (const v of candidates) {
      const val = root.getPropertyValue(v).trim();
      if (val) return `var(${v})`;
    }
    return '#7C3AED'; // fallback (mor)
  }

  function injectCustomStyles() {
    const color = getThemeAccent();
    const styleId = 'bl-custom-theme-style';
    if (document.getElementById(styleId)) return;

    const css = `
      /* Checkboxlar */
      input[type="checkbox"].bl-row,
      #blogLinkSelectAll,
      #onlyTitleMaster,
      #blogLinkMaster {
        accent-color: ${color};
      }
      input[type="checkbox"]:focus-visible {
        outline: 2px solid ${color};
        outline-offset: 2px;
      }

      /* NEW badge (sarı, sabit renk) */
      .badge-new {
        background-color: #FACC15; /* Tailwind amber-400 */
        color: #000;
        padding: 2px 10px;
        border-radius: 9999px;
        font-weight: 600;
        text-transform: lowercase;
        display: inline-block;
        font-size: 0.85rem;
      }
    `;
    const tag = document.createElement('style');
    tag.id = styleId;
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  // —— Seed Data —— //
  const SEED_BLOG_LINKS = [
    { id: 1, title: "How we scaled AI", url: "https://example.com/blog/how-we-scaled-ai", published: "2025-08-01 09:30", status: "new" },
    { id: 2, title: "Keyword Research Guide", url: "https://example.com/blog/keyword-research-guide", published: "2025-08-02 11:10", status: "new" },
    { id: 3, title: "Prompt Engineering Checklist", url: "https://example.com/blog/prompt-engineering-checklist", published: "2025-08-03 15:20", status: "new" }
  ];

  const state = {
    links: [],
    get latest() {
      if (!this.links.length) return null;
      return this.links
        .slice()
        .sort((a, b) => new Date(b.published.replace(' ', 'T')) - new Date(a.published.replace(' ', 'T')))[0];
    },
    get selected() {
      const ids = $('#blogLinkTable tbody input.bl-row:checked').map((_, el) => +el.value).get();
      if (!ids.length) return null;
      const chosen = state.links.filter(x => ids.includes(x.id));
      if (!chosen.length) return null;
      return chosen.sort((a, b) => new Date(b.published.replace(' ', 'T')) - new Date(a.published.replace(' ', 'T')))[0];
    }
  };

  function renderTable() {
    const $tb = $('#blogLinkTable tbody').empty();
    state.links.forEach(item => {
      $tb.append(`
        <tr>
          <td style="text-align:center;">
            <input type="checkbox" class="bl-row" value="${item.id}" checked>
          </td>
          <td class="bl-title">${escapeHtml(item.title)}</td>
          <td><a href="${item.url}" target="_blank" rel="noopener">${item.url}</a></td>
          <td>${item.published}</td>
          <td><span class="badge-new">${item.status}</span></td>
        </tr>
      `);
    });
    const rows = $('#blogLinkTable tbody input.bl-row');
    $('#blogLinkSelectAll').prop('checked', rows.length && rows.filter(':checked').length === rows.length);

    if ($('#onlyTitleMaster').is(':checked')) {
      pushSelectedTitlesToKeywords();
    }
  }

  async function refreshLinks() {
    try {
      const res = await fetch('/campaigns/api/list-blog-posts/', { credentials: 'include' });
      if (!res.ok) throw new Error('http ' + res.status);
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error('empty');
      state.links = normalizeIncoming(data);
    } catch (e) {
      state.links = SEED_BLOG_LINKS.slice();
    }
    renderTable();
    updateSourcePreviewContent();
  }

  function normalizeIncoming(arr) {
    return arr.map((x, i) => ({
      id: Number(x.id ?? i + 1),
      title: String(x.title ?? x.name ?? 'Untitled'),
      url: String(x.url ?? x.link ?? '#'),
      published: String(x.published ?? x.date ?? ''),
      status: String(x.status ?? 'new')
    }));
  }

  const $token = $('#sourceToken');
  const $preview = $('#sourcePreview');

  function updateSourcePreviewContent() {
    const latest = state.latest;
    if (!latest) return;
    $preview.find('.title').text(latest.title);
    $preview.find('.url').attr('href', latest.url).text(latest.url);
    $preview.find('.meta').text(`Published: ${latest.published} · Status: ${latest.status}`);
  }

  function showPreview() {
    updateSourcePreviewContent();
    $preview.stop(true, true).fadeIn(140).attr('aria-hidden', 'false');
  }
  function hidePreview() {
    $preview.stop(true, true).fadeOut(120).attr('aria-hidden', 'true');
  }

  $token.on('mouseenter', showPreview)
    .on('mouseleave', hidePreview)
    .on('focus', showPreview)
    .on('blur', hidePreview);

  $preview.on('mouseenter', function () { $(this).stop(true, true).show(); })
    .on('mouseleave', hidePreview);

  $(document).on('change', '#blogLinkSelectAll', function () {
    const checked = this.checked;
    $('#blogLinkTable tbody input.bl-row').prop('checked', checked);
    if ($('#onlyTitleMaster').is(':checked')) pushSelectedTitlesToKeywords();
  });

  $(document).on('change', '#blogLinkTable tbody input.bl-row', function () {
    const rows = $('#blogLinkTable tbody input.bl-row');
    $('#blogLinkSelectAll').prop('checked', rows.length && rows.filter(':checked').length === rows.length);
    if ($('#onlyTitleMaster').is(':checked')) pushSelectedTitlesToKeywords();
  });

  $(document).on('click', '#blogLinkRefresh', function (e) {
    refreshLinks().then(() => {
      if (e.shiftKey) setTimeout(() => window.location.reload(), 50);
    });
  });

  function updateOnlyTitleMode() {
    const on = $('#onlyTitleMaster').is(':checked');
    const $kwGrp = $('#keywordsInputGroup');
    const $csvGrp = $('#csvUploadGroup');

    $kwGrp.toggle(!on);
    $csvGrp.toggle(!on);

    $('#keywordsBulkInput').prop('disabled', on);
    $('#csvFile').prop('disabled', on);

    if (on) {
      $('#blogLinkSelectAll').prop('checked', true).trigger('change');
      pushSelectedTitlesToKeywords();
    }
  }

  $(document).on('change', '#onlyTitleMaster', updateOnlyTitleMode);

  function getSelectedTitles() {
    return $('#blogLinkTable tbody input.bl-row:checked').map(function () {
      return $(this).closest('tr').find('.bl-title').text().trim();
    }).get();
  }

  function pushSelectedTitlesToKeywords() {
    const titles = getSelectedTitles();
    $('#keywordsBulkInput').val(titles.join('\n')).trigger('input');
    if (typeof window.syncKeywords === 'function') window.syncKeywords();
  }

  window.appendBlogLinkToPost = function (content) {
    try {
      if (!$('#blogLinkMaster').is(':checked')) return content;
      const chosen = state.selected || state.latest;
      if (!chosen || !chosen.url) return content;
      const needsSpace = /\S$/.test(content || '') ? ' ' : '';
      if (typeof content === 'string' && content.includes('#source')) {
        return content.replaceAll('#source', chosen.url);
      }
      return (content || '') + needsSpace + chosen.url;
    } catch (e) {
      return content;
    }
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  $(function () {
    injectCustomStyles();
    refreshLinks().then(updateOnlyTitleMode);
  });

})(window, document, jQuery);
