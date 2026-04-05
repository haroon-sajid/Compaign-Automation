/**
 * Summary
 * -------
 * ✅ Suggested filename: media-compression-widget.js
 *
 * ✅ Add to HTML (use a nonce if you have a CSP):
 *    <script type="module" src="/assets/js/media-compression-widget.js" nonce="abc123"></script>
 *
 * ✅ Add a mount container where you want the widget to render:
 *    <div id="compression-root"></div>
 *
 * ✅ Initialize (on DOMContentLoaded or in your app bootstrap):
 *    import { initCompressionWidget } from "/assets/js/media-compression-widget.js";
 *    initCompressionWidget("#compression-root");
 *
 * Notes:
 * - No jQuery dependency (pure vanilla JS).
 * - The component injects its own styles via <style id="mcw-styles">.
 * - Local storage keys: mc_profile_cover, mc_profile_content
 * - Two tabs: Cover Settings & Content Settings (behavior matches the original).
 */
export function initCompressionWidget(mountSelectorOrEl) {
  const mount =
    typeof mountSelectorOrEl === "string"
      ? document.querySelector(mountSelectorOrEl)
      : mountSelectorOrEl;

  if (!mount) {
    console.warn("[media-compression-widget] Mount point not found.");
    return;
  }

  // ---------- Styles (inject once) ----------
  const STYLE_ID = "mcw-styles";
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
:root{
  --mo-primary:#7b5cff;--mo-primary-2:#6f5aff;--mo-border:#eae9ff;--mo-soft:#f7f7fb
}
*{box-sizing:border-box}
.mcw{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,"Helvetica Neue",Arial;line-height:1.45;color:#111827}
.mcw .wrap{max-width:980px;margin:0 auto;padding:0 8px}
.mcw .panel{background:#fff;border:1px solid var(--mo-border);border-radius:16px;padding:16px 18px;box-shadow:0 6px 20px rgba(123,92,255,.06);margin-bottom:16px}
.mcw .row{display:flex;gap:12px;align-items:center;flex-wrap:wrap;min-width:0}
.mcw .divider{height:1px;background:#eee;margin:16px 0}
.mcw .spinner{width:16px;height:16px;border-radius:999px;border:2px solid #ddd;border-top-color:var(--mo-primary);display:inline-block;vertical-align:middle;margin-left:8px;animation:mcw-spin 1.8s linear infinite;opacity:0;transition:opacity .25s ease}
@keyframes mcw-spin{to{transform:rotate(360deg)}}
.mcw .mo-seg{display:inline-flex;flex-wrap:wrap;column-gap:8px;row-gap:12px;background:#fff;padding:4px;border-radius:14px;border:1px solid #e5e1ff;max-width:100%}
.mcw .mo-seg--center{display:flex;width:100%;justify-content:center;align-content:center;gap:8px}
.mcw .mo-seg input{display:none}
.mcw .mo-seg label{display:inline-flex;align-items:center;justify-content:center;padding:6px 14px;min-width:72px;font-size:13px;font-weight:600;background:#fff;color:#111827;border:1px solid #e9e6ff;border-radius:999px;cursor:pointer;user-select:none;transition:transform .18s ease, box-shadow .18s ease, background .18s ease, border-color .18s ease, color .18s ease;will-change:transform;transform:translateX(var(--nudge,0))}
.mcw .mo-seg label.active{background:#7b5cff;color:#fff;border-color:#6f5aff;box-shadow:0 4px 14px rgba(123,92,255,.25)}
@media (min-width:720px){
  .mcw label[for^="lev-basic-"]{--nudge:-8px}
  .mcw label[for^="lev-ultra-"]{--nudge:8px}
  .mcw label[for^="fmt-webp-"], .mcw label[for^="fmt-avif-"]{--nudge:-8px}
  .mcw label[for^="fmt-png-"], .mcw label[for^="fmt-jxl-"]{--nudge:8px}
}
.mcw .mo-label{color:#6b7280;font-size:13px;display:block;margin-bottom:6px}
.mcw .mo-group{border:1px solid #e9e6ff;border-radius:16px;padding:12px;background:#fff;box-shadow:0 4px 18px rgba(123,92,255,.06);min-width:0}
.mcw .mo-wh{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;width:100%}
.mcw .mo-wh input{width:100%;background:#fff;border:1px solid #ece9ff;border-radius:24px;padding:10px 14px;font-size:14px;outline:none;min-width:0}
.mcw .mo-wh input:focus{border-color:#b9aaff;box-shadow:0 0 0 4px rgba(123,92,255,.13)}
.mcw .mo-hint{font-size:12px;color:#6b7280;margin-top:6px}
.mcw .mo-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;align-items:start;width:100%}
.mcw .tabs{display:flex;gap:8px;flex-wrap:wrap}
.mcw .tab-btn{border:1px solid #e9e6ff;background:#fff;color:#111827;padding:7px 12px;border-radius:999px;font-weight:600;cursor:pointer}
.mcw .tab-btn.active{background:var(--mo-primary);color:#fff;border-color:var(--mo-primary-2);box-shadow:0 4px 14px rgba(123,92,255,.25)}
.mcw .tab-pane{display:none}
.mcw .tab-pane.active{display:block}
`;
    document.head.appendChild(style);
  }

  // ---------- Constants ----------
  const PRESETS = {
    basic: { targetKB: 750, minQ: 0.7, maxQ: 0.95 },
    super: { targetKB: 250, minQ: 0.5, maxQ: 0.9 },
    ultra: { targetKB: 120, minQ: 0.3, maxQ: 0.85 },
  };
  const FORMATS = [
    { id: "webp", mime: "image/webp", label: "WebP" },
    { id: "jpeg", mime: "image/jpeg", label: "JPEG" },
    { id: "png", mime: "image/png", label: "PNG" },
    { id: "avif", mime: "image/avif", label: "AVIF" },
    { id: "gif", mime: "image/gif", label: "GIF" },
    { id: "jxl", mime: "image/jxl", label: "JXL" },
  ];
  const STORAGE_KEYS = { cover: "mc_profile_cover", content: "mc_profile_content" };

  // ---------- Utils ----------
  const clampInt = (v) => {
    const n = parseInt(v, 10);
    if (!Number.isFinite(n)) return null;
    if (n < 64 || n > 10000) return null;
    return n;
  };
  const debounce = (fn, wait = 200) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), wait);
    };
  };

  function flashSpinner(panelEl) {
    const sp = panelEl.querySelector(".spinner");
    if (!sp) return;
    sp.style.opacity = 1;
    clearTimeout(sp._t);
    sp._t = setTimeout(() => (sp.style.opacity = 0), 600);
  }

  // ---------- DOM helpers ----------
  const el = (tag, opts = {}) => {
    const e = document.createElement(tag);
    if (opts.class) e.className = opts.class;
    if (opts.id) e.id = opts.id;
    if (opts.attrs) for (const [k, v] of Object.entries(opts.attrs)) e.setAttribute(k, v);
    if (opts.html != null) e.innerHTML = opts.html;
    return e;
  };

  // ---------- Build main shell ----------
  mount.classList.add("mcw");
  const wrap = el("div", { class: "wrap" });
  const panel = el("div", { class: "panel", id: "compressionPanel" });

  const headerRow = el("div", { class: "row", attrs: { style: "justify-content:space-between; align-items:center" } });
  const left = el("div", { html: `<strong>Compression &amp; Resize</strong><span class="spinner" aria-hidden="true"></span>` });

  const tabs = el("div", { class: "tabs", attrs: { role: "tablist", "aria-label": "Profile Tabs" } });
  const tabBtnCover = el("button", {
    class: "tab-btn active",
    attrs: { "data-tab": "cover", "aria-selected": "true" },
  });
  tabBtnCover.textContent = "Cover Settings";
  const tabBtnContent = el("button", {
    class: "tab-btn",
    attrs: { "data-tab": "content", "aria-selected": "false" },
  });
  tabBtnContent.textContent = "Content Settings";
  tabs.append(tabBtnCover, tabBtnContent);

  headerRow.append(left, tabs);
  panel.append(headerRow, el("div", { class: "divider" }));

  const tabCover = el("div", { class: "tab-pane active", id: "tab-cover", attrs: { role: "tabpanel", "aria-labelledby": "cover" } });
  const mountCover = el("div", { id: "mediaCompressionMount-cover" });
  tabCover.appendChild(mountCover);

  const tabContent = el("div", { class: "tab-pane", id: "tab-content", attrs: { role: "tabpanel", "aria-labelledby": "content" } });
  const mountContent = el("div", { id: "mediaCompressionMount-content" });
  tabContent.appendChild(mountContent);

  panel.append(tabCover, tabContent);
  wrap.appendChild(panel);
  mount.appendChild(wrap);

  // ---------- Tabs logic ----------
  function showTab(key) {
    panel.querySelectorAll(".tab-btn").forEach((b) => {
      const on = b.getAttribute("data-tab") === key;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    panel.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));
    const pane = panel.querySelector("#tab-" + key);
    if (pane) pane.classList.add("active");
  }
  panel.querySelectorAll(".tab-btn").forEach((b) =>
    b.addEventListener("click", () => showTab(b.getAttribute("data-tab")))
  );

  // ---------- Compression UI builder ----------
  function buildCompressionUI(mountEl, profileKey) {
    const segLevelId = `moLevel-${profileKey}`;
    const segFmtId = `moFormat-${profileKey}`;
    const wId = `moMaxW-${profileKey}`;
    const hId = `moMaxH-${profileKey}`;

    mountEl.innerHTML = `
      <div class="mo-row">
        <div class="mo-group">
          <span class="mo-label">Compression Level</span>
          <div class="mo-seg mo-seg--center" id="${segLevelId}" role="tablist" aria-label="Compression Level">
            <input type="radio" id="lev-basic-${profileKey}" name="moLevel-${profileKey}" value="basic" checked>
            <label for="lev-basic-${profileKey}" class="active" tabindex="0">Basic</label>
            <input type="radio" id="lev-super-${profileKey}" name="moLevel-${profileKey}" value="super">
            <label for="lev-super-${profileKey}" tabindex="0">Super</label>
            <input type="radio" id="lev-ultra-${profileKey}" name="moLevel-${profileKey}" value="ultra">
            <label for="lev-ultra-${profileKey}" tabindex="0">Ultra</label>
          </div>
          <div class="mo-hint">Basic ≤ 750 KB • Super ≈ 250 KB • Ultra ≈ 120 KB</div>
        </div>

        <div class="mo-group">
          <span class="mo-label">Output Format</span>
          <div class="mo-seg mo-seg--center" id="${segFmtId}" role="tablist" aria-label="Output Format">
            ${FORMATS.map(
              (f) => `
                <input type="radio" id="fmt-${f.id}-${profileKey}" name="moFormat-${profileKey}" value="${f.mime}" ${
                f.id === "webp" ? "checked" : ""
              }>
                <label for="fmt-${f.id}-${profileKey}" class="${f.id === "webp" ? "active" : ""}" tabindex="0">${f.label}</label>`
            ).join("")}
          </div>
        </div>

        <div class="mo-group">
          <span class="mo-label">Resize (Max W × H)</span>
          <div class="mo-wh">
            <input id="${wId}" type="number" inputmode="numeric" min="64" max="10000" placeholder="Width" value="">
            <span>×</span>
            <input id="${hId}" type="number" inputmode="numeric" min="64" max="10000" placeholder="Height" value="">
          </div>
          <div class="mo-hint">(Both filled ⇒ cover & center-crop. Single side ⇒ fit inside. Empty ⇒ no resize.)</div>
        </div>
      </div>
    """

    function wireSeg(segId) {
      const seg = mountEl.querySelector("#" + segId);
      if (!seg) return;

      const syncActive = () => {
        const checked = seg.querySelector("input:checked");
        seg.querySelectorAll("label").forEach((l) => l.classList.remove("active"));
        if (checked) {
          const lab = seg.querySelector(`label[for="${checked.id}"]`);
          if (lab) lab.classList.add("active");
        }
      };

      seg.addEventListener("click", (e) => {
        if (e.target.tagName === "LABEL") {
          const forId = e.target.getAttribute("for");
          const inp = seg.querySelector("#" + forId);
          if (inp) {
            inp.checked = true;
            seg.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
      });

      seg.addEventListener("keydown", (e) => {
        const ids = Array.from(seg.querySelectorAll("input")).map((i) => i.id);
        const cur = ids.findIndex((id) => seg.querySelector("#" + id).checked);
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          seg.dispatchEvent(new Event("change", { bubbles: true }));
        }
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          const next = e.key === "ArrowRight" ? (cur + 1) % ids.length : (cur - 1 + ids.length) % ids.length;
          seg.querySelector("#" + ids[next]).checked = true;
          syncActive();
          seg.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });

      seg.addEventListener("change", () => {
        syncActive();
        autoSave(profileKey);
      });

      syncActive();
    }

    wireSeg(segLevelId);
    wireSeg(segFmtId);

    // restore persisted state
    const raw = localStorage.getItem(STORAGE_KEYS[profileKey]);
    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (data.level) {
          const levelEl = mountEl.querySelector(`#lev-${data.level}-${profileKey}`);
          if (levelEl) {
            levelEl.checked = true;
            mountEl.querySelector("#" + segLevelId)?.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
        if (data.format) {
          const fmtEl = mountEl.querySelector(`#${segFmtId} input[value="${data.format}"]`);
          if (fmtEl) {
            fmtEl.checked = true;
            mountEl.querySelector("#" + segFmtId)?.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
        const wEl = mountEl.querySelector("#" + wId);
        const hEl = mountEl.querySelector("#" + hId);
        if (wEl) wEl.value = clampInt(data.maxW) ?? "";
        if (hEl) hEl.value = clampInt(data.maxH) ?? "";
      } catch {}
    }

    const debouncedSave = debounce(() => autoSave(profileKey), 200);
    mountEl.querySelector("#" + wId)?.addEventListener("input", debouncedSave);
    mountEl.querySelector("#" + hId)?.addEventListener("input", debouncedSave);
  }

  function autoSave(profileKey) {
    const segLevelId = `moLevel-${profileKey}`;
    const segFmtId = `moFormat-${profileKey}`;
    const wId = `moMaxW-${profileKey}`;
    const hId = `moMaxH-${profileKey}`;

    const segLevel = panel.querySelector(`#${segLevelId} input:checked`);
    const segFmt = panel.querySelector(`#${segFmtId} input:checked`);
    const wEl = panel.querySelector("#" + wId);
    const hEl = panel.querySelector("#" + hId);

    const level = segLevel?.value || "basic";
    const format = segFmt?.value || "image/webp";
    const maxW = clampInt(wEl?.value);
    const maxH = clampInt(hEl?.value);

    const payload = { level, format, maxW, maxH, preset: PRESETS[level] };
    localStorage.setItem(STORAGE_KEYS[profileKey], JSON.stringify(payload));
    flashSpinner(panel);
  }

  // ---------- Mount Cover & Content ----------
  buildCompressionUI(mountCover, "cover");
  buildCompressionUI(mountContent, "content");
}
