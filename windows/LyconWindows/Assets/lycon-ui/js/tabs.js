/**
 * Lycon Browser — Tab Management
 * Renders tab strip, creates/switches/closes tabs, manages webview lifecycle.
 */
(function () {
  'use strict';

  const tabsEl = document.getElementById('tabs');
  const _tabstripEl = document.getElementById('tabstrip');
  const contentEl = document.getElementById('content');
  const newTabBtn = document.getElementById('tab-new');

  const { state, on, emit: _emit, addTab, removeTab, getTab, getActive, setActive, updateTab, reorderTab } = window.LyconState;

  // ---------------- Rendering ----------------
  function renderTabs() {
    // Build a fresh tab strip; webviews are kept separately (not re-created)
    tabsEl.innerHTML = '';
    for (const t of state.tabs) {
      tabsEl.appendChild(buildTabEl(t));
    }
  }

  function buildTabEl(t) {
    const el = document.createElement('div');
    el.className = 'tab'
      + (t.id === state.activeId ? ' active' : '')
      + (t.private ? ' private' : '')
      + (t.pinned ? ' pinned' : '')
      + (t.muted ? ' muted' : '');
    el.dataset.id = t.id;
    el.draggable = !t.pinned;

    const favicon = document.createElement('div');
    favicon.className = 'tab-favicon';
    if (t.loading) {
      const sp = document.createElement('div');
      sp.className = 'spinner';
      favicon.appendChild(sp);
    } else if (t.pinned) {
      favicon.textContent = '📌';
    } else if (t.favicon) {
      const img = document.createElement('img');
      img.src = t.favicon;
      img.onerror = () => { favicon.textContent = t.private ? '🕶' : '🌐'; };
      favicon.appendChild(img);
    } else {
      favicon.textContent = t.private ? '🕶' : '🌐';
    }

    const title = document.createElement('div');
    title.className = 'tab-title';
    if (t.pinned) {
      title.textContent = '';
    } else {
      title.textContent = t.title || 'New Tab';
      if (t.muted) {
        const mute = document.createElement('span');
        mute.textContent = ' 🔇';
        mute.style.fontSize = '10px';
        title.appendChild(mute);
      }
    }

    const close = document.createElement('button');
    close.className = 'tab-close';
    close.textContent = '✕';
    close.title = 'Close tab';
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(t.id);
    });

    el.appendChild(favicon);
    if (!t.pinned) el.appendChild(title);
    el.appendChild(close);

    el.addEventListener('click', () => setActive(t.id));
    el.addEventListener('auxclick', (e) => {
      if (e.button === 1) { e.preventDefault(); closeTab(t.id); }
    });

    // Right-click context menu
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showTabContextMenu(t, e.clientX, e.clientY);
    });

    // Drag and drop
    el.addEventListener('dragstart', (e) => {
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', t.id);
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.classList.add('drag-over');
    });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drag-over');
      const fromId = e.dataTransfer.getData('text/plain');
      if (fromId && fromId !== t.id) reorderTab(fromId, t.id);
    });

    return el;
  }

  function updateTabEl(t) {
    const el = tabsEl.querySelector(`.tab[data-id="${t.id}"]`);
    if (!el) return;
    el.outerHTML = buildTabEl(t).outerHTML;
  }

  // ---------------- Webview management ----------------
  function ensureWebview(t, initialUrl) {
    if (t.webview) return t.webview;
    const wv = document.createElement('webview');
    wv.dataset.id = t.id;
    wv.setAttribute('autoplay-policy', 'document-user-activation-required');
    wv.setAttribute('allowpopups', '');
    wv.setAttribute('webpreferences', 'contextIsolation=yes,nodeIntegration=no');
    if (t.private) {
      wv.setAttribute('partition', 'private');
    }
    // Set src BEFORE attaching to DOM — required by Electron
    if (initialUrl) {
      wv.setAttribute('src', initialUrl);
    }
    wv.classList.add('hidden');
    contentEl.appendChild(wv);
    t.webview = wv;
    t.domReady = false;
    wireWebview(t);
    return wv;
  }

  function wireWebview(t) {
    const wv = t.webview;

    wv.addEventListener('dom-ready', () => {
      t.domReady = true;
    });

    wv.addEventListener('did-start-loading', () => {
      updateTab(t.id, { loading: true });
    });

    wv.addEventListener('did-stop-loading', () => {
      updateTab(t.id, { loading: false });
      const title = wv.getTitle();
      const url = wv.getURL();
      if (title) updateTab(t.id, { title });
      if (url) {
        updateTab(t.id, { url });
        // Add to history (unless private or startpage or about: page)
        const isStartpage = url.includes('startpage.html') || url.startsWith('about:') || url.startsWith('data:');
        if (!t.private && !isStartpage) {
          window.LyconHistory && window.LyconHistory.add({
            url, title: title || url, visitedAt: Date.now(),
          });
        }
        // Update navigation button states
        window.LyconNav && window.LyconNav.refreshNav();
      }
    });

    wv.addEventListener('did-fail-load', (e) => {
      if (e.errorCode === -3) return; // Aborted (user navigation) — not an error
      console.error('[Lycon] did-fail-load', t.id, e.errorCode, e.errorDescription, 'url=', e.url);
    });

    wv.addEventListener('console-message', (e) => {
      // Surface webview console messages for debugging
      if (e.level >= 2) console.warn('[Lycon wv]', t.id, e.message);
    });

    wv.addEventListener('page-title-updated', (e) => {
      updateTab(t.id, { title: e.title });
    });

    wv.addEventListener('page-favicon-updated', (e) => {
      const fav = e.favicons && e.favicons[0];
      updateTab(t.id, { favicon: fav || '' });
    });

    wv.addEventListener('did-navigate', (e) => {
      updateTab(t.id, { url: e.url });
      // Push to per-tab navigation history
      pushTabHistory(t, e.url);
      window.LyconNav && window.LyconNav.refreshNav();
    });

    wv.addEventListener('did-navigate-in-page', (e) => {
      updateTab(t.id, { url: e.url });
      window.LyconNav && window.LyconNav.refreshNav();
    });

    wv.addEventListener('new-window', (e) => {
      e.preventDefault();
      // Open as new tab in Lycon
      createTab({ url: e.url, private: t.private });
    });

    wv.addEventListener('update-target-url', (e) => {
      const sb = document.getElementById('statusbar');
      if (e.url) {
        sb.textContent = e.url;
        sb.classList.remove('hidden');
      } else {
        sb.classList.add('hidden');
      }
    });

    // Crash recovery
    wv.addEventListener('render-process-gone', (e) => {
      const details = e.details || {};
      console.warn('[Lycon] render-process-gone', t.id, 'reason=', details.reason, 'exitCode=', details.exitCode);
      updateTab(t.id, { title: '💀 Crashed (' + (details.reason || 'unknown') + ')', loading: false });
    });
  }

  function pushTabHistory(t, url) {
    // Drop forward history
    t.history = t.history.slice(0, t.historyIdx + 1);
    t.history.push(url);
    t.historyIdx = t.history.length - 1;
  }

  // ---------------- Tab context menu ----------------
  let ctxMenuEl = null;
  function showTabContextMenu(t, x, y) {
    if (ctxMenuEl) ctxMenuEl.remove();
    const menu = document.createElement('div');
    menu.className = 'menu-dropdown';
    menu.style.cssText = `position:fixed; top:${y}px; left:${x}px; min-width:200px;`;
    const items = [
      { label: 'Duplicate Tab', kbd: '', action: () => duplicateTab(t) },
      { label: 'Pin Tab', kbd: '', action: () => togglePin(t), sep: false },
      { label: t.muted ? 'Unmute Tab' : 'Mute Tab', kbd: '', action: () => toggleMute(t) },
      { label: 'Reload', kbd: 'Ctrl+R', action: () => t.webview && t.webview.reload() },
      { label: 'Copy URL', kbd: '', action: () => navigator.clipboard.writeText(t.url || '') },
      { sep: true },
      { label: 'Close Tab', kbd: 'Ctrl+W', action: () => closeTab(t.id), danger: true },
    ];
    for (const item of items) {
      if (item.sep) {
        const sep = document.createElement('div');
        sep.className = 'menu-sep';
        menu.appendChild(sep);
        continue;
      }
      const b = document.createElement('button');
      b.innerHTML = `${item.label}${item.kbd ? `<span class="kbd">${item.kbd}</span>` : ''}`;
      if (item.danger) b.style.color = 'var(--danger)';
      b.addEventListener('click', () => { item.action(); menu.remove(); ctxMenuEl = null; });
      menu.appendChild(b);
    }
    document.body.appendChild(menu);
    ctxMenuEl = menu;
    setTimeout(() => {
      const close = (e) => {
        if (!menu.contains(e.target)) {
          menu.remove();
          ctxMenuEl = null;
          document.removeEventListener('click', close, true);
        }
      };
      document.addEventListener('click', close, true);
    }, 0);
  }

  function duplicateTab(t) {
    if (!t) return;
    createTab({ url: t.url, private: t.private });
  }

  function togglePin(t) {
    if (!t) return;
    updateTab(t.id, { pinned: !t.pinned });
  }

  function toggleMute(t) {
    if (!t || !t.webview) return;
    try {
      const muted = !t.muted;
      // webview audio API
      t.webview.setAudioMuted(muted);
      updateTab(t.id, { muted });
    } catch (e) {
      console.warn('[Lycon] mute toggle failed', e);
    }
  }

  // ---------------- Public tab API ----------------
  function createTab(opts = {}) {
    const t = addTab(opts);
    // Determine initial URL before creating webview (must be set on the element before DOM attach)
    let initialUrl;
    if (opts.url) {
      const resolved = window.LyconNav ? window.LyconNav.resolveInput(opts.url) : opts.url;
      initialUrl = resolved;
    } else if (state.settings.startupPage !== 'blank') {
      const sp = window.LyconStartpage;
      if (sp && sp.url) initialUrl = sp.url();
    }
    ensureWebview(t, initialUrl);
    showTab(t.id);

    // For URL tabs, the per-tab history starts with this URL
    if (opts.url && initialUrl) {
      pushTabHistory(t, initialUrl);
    }

    return t;
  }

  function loadStartpage(t) {
    const sp = window.LyconStartpage;
    if (sp && sp.url && t.webview) {
      const u = sp.url();
      t.webview.loadURL(u).catch(err => console.error('[Lycon] startpage load failed', err));
    }
  }

  function loadUrlInTab(t, url) {
    if (!t || !t.webview) return;
    // If it's not a URL, treat as search
    const finalUrl = window.LyconNav ? window.LyconNav.resolveInput(url) : url;
    t.webview.loadURL(finalUrl).catch(err => {
      console.error('[Lycon] load failed', err);
    });
  }

  function closeTab(id) {
    const t = getTab(id);
    if (!t) return;
    if (t.webview) {
      t.webview.remove();
    }
    removeTab(id);
    if (state.tabs.length === 0) {
      // Always keep at least one tab
      createTab({ private: state.settings.privateTabDefault });
    } else {
      showTab(state.activeId);
    }
  }

  function showTab(id) {
    for (const t of state.tabs) {
      if (!t.webview) continue;
      if (t.id === id) t.webview.classList.remove('hidden');
      else t.webview.classList.add('hidden');
    }
    setActive(id);
    // Refresh nav and urlbar
    window.LyconNav && window.LyconNav.refreshNav();
    window.LyconShields && window.LyconShields.refresh();
  }

  // ---------------- Event wiring ----------------
  on('tab:added', renderTabs);
  on('tab:removed', renderTabs);
  on('tab:updated', (t) => updateTabEl(t));
  on('tab:active', (t) => {
    renderTabs();
    showTab(t.id);
  });
  on('tabs:reordered', renderTabs);
  on('tabs:empty', () => {
    // App handles creating a new tab
  });

  newTabBtn.addEventListener('click', () => createTab({ private: state.settings.privateTabDefault }));

  // External opener (e.g. window.open from main process)
  if (window.lycon && window.lycon.tabs) {
    window.lycon.tabs.onOpenRequested(({ url }) => {
      const active = getActive();
      createTab({ url, private: active && active.private });
    });
  }

  // Expose
  window.LyconTabs = {
    createTab, closeTab, showTab, loadUrlInTab, loadStartpage,
    getTab, getActive,
  };
})();
