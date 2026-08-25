/**
 * Lycon Browser — App orchestration
 * Wires global keyboard shortcuts, window controls, and the initial tab.
 */
(function () {
  'use strict';

  const { state, on: _on, getActive } = window.LyconState;

  // ---------- Global shortcuts ----------
  document.addEventListener('keydown', (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    // Ctrl+T — new tab
    if (ctrl && !shift && e.key === 't') {
      e.preventDefault();
      window.LyconTabs.createTab({ private: state.settings.privateTabDefault });
      return;
    }
    // Ctrl+Shift+P — new private tab
    if (ctrl && shift && (e.key === 'P' || e.key === 'p')) {
      e.preventDefault();
      window.LyconPrivate.createPrivateTab();
      return;
    }
    // Ctrl+W — close tab
    if (ctrl && !shift && e.key === 'w') {
      e.preventDefault();
      const t = getActive();
      if (t) window.LyconTabs.closeTab(t.id);
      return;
    }
    // Ctrl+Tab / Ctrl+Shift+Tab — cycle tabs
    if (ctrl && e.key === 'Tab') {
      e.preventDefault();
      const tabs = state.tabs;
      if (tabs.length < 2) return;
      const idx = tabs.findIndex(t => t.id === state.activeId);
      const next = shift ? (idx - 1 + tabs.length) % tabs.length : (idx + 1) % tabs.length;
      window.LyconTabs.showTab(tabs[next].id);
      return;
    }
    // Ctrl+L — focus URL bar
    if (ctrl && !shift && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault();
      document.getElementById('urlbar').focus();
      return;
    }
    // Ctrl+R / F5 — reload
    if ((ctrl && !shift && e.key === 'r') || e.key === 'F5') {
      e.preventDefault();
      const t = getActive();
      if (t && t.webview) t.webview.reload();
      return;
    }
    // Ctrl+J — downloads
    if (ctrl && !shift && e.key === 'j') {
      e.preventDefault();
      window.LyconSidebar.open('downloads');
      return;
    }
    // Ctrl+B — bookmarks
    if (ctrl && !shift && e.key === 'b') {
      e.preventDefault();
      window.LyconSidebar.open('bookmarks');
      return;
    }
    // Ctrl+H — history
    if (ctrl && !shift && e.key === 'h') {
      e.preventDefault();
      window.LyconSidebar.open('history');
      return;
    }
    // Ctrl+F — find in page (handled in finder.js)
    // F12 — toggle devtools
    if (e.key === 'F12') {
      e.preventDefault();
      const t = getActive();
      if (t && t.webview) {
        if (t.webview.isDevToolsOpened()) t.webview.closeDevTools();
        else t.webview.openDevTools();
      }
      return;
    }
    // Ctrl+, — settings
    if (ctrl && e.key === ',') {
      e.preventDefault();
      window.LyconSettings.open();
      return;
    }
    // Escape — close modals / sidebar / menu
    if (e.key === 'Escape') {
      document.getElementById('modal-host').classList.add('hidden');
      document.getElementById('sidebar').classList.add('hidden');
      document.getElementById('menu-dropdown').classList.add('hidden');
      document.getElementById('findbar').classList.add('hidden');
    }
  });

  // ---------- Window controls ----------
  if (window.lycon && window.lycon.window) {
    document.getElementById('win-min').addEventListener('click', () => window.lycon.window.minimize());
    document.getElementById('win-max').addEventListener('click', () => window.lycon.window.maximize());
    document.getElementById('win-close').addEventListener('click', () => window.lycon.window.close());
  }

  // Hide window controls on macOS (uses native traffic lights)
  if (window.lycon && window.lycon.platform === 'darwin') {
    document.querySelector('.titlebar-actions').style.display = 'none';
  }

  // ---------- Init ----------
  async function init() {
    // Load settings + search engines
    if (window.lycon) {
      const s = await window.lycon.settings.get();
      Object.assign(state.settings, s);
      state.searchEngines = await window.lycon.search.list();
    }

    // Apply theme
    if (window.LyconSettings) window.LyconSettings.applyTheme();

    // Load bookmarks/history/downloads in background
    if (window.LyconBookmarks) await window.LyconBookmarks.refresh();
    if (window.LyconHistory)   await window.LyconHistory.refresh();
    if (window.LyconDownloads) await window.LyconDownloads.refresh();

    // Create the first tab (start page or initial URL from env / args)
    if (window.LyconTabs) {
      const initialUrl = window.lycon && window.lycon.initialUrl;
      if (initialUrl) {
        window.LyconTabs.createTab({ url: initialUrl, private: state.settings.privateTabDefault });
      } else {
        window.LyconTabs.createTab({ private: state.settings.privateTabDefault });
      }
    }

    // Focus URL bar after a moment
    setTimeout(() => {
      const ub = document.getElementById('urlbar');
      if (ub) ub.focus();
    }, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
