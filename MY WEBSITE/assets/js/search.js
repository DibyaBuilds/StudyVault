/*
  StudyVault — search and tool dashboard (single Tools library).
  All tools are rendered in ONE flat grid so index.html has only one "Tools" section.
  Search filters the in-memory TOOLS data immediately.
*/
'use strict';
let searchDebounce = null;

function debouncedSearch(value) {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    dashState.q = value.trim().toLowerCase();
    applyFilters(true);
    searchDebounce = null;
  }, 150);
}

/* ============ 9. Dashboard: single-grid cards, search, recents ============ */
const dashState = {cat:'all', q:''};

// Map cat id → display meta for badge inside card (when flat grid)
const CAT_BADGE = {
  pdf:     {label: 'PDF',     cls: 'pdf'},
  image:   {label: 'Image',   cls: 'image'},
  file:    {label: 'File',    cls: 'file'},
  student: {label: 'Student', cls: 'student'}
};

function buildDashboard() {
  const root = $('#toolGroups');

  if (!root || typeof TOOLS === 'undefined') {
    return;
  }

  // Single flat grid — ONE Tools library (no CAT_META grouping)
  root.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'tool-grid tool-grid--single';

  // Render every tool as a card with a tiny category badge
  grid.innerHTML = TOOLS.map(t => {
    const primaryCat = (t.cats && t.cats[0]) || 'file';
    const badge = CAT_BADGE[primaryCat] || {label: primaryCat, cls: 'file'};
    return `
      <button class="tool-card tilt" data-id="${t.id}" data-cats="${t.cats.join(' ')}" data-search="${esc((t.name + ' ' + t.desc + ' ' + t.kw).toLowerCase())}" aria-label="Open tool: ${esc(t.name)}">
        <span class="cat-badge ${badge.cls}">${badge.label}</span>
        <span class="tc-icon" aria-hidden="true">${t.icon}</span>
        <span class="tc-name">${esc(t.name)}</span>
        <span class="tc-desc">${esc(t.desc)}</span>
        <span class="tc-open">Open Tool <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
      </button>`;
  }).join('');

  root.appendChild(grid);

  // Delegate open
  root.addEventListener('click', e => {
    const card = e.target.closest('.tool-card');
    if (card) openTool(card.dataset.id);
  });

  // 3D tilt micro-interaction — adaptive based on device
  const canTilt = typeof quality !== 'undefined' && quality.enableTilt
    && typeof DeviceCaps !== 'undefined'
    && !DeviceCaps.prefersReducedMotion
    && DeviceCaps.supportsHover
    && DeviceCaps.isFinePointer;

  if (canTilt) {
    let rafId = null;
    $$('.tilt', root).forEach(card => {
      card.addEventListener('pointermove', e => {
        if (e.pointerType === 'touch') return;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          const r = card.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          const intensity = DeviceCaps.qualityTier === 'high' ? 6 : 4;
          card.style.setProperty('--ry', (px * intensity).toFixed(2) + 'deg');
          card.style.setProperty('--rx', (-py * intensity).toFixed(2) + 'deg');
          rafId = null;
        });
      }, { passive: true });
      card.addEventListener('pointerleave', () => {
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      }, { passive: true });
    });
  }
}

function applyFilters(animate = false) {
  const noResults = $('#noResults');
  if (!noResults || typeof dashState === 'undefined') return;

  const { cat, q } = dashState;
  let visible = 0;

  // Flat-grid filtering: check each card's own cats + search index
  const cards = $$('#toolGroups .tool-card');
  // If legacy grouped DOM is present (tool-group wrappers), also support it
  const groups = $$('.tool-group');

  if (groups.length && cards.length && groups[0].querySelector('.group-head')) {
    // Legacy fallback: grouped layout
    groups.forEach(sec => {
      const catOk = cat === 'all' || sec.dataset.cat === cat;
      let secVisible = 0;
      $$('.tool-card', sec).forEach(card => {
        const matchQ = !q || card.dataset.search.includes(q);
        const show = catOk && matchQ;
        const wasHidden = card.classList.contains('hide');
        card.classList.toggle('hide', !show);
        if (show){
          visible++; secVisible++;
          if (animate || (wasHidden && q)){ card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop'); }
        }
      });
      sec.classList.toggle('hide', secVisible === 0);
    });
  } else {
    // Single-grid path
    cards.forEach(card => {
      const cats = (card.dataset.cats || '').split(' ').filter(Boolean);
      const catOk = cat === 'all' || cats.includes(cat);
      const matchQ = !q || card.dataset.search.includes(q);
      const show = catOk && matchQ;
      const wasHidden = card.classList.contains('hide');
      card.classList.toggle('hide', !show);
      if (show) {
        visible++;
        if (animate || (wasHidden && q)) {
          card.classList.remove('pop');
          void card.offsetWidth;
          card.classList.add('pop');
        }
      }
    });
  }

  noResults.hidden = visible > 0;
}

function setFilter(cat, animate = true){
  dashState.cat = cat;
  const pills = $$('#filterPills .pill');
  if (pills.length) pills.forEach(p => p.classList.toggle('active', p.dataset.filter === cat));
  applyFilters(animate);
}

function renderRecent() {
  const wrapEl = $('#recentWrap');
  const chips = $('#recentChips');
  if (!wrapEl || !chips || typeof store === 'undefined' || typeof TOOL_MAP === 'undefined') return;
  const ids = store.get('sv_recent', []).filter((id) => TOOL_MAP[id]);
  if (!ids.length){ wrapEl.hidden = true; return; }
  wrapEl.hidden = false;
  chips.innerHTML = ids.map(id => {
    const t = TOOL_MAP[id];
    return `<button class="chip" data-recent="${id}"><span aria-hidden="true">${t.icon}</span>${esc(t.name)}</button>`;
  }).join('');
  $$('#recentChips [data-recent]').forEach(b => b.addEventListener('click', () => openTool(b.dataset.recent)));
}
function addRecent(id){
  let ids = store.get('sv_recent', []).filter(x => x !== id);
  ids.unshift(id);
  store.set('sv_recent', ids.slice(0, 6));
  renderRecent();
}
