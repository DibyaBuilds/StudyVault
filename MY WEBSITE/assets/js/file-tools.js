/*
  StudyVault — Unified File Tools v1
  Mirrors PDF/Photo Editor UX: Word-like ribbon + left file list + center detail.
  Consolidates the 5 file utilities:
    - File Renamer (rename before download)
    - File Size Analyzer (sorted bars, total)
    - Duplicate Detector (SHA-256 hashing, 100% local)
    - File Type Detector (magic-bytes sniff)
    - Batch File Information (table + CSV export)
  Reuses main.js helpers: humanSize, esc, sanitizeName, extChipClass,
  downloadBlob, downloadMany, toast, ToolError, fmtDate, etc.
  If helpers missing (standalone load order), falls back gracefully.
*/
'use strict';

function renderFileTools(body, api){
  const modal = body.closest('.modal');
  if(modal) modal.classList.add('modal-editor','modal-pe2');

  body.innerHTML = `
    <div class="pe2 wope">
      <input id="ftFileInput" type="file" multiple hidden>
      <div class="wope-ribbon" role="region" aria-label="Ribbon">
        <div class="wope-tabs" role="tablist" aria-label="Editor tabs">
          <button class="wope-tab active" data-tab="home" role="tab" aria-selected="true">Home</button>
          <button class="wope-tab" data-tab="analyze" role="tab">Analyze</button>
          <button class="wope-tab" data-tab="organize" role="tab">Organize</button>
          <button class="wope-tab" data-tab="export" role="tab">Export</button>
          <button class="wope-tab" data-tab="view" role="tab">View</button>
        </div>
        <div class="wope-panels">
          <!-- Home -->
          <div class="wope-panel active" data-panel="home" role="tabpanel">
            <div class="wope-group">
              <button class="wope-btn wope-btn-primary wope-btn-lg" id="ftAdd" type="button"><span class="wope-ic">＋</span><span class="wope-lbl">Add Files</span></button>
              <div class="wope-stack">
                <button class="wope-btn wope-btn-sm" id="ftInfo" type="button">ℹ Info</button>
                <button class="wope-btn wope-btn-sm" id="ftClear" type="button">✕ Clear</button>
              </div>
              <div class="wope-group-label">Files</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group">
              <button class="wope-btn wope-btn-lg" id="ftSelectAll" type="button"><span class="wope-ic">☑</span><span class="wope-lbl">Select All</span></button>
              <div class="wope-stack">
                <button class="wope-btn wope-btn-sm" id="ftDeselect" type="button">Clear</button>
                <button class="wope-btn wope-btn-sm" id="ftDuplicate" type="button">⧉ Duplicate</button>
              </div>
              <div class="wope-group-label">Selection</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group">
              <button class="wope-btn wope-btn-lg wope-btn-danger" id="ftRemove" type="button"><span class="wope-ic">🗑</span><span class="wope-lbl">Remove</span></button>
              <button class="wope-btn wope-btn-lg" id="ftRestore" type="button"><span class="wope-ic">↺</span><span class="wope-lbl">Restore</span></button>
              <div class="wope-group-label">Edit</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group">
              <div class="wope-stack">
                <button class="wope-btn wope-btn-sm" id="ftUndo" type="button" title="Undo">↩ Undo</button>
                <button class="wope-btn wope-btn-sm" id="ftRedo" type="button" title="Redo">↪ Redo</button>
              </div>
              <div class="wope-group-label">History</div>
            </div>
          </div>

          <!-- Analyze — now Hash tools only (info stays in main window) -->
          <div class="wope-panel" data-panel="analyze" role="tabpanel" hidden>
            <div class="wope-group">
              <button class="wope-btn wope-btn-primary wope-btn-lg" id="ftHash" type="button"><span class="wope-ic">#</span><span class="wope-lbl">Hash</span><span class="wope-hint">calculator</span></button>
              <button class="wope-btn wope-btn-lg" id="ftCompareHash" type="button"><span class="wope-ic">⇔</span><span class="wope-lbl">Compare</span><span class="wope-hint">hashes</span></button>
              <div class="wope-group-label">Hash</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group wope-group-info"><div class="wope-hint-box">SHA-256 / SHA-1 locally<br>Compare any two files</div><div class="wope-group-label">Privacy</div></div>
          </div>

          <!-- Organize -->
          <div class="wope-panel" data-panel="organize" role="tabpanel" hidden>
            <div class="wope-group">
              <button class="wope-btn wope-btn-primary wope-btn-lg" id="ftRename" type="button"><span class="wope-ic">✏️</span><span class="wope-lbl">Rename</span><span class="wope-hint">batch</span></button>
              <div class="wope-group-label">Naming</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group">
              <button class="wope-btn wope-btn-lg" id="ftEdit" type="button"><span class="wope-ic">📝</span><span class="wope-lbl">Edit Text</span><span class="wope-hint">txt/json/code</span></button>
              <div class="wope-group-label">Edit</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group">
              <button class="wope-btn wope-btn-lg" id="ftDup" type="button"><span class="wope-ic">👥</span><span class="wope-lbl">Duplicates</span><span class="wope-hint">SHA-256</span></button>
              <div class="wope-group-label">Find</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group">
              <button class="wope-btn wope-btn-lg" id="ftSortName" type="button"><span class="wope-ic">A↕</span><span class="wope-lbl">Sort</span><span class="wope-hint">Name</span></button>
              <button class="wope-btn wope-btn-lg" id="ftSortSize" type="button"><span class="wope-ic">↕</span><span class="wope-lbl">Sort</span><span class="wope-hint">Size</span></button>
              <div class="wope-group-label">Arrange</div>
            </div>
          </div>

          <!-- Export -->
          <div class="wope-panel" data-panel="export" role="tabpanel" hidden>
            <div class="wope-group">
              <button class="wope-btn wope-btn-primary wope-btn-lg" id="ftDownloadAll" type="button"><span class="wope-ic">💾</span><span class="wope-lbl">Download All</span><span class="wope-hint">kept</span></button>
              <button class="wope-btn wope-btn-lg" id="ftDownloadSel" type="button"><span class="wope-ic">⬇</span><span class="wope-lbl">Download</span><span class="wope-hint">selected</span></button>
              <div class="wope-group-label">Save</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group">
              <button class="wope-btn wope-btn-lg" id="ftExportCsv" type="button"><span class="wope-ic">📄</span><span class="wope-lbl">Export CSV</span><span class="wope-hint">batch list</span></button>
              <button class="wope-btn wope-btn-lg" id="ftExportRenamed" type="button"><span class="wope-ic">✏️</span><span class="wope-lbl">Renamed ZIP</span><span class="wope-hint">if renamed</span></button>
              <div class="wope-group-label">Export</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group wope-group-info"><div class="wope-hint-box">Renamed files download<br>with your new names</div><div class="wope-group-label">Tips</div></div>
          </div>

          <!-- View -->
          <div class="wope-panel" data-panel="view" role="tabpanel" hidden>
            <div class="wope-group">
              <div class="wope-hint-box">Filter & Go to are in<br>left Files pane</div>
              <div class="wope-group-label">Navigation</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group">
              <div class="wope-inline"><span class="pe2-count" id="ftCountView">0 files</span></div>
              <div class="wope-group-label">Status</div>
            </div>
            <div class="wope-sep"></div>
            <div class="wope-group wope-group-info"><div class="wope-hint-box">Drag cards to reorder<br>or use ↑/↓ buttons</div><div class="wope-group-label">Reorder</div></div>
          </div>
        </div>
      </div>

      <div class="pe2-work wope-work">
        <aside class="pe2-left wope-nav" aria-label="Files">
          <div class="pe2-left-head wope-nav-head">
            <div class="wope-nav-title"><span>Files</span><span class="pe2-left-meta" id="ftLeftMeta">—</span></div>
            <label class="wope-nav-filter" title="Filter files">
              <input id="ftFilter" type="search" placeholder="Filter… report pdf" aria-label="Filter files">
              <span aria-hidden="true">🔍</span>
            </label>
            <label class="wope-nav-jump" title="Jump to file">
              <input id="ftJump" type="number" min="1" inputmode="numeric" placeholder="#" aria-label="Jump to file">
              <span>Go</span>
            </label>
          </div>
          <div class="pe2-pages wope-nav-pages" id="ftPages" role="listbox" aria-multiselectable="true" aria-label="Files. Use Ctrl/Cmd or Shift to select multiple."></div>
        </aside>
        <main class="pe2-main wope-doc" id="ftMain"></main>
      </div>

      <div class="wope-statusbar" role="contentinfo" aria-label="Status">
        <div class="wope-status-left">
          <span class="wope-status-item" id="ftCount">0 files</span>
          <span class="wope-status-item" id="ftSelCount" hidden>0 selected</span>
          <span class="wope-status-item wope-status-kept" id="ftStatusKept">0 kept</span>
        </div>
        <div class="wope-status-center">
          <input id="ftFileName" type="text" placeholder="file-list.csv" aria-label="Output filename" title="Output filename">
        </div>
        <div class="wope-status-right">
          <span class="wope-status-item" id="ftTotalSize" title="Total size">—</span>
        </div>
      </div>
      <p class="tool-note wope-tip" style="margin:8px 0 0">💡 File Tools: <b>Home</b> add/select · <b>Analyze</b> size/batch/type · <b>Organize</b> rename/duplicates · <b>Export</b> download/CSV · Drag to reorder, <kbd>Ctrl</kbd> multi</p>
    </div>
  `;

  const root = $('.pe2', body);
  const fileInput = $('#ftFileInput', root);
  const pagesEl = $('#ftPages', root);
  const main = $('#ftMain', root);

  // ---- helpers fallback if main.js not yet loaded (standalone) ----
  const _esc = typeof esc === 'function' ? esc : (s)=> String(s).replace(/[&<>"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const _humanSize = typeof humanSize === 'function' ? humanSize : (b)=>{
    if(!isFinite(b)||b<0) b=0; if(b<1024) return b+' B';
    const u=['KB','MB','GB','TB']; let i=-1; do{ b/=1024; i++; }while(b>=1024&&i<u.length-1);
    return (b>=100?Math.round(b):b.toFixed(1))+' '+u[i];
  };
  const _sanitize = typeof sanitizeName === 'function' ? sanitizeName : (n)=> String(n).replace(/[\\/:*?"<>|\u0000-\u001f]/g,'-').slice(0,180)||'file';
  const _extOf = typeof extOf === 'function' ? extOf : (name)=>{ const m=/\.([a-z0-9]+)$/i.exec(name||''); return m?m[1].toLowerCase():''; };
  const _extChip = typeof extChipClass === 'function' ? extChipClass : (name,type)=>{
    const e=_extOf(name); if(e==='pdf') return 'ext-pdf';
    if(['jpg','jpeg','jfif'].includes(e)) return 'ext-img';
    if(e==='png') return 'ext-png'; if(e==='gif') return 'ext-gif'; if(e==='webp') return 'ext-webp';
    if(['txt','md','csv','log','json'].includes(e)) return 'ext-txt';
    if(['doc','docx','rtf','odt','ppt','pptx','xls','xlsx'].includes(e)) return 'ext-doc';
    if(['zip','rar','7z','gz'].includes(e)) return 'ext-zip'; return 'ext-any';
  };
  const _fmtDate = typeof fmtDate === 'function' ? fmtDate : (d)=>{ try{ return new Date(d).toLocaleString(); }catch{ return '—'; } };
  const _toast = typeof toast === 'function' ? toast : (m)=> console.log(m);
  const _downloadBlob = typeof downloadBlob === 'function' ? downloadBlob : (blob,name)=>{
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=_sanitize(name); document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),5000);
  };
  const _downloadMany = typeof downloadMany === 'function' ? downloadMany : async (items)=>{
    for(const it of items){ _downloadBlob(it.blob,it.name); await new Promise(r=>setTimeout(r,380)); }
  };
  const _statusBox = typeof statusBox === 'function' ? statusBox : (bodyEl)=>{
    const d=document.createElement('div'); d.className='tool-status'; d.setAttribute('aria-live','polite'); bodyEl.appendChild(d); return d;
  };
  const _loading = typeof loading === 'function' ? loading : (status,msg)=>{
    status.innerHTML=`<div class="loader-line"><span class="spinner"></span><span class="load-msg">${_esc(msg||'Processing…')}</span></div>`;
    return m=>{ const el=status.querySelector('.load-msg'); if(el) el.textContent=m; };
  };
  const _errorOut = typeof errorOut === 'function' ? errorOut : (status,msg,err)=>{
    status.innerHTML=`<div class="panel-err"><span>⚠️</span><div><b>Something went wrong</b><p>${_esc(msg)}</p></div></div>`;
  };
  const _successOut = typeof successOut === 'function' ? successOut : (status,{title='Done!',msg='OK',downloads=[],extraHtml=''} )=>{
    status.innerHTML=`<div class="success-box"><h3>${_esc(title)}</h3><p>${_esc(msg)}</p>${extraHtml}<div class="success-actions">${downloads.map((d,i)=>`<button class="btn ${i===0?'btn-primary':'btn-ghost'}" data-dl="${i}">⬇ ${_esc(d.label||'Download')}</button>`).join('')}</div></div>`;
    status.querySelectorAll('[data-dl]').forEach(b=> b.addEventListener('click',()=>{ const d=downloads[+b.dataset.dl]; _downloadBlob(d.blob,d.name); _toast('Downloading “'+d.name+'”','success'); }));
  };
  const _compare = typeof compareHTML === 'function' ? compareHTML : ()=> '';
  const _animateBars = typeof animateBars === 'function' ? animateBars : ()=>{};
  const _friendly = typeof friendly === 'function' ? friendly : (e)=> e && e.message ? e.message : "We couldn't process this file.";

  // ---- editable text detection (for Edit Text) ----
  const EDITABLE_EXTS = new Set([
    'txt','md','markdown','json','jsonc','json5','js','mjs','cjs','ts','tsx','jsx','vue','svelte',
    'java','c','cpp','cc','h','hpp','cs','py','pyw','rb','php','go','rs','swift','kt','kts','scala',
    'sh','bash','zsh','bat','cmd','ps1','psm1','sql','html','htm','xhtml','css','scss','sass','less',
    'xml','yaml','yml','toml','ini','cfg','conf','properties','env','log','csv','tsv','svg','r','rmd',
    'tex','rst','adoc','asciidoc','pl','pm','dart','ino','gradle','cmake','makefile','dockerfile'
  ]);
  const BINARY_EXTS = new Set(['zip','rar','7z','gz','bz2','xz','exe','dll','so','bin','iso','img','msi','apk','jar','class','o','obj','a','lib','pdf','jpg','jpeg','png','gif','webp','bmp','ico','mp3','mp4','mov','avi','mkv','wav','flac','ogg','webm','woff','woff2','ttf','otf','eot']);
  function isEditableFile(f){
    if(!f) return false;
    if(f.removed) return false;
    // quick binary ext block
    const ext = (f.ext || _extOf(f.name||'')).toLowerCase();
    if(BINARY_EXTS.has(ext)) return false;
    if(EDITABLE_EXTS.has(ext)) return true;
    // special filenames without ext but text-like
    const base = (f.name||'').toLowerCase();
    if(base==='dockerfile' || base==='makefile' || base.startsWith('.env') || base==='.gitignore') return true;
    // mime check
    const type = (f.type||'').toLowerCase();
    if(type.startsWith('text/')) return true;
    if(type==='application/json' || type==='application/javascript' || type==='application/xml' || type==='application/x-sh' || type==='application/x-yaml') return true;
    if(type==='' && ext==='') {
      // no ext, no mime — try to treat small files as text if mostly printable (fallback handled at edit time)
      return f.size < 2*1024*1024;
    }
    // fallback: if not known binary and size smallish, allow attempt — edit will validate
    if(!ext) return false;
    return false;
  }
  function isTextLikeFile(f){
    // legacy alias
    return isEditableFile(f);
  }

  // Ribbon tab switching
  (function setupRibbon(){
    const tabs = $$('.wope-tab', root);
    const panels = $$('.wope-panel', root);
    tabs.forEach(tab=>{
      tab.addEventListener('click', ()=>{
        tabs.forEach(t=>{ t.classList.remove('active'); t.setAttribute('aria-selected','false'); });
        panels.forEach(p=>{ p.classList.remove('active'); p.hidden=true; });
        tab.classList.add('active'); tab.setAttribute('aria-selected','true');
        const panel = root.querySelector(`.wope-panel[data-panel="${tab.dataset.tab}"]`);
        if(panel){ panel.classList.add('active'); panel.hidden=false; }
      });
    });
  })();

  // ----- state -----
  let files = []; // {uid, file, name, size, type, lastModified, ext, removed, selected, hiddenByFilter, __svName}
  let current = null;
  let lastSelectedIdx = -1;
  let dragIdx = null;
  let filterQuery = '';
  let outputName = 'file-list.csv';
  let history = [];
  let histIdx = -1;

  function uid(){ return Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4); }

  function getSelected(){
    const sel = files.filter(f=> f.selected && !f.hiddenByFilter);
    if(sel.length) return sel;
    if(current && !current.hiddenByFilter) return [current];
    return [];
  }
  function keptList(){ return files.filter(f=> !f.removed && !f.hiddenByFilter); }

  function snapshot(){
    return {
      files: files.map(f=> ({uid:f.uid, name:f.name, size:f.size, type:f.type, lastModified:f.lastModified, ext:f.ext, removed:f.removed, selected:f.selected, hiddenByFilter:f.hiddenByFilter, __svName:f.__svName})),
      order: files.map(f=> f.uid),
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
    const byUid = new Map(files.map(f=>[f.uid,f]));
    const newFiles=[];
    snap.order.forEach(uid=>{
      const f = byUid.get(uid);
      const s = snap.files.find(x=> x.uid===uid);
      if(f && s){
        f.removed=s.removed; f.selected=s.selected; f.hiddenByFilter=s.hiddenByFilter; f.__svName=s.__svName;
      }
      if(f) newFiles.push(f);
      else if(s){
        // file object lost after undo of add? recreate minimal
        newFiles.push({uid:s.uid, file:null, name:s.name, size:s.size, type:s.type, lastModified:s.lastModified, ext:s.ext, removed:s.removed, selected:s.selected, hiddenByFilter:s.hiddenByFilter, __svName:s.__svName, el:null});
      }
    });
    // keep any files not in snapshot? shouldn't happen
    files = newFiles;
    current = snap.currentUid ? files.find(f=> f.uid===snap.currentUid) || files[0] || null : files[0]||null;
    applyFilter(); renderFiles();
    if(current) renderMainFor(current); else renderMainEmpty();
    updateToolbar();
  }
  function undo(){ if(histIdx<=0) return; histIdx--; restoreSnapshot(history[histIdx]); }
  function redo(){ if(histIdx>=history.length-1) return; histIdx++; restoreSnapshot(history[histIdx]); }

  api.onClose(()=>{
    files.forEach(f=>{ if(f.file && f.file._url){ try{ URL.revokeObjectURL(f.file._url);}catch{} } });
  });

  const els = {
    add: $('#ftAdd', root),
    info: $('#ftInfo', root),
    clear: $('#ftClear', root),
    selectAll: $('#ftSelectAll', root),
    deselect: $('#ftDeselect', root),
    duplicate: $('#ftDuplicate', root),
    remove: $('#ftRemove', root),
    restore: $('#ftRestore', root),
    undo: $('#ftUndo', root),
    redo: $('#ftRedo', root),
    hash: $('#ftHash', root),
    compareHash: $('#ftCompareHash', root),
    rename: $('#ftRename', root),
    edit: $('#ftEdit', root),
    dup: $('#ftDup', root),
    sortName: $('#ftSortName', root),
    sortSize: $('#ftSortSize', root),
    downloadAll: $('#ftDownloadAll', root),
    downloadSel: $('#ftDownloadSel', root),
    exportCsv: $('#ftExportCsv', root),
    exportRenamed: $('#ftExportRenamed', root),
    filter: $('#ftFilter', root),
    jump: $('#ftJump', root),
    count: $('#ftCount', root),
    selCount: $('#ftSelCount', root),
    statusKept: $('#ftStatusKept', root),
    totalSize: $('#ftTotalSize', root),
    countView: $('#ftCountView', root),
    fileName: $('#ftFileName', root),
    leftMeta: $('#ftLeftMeta', root)
  };

  function updateToolbar(){
    const hasFiles = files.length>0;
    const visible = files.filter(f=> !f.hiddenByFilter);
    const kept = files.filter(f=> !f.removed).length;
    const sel = files.filter(f=> f.selected).length;
    const selActive = getSelected();
    const hasActiveSel = selActive.some(f=> !f.removed);
    const hasRemovedSel = selActive.some(f=> f.removed);
    const anyRemoved = files.some(f=> f.removed);
    if(els.remove) els.remove.disabled = !hasActiveSel;
    if(els.restore) els.restore.disabled = !hasRemovedSel;
    if(els.selectAll) els.selectAll.disabled = !visible.length;
    if(els.deselect) els.deselect.disabled = sel===0;
    if(els.duplicate) els.duplicate.disabled = !selActive.length;
    if(els.hash) els.hash.disabled = !hasFiles;
    if(els.compareHash) els.compareHash.disabled = files.length<2 && !hasFiles;
    if(els.rename) els.rename.disabled = !hasFiles;
    if(els.edit){
      const sel = getSelected();
      const hasEditable = hasFiles && (sel.some(f=> isEditableFile(f)) || files.some(f=> isEditableFile(f) && !f.removed));
      // enable if any editable kept file exists, or selected editable
      els.edit.disabled = !hasEditable;
      els.edit.title = hasEditable ? 'Edit text/code files' : 'No editable text files (txt, json, java, etc.) — zip/exe are not editable';
    }
    if(els.dup) els.dup.disabled = files.length<2;
    if(els.downloadAll) els.downloadAll.disabled = kept===0;
    if(els.downloadSel) els.downloadSel.disabled = !hasActiveSel;
    if(els.exportCsv) els.exportCsv.disabled = !hasFiles;
    if(els.exportRenamed) els.exportRenamed.disabled = !files.some(f=> f.__svName && f.__svName!==f.name);
    if(els.info) els.info.disabled = !hasFiles;
    if(els.clear) els.clear.disabled = !hasFiles;
    if(els.undo) els.undo.disabled = histIdx<=0;
    if(els.redo) els.redo.disabled = histIdx>=history.length-1;
    if(els.count) els.count.textContent = `${files.length} file${files.length===1?'':'s'}${filterQuery? ` · ${visible.length} shown`:''}`;
    if(els.selCount){ if(sel>0){ els.selCount.hidden=false; els.selCount.textContent=`${sel} selected`; } else els.selCount.hidden=true; }
    if(els.statusKept) els.statusKept.textContent = `${kept} kept · ${files.length-kept} removed`;
    if(els.totalSize) els.totalSize.textContent = _humanSize(files.reduce((a,f)=>a+f.size,0));
    if(els.countView) els.countView.textContent = `${files.length} files`;
    if(els.leftMeta) els.leftMeta.textContent = `${kept} kept · ${files.length-kept} removed`;
    if(els.jump) els.jump.max = String(files.length);
  }

  function applyFilter(){
    const q = filterQuery.trim().toLowerCase();
    if(!q){ files.forEach(f=> f.hiddenByFilter=false); return; }
    const terms = q.split(/\s+/).filter(Boolean);
    files.forEach(f=>{
      const hay = `${f.name} ${f.type} ${_extOf(f.name)} ${f.removed?'removed':''} ${_humanSize(f.size)}`.toLowerCase();
      f.hiddenByFilter = !terms.every(t=> hay.includes(t));
    });
    files.forEach(f=>{ if(f.hiddenByFilter) f.selected=false; });
  }
  function setFilter(v){ filterQuery=v; applyFilter(); renderFiles(); updateToolbar(); }

  function toolPane(title){
    main.innerHTML = `
      <div class="pe2-tool">
        <div class="pe2-tool-head">
          <button class="btn btn-ghost btn-sm" id="ftBack" type="button">← Back to preview</button>
          <h3>${_esc(title)}</h3>
        </div>
        <div class="pe2-tool-body">
          <div class="tool-status" aria-live="polite"></div>
        </div>
      </div>
    `;
    main.querySelector('#ftBack').onclick = ()=>{
      if(current) renderMainFor(current); else renderMainEmpty();
    };
    return main.querySelector('.tool-status');
  }

  function renderMainEmpty(){
    const hasFiles = files.length>0;
    if(!hasFiles){
      main.innerHTML = `
        <div class="empty-state pe2-empty">
          <div class="es-ic">📁</div>
          <b>File Tools</b>
          <p>Add files with <b>Add Files</b> or drop them anywhere here.<br>
          <span style="color:var(--muted)">Rename · Edit Text · Hash Calculator · Duplicate Finder · Info — all 100% offline</span></p>
          <div style="margin-top:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" id="ftEmptyAdd">＋ Add Files</button>
            <button class="btn btn-ghost btn-sm" id="ftEmptyInfo">Why offline?</button>
          </div>
          <p class="tool-note" style="justify-content:center">🔒 Everything runs locally — no uploads.</p>
        </div>
      `;
      const b = main.querySelector('#ftEmptyAdd'); if(b) b.onclick=()=> fileInput.click();
      const i = main.querySelector('#ftEmptyInfo'); if(i) i.onclick=()=> showInfo();
    } else {
      main.innerHTML = `
        <div class="empty-state pe2-empty">
          <div class="es-ic">👈</div>
          <b>Select a file</b>
          <p>Choose a file on the left to see details. Use Ctrl/Cmd or Shift for multi-select.</p>
          <div style="margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" id="ftGoHash">#️⃣ Hash</button>
            <button class="btn btn-ghost btn-sm" id="ftGoCompare">⇔ Compare</button>
            <button class="btn btn-ghost btn-sm" id="ftGoEdit">📝 Edit</button>
          </div>
        </div>
      `;
      const a = main.querySelector('#ftGoHash'); if(a) a.onclick=()=> showHashCalculator();
      const t = main.querySelector('#ftGoCompare'); if(t) t.onclick=()=> showCompareHash();
      const b2 = main.querySelector('#ftGoEdit'); if(b2) b2.onclick=()=>{
        const sel=getSelected().filter(f=> isEditableFile(f));
        if(sel.length) showTextEditor(sel);
        else {
          const any=files.find(f=> isEditableFile(f) && !f.removed);
          if(any) showTextEditor([any]); else _toast('No editable text file selected — try a .txt, .json or .java file (zip/exe not editable)','info');
        }
      };
    }
    updateToolbar();
  }

  function renderMainFor(f){
    if(!f){ renderMainEmpty(); return; }
    const selCount = files.filter(x=> x.selected).length;
    const isMulti = selCount>1;
    const selList = getSelected();
    const nameDisplay = _esc(f.__svName && f.__svName!==f.name ? `${f.__svName} (was: ${f.name})` : f.name);
    main.innerHTML = `
      <div class="pe2-view">
        <div class="pe2-view-bar">
          <span>
            <b style="color:var(--text)" title="${_esc(f.name)}">${_esc(f.name.slice(0,42))}${f.name.length>42?'…':''}</b>
            <span style="color:var(--faint)"> · ${_humanSize(f.size)} · ${_extOf(f.name).toUpperCase()||'FILE'}</span>
            ${f.removed ? ' · <span style="color:#fda4af">removed</span>' : ''}
            ${isMulti ? ` · <span style="color:#8fb0ff">${selCount} selected</span>` : ''}
          </span>
          <span style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-ghost btn-xs" id="ftPrev" type="button">↑ Prev</button>
            <button class="btn btn-ghost btn-xs" id="ftNext" type="button">Next ↓</button>
          </span>
        </div>
        <div class="info-list" style="margin-top:14px">
          <div class="info-item"><span>📄 Name</span><b>${_esc(f.name)}</b></div>
          ${f.__svName && f.__svName!==f.name ? `<div class="info-item"><span>✏️ Renamed to</span><b>${_esc(f.__svName)}</b></div>` : ''}
          <div class="info-item"><span>🏷 Type</span><b>${_esc(f.type||'—')} ${f.ext? '('+_esc(f.ext)+')':''}</b></div>
          <div class="info-item"><span>⚖️ Size</span><b>${_humanSize(f.size)} (${f.size.toLocaleString()} bytes)</b></div>
          <div class="info-item"><span>🕒 Modified</span><b>${_esc(_fmtDate(f.lastModified))}</b></div>
          <div class="info-item"><span>🆔 Status</span><b>${f.removed? 'Removed (hidden from exports)' : 'Kept'}</b></div>
        </div>
        <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" id="ftRenameOne">✏️ Rename</button>
          <button class="btn btn-ghost btn-sm" id="ftEditOne" ${isEditableFile(f)?'':'disabled title="Not a text file — .txt, .json, .java etc. are editable, zip/exe are not"'}>📝 Edit</button>
          <button class="btn btn-ghost btn-sm" id="ftHashOne">#️⃣ Hash</button>
          <button class="btn btn-primary btn-sm" id="ftDlOne">⬇ Download</button>
        </div>
        ${!isEditableFile(f) ? `<p class="tool-note" style="margin-top:8px">📝 Editing is only for text-like files (txt, json, js, java, py, html, css, csv, …). Binary files like zip, exe, pdf, jpg are not editable.</p>` : ''}
        ${isMulti ? `<div class="pe2-multi-bar" style="margin-top:14px">Selected ${selList.map(p=> _esc(p.name)).join(', ')} — bulk actions use selection.</div>` : ''}
        <div class="tool-status" id="ftInlineStatus" style="margin-top:16px"></div>
      </div>
    `;
    const prev = main.querySelector('#ftPrev'); if(prev) prev.onclick=()=> navigatePreview(-1);
    const next = main.querySelector('#ftNext'); if(next) next.onclick=()=> navigatePreview(1);
    const rn = main.querySelector('#ftRenameOne'); if(rn) rn.onclick=()=> showRename(true);
    const ed = main.querySelector('#ftEditOne'); if(ed) ed.onclick=()=>{
      if(!isEditableFile(f)){ _toast('This file is not a text file — .txt, .json, .java, .py etc. are editable; zip/exe/pdf/images are not.','info'); return; }
      showTextEditor([f]);
    };
    const hh = main.querySelector('#ftHashOne'); if(hh) hh.onclick=()=> showHashFor([f]);
    const dl = main.querySelector('#ftDlOne'); if(dl) dl.onclick=()=>{
      if(f.file) _downloadBlob(f.file, f.__svName||f.name);
      else _toast('Original file object not retained after undo — re-add the file.','info');
    };
    updateToolbar();
  }

  function navigatePreview(dir){
    if(!current) return;
    const visible = files.filter(f=> !f.hiddenByFilter);
    const idx = visible.indexOf(current);
    const nxt = visible[idx+dir];
    if(nxt){ current=nxt; renderFiles(); renderMainFor(current); }
  }

  function createFileEl(f,i){
    if(f.hiddenByFilter){ const ph=document.createElement('div'); ph.style.display='none'; return ph; }
    const item=document.createElement('div');
    item.className='pe2-page'+(f===current?' active':'')+(f.selected?' selected':'')+(f.removed?' removed':'');
    item.draggable=true; item.tabIndex=0;
    item.setAttribute('role','option');
    item.setAttribute('aria-selected', String(!!f.selected));
    item.setAttribute('aria-label', `${f.name}${f.removed?' removed':''}${f.selected?' selected':''}`);

    const ext = _extOf(f.name).toUpperCase() || (f.type? f.type.split('/')[1]||'FILE' : 'FILE');
    const chipCls = _extChip(f.name, f.type);
    const renamed = f.__svName && f.__svName!==f.name;

    item.innerHTML = `
      <div class="pe2-thumb-wrap" style="position:relative;background:rgba(255,255,255,.03);display:flex;align-items:center;justify-content:center;aspect-ratio:1.4;overflow:hidden;border-radius:12px;border:1px solid var(--stroke);">
        <span class="ext ${chipCls}" style="font-size:1.05rem;min-width:64px;height:64px;border-radius:14px">${_esc(ext.slice(0,4))}</span>
        <span class="pe2-check${f.selected?' on':''}" aria-hidden="true">${f.selected?'✓':''}</span>
        ${f.removed? '<span class="pe2-rot-badge" style="background:rgba(251,113,133,.9)">REMOVED</span>':''}
        ${renamed? '<span class="pe2-rot-badge" style="left:8px;right:auto;background:rgba(99,102,241,.9)">RENAMED</span>':''}
      </div>
      <div class="pe2-page-meta">
        <span title="${_esc(f.name)}" style="overflow:hidden;textOverflow:ellipsis;whiteSpace:nowrap;max-width:118px;font-weight:600">${_esc(f.name)}</span>
        <span class="pe2-page-acts">
          <button type="button" data-mv="-1" title="Move up">↑</button>
          <button type="button" data-mv="1" title="Move down">↓</button>
          <button type="button" data-edit title="Rename">✏️</button>
          <button type="button" data-rm title="${f.removed?'Restore':'Remove'}">${f.removed?'↺':'✕'}</button>
        </span>
      </div>
      <div style="padding:0 8px 6px;font-size:.72rem;color:var(--faint);font-family:var(--font-m);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_humanSize(f.size)} · ${_esc(f.type||'unknown')}</div>
    `;

    const selectWithModifiers=(e)=>{
      const isCtrl=e.ctrlKey||e.metaKey;
      const isShift=e.shiftKey;
      if(isShift && lastSelectedIdx!==-1){
        const start=Math.min(lastSelectedIdx,i), end=Math.max(lastSelectedIdx,i);
        for(let k=start;k<=end;k++){ const pk=files[k]; if(!pk.hiddenByFilter) pk.selected=true; }
      } else if(isCtrl){
        f.selected=!f.selected; lastSelectedIdx=i;
      } else {
        const wasSelected=f.selected;
        const selCnt=files.filter(x=> x.selected).length;
        if(wasSelected && selCnt>1){} else { files.forEach(x=> x.selected=false); f.selected=true; }
        lastSelectedIdx=i;
      }
      current=f;
      refreshSelectionUI();
      renderMainFor(f);
    };
    item.addEventListener('click', selectWithModifiers);
    item.addEventListener('keydown', e=>{
      if(e.key==='Enter'||e.key===' '){ e.preventDefault(); selectWithModifiers(e); }
      else if(e.key==='ArrowUp'||e.key==='ArrowDown'){
        e.preventDefault();
        const dir=e.key==='ArrowUp'?-1:1;
        let nxt=i+dir;
        while(nxt>=0 && nxt<files.length && files[nxt].hiddenByFilter) nxt+=dir;
        if(nxt>=0 && nxt<files.length){
          files[nxt].selected=true;
          if(!e.shiftKey) files.forEach((x,k)=>{ if(k!==nxt) x.selected=false; });
          current=files[nxt]; lastSelectedIdx=nxt;
          refreshSelectionUI(); renderMainFor(current);
          requestAnimationFrame(()=>{ if(files[nxt].el) files[nxt].el.focus(); });
        }
      } else if(e.key==='Delete' || e.key==='Backspace'){
        e.preventDefault();
        const sel=getSelected(); if(sel.length){ pushHistory(); sel.forEach(s=> s.removed=true); pushHistory(); renderFiles(); renderMainFor(current); }
      }
    });

    const mvBtns=item.querySelectorAll('[data-mv]');
    mvBtns.forEach(b=>{
      b.addEventListener('click', e=>{
        e.stopPropagation();
        const d=+b.dataset.mv; const j=i+d; if(j<0||j>=files.length) return;
        pushHistory();
        const mv=files[i];
        const selIdx=files.map((pg,idx)=> pg.selected?idx:-1).filter(idx=> idx!==-1).sort((a,b)=>a-b);
        if(mv.selected && selIdx.length>1){
          if(d===-1){ if(selIdx[0]===0) return; const block=selIdx.map(idx=> files[idx]); for(let k=selIdx.length-1;k>=0;k--) files.splice(selIdx[k],1); files.splice(selIdx[0]-1,0,...block); }
          else { if(selIdx[selIdx.length-1]===files.length-1) return; const block=selIdx.map(idx=> files[idx]); for(let k=selIdx.length-1;k>=0;k--) files.splice(selIdx[k],1); files.splice(selIdx[0]+1,0,...block); }
        } else { [files[i],files[j]]=[files[j],files[i]]; }
        pushHistory(); renderFiles();
      });
    });
    const editBtn=item.querySelector('[data-edit]');
    if(editBtn) editBtn.addEventListener('click', e=>{
      e.stopPropagation();
      // inline quick rename prompt for this file
      const inp = prompt(`Rename "${f.name}" to:`, f.__svName||f.name);
      if(inp===null) return;
      const v=inp.trim(); if(!v) return;
      pushHistory();
      f.__svName=_sanitize(v);
      pushHistory();
      renderFiles(); renderMainFor(f);
      _toast(`Renamed to “${f.__svName}”`,'success');
    });
    const rmBtn=item.querySelector('[data-rm]');
    if(rmBtn) rmBtn.addEventListener('click', e=>{
      e.stopPropagation();
      const sel=f.selected? getSelected():[f];
      const willRemove=sel.some(s=> !s.removed);
      pushHistory();
      sel.forEach(s=> s.removed=willRemove);
      pushHistory();
      refreshSelectionUI(); if(sel.includes(current)) renderMainFor(current); else updateToolbar();
      renderFiles();
    });
    const chk=item.querySelector('.pe2-check');
    if(chk) chk.addEventListener('click', e=>{ e.stopPropagation(); f.selected=!f.selected; lastSelectedIdx=i; refreshSelectionUI(); });

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
      const mv=files[from];
      const isBlock=mv.selected && files.filter(p=>p.selected).length>1;
      if(isBlock){
        const selIdx=files.map((pg,idx)=> pg.selected?idx:-1).filter(idx=> idx!==-1).sort((a,b)=>a-b);
        const block=selIdx.map(idx=> files[idx]);
        for(let k=selIdx.length-1;k>=0;k--) files.splice(selIdx[k],1);
        const before=selIdx.filter(idx=> idx<to).length;
        let target=to-before; if(from<to) target=Math.max(0,target);
        files.splice(target,0,...block);
      } else { const [moved]=files.splice(from,1); files.splice(to,0,moved); }
      dragIdx=null; pushHistory(); renderFiles();
    });
    return item;
  }

  function renderFiles(){
    const activeUid=document.activeElement && document.activeElement.closest('.pe2-page') ? files.find(f=> f.el===document.activeElement.closest('.pe2-page'))?.uid : null;
    const scrollTop=pagesEl.scrollTop;
    const frag=document.createDocumentFragment();
    pagesEl.innerHTML='';
    files.forEach((f,i)=>{
      f.el=createFileEl(f,i);
      if(!f.hiddenByFilter) frag.appendChild(f.el);
    });
    pagesEl.appendChild(frag);
    pagesEl.scrollTop=scrollTop;
    if(activeUid){
      const pg=files.find(f=> f.uid===activeUid);
      if(pg && pg.el) pg.el.focus({preventScroll:true});
    }
    updateToolbar();
  }
  function refreshSelectionUI(){
    files.forEach(f=>{
      if(!f.el || f.hiddenByFilter) return;
      f.el.classList.toggle('selected', !!f.selected);
      f.el.classList.toggle('active', f===current);
      f.el.classList.toggle('removed', !!f.removed);
      f.el.setAttribute('aria-selected', String(!!f.selected));
      const chk=f.el.querySelector('.pe2-check');
      if(chk){ chk.classList.toggle('on', !!f.selected); chk.textContent=f.selected?'✓':''; }
    });
    updateToolbar();
  }

  async function addFiles(fileList){
    const incoming=[...fileList];
    if(!incoming.length) return;
    const MAX_FILE=250*1024*1024;
    const filtered=[];
    let oversize=0, empty=0;
    for(const f of incoming){
      if(f.size>MAX_FILE){ oversize++; continue; }
      filtered.push(f);
      if(filtered.length>=300){ _toast('Stopped at 300 files to keep things smooth.','info'); break; }
    }
    if(oversize) _toast(`${oversize} file${oversize>1?'s':''} exceed 250 MB and were skipped.`,'error');
    if(!filtered.length){ if(oversize) _toast('No valid files to add.','info'); return; }
    // total size guard (>400MB combined)
    const curTotal=files.reduce((s,x)=> s+x.size,0);
    const incTotal=filtered.reduce((s,x)=> s+x.size,0);
    let toAdd=filtered;
    if(curTotal+incTotal>400*1024*1024){
      let budget=400*1024*1024 - curTotal;
      const keep=[];
      for(const f of filtered){
        if(f.size<=budget){ keep.push(f); budget-=f.size; }
        else _toast(`Skipped “${f.name}” — combined size would exceed 400 MB limit.`,'error');
      }
      toAdd=keep;
      if(!keep.length){ _toast('Cannot add more — workspace near 400 MB limit. Remove some files or clear.','error'); return; }
    }
    const startIdx=files.length;
    toAdd.forEach(f=>{
      const uidVal=uid();
      files.push({
        uid: uidVal,
        file: f,
        name: f.name,
        size: f.size,
        type: f.type||'',
        lastModified: f.lastModified,
        ext: _extOf(f.name),
        removed:false,
        selected:false,
        hiddenByFilter:false,
        __svName: f.name,
        el:null
      });
    });
    // after add, select last added
    applyFilter();
    if(!current && files.length){ current=files.find(x=> !x.hiddenByFilter) || files[0]; files.forEach(x=> x.selected=false); if(current) current.selected=true; lastSelectedIdx=files.indexOf(current); }
    pushHistory();
    renderFiles();
    if(current) renderMainFor(current); else renderMainEmpty();
    _toast(`Added ${toAdd.length} file${toAdd.length===1?'':'s'}`,'success',2200);
  }

  function clearWorkspace(){
    if(files.length && !confirm(`Clear ${files.length} file${files.length===1?'':'s'}? This cannot be undone.`)) return;
    files=[]; current=null; lastSelectedIdx=-1; dragIdx=null; history=[]; histIdx=-1; pushHistory();
    renderFiles(); renderMainEmpty(); _toast('Workspace cleared','info');
  }

  function duplicateSelected(){
    const sel=getSelected(); if(!sel.length){ _toast('Select files to duplicate.','info'); return; }
    if(files.length+sel.length>300){ _toast('Too many files to duplicate.','error'); return; }
    pushHistory();
    const lastIdx=Math.max(...sel.map(p=> files.indexOf(p)));
    const clones=sel.map(p=> ({
      uid: uid(),
      file: p.file,
      name: p.name.replace(/(\.[^.]+)?$/, '-copy$&'),
      size: p.size,
      type: p.type,
      lastModified: Date.now(),
      ext: p.ext,
      removed:false, selected:false, hiddenByFilter:false,
      __svName: (p.__svName||p.name).replace(/(\.[^.]+)?$/, '-copy$&'),
      el:null
    }));
    files.splice(lastIdx+1,0,...clones);
    files.forEach(p=> p.selected=false);
    clones.forEach(c=> c.selected=true);
    current=clones[0];
    pushHistory();
    renderFiles(); renderMainFor(current);
    _toast(`Duplicated ${clones.length} file${clones.length===1?'':'s'}`,'success');
  }

  // ---- Tool panes ----

  function showSize(){
    const kept=keptList();
    if(!kept.length){ _toast('No kept files — add files or restore some.','info'); return; }
    const status=toolPane('Size Analyzer');
    const sorted=[...kept].sort((a,b)=> b.size-a.size);
    const max=Math.max(...sorted.map(f=> f.size),1);
    const total=kept.reduce((a,f)=> a+f.size,0);
    // _animate not needed yet
    status.innerHTML = `
      <div class="stat-grid" style="max-width:520px">
        <div class="stat-tile"><b>${kept.length}</b><span>Files (kept)</span></div>
        <div class="stat-tile"><b>${_humanSize(total)}</b><span>Total size</span></div>
        <div class="stat-tile"><b>${_humanSize(sorted[0].size)}</b><span>Largest</span></div>
      </div>
      <div style="margin-top:18px">
        ${sorted.map(f=> `
          <div class="sz-row">
            <div class="sz-top"><span class="sz-name" title="${_esc(f.name)}">${_esc(f.name)}</span><b>${_humanSize(f.size)}</b></div>
            <div class="bar new"><i data-w="${Math.max(2, f.size/max*100).toFixed(1)}"></i></div>
          </div>`).join('')}
      </div>
      <p class="tool-note">Largest: <b style="color:var(--text)">${_esc(sorted[0].name)}</b> (${_humanSize(sorted[0].size)}). Sorted largest → smallest.</p>
      <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" id="ftSizeSort">↕ Sort by size</button>
        <button class="btn btn-ghost btn-sm" id="ftSizeCsv">⬇ Export CSV</button>
      </div>
    `;
    requestAnimationFrame(()=> requestAnimationFrame(()=> status.querySelectorAll('.bar i').forEach(i=> i.style.width=i.dataset.w+'%')));
    const sBtn=status.querySelector('#ftSizeSort');
    if(sBtn) sBtn.onclick=()=>{
      pushHistory(); files.sort((a,b)=> b.size-a.size); pushHistory(); renderFiles(); showSize();
    };
    const csvBtn=status.querySelector('#ftSizeCsv');
    if(csvBtn) csvBtn.onclick=()=> exportCsvFor(sorted, 'sizes');
  }

  function showBatch(){
    if(!files.length){ _toast('Add files first.','info'); return; }
    const status=toolPane('Batch Information');
    const total=files.reduce((a,f)=> a+f.size,0);
    status.innerHTML = `
      <div class="stat-grid" style="max-width:460px">
        <div class="stat-tile"><b>${files.length}</b><span>Files</span></div>
        <div class="stat-tile"><b>${_humanSize(total)}</b><span>Total</span></div>
        <div class="stat-tile"><b>${files.filter(f=> !f.removed).length}</b><span>Kept</span></div>
      </div>
      <div style="overflow-x:auto;margin-top:14px">
        <table class="info-table"><thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Modified</th><th>Status</th></tr></thead>
          <tbody>${files.map(f=> `<tr><td title="${_esc(f.name)}">${_esc(f.name)}</td><td>${_esc(f.type||'—')}</td><td>${_humanSize(f.size)}</td><td>${_esc(_fmtDate(f.lastModified))}</td><td>${f.removed?'<span class="badge dim">removed</span>':'<span class="badge ok">kept</span>'}</td></tr>`).join('')}</tbody>
        </table>
      </div>
      <div class="tool-actions" style="margin-top:14px">
        <button class="btn btn-primary btn-sm" id="ftBatchCsv">⬇ Export CSV</button>
        <button class="btn btn-ghost btn-sm" id="ftBatchCopy">📋 Copy summary</button>
      </div>
      <p class="tool-note">Export includes all files (kept + removed). Use Remove to exclude from exports if needed.</p>
    `;
    const a=status.querySelector('#ftBatchCsv'); if(a) a.onclick=()=> exportCsvFor(files,'file-list');
    const b=status.querySelector('#ftBatchCopy'); if(b) b.onclick=async ()=>{
      const txt=files.map(f=> `${f.name}\t${f.type||''}\t${_humanSize(f.size)}\t${_fmtDate(f.lastModified)}`).join('\n');
      try{ await navigator.clipboard.writeText(txt); _toast('Copied to clipboard','success'); }catch{ _toast('Copy failed','error'); }
    };
  }

  function exportCsvFor(list, base){
    if(!list.length) return;
    const cell=(s)=> '"'+String(s).replace(/"/g,'""')+'"';
    const csv=['Name,Type,Size (bytes),Size,Last Modified,Status,Real Name',
      ...list.map(f=> [cell(f.name), cell(f.type||''), f.size, cell(_humanSize(f.size)), cell(_fmtDate(f.lastModified)), f.removed?'removed':'kept', cell(f.__svName||f.name)].join(','))
    ].join('\r\n');
    const name=(els.fileName.value.trim()? _sanitize(els.fileName.value.trim()) : `${base}.csv`);
    const safe=name.toLowerCase().endsWith('.csv')? name : name+'.csv';
    _downloadBlob(new Blob([csv],{type:'text/csv'}), safe);
    _toast(`Downloading “${safe}”`,'success');
  }

  // magic bytes sniff replica (from main.js)
  function localSniffBytes(b){
    if(typeof sniffBytes==='function') return sniffBytes(b);
    const h=[...b.slice(0,16)].map(x=> x.toString(16).padStart(2,'0')).join('');
    const ascii=[...b].map(x=> (x>=32&&x<=126)? String.fromCharCode(x):'').join('');
    if(h.startsWith('25504446')) return {label:'PDF document', ext:['pdf']};
    if(h.startsWith('ffd8ff')) return {label:'JPEG image', ext:['jpg','jpeg']};
    if(h.startsWith('89504e47')) return {label:'PNG image', ext:['png']};
    if(h.startsWith('47494638')) return {label:'GIF image', ext:['gif']};
    if(h.startsWith('52494646') && ascii.includes('WEBP')) return {label:'WebP image', ext:['webp']};
    if(h.startsWith('504b0304')) return {label:'ZIP / Office (OOXML) archive', ext:['zip','docx','xlsx','pptx']};
    if(h.startsWith('1f8b')) return {label:'GZIP archive', ext:['gz']};
    if(h.startsWith('494433') || (b[0]===0xff && (b[1] & 0xe6)===0xe2)) return {label:'MP3 audio', ext:['mp3']};
    if(ascii.slice(4,8)==='ftyp') return {label:'MP4 / QuickTime media', ext:['mp4','mov']};
    const sample=[...b.slice(0,512)];
    const printable=sample.filter(x=> x===9||x===10||x===13||(x>=32&&x<127)||x>=160).length;
    if(sample.length && printable/sample.length>.95) return {label:'Plain text (likely)', ext:['txt','md','csv','json']};
    return {label:'Unknown binary data', ext:[]};
  }

  async function showType(){
    if(!files.length){ _toast('Add files first.','info'); return; }
    await showTypeFor(files);
  }
  async function showTypeFor(list){
    const targets = list.filter(f=> !f.removed);
    if(!targets.length){ _toast('No kept files in selection.','info'); return; }
    const status=toolPane(targets===files? 'File Type Detector' : `Type Detect — ${targets.length} file${targets.length===1?'':'s'}`);
    const setMsg=_loading(status,'Sniffing file signatures… (magic bytes)');
    try{
      const rows=[];
      for(let i=0;i<targets.length;i++){
        const f=targets[i];
        setMsg(`Inspecting ${i+1}/${targets.length} — ${_esc(f.name)}`);
        let headArray;
        if(f.file){
          headArray=new Uint8Array(await f.file.slice(0,512).arrayBuffer());
        } else {
          headArray=new Uint8Array(0);
        }
        const sniff=localSniffBytes(headArray);
        const e=_extOf(f.name);
        let badge;
        if(!sniff.ext.length) badge=`<span class="badge dim">❓ UNKNOWN</span>`;
        else if(sniff.ext.includes(e)) badge=`<span class="badge ok">✔ MATCHES .${_esc(e)}</span>`;
        else badge=`<span class="badge warn">⚠ EXT SAYS .${_esc(e||'?')}</span>`;
        rows.push(`<tr><td title="${_esc(f.name)}">${_esc(f.name)}</td><td>${_esc(sniff.label)}</td><td>${_humanSize(f.size)}</td><td>${badge}</td><td><small style="color:var(--faint)">${headArray.slice(0,4).length? [...headArray.slice(0,4)].map(b=> b.toString(16).padStart(2,'0')).join(' '):'—'}</small></td></tr>`);
        await new Promise(r=> setTimeout(r,0));
      }
      status.innerHTML = `
        <div style="overflow-x:auto">
          <table class="info-table"><thead><tr><th>File</th><th>Detected</th><th>Size</th><th>Check</th><th>Header</th></tr></thead>
            <tbody>${rows.join('')}</tbody></table>
        </div>
        <p class="tool-note">Detection reads only the first 512 bytes (magic bytes) locally — nothing is uploaded.</p>
        <div class="tool-actions"><button class="btn btn-ghost btn-sm" id="ftTypeCsv">⬇ Export CSV</button></div>
      `;
      const b=status.querySelector('#ftTypeCsv');
      if(b) b.onclick=()=>{
        const csvTargets=targets;
        const cell=(s)=> '"'+String(s).replace(/"/g,'""')+'"';
        // need to recompute sniff labels for export — simplified save rows already have info
        let csvRows=[`File,Detected,Size,Size Human,Status`];
        // quick export using displayed data parsing not ideal; redo sniff synchronously cheap
        (async()=>{
          for(let i=0;i<csvTargets.length;i++){
            const f=csvTargets[i];
            const head=f.file? new Uint8Array(await f.file.slice(0,512).arrayBuffer()) : new Uint8Array(0);
            const s=localSniffBytes(head);
            csvRows.push([cell(f.name), cell(s.label), f.size, cell(_humanSize(f.size)), cell(s.ext.join('|')||'unknown')].join(','));
          }
          _downloadBlob(new Blob([csvRows.join('\r\n')],{type:'text/csv'}), _sanitize((els.fileName.value.trim()||'type-detection.csv')).replace(/\.csv$/i,'')+'.csv');
        })();
      };
    }catch(e){ _errorOut(status,_friendly(e),e); }
  }

  async function localHashFile(fileObj){
    if(typeof hashFile==='function' && fileObj.file) return await hashFile(fileObj.file);
    // fallback simple: use size+name as pseudo? But use crypto if available
    if(fileObj.file && window.crypto && crypto.subtle){
      const buf=await fileObj.file.arrayBuffer();
      const d=await crypto.subtle.digest('SHA-256',buf);
      return [...new Uint8Array(d)].map(b=> b.toString(16).padStart(2,'0')).join('')+':'+fileObj.size;
    }
    return fileObj.size+':'+fileObj.name;
  }

  // ---- hash helpers ----
  async function computeHash(file, algo){
    if(!file) throw new Error('No file');
    const buf = await file.arrayBuffer();
    if(!window.crypto || !crypto.subtle) throw new Error('Crypto not available in this browser');
    const al = (algo||'SHA-256').toUpperCase();
    const allowed = ['SHA-256','SHA-1','SHA-384','SHA-512'];
    const useAlgo = allowed.includes(al) ? al : 'SHA-256';
    const digest = await crypto.subtle.digest(useAlgo, buf);
    const hex = [...new Uint8Array(digest)].map(b=> b.toString(16).padStart(2,'0')).join('');
    return {algo:useAlgo, hex, size:file.size, name:file.name};
  }
  function showHashFor(list){
    const targets = Array.isArray(list) ? list.filter(f=> !f.removed && f.file) : [list].filter(f=> f && !f.removed && f.file);
    if(!targets.length){ _toast('No file with data to hash — re-add file if needed.','info'); return; }
    showHashCalculator(targets);
  }
  async function showHashCalculator(preselected){
    const targets = preselected && preselected.length ? preselected.filter(f=> !f.removed && f.file) : keptList().filter(f=> f.file);
    if(!targets.length){ _toast('Add files first — then hash.','info'); return; }
    const status = toolPane(targets.length===1 ? `Hash — ${_esc(targets[0].name)}` : `Hash Calculator — ${targets.length} file${targets.length===1?'':'s'}`);
    status.innerHTML = `
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
        <label class="field" style="min-width:180px"><span>Algorithm</span>
          <select id="ftHashAlgo"><option value="SHA-256" selected>SHA-256 (recommended)</option><option value="SHA-1">SHA-1</option><option value="SHA-384">SHA-384</option><option value="SHA-512">SHA-512</option></select>
        </label>
        <button class="btn btn-primary btn-sm" id="ftHashGo">#️⃣ Compute hashes</button>
        <button class="btn btn-ghost btn-sm" id="ftHashCopyAll">📋 Copy all</button>
      </div>
      <div id="ftHashResults"><p class="tool-note">Click “Compute hashes” — all hashing runs 100% locally in your browser (no upload). First compute is instant for small files.</p></div>
      <p class="tool-note">Tip: Use “Compare hashes” in Analyze to compare two files, or paste hashes there.</p>
    `;
    const algoSel = status.querySelector('#ftHashAlgo');
    const results = status.querySelector('#ftHashResults');
    const go = status.querySelector('#ftHashGo');
    const copyAll = status.querySelector('#ftHashCopyAll');
    let lastHashes = [];

    async function run(){
      const algo = algoSel.value;
      results.innerHTML = `<div class="loader-line"><span class="spinner"></span><span class="load-msg">Hashing ${targets.length} file${targets.length===1?'':'s'} with ${algo}…</span></div>`;
      lastHashes = [];
      try{
        for(let i=0;i<targets.length;i++){
          const f = targets[i];
          const el = results.querySelector('.load-msg');
          if(el) el.textContent = `Hashing ${i+1}/${targets.length}: ${f.name}…`;
          const r = await computeHash(f.file, algo);
          lastHashes.push({...r, fileName:f.name});
          await new Promise(r2=> setTimeout(r2, 0));
        }
        results.innerHTML = `
          <div style="overflow-x:auto">
            <table class="info-table"><thead><tr><th>File</th><th>${_esc(algo)} hash</th><th>Size</th><th></th></tr></thead>
              <tbody>${lastHashes.map(h=> `<tr><td title="${_esc(h.fileName)}">${_esc(h.fileName)}</td><td style="font-family:var(--font-m);font-size:.82rem;word-break:break-all">${_esc(h.hex)}</td><td>${_humanSize(h.size)}</td><td><button class="icon-btn" data-copy="${_esc(h.hex)}" title="Copy hash">📋</button></td></tr>`).join('')}</tbody>
            </table>
          </div>
          <div class="tool-actions" style="margin-top:12px">
            <button class="btn btn-ghost btn-sm" id="ftHashCopyAll2">📋 Copy all hashes</button>
            <button class="btn btn-ghost btn-sm" id="ftHashDl">⬇ Download .txt</button>
          </div>
        `;
        results.querySelectorAll('[data-copy]').forEach(b=> b.addEventListener('click', async ()=>{
          try{ await navigator.clipboard.writeText(b.dataset.copy); _toast('Copied hash','success'); }catch{ _toast('Copy failed','error'); }
        }));
        const ca2 = results.querySelector('#ftHashCopyAll2');
        if(ca2) ca2.addEventListener('click', async ()=>{
          const txt = lastHashes.map(h=> `${h.hex}  ${h.fileName}`).join('\n');
          try{ await navigator.clipboard.writeText(txt); _toast('Copied all','success'); }catch{ _toast('Copy failed','error'); }
        });
        const dl = results.querySelector('#ftHashDl');
        if(dl) dl.addEventListener('click', ()=>{
          const txt = lastHashes.map(h=> `${h.algo}  ${h.hex}  ${h.fileName}  (${_humanSize(h.size)})`).join('\n');
          _downloadBlob(new Blob([txt],{type:'text/plain'}), `${algo.toLowerCase().replace('-','')}-hashes.txt`);
        });
      }catch(e){ _errorOut(results, _friendly(e), e); }
    }
    if(go) go.addEventListener('click', run);
    if(copyAll) copyAll.addEventListener('click', async ()=>{
      if(!lastHashes.length){ _toast('Compute hashes first','info'); return; }
      const txt = lastHashes.map(h=> h.hex).join('\n');
      try{ await navigator.clipboard.writeText(txt); _toast('Copied','success'); }catch{ _toast('Copy failed','error'); }
    });
    // auto-run for single file convenience
    if(targets.length===1) run();
  }

  async function showCompareHash(){
    if(files.length < 1){ _toast('Add files to compare','info'); return; }
    const status = toolPane('Compare Hashes');
    const fileOpts = files.filter(f=> !f.removed).map(f=> `<option value="${_esc(f.uid)}">${_esc(f.name)} — ${_humanSize(f.size)}</option>`).join('');
    status.innerHTML = `
      <div style="display:grid;gap:16px">
        <div class="controls-grid" style="margin:0">
          <div class="field" style="flex:1"><label>File A</label><select id="ftCmpA"><option value="">— pick file —</option>${fileOpts}</select></div>
          <div class="field" style="flex:1"><label>File B</label><select id="ftCmpB"><option value="">— pick file —</option>${fileOpts}</select></div>
          <div class="field"><label>Algorithm</label><select id="ftCmpAlgo"><option value="SHA-256" selected>SHA-256</option><option value="SHA-1">SHA-1</option><option value="SHA-384">SHA-384</option><option value="SHA-512">SHA-512</option></select></div>
        </div>
        <div class="controls-grid" style="margin:0">
          <div class="field" style="flex:1"><label>Or paste Hash A (hex)</label><input id="ftPasteA" placeholder="paste hex hash for A (optional, overrides file A)"></div>
          <div class="field" style="flex:1"><label>Or paste Hash B (hex)</label><input id="ftPasteB" placeholder="paste hex hash for B"></div>
        </div>
        <div class="tool-actions" style="margin:0">
          <button class="btn btn-primary" id="ftCmpGo">⇔ Compare</button>
          <button class="btn btn-ghost" id="ftCmpSwap">⇄ Swap</button>
        </div>
        <div id="ftCmpResult"><p class="tool-note">Pick two files above and hit Compare, or paste two hash strings to check equality. Comparison is done locally; no upload.</p></div>
      </div>
    `;
    const selA = status.querySelector('#ftCmpA');
    const selB = status.querySelector('#ftCmpB');
    const algo = status.querySelector('#ftCmpAlgo');
    const pasteA = status.querySelector('#ftPasteA');
    const pasteB = status.querySelector('#ftPasteB');
    const res = status.querySelector('#ftCmpResult');
    status.querySelector('#ftCmpSwap')?.addEventListener('click', ()=>{
      const vA = selA.value, vB = selB.value;
      selA.value = vB; selB.value = vA;
      const pA = pasteA.value, pB = pasteB.value;
      pasteA.value = pB; pasteB.value = pA;
    });
    status.querySelector('#ftCmpGo')?.addEventListener('click', async ()=>{
      const aUid = selA.value, bUid = selB.value;
      const pA = pasteA.value.trim().toLowerCase().replace(/\s+/g,'');
      const pB = pasteB.value.trim().toLowerCase().replace(/\s+/g,'');
      let hashA = pA, hashB = pB, nameA = pA ? 'pasted A' : '', nameB = pB ? 'pasted B' : '';
      const al = algo.value;
      try{
        if(!hashA){
          if(!aUid){ _toast('Pick File A or paste a hash','info'); return; }
          const fA = files.find(x=> x.uid===aUid);
          if(!fA || !fA.file){ _toast('File A not found or has no data','error'); return; }
          res.innerHTML = `<div class="loader-line"><span class="spinner"></span><span class="load-msg">Hashing A — ${fA.name}…</span></div>`;
          const rA = await computeHash(fA.file, al);
          hashA = rA.hex; nameA = fA.name;
        }
        if(!hashB){
          if(!bUid){ _toast('Pick File B or paste a hash','info'); return; }
          const fB = files.find(x=> x.uid===bUid);
          if(!fB || !fB.file){ _toast('File B not found','error'); return; }
          res.innerHTML = `<div class="loader-line"><span class="spinner"></span><span class="load-msg">Hashing B — ${fB.name}…</span></div>`;
          const rB = await computeHash(fB.file, al);
          hashB = rB.hex; nameB = fB.name;
        }
        const normA = hashA.replace(/^0x/,'').toLowerCase();
        const normB = hashB.replace(/^0x/,'').toLowerCase();
        const match = normA === normB && normA.length>0;
        res.innerHTML = `
          <div style="display:grid;gap:10px;margin-top:6px">
            <div class="info-item" style="flex-direction:column;align-items:stretch;gap:8px;border-color:${match?'rgba(52,211,153,.45)':'rgba(251,113,133,.45)'};background:${match?'rgba(52,211,153,.08)':'rgba(251,113,133,.08)'}">
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <span style="font-size:1.4rem">${match?'✅ MATCH':'❌ DIFFERENT'}</span>
                <b style="color:${match?'#6ee7b7':'#fda4af'}">${match?'Hashes are identical':'Hashes differ'}</b>
                <span class="badge ${match?'ok':'warn'}">${_esc(al)}</span>
              </div>
              <div style="display:grid;gap:8px">
                <div><span style="color:var(--faint);font-size:.82rem">A — ${_esc(nameA)}</span><div style="font-family:var(--font-m);font-size:.82rem;word-break:break-all;background:rgba(0,0,0,.2);padding:8px;border-radius:8px">${_esc(hashA)}</div></div>
                <div><span style="color:var(--faint);font-size:.82rem">B — ${_esc(nameB)}</span><div style="font-family:var(--font-m);font-size:.82rem;word-break:break-all;background:rgba(0,0,0,.2);padding:8px;border-radius:8px">${_esc(hashB)}</div></div>
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-ghost btn-sm" id="ftCmpCopy">📋 Copy result</button>
            </div>
          </div>
        `;
        res.querySelector('#ftCmpCopy')?.addEventListener('click', async ()=>{
          const txt = `A (${nameA}): ${hashA}\nB (${nameB}): ${hashB}\nResult: ${match?'MATCH':'DIFFERENT'} (${al})`;
          try{ await navigator.clipboard.writeText(txt); _toast('Copied','success'); }catch{ _toast('Copy failed','error'); }
        });
      }catch(e){ _errorOut(res, _friendly(e), e); }
    });
  }

  // ---- text editor for editable files ----
  const MAX_EDIT_SIZE = 2 * 1024 * 1024; // 2 MB limit for in-browser edit
  async function showTextEditor(targets){
    const editable = (targets||getSelected()).filter(f=> isEditableFile(f));
    const nonEditable = (targets||getSelected()).filter(f=> !isEditableFile(f));
    if(!editable.length){
      _toast('No editable text file selected — txt, json, js, java, py, html, css, csv etc. are editable; zip/exe/pdf/images are not.','info');
      if(nonEditable.length){
        const status = toolPane('Edit Text — not editable');
        status.innerHTML = `<div class="panel-err"><span>⚠️</span><div><b>Not a text file</b><p><b>${_esc(nonEditable[0].name)}</b> is not editable. Editable types: txt, md, json, js, ts, java, c, cpp, py, html, css, xml, yaml, csv, log, etc. Binary types (zip, exe, pdf, jpg, mp3, mp4) are not editable in this editor.</p></div></div>`;
      }
      return;
    }
    // For now edit one file at a time; if multiple, pick first and offer tabs
    const f = editable[0];
    if(f.size > MAX_EDIT_SIZE){
      const status = toolPane(`Edit — ${_esc(f.name)}`);
      status.innerHTML = `<div class="panel-err"><span>⚠️</span><div><b>File too large to edit here</b><p><b>${_esc(f.name)}</b> is ${_humanSize(f.size)} — editing is limited to ${ _humanSize(MAX_EDIT_SIZE)} for stability. You can still download or use other tools.</p></div></div>`;
      return;
    }
    const status = toolPane(`Edit Text — ${_esc(f.name)}`);
    const setMsg = _loading(status, `Loading ${f.name}…`);
    try{
      let text = '';
      try{
        // Use .text() if available (modern), else FileReader
        if(f.file && typeof f.file.text === 'function'){
          text = await f.file.text();
        } else if(f.file){
          text = await new Promise((res, rej)=>{
            const r = new FileReader();
            r.onload = ()=> res(String(r.result||''));
            r.onerror = ()=> rej(r.error||new Error('read failed'));
            r.readAsText(f.file, 'utf-8');
          });
        }
      }catch(e){
        throw new Error('Could not read as text — file may be binary or corrupted.');
      }
      // quick binary check: if contains replacement char or null bytes, warn
      const hasNull = text.includes('\u0000');
      if(hasNull){
        status.innerHTML = `<div class="panel-err"><span>⚠️</span><div><b>Looks like binary data</b><p>This file contains null bytes and is not safe to edit as text. Detected for <b>${_esc(f.name)}</b>. Try “Hash” or download instead.</p></div></div>`;
        return;
      }
      const lineCount = text.split('\n').length;
      const extLabel = _extOf(f.name).toUpperCase() || 'TEXT';
      status.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <span class="badge ok">${_esc(extLabel)}</span>
              <span style="color:var(--muted);font-size:.85rem">${_humanSize(f.size)} · ${lineCount} lines</span>
              <span style="color:var(--faint);font-size:.82rem">${_esc(f.name)}</span>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-ghost btn-sm" id="ftEditCancel">↩ Back</button>
              <button class="btn btn-ghost btn-sm" id="ftEditCopy">📋 Copy</button>
            </div>
          </div>
          <textarea id="ftEditArea" spellcheck="false" style="width:100%;min-height:340px;max-height:60vh;padding:14px;border-radius:12px;border:1px solid var(--stroke);background:rgba(255,255,255,.05);font-family:var(--font-m);font-size:.88rem;line-height:1.6;white-space:pre;overflow:auto;tab-size:2">${_esc(text)}</textarea>
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
            <label class="field" style="flex:1;min-width:200px"><span>Save as (renamed)</span><input id="ftEditName" value="${_esc(f.__svName||f.name)}" style="width:100%"></label>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
              <button class="btn btn-primary" id="ftEditSave">💾 Save & Download</button>
              <button class="btn btn-ghost" id="ftEditSaveInPlace">💾 Update in workspace</button>
            </div>
          </div>
          <p class="tool-note">Editing is 100% local — nothing is uploaded. “Save & Download” downloads the edited copy. “Update in workspace” replaces the file in this workspace (kept in memory) so you can then hash/compare again.</p>
          ${editable.length>1 ? `<p class="tool-note">Note: ${editable.length} editable files selected — editing <b>${_esc(f.name)}</b> first. Save then pick next.</p>` : ''}
        </div>
      `;
      const area = status.querySelector('#ftEditArea');
      const nameIn = status.querySelector('#ftEditName');
      status.querySelector('#ftEditCancel')?.addEventListener('click', ()=> { if(current) renderMainFor(current); else renderMainEmpty(); });
      status.querySelector('#ftEditCopy')?.addEventListener('click', async ()=>{
        try{ await navigator.clipboard.writeText(area.value); _toast('Copied','success'); }catch{ area.select(); document.execCommand('copy'); _toast('Copied','success'); }
      });
      status.querySelector('#ftEditSave')?.addEventListener('click', ()=>{
        const newText = area.value;
        const newName = _sanitize(nameIn.value.trim()||f.name);
        const blob = new Blob([newText], {type: f.type || 'text/plain'});
        _downloadBlob(blob, newName);
        _toast(`Downloading “${newName}” (${_humanSize(blob.size)})`,'success');
      });
      status.querySelector('#ftEditSaveInPlace')?.addEventListener('click', ()=>{
        const newText = area.value;
        const newName = _sanitize(nameIn.value.trim()||f.name);
        const blob = new Blob([newText], {type: f.type || 'text/plain'});
        // create a new File object to keep metadata
        let newFile;
        try{ newFile = new File([blob], newName, {type: f.type || 'text/plain', lastModified: Date.now()}); }
        catch { newFile = blob; newFile.name = newName; newFile.lastModified = Date.now(); }
        pushHistory();
        f.file = newFile;
        f.name = newName;
        f.__svName = newName;
        f.size = blob.size;
        f.ext = _extOf(newName);
        f.type = newFile.type || f.type;
        f.lastModified = Date.now();
        pushHistory();
        renderFiles();
        renderMainFor(f);
        _toast(`Updated “${newName}” in workspace — re-hash or download when ready.`,'success');
      });
      // auto-focus
      setTimeout(()=> area.focus(), 50);
    }catch(e){ _errorOut(status, _friendly(e), e); }
  }

  async function showDuplicates(){
    if(files.length<2){ _toast('Add at least two files.','info'); return; }
    const status=toolPane('Duplicate Finder — SHA-256 (local)');
    const setMsg=_loading(status,'Hashing files locally…');
    try{
      const groups=new Map();
      const keptForHash=files; // include all for hashing, but flag removed
      for(let i=0;i<keptForHash.length;i++){
        const f=keptForHash[i];
        if(!f.file){ groups.set('no-file:'+f.name, [f]); continue; }
        setMsg(`Fingerprinting ${i+1}/${keptForHash.length} — ${_esc(f.name)}`);
        const h=await localHashFile(f);
        const key=h; // already includes size
        if(!groups.has(key)) groups.set(key,[]);
        groups.get(key).push(f);
        await new Promise(r=> setTimeout(r,0));
      }
      const dups=[...groups.values()].filter(g=> g.length>1);
      const keptDups=dups.map(g=> g.filter(x=> !x.removed)).filter(g=> g.length>1);
      const wasted=dups.reduce((a,g)=> a+g.slice(1).reduce((x,f)=> x+f.size,0),0);
      const keptWasted=keptDups.reduce((a,g)=> a+g.slice(1).reduce((x,f)=> x+f.size,0),0);
      if(!dups.length){
        _successOut(status,{title:'No duplicates found',msg:`All ${files.length} files are unique (by SHA-256). 🎉`,downloads:[]});
        return;
      }
      status.innerHTML = `
        <div class="stat-grid" style="max-width:620px">
          <div class="stat-tile"><b>${files.length}</b><span>Scanned</span></div>
          <div class="stat-tile"><b>${dups.reduce((a,g)=> a+g.length,0)}</b><span>Dup files (all)</span></div>
          <div class="stat-tile"><b>${keptDups.reduce((a,g)=> a+g.length,0)}</b><span>Kept dups</span></div>
          <div class="stat-tile"><b>${_humanSize(keptWasted||wasted)}</b><span>Reclaimable (kept)</span></div>
        </div>
        <div class="info-list" style="margin-top:14px">
          ${dups.map(g=> `
            <div class="info-item" style="flex-direction:column;align-items:stretch;border-color:${g.some(x=>x.removed)?'var(--stroke)':'rgba(251,113,133,.3)'}">
              <span><b style="color:var(--text)">Group of ${g.length} identical file${g.length===1?'':'s'}</b> · each ${_humanSize(g[0].size)} ${g.some(x=>x.removed)?'<span class="badge dim">some removed</span>':''}</span>
              ${g.map(f=> `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 0;border-top:1px dashed var(--stroke)">
                <b style="font-family:var(--font-b);font-size:.86rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:280px">${_esc(f.name)} ${f.removed?'<span style="color:var(--faint)">(removed)</span>':''}</b>
                <span style="display:flex;gap:6px">
                  <button class="icon-btn" data-sel="${_esc(f.uid)}" title="Select file">◎</button>
                  <button class="icon-btn" data-keep-one="${_esc(f.uid)}" title="Keep this, remove others in group">Keep only this</button>
                </span>
              </div>`).join('')}
            </div>`).join('')}
        </div>
        <p class="tool-note">Duplicates found by full-file SHA-256, computed 100% in your browser. Use “Keep only this” to de-duplicate quickly.</p>
        <div class="tool-actions"><button class="btn btn-ghost btn-sm" id="ftDupExport">⬇ Export report CSV</button></div>
      `;
      status.querySelectorAll('[data-sel]').forEach(b=>{
        b.addEventListener('click',()=>{
          const uid=b.getAttribute('data-sel');
          const f=files.find(x=> x.uid===uid); if(!f) return;
          files.forEach(x=> x.selected=false); f.selected=true; current=f; renderFiles(); _toast(`Selected “${f.name}” in file list.`,'info');
        });
      });
      status.querySelectorAll('[data-keep-one]').forEach(b=>{
        b.addEventListener('click',()=>{
          const uid=b.getAttribute('data-keep-one');
          const keep=files.find(x=> x.uid===uid); if(!keep) return;
          // find group containing keep
          const grp=dups.find(g=> g.includes(keep)); if(!grp) return;
          pushHistory();
          grp.forEach(x=>{ if(x!==keep) x.removed=true; });
          keep.removed=false;
          pushHistory();
          renderFiles(); showDuplicates();
          _toast(`Kept “${keep.name}”, removed ${grp.length-1} duplicate${grp.length-1===1?'':'s'}.`,'success');
        });
      });
      const exp=status.querySelector('#ftDupExport');
      if(exp) exp.onclick=()=>{
        const cell=(s)=> '"'+String(s).replace(/"/g,'""')+'"';
        let rows=[`Group,File,Size,Size Human,Status`];
        dups.forEach((g,gi)=>{
          g.forEach(f=> rows.push([gi+1, cell(f.name), f.size, cell(_humanSize(f.size)), f.removed?'removed':'kept'].join(',')));
        });
        _downloadBlob(new Blob([rows.join('\r\n')],{type:'text/csv'}), _sanitize((els.fileName.value.trim()||'duplicates.csv')).replace(/\.csv$/i,'')+'.csv');
      };
    }catch(e){ _errorOut(status,_friendly(e),e); }
  }

  function showRename(onlySelected){
    const targets = onlySelected && current ? [current] : (getSelected().length? getSelected() : keptList());
    if(!targets.length){ _toast('No kept files to rename.','info'); return; }
    // If onlySelected flag is true and we are from detail view, show single rename; else batch
    const status=toolPane(targets.length===1? `Rename — ${_esc(targets[0].name)}` : `Rename Files — ${targets.length} selected`);
    // Build rename UI
    const isSingle = targets.length===1;
    status.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:14px">
        ${!isSingle ? `<div class="controls-grid" style="margin:0">
          <div class="field"><label>Batch prefix</label><input id="ftBatchPrefix" placeholder="e.g. assignment-" style="min-width:180px"></div>
          <div class="field"><label>Batch suffix (before ext)</label><input id="ftBatchSuffix" placeholder="e.g. -v2"></div>
          <div class="field"><label>Find & replace</label><div style="display:flex;gap:8px"><input id="ftFind" placeholder="find" style="flex:1"><input id="ftReplace" placeholder="replace" style="flex:1"></div></div>
          <div class="field" style="justify-content:flex-end;min-width:auto"><button class="btn btn-ghost btn-sm" id="ftApplyBatch">Apply to selected</button></div>
        </div>` : ''}
        <div class="dz-files" id="ftRenameList" style="display:flex;flex-direction:column;gap:10px"></div>
        <div class="tool-actions" style="margin-top:6px">
          <button class="btn btn-primary" id="ftRenameDl">⬇ Download ${isSingle?'Renamed File':'All Renamed ('+targets.length+')'}</button>
          <button class="btn btn-ghost" id="ftRenameDlSel">⬇ ZIP Selected</button>
          <button class="btn btn-ghost" id="ftRenameReset">↺ Reset names</button>
        </div>
        <p class="tool-note">Renaming only affects the downloaded copy — original files on disk never change. Names are sanitized (${_esc('\\ / : * ? \" < > |')} removed).</p>
      </div>
    `;
    const list=status.querySelector('#ftRenameList');
    function rebuildList(){
      list.innerHTML='';
      const source = isSingle? targets : targets;
      source.forEach(f=>{
        const card=document.createElement('div');
        card.className='file-card';
        const e=_extOf(f.__svName||f.name).toUpperCase() || 'FILE';
        card.innerHTML=`
          <span class="ext ${_extChip(f.__svName||f.name, f.type)}">${_esc(e.slice(0,4))}</span>
          <div class="fc-meta" style="flex:1;min-width:0">
            <input class="rn-input" value="${_esc(f.__svName||f.name)}" aria-label="Name for ${ _esc(f.name)}">
            <div class="fc-sub">${_humanSize(f.size)} · was: ${_esc(f.name)} ${f.removed? '· REMOVED':''}</div>
          </div>
          <div class="fc-actions">
            <button class="icon-btn" data-dl title="Download this one" aria-label="Download">⬇</button>
            <button class="icon-btn" data-reset title="Reset">↺</button>
          </div>
        `;
        const inp=card.querySelector('.rn-input');
        inp.addEventListener('input', ()=>{
          const v=inp.value.trim();
          if(v) f.__svName=_sanitize(v);
          else f.__svName=f.name;
          updateToolbar();
        });
        const dl=card.querySelector('[data-dl]');
        if(dl) dl.addEventListener('click', ()=>{
          if(!f.file){ _toast('File object not available — re-add file.','error'); return; }
          const nm=_sanitize(inp.value.trim()||f.name);
          _downloadBlob(f.file, nm);
          _toast(`Downloading “${nm}”`,'success');
        });
        const rs=card.querySelector('[data-reset]');
        if(rs) rs.addEventListener('click', ()=>{
          f.__svName=f.name;
          inp.value=f.name;
          updateToolbar();
        });
        list.appendChild(card);
      });
    }
    rebuildList();

    // batch handlers
    const applyBtn=status.querySelector('#ftApplyBatch');
    if(applyBtn){
      applyBtn.addEventListener('click', ()=>{
        const pref=status.querySelector('#ftBatchPrefix')?.value || '';
        const suff=status.querySelector('#ftBatchSuffix')?.value || '';
        const findV=status.querySelector('#ftFind')?.value || '';
        const replV=status.querySelector('#ftReplace')?.value || '';
        if(!pref && !suff && !findV){ _toast('Enter a prefix, suffix or find/replace.','info'); return; }
        pushHistory();
        targets.forEach(f=>{
          let base=_extOf(f.__svName||f.name) ? (f.__svName||f.name).slice(0, (f.__svName||f.name).lastIndexOf('.')) : (f.__svName||f.name);
          let ext=_extOf(f.__svName||f.name) ? '.'+_extOf(f.__svName||f.name) : '';
          // find replace on base
          if(findV){
            base=base.split(findV).join(replV);
          }
          if(pref) base=pref+base;
          if(suff) base=base+suff;
          const newName=base+ext;
          f.__svName=_sanitize(newName||f.name);
        });
        pushHistory();
        rebuildList();
        renderFiles();
        _toast(`Applied batch rename to ${targets.length} file${targets.length===1?'':'s'}`,'success');
      });
    }

    const dlBtn=status.querySelector('#ftRenameDl');
    if(dlBtn) dlBtn.addEventListener('click', async ()=>{
      const listTargets = isSingle? targets : keptList();
      const editableTargets = listTargets.filter(f=> !f.removed && f.file);
      if(!editableTargets.length){ _toast('No kept files with file objects to download.','info'); return; }
      _toast(`Downloading ${editableTargets.length} file${editableTargets.length===1?'':'s'} with new names — allow multiple downloads if asked.`,'info');
      const items=editableTargets.map(f=> ({blob:f.file, name:_sanitize(f.__svName||f.name)}));
      await _downloadMany(items);
      _successOut(status,{title:'Done!',msg:`${items.length} renamed file${items.length===1?'':'s'} sent to downloads.`,downloads:[]});
    });
    const zipBtn=status.querySelector('#ftRenameDlSel');
    if(zipBtn) zipBtn.addEventListener('click', async ()=>{
      const sel=getSelected().filter(f=> !f.removed && f.file);
      if(!sel.length){ _toast('Select kept files first.','info'); return; }
      if(!window.JSZip){ _toast('ZIP engine not loaded.','error'); return; }
      const s=_loading(status,'Creating ZIP…');
      try{
        const zip=new JSZip();
        for(let i=0;i<sel.length;i++){
          const f=sel[i];
          s(`Adding ${i+1}/${sel.length} — ${_esc(f.__svName||f.name)}`);
          const buf=await f.file.arrayBuffer();
          zip.file(_sanitize(f.__svName||f.name), buf);
          await new Promise(r=> setTimeout(r,0));
        }
        s('Generating ZIP…');
        const blob=await zip.generateAsync({type:'blob'});
        const zipName=_sanitize((els.fileName.value.trim()||'renamed-files.zip')).replace(/\.zip$/i,'')+'.zip';
        _downloadBlob(blob, zipName);
        _successOut(status,{title:'ZIP ready',msg:`${sel.length} renamed file${sel.length===1?'':'s'} packed as ${zipName} (${_humanSize(blob.size)})`,downloads:[{blob,name:zipName,label:'Download ZIP'}]});
      }catch(e){ _errorOut(status,_friendly(e),e); }
    });
    const rsBtn=status.querySelector('#ftRenameReset');
    if(rsBtn) rsBtn.addEventListener('click', ()=>{
      if(!confirm('Reset all renamed names to originals?')) return;
      pushHistory();
      files.forEach(f=> f.__svName=f.name);
      pushHistory();
      rebuildList(); renderFiles(); _toast('Names reset.','info');
    });
  }

  function showAnalyzeAll(){
    if(!files.length){ _toast('Add files first.','info'); return; }
    const kept=keptList();
    const total=files.reduce((a,f)=> a+f.size,0);
    const status=toolPane('Overview — All Files');
    status.innerHTML = `
      <div class="stat-grid" style="max-width:620px">
        <div class="stat-tile"><b>${files.length}</b><span>Total files</span></div>
        <div class="stat-tile"><b>${kept.length}</b><span>Kept</span></div>
        <div class="stat-tile"><b>${files.length-kept.length}</b><span>Removed</span></div>
        <div class="stat-tile"><b>${_humanSize(total)}</b><span>Total size</span></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:16px">
        <button class="btn btn-ghost" id="ftSumSize" style="flex-direction:column;align-items:flex-start;padding:14px">⚖️ Size details<br><small style="color:var(--faint)">Largest vs smallest bars</small></button>
        <button class="btn btn-ghost" id="ftSumBatch" style="flex-direction:column;align-items:flex-start;padding:14px">📋 Full table<br><small style="color:var(--faint)">All file metadata</small></button>
        <button class="btn btn-ghost" id="ftSumType" style="flex-direction:column;align-items:flex-start;padding:14px">🧪 Type check<br><small style="color:var(--faint)">Magic bytes scan</small></button>
        <button class="btn btn-ghost" id="ftSumDup" style="flex-direction:column;align-items:flex-start;padding:14px">👥 Duplicates<br><small style="color:var(--faint)">SHA-256 hashing</small></button>
      </div>
      <div class="info-list" style="margin-top:16px">
        ${files.slice(0,6).map(f=> `<div class="info-item"><span>${_esc(f.name)}</span><b>${_humanSize(f.size)} ${_esc(f.ext.toUpperCase()||'')}</b></div>`).join('')}
        ${files.length>6? `<div style="text-align:center;color:var(--faint);font-size:.85rem;margin-top:6px">… and ${files.length-6} more</div>`:''}
      </div>
    `;
    const a=status.querySelector('#ftSumSize'); if(a) a.onclick=showSize;
    const b=status.querySelector('#ftSumBatch'); if(b) b.onclick=showBatch;
    const c=status.querySelector('#ftSumType'); if(c) c.onclick=showType;
    const d=status.querySelector('#ftSumDup'); if(d) d.onclick=showDuplicates;
  }

  function showInfo(){
    const status=toolPane('Workspace Info');
    if(!files.length){ status.innerHTML=`<div class="empty-state"><div class="es-ic">📁</div><b>No files</b><p>Add files to see details.</p></div>`; return; }
    const kept=files.filter(f=> !f.removed).length;
    const removed=files.filter(f=> f.removed).length;
    const total=files.reduce((a,b)=> a+b.size,0);
    const byExt={};
    files.forEach(f=>{ const k=f.ext||'no-ext'; byExt[k]=(byExt[k]||0)+1; });
    status.innerHTML=`
      <div class="stat-grid" style="max-width:760px">
        <div class="stat-tile"><b>${files.length}</b><span>Files</span></div>
        <div class="stat-tile"><b>${kept}</b><span>Kept</span></div>
        <div class="stat-tile"><b>${removed}</b><span>Removed</span></div>
        <div class="stat-tile"><b>${_humanSize(total)}</b><span>Total size</span></div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
        ${Object.entries(byExt).map(([k,v])=> `<span class="seg active">.${_esc(k)} × ${v}</span>`).join('')}
      </div>
      <div style="overflow-x:auto;margin-top:16px">
        <table class="info-table"><thead><tr><th>#</th><th>File</th><th>Size</th><th>Type</th><th>Status</th></tr></thead><tbody>
          ${files.map((f,i)=> `<tr><td>${i+1}</td><td title="${_esc(f.name)}">${_esc(f.name)}</td><td>${_humanSize(f.size)}</td><td>${_esc(f.type||'—')}</td><td>${f.removed?'Removed':'Kept'}</td></tr>`).join('')}
        </tbody></table>
      </div>
      <p class="tool-note">Left Files list has its own scrollbar; main detail scrolls with the window. Everything stays local.</p>
    `;
  }

  // ----- actions wiring -----
  els.add.addEventListener('click', ()=> fileInput.click());
  fileInput.addEventListener('change', ()=>{ addFiles(fileInput.files); fileInput.value=''; });

  // drag on whole editor
  ;['dragenter','dragover'].forEach(ev=>{
    root.addEventListener(ev, e=>{ e.preventDefault(); root.classList.add('drag'); });
  });
  root.addEventListener('dragleave', e=>{ if(!root.contains(e.relatedTarget)) root.classList.remove('drag'); });
  root.addEventListener('drop', e=>{
    e.preventDefault(); root.classList.remove('drag');
    if(e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
  });

  els.remove.addEventListener('click',()=>{
    const sel=getSelected().filter(f=> !f.removed); if(!sel.length) return;
    pushHistory(); sel.forEach(f=> f.removed=true); pushHistory(); renderFiles(); if(sel.includes(current)) renderMainFor(current); else updateToolbar();
  });
  els.restore.addEventListener('click',()=>{
    const sel=getSelected().filter(f=> f.removed); if(!sel.length) return;
    pushHistory(); sel.forEach(f=> f.removed=false); pushHistory(); renderFiles(); if(sel.includes(current)) renderMainFor(current); else updateToolbar();
  });
  els.duplicate.addEventListener('click', duplicateSelected);
  els.clear.addEventListener('click', clearWorkspace);
  els.info.addEventListener('click', showInfo);
  els.selectAll.addEventListener('click',()=>{
    const vis=files.filter(f=> !f.hiddenByFilter);
    const allSelected=vis.length && vis.every(f=> f.selected);
    if(allSelected) vis.forEach(f=> f.selected=false); else vis.forEach(f=> f.selected=true);
    if(vis.length){ current=vis[vis.length-1]; lastSelectedIdx=files.indexOf(current); }
    renderFiles(); if(current) renderMainFor(current);
  });
  els.deselect.addEventListener('click', ()=>{ files.forEach(f=> f.selected=false); renderFiles(); updateToolbar(); renderMainEmpty(); });
  els.undo.addEventListener('click', undo);
  els.redo.addEventListener('click', redo);

  if(els.hash) els.hash.addEventListener('click', showHashCalculator);
  if(els.compareHash) els.compareHash.addEventListener('click', showCompareHash);
  els.rename.addEventListener('click', ()=> showRename(false));
  if(els.edit) els.edit.addEventListener('click', ()=> {
    const sel = getSelected().filter(f=> isEditableFile(f));
    if(!sel.length){
      const anyEditable = files.find(f=> isEditableFile(f) && !f.removed);
      if(!anyEditable){ _toast('No editable text files found — add a .txt, .json, .js, .java etc. (zip/exe are not editable)','info'); return; }
      // open editor for first editable kept file
      showTextEditor([anyEditable]);
    } else {
      showTextEditor(sel);
    }
  });
  els.dup.addEventListener('click', showDuplicates);
  els.sortName.addEventListener('click', ()=>{
    pushHistory(); files.sort((a,b)=> a.name.localeCompare(b.name)); pushHistory(); renderFiles(); _toast('Sorted by name','info');
  });
  els.sortSize.addEventListener('click', ()=>{
    pushHistory(); files.sort((a,b)=> b.size-a.size); pushHistory(); renderFiles(); _toast('Sorted by size','info');
  });
  els.downloadAll.addEventListener('click', async ()=>{
    const kept=keptList().filter(f=> f.file);
    if(!kept.length){ _toast('No kept files with data.','info'); return; }
    _toast(`Downloading ${kept.length} file${kept.length===1?'':'s'} — allow multiple downloads if prompted.`,'info');
    const items=kept.map(f=> ({blob:f.file, name:_sanitize(f.__svName||f.name)}));
    await _downloadMany(items);
    _toast('Downloads started','success');
  });
  els.downloadSel.addEventListener('click', async ()=>{
    const sel=getSelected().filter(f=> !f.removed && f.file);
    if(!sel.length){ _toast('Select kept files first.','info'); return; }
    if(sel.length===1){ _downloadBlob(sel[0].file, _sanitize(sel[0].__svName||sel[0].name)); _toast('Downloading','success'); return; }
    if(!window.JSZip){ await _downloadMany(sel.map(f=> ({blob:f.file,name:_sanitize(f.__svName||f.name)}))); return; }
    // ZIP selected
    const zip=new JSZip();
    for(let i=0;i<sel.length;i++){
      const f=sel[i];
      const buf=await f.file.arrayBuffer();
      zip.file(_sanitize(f.__svName||f.name), buf);
    }
    const blob=await zip.generateAsync({type:'blob'});
    const nm=_sanitize((els.fileName.value.trim()||'selected-files.zip')).replace(/\.zip$/i,'')+'.zip';
    _downloadBlob(blob,nm);
  });
  els.exportCsv.addEventListener('click', ()=> exportCsvFor(keptList().length? keptList():files,'file-list'));
  els.exportRenamed.addEventListener('click', async ()=>{
    const renamed=files.filter(f=> f.__svName && f.__svName!==f.name && !f.removed && f.file);
    if(!renamed.length){ _toast('No renamed kept files — use Rename first.','info'); return; }
    if(!window.JSZip){ await _downloadMany(renamed.map(f=> ({blob:f.file,name:_sanitize(f.__svName)}))); return; }
    const zip=new JSZip();
    for(const f of renamed){
      const buf=await f.file.arrayBuffer();
      zip.file(_sanitize(f.__svName), buf);
    }
    const blob=await zip.generateAsync({type:'blob'});
    const nm=_sanitize((els.fileName.value.trim()||'renamed-files.zip')).replace(/\.zip$/i,'')+'.zip';
    _downloadBlob(blob,nm);
  });

  els.filter.addEventListener('input', e=> setFilter(e.target.value));
  els.filter.addEventListener('keydown', e=>{ if(e.key==='Escape'){ e.target.value=''; setFilter(''); }});
  els.jump.addEventListener('change', ()=>{
    const n=Number(els.jump.value); if(!n||n<1||n>files.length) return;
    const target=files[n-1]; if(!target) return;
    files.forEach(f=> f.selected=false); target.selected=true; current=target; lastSelectedIdx=n-1;
    renderFiles(); renderMainFor(target);
    requestAnimationFrame(()=>{ if(target.el) target.el.scrollIntoView({block:'nearest',behavior:'smooth'}); });
  });
  els.jump.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); els.jump.dispatchEvent(new Event('change')); }});
  els.fileName.addEventListener('change', e=>{
    outputName=_sanitize(e.target.value.trim()||'file-list.csv');
    e.target.value=outputName;
  });
  els.fileName.value=outputName;

  // initial history + render
  pushHistory();
  renderFiles(); renderMainEmpty(); updateToolbar();

  // keyboard shortcuts similar to pdf/photo
  root.addEventListener('keydown', e=>{
    if(e.ctrlKey||e.metaKey){
      if(e.key.toLowerCase()==='z' && !e.shiftKey){ e.preventDefault(); undo(); }
      else if(e.key.toLowerCase()==='y' || (e.key.toLowerCase()==='z' && e.shiftKey)){ e.preventDefault(); redo(); }
      else if(e.key.toLowerCase()==='a'){ e.preventDefault(); els.selectAll.click(); }
    } else if(e.key==='Delete' || e.key==='Backspace'){
      // handled per file card, but global fallback:
      // if focus is not in input, remove selected
      if(document.activeElement && document.activeElement.tagName!=='INPUT' && document.activeElement.tagName!=='TEXTAREA'){
        const sel=getSelected().filter(f=> !f.removed);
        if(sel.length){ e.preventDefault(); pushHistory(); sel.forEach(f=> f.removed=true); pushHistory(); renderFiles(); }
      }
    }
  });
}

// expose
if(typeof window !== 'undefined') window.renderFileTools = renderFileTools;
