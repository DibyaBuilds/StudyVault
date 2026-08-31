/*
StudyVault — Unified PDF Editor v3
Improvements over v2:
- Grouped toolbar + secondary bar (counts, undo, zoom, search)
- Multi-select (Ctrl/Cmd+click, Shift+range, Select All)
- Preview zoom (fit / 75-200%)
- Rotate / Duplicate / Insert blank
- Split-by-range + odd/even + whole-doc ZIP/TXT exports
- Undo/redo + confirm + keyboard shortcuts
- Pagination / size guards + pagination controls
- Better a11y + keyboard nav + focus preservation

Layout:
- Top toolbar grouped
- Secondary bar
- Left thumbs vertically, center preview
*/
'use strict';

/* ============================================================
LOCAL PDF COMPRESSION FIX
============================================================ */

function peSize(x) {
  if (!x) return 0;
  if (typeof x.byteLength === 'number') return x.byteLength;
  if (typeof x.length === 'number') return x.length;
  return 0;
}
function peParseRanges(str, max) {
  if (typeof parseRanges === 'function') return parseRanges(str, max);
  if (typeof window !== 'undefined' && typeof window.parseRanges === 'function') return window.parseRanges(str, max);
  // fallback simple parser
  const out = new Set();
  for (const raw of String(str).split(',')) {
    const p = raw.trim();
    if (!p) continue;
    const m = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      let a = +m[1], b = +m[2];
      if (a > b) [a,b]=[b,a];
      if (a<1||b>max) throw new ToolError(`Range “${p}” out of bounds — this PDF has ${max} page${max===1?'':'s'}.`);
      for (let i=a;i<=b;i++) out.add(i);
    } else if (/^\d+$/.test(p)) {
      const n=+p;
      if (n<1||n>max) throw new ToolError(`Page ${n} out of bounds.`);
      out.add(n);
    } else throw new ToolError(`Couldn't understand “${p}”. Use 3 or 2-6.`);
  }
  if (!out.size) throw new ToolError('Enter at least one page or range.');
  return [...out].sort((a,b)=>a-b);
}

async function compressPdfBytesV2(buf, quality, renderScale, maxSide, onProgress) {
  needPdfJs();
  needPdfLib();

  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
  } catch {
    throw new ToolError('This PDF could not be read. It may be corrupted or protected.');
  }

  const doc = await PDFLib.PDFDocument.create();
  const total = pdf.numPages;

  try {
    for (let i = 1; i <= total; i++) {
      if (onProgress) onProgress(`Compressing page ${i} of ${total}…`);

      const pg = await pdf.getPage(i);
      const vp1 = pg.getViewport({ scale: 1 });

      let s = renderScale;
      const maxCurrent = Math.max(vp1.width, vp1.height) * s;
      if (maxCurrent > maxSide) {
        s = s * maxSide / maxCurrent;
      }

      const vp = pg.getViewport({ scale: s });

      const cv = document.createElement('canvas');
      cv.width = Math.ceil(vp.width);
      cv.height = Math.ceil(vp.height);

      await pg.render({
        canvasContext: cv.getContext('2d', { alpha: false }),
        viewport: vp
      }).promise;

      const jpg = await canvasToBlob(cv, 'image/jpeg', quality);
      const emb = await embedImageDoc(doc, await jpg.arrayBuffer(), 'image/jpeg');

      const page = doc.addPage([vp1.width, vp1.height]);
      page.drawImage(emb, {
        x: 0,
        y: 0,
        width: vp1.width,
        height: vp1.height
      });

      await tick();
    }
  } finally {
    try {
      pdf.destroy();
    } catch {}
  }

  return doc.save({ useObjectStreams: true });
}

async function compressPdfSmart(buf, onProgress) {
  const inputSize = peSize(buf);

  const presets = [
    { label: 'Balanced', q: 0.62, scale: 0.90, maxSide: 1600 },
    { label: 'Strong', q: 0.48, scale: 0.72, maxSide: 1350 },
    { label: 'Aggressive', q: 0.36, scale: 0.55, maxSide: 1100 }
  ];

  let best = null;

  for (const preset of presets) {
    if (onProgress) onProgress(`Trying ${preset.label} compression…`);

    const bytes = await compressPdfBytesV2(
      buf,
      preset.q,
      preset.scale,
      preset.maxSide,
      onProgress
    );

    const size = peSize(bytes);

    if (!best || size < best.size) {
      best = { bytes, size, preset };
    }

    if (size < inputSize * 0.95) {
      break;
    }
  }

  if (!best || best.size >= inputSize) {
    return {
      bytes: buf,
      size: inputSize,
      saved: 0,
      reduced: false
    };
  }

  return {
    bytes: best.bytes,
    size: best.size,
    saved: inputSize - best.size,
    reduced: true
  };
}

window.compressPdfBytes = async function (buf, quality, renderScale, onProgress) {
  return compressPdfBytesV2(buf, quality, renderScale, 1500, onProgress);
};

window.renderCompressPdf = async function (body, api) {
  const dz = dropzone({
    accept: '.pdf',
    label: 'Drop a PDF to compress'
  });

  body.appendChild(dz.root);

  const note = document.createElement('p');
  note.className = 'tool-note';
  note.textContent = 'Compression happens entirely on your device. If the PDF cannot be made smaller safely, StudyVault will tell you instead of creating a larger file.';
  body.appendChild(note);

  const actions = document.createElement('div');
  actions.className = 'tool-actions';
  actions.innerHTML = `
    <button class="btn btn-primary" id="runBtn">🗜️ Compress PDF</button>
    <button class="btn btn-ghost" id="clearBtn">Clear</button>
  `;
  body.appendChild(actions);

  const status = statusBox(body);

  $('#clearBtn', actions).onclick = () => api.reset();

  $('#runBtn', actions).onclick = async () => {
    const f = dz.getFiles()[0];
    if (!f) return toast('Add a PDF first.', 'info');

    const setMsg = loading(status, 'Preparing local compression…');

    try {
      const input = await f.arrayBuffer();
      const result = await compressPdfSmart(input, m => setMsg(m));

      if (!result.reduced) {
        status.innerHTML = `
          <div class="success-box">
            <h3>No size reduction needed</h3>
            <p>This PDF could not be made smaller without risking a larger output. Nothing was uploaded — everything happened locally.</p>
          </div>
        `;
        return;
      }

      const blob = new Blob([result.bytes], { type: 'application/pdf' });
      const cmp = compareHTML(f.size, blob.size);

      successOut(status, {
        title: 'Compressed PDF ready',
        msg: 'Your PDF was compressed fully on your device.',
        downloads: [{
          blob,
          name: `${baseOf(f.name)}-compressed.pdf`,
          label: 'Download PDF'
        }],
        extraHtml: cmp
      });

      animateBars(status);
    } catch (e) {
      errorOut(status, friendly(e), e);
    }
  };
};

/* ============================================================
UNIFIED PDF EDITOR V3
============================================================ */

function renderPdfEditor(body, api) {
  const modal = body.closest('.modal');
  if (modal) modal.classList.add('modal-editor', 'modal-pe2');
  // Make header scroll away (not sticky) and keep ribbon sticky
  if (modal) {
    const head = modal.querySelector('.modal-head');
    if (head && head.parentElement === modal) {
      body.prepend(head);
      head.style.flex = 'none';
      api.onClose(() => {
        if (head.parentElement === body) {
          modal.prepend(head);
          head.style.flex = '';
        }
      });
    }
  }

  body.innerHTML = `
    <div class="pe2 wope">
      <input id="pe2FileInput" type="file" accept=".pdf,application/pdf" multiple hidden>

      <!-- Word-like ribbon -->
      <div class="wope-ribbon" role="region" aria-label="Ribbon">
        <div class="wope-tabs" role="tablist" aria-label="Editor tabs">
          <button class="wope-tab active" data-tab="home" role="tab" aria-selected="true">Home</button>
          <button class="wope-tab" data-tab="organize" role="tab">Organize</button>
          <button class="wope-tab" data-tab="insert" role="tab">Insert</button>
          <button class="wope-tab" data-tab="export" role="tab">Export</button>
          <button class="wope-tab" data-tab="view" role="tab">View</button>
        </div>
        <div class="wope-panels">
          <!-- Home -->
          <div class="wope-panel active" data-panel="home" role="tabpanel">
            <div class="wope-group">
              <button class="wope-btn wope-btn-primary wope-btn-lg" id="pe2Add" type="button" title="Add PDFs"><span class="wope-ic">＋</span><span class="wope-lbl">Add PDF</span></button>
              <div class="wope-stack">
                <button class="wope-btn wope-btn-sm" id="pe2Info" type="button">ℹ Info</button>
                <button class="wope-btn wope-btn-sm" id="pe2Clear" type="button">✕ Clear</button>
              </div>
              <div class="wope-group-label">Document</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group">
              <button class="wope-btn wope-btn-lg" id="pe2SelectAll" type="button"><span class="wope-ic">☑</span><span class="wope-lbl">Select All</span></button>
              <div class="wope-stack">
                <button class="wope-btn wope-btn-sm" id="pe2Deselect" type="button">Clear</button>
                <button class="wope-btn wope-btn-sm" id="pe2Duplicate" type="button">⧉ Duplicate</button>
              </div>
              <div class="wope-group-label">Selection</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group">
              <button class="wope-btn wope-btn-lg wope-btn-danger" id="pe2Remove" type="button"><span class="wope-ic">🗑</span><span class="wope-lbl">Remove</span></button>
              <button class="wope-btn wope-btn-lg" id="pe2Restore" type="button"><span class="wope-ic">↺</span><span class="wope-lbl">Restore</span></button>
              <div class="wope-group-label">Edit</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group">
              <div class="wope-stack">
                <button class="wope-btn wope-btn-sm" id="pe2Undo" type="button" title="Undo (Ctrl+Z)">↩ Undo</button>
                <button class="wope-btn wope-btn-sm" id="pe2Redo" type="button" title="Redo (Ctrl+Y)">↪ Redo</button>
              </div>
              <div class="wope-group-label">History</div>
            </div>
          </div>
          <!-- Organize -->
          <div class="wope-panel" data-panel="organize" role="tabpanel" hidden>
            <div class="wope-group">
              <button class="wope-btn wope-btn-lg" id="pe2Sort" type="button"><span class="wope-ic">⇅</span><span class="wope-lbl">Sort</span><span class="wope-hint">Original</span></button>
              <div class="wope-group-label">Arrange</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group">
              <button class="wope-btn wope-btn-lg" id="pe2Rotate" type="button"><span class="wope-ic">↻</span><span class="wope-lbl">Rotate</span><span class="wope-hint">90°</span></button>
              <div class="wope-group-label">Transform</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group wope-group-info">
              <div class="wope-hint-box">Drag thumbnails to reorder<br>↑/↓ buttons or drag & drop</div>
              <div class="wope-group-label">Reorder</div>
            </div>
          </div>
          <!-- Insert -->
          <div class="wope-panel" data-panel="insert" role="tabpanel" hidden>
            <div class="wope-group">
              <button class="wope-btn wope-btn-lg" id="pe2Blank" type="button"><span class="wope-ic">＋</span><span class="wope-lbl">Blank Page</span><span class="wope-hint">A4</span></button>
              <div class="wope-group-label">Pages</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group wope-group-info"><div class="wope-hint-box">Blank pages are inserted after<br>selection as A4 white</div><div class="wope-group-label">Tips</div></div>
          </div>
          <!-- Export -->
          <div class="wope-panel" data-panel="export" role="tabpanel" hidden>
            <div class="wope-group">
              <button class="wope-btn wope-btn-primary wope-btn-lg" id="pe2Download" type="button"><span class="wope-ic">💾</span><span class="wope-lbl">Save PDF</span><span class="wope-hint">Ctrl+S</span></button>
              <div class="wope-group-label">Save</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group">
              <div class="wope-stack">
                <button class="wope-btn wope-btn-sm" id="pe2Extract" type="button">⧉ Extract</button>
                <button class="wope-btn wope-btn-sm" id="pe2Split" type="button">✂ Split</button>
              </div>
              <div class="wope-group-label">Extract</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group">
              <button class="wope-btn wope-btn-lg" id="pe2Compress" type="button"><span class="wope-ic">🗜</span><span class="wope-lbl">Compress</span></button>
              <div class="wope-group-label">Optimize</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group">
              <div class="wope-stack">
                <button class="wope-btn wope-btn-sm" id="pe2Image" type="button">🖼 Image</button>
                <button class="wope-btn wope-btn-sm" id="pe2Text" type="button">📝 Text</button>
              </div>
              <div class="wope-group-label">Convert</div>
            </div>
          </div>
          <!-- View -->
          <div class="wope-panel" data-panel="view" role="tabpanel" hidden>
            <div class="wope-group">
              <div class="wope-zoom-inline">
                <button class="wope-btn wope-btn-sm" id="pe2ViewZoomOut" type="button">−</button>
                <select id="pe2ViewZoomSel" aria-label="Zoom"><option value="fit">Fit</option><option value="0.75">75%</option><option value="1">100%</option><option value="1.25">125%</option><option value="1.5">150%</option><option value="2">200%</option></select>
                <button class="wope-btn wope-btn-sm" id="pe2ViewZoomIn" type="button">＋</button>
              </div>
              <div class="wope-group-label">Zoom</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group">
              <div class="wope-hint-box">Filter & Go to are in<br>left Navigation pane</div>
              <div class="wope-group-label">Navigation</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group">
              <div class="wope-inline"><span class="pe2-count" id="pe2CountView">0 pages</span></div>
              <div class="wope-group-label">Status</div>
            </div>
          </div>
        </div>
      </div>

      <div class="pe2-work wope-work">
        <aside class="pe2-left wope-nav" aria-label="Pages">
          <div class="pe2-left-head wope-nav-head">
            <div class="wope-nav-title"><span>Pages</span><span class="pe2-left-meta" id="pe2LeftMeta">—</span></div>
            <label class="wope-nav-filter" title="Filter pages">
              <input id="pe2Filter" type="search" placeholder="Filter… F1 P12" aria-label="Filter pages">
              <span aria-hidden="true">🔍</span>
            </label>
            <label class="wope-nav-jump" title="Jump to page">
              <input id="pe2Jump" type="number" min="1" inputmode="numeric" placeholder="#" aria-label="Jump to page">
              <span>Go</span>
            </label>
          </div>
          <div class="pe2-pages wope-nav-pages" id="pe2Pages" role="listbox" aria-multiselectable="true" aria-label="Pages. Use Ctrl/Cmd or Shift to select multiple."></div>
        </aside>
        <main class="pe2-main wope-doc" id="pe2Main"></main>
      </div>

      <div class="wope-statusbar" role="contentinfo" aria-label="Status">
        <div class="wope-status-left">
          <span class="wope-status-item" id="pe2Count">0 pages</span>
          <span class="wope-status-item" id="pe2SelCount" hidden>0 selected</span>
          <span class="wope-status-item wope-status-kept" id="pe2StatusKept">0 kept</span>
        </div>
        <div class="wope-status-center">
          <input id="pe2FileName" type="text" placeholder="studyvault-edited.pdf" aria-label="Output filename" title="Output filename">
        </div>
        <div class="wope-status-right">
          <div class="wope-status-zoom" role="group" aria-label="Zoom">
            <button class="wope-status-btn" id="pe2ZoomOut" type="button" title="Zoom out">−</button>
            <select id="pe2ZoomSel" aria-label="Zoom level">
              <option value="fit">Fit</option>
              <option value="0.75">75%</option>
              <option value="1">100%</option>
              <option value="1.25">125%</option>
              <option value="1.5">150%</option>
              <option value="2">200%</option>
            </select>
            <button class="wope-status-btn" id="pe2ZoomIn" type="button" title="Zoom in">＋</button>
            <button class="wope-status-btn" id="pe2ZoomReset" type="button" title="Reset">⊡</button>
          </div>
          <span class="wope-status-zoom-val" id="pe2ZoomVal">Fit</span>
        </div>
      </div>
      <p class="tool-note wope-tip" style="margin:8px 0 0">💡 Word-like: <b>Home</b> for add/select/edit · <b>Organize</b> for sort/rotate · <b>Insert</b> blank · <b>Export</b> save/split/compress · <b>View</b> zoom · Drag pages, <kbd>Ctrl</kbd> multi, <kbd>R</kbd> rotate</p>
    </div>
  `;

  const root = $('.pe2', body);
  const fileInput = $('#pe2FileInput', root);
  const pagesEl = $('#pe2Pages', root);
  const main = $('#pe2Main', root);

  const els = {
    add: $('#pe2Add', root),
    remove: $('#pe2Remove', root),
    restore: $('#pe2Restore', root),
    rotate: $('#pe2Rotate', root),
    duplicate: $('#pe2Duplicate', root),
    blank: $('#pe2Blank', root),
    extract: $('#pe2Extract', root),
    split: $('#pe2Split', root),
    download: $('#pe2Download', root),
    compress: $('#pe2Compress', root),
    image: $('#pe2Image', root),
    text: $('#pe2Text', root),
    info: $('#pe2Info', root),
    clear: $('#pe2Clear', root),
    count: $('#pe2Count', root),
    selCount: $('#pe2SelCount', root),
    selectAll: $('#pe2SelectAll', root),
    deselect: $('#pe2Deselect', root),
    jump: $('#pe2Jump', root),
    filter: $('#pe2Filter', root),
    undo: $('#pe2Undo', root),
    redo: $('#pe2Redo', root),
    zoomOut: $('#pe2ZoomOut', root),
    zoomIn: $('#pe2ZoomIn', root),
    zoomSel: $('#pe2ZoomSel', root),
    zoomReset: $('#pe2ZoomReset', root),
    fileName: $('#pe2FileName', root),
    leftMeta: $('#pe2LeftMeta', root),
    sort: $('#pe2Sort', root)
  };
  // Ribbon tab switching (Word-like)
  (function setupRibbon(){
    const tabs = $$('.wope-tab', root);
    const panels = $$('.wope-panel', root);
    tabs.forEach(tab=>{
      tab.addEventListener('click', ()=>{
        tabs.forEach(t=>{ t.classList.remove('active'); t.setAttribute('aria-selected','false'); });
        panels.forEach(p=>{ p.classList.remove('active'); p.hidden = true; });
        tab.classList.add('active'); tab.setAttribute('aria-selected','true');
        const panel = $(`.wope-panel[data-panel="${tab.dataset.tab}"]`, root);
        if (panel){ panel.classList.add('active'); panel.hidden = false; }
      });
    });
    // View panel zoom proxies sync to status bar zoom
    const vOut = $('#pe2ViewZoomOut', root), vIn = $('#pe2ViewZoomIn', root), vSel = $('#pe2ViewZoomSel', root);
    if (vOut && els.zoomOut) vOut.addEventListener('click', ()=> els.zoomOut.click());
    if (vIn && els.zoomIn) vIn.addEventListener('click', ()=> els.zoomIn.click());
    if (vSel && els.zoomSel) vSel.addEventListener('change', e=>{
      els.zoomSel.value = e.target.value;
      els.zoomSel.dispatchEvent(new Event('change'));
    });
  })();

  // State
  let docs = [];       // {file, buf, libDoc, count, color}
  let pages = [];      // {uid, docIdx, page, thumb, removed, selected, rotation, hiddenByFilter, el}
  let currentPage = null;
  let lastSelectedIdx = -1;
  let dragIdx = null;
  let pageToken = 0;
  let objectUrls = [];
  let zoomMode = 'fit'; // 'fit' or number string
  let filterQuery = '';
  let outputName = 'studyvault-edited.pdf';

  const DOC_COLORS = ['#38bdf8','#a855f7','#34d399','#fbbf24','#fb7185','#60a5fa','#f97316','#22d3ee'];
  const jsCache = new Map();

  const tier = typeof DeviceCaps !== 'undefined' ? DeviceCaps.qualityTier : 'medium';
  const PE_PREVIEW_CAP = tier === 'low' ? 80 : tier === 'medium' ? 140 : 220;
  const PE_PAGE_RENDER_MAX = tier === 'low' ? 1.2 : tier === 'medium' ? 1.6 : 2.0;
  const MAX_FILE_SIZE = 250 * 1024 * 1024;

  // History for undo/redo
  let history = [];
  let histIdx = -1;
  function snapshot() {
    return {
      pages: pages.map(p => ({ uid: p.uid, docIdx: p.docIdx, page: p.page, removed: p.removed, selected: p.selected, rotation: p.rotation, hiddenByFilter: p.hiddenByFilter })),
      docsLen: docs.length,
      currentUid: currentPage ? currentPage.uid : null
    };
  }
  function pushHistory(label) {
    // truncate future
    history = history.slice(0, histIdx + 1);
    history.push(snapshot());
    histIdx = history.length - 1;
    if (history.length > 60) { history.shift(); histIdx--; }
    updateToolbar();
  }
  function restoreSnapshot(snap) {
    // restore pages flags and order
    const byUid = new Map(pages.map(p => [p.uid, p]));
    const newPages = [];
    snap.pages.forEach(sp => {
      const p = byUid.get(sp.uid);
      if (p) {
        p.removed = sp.removed;
        p.selected = sp.selected;
        p.rotation = sp.rotation;
        p.hiddenByFilter = sp.hiddenByFilter;
        // docIdx/page should not change except order; order is defined by snap.pages order
        p.docIdx = sp.docIdx;
        p.page = sp.page;
        newPages.push(p);
      }
    });
    // add any pages not in snapshot? shouldn't happen (new docs)
    pages = newPages;
    // restore current
    if (snap.currentUid) currentPage = pages.find(p => p.uid === snap.currentUid) || pages[0] || null;
    else currentPage = pages[0] || null;
    applyFilter();
    renderPages();
    if (currentPage) renderMainPage(); else renderMainEmpty();
    updateToolbar();
  }
  function undo() {
    if (histIdx <= 0) return;
    histIdx--;
    restoreSnapshot(history[histIdx]);
  }
  function redo() {
    if (histIdx >= history.length - 1) return;
    histIdx++;
    restoreSnapshot(history[histIdx]);
  }

  // initial history
  pushHistory('init');

  api.onClose(() => {
    pageToken++;
    jsCache.forEach(js => {
      try { js.destroy(); } catch {}
    });
    jsCache.clear();
    objectUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
    objectUrls = [];
    // revoke thumb object URLs are canvases, not URLs
  });

  /* ---------- Helpers ---------- */
  function uid() { return Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-4); }

  function getSelected() {
    const sel = pages.filter(p => p.selected && !p.hiddenByFilter);
    if (sel.length) return sel;
    if (currentPage && !currentPage.hiddenByFilter) return [currentPage];
    return [];
  }

  function keptPages() { return pages.filter(p => !p.removed && !p.hiddenByFilter); }

  function updateToolbar() {
    const hasPages = pages.length > 0;
    const visiblePages = pages.filter(p => !p.hiddenByFilter);
    const hasSelection = getSelected().length > 0;
    const hasVis = visiblePages.length > 0;
    const kept = pages.filter(p => !p.removed).length;
    const sel = pages.filter(p => p.selected).length;

    const hasActiveSel = getSelected().some(p => !p.removed);
    const hasRemovedSel = getSelected().some(p => p.removed);

    if (els.remove) els.remove.disabled = !hasActiveSel;
    if (els.restore) els.restore.disabled = !hasRemovedSel;
    if (els.rotate) els.rotate.disabled = !hasSelection;
    if (els.duplicate) els.duplicate.disabled = !hasSelection;
    if (els.extract) els.extract.disabled = !hasActiveSel;
    if (els.image) els.image.disabled = !hasActiveSel;
    if (els.text) els.text.disabled = !hasActiveSel;
    if (els.download) els.download.disabled = kept === 0;
    if (els.compress) els.compress.disabled = kept === 0;
    if (els.info) els.info.disabled = !hasPages;
    if (els.clear) els.clear.disabled = !hasPages;
    if (els.selectAll) els.selectAll.disabled = !hasVis;
    if (els.deselect) els.deselect.disabled = sel === 0;
    if (els.undo) els.undo.disabled = histIdx <= 0;
    if (els.redo) els.redo.disabled = histIdx >= history.length - 1;

    // counts - defensive (elements may be in ribbon/status)
    if (els.count) { els.count.textContent = `${pages.length} page${pages.length===1?'':'s'}${filterQuery ? ` · ${visiblePages.length} shown` : ''}`; els.count.title = `${pages.length} total, ${kept} kept, ${pages.length-kept} removed`; }
    if (els.selCount) { if (sel > 0) { els.selCount.hidden = false; els.selCount.textContent = `${sel} selected`; } else els.selCount.hidden = true; }
    if (els.leftMeta) els.leftMeta.textContent = `${kept} kept · ${pages.length-kept} removed`;
    if (els.jump) els.jump.max = String(pages.length);
    // Word-like status extras
    const statusKept = $('#pe2StatusKept', root);
    if (statusKept) statusKept.textContent = `${kept} kept · ${pages.length-kept} removed`;
    const viewCount = $('#pe2CountView', root);
    if (viewCount) viewCount.textContent = `${pages.length} pages`;
    const zoomVal = $('#pe2ZoomVal', root);
    if (zoomVal) zoomVal.textContent = zoomMode === 'fit' ? 'Fit' : (zoomMode === '1' ? '100%' : (Math.round(Number(zoomMode)*100) + '%'));
    const vSel = $('#pe2ViewZoomSel', root);
    if (vSel && vSel.value !== zoomMode) vSel.value = zoomMode;
  }

  function applyFilter() {
    const q = filterQuery.trim().toLowerCase();
    if (!q) {
      pages.forEach(p => p.hiddenByFilter = false);
      return;
    }
    pages.forEach(p => {
      const docName = (docs[p.docIdx] && docs[p.docIdx].file.name || '').toLowerCase();
      const hay = `f${p.docIdx+1} p${p.page} ${docName} ${p.removed?'removed':''} ${p.rotation?'rot'+p.rotation:''}`.toLowerCase();
      // support queries like "f1" "p12" "invoice"
      // split by spaces, all terms must match
      const terms = q.split(/\s+/).filter(Boolean);
      p.hiddenByFilter = !terms.every(t => hay.includes(t));
    });
    // deselect hidden
    pages.forEach(p => { if (p.hiddenByFilter) p.selected = false; });
  }

  function setFilter(v) {
    filterQuery = v;
    applyFilter();
    renderPages();
    updateToolbar();
  }

  function toolPane(title) {
    main.innerHTML = `
      <div class="pe2-tool">
        <div class="pe2-tool-head">
          <button class="btn btn-ghost btn-sm" id="pe2Back" type="button">← Back to preview</button>
          <h3>${esc(title)}</h3>
        </div>
        <div class="pe2-tool-body">
          <div class="tool-status" aria-live="polite"></div>
        </div>
      </div>
    `;
    $('#pe2Back', main).onclick = () => {
      if (currentPage) renderMainPage();
      else renderMainEmpty();
    };
    return $('.tool-status', main);
  }

  function renderMainEmpty() {
    pageToken++;
    const hasPages = pages.length > 0;
    if (!hasPages) {
      main.innerHTML = `
        <div class="empty-state pe2-empty">
          <div class="es-ic">📄</div>
          <b>PDF Editor</b>
          <p>
            Add PDFs with <b>Add PDF</b> or drop them anywhere here.<br>
            <span style="color:var(--muted)">Merge · Reorder · Remove · Rotate · Duplicate · Split · Compress · Export JPG/PNG/ZIP · Extract text</span>
          </p>
          <div style="margin-top:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" id="pe2EmptyAdd">＋ Add PDF</button>
            <button class="btn btn-ghost btn-sm" id="pe2EmptyInfo">Why offline?</button>
          </div>
          <p class="tool-note" style="justify-content:center">🔒 Everything runs locally in your browser — no uploads.</p>
        </div>
      `;
      $('#pe2EmptyAdd', main).onclick = () => fileInput.click();
      $('#pe2EmptyInfo', main).onclick = () => showInfo();
    } else {
      main.innerHTML = `
        <div class="empty-state pe2-empty">
          <div class="es-ic">👈</div>
          <b>Select a page</b>
          <p>Choose a page on the left to preview it. Use Ctrl/Cmd or Shift to select multiple.</p>
        </div>
      `;
    }
    updateToolbar();
  }

  async function getJsDoc(docIdx) {
    if (!jsCache.has(docIdx)) {
      needPdfJs();
      const js = await pdfjsLib.getDocument({ data: docs[docIdx].buf.slice(0) }).promise;
      jsCache.set(docIdx, js);
    }
    return jsCache.get(docIdx);
  }

  function effectiveZoomScale() {
    if (zoomMode === 'fit') return null;
    const n = Number(zoomMode);
    if (!isFinite(n) || n <= 0) return null;
    return n;
  }

  async function renderBigPage(p, forcedScale) {
    if (p.isBlank) {
      const [w, h] = p.blankSize || [595.28, 841.89];
      const scale = typeof forcedScale === 'number' ? forcedScale : (effectiveZoomScale() !== null ? effectiveZoomScale() : 1.2);
      // respect rotation for blank too
      const rot = p.rotation || 0;
      const isSideways = rot === 90 || rot === 270;
      const cv = document.createElement('canvas');
      const baseW = isSideways ? h : w;
      const baseH = isSideways ? w : h;
      cv.width = Math.ceil(baseW * scale * 0.6);
      cv.height = Math.ceil(baseH * scale * 0.6);
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.strokeRect(4, 4, cv.width - 8, cv.height - 8);
      ctx.fillStyle = '#64748b';
      ctx.font = `${Math.max(12, cv.width * 0.04)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('BLANK PAGE', cv.width / 2, cv.height / 2);
      if (rot) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = `${Math.max(10, cv.width * 0.03)}px monospace`;
        ctx.fillText(`${rot}°`, cv.width / 2, cv.height / 2 + 24);
      }
      cv.dataset.rotation = String(rot);
      return cv;
    }
    const js = await getJsDoc(p.docIdx);
    const pg = await js.getPage(p.page);

    const vp1 = pg.getViewport({ scale: 1 });
    const available = Math.max(320, (main.clientWidth || 900) - 70);

    let scale;
    if (typeof forcedScale === 'number') scale = forcedScale;
    else {
      const eff = effectiveZoomScale();
      if (eff !== null) scale = eff;
      else scale = Math.min(PE_PAGE_RENDER_MAX, Math.max(1, available / vp1.width));
      if (tier === 'low') scale = Math.min(scale, 1.2);
    }

    // rotation
    const rot = p.rotation || 0;
    const vp = pg.getViewport({ scale, rotation: rot });

    const cv = document.createElement('canvas');
    cv.width = Math.ceil(vp.width);
    cv.height = Math.ceil(vp.height);

    await pg.render({
      canvasContext: cv.getContext('2d', { alpha: false }),
      viewport: vp
    }).promise;

    cv.dataset.rotation = String(rot);
    return cv;
  }

  async function renderMainPage() {
    if (!currentPage) { renderMainEmpty(); return; }
    const token = ++pageToken;
    const selCount = pages.filter(p => p.selected).length;
    const isMulti = selCount > 1;
    const visibleSel = getSelected();

    main.innerHTML = `
      <div class="pe2-view">
        <div class="pe2-view-bar">
          <span>
            <b style="color:var(--text)">F${currentPage.docIdx + 1} · P${currentPage.page}</b>
            ${currentPage.rotation ? ` · ↻ ${currentPage.rotation}°` : ''}
            ${currentPage.removed ? ' · <span style="color:#fda4af">removed</span>' : ''}
            ${isMulti ? ` · <span style="color:#8fb0ff">${selCount} selected</span>` : ''}
            <span style="color:var(--faint)"> · ${esc(docs[currentPage.docIdx]?.file.name || '')}</span>
          </span>
          <span style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-ghost btn-xs" id="pe2ViewPrev" type="button" title="Previous page (ArrowUp)">↑ Prev</button>
            <button class="btn btn-ghost btn-xs" id="pe2ViewNext" type="button" title="Next page (ArrowDown)">Next ↓</button>
            <button class="btn btn-ghost btn-sm" id="pe2ViewImg" type="button">Download JPG</button>
            <button class="btn btn-ghost btn-sm" id="pe2ViewTxt" type="button">Copy Text</button>
          </span>
        </div>
        <div class="pe2-canvas-wrap ${currentPage.removed ? 'removed' : ''}" id="pe2CanvasWrap">
          <span class="spinner" aria-hidden="true"></span>
        </div>
        ${isMulti ? `<div class="pe2-multi-bar">Selected ${visibleSel.map(p=>`F${p.docIdx+1}-P${p.page}`).join(', ')} — actions apply to all selected.</div>` : ''}
      </div>
    `;

    $('#pe2ViewImg', main).onclick = () => exportSelectedImages();
    $('#pe2ViewTxt', main).onclick = () => quickCopyText(currentPage);
    const prevBtn = $('#pe2ViewPrev', main);
    const nextBtn = $('#pe2ViewNext', main);
    if (prevBtn) prevBtn.onclick = () => navigatePreview(-1);
    if (nextBtn) nextBtn.onclick = () => navigatePreview(1);

    try {
      const cv = await renderBigPage(currentPage);
      if (token !== pageToken) return;
      const wrap = $('#pe2CanvasWrap', main);
      if (!wrap) return;
      wrap.innerHTML = '';
      // wrap with frame for shadow
      const frame = document.createElement('div');
      frame.className = 'pe2-canvas-frame';
      frame.appendChild(cv);
      if (currentPage.rotation) {
        frame.title = `Rotated ${currentPage.rotation}° — will be applied on download`;
      }
      wrap.appendChild(frame);
      // click canvas to toggle fit/100%
      cv.style.cursor = 'zoom-in';
      cv.addEventListener('click', () => {
        if (zoomMode === 'fit') { zoomMode = '1'; els.zoomSel.value = '1'; }
        else { zoomMode = 'fit'; els.zoomSel.value = 'fit'; }
        renderMainPage();
      });
    } catch (e) {
      if (token !== pageToken) return;
      const wrap = $('#pe2CanvasWrap', main);
      if (!wrap) return;
      wrap.innerHTML = `
        <div class="panel-err" style="max-width:640px;margin:auto">
          <span aria-hidden="true">⚠️</span>
          <div>
            <b>Could not render this page</b>
            <p>${esc(friendly(e))}</p>
          </div>
        </div>
      `;
    }
    updateToolbar();
  }

  function navigatePreview(dir) {
    if (!currentPage) return;
    const visible = pages.filter(p => !p.hiddenByFilter);
    const idx = visible.indexOf(currentPage);
    if (idx === -1) return;
    const next = visible[idx + dir];
    if (next) { currentPage = next; renderPages(); renderMainPage(); }
  }

  /* ---------- Page list ---------- */

  function createPageEl(p, i) {
    if (p.hiddenByFilter) {
      const placeholder = document.createElement('div');
      placeholder.style.display = 'none';
      return placeholder;
    }
    const item = document.createElement('div');
    item.className =
      'pe2-page' +
      (p === currentPage ? ' active' : '') +
      (p.selected ? ' selected' : '') +
      (p.removed ? ' removed' : '');
    if (p.rotation) item.classList.add('rotated');
    item.draggable = true;
    item.tabIndex = 0;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', String(!!p.selected));
    item.setAttribute('aria-label', `File ${p.docIdx+1} page ${p.page}${p.removed?' removed':''}${p.rotation?' rotated '+p.rotation+' degrees':''}${p.selected?' selected':''}`);
    if (p.docIdx < DOC_COLORS.length) item.style.setProperty('--doc-color', DOC_COLORS[p.docIdx % DOC_COLORS.length]);

    // thumb with rotation preview
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'pe2-thumb-wrap';
    thumbWrap.style.position = 'relative';
    // clone thumb canvas visually via wrapper? reuse thumb canvas directly but rotate via CSS for thumbnail
    p.thumb.style.transform = p.rotation ? `rotate(${p.rotation}deg)` : '';
    // we need to avoid mutating shared thumb for multiple renders; wrap instead
    // So create container that rotates
    const thumbContainer = document.createElement('div');
    thumbContainer.className = 'pe2-thumb-container';
    if (p.rotation) thumbContainer.style.transform = `rotate(${p.rotation}deg)`;
    // But keep original thumb untouched? Move thumb into container
    thumbContainer.appendChild(p.thumb);
    thumbWrap.appendChild(thumbContainer);
    item.appendChild(thumbWrap);

    // checkbox overlay
    const check = document.createElement('span');
    check.className = 'pe2-check' + (p.selected ? ' on' : '');
    check.setAttribute('aria-hidden', 'true');
    check.textContent = p.selected ? '✓' : '';
    thumbWrap.appendChild(check);

    // doc color dot
    const dot = document.createElement('span');
    dot.className = 'pe2-dot';
    dot.title = docs[p.docIdx]?.file.name || '';
    thumbWrap.appendChild(dot);

    if (p.rotation) {
      const rotBadge = document.createElement('span');
      rotBadge.className = 'pe2-rot-badge';
      rotBadge.textContent = `${p.rotation}°`;
      thumbWrap.appendChild(rotBadge);
    }

    item.insertAdjacentHTML('beforeend', `
      <div class="pe2-page-meta">
        <span>F${p.docIdx + 1} · P${p.page}</span>
        <span class="pe2-page-acts">
          <button type="button" data-mv="-1" aria-label="Move up" title="Move up">↑</button>
          <button type="button" data-mv="1" aria-label="Move down" title="Move down">↓</button>
          <button type="button" data-rot aria-label="Rotate 90°" title="Rotate 90°">↻</button>
          <button type="button" data-rm aria-label="${p.removed ? 'Restore page' : 'Remove page'}" title="${p.removed ? 'Restore' : 'Remove'}">
            ${p.removed ? '↺' : '✕'}
          </button>
        </span>
      </div>
    `);

    const selectWithModifiers = (e) => {
      // Hold Ctrl/Cmd toggles, Shift extends range
      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      if (isShift && lastSelectedIdx !== -1) {
        const anchor = lastSelectedIdx;
        const start = Math.min(anchor, i);
        const end = Math.max(anchor, i);
        const shouldSelect = true;
        for (let k = start; k <= end; k++) {
          const pk = pages[k];
          if (!pk.hiddenByFilter) pk.selected = shouldSelect;
        }
      } else if (isCtrl) {
        p.selected = !p.selected;
        lastSelectedIdx = i;
      } else {
        // single select or if already selected among multi, keep selection but change current
        const wasSelected = p.selected;
        const selCount = pages.filter(x=>x.selected).length;
        if (wasSelected && selCount > 1) {
          // keep multi selection, just change current
        } else {
          pages.forEach(x=> x.selected = false);
          p.selected = true;
        }
        lastSelectedIdx = i;
      }
      currentPage = p;
      refreshSelectionUI();
      renderMainPage();
    };

    item.addEventListener('click', selectWithModifiers);
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectWithModifiers(e); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const dir = e.key === 'ArrowUp' ? -1 : 1;
        let nxt = i + dir;
        while (nxt >=0 && nxt < pages.length && pages[nxt].hiddenByFilter) nxt += dir;
        if (nxt >=0 && nxt < pages.length) {
          pages[nxt].selected = true;
          if (!e.shiftKey) pages.forEach((x,k)=> { if (k!==nxt) x.selected=false; });
          currentPage = pages[nxt];
          lastSelectedIdx = nxt;
          refreshSelectionUI();
          renderMainPage();
          // focus new element
          requestAnimationFrame(()=>{ const el = pages[nxt].el; if(el) el.focus(); });
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        // remove selected
        const sel = getSelected();
        if (sel.length) { sel.forEach(s=> s.removed = true); pushHistory('remove'); renderPages(); renderMainPage(); }
      } else if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        rotateSelected();
      }
    });

    $$('[data-mv]', item).forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        const d = +b.dataset.mv;
        const j = i + d;
        if (j < 0 || j >= pages.length) return;
        pushHistory('move');
        const movedPage = pages[i];
        // if multiple selected and moved page is selected, move block together
        const selectedIndices = pages.map((pg, idx) => pg.selected ? idx : -1).filter(idx=> idx!==-1).sort((a,b)=>a-b);
        if (movedPage.selected && selectedIndices.length > 1) {
          // block move: simple implementation move block by one
          if (d === -1) {
            if (selectedIndices[0] === 0) return;
            // remove block and insert one position earlier
            const block = selectedIndices.map(idx=> pages[idx]);
            // remove from high to low to not shift
            for (let k=selectedIndices.length-1;k>=0;k--) pages.splice(selectedIndices[k],1);
            const insertAt = selectedIndices[0] -1;
            pages.splice(insertAt, 0, ...block);
          } else {
            if (selectedIndices[selectedIndices.length-1] === pages.length-1) return;
            const block = selectedIndices.map(idx=> pages[idx]);
            for (let k=selectedIndices.length-1;k>=0;k--) pages.splice(selectedIndices[k],1);
            const insertAt = selectedIndices[0] + 1;
            if (insertAt > pages.length) pages.push(...block);
            else pages.splice(insertAt, 0, ...block);
          }
        } else {
          [pages[i], pages[j]] = [pages[j], pages[i]];
        }
        pushHistory('move-commit');
        renderPages();
      });
    });

    $('[data-rot]', item).addEventListener('click', e => {
      e.stopPropagation();
      p.rotation = (p.rotation + 90) % 360;
      pushHistory('rotate');
      refreshSelectionUI();
      if (p === currentPage) renderMainPage();
      else updateToolbar();
    });

    $('[data-rm]', item).addEventListener('click', e => {
      e.stopPropagation();
      const sel = p.selected ? getSelected() : [p];
      const willRemove = sel.some(s=> !s.removed);
      sel.forEach(s => s.removed = willRemove);
      pushHistory(willRemove?'remove':'restore');
      refreshSelectionUI();
      if (sel.includes(currentPage)) renderMainPage();
      else updateToolbar();
    });

    // checkbox click area
    check.addEventListener('click', e => {
      e.stopPropagation();
      p.selected = !p.selected;
      lastSelectedIdx = i;
      refreshSelectionUI();
    });

    item.addEventListener('dragstart', e => {
      // if dragging a selected item, drag block
      dragIdx = i;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', String(i)); } catch {}
      // ghost image offset
      if (e.dataTransfer.setDragImage) {
        try { e.dataTransfer.setDragImage(item, 20, 20); } catch {}
      }
    });
    item.addEventListener('dragend', () => { item.classList.remove('dragging'); });
    item.addEventListener('dragover', e => { e.preventDefault(); item.classList.add('drag-over'); });
    item.addEventListener('dragleave', () => { item.classList.remove('drag-over'); });
    item.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation();
      item.classList.remove('drag-over');
      if (dragIdx === null) return;
      if (dragIdx === i) { dragIdx = null; return; }
      pushHistory('reorder');
      const from = dragIdx;
      const to = i;
      const movedPage = pages[from];
      const isBlock = movedPage.selected && pages.filter(p=>p.selected).length>1;
      if (isBlock) {
        const selectedIndices = pages.map((pg,idx)=> pg.selected? idx:-1).filter(idx=> idx!==-1).sort((a,b)=>a-b);
        const block = selectedIndices.map(idx=> pages[idx]);
        // remove block
        for (let k=selectedIndices.length-1;k>=0;k--) pages.splice(selectedIndices[k],1);
        // adjust target index for removal
        let target = to;
        // count selected before target
        const before = selectedIndices.filter(idx=> idx < to).length;
        target = to - before;
        if (from < to) target = Math.max(0, target);
        pages.splice(target, 0, ...block);
      } else {
        const [moved] = pages.splice(from, 1);
        pages.splice(to, 0, moved);
      }
      dragIdx = null;
      pushHistory('reorder-commit');
      renderPages();
    });

    return item;
  }

  function renderPages() {
    // preserve focus uid and scroll positions to avoid jump
    const activeUid = document.activeElement && document.activeElement.closest('.pe2-page') ? pages.find(p=> p.el===document.activeElement.closest('.pe2-page'))?.uid : null;
    const scrollTop = pagesEl.scrollTop;
    const scrollLeft = pagesEl.scrollLeft;
    // Use DocumentFragment to reduce reflows
    const frag = document.createDocumentFragment();
    // Clear quickly but keep thumb canvases detached safely
    pagesEl.innerHTML = '';
    pages.forEach((p, i) => {
      // reuse existing el if possible? For now recreate but use fragment
      p.el = createPageEl(p, i);
      if (!p.hiddenByFilter) frag.appendChild(p.el);
    });
    pagesEl.appendChild(frag);
    // restore scroll and focus
    pagesEl.scrollTop = scrollTop;
    pagesEl.scrollLeft = scrollLeft;
    if (activeUid) {
      const pg = pages.find(p=> p.uid===activeUid);
      if (pg && pg.el) pg.el.focus({preventScroll:true});
    }
    updateToolbar();
  }
  function refreshSelectionUI() {
    // Lightweight update without rebuilding DOM — toggle classes only
    pages.forEach(p=>{
      if (!p.el || p.hiddenByFilter) return;
      p.el.classList.toggle('selected', !!p.selected);
      p.el.classList.toggle('active', p === currentPage);
      p.el.classList.toggle('removed', !!p.removed);
      p.el.setAttribute('aria-selected', String(!!p.selected));
      const chk = p.el.querySelector('.pe2-check');
      if (chk) { chk.classList.toggle('on', !!p.selected); chk.textContent = p.selected ? '✓' : ''; }
      // rotation badge
      const rotBadge = p.el.querySelector('.pe2-rot-badge');
      if (p.rotation && !rotBadge) {
        const wrap = p.el.querySelector('.pe2-thumb-wrap');
        if (wrap) { const b=document.createElement('span'); b.className='pe2-rot-badge'; b.textContent=`${p.rotation}°`; wrap.appendChild(b); }
      } else if (!p.rotation && rotBadge) rotBadge.remove();
      const container = p.el.querySelector('.pe2-thumb-container');
      if (container) container.style.transform = p.rotation ? `rotate(${p.rotation}deg)` : '';
      if (p.thumb) p.thumb.style.transform = '';
    });
    updateToolbar();
  }

  /* ---------- File loading ---------- */

  async function addFiles(fileList) {
    const incomingRaw = [...fileList];
    const incoming = incomingRaw.filter(f => {
      const name = (f.name || '').toLowerCase();
      const type = (f.type || '').toLowerCase();
      return name.endsWith('.pdf') || type === 'application/pdf';
    });
    const rejected = fileList.length - incoming.length;
    if (rejected > 0) toast(`Skipped ${rejected} non-PDF file${rejected === 1 ? '' : 's'}.`, 'error');

    // size guard per file
    const oversize = incoming.filter(f=> f.size > MAX_FILE_SIZE);
    if (oversize.length) {
      toast(`${oversize.length} file${oversize.length>1?'s':''} exceed 250 MB and were skipped.`, 'error');
    }
    let filteredIncoming = incoming.filter(f=> f.size <= MAX_FILE_SIZE);
    if (!filteredIncoming.length) { if (incoming.length) toast('No valid PDFs to add.', 'info'); return; }
    // total size guard (> 400 MB combined may crash low-memory devices)
    const currentTotal = docs.reduce((s,d)=> s + (d.file?.size||0), 0);
    const incomingTotal = filteredIncoming.reduce((s,f)=> s + f.size, 0);
    if (currentTotal + incomingTotal > 400 * 1024 * 1024) {
      // keep only files that fit within limit
      let budget = 400 * 1024 * 1024 - currentTotal;
      const keep = [];
      for (const f of filteredIncoming) {
        if (f.size <= budget) { keep.push(f); budget -= f.size; }
        else { toast(`Skipped “${f.name}” — combined size would exceed 400 MB limit for stability.`, 'error'); }
      }
      filteredIncoming = keep;
      if (!filteredIncoming.length) { toast('Cannot add more — workspace already near 400 MB limit. Remove some pages or clear first.', 'error'); return; }
    }
    // total pages guard
    if (pages.length >= PE_PREVIEW_CAP) {
      toast(`Workspace already at ${PE_PREVIEW_CAP} previewed pages. Use Clear or remove pages before adding more.`, 'error');
      return;
    }

    if (!filteredIncoming.length) return;

    const loadToken = ++pageToken;
    main.innerHTML = `
      <div class="pe2-loading">
        <span class="spinner" aria-hidden="true"></span>
        <span id="pe2LoadMsg">Loading PDF…</span>
      </div>
    `;
    const setMsg = m => {
      if (loadToken !== pageToken) return;
      const el = $('#pe2LoadMsg', main);
      if (el) el.textContent = m;
    };

    let addedPages = 0;
    for (const file of filteredIncoming) {
      if (loadToken !== pageToken) break; // cancelled
      if (pages.length >= PE_PREVIEW_CAP) {
        toast(`Preview limited to ${PE_PREVIEW_CAP} pages. Remaining pages will be available on download but not in preview. Use Split to manage large docs.`, 'info', 5600);
        break;
      }
      try {
        setMsg(`Reading “${file.name}”…`);
        const buf = await file.arrayBuffer();
        let libDoc;
        try { libDoc = await pdfLoad(buf); }
        catch (e) { toast(`“${file.name}”: ${friendly(e)}`, 'error'); continue; }
        const count = libDoc.getPageCount();
        if (count === 0) { toast(`“${file.name}” has no pages.`, 'error'); continue; }
        const docIdx = docs.length;
        docs.push({ file, buf, libDoc, count, color: DOC_COLORS[docIdx % DOC_COLORS.length] });

        const remaining = PE_PREVIEW_CAP - pages.length;
        const take = Math.min(count, remaining);
        setMsg(`Rendering ${take} preview${take===1?'':'s'} from “${file.name}”…`);
        let res;
        try { res = await renderPdfThumbs(buf, { maxW: 140, maxPages: take }); }
        catch (e) { toast(`Could not render previews for “${file.name}”: ${friendly(e)}`, 'error'); res = { items: [] }; }

        res.items.forEach(it => {
          pages.push({
            uid: uid(),
            docIdx,
            page: it.page,
            thumb: it.canvas,
            removed: false,
            selected: false,
            rotation: 0,
            hiddenByFilter: false,
            el: null
          });
        });
        addedPages += res.items.length;
        if (count > take) {
          // Limit extra placeholder pages to keep DOM/memory light — show at most 50 hidden count notice
          const remaining = count - take;
          const maxPlaceholders = Math.min(remaining, 30);
          if (remaining > maxPlaceholders) {
            toast(`Only first ${take} of ${count} pages from “${file.name}” loaded. ${remaining - maxPlaceholders} additional pages not previewed but will be included on export.`, 'info', 6000);
          } else {
            toast(`Only first ${take} of ${count} pages from “${file.name}” shown in preview.`, 'info', 5600);
          }
          // Create lightweight placeholders (small canvas) for up to maxPlaceholders to avoid memory bloat
          for (let p = take+1; p <= take + maxPlaceholders; p++) {
            const placeholder = document.createElement('canvas');
            // very small placeholder to save memory — scaled via CSS
            placeholder.width = 40; placeholder.height = 55;
            const ctx = placeholder.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#fff'; ctx.fillRect(0,0,40,55);
              ctx.fillStyle = '#94a3b8'; ctx.font = '7px sans-serif'; ctx.textAlign = 'center';
              ctx.fillText(`P${p}`, 20, 28);
              ctx.fillStyle = '#cbd5e1'; ctx.font = '5px sans-serif';
              ctx.fillText('(preview limit)', 20, 36);
            }
            placeholder.style.width = '100%';
            placeholder.style.height = 'auto';
            pages.push({
              uid: uid(),
              docIdx,
              page: p,
              thumb: placeholder,
              removed: false,
              selected: false,
              rotation: 0,
              hiddenByFilter: false,
              el: null,
              isPlaceholder: true
            });
          }
          // For remaining pages beyond maxPlaceholders, keep them as virtual entries without thumb nodes
          // They will still be respected on export via docs[count] but not shown. Track virtual count.
          if (remaining > maxPlaceholders) {
            const virtualStart = take + maxPlaceholders + 1;
            // store virtual range on doc for export handling
            docs[docIdx].virtualFrom = virtualStart;
            docs[docIdx].virtualTo = count;
          }
        }
      } catch (e) {
        toast(friendly(e), 'error');
      }
      await tick();
    }

    if (addedPages > 0 || pages.length) {
      pushHistory('add-files');
    }
    if (!currentPage && pages.length) {
      currentPage = pages.find(p=> !p.hiddenByFilter) || pages[0];
      pages.forEach(p=> p.selected = false);
      if (currentPage) currentPage.selected = true;
      lastSelectedIdx = pages.indexOf(currentPage);
    }
    applyFilter();
    renderPages();
    if (currentPage) renderMainPage(); else renderMainEmpty();
    updateToolbar();
  }

  /* ---------- PDF building ---------- */

  async function buildPdf(filterFn, opts={}) {
    needPdfLib();
    const kept = pages.filter(p => !p.removed && filterFn(p));
    if (!kept.length) throw new ToolError('No pages are available for this action.');
    const out = await PDFLib.PDFDocument.create();
    for (let i=0;i<kept.length;i++) {
      const p = kept[i];
      if (p.isBlank) {
        const sz = p.blankSize || [595.28, 841.89];
        const pg = out.addPage(sz);
        if (p.rotation) pg.setRotation(PDFLib.degrees(p.rotation % 360));
        continue;
      }
      const src = docs[p.docIdx]?.libDoc;
      if (!src) continue;
      const [copied] = await out.copyPages(src, [p.page-1]);
      if (p.rotation) copied.setRotation(PDFLib.degrees(p.rotation % 360));
      out.addPage(copied);
      if (i % 4 === 0) await tick();
    }
    return out.save({ useObjectStreams: true });
  }

  async function buildPdfWithBlankPages() {
    needPdfLib();
    const out = await PDFLib.PDFDocument.create();
    let added = 0;
    // Track which docs have virtual pages pending insertion after their last visible page
    const virtualInserted = new Set();
    for (let i=0;i<pages.length;i++) {
      const p = pages[i];
      if (p.removed) {
        // still check if this was last page of its doc, to insert virtual after it even if removed? Only if all remaining removed, virtual shouldn't be hidden.
        // We'll handle virtual insertion at doc boundary after loop below to be safe.
      } else if (p.isBlank) {
        const sz = p.blankSize || [595.28, 841.89];
        const pg = out.addPage(sz);
        if (p.rotation) pg.setRotation(PDFLib.degrees(p.rotation % 360));
        added++;
      } else {
        const src = docs[p.docIdx]?.libDoc;
        if (src && p.page >=1 && p.page <= src.getPageCount()) {
          const [copied] = await out.copyPages(src, [p.page-1]);
          if (p.rotation) copied.setRotation(PDFLib.degrees(p.rotation % 360));
          out.addPage(copied);
          added++;
        }
      }
      if (i % 4 === 0) await tick();
      // after processing this index, check if next page switches doc or is end, then insert virtual for current doc
      const curDocIdx = p.docIdx;
      const nextDocIdx = pages[i+1]?.docIdx;
      if (curDocIdx >=0 && curDocIdx !== nextDocIdx) {
        const d = docs[curDocIdx];
        if (d && d.virtualFrom && !virtualInserted.has(curDocIdx)) {
          // only append virtual if not already inserted and not removed? Virtual pages are always kept unless doc was virtually removed? For now always kept.
          for (let vp = d.virtualFrom; vp <= d.virtualTo; vp++) {
            const src = d.libDoc;
            if (!src) break;
            if (vp <1 || vp > src.getPageCount()) continue;
            const [copied] = await out.copyPages(src, [vp-1]);
            out.addPage(copied);
            added++;
            if (added % 8 === 0) await tick();
          }
          virtualInserted.add(curDocIdx);
        }
      }
    }
    // Handle docs that had no visible pages at all (edge) or virtual docs whose pages were all filtered via placeholder limit
    for (let di=0; di<docs.length; di++) {
      const d = docs[di];
      if (d && d.virtualFrom && !virtualInserted.has(di)) {
        // check if any page of this doc was in pages (if doc was fully truncated beyond cap and we had zero placeholders? we still inserted 30, so would have been handled)
        // fallback: append at end
        for (let vp = d.virtualFrom; vp <= d.virtualTo; vp++) {
          const src = d.libDoc;
          if (!src) break;
          const [copied] = await out.copyPages(src, [vp-1]);
          out.addPage(copied);
          added++;
        }
      }
    }
    if (added===0) throw new ToolError('No pages to export.');
    return out.save({ useObjectStreams: true });
  }

  /* ---------- Tool actions ---------- */

  function getOutputFileName(fallback) {
    const raw = (els.fileName.value || '').trim();
    const sanitized = sanitizeName(raw || fallback);
    if (!sanitized.toLowerCase().endsWith('.pdf')) return sanitized + '.pdf';
    return sanitized;
  }

  async function exportSelectedImages() {
    const sel = getSelected().filter(p=> !p.removed);
    if (!sel.length) { toast('Select at least one active page.', 'info'); return; }
    if (sel.length === 1) {
      await exportCurrentImageSingle(sel[0]);
    } else {
      await exportMultipleImages(sel);
    }
  }

  async function exportCurrentImageSingle(p) {
    const status = toolPane(selCountLabel('Page → Image'));
    const setMsg = loading(status, 'Rendering image…');
    try {
      const cv = await renderBigPage(p, PE_PAGE_RENDER_MAX);
      setMsg('Encoding…');
      // allow format selection: detect zoom select? For now JPG 92%
      const blob = await canvasToBlob(cv, 'image/jpeg', 0.92);
      const url = URL.createObjectURL(blob); objectUrls.push(url);
      successOut(status, {
        title: 'Image ready',
        msg: `Page ${p.page} (F${p.docIdx+1}) rendered locally.`,
        downloads: [{ blob, name: `page-${p.docIdx+1}-${p.page}.jpg`, label: 'Download JPG' }],
        extraHtml: `<div class="duo-preview"><figure><img src="${url}" alt="Preview"><figcaption>P${p.page} · ${p.rotation? p.rotation+'°':''}</figcaption></figure></div>`
      });
    } catch(e){ errorOut(status, friendly(e), e); }
  }

  async function exportMultipleImages(sel) {
    if (sel.length > 60) {
      toast(`You selected ${sel.length} pages — bulk image export is capped at 60 to keep your browser stable. Use Split to batch in groups.`, 'error', 6000);
      return;
    }
    // auto-lower scale for many pages to avoid OOM
    let defaultScale = '1.5';
    if (sel.length > 30) defaultScale = '1';
    else if (tier === 'low' && sel.length > 15) defaultScale = '1';
    if (sel.length > 25) toast(`Large selection (${sel.length} pages) — using lower resolution to keep your browser stable.`, 'info', 5000);
    const status = toolPane(`Export ${sel.length} pages → Images`);
    const ctl = document.createElement('div');
    ctl.innerHTML = `
      <div class="controls-grid" style="margin-bottom:12px">
        <div class="field"><label>Format</label><select id="peBulkFmt"><option value="image/jpeg" selected>JPG</option><option value="image/png">PNG</option></select></div>
        <div class="field range-field"><label>Quality — <span class="range-val" id="peBulkQVal">92%</span></label><input type="range" id="peBulkQ" min="30" max="100" value="92"></div>
        <div class="field"><label>Scale</label><select id="peBulkScale"><option value="1" ${defaultScale==='1'?'selected':''}>1×</option><option value="1.5" ${defaultScale==='1.5'?'selected':''}>1.5×</option><option value="2">2×</option></select></div>
      </div>
      <div class="tool-actions" style="margin:0 0 12px">
        <button class="btn btn-primary" id="peBulkZip">📦 Download ZIP</button>
        <button class="btn btn-ghost" id="peBulkEach">⬇ Download each</button>
      </div>
      <p class="tool-note">Tip: ZIP is built fully in your browser via JSZip — nothing uploaded.</p>
    `;
    status.appendChild(ctl);
    const preview = document.createElement('div');
    preview.className = 'thumb-grid';
    preview.style.marginTop = '12px';
    status.appendChild(preview);

    const fmtSel = $('#peBulkFmt', ctl);
    const qRange = $('#peBulkQ', ctl);
    const qVal = $('#peBulkQVal', ctl);
    const scaleSel = $('#peBulkScale', ctl);
    qRange.addEventListener('input', ()=> qVal.textContent = qRange.value+'%');
    fmtSel.addEventListener('change', ()=> { qRange.disabled = fmtSel.value==='image/png'; ctl.querySelector('.range-field').style.opacity = fmtSel.value==='image/png'?'.5':'1'; });

    let results = [];
    let running = false;

    async function generatePreviews() {
      if (running) return;
      running = true;
      results = [];
      preview.innerHTML = '<div class="loader-line"><span class="spinner"></span><span class="load-msg">Rendering previews…</span></div>';
      const blobs = [];
      for (let i=0;i<sel.length;i++) {
        const p = sel[i];
        const cv = await renderBigPage(p, Number(scaleSel.value) || 1.5);
        const fmt = fmtSel.value;
        const q = Number(qRange.value)/100;
        const blob = await canvasToBlob(cv, fmt, fmt==='image/png'?undefined:q);
        const ext = fmt==='image/png' ? 'png' : 'jpg';
        const name = `page-${p.docIdx+1}-${p.page}.${ext}`;
        blobs.push({blob, name, canvas: cv});
        await tick();
      }
      results = blobs;
      preview.innerHTML = '';
      blobs.forEach(b=>{
        const cell = document.createElement('div');
        cell.className = 'thumb';
        cell.appendChild(b.canvas);
        cell.insertAdjacentHTML('beforeend', `<div class="th-bar" style="justify-content:center"><span>${esc(b.name)} · ${humanSize(b.blob.size)}</span></div>`);
        preview.appendChild(cell);
      });
      running = false;
    }
    // initial
    generatePreviews();
    fmtSel.addEventListener('change', generatePreviews);
    qRange.addEventListener('change', generatePreviews);
    scaleSel.addEventListener('change', generatePreviews);

    $('#peBulkZip', ctl).onclick = async () => {
      if (!results.length) { toast('No images rendered yet.', 'info'); return; }
      if (!window.JSZip) { toast('ZIP engine not loaded — downloading individually.', 'info'); await downloadMany(results); return; }
      const btn = $('#peBulkZip', ctl);
      btn.disabled = true; btn.textContent = 'Packing… 0%';
      try {
        const zip = new JSZip();
        results.forEach(r=> zip.file(r.name, r.blob));
        const blob = await zip.generateAsync({type:'blob'}, meta=>{ btn.textContent = `Packing… ${Math.round(meta.percent)}%`; });
        btn.disabled=false; btn.textContent='📦 Download ZIP';
        downloadBlob(blob, `studyvault-pages-${sel.length}.zip`);
        toast(`ZIP downloaded (${humanSize(blob.size)})`, 'success');
      } catch(e){ btn.disabled=false; btn.textContent='📦 Download ZIP'; toast('ZIP failed — try individual.', 'error'); }
    };
    $('#peBulkEach', ctl).onclick = async ()=> {
      if (!results.length) return;
      toast('Downloading individually — may ask permission.', 'info');
      await downloadMany(results);
    };
  }

  async function exportCurrentImage() { return exportSelectedImages(); }

  async function quickCopyText(p) {
    const status = toolPane('Quick Text Copy');
    const setMsg = loading(status, 'Extracting text…');
    try {
      const js = await getJsDoc(p.docIdx);
      const pg = await js.getPage(p.page);
      const content = await pg.getTextContent();
      const text = content.items.map(i=> i.str).join(' ');
      if (!text.trim()) {
        status.innerHTML = `<div class="panel-err"><span>ℹ️</span><div><b>No selectable text</b><p>This page is scanned/image-based.</p></div></div>`;
        return;
      }
      // show in textarea with copy button
      status.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:10px">
          <textarea id="peQuickTxt" style="width:100%;min-height:160px;padding:12px;border-radius:12px;border:1px solid var(--stroke);background:rgba(255,255,255,.05);font-size:.92rem;white-space:pre-wrap" readonly>${esc(text)}</textarea>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" id="peCopyBtn">📋 Copy</button>
            <button class="btn btn-ghost btn-sm" id="peDlTxtBtn">⬇ Download TXT</button>
            <button class="btn btn-ghost btn-sm" id="peCloseQ">Close</button>
          </div>
        </div>
      `;
      $('#peCopyBtn', status).onclick = async ()=> {
        try { await navigator.clipboard.writeText(text); toast('Copied to clipboard', 'success'); }
        catch { const ta=$('#peQuickTxt',status); ta.select(); document.execCommand('copy'); toast('Copied', 'success'); }
      };
      $('#peDlTxtBtn', status).onclick = ()=> {
        const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
        downloadBlob(blob, `page-${p.page}-text.txt`);
      };
      $('#peCloseQ', status).onclick = ()=> renderMainPage();
    } catch(e){ errorOut(status, friendly(e), e); }
  }

  function selCountLabel(base) {
    const n = getSelected().length;
    return n>1 ? `${base} (${n} pages)` : base;
  }

  async function extractSelectedText() {
    const sel = getSelected().filter(p=> !p.removed);
    if (!sel.length) { toast('Select at least one active page.', 'info'); return; }
    if (sel.length === 1) { await extractCurrentTextSingle(sel[0]); return; }
    await extractBulkText(sel);
  }

  async function extractCurrentTextSingle(p) {
    const status = toolPane('Extract Text');
    const setMsg = loading(status, 'Extracting text…');
    try {
      const js = await getJsDoc(p.docIdx);
      const pg = await js.getPage(p.page);
      const content = await pg.getTextContent();
      const text = content.items.map(i=> i.str).join(' ');
      if (!text.trim()) {
        status.innerHTML = `<div class="panel-err"><span>ℹ️</span><div><b>No selectable text found</b><p>This page may be scanned or image-based.</p></div></div>`;
        return;
      }
      const full = `--- Page ${p.page} (File ${p.docIdx+1}) ---\n\n${text}`;
      const blob = new Blob([full], {type:'text/plain;charset=utf-8'});
      const preview = text.length > 2000 ? text.slice(0,2000)+'…' : text;
      successOut(status, {
        title: 'Text extracted',
        msg: `From F${p.docIdx+1} P${p.page} • ${text.split(/\s+/).length} words`,
        downloads: [{ blob, name: `page-${p.docIdx+1}-${p.page}-text.txt`, label: 'Download TXT' }],
        extraHtml: `<pre class="pe2-text-preview">${esc(preview)}</pre>
          <div style="margin-top:10px;display:flex;gap:8px;justify-content:center"><button class="btn btn-ghost btn-sm" id="peCopyAll">📋 Copy all</button></div>`
      });
      setTimeout(()=>{
        const b = $('#peCopyAll', status);
        if(b) b.onclick = async ()=> {
          try{ await navigator.clipboard.writeText(text); toast('Copied', 'success'); }catch{ toast('Copy failed', 'error'); }
        };
      },0);
    } catch(e){ errorOut(status, friendly(e), e); }
  }

  async function extractBulkText(sel) {
    const status = toolPane(`Extract Text — ${sel.length} pages`);
    const setMsg = loading(status, 'Extracting…');
    try {
      const parts = [];
      let totalWords = 0;
      for (let i=0;i<sel.length;i++) {
        const p = sel[i];
        setMsg(`Reading page ${i+1} of ${sel.length} (F${p.docIdx+1} P${p.page})…`);
        const js = await getJsDoc(p.docIdx);
        const pg = await js.getPage(p.page);
        const content = await pg.getTextContent();
        const text = content.items.map(it=> it.str).join(' ');
        parts.push(`--- File ${p.docIdx+1} · Page ${p.page} ---\n${text || '[no selectable text]'}`);
        totalWords += text.split(/\s+/).filter(Boolean).length;
        await tick();
      }
      const full = parts.join('\n\n');
      const blob = new Blob([full], {type:'text/plain;charset=utf-8'});
      const preview = full.slice(0, 3000) + (full.length>3000?'…':'');
      successOut(status, {
        title: 'Text extracted',
        msg: `${sel.length} pages • ${totalWords} words extracted locally (no upload).`,
        downloads: [{ blob, name: `studyvault-${sel.length}-pages-text.txt`, label: 'Download TXT' }],
        extraHtml: `<pre class="pe2-text-preview">${esc(preview)}</pre>`
      });
    } catch(e){ errorOut(status, friendly(e), e); }
  }

  async function extractCurrentText(){ return extractSelectedText(); }

  async function extractCurrentPage() {
    const sel = getSelected().filter(p=> !p.removed);
    if (!sel.length) { toast('Select active page(s) first.', 'info'); return; }
    const status = toolPane(sel.length===1 ? 'Extract Page' : `Extract ${sel.length} Pages`);
    const setMsg = loading(status, 'Extracting…');
    try {
      const bytes = await buildPdfWithBlankPagesFiltered(sel);
      const blob = new Blob([bytes], {type:'application/pdf'});
      successOut(status, {
        title: sel.length===1 ? 'Page extracted' : `${sel.length} pages extracted`,
        msg: `${sel.length} page${sel.length===1?'':'s'} saved as new PDF (${humanSize(blob.size)}).`,
        downloads: [{ blob, name: sel.length===1 ? `page-${sel[0].page}.pdf` : `extracted-${sel.length}-pages.pdf`, label: 'Download PDF' }]
      });
    } catch(e){ errorOut(status, friendly(e), e); }
  }

  async function buildPdfWithBlankPagesFiltered(only) {
    needPdfLib();
    const out = await PDFLib.PDFDocument.create();
    for (const p of only) {
      if (p.isBlank) {
        const sz = p.blankSize || [595.28,841.89];
        const pg = out.addPage(sz);
        if (p.rotation) pg.setRotation(PDFLib.degrees(p.rotation % 360));
        continue;
      }
      const src = docs[p.docIdx]?.libDoc;
      if (!src) continue;
      const [copied] = await out.copyPages(src, [p.page-1]);
      if (p.rotation) copied.setRotation(PDFLib.degrees(p.rotation % 360));
      out.addPage(copied);
    }
    return out.save({ useObjectStreams: true });
  }

  async function applyAndDownload() {
    const status = toolPane('Apply & Download');
    const setMsg = loading(status, 'Building final PDF…');
    try {
      const bytes = await buildPdfWithBlankPages();
      const blob = new Blob([bytes], {type:'application/pdf'});
      const kept = pages.filter(p=> !p.removed).length;
      const name = getOutputFileName(`studyvault-${kept}pages.pdf`);
      successOut(status, {
        title: 'PDF ready',
        msg: `${kept} page${kept===1?'':'s'} exported in current order (${humanSize(blob.size)}).`,
        downloads: [{ blob, name, label: 'Download PDF' }]
      });
    } catch(e){ errorOut(status, friendly(e), e); }
  }

  async function compressWorkspace() {
    const status = toolPane('Compress PDF');
    // add preset selector
    const chooser = document.createElement('div');
    chooser.innerHTML = `
      <div class="controls-grid" style="margin-bottom:12px">
        <div class="field"><label>Strength</label>
          <select id="peCmpPreset">
            <option value="auto" selected>Auto (try all, pick smallest)</option>
            <option value="balanced">Balanced</option>
            <option value="strong">Strong</option>
            <option value="aggressive">Aggressive</option>
          </select>
        </div>
      </div>
      <p class="tool-note" style="margin:0">Auto tries Balanced → Strong → Aggressive and keeps the smallest that is actually smaller.</p>
    `;
    status.appendChild(chooser);
    const bodyStatus = document.createElement('div');
    bodyStatus.className = 'tool-status';
    status.appendChild(bodyStatus);
    const setMsg = loading(bodyStatus, 'Building current PDF…');
    const presetSel = $('#peCmpPreset', chooser);
    const presetVal = presetSel.value;
    presetSel.addEventListener('change', ()=> {
      // re-run with new preset without stacking toolPanes
      setTimeout(()=> compressWorkspace(), 0);
    });

    try {
      const bytes = await buildPdfWithBlankPages();
      const currentSize = peSize(bytes);
      let result;
      if (presetVal === 'auto') {
        result = await compressPdfSmart(bytes, m=> setMsg(m));
      } else {
        const map = {
          balanced: {q:0.62, scale:0.90, maxSide:1600},
          strong: {q:0.48, scale:0.72, maxSide:1350},
          aggressive: {q:0.36, scale:0.55, maxSide:1100}
        };
        const pr = map[presetVal];
        setMsg(`Compressing (${presetVal})…`);
        const out = await compressPdfBytesV2(bytes, pr.q, pr.scale, pr.maxSide, m=> setMsg(m));
        const sz = peSize(out);
        if (sz < currentSize) result = { bytes: out, size: sz, reduced: true };
        else result = { bytes: bytes, size: currentSize, reduced: false };
      }
      if (!result.reduced) {
        const blob = new Blob([bytes], {type:'application/pdf'});
        successOut(bodyStatus, {
          title: 'No compression possible',
          msg: 'This PDF would not get smaller at this quality. Try Aggressive if quality loss is OK, or download current version.',
          downloads: [{ blob, name: getOutputFileName('studyvault-current.pdf'), label: 'Download Current PDF' }]
        });
        return;
      }
      const blob = new Blob([result.bytes], {type:'application/pdf'});
      const cmp = compareHTML(currentSize, blob.size, 'Before', 'After');
      successOut(bodyStatus, {
        title: 'Compressed PDF ready',
        msg: `Saved ${humanSize(currentSize - blob.size)} (${((1-blob.size/currentSize)*100).toFixed(1)}%) locally.`,
        downloads: [{ blob, name: getOutputFileName('studyvault-compressed.pdf'), label: 'Download Compressed PDF' }],
        extraHtml: cmp
      });
      animateBars(bodyStatus);
    } catch(e){ errorOut(bodyStatus, friendly(e), e); }
  }

  function showInfo() {
    const status = toolPane('Workspace Info');
    if (!docs.length) {
      status.innerHTML = `<div class="empty-state"><div class="es-ic">📄</div><b>No PDFs loaded</b><p>Add PDFs to see details.</p></div>`;
      return;
    }
    const totalInput = docs.reduce((a,d)=> a + d.file.size, 0);
    const kept = pages.filter(p=> !p.removed).length;
    const removed = pages.filter(p=> p.removed).length;
    const rotated = pages.filter(p=> p.rotation).length;
    const blank = pages.filter(p=> p.isBlank && !p.removed).length;
    status.innerHTML = `
      <div class="stat-grid" style="max-width:760px">
        <div class="stat-tile"><b>${docs.length}</b><span>PDF files</span></div>
        <div class="stat-tile"><b>${pages.length}</b><span>Loaded pages</span></div>
        <div class="stat-tile"><b>${kept}</b><span>Kept pages</span></div>
        <div class="stat-tile"><b>${removed}</b><span>Removed</span></div>
        <div class="stat-tile"><b>${rotated}</b><span>Rotated</span></div>
        <div class="stat-tile"><b>${blank}</b><span>Blank pages</span></div>
        <div class="stat-tile"><b>${humanSize(totalInput)}</b><span>Total input</span></div>
        <div class="stat-tile"><b>${humanSize(pages.filter(p=>!p.removed).reduce((s,p)=> s + (docs[p.docIdx]?.file.size||0)/ (docs[p.docIdx]?.count||1) ,0))}</b><span>~ kept est.</span></div>
      </div>
      <div style="overflow-x:auto; margin-top:16px">
        <table class="info-table">
          <thead><tr><th>#</th><th>File</th><th>Pages</th><th>Size</th><th>Color</th></tr></thead>
          <tbody>
            ${docs.map((d,i)=> `
              <tr>
                <td>F${i+1}</td>
                <td title="${esc(d.file.name)}"><span class="pe2-dot" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${d.color};vertical-align:middle;margin-right:6px"></span>${esc(d.file.name)}</td>
                <td>${d.count}</td>
                <td>${humanSize(d.file.size)}</td>
                <td><span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${d.color}"></span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" id="peInfoCopy">📋 Copy summary</button>
        <button class="btn btn-ghost btn-sm" id="peInfoExport">⬇ Export info TXT</button>
      </div>
      <p class="tool-note">Everything local. Colors help distinguish files on the left. Filter pages with the search above.</p>
    `;
    $('#peInfoCopy', status).onclick = async ()=> {
      const txt = `StudyVault workspace: ${docs.length} files, ${pages.length} pages, ${kept} kept\n` + docs.map((d,i)=>`F${i+1}: ${d.file.name} (${d.count} p, ${humanSize(d.file.size)})`).join('\n');
      try{ await navigator.clipboard.writeText(txt); toast('Summary copied', 'success'); }catch{ toast('Copy failed', 'error'); }
    };
    $('#peInfoExport', status).onclick = ()=> {
      const txt = `StudyVault — Workspace Info\nGenerated: ${new Date().toLocaleString()}\n\nFiles:\n` + docs.map((d,i)=> `  F${i+1}: ${d.file.name} — ${d.count} pages — ${humanSize(d.file.size)}`).join('\n') + `\n\nPages: ${pages.length} total, ${kept} kept, ${removed} removed, ${rotated} rotated\n`;
      downloadBlob(new Blob([txt],{type:'text/plain'}), 'workspace-info.txt');
    };
  }

  function showSplitDialog() {
    const status = toolPane('Split / Extract by Range');
    status.innerHTML = `
      <p class="tool-note" style="margin:0 0 12px">Extract pages by range. Examples: <code>1-3</code>, <code>1,3,5-7</code>, or leave empty for all kept pages.</p>
      <div class="controls-grid">
        <div class="field" style="flex:1;min-width:240px"><label>Pages / Range</label><input type="text" id="peSplitRange" placeholder="e.g. 1-3, 5, 8-10"></div>
        <div class="field"><label>Quick</label><div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-xs" id="peSplitOdd">Odd</button>
          <button class="btn btn-ghost btn-xs" id="peSplitEven">Even</button>
          <button class="btn btn-ghost btn-xs" id="peSplitAll">All kept</button>
        </div></div>
      </div>
      <div class="tool-actions" style="margin-top:12px">
        <button class="btn btn-primary" id="peSplitGo">✂️ Extract Range</button>
        <button class="btn btn-ghost" id="peSplitZip">Split into single-page PDFs (ZIP)</button>
      </div>
      <p class="tool-note">Ranges refer to the current order after reordering, not original file order. Blank pages count too.</p>
    `;
    const rangeInput = $('#peSplitRange', status);
    const totalKept = pages.filter(p=>!p.removed).length;
    // helper to fill odd/even
    $('#peSplitOdd', status).onclick = ()=> {
      const kept = pages.filter(p=>!p.removed);
      const odd = kept.filter((_,i)=> i%2===0).map((_,i)=> i*2+1); // positions 1-indexed in current order
      // But need to generate based on current kept order positions
      rangeInput.value = kept.map((_,idx)=> idx+1).filter(n=> n%2===1).join(',');
    };
    $('#peSplitEven', status).onclick = ()=> {
      const kept = pages.filter(p=>!p.removed);
      rangeInput.value = kept.map((_,idx)=> idx+1).filter(n=> n%2===0).join(',');
    };
    $('#peSplitAll', status).onclick = ()=> rangeInput.value = pages.filter(p=>!p.removed).map((_,i)=> i+1).join(',');

    $('#peSplitGo', status).onclick = async ()=> {
      const raw = rangeInput.value.trim();
      const kept = pages.filter(p=>!p.removed);
      let indices;
      try {
        if (!raw) indices = kept.map((_,i)=> i);
        else {
          const max = kept.length;
          const parsed = peParseRanges(raw, max);
          indices = parsed.map(n=> n-1);
        }
      } catch(e){ toast(friendly(e), 'error'); return; }
      const selected = indices.map(i=> kept[i]).filter(Boolean);
      if (!selected.length) { toast('No pages match that range.', 'info'); return; }
      const setMsg = loading(status, 'Building split PDF…');
      try {
        const bytes = await buildPdfWithBlankPagesFiltered(selected);
        const blob = new Blob([bytes], {type:'application/pdf'});
        successOut(status, {
          title: 'Split PDF ready',
          msg: `${selected.length} page${selected.length===1?'':'s'} extracted (${humanSize(blob.size)}).`,
          downloads: [{ blob, name: `split-${selected.length}pages.pdf`, label: 'Download PDF' }]
        });
      } catch(e){ errorOut(status, friendly(e), e); }
    };
    $('#peSplitZip', status).onclick = async ()=> {
      const kept = pages.filter(p=>!p.removed);
      if (!kept.length) { toast('No kept pages.', 'info'); return; }
      if (!window.JSZip) { toast('JSZip not loaded.', 'error'); return; }
      const setMsg = loading(status, 'Splitting into single pages…');
      try {
        const zip = new JSZip();
        for (let i=0;i<kept.length;i++) {
          setMsg(`Preparing page ${i+1} of ${kept.length}…`);
          const p = kept[i];
          const bytes = await buildPdfWithBlankPagesFiltered([p]);
          zip.file(`page-${String(i+1).padStart(3,'0')}-F${p.docIdx+1}-P${p.page}.pdf`, bytes);
          await tick();
        }
        setMsg('Packing ZIP…');
        const blob = await zip.generateAsync({type:'blob'}, meta=> setMsg(`Packing ${Math.round(meta.percent)}%`));
        status.innerHTML = '';
        successOut(status, {
          title: 'ZIP ready',
          msg: `${kept.length} single-page PDFs packed locally.`,
          downloads: [{ blob, name: `split-${kept.length}-pages.zip`, label: 'Download ZIP' }]
        });
      } catch(e){ errorOut(status, friendly(e), e); }
    };
  }

  function rotateSelected() {
    const sel = getSelected();
    if (!sel.length) { toast('Select pages to rotate.', 'info'); return; }
    pushHistory('rotate');
    sel.forEach(p=> p.rotation = (p.rotation + 90) % 360);
    pushHistory('rotate-commit');
    refreshSelectionUI();
    if (sel.includes(currentPage)) renderMainPage();
    else updateToolbar();
    toast(`Rotated ${sel.length} page${sel.length===1?'':'s'} 90°`, 'success', 2000);
  }

  function duplicateSelected() {
    const sel = getSelected();
    if (!sel.length) { toast('Select pages to duplicate.', 'info'); return; }
    if (pages.length + sel.length > PE_PREVIEW_CAP + 40) {
      toast(`Too many pages to duplicate (limit ~${PE_PREVIEW_CAP+40}).`, 'error');
      return;
    }
    pushHistory('duplicate');
    // insert duplicates right after each original in order indices
    // To keep block together, insert clones after the last selected index sequentially
    const lastIdx = Math.max(...sel.map(p=> pages.indexOf(p)));
    const clones = sel.map(p=> ({
      uid: uid(),
      docIdx: p.docIdx,
      page: p.page,
      thumb: p.thumb, // share canvas visually; better clone canvas visually by copying? For thumbnails sharing same canvas is okay but rotation may diverge; clone canvas element by drawing
      removed: false,
      selected: false,
      rotation: p.rotation,
      hiddenByFilter: false,
      el: null,
      isClone: true
    }));
    // deep clone canvas for thumb to allow independent rotation style later (avoid sharing element)
    clones.forEach((c,i)=>{
      const orig = sel[i].thumb;
      const cn = document.createElement('canvas');
      cn.width = orig.width; cn.height = orig.height;
      const ctx = cn.getContext('2d');
      try{ ctx.drawImage(orig,0,0); }catch{ cn.width=80; cn.height=110; }
      c.thumb = cn;
    });
    pages.splice(lastIdx+1, 0, ...clones);
    // select clones
    pages.forEach(p=> p.selected = false);
    clones.forEach(c=> c.selected = true);
    currentPage = clones[0];
    pushHistory('duplicate-commit');
    renderPages();
    renderMainPage();
    toast(`Duplicated ${clones.length} page${clones.length===1?'':'s'}`, 'success');
  }

  function insertBlank() {
    if (pages.length >= PE_PREVIEW_CAP + 40) { toast('Page limit reached.', 'error'); return; }
    pushHistory('insert-blank');
    const sel = getSelected();
    const idx = sel.length ? Math.max(...sel.map(p=> pages.indexOf(p))) : pages.length - 1;
    const insertAt = sel.length ? idx + 1 : pages.length;
    const cn = document.createElement('canvas');
    cn.width = 80; cn.height = 110;
    const ctx = cn.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,80,110);
    ctx.strokeStyle = '#aab'; ctx.strokeRect(0.5,0.5,79,109);
    ctx.fillStyle = '#667'; ctx.font = '8px sans-serif'; ctx.fillText('BLANK', 18, 55);
    const blankPage = {
      uid: uid(),
      docIdx: -1,
      page: 0,
      thumb: cn,
      removed: false,
      selected: true,
      rotation: 0,
      hiddenByFilter: false,
      el: null,
      isBlank: true,
      blankSize: [595.28, 841.89]
    };
    pages.forEach(p=> p.selected = false);
    pages.splice(insertAt, 0, blankPage);
    currentPage = blankPage;
    pushHistory('insert-blank-commit');
    renderPages();
    renderMainPage();
    toast('Blank page inserted', 'success');
  }

  function clearWorkspace() {
    if (pages.length && !confirm(`Clear ${pages.length} page${pages.length===1?'':'s'} from ${docs.length} file${docs.length===1?'':'s'}? This cannot be undone.`)) return;
    pageToken++;
    jsCache.forEach(js=> { try{ js.destroy(); }catch{} });
    jsCache.clear();
    objectUrls.forEach(u=> { try{ URL.revokeObjectURL(u); }catch{} });
    objectUrls = [];
    docs = []; pages = []; currentPage = null; dragIdx = null; lastSelectedIdx = -1;
    history = []; histIdx = -1;
    fileInput.value = '';
    pushHistory('clear');
    renderPages();
    renderMainEmpty();
    toast('Workspace cleared', 'info');
  }

  /* ---------- Events ---------- */

  els.add.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const list = fileInput.files;
    addFiles(list);
    fileInput.value = '';
  });

  // edit
  els.remove.addEventListener('click', ()=>{
    const sel = getSelected().filter(p=> !p.removed);
    if (!sel.length) return;
    pushHistory('remove');
    sel.forEach(p=> p.removed = true);
    pushHistory('remove-commit');
    renderPages(); renderMainPage();
  });
  els.restore.addEventListener('click', ()=>{
    const sel = getSelected().filter(p=> p.removed);
    if (!sel.length) return;
    pushHistory('restore');
    sel.forEach(p=> p.removed = false);
    pushHistory('restore-commit');
    renderPages(); renderMainPage();
  });
  els.rotate.addEventListener('click', rotateSelected);
  els.duplicate.addEventListener('click', duplicateSelected);
  els.blank.addEventListener('click', insertBlank);

  // export
  els.extract.addEventListener('click', extractCurrentPage);
  els.split.addEventListener('click', showSplitDialog);
  els.download.addEventListener('click', applyAndDownload);
  els.compress.addEventListener('click', compressWorkspace);
  els.image.addEventListener('click', exportSelectedImages);
  els.text.addEventListener('click', extractSelectedText);
  els.info.addEventListener('click', showInfo);
  els.clear.addEventListener('click', clearWorkspace);

  // sub bar
  els.selectAll.addEventListener('click', ()=>{
    const vis = pages.filter(p=> !p.hiddenByFilter);
    const allSelected = vis.length && vis.every(p=> p.selected);
    if (allSelected) vis.forEach(p=> p.selected=false);
    else vis.forEach(p=> p.selected=true);
    if (vis.length) { currentPage = vis[vis.length-1]; lastSelectedIdx = pages.indexOf(currentPage); }
    pushHistory('select-all');
    renderPages();
  });
  els.deselect.addEventListener('click', ()=>{
    pages.forEach(p=> p.selected=false);
    pushHistory('deselect');
    renderPages(); updateToolbar();
  });
  els.jump.addEventListener('change', ()=>{
    const n = Number(els.jump.value);
    if (!n || n<1 || n>pages.length) return;
    const target = pages[n-1];
    if (!target) return;
    pages.forEach(p=> p.selected=false);
    target.selected = true;
    currentPage = target; lastSelectedIdx = n-1;
    renderPages(); renderMainPage();
    // scroll into view
    requestAnimationFrame(()=> { if (target.el) target.el.scrollIntoView({block:'nearest', behavior:'smooth'}); });
  });
  els.jump.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); els.jump.dispatchEvent(new Event('change')); }});
  els.filter.addEventListener('input', e=> setFilter(e.target.value));
  els.filter.addEventListener('keydown', e=>{ if(e.key==='Escape'){ e.target.value=''; setFilter(''); }});

  // undo/redo
  els.undo.addEventListener('click', undo);
  els.redo.addEventListener('click', redo);

  // zoom
  function setZoom(v) {
    zoomMode = v;
    els.zoomSel.value = v;
    if (currentPage) renderMainPage();
  }
  els.zoomSel.addEventListener('change', e=> setZoom(e.target.value));
  els.zoomIn.addEventListener('click', ()=>{
    const order = ['fit','0.75','1','1.25','1.5','2'];
    let idx = order.indexOf(String(zoomMode));
    if (idx===-1) idx = order.indexOf('fit');
    if (idx < order.length-1) setZoom(order[idx+1]);
  });
  els.zoomOut.addEventListener('click', ()=>{
    const order = ['fit','0.75','1','1.25','1.5','2'];
    let idx = order.indexOf(String(zoomMode));
    if (idx===-1) idx = 2;
    if (idx>0) setZoom(order[idx-1]);
  });
  els.zoomReset.addEventListener('click', ()=> setZoom('fit'));

  // left sort
  els.sort.addEventListener('click', ()=>{
    pushHistory('sort');
    // sort by docIdx then page, but keep blanks relative? blanks have docIdx -1 sort last
    pages.sort((a,b)=>{
      if (a.isBlank && b.isBlank) return 0;
      if (a.isBlank) return 1;
      if (b.isBlank) return -1;
      if (a.docIdx !== b.docIdx) return a.docIdx - b.docIdx;
      return a.page - b.page;
    });
    pushHistory('sort-commit');
    renderPages();
    toast('Sorted by original order', 'info');
  });

  els.fileName.addEventListener('change', e=> {
    outputName = sanitizeName(e.target.value.trim() || 'studyvault-edited.pdf');
    e.target.value = outputName;
  });
  els.fileName.value = outputName;

  // keyboard shortcuts at root
  root.addEventListener('keydown', e=> {
    // ignore if typing in input/textarea
    const tag = (e.target.tagName||'').toLowerCase();
    const isInput = tag==='input' || tag==='textarea' || tag==='select' || e.target.isContentEditable;
    if (isInput && !(e.ctrlKey||e.metaKey)) {
      // allow escape to blur filter etc but not global shortcuts
      return;
    }
    if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((e.ctrlKey||e.metaKey) && (e.key.toLowerCase()==='y' || (e.key.toLowerCase()==='z' && e.shiftKey))) { e.preventDefault(); redo(); }
    else if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='a') { e.preventDefault(); els.selectAll.click(); }
    else if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='s') { e.preventDefault(); applyAndDownload(); }
    else if (e.key==='Delete' || e.key==='Backspace') {
      if (isInput) return;
      e.preventDefault();
      const sel = getSelected().filter(p=> !p.removed);
      if (sel.length) { pushHistory('remove-key'); sel.forEach(p=> p.removed=true); pushHistory('remove-key-commit'); renderPages(); renderMainPage(); }
    } else if (e.key.toLowerCase()==='r' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (isInput) return;
      e.preventDefault(); rotateSelected();
    } else if (e.key==='Escape') {
      // clear selection or close tool pane
      const toolBack = $('#pe2Back', main);
      if (toolBack) toolBack.click();
      else { pages.forEach(p=> p.selected=false); renderPages(); }
    }
  });
  // make root focusable for shortcuts
  root.tabIndex = -1;
  // focus root after load so shortcuts work
  requestAnimationFrame(()=> { try{ root.focus({preventScroll:true}); }catch{} });

  // Drag & drop files anywhere inside editor
  let depth = 0;
  root.addEventListener('dragenter', e => { e.preventDefault(); depth++; root.classList.add('drag'); });
  root.addEventListener('dragover', e => { e.preventDefault(); });
  root.addEventListener('dragleave', () => { depth = Math.max(0, depth-1); if (!depth) root.classList.remove('drag'); });
  root.addEventListener('drop', e => {
    e.preventDefault(); depth=0; root.classList.remove('drag');
    if (e.dataTransfer.files && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });

  // Initial paint
  renderPages();
  renderMainEmpty();
}

window.renderPdfEditor = renderPdfEditor;

/*
Route PDF tools into the unified editor.
*/
const PDF_EDITOR_IDS = new Set([
  'pdf-editor',
  'merge-pdf',
  'split-pdf',
  'pdf-to-images',
  'pdf-to-jpg-png',
  'pdf-text-extractor',
  'compress-pdf',
  'remove-pages',
  'rearrange-pdf',
  'pdf-page-counter'
]);

const PE_OLD_OPEN_TOOL = window.openTool;

window.openTool = function (id) {
  if (PDF_EDITOR_IDS.has(id)) {
    if (typeof addRecent === 'function') addRecent(id);
    // Navigate to dedicated page instead of popup
    if (!location.pathname.endsWith('pdf-editor.html')) {
      window.location.href = 'pdf-editor.html';
      return;
    }
    // Already on pdf-editor page — ensure editor is visible
    const mount = document.getElementById('editorMount');
    if (mount) mount.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (typeof PE_OLD_OPEN_TOOL === 'function') return PE_OLD_OPEN_TOOL(id);
};
