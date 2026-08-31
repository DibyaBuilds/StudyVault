/*
  StudyVault — application core.
  Utilities, file/PDF helpers, tool renderers, modal manager and init.
  Load after tools-data.js and search.js (deferred, file:// safe).
*/
/* ============================================================
   STUDYVAULT — application script
   Everything runs locally in the browser. No servers. No uploads.
   ============================================================ */
'use strict';
if (window.pdfjsLib) {
  // For full offline, download pdf.worker.min.js to vendor/ and use local path.
  // pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

/* ============ Device capability detection (for adaptive quality) ============ */
const DeviceCaps = {
  isTouch: ('ontouchstart' in window) || (navigator.maxTouchPoints > 0),
  isFinePointer: matchMedia('(pointer: fine)').matches,
  isCoarsePointer: matchMedia('(pointer: coarse)').matches,
  supportsHover: matchMedia('(hover: hover)').matches,
  prefersReducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  supportsWebGL: (() => {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
    } catch { return false; }
  })(),
  memory: navigator.deviceMemory || 4,
  cores: navigator.hardwareConcurrency || 4,
  
  get qualityTier() {
    if (this.memory <= 2 || this.cores <= 2) return 'low';
    if (this.memory <= 4 || this.cores <= 4) return 'medium';
    return 'high';
  }
};

const QUALITY_SETTINGS = {
  low: { maxImageDim: 1200, pdfRenderScale: 0.75, maxPdfPages: 50, enableTilt: false, enableParallax: false, batchSize: 2 },
  medium: { maxImageDim: 2000, pdfRenderScale: 1, maxPdfPages: 100, enableTilt: true, enableParallax: true, batchSize: 4 },
  high: { maxImageDim: 2400, pdfRenderScale: 1.5, maxPdfPages: 120, enableTilt: true, enableParallax: true, batchSize: 6 }
};

const quality = QUALITY_SETTINGS[DeviceCaps.qualityTier];

/* ============ 1. Tiny utilities ============ */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const tick = () => new Promise(r => setTimeout(r, 0));

class ToolError extends Error {}

function esc(str){
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function humanSize(b){
  if (!isFinite(b) || b < 0) b = 0;
  if (b < 1024) return b + ' B';
  const u = ['KB','MB','GB','TB'];
  let i = -1;
  do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
  return (b >= 100 ? Math.round(b) : b.toFixed(1)) + ' ' + u[i];
}
function sanitizeName(n){
  return String(n).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').slice(0, 180) || 'file';
}
function extOf(name){
  const m = /\.([a-z0-9]+)$/i.exec(name || '');
  return m ? m[1].toLowerCase() : '';
}
function baseOf(name){
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}
function fmtDate(d){
  try { return new Date(d).toLocaleString(undefined, {dateStyle:'medium', timeStyle:'short'}); }
  catch { return '—'; }
}
function friendly(e){
  if (e instanceof ToolError) return e.message;
  if (e && e.name === 'PasswordException') return 'This PDF is password-protected. Please remove the password first.';
  if (e && /network|failed to fetch|loading/i.test(e.message || '')) return 'A required library could not be loaded. Check your internet connection once — afterwards the app shell keeps working.';
  return "We couldn't process this file. Please try another file.";
}

/* localStorage helper (never throws) */
const store = {
  get(k, d){ try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k){ try { localStorage.removeItem(k); } catch {} }
};

/* ============ 2. Toasts ============ */
function toast(msg, type = 'info', ms = 3600) {
  const root = $('#toastRoot');
  if (!root) return;

  const icons = { success: '✅', error: '⚠️', info: '💡' };

  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = `
    <span class="t-ic">${icons[type] || '💡'}</span>
    <span>${esc(msg)}</span>
  `;

  root.appendChild(t);

  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 320);
  }, ms);
}

/* ============ 3. Library guards (honest about capabilities) ============ */
function needPdfLib(){
  if (!window.PDFLib) throw new ToolError('The PDF engine has not loaded yet. Please check your internet connection once — after the first load everything runs locally.');
}
function needPdfJs(){
  if (!window.pdfjsLib) throw new ToolError('The PDF reader engine has not loaded yet. Please check your internet connection once — after the first load everything runs locally.');
}

/* ============ 4. File helpers ============ */
function downloadBlob(blob, name){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = sanitizeName(name);
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
async function downloadMany(items){
  for (const it of items){ downloadBlob(it.blob, it.name); await new Promise(r => setTimeout(r, 380)); }
}
function canvasToBlob(canvas, type, q){
  return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new ToolError('Image encoding failed.')), type, q));
}
function fileToImage(file){
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => res({img, url});
    img.onerror = () => { URL.revokeObjectURL(url); rej(new ToolError(`We couldn't read “${file.name}”. It may be corrupted or in an unsupported format.`)); };
    img.src = url;
  });
}
async function drawImageFile(file, maxDim = 2400, fill = '#ffffff'){
  const {img, url} = await fileToImage(file);
  let w = img.naturalWidth, h = img.naturalHeight;
  
  if (!w || !h) {
    URL.revokeObjectURL(url);
    throw new ToolError(`"${file.name}" has no readable image data.`);
  }
  
  const s = Math.min(1, maxDim / Math.max(w, h));
  const targetW = Math.max(1, Math.round(w * s));
  const targetH = Math.max(1, Math.round(h * s));
  
  let canvas;
  
  // Use OffscreenCanvas when available for better performance
  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(targetW, targetH);
  } else {
    canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
  }
  
  const ctx = canvas.getContext('2d', { alpha: !fill });
  
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, targetW, targetH);
  }
  
  // Use high-quality smoothing for downscaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetW, targetH);
  
  URL.revokeObjectURL(url);
  return canvas;
}
function acceptMatch(file, accept){
  if (!accept) return true;
  const name = file.name.toLowerCase(), type = (file.type || '').toLowerCase();
  return accept.split(',').map(s => s.trim().toLowerCase()).some(a => {
    if (!a) return true;
    if (a.startsWith('.')) return name.endsWith(a);
    if (a.endsWith('/*')) return type.startsWith(a.slice(0, -1));
    return type === a;
  });
}
function extChipClass(name, type){
  const e = extOf(name);
  if (e === 'pdf') return 'ext-pdf';
  if (['jpg','jpeg','jfif'].includes(e) || type === 'image/jpeg') return 'ext-img';
  if (e === 'png') return 'ext-png';
  if (e === 'gif') return 'ext-gif';
  if (e === 'webp') return 'ext-webp';
  if (['txt','md','csv','log','json'].includes(e) || type.startsWith('text/')) return 'ext-txt';
  if (['doc','docx','rtf','odt','ppt','pptx','xls','xlsx'].includes(e)) return 'ext-doc';
  if (['zip','rar','7z','gz'].includes(e)) return 'ext-zip';
  return 'ext-any';
}

/* ============ 5. PDF helpers (pdf-lib + pdf.js, both 100% client-side) ============ */
async function pdfLoad(buf){
  needPdfLib();
  try { return await PDFLib.PDFDocument.load(buf, {ignoreEncryption:true, updateMetadata:false}); }
  catch (e){
    if (e && /password|encrypt/i.test(e.message)) throw new ToolError('This PDF appears to be protected and could not be opened.');
    throw new ToolError('This file does not look like a valid PDF.');
  }
}
async function pdfPageCount(file){
  const d = await pdfLoad(await file.arrayBuffer());
  return d.getPageCount();
}
async function buildPdfFromPages(srcBuf, pageIndexes){
  needPdfLib();
  const src = await pdfLoad(srcBuf);
  const out = await PDFLib.PDFDocument.create();
  const pages = await out.copyPages(src, pageIndexes);
  pages.forEach(p => out.addPage(p));
  return out.save();
}
function parseRanges(str, max){
  const out = new Set();
  for (const raw of String(str).split(',')){
    const p = raw.trim();
    if (!p) continue;
    const m = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m){
      let a = +m[1], b = +m[2];
      if (a > b) [a, b] = [b, a];
      if (a < 1 || b > max) throw new ToolError(`Range “${p}” is out of bounds — this PDF has ${max} page${max === 1 ? '' : 's'}.`);
      for (let i = a; i <= b; i++) out.add(i);
    } else if (/^\d+$/.test(p)){
      const n = +p;
      if (n < 1 || n > max) throw new ToolError(`Page ${n} is out of bounds — this PDF has ${max} page${max === 1 ? '' : 's'}.`);
      out.add(n);
    } else {
      throw new ToolError(`Couldn't understand “${p}”. Use formats like 3 or 2-6, separated by commas.`);
    }
  }
  if (!out.size) throw new ToolError('Please enter at least one page or range.');
  return [...out].sort((a, b) => a - b);
}
async function renderPdfThumbs(buf, {maxW = 170, maxPages = 120, onProgress, priority = 'visible'} = {}) {
  needPdfJs();
  let pdf;
  try { pdf = await pdfjsLib.getDocument({data: buf.slice(0)}).promise; }
  catch (e){ throw new ToolError('This PDF could not be read. It may be corrupted or protected.'); }
  
  const total = pdf.numPages, n = Math.min(total, maxPages), items = [];
  
  try {
    // Render first 4 pages immediately, rest in idle callbacks
    const batchSize = 4;
    
    for (let i = 1; i <= n; i++) {
      if (onProgress) onProgress(i, total);
      
      const pg = await pdf.getPage(i);
      const vp1 = pg.getViewport({scale: 1});
      const vp = pg.getViewport({scale: Math.min(1.2, maxW / vp1.width)});
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(vp.width);
      cv.height = Math.ceil(vp.height);
      
      await pg.render({
        canvasContext: cv.getContext('2d', { alpha: false }),
        viewport: vp
      }).promise;
      
      items.push({canvas: cv, page: i});
      
      // Yield to main thread more aggressively after first batch
      if (i > batchSize) {
        await new Promise(r => requestIdleCallback ? requestIdleCallback(r, {timeout: 100}) : setTimeout(r, 0));
      } else {
        await tick();
      }
    }
  } finally {
    try { pdf.destroy(); } catch {}
  }
  
  return {items, total, truncated: total > n};
}
async function compressPdfBytes(buf, quality, renderScale, onProgress){
  needPdfJs(); needPdfLib();
  let pdf;
  try { pdf = await pdfjsLib.getDocument({data: buf.slice(0)}).promise; }
  catch { throw new ToolError('This PDF could not be read. It may be corrupted or protected.'); }
  const doc = await PDFLib.PDFDocument.create();
  const total = pdf.numPages;
  try {
    for (let i = 1; i <= total; i++){
      if (onProgress) onProgress(`Rendering page ${i} of ${total}…`, i, total);
      const pg = await pdf.getPage(i);
      const vp1 = pg.getViewport({scale: 1});
      let s = renderScale;
      const maxSide = Math.max(vp1.width, vp1.height) * s;
      if (maxSide > 2200) s = s * 2200 / maxSide;
      const vp = pg.getViewport({scale: s});
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
      await pg.render({canvasContext: cv.getContext('2d'), viewport: vp}).promise;
      const jpg = await canvasToBlob(cv, 'image/jpeg', quality);
      const emb = await embedImageDoc(doc, await jpg.arrayBuffer(), 'image/jpeg');
      const page = doc.addPage([vp1.width, vp1.height]);
      page.drawImage(emb, {x:0, y:0, width:vp1.width, height:vp1.height});
      await tick();
    }
  } finally { try { pdf.destroy(); } catch {} }
  return doc.save();
}

// Helper to embed images into a PDFDocument with compatibility across pdf-lib versions.
async function embedImageDoc(doc, buf, mime){
  // prefer exact handlers when available
  try {
    if (mime === 'image/png' && typeof doc.embedPng === 'function') return await doc.embedPng(buf);
    if ((mime === 'image/jpeg' || mime === 'image/jpg') ){
      if (typeof doc.embedJpg === 'function') return await doc.embedJpg(buf);
      if (typeof doc.embedJpeg === 'function') return await doc.embedJpeg(buf);
    }
    // try common names
    if (typeof doc.embedJpg === 'function') {
      try { return await doc.embedJpg(buf); } catch(e){}
    }
    if (typeof doc.embedJpeg === 'function') {
      try { return await doc.embedJpeg(buf); } catch(e){}
    }
    if (typeof doc.embedPng === 'function') {
      try { return await doc.embedPng(buf); } catch(e){}
    }
  } catch (e) {
    // fall through to rasterize fallback
  }
  // Fallback: rasterize the bytes via canvas and embed as JPEG
  try {
    const blob = new Blob([buf], {type: mime || 'image/png'});
    const cv = await drawImageFile(blob, 12000, '#ffffff');
    const jpgBlob = await canvasToBlob(cv, 'image/jpeg', .92);
    return await doc.embedJpeg(await jpgBlob.arrayBuffer());
  } catch (e){
    throw e;
  }
}

/* ============ 6. UI atoms: dropzone, status, success, compare ============ */
function dropzone(opts = {}){
  const files = [];
  const root = document.createElement('div');
  root.className = 'dz-wrap';
  root.innerHTML = `
    <div class="dropzone" tabindex="0" role="button" aria-label="${esc(opts.label || 'Upload files')}. Press Enter to browse, or drop files here.">
      <div class="dz-icon" aria-hidden="true">📥</div>
      <div class="dz-title">${esc(opts.label || 'Drop your files here')}</div>
      <div class="dz-or">or</div>
      <span class="btn btn-ghost btn-sm dz-browse">Browse Files</span>
      <div class="dz-note">🔒 Files are processed locally on your device.</div>
    </div>
    <input type="file" class="dz-input" hidden ${opts.multiple ? 'multiple' : ''} ${opts.accept ? `accept="${esc(opts.accept)}"` : ''}>
    <div class="dz-files" aria-live="polite"></div>
    <div class="dz-count" hidden></div>`;
  const zone = $('.dropzone', root), input = $('.dz-input', root), list = $('.dz-files', root), count = $('.dz-count', root);

  function refresh(){
    list.innerHTML = '';
    files.forEach((f, i) => {
      const card = document.createElement('div');
      card.className = 'file-card';
      const e = extOf(f.name).toUpperCase() || (f.type ? f.type.split('/')[1] : 'FILE');
      const sub = `${f.type || 'unknown type'} · ${humanSize(f.size)}${f.__orig && f.__orig !== (f.__svName || f.name) ? ' · was: ' + esc(f.__orig) : ''}`;
      const nameHtml = opts.renameable
        ? `<input class="rn-input" value="${esc(f.__svName || f.name)}" aria-label="New name for ${esc(f.name)}">`
        : `<div class="fc-name" title="${esc(f.name)}">${esc(f.name)}</div>`;
      card.innerHTML = `
        <span class="ext ${extChipClass(f.name, f.type)}">${esc(e.slice(0,4))}</span>
        <div class="fc-meta">${nameHtml}<div class="fc-sub">${sub}</div></div>
        <div class="fc-actions">
          ${opts.orderable ? `<button class="icon-btn mv-up" aria-label="Move up">↑</button><button class="icon-btn mv-dn" aria-label="Move down">↓</button>` : ''}
          ${opts.renameable ? `<button class="icon-btn dl-one" title="Download with new name" aria-label="Download renamed file">⬇</button>` : ''}
          <button class="icon-btn rm" aria-label="Remove ${esc(f.name)}">✕</button>
        </div>`;
      if (opts.renameable){
        const inp = $('.rn-input', card);
        inp.addEventListener('input', () => { f.__svName = inp.value.trim(); });
        $('.dl-one', card).addEventListener('click', () => {
          const nm = sanitizeName(inp.value.trim() || f.name);
          downloadBlob(f, nm);
          toast(`Downloading “${nm}”`, 'success');
        });
      }
      if (opts.orderable){
        $('.mv-up', card).addEventListener('click', () => { if (i > 0){ [files[i-1], files[i]] = [files[i], files[i-1]]; refresh(); } });
        $('.mv-dn', card).addEventListener('click', () => { if (i < files.length - 1){ [files[i+1], files[i]] = [files[i], files[i+1]]; refresh(); } });
      }
      $('.rm', card).addEventListener('click', () => {
        card.classList.add('removing');
        setTimeout(() => { files.splice(i, 1); refresh(); }, 220);
      });
      list.appendChild(card);
    });
    if (files.length){ count.hidden = false; count.textContent = `${files.length} file${files.length === 1 ? '' : 's'} selected · total ${humanSize(files.reduce((a,f) => a + f.size, 0))}`; }
    else count.hidden = true;
    if (opts.onChange) opts.onChange(files.slice());
  }
  function addFiles(fileList){
    let added = 0;
    for (const f of fileList){
      if (f.size > 250 * 1024 * 1024){ toast(`“${f.name}” is larger than 250 MB — too big for safe in-browser processing.`, 'error'); continue; }
      if (opts.accept && !acceptMatch(f, opts.accept)){ toast(`Skipped “${f.name}” — unsupported file type.`, 'error'); continue; }
      if (!opts.multiple && files.length >= 1) files.length = 0;
      files.push(f); added++;
      if (files.length > 300){ toast('Stopped at 300 files to keep things smooth.', 'info'); break; }
    }
    if (added) refresh();
  }
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); input.click(); } });
  input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
  let depth = 0;
  zone.addEventListener('dragenter', e => { e.preventDefault(); depth++; zone.classList.add('drag'); });
  zone.addEventListener('dragover', e => e.preventDefault());
  zone.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) zone.classList.remove('drag'); });
  zone.addEventListener('drop', e => { e.preventDefault(); depth = 0; zone.classList.remove('drag'); addFiles(e.dataTransfer.files); });
  refresh();
  return {
    root,
    getFiles: () => files.slice(),
    clear(){ files.length = 0; refresh(); },
    addFiles,
    removeFile(f){ const i = files.indexOf(f); if (i > -1){ files.splice(i, 1); refresh(); } }
  };
}

function statusBox(body){
  const d = document.createElement('div');
  d.className = 'tool-status';
  d.setAttribute('aria-live', 'polite');
  body.appendChild(d);
  return d;
}
function loading(status, msg){
  status.innerHTML = `<div class="loader-line"><span class="spinner" aria-hidden="true"></span><span class="load-msg">${esc(msg || 'Processing…')}</span></div>`;
  return m => { const el = $('.load-msg', status); if (el) el.textContent = m; };
}
function errorOut(status, msg, err){
  let userMsg = typeof msg === 'string' ? msg : (msg && msg.userMessage) || "We couldn't process this file. Please try another file.";
  let tech = '';
  const e = err || (msg && msg.error) || (msg && msg.message && typeof msg.message === 'string' ? msg : null);
  if (e && e.message){
    tech = `<details style="margin-top:8px;color:var(--faint)"><summary>Technical details</summary><pre style="white-space:pre-wrap;margin-top:8px;color:var(--muted)">${esc(e.message)}</pre></details>`;
  }
  status.innerHTML = `<div class="panel-err"><span aria-hidden="true">⚠️</span><div><b>Something went wrong</b><p>${esc(userMsg)}</p>${tech}</div></div>`;
  if (err && err.stack) console.error(err.stack);
}
function successOut(status, {title = 'Done!', msg = 'Your file has been successfully created.', downloads = [], extraHtml = ''}){
  status.innerHTML = `
    <div class="success-box">
      <div class="check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 12.5l5 5L20 6.5" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <h3>${esc(title)}</h3>
      <p>${esc(msg)}</p>
      ${extraHtml}
      <div class="success-actions">
        ${downloads.map((d, i) => `<button class="btn ${i === 0 ? 'btn-primary' : 'btn-ghost'}" data-dl="${i}">⬇ ${esc(d.label || 'Download File')}</button>`).join('')}
      </div>
    </div>`;
  $$('[data-dl]', status).forEach(b => b.addEventListener('click', () => {
    const d = downloads[+b.dataset.dl];
    downloadBlob(d.blob, d.name);
    toast(`Downloading “${d.name}”`, 'success');
  }));
}
function compareHTML(orig, next, origLabel = 'Original', newLabel = 'Compressed'){
  const saved = orig > 0 ? (1 - next / orig) * 100 : 0;
  const wNew = orig > 0 ? Math.min(100, Math.max(3, next / orig * 100)) : 100;
  const good = saved > 0;
  return `
    <div class="cmp">
      <div class="cmp-row"><span class="cmp-label">${origLabel}</span><div class="bar old"><i data-w="100"></i></div><b>${humanSize(orig)}</b></div>
      <div class="cmp-row"><span class="cmp-label">${newLabel}</span><div class="bar new"><i data-w="${wNew.toFixed(1)}"></i></div><b>${humanSize(next)}</b></div>
      <span class="cmp-save ${good ? '' : 'bad'}">${good ? `↓ Saved ${saved.toFixed(1)}%` : `↑ Size changed by ${Math.abs(saved).toFixed(1)}%`}</span>
    </div>`;
}
function animateBars(container){
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $$('.bar i', container).forEach(i => { i.style.width = i.dataset.w + '%'; });
  }));
}
function emptyState(body, icon, title, sub){
  const d = document.createElement('div');
  d.className = 'empty-state';
  d.innerHTML = `<div class="es-ic">${icon}</div><b>${esc(title)}</b><p>${esc(sub)}</p>`;
  body.appendChild(d);
  return d;
}
function field(labelText, inner){
  return `<div class="field"><label>${esc(labelText)}</label>${inner}</div>`;
}

/* ============ 7. Tool renderers ============ */

/* ---- Images → PDF ---- */
function renderImagesToPdf(body, api){
  const dz = dropzone({accept:'image/*', multiple:true, orderable:true, label:'Drop your images here'});
  body.appendChild(dz.root);
  const ctl = document.createElement('div');
  ctl.innerHTML = `
    <div class="controls-grid">
      ${field('Page size', `<select id="pSize">
        <option value="fit">Fit to image</option><option value="a4" selected>A4</option><option value="letter">US Letter</option></select>`)}
      ${field('Orientation', `<select id="pOrient">
        <option value="auto">Auto</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select>`)}
      ${field('Margin', `<select id="pMargin">
        <option value="0">None</option><option value="24">Small</option><option value="48" selected>Normal</option></select>`)}
    </div>`;
  body.appendChild(ctl);
  const actions = document.createElement('div');
  actions.className = 'tool-actions';
  actions.innerHTML = `<button class="btn btn-primary" id="runBtn">📄 Create PDF</button><button class="btn btn-ghost" id="clearBtn">Clear</button>`;
  body.appendChild(actions);
  const status = statusBox(body);
  $('#clearBtn', actions).onclick = () => api.reset();
  $('#runBtn', actions).onclick = async () => {
    const fs = dz.getFiles();
    if (!fs.length) return toast('Add at least one image first.', 'info');
    if (fs.length > 60) return toast('Please use 60 images or fewer at once.', 'error');
    const setMsg = loading(status, 'Creating your PDF…');
    try {
      needPdfLib();
      const size = $('#pSize', ctl).value, orient = $('#pOrient', ctl).value, margin = +$('#pMargin', ctl).value;
      const doc = await PDFLib.PDFDocument.create();
      for (let i = 0; i < fs.length; i++){
        setMsg(`Adding image ${i + 1} of ${fs.length}…`);
        const cv = await drawImageFile(fs[i], 2400);
        const jpg = await canvasToBlob(cv, 'image/jpeg', .92);
        const emb = await embedImageDoc(doc, await jpg.arrayBuffer(), 'image/jpeg');
        let pw, ph;
        if (size === 'fit'){ pw = cv.width * .75; ph = cv.height * .75; }
        else if (size === 'a4'){ pw = 595.28; ph = 841.89; }
        else { pw = 612; ph = 792; }
        if (orient === 'landscape' && ph > pw) [pw, ph] = [ph, pw];
        if (orient === 'portrait' && pw > ph) [pw, ph] = [ph, pw];
        const page = doc.addPage([pw, ph]);
        const bw = pw - margin * 2, bh = ph - margin * 2;
        const sc = Math.min(bw / cv.width, bh / cv.height);
        const dw = cv.width * sc, dh = cv.height * sc;
        page.drawImage(emb, {x: margin + (bw - dw) / 2, y: margin + (bh - dh) / 2, width: dw, height: dh});
        await tick();
      }
      setMsg('Almost done…');
      const bytes = await doc.save();
      const blob = new Blob([bytes], {type:'application/pdf'});
      successOut(status, {
        msg: `${fs.length} image${fs.length === 1 ? '' : 's'} combined into a ${fs.length === 1 ? '1-page' : fs.length + '-page'} PDF (${humanSize(blob.size)}).`,
        downloads: [{blob, name:'study-notes.pdf', label:'Download PDF'}]
      });
    } catch (e){ errorOut(status, friendly(e), e); }
  };
}

/* ---- JPG / PNG → PDF (NEW — enhanced image-to-PDF with previews, dimensions & fitting) ---- */
function renderJpgPngToPdf(body, api){
  const dz = dropzone({accept:'image/*', multiple:true, label:'Drop your JPG / PNG images here'});
  body.appendChild(dz.root);
  // The dropzone handles selection; we render our own rich preview list below.
  $('.dz-files', dz.root).hidden = true;

  const list = document.createElement('div');
  list.className = 'dz-files';
  list.style.marginTop = '4px';
  list.setAttribute('aria-live', 'polite');
  body.appendChild(list);

  const ctl = document.createElement('div');
  ctl.innerHTML = `
    <div class="controls-grid">
      ${field('Page size', `<select id="j2pSize">
        <option value="fit">Fit to image</option><option value="a4" selected>A4</option><option value="letter">US Letter</option></select>`)}
      ${field('Orientation', `<select id="j2pOrient">
        <option value="auto">Auto</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select>`)}
      ${field('Margin', `<select id="j2pMargin">
        <option value="0">None</option><option value="24">Small</option><option value="48" selected>Normal</option></select>`)}
      ${field('Image fitting', `<select id="j2pFit">
        <option value="contain" selected>Fit inside page</option><option value="fill">Fill page (crop)</option><option value="stretch">Stretch to page</option><option value="actual">Actual size</option></select>`)}
    </div>
    <p class="tool-note">👆 Drag cards to rearrange — the order below becomes the page order in your PDF.</p>`;
  body.appendChild(ctl);

  const actions = document.createElement('div');
  actions.className = 'tool-actions';
  actions.innerHTML = `<button class="btn btn-primary" id="runBtn">📄 Create PDF</button><button class="btn btn-ghost" id="clearBtn">Clear</button>`;
  body.appendChild(actions);
  const status = statusBox(body);

  let items = [];   // {file, url, w, h} — order = PDF page order
  let dragIdx = null;

  function rebuild(){
    list.innerHTML = '';
    items.forEach((it, idx) => {
      const card = document.createElement('div');
      card.className = 'file-card';
      card.draggable = true;
      card.innerHTML = `
        <img class="img-prev" src="${it.url}" alt="Preview of ${esc(it.file.name)}">
        <div class="fc-meta">
          <div class="fc-name" title="${esc(it.file.name)}">${esc(it.file.name)}</div>
          <div class="fc-sub">${humanSize(it.file.size)} · ${it.w ? it.w + '×' + it.h + ' px' : 'measuring…'} · Page ${idx + 1}</div>
        </div>
        <div class="fc-actions">
          <button class="icon-btn mv-up" aria-label="Move ${esc(it.file.name)} earlier">↑</button>
          <button class="icon-btn mv-dn" aria-label="Move ${esc(it.file.name)} later">↓</button>
          <button class="icon-btn rm" aria-label="Remove ${esc(it.file.name)}">✕</button>
        </div>`;
      $('.mv-up', card).addEventListener('click', () => { if (idx > 0){ [items[idx-1], items[idx]] = [items[idx], items[idx-1]]; rebuild(); } });
      $('.mv-dn', card).addEventListener('click', () => { if (idx < items.length - 1){ [items[idx+1], items[idx]] = [items[idx], items[idx+1]]; rebuild(); } });
      $('.rm', card).addEventListener('click', () => {
        card.classList.add('removing');
        setTimeout(() => dz.removeFile(it.file), 200);
      });
      card.addEventListener('dragstart', () => { dragIdx = idx; card.classList.add('dragging'); });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
      card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('drag-over'); });
      card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
      card.addEventListener('drop', e => {
        e.preventDefault(); card.classList.remove('drag-over');
        if (dragIdx === null || dragIdx === idx) return;
        const [m] = items.splice(dragIdx, 1);
        items.splice(idx, 0, m);
        dragIdx = null;
        rebuild();
      });
      list.appendChild(card);
    });
  }

  // Keep preview items in sync with the dropzone's selection.
  function sync(){
    const fs = dz.getFiles();
    items = items.filter(it => {
      const keep = fs.includes(it.file);
      if (!keep) URL.revokeObjectURL(it.url);
      return keep;
    });
    fs.forEach(f => {
      if (items.some(it => it.file === f)) return;
      const it = {file: f, url: URL.createObjectURL(f), w: 0, h: 0};
      items.push(it);
      fileToImage(f)
        .then(({img, url}) => { it.w = img.naturalWidth; it.h = img.naturalHeight; URL.revokeObjectURL(url); rebuild(); })
        .catch(() => { it.w = 0; it.h = 0; rebuild(); });
    });
    rebuild();
  }
  const mo = new MutationObserver(sync);
  mo.observe($('.dz-files', dz.root), {childList:true});
  api.onClose(() => { mo.disconnect(); items.forEach(it => URL.revokeObjectURL(it.url)); });

  $('#clearBtn', actions).onclick = () => api.reset();
  $('#runBtn', actions).onclick = async () => {
    if (!items.length) return toast('Add at least one JPG or PNG image first.', 'info');
    if (items.length > 60) return toast('Please use 60 images or fewer at once.', 'error');
    const setMsg = loading(status, 'Creating your PDF…');
    try {
      needPdfLib();
      const size = $('#j2pSize', ctl).value;
      const orient = $('#j2pOrient', ctl).value;
      const margin = +$('#j2pMargin', ctl).value;
      const fitMode = $('#j2pFit', ctl).value;
      const doc = await PDFLib.PDFDocument.create();
      for (let i = 0; i < items.length; i++){
        setMsg(`Adding image ${i + 1} of ${items.length}…`);
        const it = items[i];
        const buf = await it.file.arrayBuffer();
        const type = (it.file.type || '').toLowerCase();
        let emb;
        try {
          emb = await embedImageDoc(doc, buf, type);
        } catch (err) {
          throw new ToolError(`We couldn't embed “${it.file.name}”. The file may be corrupted — try re-saving it as JPG or PNG.`);
        }
        const iw = emb.width, ih = emb.height;
        let pw, ph;
        if (size === 'fit'){ pw = iw * .75 + margin * 2; ph = ih * .75 + margin * 2; }
        else if (size === 'a4'){ pw = 595.28; ph = 841.89; }
        else { pw = 612; ph = 792; }
        if (orient === 'landscape' && ph > pw) [pw, ph] = [ph, pw];
        if (orient === 'portrait' && pw > ph) [pw, ph] = [ph, pw];
        const page = doc.addPage([pw, ph]);
        const bw = pw - margin * 2, bh = ph - margin * 2;
        let dw, dh;
        if (size === 'fit'){ dw = iw * .75; dh = ih * .75; }
        else if (fitMode === 'fill'){ const s = Math.max(bw / iw, bh / ih); dw = iw * s; dh = ih * s; }
        else if (fitMode === 'stretch'){ dw = bw; dh = bh; }
        else if (fitMode === 'actual'){ dw = Math.min(iw * .75, bw); dh = ih * .75 * (dw / (iw * .75)); }
        else { const s = Math.min(bw / iw, bh / ih); dw = iw * s; dh = ih * s; }
        page.drawImage(emb, {x: margin + (bw - dw) / 2, y: margin + (bh - dh) / 2, width: dw, height: dh});
        await tick();
      }
      setMsg('Almost done…');
      const bytes = await doc.save();
      const blob = new Blob([bytes], {type:'application/pdf'});
      successOut(status, {
        msg: `${items.length} image${items.length === 1 ? '' : 's'} combined into a ${items.length}-page PDF (${humanSize(blob.size)}).`,
        downloads: [{blob, name:'combined-images.pdf', label:'Download PDF'}]
      });
    } catch (e){ errorOut(status, friendly(e), e); }
  };
}

/* ---- Image compressor ---- */
function renderImageCompressor(body, api){
  const dz = dropzone({accept:'image/*', label:'Drop an image to compress'});
  body.appendChild(dz.root);
  const ctl = document.createElement('div');
  ctl.innerHTML = `
    <div class="controls-grid">
      <div class="field range-field"><label>Quality — <span class="range-val" id="qVal">75%</span></label>
        <input type="range" id="qRange" min="10" max="100" value="75" aria-label="Compression quality"></div>
      ${field('Format', `<select id="cFmt"><option value="auto">Keep original</option><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option><option value="image/png">PNG</option></select>`)}
      ${field('Max size', `<select id="cMax"><option value="0">Original</option><option value="3000">3000 px</option><option value="2048">2048 px</option><option value="1600" selected>1600 px</option><option value="1280">1280 px</option></select>`)}
    </div>`;
  body.appendChild(ctl);
  const actions = document.createElement('div');
  actions.className = 'tool-actions';
  actions.innerHTML = `<button class="btn btn-primary" id="runBtn">🗜️ Compress Image</button><button class="btn btn-ghost" id="clearBtn">Clear</button>`;
  body.appendChild(actions);
  const status = statusBox(body);
  $('#qRange', ctl).addEventListener('input', e => $('#qVal', ctl).textContent = e.target.value + '%');
  $('#clearBtn', actions).onclick = () => api.reset();
  $('#runBtn', actions).onclick = async () => {
    const f = dz.getFiles()[0];
    if (!f) return toast('Add an image first.', 'info');
    const setMsg = loading(status, 'Compressing image…');
    try {
      const q = (+$('#qRange', ctl).value) / 100;
      let fmt = $('#cFmt', ctl).value;
      if (fmt === 'auto') fmt = f.type === 'image/png' ? 'image/png' : (f.type === 'image/webp' ? 'image/webp' : 'image/jpeg');
      const maxDim = +$('#cMax', ctl).value || 20000;
      setMsg('Re-encoding…');
      const cv = await drawImageFile(f, maxDim, fmt === 'image/jpeg' ? '#ffffff' : null);
      const blob = await canvasToBlob(cv, fmt, q);
      const ext = fmt.split('/')[1].replace('jpeg', 'jpg');
      const name = `${baseOf(f.name)}-compressed.${ext}`;
      const origUrl = URL.createObjectURL(f), newUrl = URL.createObjectURL(blob);
      api.onClose(() => { URL.revokeObjectURL(origUrl); URL.revokeObjectURL(newUrl); });
      const cmp = compareHTML(f.size, blob.size);
      successOut(status, {
        msg: blob.size < f.size
          ? 'Here is your lighter image — same look, smaller file.'
          : 'The result is not smaller. Try a lower quality or JPEG/WebP format.',
        downloads: [{blob, name, label:'Download Image'}],
        extraHtml: cmp + `
          <div class="duo-preview">
            <figure><img src="${origUrl}" alt="Original image"><figcaption>BEFORE · ${humanSize(f.size)}</figcaption></figure>
            <figure><img src="${newUrl}" alt="Compressed image"><figcaption>AFTER · ${humanSize(blob.size)}</figcaption></figure>
          </div>`
      });
      animateBars(status);
    } catch (e){ errorOut(status, friendly(e), e); }
  };
}

/* ---- Image resizer ---- */
function renderImageResizer(body, api){
  const dz = dropzone({accept:'image/*', label:'Drop an image to resize'});
  body.appendChild(dz.root);
  const ctl = document.createElement('div');
  ctl.innerHTML = `
    <div class="controls-grid">
      ${field('Width (px)', `<input type="number" id="rW" min="1" max="10000" inputmode="numeric">`)}
      ${field('Height (px)', `<input type="number" id="rH" min="1" max="10000" inputmode="numeric">`)}
      ${field('Lock ratio', `<label style="display:flex;align-items:center;gap:8px;min-width:auto;cursor:pointer;text-transform:none;font-size:.88rem"><input type="checkbox" id="rLock" checked> Keep aspect</label>`)}
      ${field('Format', `<select id="rFmt"><option value="auto">Keep original</option><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select>`)}
    </div>
    <div class="seg-row" id="rPresets">
      <button class="seg" data-p="25">25%</button><button class="seg" data-p="50">50%</button>
      <button class="seg" data-p="75">75%</button><button class="seg active" data-p="100">100%</button>
    </div>`;
  body.appendChild(ctl);
  const actions = document.createElement('div');
  actions.className = 'tool-actions';
  actions.innerHTML = `<button class="btn btn-primary" id="runBtn">📐 Resize Image</button><button class="btn btn-ghost" id="clearBtn">Clear</button>`;
  body.appendChild(actions);
  const status = statusBox(body);
  const rW = $('#rW', ctl), rH = $('#rH', ctl);
  let natW = 0, natH = 0, ratio = 1;
  dz.onChange = null;
  const wrap = dz.root;
  const origObserver = async () => {
    const f = dz.getFiles()[0];
    if (!f){ natW = natH = 0; rW.value = rH.value = ''; return; }
    try {
      const {img, url} = await fileToImage(f);
      natW = img.naturalWidth; natH = img.naturalHeight; ratio = natW / natH;
      rW.value = natW; rH.value = natH;
      URL.revokeObjectURL(url);
    } catch {}
  };
  // piggyback on dropzone refresh via a mutation observer (files list changes)
  const mo = new MutationObserver(origObserver);
  mo.observe($('.dz-files', wrap), {childList:true});
  api.onClose(() => mo.disconnect());
  function syncFrom(which){
    if (!$('#rLock', ctl).checked || !natW) return;
    if (which === 'w'){ const w = +rW.value || 0; rH.value = Math.max(1, Math.round(w / ratio)); }
    else { const h = +rH.value || 0; rW.value = Math.max(1, Math.round(h * ratio)); }
  }
  rW.addEventListener('input', () => syncFrom('w'));
  rH.addEventListener('input', () => syncFrom('h'));
  $('#rPresets', ctl).addEventListener('click', e => {
    const b = e.target.closest('[data-p]');
    if (!b || !natW) return;
    $$('.seg', ctl).forEach(s => s.classList.remove('active'));
    b.classList.add('active');
    const p = +b.dataset.p / 100;
    rW.value = Math.max(1, Math.round(natW * p));
    rH.value = Math.max(1, Math.round(natH * p));
  });
  $('#clearBtn', actions).onclick = () => api.reset();
  $('#runBtn', actions).onclick = async () => {
    const f = dz.getFiles()[0];
    if (!f) return toast('Add an image first.', 'info');
    const w = Math.round(+rW.value), h = Math.round(+rH.value);
    if (!w || !h || w < 1 || h < 1 || w > 10000 || h > 10000) return toast('Please enter a width and height between 1 and 10000 px.', 'error');
    const setMsg = loading(status, 'Resizing…');
    try {
      const {img, url} = await fileToImage(f);
      let fmt = $('#rFmt', ctl).value;
      if (fmt === 'auto') fmt = f.type === 'image/png' ? 'image/png' : (f.type === 'image/webp' ? 'image/webp' : 'image/jpeg');
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      if (fmt === 'image/jpeg'){ ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const blob = await canvasToBlob(cv, fmt, .92);
      const ext = fmt.split('/')[1].replace('jpeg', 'jpg');
      setMsg('Almost done…');
      successOut(status, {
        msg: `Resized from ${img.naturalWidth}×${img.naturalHeight} to ${w}×${h} px (${humanSize(blob.size)}).`,
        downloads: [{blob, name:`${baseOf(f.name)}-${w}x${h}.${ext}`, label:'Download Image'}]
      });
    } catch (e){ errorOut(status, friendly(e), e); }
  };
}

/* ---- Image converter ---- */
function renderImageConverter(body, api){
  const dz = dropzone({accept:'image/*', label:'Drop an image to convert'});
  body.appendChild(dz.root);
  const ctl = document.createElement('div');
  ctl.innerHTML = `
    <div class="controls-grid">
      ${field('Convert to', `<select id="vFmt"><option value="image/png">PNG</option><option value="image/jpeg" selected>JPG</option><option value="image/webp">WEBP</option></select>`)}
      <div class="field range-field"><label>Quality — <span class="range-val" id="vVal">92%</span></label>
        <input type="range" id="vRange" min="10" max="100" value="92" aria-label="Output quality"></div>
    </div>`;
  body.appendChild(ctl);
  const actions = document.createElement('div');
  actions.className = 'tool-actions';
  actions.innerHTML = `<button class="btn btn-primary" id="runBtn">🔁 Convert Image</button><button class="btn btn-ghost" id="clearBtn">Clear</button>`;
  body.appendChild(actions);
  const status = statusBox(body);
  $('#vRange', ctl).addEventListener('input', e => $('#vVal', ctl).textContent = e.target.value + '%');
  $('#clearBtn', actions).onclick = () => api.reset();
  $('#runBtn', actions).onclick = async () => {
    const f = dz.getFiles()[0];
    if (!f) return toast('Add an image first.', 'info');
    const setMsg = loading(status, 'Converting…');
    try {
      const fmt = $('#vFmt', ctl).value;
      const q = (+$('#vRange', ctl).value) / 100;
      const cv = await drawImageFile(f, 12000, fmt === 'image/jpeg' ? '#ffffff' : null);
      const blob = await canvasToBlob(cv, fmt, q);
      const ext = fmt.split('/')[1].replace('jpeg', 'jpg');
      successOut(status, {
        msg: `Converted ${extOf(f.name).toUpperCase() || 'image'} → ${ext.toUpperCase()} (${humanSize(blob.size)}).`,
        downloads: [{blob, name:`${baseOf(f.name)}.${ext}`, label:'Download Image'}]
      });
    } catch (e){ errorOut(status, friendly(e), e); }
  };
}

/* ---- Image cropper ---- */
function renderImageCropper(body, api){
  const dz = dropzone({accept:'image/*', label:'Drop an image to crop'});
  body.appendChild(dz.root);
  const ctl = document.createElement('div');
  ctl.innerHTML = `
    <div class="seg-row" id="cAsp">
      <button class="seg active" data-a="0">Free</button><button class="seg" data-a="1">1:1</button>
      <button class="seg" data-a="${4/3}">4:3</button><button class="seg" data-a="${16/9}">16:9</button>
      <button class="seg" data-a="print" style="margin-left:auto">A4 print</button>
    </div>
    <div class="controls-grid">
      ${field('Output format', `<select id="cFmt"><option value="image/png">PNG</option><option value="image/jpeg" selected>JPG</option><option value="image/webp">WebP</option></select>`)}
    </div>
    <div class="crop-stage" id="cStage" hidden>
      <img id="cImg" alt="Image to crop">
      <div class="crop-rect" id="cRect">
        <span class="hd nw" data-h="nw"></span><span class="hd ne" data-h="ne"></span>
        <span class="hd sw" data-h="sw"></span><span class="hd se" data-h="se"></span>
      </div>
    </div>
    <div class="crop-meta" id="cMeta" hidden><span id="cDims">— × — px</span><span style="color:var(--faint)">Drag the box or corners to crop</span></div>`;
  body.appendChild(ctl);
  const actions = document.createElement('div');
  actions.className = 'tool-actions';
  actions.innerHTML = `<button class="btn btn-primary" id="runBtn" disabled>✂️ Crop &amp; Download</button><button class="btn btn-ghost" id="clearBtn">Clear</button>`;
  body.appendChild(actions);
  const status = statusBox(body);

  const stage = $('#cStage', ctl), img = $('#cImg', ctl), rect = $('#cRect', ctl), dims = $('#cDims', ctl), meta = $('#cMeta', ctl), runBtn = $('#runBtn', actions);
  let box = {x:0, y:0, w:0, h:0}, ratio = 0, objUrl = null;

  function paint(){
    rect.style.left = box.x + 'px'; rect.style.top = box.y + 'px';
    rect.style.width = box.w + 'px'; rect.style.height = box.h + 'px';
    const s = img.naturalWidth / (img.clientWidth || 1);
    dims.textContent = `${Math.round(box.w * s)} × ${Math.round(box.h * s)} px`;
  }
  function fitInitial(){
    const iw = img.clientWidth, ih = img.clientHeight;
    const w = iw * .8, h = ratio ? Math.min(w / ratio, ih * .8) : ih * .8;
    box = {x:(iw - w) / 2, y:(ih - h) / 2, w, h: ratio ? w / ratio : h};
    paint();
  }
  function applyResize(mode, dx, dy, b0, iw, ih){
    const L = b0.x, T = b0.y, R = b0.x + b0.w, B = b0.y + b0.h;
    let nL = mode.includes('w') ? Math.min(Math.max(0, L + dx), R - 24) : L;
    let nR = mode.includes('e') ? Math.max(Math.min(iw, R + dx), L + 24) : R;
    let nT = mode.includes('n') ? Math.min(Math.max(0, T + dy), B - 24) : T;
    let nB = mode.includes('s') ? Math.max(Math.min(ih, B + dy), T + 24) : B;
    let w = nR - nL, h = nB - nT;
    if (ratio){
      const vertOnly = (mode === 'n' || mode === 's');
      if (vertOnly){ w = h * ratio; } else { h = w / ratio; }
      const anchorRight = mode.includes('w'), anchorBottom = mode.includes('n');
      const availW = anchorRight ? R : iw - L;
      const availH = anchorBottom ? B : ih - T;
      const k = Math.min(1, availW / w, availH / h);
      w *= k; h *= k;
      nL = anchorRight ? R - w : L;
      nT = anchorBottom ? B - h : T;
      return {x:nL, y:nT, w, h};
    }
    return {x:nL, y:nT, w:nR - nL, h:nB - nT};
  }
  function startPointer(e){
    const target = e.target.closest('[data-h]');
    const mode = target ? target.dataset.h : 'move';
    const iw = img.clientWidth, ih = img.clientHeight, b0 = {...box};
    const sx = e.clientX, sy = e.clientY;
    const move = ev => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (mode === 'move'){
        box.w = b0.w; box.h = b0.h;
        box.x = Math.min(Math.max(b0.x + dx, 0), Math.max(0, iw - b0.w));
        box.y = Math.min(Math.max(b0.y + dy, 0), Math.max(0, ih - b0.h));
      } else {
        box = applyResize(mode, dx, dy, b0, iw, ih);
      }
      paint();
    };
    const up = () => { window.removeEventListener('pointermove', move); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, {once:true});
    e.preventDefault();
  }
  rect.addEventListener('pointerdown', startPointer);

  const mo = new MutationObserver(async () => {
    const f = dz.getFiles()[0];
    if (!f){ stage.hidden = true; meta.hidden = true; runBtn.disabled = true; return; }
    try {
      if (objUrl) URL.revokeObjectURL(objUrl);
      const {img: im, url} = await fileToImage(f);
      objUrl = url;
      api.onClose(() => URL.revokeObjectURL(url));
      img.src = url;
      await img.decode();
      stage.hidden = false; meta.hidden = false; runBtn.disabled = false;
      requestAnimationFrame(fitInitial);
    } catch (err){ toast(friendly(err), 'error'); }
  });
  mo.observe($('.dz-files', dz.root), {childList:true});
  api.onClose(() => mo.disconnect());

  $('#cAsp', ctl).addEventListener('click', e => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    $$('.seg', ctl).forEach(s => s.classList.remove('active'));
    b.classList.add('active');
    const v = b.dataset.a;
    ratio = v === '0' ? 0 : (v === 'print' ? 595.28 / 841.89 : +v);
    if (!stage.hidden) fitInitial();
  });
  $('#clearBtn', actions).onclick = () => api.reset();
  runBtn.onclick = async () => {
    const f = dz.getFiles()[0];
    if (!f || !img.naturalWidth) return toast('Add an image first.', 'info');
    const setMsg = loading(status, 'Cropping…');
    try {
      const s = img.naturalWidth / img.clientWidth;
      const sx = Math.round(box.x * s), sy = Math.round(box.y * s);
      const sw = Math.max(1, Math.round(box.w * s)), sh = Math.max(1, Math.round(box.h * s));
      const cv = document.createElement('canvas');
      cv.width = sw; cv.height = sh;
      const ctx = cv.getContext('2d');
      const fmt = $('#cFmt', ctl).value;
      if (fmt === 'image/jpeg'){ ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, sw, sh); }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const blob = await canvasToBlob(cv, fmt, .92);
      const ext = fmt.split('/')[1].replace('jpeg', 'jpg');
      successOut(status, {
        msg: `Cropped to ${sw}×${sh} px (${humanSize(blob.size)}).`,
        downloads: [{blob, name:`${baseOf(f.name)}-cropped.${ext}`, label:'Download Image'}]
      });
    } catch (e){ errorOut(status, friendly(e), e); }
  };
}

/* ---- Image information ---- */
function renderImageInfo(body, api){
  const dz = dropzone({accept:'image/*', multiple:true, label:'Drop images to inspect'});
  body.appendChild(dz.root);
  const actions = document.createElement('div');
  actions.className = 'tool-actions';
  actions.innerHTML = `<button class="btn btn-primary" id="runBtn">ℹ️ Show Information</button><button class="btn btn-ghost" id="clearBtn">Clear</button>`;
  body.appendChild(actions);
  const status = statusBox(body);
  $('#clearBtn', actions).onclick = () => api.reset();
  $('#runBtn', actions).onclick = async () => {
    const fs = dz.getFiles();
    if (!fs.length) return toast('Add at least one image first.', 'info');
    const setMsg = loading(status, 'Analyzing…');
    status.innerHTML = '';
    const box = document.createElement('div');
    status.appendChild(box);
    for (let i = 0; i < fs.length; i++){
      const f = fs[i];
      setMsg(`Reading image ${i + 1} of ${fs.length}…`);
      try {
        const {img, url} = await fileToImage(f);
        api.onClose(() => URL.revokeObjectURL(url));
        const card = document.createElement('div');
        card.style.marginTop = '14px';
        card.innerHTML = `
          <div class="file-card" style="align-items:flex-start">
            <img src="${url}" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:12px;flex:none">
            <div class="fc-meta">
              <div class="fc-name">${esc(f.name)}</div>
              <div class="fc-sub">${esc(f.type || 'unknown')} · ${humanSize(f.size)}</div>
            </div>
          </div>
          <div class="stat-grid">
            <div class="stat-tile"><b>${img.naturalWidth}×${img.naturalHeight}</b><span>Dimensions</span></div>
            <div class="stat-tile"><b>${esc(extOf(f.name).toUpperCase() || '—')}</b><span>Format</span></div>
            <div class="stat-tile"><b>${humanSize(f.size)}</b><span>File size</span></div>
            <div class="stat-tile"><b>${(img.naturalWidth * img.naturalHeight / 1e6).toFixed(1)} MP</b><span>Megapixels</span></div>
          </div>`;
        box.appendChild(card);
      } catch (e){
        const card = document.createElement('div');
        card.className = 'panel-err';
        card.style.marginTop = '14px';
        card.innerHTML = `<span>⚠️</span><div><b>${esc(f.name)}</b><p>${esc(friendly(e))}</p></div>`;
        box.appendChild(card);
      }
      await tick();
    }
  };
}

/* ---- Merge PDF ---- */
function renderMergePdf(body, api){
  const dz = dropzone({accept:'.pdf', multiple:true, orderable:true, label:'Drop your PDF files here'});
  body.appendChild(dz.root);
  const sum = document.createElement('div');
  sum.className = 'dz-count'; sum.hidden = true;
  body.appendChild(sum);
  const actions = document.createElement('div');
  actions.className = 'tool-actions';
  actions.innerHTML = `<button class="btn btn-primary" id="runBtn">📚 Merge PDFs</button><button class="btn btn-ghost" id="clearBtn">Clear</button>`;
  body.appendChild(actions);
  const status = statusBox(body);
  const mo = new MutationObserver(async () => {
    const fs = dz.getFiles();
    if (!fs.length){ sum.hidden = true; return; }
    let total = 0, ok = true;
    for (const f of fs){
      if (f.__pages != null){ total += f.__pages; continue; }
      try { f.__pages = await pdfPageCount(f); total += f.__pages; }
      catch { f.__pages = 0; ok = false; }
    }
    sum.hidden = false;
    sum.textContent = `${fs.length} file${fs.length === 1 ? '' : 's'} · ${total} pages total${ok ? '' : ' · ⚠ some files could not be read'}`;
  });
  mo.observe($('.dz-files', dz.root), {childList:true});
  api.onClose(() => mo.disconnect());
  $('#clearBtn', actions).onclick = () => api.reset();
  $('#runBtn', actions).onclick = async () => {
    const fs = dz.getFiles();
    if (fs.length < 2) return toast('Add at least two PDF files to merge.', 'info');
    const setMsg = loading(status, 'Merging PDFs…');
    try {
      needPdfLib();
      const out = await PDFLib.PDFDocument.create();
      let total = 0;
      for (let i = 0; i < fs.length; i++){
        setMsg(`Merging file ${i + 1} of ${fs.length}…`);
        const src = await pdfLoad(await fs[i].arrayBuffer());
        const idx = [...Array(src.getPageCount()).keys()];
        const pages = await out.copyPages(src, idx);
        pages.forEach(p => out.addPage(p));
        total += idx.length;
        await tick();
      }
      setMsg('Almost done…');
      const bytes = await out.save();
      const blob = new Blob([bytes], {type:'application/pdf'});
      successOut(status, {
        msg: `${fs.length} PDFs merged into one ${total}-page document (${humanSize(blob.size)}).`,
        downloads: [{blob, name:'merged-document.pdf', label:'Download PDF'}]
      });
    } catch (e){ errorOut(status, friendly(e), e); }
  };
}

/* ---- Split PDF ---- */
function renderSplitPdf(body, api){
  const dz = dropzone({accept:'.pdf', label:'Drop a PDF to split'});
  body.appendChild(dz.root);
  const info = document.createElement('div');
  info.className = 'dz-count'; info.hidden = true;
  body.appendChild(info);
  const ctl = document.createElement('div');
  ctl.innerHTML = `
    <div class="controls-grid">
      ${field('Pages to extract', `<input type="text" id="sRange" placeholder="e.g. 1-3, 5, 8-10" style="min-width:230px">`)}
    </div>
    <div class="seg-row">
      <button class="seg" id="sOdd">Odd pages</button><button class="seg" id="sEven">Even pages</button>
    </div>
    <p class="tool-note">💡 The selected pages will be saved as a brand-new PDF — your original file is never changed.</p>`;
  body.appendChild(ctl);
  const actions = document.createElement('div');
  actions.className = 'tool-actions';
  actions.innerHTML = `<button class="btn btn-primary" id="runBtn">✂️ Extract Pages</button><button class="btn btn-ghost" id="clearBtn">Clear</button>`;
  body.appendChild(actions);
  const status = statusBox(body);
  let count = 0;
  const mo = new MutationObserver(async () => {
    const f = dz.getFiles()[0];
    if (!f){ info.hidden = true; count = 0; return; }
    try { count = await pdfPageCount(f); info.hidden = false; info.textContent = `📄 This PDF has ${count} page${count === 1 ? '' : 's'}.`; }
    catch { info.hidden = false; info.textContent = '⚠ This file could not be read as a PDF.'; count = 0; }
  });
  mo.observe($('.dz-files', dz.root), {childList:true});
  api.onClose(() => mo.disconnect());
  $('#sOdd', ctl).onclick = () => { if (count) $('#sRange', ctl).value = '1-' + count && [...Array(count).keys()].filter(i => i % 2 === 0).map(i => i + 1).join(','); };
  $('#sEven', ctl).onclick = () => { if (count) $('#sRange', ctl).value = [...Array(count).keys()].filter(i => i % 2 === 1).map(i => i + 1).join(','); };
  $('#clearBtn', actions).onclick = () => api.reset();
  $('#runBtn', actions).onclick = async () => {
    const f = dz.getFiles()[0];
    if (!f) return toast('Add a PDF first.', 'info');
    const setMsg = loading(status, 'Extracting pages…');
    try {
      if (!count) count = await pdfPageCount(f);
      const pages = parseRanges($('#sRange', ctl).value, count);
      const bytes = await buildPdfFromPages(await f.arrayBuffer(), pages.map(p => p - 1));
      const blob = new Blob([bytes], {type:'application/pdf'});
      successOut(status, {
        msg: `Extracted ${pages.length} page${pages.length === 1 ? '' : 's'} (${humanSize(blob.size)}).`,
        downloads: [{blob, name:'extracted-pages.pdf', label:'Download PDF'}]
      });
    } catch (e){ errorOut(status, friendly(e), e); }
  };
}

/* ---- PDF → Images ---- */
function renderPdfToImages(body, api){
  const dz = dropzone({accept:'.pdf', label:'Drop a PDF to convert'});
  body.appendChild(dz.root);
  const ctl = document.createElement('div');
  ctl.innerHTML = `
    <div class="controls-grid">
      ${field('Image format', `<select id="piFmt"><option value="image/jpeg" selected>JPG</option><option value="image/png">PNG</option></select>`)}
      ${field('Resolution', `<select id="piScale"><option value="1">Standard (1×)</option><option value="1.5" selected>High (1.5×)</option><option value="2">Ultra (2×)</option></select>`)}
    </div>`;
  body.appendChild(ctl);
  const actions = document.createElement('div');
  actions.className = 'tool-actions';
  actions.innerHTML = `<button class="btn btn-primary" id="runBtn">🎞️ Convert to Images</button><button class="btn btn-ghost" id="clearBtn">Clear</button>`;
  body.appendChild(actions);
  const status = statusBox(body);
  $('#clearBtn', actions).onclick = () => api.reset();
  $('#runBtn', actions).onclick = async () => {
    const f = dz.getFiles()[0];
    if (!f) return toast('Add a PDF first.', 'info');
    const setMsg = loading(status, 'Reading PDF…');
    status.innerHTML = '';
    try {
      needPdfJs();
      const buf = await f.arrayBuffer();
      let pdf;
      try { pdf = await pdfjsLib.getDocument({data: buf.slice(0)}).promise; }
      catch { throw new ToolError('This PDF could not be read. It may be corrupted or protected.'); }
      const total = pdf.numPages;
      const cap = Math.min(total, 60);
      if (total > cap) toast(`This PDF has ${total} pages — converting the first ${cap} to keep your browser fast.`, 'info');
      const fmt = $('#piFmt', ctl).value;
      const scale = +$('#piScale', ctl).value;
      const ext = fmt === 'image/png' ? 'png' : 'jpg';
      const base = baseOf(f.name) || 'page';
      const results = [];
      const grid = document.createElement('div');
      grid.className = 'thumb-grid';
      status.appendChild(grid);
      for (let i = 1; i <= cap; i++){
        setMsg(`Rendering page ${i} of ${cap}…`);
        const pg = await pdf.getPage(i);
        const vp = pg.getViewport({scale});
        const cv = document.createElement('canvas');
        cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
        await pg.render({canvasContext: cv.getContext('2d'), viewport: vp}).promise;
        const blob = await canvasToBlob(cv, fmt, .92);
        const name = `${base}-page-${String(i).padStart(2, '0')}.${ext}`;
        results.push({blob, name});
        const cell = document.createElement('div');
        cell.className = 'thumb';
        cell.appendChild(cv);
        cell.insertAdjacentHTML('beforeend', `<button class="thumb-page-dl">⬇ Page ${i} · ${humanSize(blob.size)}</button>`);
        $('.thumb-page-dl', cell).addEventListener('click', () => { downloadBlob(blob, name); toast(`Downloading “${name}”`, 'success'); });
        grid.appendChild(cell);
        await tick();
      }
      try { pdf.destroy(); } catch {}
      const dlAll = document.createElement('div');
      dlAll.style.cssText = 'margin-top:16px;display:flex;gap:12px;flex-wrap:wrap';
      dlAll.innerHTML = `<button class="btn btn-primary" id="dlAll">⬇ Download All ${cap} Images</button>`;
      status.appendChild(dlAll);
      $('#dlAll', dlAll).addEventListener('click', async () => {
        toast('Starting downloads — your browser may ask permission for multiple files.', 'info');
        await downloadMany(results);
      });
    } catch (e){ status.innerHTML = ''; errorOut(status, friendly(e), e); }
  };
}

/* ---- PDF → JPG / PNG (NEW — with page detection, previews & ZIP export) ---- */
function renderPdfToJpgPng(body, api){
  const dz = dropzone({accept:'.pdf', label:'Drop a PDF to convert to JPG / PNG'});
  body.appendChild(dz.root);

  const info = document.createElement('div');
  info.className = 'dz-count'; info.hidden = true;
  body.appendChild(info);

  const ctl = document.createElement('div');
  ctl.innerHTML = `
    <div class="controls-grid">
      ${field('Image format', `<select id="pjFmt"><option value="image/jpeg" selected>JPG</option><option value="image/png">PNG</option></select>`)}
      <div class="field range-field" id="pjQWrap"><label>Quality — <span class="range-val" id="pjQ">90%</span></label>
        <input type="range" id="pjRange" min="30" max="100" value="90" aria-label="JPG quality"></div>
      ${field('Resolution', `<select id="pjScale"><option value="1">Standard (1×)</option><option value="1.5" selected>High (1.5×)</option><option value="2">Ultra (2×)</option><option value="3">Max (3×)</option></select>`)}
    </div>
    <p class="tool-note">💡 The quality slider applies to JPG. PNG is always lossless. Every page becomes its own image file.</p>`;
  body.appendChild(ctl);

  const actions = document.createElement('div');
  actions.className = 'tool-actions';
  actions.innerHTML = `<button class="btn btn-primary" id="runBtn">🏞️ Convert to Images</button><button class="btn btn-ghost" id="clearBtn">Clear</button>`;
  body.appendChild(actions);
  const status = statusBox(body);

  $('#pjRange', ctl).addEventListener('input', e => $('#pjQ', ctl).textContent = e.target.value + '%');
  $('#pjFmt', ctl).addEventListener('change', e => {
    const jpg = e.target.value === 'image/jpeg';
    $('#pjQWrap', ctl).style.opacity = jpg ? '1' : '.4';
    $('#pjRange', ctl).disabled = !jpg;
  });

  // Show filename, size and detected page count as soon as a PDF is selected.
  let pageCount = 0;
  const mo = new MutationObserver(async () => {
    const f = dz.getFiles()[0];
    if (!f){ info.hidden = true; pageCount = 0; return; }
    info.hidden = false;
    info.textContent = `⏳ Reading “${f.name}” (${humanSize(f.size)})…`;
    try {
      pageCount = await pdfPageCount(f);
      info.textContent = `📄 “${f.name}” · ${humanSize(f.size)} · ${pageCount} page${pageCount === 1 ? '' : 's'} detected`;
    } catch {
      pageCount = 0;
      info.textContent = '⚠ This file could not be read as a PDF.';
    }
  });
  mo.observe($('.dz-files', dz.root), {childList:true});
  api.onClose(() => mo.disconnect());

  $('#clearBtn', actions).onclick = () => api.reset();
  $('#runBtn', actions).onclick = async () => {
    const f = dz.getFiles()[0];
    if (!f) return toast('Add a PDF first.', 'info');
    const setMsg = loading(status, 'Reading PDF…');
    status.innerHTML = '';
    try {
      needPdfJs();
      const buf = await f.arrayBuffer();
      let pdf;
      try { pdf = await pdfjsLib.getDocument({data: buf.slice(0)}).promise; }
      catch { throw new ToolError('This PDF could not be read. It may be corrupted or protected.'); }
      const total = pdf.numPages;
      const cap = Math.min(total, 60);
      if (total > cap) toast(`This PDF has ${total} pages — converting the first ${cap} to keep your browser fast.`, 'info');
      const fmt = $('#pjFmt', ctl).value;
      const quality = (+$('#pjRange', ctl).value) / 100;
      const scale = +$('#pjScale', ctl).value;
      const ext = fmt === 'image/png' ? 'png' : 'jpg';
      const base = baseOf(f.name) || 'document';
      const results = [];
      const grid = document.createElement('div');
      grid.className = 'thumb-grid';
      status.appendChild(grid);
      for (let i = 1; i <= cap; i++){
        setMsg(`Converting page ${i} of ${cap}…`);
        const pg = await pdf.getPage(i);
        const vp = pg.getViewport({scale});
        const cv = document.createElement('canvas');
        cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
        await pg.render({canvasContext: cv.getContext('2d'), viewport: vp}).promise;
        const blob = await canvasToBlob(cv, fmt, quality);
        const name = `${base}-page-${i}.${ext}`;
        results.push({blob, name});
        const cell = document.createElement('div');
        cell.className = 'thumb';
        cell.appendChild(cv);
        cell.insertAdjacentHTML('beforeend', `<button class="thumb-page-dl">⬇ ${esc(name)} · ${humanSize(blob.size)}</button>`);
        $('.thumb-page-dl', cell).addEventListener('click', () => { downloadBlob(blob, name); toast(`Downloading “${name}”`, 'success'); });
        grid.appendChild(cell);
        await tick();
      }
      try { pdf.destroy(); } catch {}

      // Download bar: ZIP (built fully in the browser via JSZip) or individual downloads.
      const bar = document.createElement('div');
      bar.style.cssText = 'margin-top:16px;display:flex;gap:12px;flex-wrap:wrap;align-items:center';
      bar.innerHTML = `
        <button class="btn btn-primary" id="dlZip">📦 Download ZIP (${cap} image${cap === 1 ? '' : 's'})</button>
        <button class="btn btn-ghost" id="dlEach">⬇ Download Individually</button>`;
      status.appendChild(bar);
      status.insertAdjacentHTML('beforeend', `<p class="tool-note">🔒 The ZIP is generated entirely on your device — nothing is uploaded.</p>`);

      $('#dlZip', bar).addEventListener('click', async () => {
        if (!window.JSZip){
          toast('ZIP engine not loaded — downloading images one by one instead.', 'info');
          await downloadMany(results);
          return;
        }
        const zipBtn = $('#dlZip', bar);
        zipBtn.disabled = true;
        zipBtn.textContent = 'Packing… 0%';
        try {
          const zip = new JSZip();
          results.forEach(r => zip.file(r.name, r.blob));
          const blob = await zip.generateAsync({type:'blob'}, meta => {
            zipBtn.textContent = `Packing… ${Math.round(meta.percent)}%`;
          });
          zipBtn.disabled = false;
          zipBtn.textContent = `📦 Download ZIP (${cap} image${cap === 1 ? '' : 's'})`;
          downloadBlob(blob, `${base}-pages.zip`);
          toast(`ZIP downloaded (${humanSize(blob.size)}) — built 100% in your browser.`, 'success');
        } catch (e){
          zipBtn.disabled = false;
          zipBtn.textContent = `📦 Download ZIP (${cap} image${cap === 1 ? '' : 's'})`;
          toast('ZIP packing failed — try downloading individually instead.', 'error');
        }
      });
      $('#dlEach', bar).addEventListener('click', async () => {
        toast('Starting downloads — your browser may ask permission for multiple files.', 'info');
        await downloadMany(results);
      });
    } catch (e){ status.innerHTML = ''; errorOut(status, friendly(e), e); }
  };
}

/* ---- PDF Text Extractor ---- */
function renderPdfTextExtractor(body, api){
  const dz = dropzone({accept:'.pdf', label:'Drop a PDF to extract text'});
  body.appendChild(dz.root);
  const note = document.createElement('p');
  note.className = 'tool-note';
  note.textContent = '📄 Extracts selectable text from each PDF page and downloads it as a TXT file. Scanned images may not yield readable text.';
  body.appendChild(note);
  const actions = document.createElement('div');
  actions.className = 'tool-actions';
  actions.innerHTML = `<button class="btn btn-primary" id="runBtn">📝 Extract Text</button><button class="btn btn-ghost" id="clearBtn">Clear</button>`;
  body.appendChild(actions);
  const status = statusBox(body);

  $('#clearBtn', actions).onclick = () => api.reset();
  $('#runBtn', actions).onclick = async () => {
    const f = dz.getFiles()[0];
    if (!f) return toast('Add a PDF first.', 'info');
    const setMsg = loading(status, 'Extracting text…');
    try {
      needPdfJs();
      const text = await extractPdfText(await f.arrayBuffer(), (page, total) => setMsg(`Reading page ${page} of ${total}…`));
      const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
      successOut(status, {
        msg: `Extracted text from ${f.name} and packaged it as a TXT file (${humanSize(blob.size)}).`,
        downloads: [{blob, name:`${baseOf(f.name) || 'document'}-text.txt`, label:'Download TXT'}]
      });
    } catch (e){ errorOut(status, friendly(e), e); }
  };
}

async function extractPdfText(buf, onProgress){
  needPdfJs();
  let pdf;
  try { pdf = await pdfjsLib.getDocument({data: buf.slice(0)}).promise; }
  catch { throw new ToolError('This PDF could not be read. It may be corrupted or protected.'); }
  const total = pdf.numPages;
  const pages = [];
  try {
    for (let i = 1; i <= total; i++){
      if (onProgress) onProgress(i, total);
      const pg = await pdf.getPage(i);
      const content = await pg.getTextContent();
      const text = content.items.map(item => item.str).join(' ');
      pages.push(`--- Page ${i} ---\n${text}`);
      await tick();
    }
  } finally { try { pdf.destroy(); } catch {} }
  return pages.join('\n\n');
}

/* ---- Compress PDF ---- */
function renderCompressPdf(body, api){
  const dz = dropzone({accept:'.pdf', label:'Drop a PDF to compress'});
  body.appendChild(dz.root);
  const ctl = document.createElement('div');
  ctl.innerHTML = `
    <div class="controls-grid">
      <div class="field range-field"><label>Quality — <span class="range-val" id="cpQ">60%</span></label>
        <input type="range" id="cpRange" min="20" max="90" value="60" aria-label="PDF quality"></div>
      ${field('Render scale', `<select id="cpScale"><option value="0.75">Light (0.75×)</option><option value="1" selected>Normal (1×)</option><option value="1.5">Sharp (1.5×)</option></select>`)}
    </div>
    <p class="tool-note">💡 Compression re-renders each page as an optimized image. Great for scanned notes and slide exports.</p>`;
  body.appendChild(ctl);
  const actions = document.createElement('div');
  actions.className = 'tool-actions';
  actions.innerHTML = `<button class="btn btn-primary" id="runBtn">🗜️ Compress PDF</button><button class="btn btn-ghost" id="clearBtn">Clear</button>`;
  body.appendChild(actions);
  const status = statusBox(body);
  $('#cpRange', ctl).addEventListener('input', e => $('#cpQ', ctl).textContent = e.target.value + '%');
  $('#clearBtn', actions).onclick = () => api.reset();
  $('#runBtn', actions).onclick = async () => {
    const f = dz.getFiles()[0];
    if (!f) return toast('Add a PDF first.', 'info');
    const setMsg = loading(status, 'Compressing PDF…');
    try {
      const q = (+$('#cpRange', ctl).value) / 100;
      const scale = +$('#cpScale', ctl).value;
      const bytes = await compressPdfBytes(await f.arrayBuffer(), q, scale, m => setMsg(m));
      const blob = new Blob([bytes], {type:'application/pdf'});
      const cmp = compareHTML(f.size, blob.size);
      successOut(status, {
        msg: blob.size < f.size
          ? 'Your lighter PDF is ready.'
          : 'The result is not smaller — try lower quality or the “Light” render scale.',
        downloads: [{blob, name:'compressed-document.pdf', label:'Download PDF'}],
        extraHtml: cmp
      });
      animateBars(status);
    } catch (e){ errorOut(status, friendly(e), e); }
  };
}

/* ---- Remove PDF pages ---- */
function renderRemovePages(body, api){
  const dz = dropzone({accept:'.pdf', label:'Drop a PDF to edit'});
  body.appendChild(dz.root);
  const hint = document.createElement('p');
  hint.className = 'tool-note';
  hint.textContent = '👆 Click a page to mark it for removal, then apply.';
  body.appendChild(hint);
  const counter = document.createElement('div');
  counter.className = 'dz-count'; counter.hidden = true;
  body.appendChild(counter);
  const gridWrap = document.createElement('div');
  gridWrap.className = 'thumb-grid';
  body.appendChild(gridWrap);
  const actions = document.createElement('div');
  actions.className = 'tool-actions';
  actions.innerHTML = `<button class="btn btn-primary" id="runBtn" disabled>🗑️ Remove Selected Pages</button><button class="btn btn-ghost" id="clearBtn">Clear</button>`;
  body.appendChild(actions);
  const status = statusBox(body);
  let buf = null, items = [], removed = new Set();
  function updateCounter(){
    counter.hidden = false;
    counter.textContent = removed.size ? `${removed.size} page${removed.size === 1 ? '' : 's'} selected for removal` : 'No pages selected yet';
    $('#runBtn', actions).disabled = removed.size === 0 || removed.size === items.length;
  }
  const mo = new MutationObserver(async () => {
    const f = dz.getFiles()[0];
    gridWrap.innerHTML = ''; removed.clear(); items = []; buf = null; counter.hidden = true; $('#runBtn', actions).disabled = true;
    if (!f) return;
    const setMsg = loading(status, 'Loading page previews…');
    try {
      buf = await f.arrayBuffer();
      const res = await renderPdfThumbs(buf, {maxW:160, maxPages:100, onProgress:(i, t) => setMsg(`Rendering preview ${i} of ${Math.min(t, 100)}…`)});
      if (res.truncated) toast('Showing the first 100 pages for editing.', 'info');
      items = res.items;
      status.innerHTML = '';
      items.forEach(it => {
        const cell = document.createElement('div');
        cell.className = 'thumb selectable';
        cell.setAttribute('role', 'button');
        cell.setAttribute('tabindex', '0');
        cell.setAttribute('aria-pressed', 'false');
        cell.appendChild(it.canvas);
        cell.insertAdjacentHTML('beforeend', `<div class="th-bar"><span>Page ${it.page}</span></div>`);
        const toggle = () => {
          if (removed.has(it.page)) removed.delete(it.page); else removed.add(it.page);
          cell.classList.toggle('removed', removed.has(it.page));
          cell.setAttribute('aria-pressed', String(removed.has(it.page)));
          updateCounter();
        };
        cell.addEventListener('click', toggle);
        cell.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggle(); } });
        gridWrap.appendChild(cell);
      });
      updateCounter();
    } catch (e){ status.innerHTML = ''; errorOut(status, friendly(e), e); }
  });
  mo.observe($('.dz-files', dz.root), {childList:true});
  api.onClose(() => mo.disconnect());
  $('#clearBtn', actions).onclick = () => api.reset();
  $('#runBtn', actions).onclick = async () => {
    if (!buf || !items.length) return;
    if (removed.size >= items.length) return toast('You cannot remove every page.', 'error');
    const setMsg = loading(status, 'Rebuilding PDF…');
    try {
      const keep = items.map(it => it.page - 1).filter(i => !removed.has(i + 1));
      const bytes = await buildPdfFromPages(buf, keep);
      const blob = new Blob([bytes], {type:'application/pdf'});
      successOut(status, {
        msg: `Removed ${removed.size} page${removed.size === 1 ? '' : 's'} — ${keep.length} page${keep.length === 1 ? '' : 's'} remain (${humanSize(blob.size)}).`,
        downloads: [{blob, name:'edited-document.pdf', label:'Download PDF'}]
      });
    } catch (e){ errorOut(status, friendly(e), e); }
  };
}

/* ---- Rearrange PDF pages ---- */
function renderRearrangePdf(body, api){
  const dz = dropzone({accept:'.pdf', label:'Drop a PDF to reorder'});
  body.appendChild(dz.root);
  const hint = document.createElement('p');
  hint.className = 'tool-note';
  hint.textContent = '👆 Drag pages into the order you want, or use the ← → buttons.';
  body.appendChild(hint);
  const gridWrap = document.createElement('div');
  gridWrap.className = 'thumb-grid';
  body.appendChild(gridWrap);
  const actions = document.createElement('div');
  actions.className = 'tool-actions';
  actions.innerHTML = `<button class="btn btn-primary" id="runBtn" disabled>🔀 Apply Order</button><button class="btn btn-ghost" id="clearBtn">Clear</button>`;
  body.appendChild(actions);
  const status = statusBox(body);
  let buf = null, order = [], dragIdx = null;
  function rebuildGrid(){
    gridWrap.innerHTML = '';
    order.forEach((pageNo, idx) => {
      const cell = document.createElement('div');
      cell.className = 'thumb';
      cell.draggable = true;
      cell.dataset.idx = idx;
      const cv = orderCanvases.get(pageNo);
      if (cv) cell.appendChild(cv);
      cell.insertAdjacentHTML('beforeend', `
        <div class="th-bar"><span>Page ${pageNo} · #${idx + 1}</span>
        <span class="th-acts"><button data-mv="-1" aria-label="Move left">←</button><button data-mv="1" aria-label="Move right">→</button></span></div>`);
      cell.addEventListener('dragstart', () => { dragIdx = idx; });
      cell.addEventListener('dragover', e => { e.preventDefault(); cell.classList.add('drag-over'); });
      cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
      cell.addEventListener('drop', e => {
        e.preventDefault(); cell.classList.remove('drag-over');
        if (dragIdx === null || dragIdx === idx) return;
        const [m] = order.splice(dragIdx, 1);
        order.splice(idx, 0, m);
        dragIdx = null; rebuildGrid();
      });
      $$('.th-acts button', cell).forEach(b => b.addEventListener('click', () => {
        const d = +b.dataset.mv, j = idx + d;
        if (j < 0 || j >= order.length) return;
        [order[idx], order[j]] = [order[j], order[idx]];
        rebuildGrid();
      }));
      gridWrap.appendChild(cell);
    });
  }
  let orderCanvases = new Map();
  const mo = new MutationObserver(async () => {
    const f = dz.getFiles()[0];
    gridWrap.innerHTML = ''; order = []; orderCanvases.clear(); buf = null; $('#runBtn', actions).disabled = true;
    if (!f) return;
    const setMsg = loading(status, 'Loading pages…');
    try {
      buf = await f.arrayBuffer();
      const res = await renderPdfThumbs(buf, {maxW:150, maxPages:100, onProgress:(i, t) => setMsg(`Rendering preview ${i} of ${Math.min(t, 100)}…`)});
      if (res.truncated) toast('Showing the first 100 pages for reordering.', 'info');
      status.innerHTML = '';
      order = res.items.map(it => it.page);
      res.items.forEach(it => orderCanvases.set(it.page, it.canvas));
      rebuildGrid();
      $('#runBtn', actions).disabled = false;
    } catch (e){ status.innerHTML = ''; errorOut(status, friendly(e)); }
  });
  mo.observe($('.dz-files', dz.root), {childList:true});
  api.onClose(() => mo.disconnect());
  $('#clearBtn', actions).onclick = () => api.reset();
  $('#runBtn', actions).onclick = async () => {
    if (!buf || order.length < 2) return;
    const setMsg = loading(status, 'Applying new order…');
    try {
      const bytes = await buildPdfFromPages(buf, order.map(p => p - 1));
      const blob = new Blob([bytes], {type:'application/pdf'});
      successOut(status, {
        msg: `All ${order.length} pages saved in your new order (${humanSize(blob.size)}).`,
        downloads: [{blob, name:'reordered-document.pdf', label:'Download PDF'}]
      });
    } catch (e){ errorOut(status, friendly(e), e); }
  };
}

/* ---- PDF page counter ---- */
function renderPageCounter(body, api){
  const dz = dropzone({accept:'.pdf', label:'Drop a PDF to count its pages'});
  body.appendChild(dz.root);
  const actions = document.createElement('div');
  actions.className = 'tool-actions';
  actions.innerHTML = `<button class="btn btn-primary" id="runBtn">🔢 Count Pages</button><button class="btn btn-ghost" id="clearBtn">Clear</button>`;
  body.appendChild(actions);
  const status = statusBox(body);
  $('#clearBtn', actions).onclick = () => api.reset();
  $('#runBtn', actions).onclick = async () => {
    const f = dz.getFiles()[0];
    if (!f) return toast('Add a PDF first.', 'info');
    loading(status, 'Counting pages…');
    try {
      const doc = await pdfLoad(await f.arrayBuffer());
      const n = doc.getPageCount();
      let title = '';
      try { title = doc.getTitle() || ''; } catch {}
      status.innerHTML = `
        <div class="success-box">
          <div class="stat-grid" style="max-width:460px;margin:0 auto 18px">
            <div class="stat-tile"><b>${n}</b><span>Page${n === 1 ? '' : 's'}</span></div>
            <div class="stat-tile"><b>${humanSize(f.size)}</b><span>File size</span></div>
          </div>
          <h3>${esc(f.name)}</h3>
          <p>${title ? 'Title: “' + esc(title) + '” · ' : ''}Counted instantly, right on your device.</p>
        </div>`;
    } catch (e){ errorOut(status, friendly(e), e); }
  };
}

/* ---- File renamer ---- */
function renderFileRenamer(body, api){
  const dz = dropzone({multiple:true, renameable:true, label:'Drop files to rename'});
  body.appendChild(dz.root);
  const actions = document.createElement('div');
  actions.className = 'tool-actions';
  actions.innerHTML = `<button class="btn btn-primary" id="runBtn">⬇ Download All (renamed)</button><button class="btn btn-ghost" id="clearBtn">Clear</button>`;
  body.appendChild(actions);
  const status = statusBox(body);
  body.insertAdjacentHTML('beforeend', `<p class="tool-note">🔒 Renaming happens only when you download a copy — your original files are never changed.</p>`);
  $('#clearBtn', actions).onclick = () => api.reset();
  $('#runBtn', actions).onclick = async () => {
    const fs = dz.getFiles();
    if (!fs.length) return toast('Add at least one file first.', 'info');
    const items = fs.map(f => ({blob: f, name: sanitizeName(f.__svName || f.name)}));
    toast(`Downloading ${items.length} file${items.length === 1 ? '' : 's'} — your browser may ask permission for multiple downloads.`, 'info');
    await downloadMany(items);
    successOut(status, {title:'Ready!', msg:`${items.length} renamed file${items.length === 1 ? '' : 's'} sent to your downloads.`});
  };
}

/* ---- File size analyzer ---- */
function renderSizeAnalyzer(body, api){
  const dz = dropzone({multiple:true, label:'Drop files to measure'});
  body.appendChild(dz.root);
  const actions = document.createElement('div');
  actions.className = 'tool-actions';
  actions.innerHTML = `<button class="btn btn-primary" id="runBtn">⚖️ Analyze Sizes</button><button class="btn btn-ghost" id="clearBtn">Clear</button>`;
  body.appendChild(actions);
  const status = statusBox(body);
  $('#clearBtn', actions).onclick = () => api.reset();
  $('#runBtn', actions).onclick = async () => {
    const fs = dz.getFiles();
    if (!fs.length) return toast('Add at least one file first.', 'info');
    const sorted = [...fs].sort((a, b) => b.size - a.size);
    const max = Math.max(...sorted.map(f => f.size), 1);
    const total = fs.reduce((a, f) => a + f.size, 0);
    status.innerHTML = `
      <div class="stat-grid" style="max-width:340px">
        <div class="stat-tile"><b>${fs.length}</b><span>Files</span></div>
        <div class="stat-tile"><b>${humanSize(total)}</b><span>Total size</span></div>
      </div>
      <div style="margin-top:18px">
        ${sorted.map(f => `
          <div class="sz-row">
            <div class="sz-top"><span class="sz-name">${esc(f.name)}</span><b>${humanSize(f.size)}</b></div>
            <div class="bar new"><i data-w="${Math.max(2, f.size / max * 100).toFixed(1)}"></i></div>
          </div>`).join('')}
      </div>
      <p class="tool-note">Largest file: <b style="color:var(--text)">${esc(sorted[0].name)}</b> (${humanSize(sorted[0].size)})</p>`;
    animateBars(status);
  };
}

/* ---- Duplicate detector ---- */
async function hashFile(file){
  const buf = await file.arrayBuffer();
  if (window.crypto && crypto.subtle){
    const d = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // FNV-1a fallback for very old browsers
  const v = new Uint8Array(buf);
  let h1 = 0x811c9dc5, h2 = 0xcbf29ce4;
  for (let i = 0; i < v.length; i++){
    h1 = Math.imul(h1 ^ v[i], 0x01000193) >>> 0;
    h2 = Math.imul((h2 + v[i]) >>> 0, 0x85ebca6b) >>> 0;
  }
  return `fnv-${h1.toString(16)}-${h2.toString(16)}-${file.size}`;
}
function renderDuplicateDetector(body, api){
  const dz = dropzone({multiple:true, label:'Drop files to check for duplicates'});
  body.appendChild(dz.root);
  const actions = document.createElement('div');
  actions.className = 'tool-actions';
  actions.innerHTML = `<button class="btn btn-primary" id="runBtn">👥 Detect Duplicates</button><button class="btn btn-ghost" id="clearBtn">Clear</button>`;
  body.appendChild(actions);
  const status = statusBox(body);
  $('#clearBtn', actions).onclick = () => api.reset();
  $('#runBtn', actions).onclick = async () => {
    const fs = dz.getFiles();
    if (fs.length < 2) return toast('Add at least two files to compare.', 'info');
    const setMsg = loading(status, 'Hashing files…');
    try {
      const groups = new Map();
      for (let i = 0; i < fs.length; i++){
        setMsg(`Fingerprinting file ${i + 1} of ${fs.length}…`);
        const h = await hashFile(fs[i]) + ':' + fs[i].size;
        if (!groups.has(h)) groups.set(h, []);
        groups.get(h).push(fs[i]);
        await tick();
      }
      const dups = [...groups.values()].filter(g => g.length > 1);
      const wasted = dups.reduce((a, g) => a + g.slice(1).reduce((x, f) => x + f.size, 0), 0);
      if (!dups.length){
        successOut(status, {title:'No duplicates found', msg:`All ${fs.length} files are unique. 🎉`});
        return;
      }
      status.innerHTML = `
        <div class="stat-grid" style="max-width:560px">
          <div class="stat-tile"><b>${fs.length}</b><span>Scanned</span></div>
          <div class="stat-tile"><b>${dups.reduce((a, g) => a + g.length, 0)}</b><span>Duplicate files</span></div>
          <div class="stat-tile"><b>${humanSize(wasted)}</b><span>Reclaimable</span></div>
        </div>
        <div class="info-list">
          ${dups.map(g => `
            <div class="info-item" style="flex-direction:column;align-items:stretch">
              <span><b style="color:var(--text)">Group of ${g.length} identical files</b> · each ${humanSize(g[0].size)}</span>
              ${g.map(f => `<b style="font-family:var(--font-b);font-size:.87rem">• ${esc(f.name)}</b>`).join('')}
            </div>`).join('')}
        </div>
        <p class="tool-note">Duplicates were found by comparing full-file SHA-256 fingerprints, locally in your browser.</p>`;
    } catch (e){ errorOut(status, friendly(e)); }
  };
}

/* ---- File type detector ---- */
function sniffBytes(b){
  const h = [...b.slice(0, 16)].map(x => x.toString(16).padStart(2, '0')).join('');
  const ascii = [...b].map(x => (x >= 32 && x <= 126) ? String.fromCharCode(x) : '').join('');
  if (h.startsWith('25504446')) return {label:'PDF document', ext:['pdf']};
  if (h.startsWith('ffd8ff')) return {label:'JPEG image', ext:['jpg','jpeg','jfif']};
  if (h.startsWith('89504e47')) return {label:'PNG image', ext:['png']};
  if (h.startsWith('47494638')) return {label:'GIF image', ext:['gif']};
  if (h.startsWith('52494646') && ascii.includes('WEBP')) return {label:'WebP image', ext:['webp']};
  if (h.startsWith('504b0304')) return {label:'ZIP / Office (OOXML) archive', ext:['zip','docx','xlsx','pptx','odt','epub']};
  if (h.startsWith('1f8b')) return {label:'GZIP archive', ext:['gz']};
  if (h.startsWith('494433') || (b[0] === 0xff && (b[1] & 0xe6) === 0xe2)) return {label:'MP3 audio', ext:['mp3']};
  if (ascii.slice(4, 8) === 'ftyp') return {label:'MP4 / QuickTime media', ext:['mp4','mov','m4a','m4v']};
  if (h.startsWith('7f454c46')) return {label:'Executable (ELF)', ext:[]};
  if (h.startsWith('00000100')) return {label:'ICO icon', ext:['ico']};
  if (h.startsWith('424d')) return {label:'BMP image (probably)', ext:['bmp']};
  const sample = [...b.slice(0, 512)];
  const printable = sample.filter(x => x === 9 || x === 10 || x === 13 || (x >= 32 && x < 127) || x >= 160).length;
  if (sample.length && printable / sample.length > .95) return {label:'Plain text (likely)', ext:['txt','md','csv','json','html','css','js','xml','log']};
  return {label:'Unknown binary data', ext:[]};
}
function renderTypeDetector(body, api){
  const dz = dropzone({multiple:true, label:'Drop files to identify'});
  body.appendChild(dz.root);
  const actions = document.createElement('div');
  actions.className = 'tool-actions';
  actions.innerHTML = `<button class="btn btn-primary" id="runBtn">🧪 Detect Types</button><button class="btn btn-ghost" id="clearBtn">Clear</button>`;
  body.appendChild(actions);
  const status = statusBox(body);
  $('#clearBtn', actions).onclick = () => api.reset();
  $('#runBtn', actions).onclick = async () => {
    const fs = dz.getFiles();
    if (!fs.length) return toast('Add at least one file first.', 'info');
    const setMsg = loading(status, 'Sniffing file signatures…');
    try {
      const rows = [];
      for (let i = 0; i < fs.length; i++){
        setMsg(`Inspecting file ${i + 1} of ${fs.length}…`);
        const f = fs[i];
        const head = new Uint8Array(await f.slice(0, 512).arrayBuffer());
        const sniff = sniffBytes(head);
        const e = extOf(f.name);
        let badge;
        if (!sniff.ext.length) badge = `<span class="badge dim">❓ UNKNOWN</span>`;
        else if (sniff.ext.includes(e)) badge = `<span class="badge ok">✔ MATCHES EXTENSION</span>`;
        else badge = `<span class="badge warn">⚠ EXTENSION SAYS .${esc(e || '?')}</span>`;
        rows.push(`<tr><td title="${esc(f.name)}">${esc(f.name)}</td><td>${esc(sniff.label)}</td><td>${humanSize(f.size)}</td><td>${badge}</td></tr>`);
        await tick();
      }
      status.innerHTML = `
        <table class="info-table"><thead><tr><th>File</th><th>Detected content</th><th>Size</th><th>Check</th></tr></thead>
        <tbody>${rows.join('')}</tbody></table>
        <p class="tool-note">Detection reads each file's “magic bytes” — the fingerprint at the start of a file — directly in your browser.</p>`;
    } catch (e){ errorOut(status, friendly(e)); }
  };
}

/* ---- Batch file information ---- */
function renderBatchInfo(body, api){
  const dz = dropzone({multiple:true, label:'Drop files to list'});
  body.appendChild(dz.root);
  const actions = document.createElement('div');
  actions.className = 'tool-actions';
  actions.innerHTML = `<button class="btn btn-primary" id="runBtn">📋 Show Information</button><button class="btn btn-ghost" id="csvBtn" disabled>⬇ Export CSV</button><button class="btn btn-ghost" id="clearBtn">Clear</button>`;
  body.appendChild(actions);
  const status = statusBox(body);
  let last = [];
  $('#clearBtn', actions).onclick = () => api.reset();
  $('#runBtn', actions).onclick = () => {
    const fs = dz.getFiles();
    if (!fs.length) return toast('Add at least one file first.', 'info');
    last = fs;
    $('#csvBtn', actions).disabled = false;
    status.innerHTML = `
      <div class="stat-grid" style="max-width:340px">
        <div class="stat-tile"><b>${fs.length}</b><span>Files</span></div>
        <div class="stat-tile"><b>${humanSize(fs.reduce((a, f) => a + f.size, 0))}</b><span>Total size</span></div>
      </div>
      <div style="overflow-x:auto">
      <table class="info-table"><thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Last modified</th></tr></thead>
      <tbody>${fs.map(f => `<tr><td title="${esc(f.name)}">${esc(f.name)}</td><td>${esc(f.type || '—')}</td><td>${humanSize(f.size)}</td><td>${esc(fmtDate(f.lastModified))}</td></tr>`).join('')}</tbody></table>
      </div>`;
  };
  $('#csvBtn', actions).onclick = () => {
    if (!last.length) return;
    const cell = (s) => {
  return '"' + String(s).replace(/"/g, '""') + '"';
};
    const csv = ['Name,Type,Size (bytes),Size,Last Modified',
      ...last.map(f => [cell(f.name), cell(f.type || ''), f.size, cell(humanSize(f.size)), cell(fmtDate(f.lastModified))].join(','))
    ].join('\r\n');
    downloadBlob(new Blob([csv], {type:'text/csv'}), 'file-list.csv');
    toast('Downloading “file-list.csv”', 'success');
  };
}

/* ---- Percentage calculator ---- */
function renderPercentage(body){
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="controls-grid">
      ${field('Total marks', `<input type="number" id="pcTotal" min="1" step="any" placeholder="e.g. 500" inputmode="decimal">`)}
      ${field('Obtained marks', `<input type="number" id="pcGot" min="0" step="any" placeholder="e.g. 428" inputmode="decimal">`)}
    </div>
    <div class="ring-wrap">
      <div class="ring" id="pcRing" style="--p:0"><div class="ring-in"><b id="pcPct">—</b><span>percent</span></div></div>
      <div style="text-align:center">
        <div class="grade-pill" id="pcGrade">?</div>
        <p style="color:var(--muted);font-size:.85rem;margin-top:10px" id="pcMsg">Enter your marks to calculate.</p>
      </div>
    </div>`;
  body.appendChild(wrap);
  const total = $('#pcTotal', wrap), got = $('#pcGot', wrap);
  function gradeOf(p){
    if (p >= 90) return ['A+', 'Outstanding! 🏆'];
    if (p >= 80) return ['A', 'Excellent work! 🌟'];
    if (p >= 70) return ['B+', 'Great job! 👏'];
    if (p >= 60) return ['B', 'Good — keep going! 📈'];
    if (p >= 50) return ['C', 'Solid effort. 💪'];
    if (p >= 40) return ['D', 'Passed — room to grow. 🌱'];
    return ['F', 'Don\'t give up. Try again! 🔁'];
  }
  function calc(){
    const t = parseFloat(total.value), g = parseFloat(got.value);
    if (!isFinite(t) || !isFinite(g) || t <= 0){
      $('#pcPct', wrap).textContent = '—';
      $('#pcRing', wrap).style.setProperty('--p', 0);
      $('#pcGrade', wrap).textContent = '?';
      $('#pcMsg', wrap).textContent = 'Enter your marks to calculate.';
      return;
    }
    const p = Math.max(0, Math.min(100, g / t * 100));
    $('#pcRing', wrap).style.setProperty('--p', p.toFixed(2));
    $('#pcPct', wrap).textContent = p.toFixed(1) + '%';
    const [gLetter, msg] = gradeOf(p);
    $('#pcGrade', wrap).textContent = 'Grade ' + gLetter;
    $('#pcMsg', wrap).textContent = msg;
  }
  total.addEventListener('input', calc);
  got.addEventListener('input', calc);
}

/* ---- GPA calculator ---- */
const GRADE_POINTS = [['O',10],['A+',9],['A',8],['B+',7],['B',6],['C',5],['P',4],['F',0]];
function renderGpa(body, api){
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="gpa-rows" id="gRows"></div>
    <div class="tool-actions" style="margin-top:4px">
      <button class="btn btn-ghost btn-sm" id="gAdd">＋ Add Subject</button>
    </div>
    <div class="gpa-result">
      <b id="gVal">0.00</b>
      <div class="gpa-sub"><b style="font-size:1rem;color:var(--text)">GPA</b> · 10-point scale<br><span id="gCred">0 credits</span></div>
    </div>
    <p class="tool-note">💡 Grade points: O=10, A+=9, A=8, B+=7, B=6, C=5, P=4, F=0. Adjust credits per subject.</p>`;
  body.appendChild(wrap);
  const rows = $('#gRows', wrap);
  function calc(){
    let sum = 0, cred = 0;
    $$('.gpa-row', rows).forEach(r => {
      const c = parseFloat($('input', r).value) || 0;
      const p = parseFloat($('select', r).value);
      sum += c * p; cred += c;
    });
    $('#gVal', wrap).textContent = cred > 0 ? (sum / cred).toFixed(2) : '0.00';
    $('#gCred', wrap).textContent = `${cred} credit${cred === 1 ? '' : 's'} total`;
  }
  function addRow(name = ''){
    const row = document.createElement('div');
    row.className = 'gpa-row';
    row.innerHTML = `
      <input type="text" placeholder="Subject name" value="${esc(name)}" aria-label="Subject name">
      <input type="number" min="0" step="0.5" value="3" aria-label="Credits" inputmode="decimal">
      <select aria-label="Grade">${GRADE_POINTS.map(([g, p]) => `<option value="${p}"${g === 'A' ? ' selected' : ''}>${g} (${p})</option>`).join('')}</select>
      <button class="icon-btn" aria-label="Remove subject">✕</button>`;
    $('.icon-btn', row).addEventListener('click', () => { row.remove(); calc(); });
    row.querySelectorAll('input,select').forEach(el => el.addEventListener('input', calc));
    rows.appendChild(row);
    calc();
  }
  ['Physics', 'Chemistry', 'Mathematics'].forEach(addRow);
  $('#gAdd', wrap).addEventListener('click', () => addRow());
}

/* ---- Study file organizer ---- */
const SUBJECTS = [
  ['Physics', '⚛️'], ['Chemistry', '🧪'], ['Mathematics', '📐'], ['Biology', '🧬'],
  ['Computer Science', '💻'], ['English', '📖'], ['Other', '📂']
];
function renderOrganizer(body, api){
  const dz = dropzone({multiple:true, label:'Drop your study files here'});
  body.appendChild(dz.root);
  const list = document.createElement('div');
  list.className = 'info-list';
  body.appendChild(list);
  const summary = document.createElement('div');
  summary.className = 'seg-row';
  summary.style.marginTop = '14px';
  body.appendChild(summary);
  const actions = document.createElement('div');
  actions.className = 'tool-actions';
  actions.innerHTML = `<button class="btn btn-primary" id="runBtn" disabled>📥 Export Plan (.txt)</button><button class="btn btn-ghost" id="clearBtn">Clear</button>`;
  body.appendChild(actions);
  const status = statusBox(body);
  body.insertAdjacentHTML('beforeend', `<p class="tool-note">🔒 Browsers can't move files on your computer without permission — so StudyVault builds a clear organization plan you can follow or print, entirely locally.</p>`);
  function rebuild(){
    const fs = dz.getFiles();
    list.innerHTML = '';
    $('#runBtn', actions).disabled = !fs.length;
    fs.forEach((f, i) => {
      if (!f.__cat) f.__cat = guessSubject(f.name);
      const row = document.createElement('div');
      row.className = 'file-card';
      row.innerHTML = `
        <span class="ext ${extChipClass(f.name, f.type)}">${esc((extOf(f.name) || 'file').toUpperCase().slice(0,4))}</span>
        <div class="fc-meta"><div class="fc-name" title="${esc(f.name)}">${esc(f.name)}</div><div class="fc-sub">${humanSize(f.size)}</div></div>
        <select class="cat-sel" aria-label="Category for ${esc(f.name)}" style="padding:8px 10px;border-radius:10px;border:1px solid var(--stroke);background:rgba(255,255,255,.05)">
          ${SUBJECTS.map(([s, ic]) => `<option value="${s}"${f.__cat === s ? ' selected' : ''}>${ic} ${s}</option>`).join('')}
        </select>`;
      $('.cat-sel', row).addEventListener('change', e => { f.__cat = e.target.value; rebuildSummary(); });
      list.appendChild(row);
    });
    rebuildSummary();
  }
  function guessSubject(name){
    const n = name.toLowerCase();
    for (const [s] of SUBJECTS){
      if (s !== 'Other' && n.includes(s.toLowerCase().split(' ')[0])) return s;
    }
    if (/math|calc|geo/.test(n)) return 'Mathematics';
    if (/bio|cell|dna/.test(n)) return 'Biology';
    if (/chem|molec/.test(n)) return 'Chemistry';
    if (/phys|force|wave/.test(n)) return 'Physics';
    if (/code|prog|java|python|cs/.test(n)) return 'Computer Science';
    if (/essay|eng|lit|poem/.test(n)) return 'English';
    return 'Other';
  }
  function rebuildSummary(){
    const fs = dz.getFiles();
    const counts = {};
    fs.forEach(f => { counts[f.__cat || 'Other'] = (counts[f.__cat || 'Other'] || 0) + 1; });
    summary.innerHTML = Object.entries(counts)
      .map(([c, n]) => `<span class="seg active">${SUBJECTS.find(s => s[0] === c)?.[1] || '📂'} ${esc(c)} · ${n}</span>`).join('') || '<span style="color:var(--faint);font-size:.85rem">Add files to see the plan.</span>';
  }
  const mo = new MutationObserver(rebuild);
  mo.observe($('.dz-files', dz.root), {childList:true});
  api.onClose(() => mo.disconnect());
  $('#clearBtn', actions).onclick = () => api.reset();
  $('#runBtn', actions).onclick = () => {
    const fs = dz.getFiles();
    if (!fs.length) return;
    const byCat = {};
    fs.forEach((f) => {
  const key = f.__cat || 'Other';

  if (!byCat[key]) {
    byCat[key] = [];
  }

  byCat[key].push(f);
});
    let txt = 'STUDYVAULT — STUDY FILE ORGANIZATION PLAN\n' + '='.repeat(44) + '\nGenerated: ' + new Date().toLocaleString() + '\n\n';
    for (const [cat, files] of Object.entries(byCat)){
      txt += `${SUBJECTS.find(s => s[0] === cat)?.[1] || ''} ${cat.toUpperCase()} (${files.length})\n`;
      files.forEach(f => { txt += `   • ${f.name}  (${humanSize(f.size)})\n`; });
      txt += '\n';
    }
    txt += 'Tip: create one folder per subject and move the files listed above into them.\n';
    downloadBlob(new Blob([txt], {type:'text/plain'}), 'study-organization-plan.txt');
    successOut(status, {title:'Plan ready!', msg:'Your organization plan has been downloaded as a text file.'});
  };
}

/* ---- Exam countdown ---- */
function renderCountdown(body, api){
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="controls-grid">
      ${field('Exam name', `<input type="text" id="cdName" placeholder="e.g. Physics Final" maxlength="60">`)}
      ${field('Date & time', `<input type="datetime-local" id="cdDate">`)}
      <div class="field" style="justify-content:flex-end"><button class="btn btn-primary" id="cdAdd" style="height:fit-content">＋ Add Exam</button></div>
    </div>
    <div id="cdList"></div>`;
  body.appendChild(wrap);
  const listEl = $('#cdList', wrap);
  let exams = store.get('sv_exams', []);
  function save(){ store.set('sv_exams', exams); }
  function draw(){
    listEl.innerHTML = '';
    if (!exams.length){
      listEl.innerHTML = `<div class="empty-state" style="margin-top:14px"><div class="es-ic">⏳</div><b>No exams yet</b><p>Add your first exam date above — it stays saved on this device only.</p></div>`;
      return;
    }
    exams.sort((a, b) => a.ts - b.ts).forEach(ex => {
      const card = document.createElement('div');
      card.className = 'cd-card';
      card.dataset.ts = ex.ts;
      card.innerHTML = `
        <h4>${esc(ex.name)}</h4>
        <div class="cd-date">📅 ${esc(new Date(ex.ts).toLocaleString(undefined, {weekday:'short', dateStyle:'medium', timeStyle:'short'}))}</div>
        <div class="cd-tiles">
          <div class="cd-tile"><b data-k="d">--</b><span>Days</span></div>
          <div class="cd-tile"><b data-k="h">--</b><span>Hours</span></div>
          <div class="cd-tile"><b data-k="m">--</b><span>Minutes</span></div>
          <div class="cd-tile"><b data-k="s">--</b><span>Seconds</span></div>
        </div>
        <div class="cd-done" hidden>🎉 This exam has started / finished!</div>
        <button class="icon-btn cd-x" aria-label="Remove exam">✕</button>`;
      $('.cd-x', card).addEventListener('click', () => {
        exams = exams.filter(e => e !== ex);
        save(); draw();
        toast('Exam removed.', 'info');
      });
      listEl.appendChild(card);
    });
    update();
  }
  function update(){
    const now = Date.now();
    $$('.cd-card', listEl).forEach(card => {
      const ts = +card.dataset.ts;
      const diff = ts - now;
      if (diff <= 0){
        $('.cd-tiles', card).hidden = true;
        $('.cd-done', card).hidden = false;
        return;
      }
      const s = Math.floor(diff / 1000);
      const vals = {d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60};
      for (const k in vals) $(`[data-k="${k}"]`, card).textContent = String(vals[k]).padStart(2, '0');
    });
  }
  $('#cdAdd', wrap).addEventListener('click', () => {
    const name = $('#cdName', wrap).value.trim() || 'My Exam';
    const dv = $('#cdDate', wrap).value;
    if (!dv) return toast('Please pick a date and time.', 'error');
    const ts = new Date(dv).getTime();
    if (!isFinite(ts)) return toast('That date could not be read.', 'error');
    exams.push({name, ts});
    save(); draw();
    $('#cdName', wrap).value = '';
    $('#cdDate', wrap).value = '';
    toast(`Countdown for “${name}” saved on this device.`, 'success');
  });
  const iv = setInterval(update, 1000);
  api.onClose(() => clearInterval(iv));
  draw();
}
/* ============ 10. Modal manager ============ */
let modalCleanups = [], modalLastFocus = null, currentRender = null, modalApi = null;

function showModal({ icon, title, desc, render }) {
  const root = $('#modalRoot');
  if (!root) return;

  modalLastFocus = document.activeElement;
  modalCleanups = [];
  currentRender = render;

  root.hidden = false;
  document.documentElement.classList.add('lock');

  root.innerHTML = `
    <div class="modal-backdrop" data-close>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <header class="modal-head">
          <div class="modal-ic" aria-hidden="true">${icon}</div>
          <div>
            <h2 id="modalTitle">${esc(title)}</h2>
            <p>${esc(desc || '')}</p>
          </div>
          <button class="icon-btn modal-x" aria-label="Close">✕</button>
        </header>
        <div class="modal-body"></div>
      </div>
    </div>
  `;

  modalApi = {
    onClose(fn) {
      modalCleanups.push(fn);
    },
    reset() {
      runCleanups();

      const body = $('.modal-body', root);
      body.innerHTML = '';
      body.scrollTop = 0;

      currentRender(body, modalApi);
    }
  };

  const body = $('.modal-body', root);

  try {
    render(body, modalApi);
  } catch (e) {
    errorOut(statusBox(body), friendly(e));
  }

  const closeBtn = $('.modal-x', root);

  if (closeBtn) {
    closeBtn.focus();
    closeBtn.addEventListener('click', closeModal);
  }

  root.addEventListener('click', (e) => {
    if (
      e.target.dataset.close !== undefined &&
      e.target.hasAttribute('data-close')
    ) {
      closeModal();
    }
  });
}
function runCleanups(){
  modalCleanups.forEach(fn => { try { fn(); } catch {} });
  modalCleanups = [];
}
function closeModal() {
  const root = $('#modalRoot');
  if (!root) return;
  
  const backdrop = $('.modal-backdrop', root);
  
  // Add closing animation class
  if (backdrop && !DeviceCaps.prefersReducedMotion) {
    backdrop.classList.add('closing');
    
    // Wait for animation to complete
    setTimeout(() => {
      runCleanups();
      root.hidden = true;
      root.innerHTML = '';
      document.documentElement.classList.remove('lock');
      if (modalLastFocus && modalLastFocus.focus) {
        modalLastFocus.focus();
      }
    }, 250);
  } else {
    runCleanups();
    root.hidden = true;
    root.innerHTML = '';
    document.documentElement.classList.remove('lock');
    if (modalLastFocus && modalLastFocus.focus) {
      modalLastFocus.focus();
    }
  }
}
document.addEventListener('keydown', e => {
  const root = $('#modalRoot');
  if (root.hidden) return;
  if (e.key === 'Escape') closeModal();
  if (e.key === 'Tab'){ // lightweight focus trap
    const f = $$('button,input,select,textarea,[tabindex]:not([tabindex="-1"])', root).filter(x => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first){ last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last){ first.focus(); e.preventDefault(); }
  }
});
function openTool(id){
  const t = TOOL_MAP[id];
  if (!t) return;
  addRecent(id);
  // Workspaces with dedicated full pages should navigate instead of opening as a popup
  // to keep the experience consistent with PDF Editor / Photo Editor standalone pages.
  const workspacePages = { 'pdf-editor': 'pdf-editor.html', 'photo-editor': 'photo-editor.html', 'file-tools': 'file-tools.html' };
  if (workspacePages[id]) {
    const target = workspacePages[id];
    // If file-tools (new unified workspace) always prefer full page
    // For pdf/photo, preserve modal on index but allow direct navigation for file-tools
    if (id === 'file-tools') {
      // navigate to dedicated page; keep modal fallback if navigation fails (file://)
      try {
        const cur = (location.pathname || '').toLowerCase();
        if (!cur.endsWith(target)) {
          location.href = target;
          return;
        }
      } catch {}
    }
  }
  const renderFn = typeof t.render === 'function' ? t.render : window[t.render];
  if (typeof renderFn !== 'function'){ toast('This tool could not be loaded.', 'error'); return; }
  showModal({icon: t.icon, title: t.name, desc: t.desc, render: renderFn});
}

/* Privacy modal */
function openPrivacy(){
  showModal({
    icon:'🔒', title:'Privacy at StudyVault', desc:'What happens to your files — the honest version.',
    render(body){
      body.innerHTML = `
        <div class="info-list">
          <div class="info-item"><span>📁 File processing</span><b>Runs locally in your browser where supported</b></div>
          <div class="info-item"><span>📤 Uploads</span><b>Your files are not intentionally uploaded to any server</b></div>
          <div class="info-item"><span>👤 Accounts</span><b>No account, login or signup required</b></div>
          <div class="info-item"><span>🔑 Passwords</span><b>Never collected — there is nothing to collect</b></div>
          <div class="info-item"><span>💾 Preferences</span><b>Stored only in your browser via localStorage (recent tools, exam dates)</b></div>
          <div class="info-item"><span>🧹 Clearing data</span><b>Use “Clear History” under tools, or your browser's site-data settings</b></div>
        </div>
        <p class="tool-note" style="margin-top:16px">A few open-source libraries (fonts, PDF engines) are loaded from public CDNs. They execute entirely on your device. This page makes no exaggerated legal claims — it simply describes how the technology behaves.</p>`;
    }
  });
}

/* ============ 11. Nav, hero parallax, misc wiring ============ */
function initNav() {
  const header = $('#siteHeader');
  if (!header) return;

  addEventListener(
    'scroll',
    () => {
      header.classList.toggle('scrolled', scrollY > 12);
    },
    { passive: true }
  );

  const toggle = $('#navToggle');

  if (toggle) {
    toggle.addEventListener('click', () => {
      const open = header.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  $$('#navLinks a').forEach((a) => {
    a.addEventListener('click', () => {
      header.classList.remove('nav-open');

      if (toggle) {
        toggle.setAttribute('aria-expanded', 'false');
      }

      if (a.dataset.gotoFilter) {
        setTimeout(() => setFilter(a.dataset.gotoFilter), 60);
      }
    });
  });

  const top = $('#top');
  const about = $('#about');
  const links = $$('#navLinks a');

  if (
    !('IntersectionObserver' in window) ||
    !top ||
    !about ||
    !links.length
  ) {
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;

        links.forEach((a) => a.classList.remove('active'));

        if (en.target.id === 'top' && links[0]) {
          links[0].classList.add('active');
        }

        if (en.target.id === 'about' && links[4]) {
          links[4].classList.add('active');
        }
      });
    },
    {
      rootMargin: '-40% 0px -55% 0px'
    }
  );

  io.observe(top);
  io.observe(about);
}
function initHero() {
  const hero = $('#hero');
  const hv = $('#heroVisual');

  if (!hero || !hv) return;

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  hero.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;

    const r = hero.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;

    const scene = $('.hv-scene', hv);

    if (scene) {
      scene.style.setProperty('--hx', x.toFixed(3));
      scene.style.setProperty('--hy', y.toFixed(3));
    }

    $$('.hv-pos', hv).forEach((p) => {
      p.style.setProperty('--hx', x.toFixed(3));
      p.style.setProperty('--hy', y.toFixed(3));
    });
  });
}
function initReveal() {
  const els = $$('.reveal');

  if (!els.length) return;

  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('in'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    },
    {
      threshold: 0.12
    }
  );

  els.forEach((el) => io.observe(el));
}

function initCounters() {
  const counters = $$('.hstat b[data-count]');
  if (!counters.length) return;
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.count, 10);
        const duration = 1500;
        const start = performance.now();
        
        function update(now) {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          // Ease out cubic
          const eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = Math.round(target * eased);
          
          if (progress < 1) {
            requestAnimationFrame(update);
          }
        }
        
        requestAnimationFrame(update);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  
  counters.forEach(c => observer.observe(c));
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    // Footer year, if element exists
    const year = $('#year');
    if (year) {
      year.textContent = new Date().getFullYear();
    }

    // Build dashboard only if required elements/functions exist
    if (typeof buildDashboard === 'function' && $('#toolGroups')) {
      buildDashboard();
    }

    if (typeof renderRecent === 'function' && $('#recentWrap') && $('#recentChips')) {
      renderRecent();
    }

    if (typeof applyFilters === 'function' && $('#toolGroups')) {
      applyFilters();
    }

    // Optional UI sections
    if (typeof initNav === 'function' && $('#siteHeader')) {
      initNav();
    }

    if (typeof initHero === 'function' && $('#hero') && $('#heroVisual')) {
      initHero();
    }

    if (typeof initReveal === 'function') {
      initReveal();
    }

    if (typeof initCounters === 'function') {
      initCounters();
    }

    // Search input
    const search = $('#searchInput');

    if (
      search &&
      typeof dashState !== 'undefined' &&
      typeof applyFilters === 'function'
    ) {
      search.addEventListener('input', () => {
        if (typeof debouncedSearch === 'function') {
          debouncedSearch(search.value);
        } else {
          dashState.q = search.value.trim().toLowerCase();
          applyFilters();
        }
      });
    }

    // Clear search button
    const clearSearchBtn = $('#clearSearchBtn');

    if (
      clearSearchBtn &&
      search &&
      typeof dashState !== 'undefined' &&
      typeof applyFilters === 'function'
    ) {
      clearSearchBtn.addEventListener('click', () => {
        search.value = '';
        dashState.q = '';
        applyFilters(true);
        search.focus();
      });
    }

    // "/" shortcut, fixed safely
    document.addEventListener('keydown', (e) => {
      if (e.key !== '/') return;

      const modalRoot = $('#modalRoot');

      // Do not trigger while modal is open
      if (modalRoot && !modalRoot.hidden) return;

      const active = document.activeElement;
      const tagName = active && active.tagName ? active.tagName : '';

      // Do not trigger while typing in a field
      if (
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT'
      ) {
        return;
      }

      const searchField = $('#searchInput');
      if (!searchField) return;

      e.preventDefault();
      searchField.focus();

      if (typeof searchField.scrollIntoView === 'function') {
        searchField.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    });

    // Filter pills
    const filterPills = $('#filterPills');

    if (filterPills && typeof setFilter === 'function') {
      $$('#filterPills .pill').forEach((p) => {
        p.addEventListener('click', () => {
          setFilter(p.dataset.filter);
        });
      });
    }

    // Clear recent history
    const recentClear = $('#recentClear');

    if (
      recentClear &&
      typeof store !== 'undefined' &&
      typeof renderRecent === 'function'
    ) {
      recentClear.addEventListener('click', () => {
        store.del('sv_recent');
        renderRecent();

        if (typeof toast === 'function') {
          toast('Tool history cleared from this device.', 'success');
        }
      });
    }

    // Privacy buttons
    $$('[data-privacy]').forEach((b) => {
      b.addEventListener('click', openPrivacy);
    });

    // Direct tool open buttons
    $$('[data-open-tool]').forEach((b) => {
      b.addEventListener('click', () => {
        openTool(b.dataset.openTool);
      });
    });

    // Enhanced SW registration with update prompt
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(reg => {
          reg.addEventListener('updatefound', () => {
            const worker = reg.installing;
            worker.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                toast('Update available! Refresh to get the latest version.', 'info', 6000);
              }
            });
          });
        }).catch(() => {});
      });
    }
  } catch (err) {
    console.error('StudyVault init failed:', err);

    const failBox = document.createElement('div');
    failBox.style.cssText = [
      'position:fixed',
      'left:16px',
      'right:16px',
      'bottom:16px',
      'z-index:9999',
      'padding:14px 16px',
      'border-radius:14px',
      'background:#7f1d1d',
      'color:#fff',
      'font:16px system-ui, sans-serif',
      'box-shadow:0 10px 30px rgba(0,0,0,.35)'
    ].join(';');

    failBox.textContent =
      'StudyVault could not start fully. Open the browser console for details.';

    document.body.appendChild(failBox);
  }
});

