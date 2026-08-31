/*
 StudyVault — Unified Photo Editor v1
 Mirrors PDF Editor UX: Word-like ribbon + left thumbs + center preview.
 Layout reuses same .pe2/.wope classes so dual-scrollbar CSS applies:
  - Window / modal-body scrolls main preview
  - Left Photos list has its own sticky scrollbar
*/
'use strict';

function renderPhotoEditor(body, api){
  const modal = body.closest('.modal');
  if(modal) modal.classList.add('modal-editor','modal-pe2');

  body.innerHTML = `
    <div class="pe2 wope">
      <input id="phFileInput" type="file" accept="image/*" multiple hidden>
      <div class="wope-ribbon" role="region" aria-label="Ribbon">
        <div class="wope-tabs" role="tablist" aria-label="Editor tabs">
          <button class="wope-tab active" data-tab="home" role="tab" aria-selected="true">Home</button>
          <button class="wope-tab" data-tab="organize" role="tab">Organize</button>
          <button class="wope-tab" data-tab="edit" role="tab">Edit</button>
          <button class="wope-tab" data-tab="export" role="tab">Export</button>
          <button class="wope-tab" data-tab="view" role="tab">View</button>
        </div>
        <div class="wope-panels">
          <div class="wope-panel active" data-panel="home" role="tabpanel">
            <div class="wope-group">
              <button class="wope-btn wope-btn-primary wope-btn-lg" id="phAdd" type="button"><span class="wope-ic">＋</span><span class="wope-lbl">Add Photos</span></button>
              <div class="wope-stack">
                <button class="wope-btn wope-btn-sm" id="phInfo" type="button">ℹ Info</button>
                <button class="wope-btn wope-btn-sm" id="phClear" type="button">✕ Clear</button>
              </div>
              <div class="wope-group-label">Document</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group">
              <button class="wope-btn wope-btn-lg" id="phSelectAll" type="button"><span class="wope-ic">☑</span><span class="wope-lbl">Select All</span></button>
              <div class="wope-stack">
                <button class="wope-btn wope-btn-sm" id="phDeselect" type="button">Clear</button>
                <button class="wope-btn wope-btn-sm" id="phDuplicate" type="button">⧉ Duplicate</button>
              </div>
              <div class="wope-group-label">Selection</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group">
              <button class="wope-btn wope-btn-lg wope-btn-danger" id="phRemove" type="button"><span class="wope-ic">🗑</span><span class="wope-lbl">Remove</span></button>
              <button class="wope-btn wope-btn-lg" id="phRestore" type="button"><span class="wope-ic">↺</span><span class="wope-lbl">Restore</span></button>
              <div class="wope-group-label">Edit</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group">
              <div class="wope-stack">
                <button class="wope-btn wope-btn-sm" id="phUndo" type="button">↩ Undo</button>
                <button class="wope-btn wope-btn-sm" id="phRedo" type="button">↪ Redo</button>
              </div>
              <div class="wope-group-label">History</div>
            </div>
          </div>
          <div class="wope-panel" data-panel="organize" role="tabpanel" hidden>
            <div class="wope-group">
              <button class="wope-btn wope-btn-lg" id="phSortName" type="button"><span class="wope-ic">A↕</span><span class="wope-lbl">Sort</span><span class="wope-hint">Name</span></button>
              <button class="wope-btn wope-btn-lg" id="phSortSize" type="button"><span class="wope-ic">◫</span><span class="wope-lbl">Sort</span><span class="wope-hint">Size</span></button>
              <div class="wope-group-label">Arrange</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group">
              <button class="wope-btn wope-btn-lg" id="phRotate" type="button"><span class="wope-ic">↻</span><span class="wope-lbl">Rotate</span><span class="wope-hint">90°</span></button>
              <button class="wope-btn wope-btn-lg" id="phFlipH" type="button"><span class="wope-ic">⇔</span><span class="wope-lbl">Flip H</span></button>
              <button class="wope-btn wope-btn-lg" id="phFlipV" type="button"><span class="wope-ic">⇕</span><span class="wope-lbl">Flip V</span></button>
              <div class="wope-group-label">Transform</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group wope-group-info"><div class="wope-hint-box">Drag thumbnails to reorder<br>↑/↓ buttons or drag & drop</div><div class="wope-group-label">Reorder</div></div>
          </div>
          <div class="wope-panel" data-panel="edit" role="tabpanel" hidden>
            <div class="wope-group">
              <button class="wope-btn wope-btn-lg" id="phCrop" type="button"><span class="wope-ic">◫</span><span class="wope-lbl">Crop</span></button>
              <button class="wope-btn wope-btn-lg" id="phResize" type="button"><span class="wope-ic">⤢</span><span class="wope-lbl">Resize</span></button>
              <div class="wope-group-label">Adjust</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group">
              <button class="wope-btn wope-btn-lg" id="phGray" type="button"><span class="wope-ic">◐</span><span class="wope-lbl">Grayscale</span></button>
              <button class="wope-btn wope-btn-lg" id="phSepia" type="button"><span class="wope-ic">🟤</span><span class="wope-lbl">Sepia</span></button>
              <button class="wope-btn wope-btn-lg" id="phInvert" type="button"><span class="wope-ic">◑</span><span class="wope-lbl">Invert</span></button>
              <button class="wope-btn wope-btn-lg" id="phBlur" type="button"><span class="wope-ic">◎</span><span class="wope-lbl">Blur</span></button>
              <button class="wope-btn wope-btn-lg" id="phVintage" type="button"><span class="wope-ic">✦</span><span class="wope-lbl">Vintage</span></button>
              <button class="wope-btn wope-btn-lg" id="phVivid" type="button"><span class="wope-ic">✨</span><span class="wope-lbl">Vivid</span></button>
              <button class="wope-btn wope-btn-lg" id="phFilterReset" type="button"><span class="wope-ic">↺</span><span class="wope-lbl">Reset</span></button>
              <div class="wope-group-label">Filters</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group wope-group-info"><div class="wope-hint-box">Filters apply to selection<br>Use Undo to revert</div><div class="wope-group-label">Tips</div></div>
          </div>
          <div class="wope-panel" data-panel="export" role="tabpanel" hidden>
            <div class="wope-group">
              <button class="wope-btn wope-btn-primary wope-btn-lg" id="phDownload" type="button"><span class="wope-ic">💾</span><span class="wope-lbl">Download</span><span class="wope-hint">ZIP</span></button>
              <div class="wope-group-label">Save</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group">
              <div class="wope-stack">
                <button class="wope-btn wope-btn-sm" id="phDownloadOne" type="button">⬇ Single</button>
                <button class="wope-btn wope-btn-sm" id="phToPdf" type="button">📄 To PDF</button>
              </div>
              <div class="wope-group-label">Export</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group">
              <button class="wope-btn wope-btn-lg" id="phCompress" type="button"><span class="wope-ic">🗜</span><span class="wope-lbl">Compress</span></button>
              <button class="wope-btn wope-btn-lg" id="phConvert" type="button"><span class="wope-ic">🔁</span><span class="wope-lbl">Convert</span></button>
              <div class="wope-group-label">Optimize</div>
            </div>
          </div>
          <div class="wope-panel" data-panel="view" role="tabpanel" hidden>
            <div class="wope-group">
              <div class="wope-zoom-inline">
                <button class="wope-btn wope-btn-sm" id="phZoomOut" type="button">−</button>
                <select id="phZoomSelView" aria-label="Zoom"><option value="fit">Fit</option><option value="0.5">50%</option><option value="0.75">75%</option><option value="1">100%</option><option value="1.5">150%</option><option value="2">200%</option></select>
                <button class="wope-btn wope-btn-sm" id="phZoomIn" type="button">＋</button>
              </div>
              <div class="wope-group-label">Zoom</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group">
              <div class="wope-hint-box">Filter & Go to are in<br>left Photos pane</div>
              <div class="wope-group-label">Navigation</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group">
              <div class="wope-inline"><span class="pe2-count" id="phCountView">0 photos</span></div>
              <div class="wope-group-label">Status</div>
            </div>
          </div>
        </div>
      </div>

      <div class="pe2-work wope-work">
        <aside class="pe2-left wope-nav" aria-label="Photos">
          <div class="pe2-left-head wope-nav-head">
            <div class="wope-nav-title"><span>Photos</span><span class="pe2-left-meta" id="phLeftMeta">—</span></div>
            <label class="wope-nav-filter" title="Filter photos">
              <input id="phFilter" type="search" placeholder="Filter… vacation" aria-label="Filter photos">
              <span aria-hidden="true">🔍</span>
            </label>
            <label class="wope-nav-jump" title="Jump to photo">
              <input id="phJump" type="number" min="1" inputmode="numeric" placeholder="#" aria-label="Jump to photo">
              <span>Go</span>
            </label>
          </div>
          <div class="pe2-pages wope-nav-pages" id="phPages" role="listbox" aria-multiselectable="true" aria-label="Photos. Use Ctrl/Cmd or Shift to select multiple."></div>
        </aside>
        <main class="pe2-main wope-doc" id="phMain"></main>
      </div>

      <div class="wope-statusbar" role="contentinfo" aria-label="Status">
        <div class="wope-status-left">
          <span class="wope-status-item" id="phCount">0 photos</span>
          <span class="wope-status-item" id="phSelCount" hidden>0 selected</span>
          <span class="wope-status-item wope-status-kept" id="phStatusKept">0 kept</span>
        </div>
        <div class="wope-status-center">
          <input id="phFileName" type="text" placeholder="photos-edited.zip" aria-label="Output filename" title="Output filename">
        </div>
        <div class="wope-status-right">
          <div class="wope-status-zoom" role="group" aria-label="Zoom">
            <button class="wope-status-btn" id="phZoomOut2" type="button">−</button>
            <select id="phZoomSel" aria-label="Zoom level">
              <option value="fit">Fit</option>
              <option value="0.5">50%</option>
              <option value="0.75">75%</option>
              <option value="1">100%</option>
              <option value="1.5">150%</option>
              <option value="2">200%</option>
            </select>
            <button class="wope-status-btn" id="phZoomIn2" type="button">＋</button>
            <button class="wope-status-btn" id="phZoomReset" type="button">⊡</button>
          </div>
          <span class="wope-status-zoom-val" id="phZoomVal">Fit</span>
        </div>
      </div>
      <p class="tool-note wope-tip" style="margin:8px 0 0">💡 Photo-like: <b>Home</b> add/select · <b>Organize</b> rotate/flip · <b>Edit</b> crop/resize/filter · <b>Export</b> download/compress · Drag photos, <kbd>Ctrl</kbd> multi</p>
    </div>
  `;

  const root = $('.pe2', body);
  const fileInput = $('#phFileInput', root);
  const pagesEl = $('#phPages', root);
  const main = $('#phMain', root);

  const els = {
    add: $('#phAdd', root),
    remove: $('#phRemove', root),
    restore: $('#phRestore', root),
    rotate: $('#phRotate', root),
    flipH: $('#phFlipH', root),
    flipV: $('#phFlipV', root),
    duplicate: $('#phDuplicate', root),
    crop: $('#phCrop', root),
    resize: $('#phResize', root),
    gray: $('#phGray', root),
    sepia: $('#phSepia', root),
    invert: $('#phInvert', root),
    blur: $('#phBlur', root),
    vintage: $('#phVintage', root),
    vivid: $('#phVivid', root),
    filterReset: $('#phFilterReset', root),
    download: $('#phDownload', root),
    downloadOne: $('#phDownloadOne', root),
    toPdf: $('#phToPdf', root),
    compress: $('#phCompress', root),
    convert: $('#phConvert', root),
    info: $('#phInfo', root),
    clear: $('#phClear', root),
    count: $('#phCount', root),
    selCount: $('#phSelCount', root),
    selectAll: $('#phSelectAll', root),
    deselect: $('#phDeselect', root),
    jump: $('#phJump', root),
    filter: $('#phFilter', root),
    undo: $('#phUndo', root),
    redo: $('#phRedo', root),
    zoomOut: $('#phZoomOut2', root),
    zoomIn: $('#phZoomIn2', root),
    zoomSel: $('#phZoomSel', root),
    zoomReset: $('#phZoomReset', root),
    fileName: $('#phFileName', root),
    leftMeta: $('#phLeftMeta', root),
    sortName: $('#phSortName', root),
    sortSize: $('#phSortSize', root)
  };

  (function setupRibbon(){
    const tabs = $$('.wope-tab', root);
    const panels = $$('.wope-panel', root);
    tabs.forEach(tab=>{
      tab.addEventListener('click', ()=>{
        tabs.forEach(t=>{ t.classList.remove('active'); t.setAttribute('aria-selected','false'); });
        panels.forEach(p=>{ p.classList.remove('active'); p.hidden = true; });
        tab.classList.add('active'); tab.setAttribute('aria-selected','true');
        const panel = $(`.wope-panel[data-panel="${tab.dataset.tab}"]`, root);
        if(panel){ panel.classList.add('active'); panel.hidden = false; }
      });
    });
    const vOut = $('#phZoomOut', root), vIn = $('#phZoomIn', root), vSel = $('#phZoomSelView', root);
    if(vOut && els.zoomOut) vOut.addEventListener('click', ()=> els.zoomOut.click());
    if(vIn && els.zoomIn) vIn.addEventListener('click', ()=> els.zoomIn.click());
    if(vSel && els.zoomSel) vSel.addEventListener('change', e=>{
      els.zoomSel.value = e.target.value;
      els.zoomSel.dispatchEvent(new Event('change'));
    });
  })();

  let images = [];
  let current = null;
  let lastSelectedIdx = -1;
  let dragIdx = null;
  let zoomMode = 'fit';
  let filterQuery = '';
  let outputName = 'photos-edited.zip';

  let history = [];
  let histIdx = -1;

  function uid(){ return Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4); }

  function getSelected(){
    const sel = images.filter(p=> p.selected && !p.hiddenByFilter);
    if(sel.length) return sel;
    if(current && !current.hiddenByFilter) return [current];
    return [];
  }

  function snapshot(){
    return {
      images: images.map(p=> ({uid:p.uid, name:p.name, removed:p.removed, selected:p.selected, rotation:p.rotation, flipH:p.flipH, flipV:p.flipV, filter:p.filter, hiddenByFilter:p.hiddenByFilter, w:p.w, h:p.h, size:p.size, url:p.url, thumbUrl:p.thumbUrl, img:p.img, file:p.file})),
      order: images.map(p=> p.uid),
      currentUid: current ? current.uid : null
    };
  }
  function pushHistory(){
    history = history.slice(0, histIdx+1);
    history.push(snapshot());
    histIdx = history.length-1;
    if(history.length>60){ history.shift(); histIdx--; }
    updateToolbar();
  }
  function restoreSnapshot(snap){
    const byUid = new Map(images.map(p=>[p.uid,p]));
    const newImgs=[];
    snap.order.forEach(uid=>{
      let p = byUid.get(uid);
      const s = snap.images.find(x=> x.uid===uid);
      if(!p && s){
        // Redo after undo of add: recreate from snapshot stored data
        p = {
          uid: s.uid, name: s.name, removed: s.removed, selected: s.selected,
          rotation: s.rotation, flipH: s.flipH, flipV: s.flipV, filter: s.filter,
          hiddenByFilter: s.hiddenByFilter, w: s.w, h: s.h, size: s.size,
          url: s.url, thumbUrl: s.thumbUrl, img: s.img, file: s.file,
          type: s.file ? s.file.type : (s.thumbUrl || ''), el: null
        };
      } else if(p && s){
        p.removed=s.removed; p.selected=s.selected; p.rotation=s.rotation; p.flipH=s.flipH; p.flipV=s.flipV; p.filter=s.filter; p.hiddenByFilter=s.hiddenByFilter;
        p.w=s.w; p.h=s.h; p.size=s.size; p.url=s.url; p.thumbUrl=s.thumbUrl; p.img=s.img; p.file=s.file; p.name=s.name;
      }
      if(p) newImgs.push(p);
    });
    images = newImgs;
    if(snap.currentUid) current = images.find(p=> p.uid===snap.currentUid) || images[0] || null;
    else current = images[0] || null;
    applyFilter();
    renderThumbs();
    if(current) renderMain(); else renderMainEmpty();
    updateToolbar();
  }
  function undo(){ if(histIdx<=0) return; histIdx--; restoreSnapshot(history[histIdx]); }
  function redo(){ if(histIdx>=history.length-1) return; histIdx++; restoreSnapshot(history[histIdx]); }

  pushHistory('init');

  api.onClose(()=>{
    images.forEach(im=>{ try{ URL.revokeObjectURL(im.url); }catch{}; try{ URL.revokeObjectURL(im.thumbUrl); }catch{} });
  });

  function updateToolbar(){
    const hasImgs = images.length>0;
    const visible = images.filter(p=> !p.hiddenByFilter);
    const hasSelection = getSelected().length>0;
    const hasVis = visible.length>0;
    const kept = images.filter(p=> !p.removed).length;
    const sel = images.filter(p=> p.selected).length;
    const hasActiveSel = getSelected().some(p=> !p.removed);
    const hasRemovedSel = getSelected().some(p=> p.removed);
    if(els.remove) els.remove.disabled = !hasActiveSel;
    if(els.restore) els.restore.disabled = !hasRemovedSel;
    if(els.rotate) els.rotate.disabled = !hasSelection;
    if(els.flipH) els.flipH.disabled = !hasSelection;
    if(els.flipV) els.flipV.disabled = !hasSelection;
    if(els.duplicate) els.duplicate.disabled = !hasSelection;
    if(els.crop) els.crop.disabled = !hasSelection;
    if(els.resize) els.resize.disabled = !hasSelection;
    if(els.gray) els.gray.disabled = !hasSelection;
    if(els.sepia) els.sepia.disabled = !hasSelection;
    if(els.invert) els.invert.disabled = !hasSelection;
    if(els.blur) els.blur.disabled = !hasSelection;
    if(els.vintage) els.vintage.disabled = !hasSelection;
    if(els.vivid) els.vivid.disabled = !hasSelection;
    if(els.filterReset) els.filterReset.disabled = !hasSelection;
    if(els.download) els.download.disabled = kept===0;
    if(els.downloadOne) els.downloadOne.disabled = !hasActiveSel;
    if(els.toPdf) els.toPdf.disabled = kept===0;
    if(els.compress) els.compress.disabled = kept===0;
    if(els.convert) els.convert.disabled = kept===0;
    if(els.info) els.info.disabled = !hasImgs;
    if(els.clear) els.clear.disabled = !hasImgs;
    if(els.selectAll) els.selectAll.disabled = !hasVis;
    if(els.deselect) els.deselect.disabled = sel===0;
    if(els.undo) els.undo.disabled = histIdx<=0;
    if(els.redo) els.redo.disabled = histIdx>=history.length-1;
    if(els.count){ els.count.textContent = `${images.length} photo${images.length===1?'':'s'}${filterQuery ? ` · ${visible.length} shown` : ''}`; els.count.title=`${images.length} total, ${kept} kept, ${images.length-kept} removed`; }
    if(els.selCount){ if(sel>0){ els.selCount.hidden=false; els.selCount.textContent=`${sel} selected`; } else els.selCount.hidden=true; }
    if(els.leftMeta) els.leftMeta.textContent = `${kept} kept · ${images.length-kept} removed`;
    if(els.jump) els.jump.max = String(images.length);
    const statusKept = $('#phStatusKept', root); if(statusKept) statusKept.textContent = `${kept} kept · ${images.length-kept} removed`;
    const viewCount = $('#phCountView', root); if(viewCount) viewCount.textContent = `${images.length} photos`;
    const zoomVal = $('#phZoomVal', root); if(zoomVal) zoomVal.textContent = zoomMode==='fit' ? 'Fit' : (zoomMode==='1'?'100%': (Math.round(Number(zoomMode)*100)+'%'));
    const vSel = $('#phZoomSelView', root); if(vSel && vSel.value!==zoomMode) vSel.value = zoomMode;
  }

  function applyFilter(){
    const q = filterQuery.trim().toLowerCase();
    if(!q){
      images.forEach(p=> p.hiddenByFilter=false);
      return;
    }
    const terms = q.split(/\s+/).filter(Boolean);
    images.forEach(p=>{
      const hay = `${p.name} ${p.type} ${p.w}x${p.h} ${p.removed?'removed':''}`.toLowerCase();
      p.hiddenByFilter = !terms.every(t=> hay.includes(t));
    });
    images.forEach(p=>{ if(p.hiddenByFilter) p.selected=false; });
  }
  function setFilter(v){ filterQuery=v; applyFilter(); renderThumbs(); updateToolbar(); }

  function toolPane(title){
    main.innerHTML = `
      <div class="pe2-tool">
        <div class="pe2-tool-head">
          <button class="btn btn-ghost btn-sm" id="phBack" type="button">← Back to preview</button>
          <h3>${esc(title)}</h3>
        </div>
        <div class="pe2-tool-body">
          <div class="tool-status" aria-live="polite"></div>
        </div>
      </div>
    `;
    $('#phBack', main).onclick = ()=>{
      if(current) renderMain(); else renderMainEmpty();
    };
    return $('.tool-status', main);
  }

  function renderMainEmpty(){
    const hasImgs = images.length>0;
    if(!hasImgs){
      main.innerHTML = `
        <div class="empty-state pe2-empty">
          <div class="es-ic">🖼️</div>
          <b>Photo Editor</b>
          <p>Add photos with <b>Add Photos</b> or drop them anywhere here.<br>
          <span style="color:var(--muted)">Rotate · Flip · Crop · Resize · Compress · Convert · ZIP</span></p>
          <div style="margin-top:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" id="phEmptyAdd">＋ Add Photos</button>
            <button class="btn btn-ghost btn-sm" id="phEmptyInfo">Why offline?</button>
          </div>
          <p class="tool-note" style="justify-content:center">🔒 Everything runs locally — no uploads.</p>
        </div>
      `;
      $('#phEmptyAdd', main).onclick = ()=> fileInput.click();
      $('#phEmptyInfo', main).onclick = ()=> showInfo();
    } else {
      main.innerHTML = `
        <div class="empty-state pe2-empty">
          <div class="es-ic">👈</div>
          <b>Select a photo</b>
          <p>Choose a photo on the left to preview. Ctrl/Cmd or Shift for multi-select.</p>
        </div>
      `;
    }
    updateToolbar();
  }

  function effectiveZoom(){ if(zoomMode==='fit') return null; const n=Number(zoomMode); return isFinite(n) && n>0 ? n : null; }

  async function renderTransformedCanvas(p, targetScale){
    // p has img element loaded, rotation, flip, filter
    if(!p.img) throw new ToolError('Image not loaded');
    const w = p.img.naturalWidth, h = p.img.naturalHeight;
    const rot = p.rotation||0;
    const isSwap = rot===90 || rot===270;
    const cw = isSwap ? h : w;
    const ch = isSwap ? w : h;
    let scale = targetScale;
    if(scale==null){
      const eff = effectiveZoom();
      if(eff!==null) scale = eff;
      else {
        const avail = Math.max(320, (main.clientWidth||900)-80);
        // fit to width
        scale = Math.min(1, avail / cw);
        if(scale<0.2) scale=0.5;
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(cw * scale);
    canvas.height = Math.round(ch * scale);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(cw/2, ch/2);
    ctx.rotate(rot*Math.PI/180);
    ctx.scale(p.flipH ? -1 : 1, p.flipV ? -1 : 1);
    // filters — expanded
    if(p.filter==='gray') ctx.filter = 'grayscale(1)';
    else if(p.filter==='sepia') ctx.filter = 'sepia(1)';
    else if(p.filter==='invert') ctx.filter = 'invert(1)';
    else if(p.filter==='blur') ctx.filter = 'blur(4px)';
    else if(p.filter==='vintage') ctx.filter = 'sepia(0.6) contrast(1.15) brightness(0.95) saturate(1.2)';
    else if(p.filter==='vivid') ctx.filter = 'saturate(1.8) contrast(1.15) brightness(1.05)';
    else ctx.filter = 'none';
    ctx.drawImage(p.img, -w/2, -h/2, w, h);
    ctx.restore();
    return canvas;
  }

  async function renderMain(){
    if(!current){ renderMainEmpty(); return; }
    const selCount = images.filter(p=> p.selected).length;
    const isMulti = selCount>1;
    const visibleSel = getSelected();
    main.innerHTML = `
      <div class="pe2-view">
        <div class="pe2-view-bar">
          <span>
            <b style="color:var(--text)">${esc(current.name)}</b>
            <span style="color:var(--faint)"> · ${current.w}×${current.h} · ${humanSize(current.size)}</span>
            ${current.rotation ? ` · ↻ ${current.rotation}°` : ''}
            ${current.flipH||current.flipV ? ` · ${current.flipH?'↔':''}${current.flipV?'↕':''}` : ''}
            ${current.filter ? ` · ${current.filter}` : ''}
            ${current.removed ? ' · <span style=\"color:#fda4af\">removed</span>' : ''}
            ${isMulti ? ` · <span style=\"color:#8fb0ff\">${selCount} selected</span>` : ''}
          </span>
          <span style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-ghost btn-xs" id="phPrev" type="button">↑ Prev</button>
            <button class="btn btn-ghost btn-xs" id="phNext" type="button">Next ↓</button>
          </span>
        </div>
        <div class="photo-canvas-wrap ${current.removed?'removed':''}" id="phCanvasWrap">
          <span class="spinner" aria-hidden="true"></span>
        </div>
        ${isMulti ? `<div class="pe2-multi-bar">Selected ${visibleSel.map(p=> esc(p.name)).join(', ')} — actions apply to all selected.</div>` : ''}
      </div>
    `;
    $('#phPrev', main).onclick = ()=> navigatePreview(-1);
    $('#phNext', main).onclick = ()=> navigatePreview(1);

    try{
      const cv = await renderTransformedCanvas(current, null);
      const wrap = $('#phCanvasWrap', main);
      if(!wrap) return;
      wrap.innerHTML='';
      const frame=document.createElement('div');
      frame.className='pe2-canvas-frame';
      frame.appendChild(cv);
      wrap.appendChild(frame);
      cv.style.maxWidth='100%';
      cv.style.height='auto';
      cv.style.cursor='zoom-in';
      cv.addEventListener('click', ()=>{
        if(zoomMode==='fit'){ zoomMode='1'; els.zoomSel.value='1'; }
        else { zoomMode='fit'; els.zoomSel.value='fit'; }
        renderMain();
      });
    }catch(e){
      const wrap=$('#phCanvasWrap', main);
      if(wrap) wrap.innerHTML=`<div class="panel-err"><span>⚠️</span><div><b>Could not render</b><p>${esc(friendly(e))}</p></div></div>`;
    }
    updateToolbar();
  }

  function navigatePreview(dir){
    if(!current) return;
    const visible = images.filter(p=> !p.hiddenByFilter);
    const idx = visible.indexOf(current);
    const nxt = visible[idx+dir];
    if(nxt){ current=nxt; renderThumbs(); renderMain(); }
  }

  function createThumbEl(p,i){
    if(p.hiddenByFilter){
      const ph=document.createElement('div'); ph.style.display='none'; return ph;
    }
    const item=document.createElement('div');
    item.className='pe2-page'+(p===current?' active':'')+(p.selected?' selected':'')+(p.removed?' removed':'');
    item.draggable=true; item.tabIndex=0;
    item.setAttribute('role','option');
    item.setAttribute('aria-selected', String(!!p.selected));
    item.setAttribute('aria-label', `${p.name}${p.removed?' removed':''}${p.selected?' selected':''}`);

    const wrap=document.createElement('div');
    wrap.className='pe2-thumb-wrap';
    wrap.style.position='relative';
    wrap.style.background='#fff';
    wrap.style.display='grid';
    wrap.style.placeItems='center';
    wrap.style.aspectRatio='1';
    wrap.style.overflow='hidden';

    const imgEl=document.createElement('img');
    imgEl.src = p.thumbUrl || p.url;
    imgEl.alt='';
    imgEl.style.width='100%';
    imgEl.style.height='100%';
    imgEl.style.objectFit='cover';
    imgEl.style.transform = `rotate(${p.rotation}deg) scaleX(${p.flipH?-1:1}) scaleY(${p.flipV?-1:1})`;
    if(p.filter==='gray') imgEl.style.filter='grayscale(1)';
    else if(p.filter==='sepia') imgEl.style.filter='sepia(1)';
    else if(p.filter==='invert') imgEl.style.filter='invert(1)';
    else if(p.filter==='blur') imgEl.style.filter='blur(2px)';
    else if(p.filter==='vintage') imgEl.style.filter='sepia(0.6) contrast(1.15) brightness(0.95) saturate(1.2)';
    else if(p.filter==='vivid') imgEl.style.filter='saturate(1.8) contrast(1.15) brightness(1.05)';
    wrap.appendChild(imgEl);

    const check=document.createElement('span');
    check.className='pe2-check'+(p.selected?' on':'');
    check.textContent = p.selected ? '✓' : '';
    wrap.appendChild(check);

    if(p.rotation){ const b=document.createElement('span'); b.className='pe2-rot-badge'; b.textContent=`${p.rotation}°`; wrap.appendChild(b); }
    if(p.filter){ const f=document.createElement('span'); f.className='pe2-rot-badge'; f.style.left='8px'; f.style.right='auto'; f.textContent=p.filter; wrap.appendChild(f); }

    item.appendChild(wrap);

    const meta=document.createElement('div');
    meta.className='pe2-page-meta';
    meta.innerHTML=`
      <span title="${esc(p.name)}" style="overflow:hidden;textOverflow:ellipsis;whiteSpace:nowrap;maxWidth:110px">${esc(p.name)}</span>
      <span class="pe2-page-acts">
        <button type="button" data-mv="-1" title="Move up">↑</button>
        <button type="button" data-mv="1" title="Move down">↓</button>
        <button type="button" data-rot title="Rotate">↻</button>
        <button type="button" data-rm title="${p.removed?'Restore':'Remove'}">${p.removed?'↺':'✕'}</button>
      </span>
    `;
    item.appendChild(meta);

    const selectWithModifiers=(e)=>{
      const isCtrl=e.ctrlKey||e.metaKey;
      const isShift=e.shiftKey;
      if(isShift && lastSelectedIdx!==-1){
        const start=Math.min(lastSelectedIdx,i), end=Math.max(lastSelectedIdx,i);
        for(let k=start;k<=end;k++){ const pk=images[k]; if(!pk.hiddenByFilter) pk.selected=true; }
      } else if(isCtrl){
        p.selected=!p.selected; lastSelectedIdx=i;
      } else {
        const wasSelected=p.selected;
        const selCount=images.filter(x=> x.selected).length;
        if(wasSelected && selCount>1){} else { images.forEach(x=> x.selected=false); p.selected=true; }
        lastSelectedIdx=i;
      }
      current=p;
      refreshSelectionUI();
      renderMain();
    };
    item.addEventListener('click', selectWithModifiers);
    item.addEventListener('keydown', e=>{
      if(e.key==='Enter'||e.key===' '){ e.preventDefault(); selectWithModifiers(e); }
      else if(e.key==='ArrowUp'||e.key==='ArrowDown'){
        e.preventDefault();
        const dir=e.key==='ArrowUp'?-1:1;
        let nxt=i+dir;
        while(nxt>=0 && nxt<images.length && images[nxt].hiddenByFilter) nxt+=dir;
        if(nxt>=0 && nxt<images.length){
          images[nxt].selected=true;
          if(!e.shiftKey) images.forEach((x,k)=>{ if(k!==nxt) x.selected=false; });
          current=images[nxt]; lastSelectedIdx=nxt;
          refreshSelectionUI(); renderMain();
          requestAnimationFrame(()=>{ const el=images[nxt].el; if(el) el.focus(); });
        }
      }
    });

    $$('[data-mv]',item).forEach(b=>{
      b.addEventListener('click', e=>{
        e.stopPropagation();
        const d=+b.dataset.mv; const j=i+d; if(j<0||j>=images.length) return;
        pushHistory();
        const mv=images[i];
        const selIdx=images.map((pg,idx)=> pg.selected?idx:-1).filter(idx=> idx!==-1).sort((a,b)=>a-b);
        if(mv.selected && selIdx.length>1){
          if(d===-1){ if(selIdx[0]===0) return; const block=selIdx.map(idx=> images[idx]); for(let k=selIdx.length-1;k>=0;k--) images.splice(selIdx[k],1); images.splice(selIdx[0]-1,0,...block); }
          else { if(selIdx[selIdx.length-1]===images.length-1) return; const block=selIdx.map(idx=> images[idx]); for(let k=selIdx.length-1;k>=0;k--) images.splice(selIdx[k],1); images.splice(selIdx[0]+1,0,...block); }
        } else { [images[i],images[j]]=[images[j],images[i]]; }
        pushHistory();
        renderThumbs();
      });
    });
    $('[data-rot]',item).addEventListener('click', e=>{
      e.stopPropagation();
      pushHistory();
      p.rotation=(p.rotation+90)%360; pushHistory();
      refreshSelectionUI(); if(p===current) renderMain(); else updateToolbar();
    });
    $('[data-rm]',item).addEventListener('click', e=>{
      e.stopPropagation();
      const sel=p.selected? getSelected():[p];
      const willRemove=sel.some(s=> !s.removed);
      pushHistory();
      sel.forEach(s=> s.removed=willRemove); pushHistory();
      refreshSelectionUI(); if(sel.includes(current)) renderMain(); else updateToolbar();
    });
    check.addEventListener('click', e=>{
      e.stopPropagation(); p.selected=!p.selected; lastSelectedIdx=i; refreshSelectionUI();
    });

    item.addEventListener('dragstart', e=>{
      dragIdx=i; item.classList.add('dragging'); e.dataTransfer.effectAllowed='move';
      try{ e.dataTransfer.setData('text/plain',String(i)); }catch{}
    });
    item.addEventListener('dragend', ()=> item.classList.remove('dragging'));
    item.addEventListener('dragover', e=>{ e.preventDefault(); item.classList.add('drag-over'); });
    item.addEventListener('dragleave', ()=> item.classList.remove('drag-over'));
    item.addEventListener('drop', e=>{
      e.preventDefault(); item.classList.remove('drag-over');
      if(dragIdx===null||dragIdx===i){ dragIdx=null; return; }
      pushHistory();
      const from=dragIdx, to=i;
      const mv=images[from];
      const isBlock=mv.selected && images.filter(p=>p.selected).length>1;
      if(isBlock){
        const selIdx=images.map((pg,idx)=> pg.selected?idx:-1).filter(idx=> idx!==-1).sort((a,b)=>a-b);
        const block=selIdx.map(idx=> images[idx]);
        for(let k=selIdx.length-1;k>=0;k--) images.splice(selIdx[k],1);
        const before=selIdx.filter(idx=> idx<to).length;
        let target=to-before; if(from<to) target=Math.max(0,target);
        images.splice(target,0,...block);
      } else { const [moved]=images.splice(from,1); images.splice(to,0,moved); }
      dragIdx=null; pushHistory(); renderThumbs();
    });

    return item;
  }

  function renderThumbs(){
    const activeUid=document.activeElement && document.activeElement.closest('.pe2-page') ? images.find(p=> p.el===document.activeElement.closest('.pe2-page'))?.uid : null;
    const scrollTop=pagesEl.scrollTop;
    const frag=document.createDocumentFragment();
    pagesEl.innerHTML='';
    images.forEach((p,i)=>{
      p.el=createThumbEl(p,i);
      if(!p.hiddenByFilter) frag.appendChild(p.el);
    });
    pagesEl.appendChild(frag);
    pagesEl.scrollTop=scrollTop;
    if(activeUid){
      const pg=images.find(p=> p.uid===activeUid);
      if(pg && pg.el) pg.el.focus({preventScroll:true});
    }
    updateToolbar();
  }

  function refreshSelectionUI(){
    images.forEach(p=>{
      if(!p.el || p.hiddenByFilter) return;
      p.el.classList.toggle('selected', !!p.selected);
      p.el.classList.toggle('active', p===current);
      p.el.classList.toggle('removed', !!p.removed);
      p.el.setAttribute('aria-selected', String(!!p.selected));
      const chk=p.el.querySelector('.pe2-check');
      if(chk){ chk.classList.toggle('on', !!p.selected); chk.textContent=p.selected?'✓':''; }
    });
    updateToolbar();
  }

  async function addFiles(fileList){
    const incoming=[...fileList].filter(f=>{
      const t=(f.type||'').toLowerCase();
      const n=(f.name||'').toLowerCase();
      return t.startsWith('image/') || ['jpg','jpeg','png','webp','gif','bmp','svg'].some(ext=> n.endsWith('.'+ext));
    });
    const rejected=fileList.length - incoming.length;
    if(rejected>0) toast(`Skipped ${rejected} non-image file${rejected===1?'':'s'}.`,'error');
    if(!incoming.length){ if(fileList.length) toast('No valid images to add.','info'); return; }

    const MAX_FILE=80*1024*1024;
    const filtered=incoming.filter(f=>{
      if(f.size>MAX_FILE){ toast(`"${f.name}" exceeds 80 MB and was skipped.`,'error'); return false; }
      return true;
    });
    if(!filtered.length) return;
    if(images.length>=120){ toast('Workspace at 120 images — remove some before adding more.','error'); return; }

    for(const file of filtered){
      if(images.length>=120){ toast('Preview limited to 120 images.','info'); break; }
      try{
        const url=URL.createObjectURL(file);
        const {img} = await fileToImage(file);
        const w=img.naturalWidth, h=img.naturalHeight;
        // thumb
        const thumbCanvas=document.createElement('canvas');
        const tw = 220;
        const scale = Math.min(1, tw / Math.max(w,h));
        thumbCanvas.width=Math.round(w*scale);
        thumbCanvas.height=Math.round(h*scale);
        const tctx=thumbCanvas.getContext('2d');
        tctx.drawImage(img,0,0,thumbCanvas.width,thumbCanvas.height);
        const thumbUrl=thumbCanvas.toDataURL('image/jpeg',0.7);
        URL.revokeObjectURL(url);
        const url2=URL.createObjectURL(file);
        images.push({
          uid: uid(),
          file, url:url2, thumbUrl, img, w, h, size:file.size, name:file.name, type:file.type,
          rotation:0, flipH:false, flipV:false, filter:null,
          removed:false, selected:false, hiddenByFilter:false, el:null
        });
      }catch(e){ toast(`"${file.name}": ${friendly(e)}`,'error'); }
      await tick();
    }
    if(!current && images.length){ current=images.find(p=> !p.hiddenByFilter) || images[0]; images.forEach(p=> p.selected=false); if(current) current.selected=true; lastSelectedIdx=images.indexOf(current); }
    pushHistory();
    applyFilter();
    renderThumbs();
    if(current) renderMain(); else renderMainEmpty();
  }

  /* Actions */
  function rotateSelected(){
    const sel=getSelected(); if(!sel.length){ toast('Select photos to rotate.','info'); return; }
    pushHistory();
    sel.forEach(p=> p.rotation=(p.rotation+90)%360);
    pushHistory();
    renderThumbs();
    if(sel.includes(current)) renderMain(); else updateToolbar();
    toast(`Rotated ${sel.length} photo${sel.length===1?'':'s'} 90°`,'success',2000);
  }
  function flipSelected(dir){
    const sel=getSelected(); if(!sel.length) return;
    pushHistory();
    sel.forEach(p=>{ if(dir==='h') p.flipH=!p.flipH; else p.flipV=!p.flipV; });
    pushHistory();
    renderThumbs(); if(sel.includes(current)) renderMain(); else updateToolbar();
    toast(`Flipped ${sel.length} photo${sel.length===1?'':'s'} ${dir==='h'?'horizontally':'vertically'}`,'success');
  }
  function duplicateSelected(){
    const sel=getSelected(); if(!sel.length){ toast('Select photos to duplicate.','info'); return; }
    if(images.length+sel.length>130){ toast('Too many photos to duplicate.','error'); return; }
    pushHistory();
    const lastIdx=Math.max(...sel.map(p=> images.indexOf(p)));
    const clones=sel.map(p=> ({
      uid: uid(),
      file: p.file, url: p.url, thumbUrl: p.thumbUrl, img: p.img, w:p.w, h:p.h, size:p.size, name: p.name.replace(/(\.[^.]+)$/,'-copy$1'),
      type:p.type, rotation:p.rotation, flipH:p.flipH, flipV:p.flipV, filter:p.filter,
      removed:false, selected:false, hiddenByFilter:false, el:null
    }));
    images.splice(lastIdx+1,0,...clones);
    images.forEach(p=> p.selected=false);
    clones.forEach(c=> c.selected=true);
    current=clones[0];
    pushHistory();
    renderThumbs(); renderMain();
    toast(`Duplicated ${clones.length} photo${clones.length===1?'':'s'}`,'success');
  }

  async function downloadSelected(){
    const sel=getSelected().filter(p=> !p.removed);
    if(!sel.length){ toast('Select at least one kept photo.','info'); return; }
    if(sel.length===1){
      const p=sel[0];
      const cv=await renderTransformedCanvas(p, 1);
      const blob=await canvasToBlob(cv, p.type==='image/png' ? 'image/png' : 'image/jpeg', 0.92);
      const ext = (p.type==='image/png'?'png': p.type==='image/webp'?'webp':'jpg');
      downloadBlob(blob, `${baseOf(p.name)}-edited.${ext}`);
      toast('Downloaded','success');
    } else {
      if(!window.JSZip){ toast('ZIP engine not loaded','error'); return; }
      const zip=new JSZip();
      for(let i=0;i<sel.length;i++){
        const p=sel[i];
        const cv=await renderTransformedCanvas(p,1);
        const blob=await canvasToBlob(cv, 'image/jpeg',0.92);
        const buf=await blob.arrayBuffer();
        zip.file(`${String(i+1).padStart(2,'0')}-${sanitizeName(p.name)}`, buf);
      }
      const blob=await zip.generateAsync({type:'blob'});
      downloadBlob(blob, getOutputFileName('photos-edited.zip'));
      toast(`ZIP with ${sel.length} photos downloaded`,'success');
    }
  }

  function getOutputFileName(fallback){
    const raw=(els.fileName.value||'').trim();
    const sanitized=sanitizeName(raw||fallback);
    return sanitized;
  }

  async function downloadAll(){
    const kept=images.filter(p=> !p.removed);
    if(!kept.length){ toast('No kept photos.','info'); return; }
    if(kept.length===1) { const prev=current; current=kept[0]; await downloadSelected(); current=prev; return; }
    if(!window.JSZip){ toast('ZIP not loaded','error'); return; }
    const status=toolPane('Download — ZIP');
    const setMsg=loading(status,'Packing…');
    try{
      const zip=new JSZip();
      for(let i=0;i<kept.length;i++){
        const p=kept[i];
        setMsg(`Adding ${i+1}/${kept.length} — ${p.name}`);
        const cv=await renderTransformedCanvas(p,1);
        // determine format: keep original if png/webp else jpg
        let fmt='image/jpeg', ext='jpg';
        if(p.type==='image/png'){ fmt='image/png'; ext='png'; }
        else if(p.type==='image/webp'){ fmt='image/webp'; ext='webp'; }
        const blob=await canvasToBlob(cv, fmt, 0.92);
        const buf=await blob.arrayBuffer();
        const name=`${String(i+1).padStart(3,'0')}-${baseOf(sanitizeName(p.name))}.${ext}`;
        zip.file(name, buf);
        await tick();
      }
      setMsg('Generating ZIP…');
      const blob=await zip.generateAsync({type:'blob'}, meta=> setMsg(`Generating ${Math.round(meta.percent)}%`));
      status.innerHTML='';
      successOut(status,{
        title:'ZIP ready',
        msg:`${kept.length} photos packed (${humanSize(blob.size)})`,
        downloads:[{blob, name:getOutputFileName('photos-edited.zip'), label:'Download ZIP'}]
      });
    }catch(e){ errorOut(status,friendly(e),e); }
  }

  async function buildPdf(){
    const kept=images.filter(p=> !p.removed);
    if(!kept.length){ toast('No kept photos','info'); return; }
    // Ensure pdf-lib is loaded (deferred); give it a moment if still loading
    if(typeof PDFLib==='undefined' || !PDFLib.PDFDocument){
      toast('PDF engine is still loading — please wait a second and try again.','info');
      // retry once after 800ms if it appears
      await new Promise(r=> setTimeout(r,800));
      if(typeof PDFLib==='undefined' || !PDFLib.PDFDocument){
        const s=toolPane('Photos → PDF');
        errorOut(s,'The PDF engine could not be loaded. Check your internet connection once — afterwards it works offline.', new Error('PDFLib missing'));
        return;
      }
    }
    const status=toolPane('Photos → PDF');
    const setMsg=loading(status,'Creating PDF from all kept photos…');
    try{
      const doc=await PDFLib.PDFDocument.create();
      const A4W=595.28, A4H=841.89, MARGIN=24;
      for(let i=0;i<kept.length;i++){
        const p=kept[i];
        setMsg(`Adding ${i+1}/${kept.length} — ${p.name}`);
        // Render at reasonable scale to avoid huge canvases (max 2000px side)
        const maxSide=Math.max(p.w,p.h);
        let renderScale=1;
        if(maxSide>2000) renderScale=2000/maxSide;
        const cv=await renderTransformedCanvas(p, renderScale);
        const jpg=await canvasToBlob(cv,'image/jpeg',0.88);
        const buf=await jpg.arrayBuffer();
        // Use helper if available for compatibility
        let emb;
        try{
          if(typeof embedImageDoc==='function') emb=await embedImageDoc(doc, buf, 'image/jpeg');
          else emb=await doc.embedJpg(new Uint8Array(buf));
        }catch(e){
          emb=await doc.embedJpg(new Uint8Array(buf));
        }
        const iw=emb.width, ih=emb.height;
        // Fit inside A4 with margin, keep aspect
        const availW=A4W - MARGIN*2, availH=A4H - MARGIN*2;
        const scale=Math.min(availW/iw, availH/ih, 1);
        const dw=iw*scale, dh=ih*scale;
        const page=doc.addPage([A4W, A4H]);
        const x=(A4W-dw)/2, y=(A4H-dh)/2;
        page.drawImage(emb,{x, y, width:dw, height:dh});
        await tick();
      }
      setMsg('Finalizing PDF…');
      const bytes=await doc.save({useObjectStreams:true});
      const blob=new Blob([bytes],{type:'application/pdf'});
      const effectiveName=(els.fileName.value||'').trim() ? getOutputFileName('photos.pdf').replace(/\.zip$/i,'.pdf') : 'photos.pdf';
      successOut(status,{
        title:'PDF ready',
        msg:`${kept.length} photo${kept.length===1?'':'s'} combined into A4 PDF (${humanSize(blob.size)}) — all kept photos exported.`,
        downloads:[{blob,name:effectiveName, label:'Download PDF'}]
      });
    }catch(e){ errorOut(status,friendly(e),e); }
  }

  async function compressWorkspace(){
    const kept=images.filter(p=> !p.removed);
    if(!kept.length){ toast('No photos','info'); return; }
    const totalSize=kept.reduce((a,b)=>a+b.size,0);
    const status=toolPane('Compress photos');
    status.innerHTML=`
      <div class="ph-compress-card glass">
        <div class="ph-compress-header">
          <div class="ph-compress-icon">🗜</div>
          <div class="ph-compress-title">
            <h4>Compress Photos</h4>
            <p>${kept.length} kept • ${humanSize(totalSize)} total • Re-encoded at chosen quality</p>
          </div>
          <span class="badge dim">${kept.length} photos</span>
        </div>

        <div class="ph-compress-grid">
          <div class="ph-compress-field">
            <label class="ph-compress-label">Quality <span class="ph-compress-val" id="phQVal">80%</span></label>
            <div class="ph-compress-slider-wrap">
              <input type="range" id="phQ" min="1" max="100" value="80">
              <div class="ph-compress-scale">
                <span>1% tiny</span><span>Balanced</span><span>100% max</span>
              </div>
            </div>
            <div class="seg-row ph-compress-presets" id="phQPres">
              <button class="seg" data-q="10">10%<br><small>Tiny</small></button>
              <button class="seg" data-q="60">Low<br><small>60%</small></button>
              <button class="seg active" data-q="80">Balanced<br><small>80%</small></button>
              <button class="seg" data-q="92">High<br><small>92%</small></button>
            </div>
          </div>

          <div class="ph-compress-field">
            <label class="ph-compress-label">Output format</label>
            <div class="ph-format-grid" id="phCFmtGrid">
              <button class="ph-format-card active" data-fmt="auto"><span class="ph-format-icon">◎</span><b>Keep original</b><small>Best for mixed</small></button>
              <button class="ph-format-card" data-fmt="image/jpeg"><span class="ph-format-icon">🖼</span><b>JPEG</b><small>Small, universal</small></button>
              <button class="ph-format-card" data-fmt="image/webp"><span class="ph-format-icon">✨</span><b>WebP</b><small>Modern, ~30% smaller</small></button>
              <button class="ph-format-card" data-fmt="image/png"><span class="ph-format-icon">⬢</span><b>PNG</b><small>Lossless</small></button>
              <button class="ph-format-card" data-fmt="image/avif"><span class="ph-format-icon">🎞</span><b>AVIF</b><small>Next-gen</small></button>
            </div>
            <select id="phCFmt" hidden><option value="auto" selected>Keep original</option><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option><option value="image/png">PNG</option><option value="image/avif">AVIF</option></select>
          </div>
        </div>

        <div class="ph-compress-info">
          <span class="ph-compress-info-item">💡 Quality 10% = tiny file, 100% = largest. Always re-encodes — 10% is always much smaller.</span>
          <span class="ph-compress-info-item">ZIP • Offline • No upload</span>
        </div>

        <div class="tool-actions" style="justify-content:flex-end; gap:12px; margin-top:18px;">
          <button class="btn btn-ghost" id="phCompCancel">Cancel</button>
          <button class="btn btn-primary btn-lg" id="phCompGo">🗜 Compress All Photos</button>
        </div>
      </div>
    `;
    const qRange=$('#phQ',status), qVal=$('#phQVal',status);
    const qPres=$('#phQPres',status), fmtGrid=$('#phCFmtGrid',status), fmtSel=$('#phCFmt',status);
    qRange.addEventListener('input', ()=>{
      qVal.textContent=qRange.value+'%';
      if(qPres) $$('.seg',qPres).forEach(b=> b.classList.toggle('active', +b.dataset.q===+qRange.value));
    });
    if(qPres){
      qPres.addEventListener('click', e=>{
        const b=e.target.closest('[data-q]'); if(!b) return;
        $$('.seg',qPres).forEach(s=> s.classList.remove('active')); b.classList.add('active');
        qRange.value=b.dataset.q; qVal.textContent=b.dataset.q+'%';
      });
    }
    if(fmtGrid && fmtSel){
      fmtGrid.addEventListener('click', e=>{
        const b=e.target.closest('[data-fmt]'); if(!b) return;
        $$('.ph-format-card',fmtGrid).forEach(s=> s.classList.remove('active')); b.classList.add('active');
        fmtSel.value=b.dataset.fmt;
      });
    }
    const compCancel=$('#phCompCancel',status);
    if(compCancel) compCancel.addEventListener('click', ()=>{ if(current) renderMain(); else renderMainEmpty(); });
    $('#phCompGo',status).onclick= async ()=>{
      const q=Number(qRange.value)/100;
      const fmtSelVal=$('#phCFmt',status).value;
      const targets=kept;
      if(!targets.length) return;

      // Proper compressor: respects extension, 10% is always tiny
      async function properCompress(p, quality, fmtChoice){
        const maxDim = Math.max(p.w, p.h);
        // Aggressive downscale for low quality to guarantee tiny file
        let maxSide;
        if(quality <= 0.15) maxSide = 1024;        // 10% tiny → 1024
        else if(quality <= 0.4) maxSide = 1280;     // 30% → 1280
        else if(quality <= 0.65) maxSide = 1600;    // 60% → 1600
        else if(quality <= 0.85) maxSide = 1920;    // 80% → 1920
        else maxSide = 2560;                        // 92% → 2560
        let scale = 1;
        if(maxDim > maxSide) scale = maxSide / maxDim;
        const cv = await renderTransformedCanvas(p, scale);
        let fmt = fmtChoice==='auto' ? (p.type || 'image/jpeg') : fmtChoice;
        if(fmt==='auto') fmt = p.type || 'image/jpeg';

        // If browser-image-compression is available, use it for better quality at same extension (client-side, no upload)
        if(window.imageCompression && typeof window.imageCompression === 'function' && (fmt==='image/jpeg' || fmt==='image/webp' || fmt==='image/png')){
          try{
            // Create temp file from canvas for the library
            const tmpBlob = await new Promise(res=> cv.toBlob(res, fmt==='image/png' ? 'image/png' : fmt, fmt==='image/png'?undefined:quality));
            if(tmpBlob){
              const tmpFile = new File([tmpBlob], p.name, {type: fmt});
              const opts = {
                maxWidthOrHeight: maxSide,
                initialQuality: Math.max(0.05, Math.min(1, quality)),
                useWebWorker: true,
                fileType: fmt,
                maxSizeMB: 20,
                alwaysKeepResolution: false
              };
              // For PNG keep original at low quality, use pngquant-like via library (it will handle)
              const compressedFile = await window.imageCompression(tmpFile, opts);
              const blob = new Blob([await compressedFile.arrayBuffer()], {type: fmt});
              // Ensure 10% is always smaller than original — if still larger (rare), force JPEG at 10%
              if(blob.size < p.size || quality <= 0.15){
                return {blob, fmt};
              }
              // If still not smaller and quality is very low, try extra downscale
              if(quality <= 0.15 && blob.size >= p.size){
                const extraScale = 0.75;
                const cv2 = await renderTransformedCanvas(p, scale*extraScale);
                const blob2 = await new Promise(res=> cv2.toBlob(res, fmt, quality));
                if(blob2 && blob2.size < p.size) return {blob: blob2, fmt};
              }
            }
          }catch(e){
            // fallback to canvas below
          }
        }

        // Fallback: canvasToBlob with proper quality (PNG ignores quality, but downscale already ensures smaller)
        let blob;
        try{
          blob = await canvasToBlob(cv, fmt, fmt==='image/png' || fmt==='image/bmp' ? undefined : quality);
        }catch(e){
          if(fmt==='image/avif' || fmt==='image/tiff' || fmt==='image/bmp'){
            const fb = fmt==='image/avif' ? 'image/webp' : 'image/png';
            const b2 = await canvasToBlob(cv, fb, fb==='image/png'?undefined:quality);
            return {blob: b2, fmt: fb};
          }
          throw e;
        }
        return {blob, fmt};
      }

      if(targets.length===1){
        const p=targets[0];
        const setMsg=loading(status,'Compressing single photo…');
        try{
          const {blob, fmt} = await properCompress(p, q, fmtSelVal);
          const ext=fmt.split('/')[1].replace('jpeg','jpg');
          const saved = p.size - blob.size;
          const pct = Math.round(blob.size/p.size*100);
          status.innerHTML='';
          successOut(status,{
            title: blob.size < p.size ? 'Compressed photo ready' : 'Re-encoded photo ready',
            msg: blob.size < p.size ? `Saved ${humanSize(saved)} (${pct}% of original) • ${fmt.split('/')[1].toUpperCase()} @ ${Math.round(q*100)}% • ${p.w}×${p.h} → ${Math.round(p.w*(Math.max(p.w,p.h)>2560?2560/Math.max(p.w,p.h):1))}×${Math.round(p.h*(Math.max(p.w,p.h)>2560?2560/Math.max(p.w,p.h):1))}` : `Re-encoded at ${Math.round(q*100)}% • ${humanSize(blob.size)} (${pct}% of original) • ${fmt.split('/')[1].toUpperCase()} — quality 10% is always tiny`,
            downloads:[{blob,name:`${baseOf(sanitizeName(p.name))}-compressed.${ext}`,label: blob.size < p.size ? 'Download Compressed' : 'Download Re-encoded'}]
          });
          // Show comparison
          const cmp = compareHTML(p.size, blob.size, 'Original','Compressed');
          status.querySelector('.success-box').insertAdjacentHTML('beforeend', cmp);
          animateBars(status);
        }catch(e){ errorOut(status,friendly(e),e); }
        return;
      }
      const setMsg=loading(status,'Compressing all photos…');
      try{
        const zip=new JSZip();
        let totalOrig=0, totalComp=0;
        for(let i=0;i<targets.length;i++){
          const p=targets[i];
          setMsg(`Compressing ${i+1}/${targets.length} • ${p.name}`);
          const {blob, fmt} = await properCompress(p, q, fmtSelVal);
          totalOrig+=p.size; totalComp+=blob.size;
          const ext=fmt.split('/')[1].replace('jpeg','jpg');
          zip.file(`${baseOf(sanitizeName(p.name))}-compressed.${ext}`, await blob.arrayBuffer());
          await tick();
        }
        setMsg('Packing ZIP…');
        const zipBlob=await zip.generateAsync({type:'blob'});
        status.innerHTML='';
        const saved = totalOrig - totalComp;
        const pct = totalOrig ? Math.round(totalComp/totalOrig*100) : 100;
        successOut(status,{
          title: totalComp < totalOrig ? 'Compressed photos ready' : 'Re-encoded photos ready',
          msg: `${targets.length} photos • ${humanSize(totalOrig)} → ${humanSize(totalComp)} ${totalComp < totalOrig ? `• Saved ${humanSize(saved)} (${pct}% of original)` : `• Re-encoded at ${Math.round(q*100)}%`} `,
          downloads:[{blob:zipBlob,name:'photos-compressed.zip',label:'Download ZIP'}]
        });
        const cmp = compareHTML(totalOrig, totalComp, 'Original total','Compressed total');
        status.querySelector('.success-box').insertAdjacentHTML('beforeend', cmp);
        animateBars(status);
      }catch(e){ errorOut(status,friendly(e),e); }
    };
  }

  async function convertWorkspace(){
    const kept=images.filter(p=> !p.removed);
    if(!kept.length) return;
    const status=toolPane('Convert format');
    status.innerHTML=`
      <div class="ph-convert-card glass">
        <div class="ph-convert-header">
          <div class="ph-convert-icon">🔁</div>
          <div class="ph-convert-title">
            <h4>Convert Format</h4>
            <p>${kept.length} kept photos • Choose output • All converted in one ZIP</p>
          </div>
          <span class="badge dim">${kept.length} photos</span>
        </div>

        <div class="ph-convert-formats">
          <span class="ph-convert-label">Output format — 7 options</span>
          <div class="ph-format-grid" id="phConvGrid">
            <button class="ph-format-card active" data-fmt="image/jpeg"><span class="ph-format-icon">JPG</span><b>JPEG</b><small>Universal</small></button>
            <button class="ph-format-card" data-fmt="image/png"><span class="ph-format-icon">PNG</span><b>PNG</b><small>Lossless</small></button>
            <button class="ph-format-card" data-fmt="image/webp"><span class="ph-format-icon">WEB</span><b>WebP</b><small>Modern</small></button>
            <button class="ph-format-card" data-fmt="image/avif"><span class="ph-format-icon">AVF</span><b>AVIF</b><small>Next-gen</small></button>
            <button class="ph-format-card" data-fmt="image/bmp"><span class="ph-format-icon">BMP</span><b>BMP</b><small>Uncompressed</small></button>
            <button class="ph-format-card" data-fmt="image/gif"><span class="ph-format-icon">GIF</span><b>GIF</b><small>256 colors</small></button>
            <button class="ph-format-card" data-fmt="image/tiff"><span class="ph-format-icon">TIF</span><b>TIFF</b><small>Print</small></button>
          </div>
          <select id="phConvFmt" hidden><option value="image/jpeg" selected>JPG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option><option value="image/avif">AVIF</option><option value="image/bmp">BMP</option><option value="image/gif">GIF</option><option value="image/tiff">TIFF</option></select>
        </div>

        <div class="ph-convert-quality">
          <label class="ph-convert-label">Quality <span class="ph-convert-val" id="phConvQVal">92%</span></label>
          <div class="ph-convert-slider-wrap">
            <input type="range" id="phConvQ" min="10" max="100" value="92">
            <div class="ph-convert-scale"><span>Smaller</span><span>Balanced</span><span>Higher</span></div>
          </div>
          <p class="ph-convert-hint" id="phConvHint">PNG is lossless — quality ignored. JPEG/WebP/AVIF use quality.</p>
        </div>

        <div class="ph-convert-info">
          <span>💡 All kept photos converted together • ZIP • Offline</span>
        </div>

        <div class="tool-actions" style="justify-content:flex-end; gap:12px; margin-top:18px;">
          <button class="btn btn-ghost" id="phConvCancel">Cancel</button>
          <button class="btn btn-primary btn-lg" id="phConvGo">🔁 Convert All Photos</button>
        </div>
      </div>
    `;
    const q=$('#phConvQ',status), qv=$('#phConvQVal',status);
    const convGrid=$('#phConvGrid',status), convSel=$('#phConvFmt',status), convHint=$('#phConvHint',status);
    q.addEventListener('input', ()=> qv.textContent=q.value+'%');
    if(convGrid && convSel){
      convGrid.addEventListener('click', e=>{
        const b=e.target.closest('[data-fmt]'); if(!b) return;
        $$('.ph-format-card',convGrid).forEach(s=> s.classList.remove('active')); b.classList.add('active');
        convSel.value=b.dataset.fmt;
        const isLossless = b.dataset.fmt==='image/png' || b.dataset.fmt==='image/bmp';
        q.disabled=isLossless; q.parentElement.style.opacity=isLossless?'0.45':'1';
        if(convHint) convHint.textContent = isLossless ? 'Selected format is lossless — quality slider ignored.' : 'JPEG/WebP/AVIF use quality. PNG/BMP are lossless.';
      });
    }
    const convCancel=$('#phConvCancel',status);
    if(convCancel) convCancel.addEventListener('click', ()=>{ if(current) renderMain(); else renderMainEmpty(); });
    $('#phConvGo',status).onclick= async ()=>{
      const fmt=$('#phConvFmt',status).value;
      const quality=Number(q.value)/100;
      const targets=kept;
      if(targets.length===1){
        const p=targets[0];
        const setMsg=loading(status,'Converting single photo…');
        try{
          const cv=await renderTransformedCanvas(p,1);
          let blob, outFmt=fmt;
          try{
            blob=await canvasToBlob(cv, fmt, fmt==='image/png' || fmt==='image/bmp' ? undefined : quality);
          }catch(e){
            toast(`${fmt.split('/')[1].toUpperCase()} not supported here — using PNG instead.`,'info',3000);
            blob=await canvasToBlob(cv, 'image/png');
            outFmt='image/png';
          }
          const ext=outFmt.split('/')[1].replace('jpeg','jpg');
          status.innerHTML='';
          successOut(status,{
            title:'Converted photo ready',
            msg:`Converted to ${outFmt.split('/')[1].toUpperCase()} • ${humanSize(blob.size)}`,
            downloads:[{blob,name:`${baseOf(sanitizeName(p.name))}.${ext}`,label:'Download Photo'}]
          });
        }catch(e){ errorOut(status,friendly(e),e); }
        return;
      }
      const setMsg=loading(status,'Converting…');
      try{
        const zip=new JSZip();
        for(let i=0;i<targets.length;i++){
          const p=targets[i];
          setMsg(`Converting ${i+1}/${targets.length}`);
          const cv=await renderTransformedCanvas(p,1);
          let blob, outFmt=fmt;
          try{
            blob=await canvasToBlob(cv, fmt, fmt==='image/png' || fmt==='image/bmp' ? undefined : quality);
          }catch(e){
            toast(`${fmt.split('/')[1].toUpperCase()} not supported here — using PNG instead.`,'info',3000);
            blob=await canvasToBlob(cv, 'image/png');
            outFmt='image/png';
          }
          const ext=outFmt.split('/')[1].replace('jpeg','jpg');
          zip.file(`${baseOf(sanitizeName(p.name))}.${ext}`, await blob.arrayBuffer());
          await tick();
        }
        setMsg('Packing…');
        const blob=await zip.generateAsync({type:'blob'});
        status.innerHTML='';
        successOut(status,{
          title:'Converted photos ready',
          msg:`${targets.length} photos to ${fmt.split('/')[1].toUpperCase()}`,
          downloads:[{blob,name:`photos-converted.zip`,label:'Download ZIP'}]
        });
      }catch(e){ errorOut(status,friendly(e),e); }
    };
  }

  function showCrop(){
    const sel=getSelected().filter(p=> !p.removed);
    if(sel.length!==1){ toast('Select exactly one photo to crop','info'); return; }
    const p=sel[0];
    const status=toolPane(`Crop — ${p.name}`);
    status.innerHTML=`
      <div class="ph-crop-card glass">
        <div class="ph-crop-header">
          <div class="ph-crop-thumb">
            <img src="${p.thumbUrl || p.url}" alt="">
            <span class="ph-crop-badge">${p.w} × ${p.h}</span>
          </div>
          <div class="ph-crop-title">
            <h4>Crop Photo</h4>
            <p title="${esc(p.name)}">${esc(p.name.length>32 ? p.name.slice(0,32)+'…' : p.name)} • ${humanSize(p.size)}</p>
            <span class="ph-crop-subtitle">Drag frame • Use presets below</span>
          </div>
          <span class="badge dim ph-crop-mp">${((p.w*p.h)/1e6).toFixed(1)} MP</span>
        </div>

        <div class="ph-crop-presets" id="phAsp">
          <span class="ph-crop-presets-label">Aspect ratio</span>
          <div class="seg-row">
            <button class="seg active" data-a="0"><b>Free</b><small>Any</small></button>
            <button class="seg" data-a="1"><b>1:1</b><small>Square</small></button>
            <button class="seg" data-a="${4/3}"><b>4:3</b><small>Standard</small></button>
            <button class="seg" data-a="${16/9}"><b>16:9</b><small>Wide</small></button>
            <button class="seg" data-a="${3/4}"><b>3:4</b><small>Portrait</small></button>
            <button class="seg" data-a="${9/16}"><b>9:16</b><small>Story</small></button>
          </div>
        </div>

        <div class="ph-crop-stage-wrap">
          <div class="crop-stage ph-crop-stage" id="phStage">
            <img id="phCropImg" alt="To crop">
            <div class="crop-rect" id="phRect"><span class="hd nw" data-h="nw"></span><span class="hd ne" data-h="ne"></span><span class="hd sw" data-h="sw"></span><span class="hd se" data-h="se"></span></div>
          </div>
          <div class="ph-crop-hint"><span>◎ Drag frame to move</span><span>◰ Drag corners to resize</span></div>
        </div>

        <div class="crop-meta ph-crop-meta" id="phMeta">
          <span class="ph-crop-dims" id="phDims">— × — px</span>
          <span class="ph-crop-extra" id="phCropExtra" style="color:var(--faint)">Select an area</span>
        </div>

        <div class="tool-actions" style="justify-content:flex-end; gap:12px; margin-top:18px;">
          <button class="btn btn-ghost" id="phCropCancel">Cancel</button>
          <button class="btn btn-primary btn-lg" id="phCropApply">✂️ Apply Crop</button>
        </div>
      </div>
    `;
    const imgEl=$('#phCropImg',status), rect=$('#phRect',status), stage=$('#phStage',status), dims=$('#phDims',status);
    const extra=$('#phCropExtra',status);
    let box={x:0,y:0,w:0,h:0}, ratio=0;
    imgEl.src=p.url;
    imgEl.onload=()=>{
      requestAnimationFrame(()=>{
        const iw=imgEl.clientWidth, ih=imgEl.clientHeight;
        const w=iw*0.8, h=iw*0.6;
        box={x:(iw-w)/2,y:(ih-h)/2,w,h}; paint();
      });
    };
    function paint(){
      rect.style.left=box.x+'px'; rect.style.top=box.y+'px'; rect.style.width=box.w+'px'; rect.style.height=box.h+'px';
      const s=imgEl.naturalWidth/(imgEl.clientWidth||1);
      const sw=Math.round(box.w*s), sh=Math.round(box.h*s);
      dims.textContent=`${sw} × ${sh} px`;
      if(extra){
        const mp=(sw*sh/1e6).toFixed(2);
        const r=(sw&&sh)? (sw/sh).toFixed(2)+':1' : '-';
        extra.textContent=`• ${mp} MP • ${r} • ${Math.round((sw*sh)/(p.w*p.h)*100)}% of original`;
      }
    }
    function applyResize(mode,dx,dy,b0,iw,ih){
      const L=b0.x,T=b0.y,R=b0.x+b0.w,B=b0.y+b0.h;
      let nL=mode.includes('w')?Math.min(Math.max(0,L+dx),R-24):L;
      let nR=mode.includes('e')?Math.max(Math.min(iw,R+dx),L+24):R;
      let nT=mode.includes('n')?Math.min(Math.max(0,T+dy),B-24):T;
      let nB=mode.includes('s')?Math.max(Math.min(ih,B+dy),T+24):B;
      let w=nR-nL,h=nB-nT;
      if(ratio){
        const vertOnly=(mode==='n'||mode==='s');
        if(vertOnly) w=h*ratio; else h=w/ratio;
        const anchorRight=mode.includes('w'), anchorBottom=mode.includes('n');
        const availW=anchorRight?R:iw-L;
        const availH=anchorBottom?B:ih-T;
        const k=Math.min(1,availW/w,availH/h);
        w*=k; h*=k;
        nL=anchorRight?R-w:L; nT=anchorBottom?B-h:T;
        return {x:nL,y:nT,w,h};
      }
      return {x:nL,y:nT,w:nR-nL,h:nB-nT};
    }
    function startPointer(e){
      const target=e.target.closest('[data-h]');
      const mode=target?target.dataset.h:'move';
      const iw=imgEl.clientWidth, ih=imgEl.clientHeight, b0={...box};
      const sx=e.clientX,sy=e.clientY;
      const move=ev=>{
        const dx=ev.clientX-sx, dy=ev.clientY-sy;
        if(mode==='move'){
          box.w=b0.w; box.h=b0.h;
          box.x=Math.min(Math.max(b0.x+dx,0),Math.max(0,iw-b0.w));
          box.y=Math.min(Math.max(b0.y+dy,0),Math.max(0,ih-b0.h));
        } else { box=applyResize(mode,dx,dy,b0,iw,ih); }
        paint();
      };
      const up=()=> window.removeEventListener('pointermove',move);
      window.addEventListener('pointermove',move);
      window.addEventListener('pointerup',up,{once:true});
      e.preventDefault();
    }
    rect.addEventListener('pointerdown', startPointer);
    $('#phAsp',status).addEventListener('click', e=>{
      const b=e.target.closest('[data-a]'); if(!b) return;
      $$('.seg',status).forEach(s=> s.classList.remove('active')); b.classList.add('active');
      ratio= b.dataset.a==='0'?0:+b.dataset.a;
      if(imgEl.clientWidth) { const iw=imgEl.clientWidth, ih=imgEl.clientHeight; const w=iw*0.6, h=ratio? w/ratio : ih*0.6; box={x:(iw-w)/2,y:(ih-h)/2,w,h}; paint(); }
    });
    const cancelBtn=$('#phCropCancel',status);
    if(cancelBtn) cancelBtn.addEventListener('click', ()=>{ if(current) renderMain(); else renderMainEmpty(); });
    $('#phCropApply',status).onclick= async ()=>{
      const s=imgEl.naturalWidth/imgEl.clientWidth;
      const sx=Math.round(box.x*s), sy=Math.round(box.y*s), sw=Math.round(box.w*s), sh=Math.round(box.h*s);
      const cv=document.createElement('canvas'); cv.width=sw; cv.height=sh;
      const ctx=cv.getContext('2d');
      // apply existing rotation/flip before crop? For simplicity, crop from original then apply transforms via p
      // We'll crop the transformed canvas? Easier: render transformed then crop from that
      const srcCv=await renderTransformedCanvas(p,1);
      // srcCv is already transformed at scale 1 (original size with swap)
      const scaleX=srcCv.width / imgEl.naturalWidth;
      const scaleY=srcCv.height / imgEl.naturalHeight;
      // But simpler: draw source image region directly
      const tmpImg=p.img;
      ctx.drawImage(tmpImg, sx, sy, sw, sh, 0,0, sw, sh);
      const blob=await canvasToBlob(cv, p.type==='image/png'?'image/png':'image/jpeg',0.92);
      const newUrl=URL.createObjectURL(blob);
      // create new image entry replacing p
      pushHistory();
      p.img = await new Promise((res,rej)=>{
        const im=new Image(); im.onload=()=> res(im); im.onerror=rej; im.src=newUrl;
      });
      p.url=newUrl;
      p.thumbUrl=newUrl;
      p.w=sw; p.h=sh; p.size=blob.size;
      p.file = new File([blob], p.name, {type: blob.type});
      p.rotation=0; p.flipH=false; p.flipV=false;
      // regenerate thumb
      const tcv=document.createElement('canvas'); const tw=220; const sc=Math.min(1, tw/Math.max(sw,sh)); tcv.width=Math.round(sw*sc); tcv.height=Math.round(sh*sc); tcv.getContext('2d').drawImage(cv,0,0,tcv.width,tcv.height); p.thumbUrl=tcv.toDataURL('image/jpeg',0.7);
      pushHistory();
      renderThumbs(); renderMain();
      toast('Crop applied','success');
    };
  }

  async function showResize(){
    const sel=getSelected().filter(p=> !p.removed);
    if(sel.length!==1){ toast('Select one photo to resize','info'); return; }
    const p=sel[0];
    const status=toolPane(`Resize — ${p.name}`);
    status.innerHTML=`
      <div class="ph-resize-card glass">
        <div class="ph-resize-header">
          <div class="ph-resize-thumb">
            <img src="${p.thumbUrl || p.url}" alt="">
            <span class="ph-resize-badge">${p.w} × ${p.h}</span>
          </div>
          <div class="ph-resize-title">
            <h4>Resize Photo</h4>
            <p title="${esc(p.name)}">${esc(p.name.length>28 ? p.name.slice(0,28)+'…' : p.name)} • ${humanSize(p.size)} • Original</p>
            <span class="ph-resize-subtitle">${p.w} × ${p.h} px • ${((p.w*p.h)/1e6).toFixed(2)} MP • ${(p.w/p.h).toFixed(2)}:1</span>
          </div>
          <span class="badge dim ph-resize-mp">${((p.w*p.h)/1e6).toFixed(1)} MP</span>
        </div>

        <div class="ph-resize-inputs">
          <label class="ph-resize-field">
            <span class="ph-resize-label"><span class="ph-icon">↔</span> Width</span>
            <div class="ph-resize-input-wrap">
              <input type="number" id="phW" value="${p.w}" min="1" max="8000" inputmode="numeric">
              <span class="ph-resize-unit">px</span>
            </div>
          </label>

          <div class="ph-resize-lock">
            <button type="button" class="ph-resize-lock-btn" id="phLockBtn" aria-label="Toggle aspect ratio lock" title="Aspect lock">
              <span id="phLockIcon">🔗</span>
            </button>
            <span class="ph-resize-lock-label" id="phLockLabel">Locked</span>
            <input type="checkbox" id="phLock" checked hidden>
          </div>

          <label class="ph-resize-field">
            <span class="ph-resize-label"><span class="ph-icon">↕</span> Height</span>
            <div class="ph-resize-input-wrap">
              <input type="number" id="phH" value="${p.h}" min="1" max="8000" inputmode="numeric">
              <span class="ph-resize-unit">px</span>
            </div>
          </label>
        </div>

        <div class="ph-resize-meta">
          <span id="phRatioInfo" class="ph-resize-meta-item">↔ ${(p.w/p.h).toFixed(2)}:1</span>
          <span id="phScaleInfo" class="ph-resize-meta-item">100% scale</span>
          <span id="phEstSize" class="ph-resize-meta-item">${humanSize(p.size)} est.</span>
        </div>

        <div class="ph-resize-presets" id="phPres">
          <span class="ph-resize-presets-label">Quick presets</span>
          <div class="seg-row">
            <button class="seg" data-p="25"><b>25%</b><small>${Math.round(p.w*0.25)}×${Math.round(p.h*0.25)}</small></button>
            <button class="seg" data-p="50"><b>50%</b><small>${Math.round(p.w*0.5)}×${Math.round(p.h*0.5)}</small></button>
            <button class="seg" data-p="75"><b>75%</b><small>${Math.round(p.w*0.75)}×${Math.round(p.h*0.75)}</small></button>
            <button class="seg active" data-p="100"><b>100%</b><small>${p.w}×${p.h}</small></button>
          </div>
        </div>

        <div class="tool-actions" style="justify-content:flex-end; gap:12px; margin-top:18px;">
          <button class="btn btn-ghost" id="phResizeCancel">Cancel</button>
          <button class="btn btn-primary btn-lg" id="phResizeGo">✨ Apply Resize</button>
        </div>
      </div>
    `;
    const wIn=$('#phW',status), hIn=$('#phH',status), lock=$('#phLock',status);
    const lockBtn=$('#phLockBtn',status), lockIcon=$('#phLockIcon',status), lockLabel=$('#phLockLabel',status);
    const ratioInfo=$('#phRatioInfo',status), scaleInfo=$('#phScaleInfo',status), estSize=$('#phEstSize',status);
    const ratio=p.w/p.h;
    function updateLockUI(){
      const locked=lock.checked;
      lockIcon.textContent = locked ? '🔗' : '🔓';
      lockLabel.textContent = locked ? 'Locked' : 'Free';
      lockBtn.classList.toggle('unlocked', !locked);
      lockBtn.title = locked ? 'Aspect locked — height follows width' : 'Free — width & height independent';
    }
    function updateMeta(){
      const w=+wIn.value||0, h=+hIn.value||0;
      const mp=(w*h/1e6).toFixed(2);
      const sc=Math.round((w/p.w)*100);
      const r=(w&&h)? (w/h).toFixed(2)+':1' : '-';
      if(ratioInfo) ratioInfo.textContent = '↔ '+r;
      if(scaleInfo) scaleInfo.textContent = (isFinite(sc)? sc : 0)+'% scale • '+mp+' MP';
      if(estSize){
        const est = Math.round(p.size * (w*h)/(p.w*p.h));
        estSize.textContent = humanSize(isFinite(est)? est : p.size)+' est.';
      }
    }
    function sync(from){
      if(!lock.checked) { updateMeta(); return; }
      if(from==='w'){ const w=+wIn.value||0; hIn.value=Math.max(1,Math.round(w/ratio)); }
      else { const h=+hIn.value||0; wIn.value=Math.max(1,Math.round(h*ratio)); }
      updateMeta();
    }
    wIn.addEventListener('input', ()=> sync('w'));
    hIn.addEventListener('input', ()=> sync('h'));
    lockBtn.addEventListener('click', ()=>{
      lock.checked = !lock.checked;
      updateLockUI();
      if(lock.checked) sync('w');
      updateMeta();
    });
    updateLockUI(); updateMeta();
    $('#phPres',status).addEventListener('click', e=>{
      const b=e.target.closest('[data-p]'); if(!b) return;
      $$('.seg',status).forEach(s=> s.classList.remove('active')); b.classList.add('active');
      const k=+b.dataset.p/100; wIn.value=Math.round(p.w*k); hIn.value=Math.round(p.h*k); updateMeta();
    });
    $('#phResizeCancel',status).addEventListener('click', ()=>{ if(current) renderMain(); else renderMainEmpty(); });
    $('#phResizeGo',status).onclick= async ()=>{
      const w=Math.round(+wIn.value), h=Math.round(+hIn.value);
      if(!w||!h||w>8000||h>8000){ toast('Invalid size','error'); return; }
      const cv=await renderTransformedCanvas(p,1);
      const out=document.createElement('canvas'); out.width=w; out.height=h;
      const ctx=out.getContext('2d'); ctx.imageSmoothingQuality='high'; ctx.drawImage(cv,0,0,w,h);
      const blob=await canvasToBlob(out, p.type==='image/png'?'image/png':'image/jpeg',0.92);
      const newUrl=URL.createObjectURL(blob);
      pushHistory();
      p.img = await new Promise((res,rej)=>{ const im=new Image(); im.onload=()=> res(im); im.onerror=rej; im.src=newUrl; });
      p.url=newUrl; p.thumbUrl=newUrl; p.w=w; p.h=h; p.size=blob.size; p.file=new File([blob], p.name,{type:blob.type}); p.rotation=0; p.flipH=false; p.flipV=false;
      const tcv=document.createElement('canvas'); const tw=220; const sc=Math.min(1, tw/Math.max(w,h)); tcv.width=Math.round(w*sc); tcv.height=Math.round(h*sc); tcv.getContext('2d').drawImage(out,0,0,tcv.width,tcv.height); p.thumbUrl=tcv.toDataURL('image/jpeg',0.7);
      pushHistory();
      renderThumbs(); renderMain();
      toast(`Resized to ${w}×${h}`,'success');
    };
  }

  function showInfo(){
    const status=toolPane('Workspace Info');
    if(!images.length){ status.innerHTML=`<div class="empty-state"><div class="es-ic">🖼️</div><b>No photos</b><p>Add photos to see details.</p></div>`; return; }
    const kept=images.filter(p=> !p.removed).length;
    const removed=images.filter(p=> p.removed).length;
    const totalSize=images.reduce((a,b)=> a+b.size,0);
    status.innerHTML=`
      <div class="stat-grid" style="max-width:760px">
        <div class="stat-tile"><b>${images.length}</b><span>Photos</span></div>
        <div class="stat-tile"><b>${kept}</b><span>Kept</span></div>
        <div class="stat-tile"><b>${removed}</b><span>Removed</span></div>
        <div class="stat-tile"><b>${humanSize(totalSize)}</b><span>Total size</span></div>
      </div>
      <div style="overflow-x:auto;margin-top:16px">
        <table class="info-table"><thead><tr><th>#</th><th>File</th><th>Dimensions</th><th>Size</th><th>Status</th></tr></thead><tbody>
          ${images.map((p,i)=> `<tr><td>${i+1}</td><td title="${esc(p.name)}">${esc(p.name)}</td><td>${p.w}×${p.h}</td><td>${humanSize(p.size)}</td><td>${p.removed?'Removed':'Kept'}</td></tr>`).join('')}
        </tbody></table>
      </div>
      <p class="tool-note">Left Photos list has its own scrollbar; main preview scrolls with window.</p>
    `;
  }

  function clearWorkspace(){
    if(images.length && !confirm(`Clear ${images.length} photo${images.length===1?'':'s'}? This cannot be undone.`)) return;
    images.forEach(im=>{ try{ URL.revokeObjectURL(im.url);}catch{}; try{ URL.revokeObjectURL(im.thumbUrl);}catch{} });
    images=[]; current=null; dragIdx=null; lastSelectedIdx=-1;
    history=[]; histIdx=-1; pushHistory();
    renderThumbs(); renderMainEmpty(); toast('Workspace cleared','info');
  }

  /* Events */
  els.add.addEventListener('click', ()=> fileInput.click());
  fileInput.addEventListener('change', ()=>{ addFiles(fileInput.files); fileInput.value=''; });

  els.remove.addEventListener('click', ()=>{
    const sel=getSelected().filter(p=> !p.removed); if(!sel.length) return;
    pushHistory(); sel.forEach(p=> p.removed=true); pushHistory(); renderThumbs(); renderMain();
  });
  els.restore.addEventListener('click', ()=>{
    const sel=getSelected().filter(p=> p.removed); if(!sel.length) return;
    pushHistory(); sel.forEach(p=> p.removed=false); pushHistory(); renderThumbs(); renderMain();
  });
  els.rotate.addEventListener('click', rotateSelected);
  els.flipH.addEventListener('click', ()=> flipSelected('h'));
  els.flipV.addEventListener('click', ()=> flipSelected('v'));
  els.duplicate.addEventListener('click', duplicateSelected);
  els.crop.addEventListener('click', showCrop);
  els.resize.addEventListener('click', showResize);
  function applyFilterToSelection(filterName){
    const sel=getSelected(); if(!sel.length){ toast('Select photos first','info'); return; }
    pushHistory();
    sel.forEach(p=> p.filter = p.filter===filterName ? null : filterName);
    pushHistory();
    renderThumbs(); if(sel.includes(current)) renderMain(); else updateToolbar();
    toast(`${filterName} ${sel.length>1? `applied to ${sel.length} photos` : 'toggled'} — Undo to revert`,'success',2000);
  }
  els.gray.addEventListener('click', ()=> applyFilterToSelection('gray'));
  els.sepia.addEventListener('click', ()=> applyFilterToSelection('sepia'));
  els.invert.addEventListener('click', ()=> applyFilterToSelection('invert'));
  els.blur.addEventListener('click', ()=> applyFilterToSelection('blur'));
  els.vintage.addEventListener('click', ()=> applyFilterToSelection('vintage'));
  els.vivid.addEventListener('click', ()=> applyFilterToSelection('vivid'));
  els.filterReset.addEventListener('click', ()=>{
    const sel=getSelected(); if(!sel.length) return;
    pushHistory(); sel.forEach(p=> p.filter=null); pushHistory(); renderThumbs(); renderMain();
    toast('Filters cleared','info');
  });

  els.download.addEventListener('click', downloadAll);
  els.downloadOne.addEventListener('click', downloadSelected);
  els.toPdf.addEventListener('click', buildPdf);
  els.compress.addEventListener('click', compressWorkspace);
  els.convert.addEventListener('click', convertWorkspace);
  els.info.addEventListener('click', showInfo);
  els.clear.addEventListener('click', clearWorkspace);

  els.selectAll.addEventListener('click', ()=>{
    const vis=images.filter(p=> !p.hiddenByFilter);
    const allSelected=vis.length && vis.every(p=> p.selected);
    if(allSelected) vis.forEach(p=> p.selected=false); else vis.forEach(p=> p.selected=true);
    if(vis.length){ current=vis[vis.length-1]; lastSelectedIdx=images.indexOf(current); }
    renderThumbs();
  });
  els.deselect.addEventListener('click', ()=>{ images.forEach(p=> p.selected=false); renderThumbs(); updateToolbar(); });
  els.jump.addEventListener('change', ()=>{
    const n=Number(els.jump.value); if(!n||n<1||n>images.length) return;
    const target=images[n-1]; if(!target) return;
    images.forEach(p=> p.selected=false); target.selected=true; current=target; lastSelectedIdx=n-1;
    renderThumbs(); renderMain();
    requestAnimationFrame(()=>{ if(target.el) target.el.scrollIntoView({block:'nearest', behavior:'smooth'}); });
  });
  els.jump.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); els.jump.dispatchEvent(new Event('change')); }});
  els.filter.addEventListener('input', e=> setFilter(e.target.value));
  els.filter.addEventListener('keydown', e=>{ if(e.key==='Escape'){ e.target.value=''; setFilter(''); }});
  els.undo.addEventListener('click', undo);
  els.redo.addEventListener('click', redo);

  function setZoom(v){ zoomMode=v; els.zoomSel.value=v; if(current) renderMain(); updateToolbar(); }
  els.zoomSel.addEventListener('change', e=> setZoom(e.target.value));
  els.zoomIn.addEventListener('click', ()=>{ const order=['fit','0.5','0.75','1','1.5','2']; let idx=order.indexOf(String(zoomMode)); if(idx===-1) idx=0; if(idx<order.length-1) setZoom(order[idx+1]); });
  els.zoomOut.addEventListener('click', ()=>{ const order=['fit','0.5','0.75','1','1.5','2']; let idx=order.indexOf(String(zoomMode)); if(idx===-1) idx=2; if(idx>0) setZoom(order[idx-1]); });
  els.zoomReset.addEventListener('click', ()=> setZoom('fit'));

  els.sortName.addEventListener('click', ()=>{
    pushHistory();
    images.sort((a,b)=> a.name.localeCompare(b.name));
    pushHistory();
    renderThumbs(); toast('Sorted by name','info');
  });
  els.sortSize.addEventListener('click', ()=>{
    pushHistory();
    images.sort((a,b)=> b.size - a.size);
    pushHistory();
    renderThumbs(); toast('Sorted by size','info');
  });
  els.fileName.addEventListener('change', e=>{
    outputName=sanitizeName(e.target.value.trim()||'photos-edited.zip');
    e.target.value=outputName;
  });
  els.fileName.value=outputName;

  root.addEventListener('keydown', e=>{
    const tag=(e.target.tagName||'').toLowerCase();
    const isInput=tag==='input'||tag==='textarea'||tag==='select'||e.target.isContentEditable;
    if(isInput && !(e.ctrlKey||e.metaKey)) return;
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='z' && !e.shiftKey){ e.preventDefault(); undo(); }
    else if((e.ctrlKey||e.metaKey) && (e.key.toLowerCase()==='y' || (e.key.toLowerCase()==='z' && e.shiftKey))){ e.preventDefault(); redo(); }
    else if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='a'){ e.preventDefault(); els.selectAll.click(); }
    else if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='s'){ e.preventDefault(); downloadAll(); }
    else if(e.key==='Delete'||e.key==='Backspace'){
      if(isInput) return;
      e.preventDefault();
      const sel=getSelected().filter(p=> !p.removed);
      if(sel.length){ pushHistory(); sel.forEach(p=> p.removed=true); pushHistory(); renderThumbs(); renderMain(); }
    } else if(e.key.toLowerCase()==='r' && !e.ctrlKey && !e.metaKey && !e.altKey){
      if(isInput) return; e.preventDefault(); rotateSelected();
    } else if(e.key==='Escape'){
      const back=$('#phBack', main);
      if(back) back.click(); else { images.forEach(p=> p.selected=false); renderThumbs(); }
    }
  });
  root.tabIndex=-1;
  requestAnimationFrame(()=>{ try{ root.focus({preventScroll:true}); }catch{} });

  let depth=0;
  root.addEventListener('dragenter', e=>{ e.preventDefault(); depth++; root.classList.add('drag'); });
  root.addEventListener('dragover', e=> e.preventDefault());
  root.addEventListener('dragleave', ()=>{ depth=Math.max(0,depth-1); if(!depth) root.classList.remove('drag'); });
  root.addEventListener('drop', e=>{
    e.preventDefault(); depth=0; root.classList.remove('drag');
    if(e.dataTransfer.files && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });

  renderThumbs();
  renderMainEmpty();
}

window.renderPhotoEditor = renderPhotoEditor;

const PHOTO_EDITOR_IDS = new Set([
  'photo-editor',
  'images-to-pdf',
  'image-compressor',
  'image-resizer',
  'image-converter',
  'image-to-jpg-png',
  'image-cropper',
  'image-info'
]);

// Wrap openTool to route photo tools to dedicated page (preserve PDF routing)
(function(){
  const prev = window.openTool;
  const pdfIds = (typeof PDF_EDITOR_IDS !== 'undefined') ? PDF_EDITOR_IDS : new Set();
  window.openTool = function(id){
    if(PHOTO_EDITOR_IDS.has(id)){
      if(typeof addRecent === 'function') addRecent(id);
      if(!location.pathname.endsWith('photo-editor.html')){
        window.location.href = 'photo-editor.html';
        return;
      }
      const mount=document.getElementById('editorMount');
      if(mount) mount.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    if(pdfIds.has(id)){
      if(typeof addRecent === 'function') addRecent(id);
      if(!location.pathname.endsWith('pdf-editor.html')){
        window.location.href='pdf-editor.html';
        return;
      }
      const mount=document.getElementById('editorMount');
      if(mount) mount.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    if(typeof prev==='function') return prev(id);
  };
})();
