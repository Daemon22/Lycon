/**
 * Lycon Browser — Sidebar
 * Slide-out panel for bookmarks, history, downloads.
 */
(function () {
  'use strict';

  const sidebar = document.getElementById('sidebar');
  const sidebarTitle = document.getElementById('sidebar-title');
  const sidebarBody = document.getElementById('sidebar-body');
  const sidebarClose = document.getElementById('sidebar-close');

  const { state, on, getActive, emit: _emit } = window.LyconState;

  let currentView = null;

  function open(view) {
    currentView = view;
    sidebar.classList.remove('hidden');
    sidebarTitle.textContent = ({
      bookmarks: 'Bookmarks',
      history: 'History',
      downloads: 'Downloads',
    })[view];
    render();
  }

  function close() {
    sidebar.classList.add('hidden');
    currentView = null;
  }

  sidebarClose.addEventListener('click', close);

  function clearBody() { sidebarBody.innerHTML = ''; }

  function makeSearch(placeholder, onInput) {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.className = 'sidebar-search';
    input.addEventListener('input', () => onInput(input.value));
    return input;
  }

  function listItem({ title, url, favicon, time, onDelete, onOpen }) {
    const el = document.createElement('div');
    el.className = 'list-item';
    el.title = url;

    const fav = document.createElement('div');
    fav.className = 'favicon';
    if (favicon) {
      const img = document.createElement('img');
      img.src = favicon;
      img.style.width = '14px';
      img.style.height = '14px';
      img.onerror = () => { fav.textContent = '🌐'; };
      fav.appendChild(img);
    } else {
      fav.textContent = '🌐';
    }

    const meta = document.createElement('div');
    meta.className = 'meta';
    const tEl = document.createElement('div');
    tEl.className = 'title';
    tEl.textContent = title;
    const uEl = document.createElement('div');
    uEl.className = 'url';
    uEl.textContent = url;
    meta.appendChild(tEl);
    meta.appendChild(uEl);

    if (time) {
      const t = document.createElement('div');
      t.className = 'time';
      t.textContent = time;
      meta.appendChild(t);
    }

    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '✕';
    del.title = 'Remove';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onDelete) onDelete();
    });

    el.appendChild(fav);
    el.appendChild(meta);
    el.appendChild(del);

    if (onOpen) el.addEventListener('click', onOpen);
    return el;
  }

  function emptyState(msg) {
    const el = document.createElement('div');
    el.className = 'empty-state';
    el.textContent = msg;
    return el;
  }

  // ----- Renderers -----
  function renderBookmarks(filter = '') {
    clearBody();
    const search = makeSearch('Search bookmarks…', (v) => renderBookmarks(v));
    sidebarBody.appendChild(search);

    let items = state.bookmarks;
    if (filter) {
      const f = filter.toLowerCase();
      items = items.filter(b => (b.title || '').toLowerCase().includes(f) || (b.url || '').toLowerCase().includes(f));
    }
    if (items.length === 0) {
      sidebarBody.appendChild(emptyState('No bookmarks yet. Click the ☆ in the URL bar to save a page.'));
      return;
    }
    for (const b of items) {
      sidebarBody.appendChild(listItem({
        title: b.title, url: b.url, favicon: b.favicon,
        onDelete: () => window.LyconBookmarks.remove(b.id).then(render),
        onOpen: () => {
          const t = getActive();
          if (t && window.LyconTabs) window.LyconTabs.loadUrlInTab(t, b.url);
          close();
        },
      }));
    }
  }

  function renderHistory(filter = '') {
    clearBody();
    const search = makeSearch('Search history…', (v) => renderHistory(v));
    sidebarBody.appendChild(search);

    let items = state.history;
    if (filter) {
      const f = filter.toLowerCase();
      items = items.filter(h => (h.title || '').toLowerCase().includes(f) || (h.url || '').toLowerCase().includes(f));
    }
    if (items.length === 0) {
      sidebarBody.appendChild(emptyState('No history yet. Browse around — Lycon keeps the last 2000 visits.'));
      return;
    }

    const clearBtn = document.createElement('button');
    clearBtn.className = 'btn';
    clearBtn.style.cssText = 'margin: 0 0 10px auto; display: block; padding: 4px 10px; font-size: 11.5px;';
    clearBtn.textContent = 'Clear all';
    clearBtn.addEventListener('click', () => {
      if (confirm('Clear all browsing history?')) {
        window.LyconHistory.clear().then(render);
      }
    });
    sidebarBody.appendChild(clearBtn);

    const fmtTime = window.LyconDownloads ? window.LyconDownloads.fmtTime : ((ts) => new Date(ts).toLocaleString());
    for (const h of items) {
      sidebarBody.appendChild(listItem({
        title: h.title, url: h.url,
        time: fmtTime(h.visitedAt),
        onDelete: () => window.LyconHistory.remove(h.id).then(render),
        onOpen: () => {
          const t = getActive();
          if (t && window.LyconTabs) window.LyconTabs.loadUrlInTab(t, h.url);
          close();
        },
      }));
    }
  }

  function renderDownloads() {
    clearBody();
    if (state.downloads.length === 0) {
      sidebarBody.appendChild(emptyState('No downloads yet.'));
      return;
    }
    const fmtBytes = window.LyconDownloads ? window.LyconDownloads.fmtBytes : ((n) => n + ' B');
    const _fmtTime = window.LyconDownloads ? window.LyconDownloads.fmtTime : ((ts) => new Date(ts).toLocaleString());

    const clearBtn = document.createElement('button');
    clearBtn.className = 'btn';
    clearBtn.style.cssText = 'margin: 0 0 10px auto; display: block; padding: 4px 10px; font-size: 11.5px;';
    clearBtn.textContent = 'Clear list';
    clearBtn.addEventListener('click', () => window.LyconDownloads.clear().then(render));
    sidebarBody.appendChild(clearBtn);

    for (const d of state.downloads) {
      const el = document.createElement('div');
      el.className = 'list-item';
      el.style.flexDirection = 'column';
      el.style.alignItems = 'stretch';
      el.style.gap = '4px';

      const top = document.createElement('div');
      top.style.cssText = 'display:flex; align-items:center; gap:10px;';

      const fav = document.createElement('div');
      fav.className = 'favicon';
      fav.textContent = '⬇';

      const meta = document.createElement('div');
      meta.className = 'meta';
      const titleEl = document.createElement('div');
      titleEl.className = 'title';
      titleEl.textContent = d.filename;
      const urlEl = document.createElement('div');
      urlEl.className = 'url';
      const pct = d.total > 0 ? Math.round((d.received / d.total) * 100) : 0;
      urlEl.textContent = `${fmtBytes(d.received)} / ${fmtBytes(d.total)} · ${d.state === 'progressing' ? pct + '%' : d.state}`;
      meta.appendChild(titleEl);
      meta.appendChild(urlEl);

      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex; gap:4px;';
      if (d.state === 'completed') {
        const openB = document.createElement('button');
        openB.textContent = 'Open';
        openB.className = 'btn';
        openB.style.cssText = 'padding:3px 8px; font-size:11px;';
        openB.addEventListener('click', (e) => { e.stopPropagation(); window.LyconDownloads.open(d.savePath); });
        const showB = document.createElement('button');
        showB.textContent = 'Show';
        showB.className = 'btn';
        showB.style.cssText = 'padding:3px 8px; font-size:11px;';
        showB.addEventListener('click', (e) => { e.stopPropagation(); window.LyconDownloads.show(d.savePath); });
        actions.appendChild(openB);
        actions.appendChild(showB);
      }

      top.appendChild(fav);
      top.appendChild(meta);
      top.appendChild(actions);

      // Progress bar
      const bar = document.createElement('div');
      bar.style.cssText = 'height:3px; background:var(--bg-input); border-radius:2px; overflow:hidden;';
      const fill = document.createElement('div');
      fill.style.cssText = `height:100%; background:var(--accent); width:${d.state === 'progressing' && d.total > 0 ? pct : (d.state === 'completed' ? 100 : 0)}%; transition:width 0.2s;`;
      bar.appendChild(fill);

      el.appendChild(top);
      el.appendChild(bar);
      sidebarBody.appendChild(el);
    }
  }

  function render() {
    if (!currentView) return;
    if (currentView === 'bookmarks') renderBookmarks();
    else if (currentView === 'history') renderHistory();
    else if (currentView === 'downloads') renderDownloads();
  }

  on('bookmarks:changed', () => { if (currentView === 'bookmarks') render(); });
  on('history:changed', () => { if (currentView === 'history') render(); });
  on('downloads:changed', () => { if (currentView === 'downloads') render(); });
  on('downloads:progress', () => { if (currentView === 'downloads') render(); });
  on('downloads:done', () => { if (currentView === 'downloads') render(); });

  // Wire toolbar buttons
  document.getElementById('act-bookmarks').addEventListener('click', () => {
    if (currentView === 'bookmarks') close(); else open('bookmarks');
  });
  document.getElementById('act-history').addEventListener('click', () => {
    if (currentView === 'history') close(); else open('history');
  });
  document.getElementById('act-downloads').addEventListener('click', () => {
    if (currentView === 'downloads') close(); else open('downloads');
  });

  window.LyconSidebar = { open, close, render };
})();
