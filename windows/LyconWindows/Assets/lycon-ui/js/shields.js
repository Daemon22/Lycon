/**
 * Lycon Browser — Shields (ad/tracker blocker UI)
 * Tracks per-tab blocked counts and displays in the URL bar.
 */
(function () {
  'use strict';

  const shieldsBtn = document.getElementById('shields-btn');
  const shieldsCount = document.getElementById('shields-count');

  const { state, on, getActive } = window.LyconState;

  // Map webContentsId -> tabId, so we can attribute blocked requests to tabs
  const wcIdToTabId = new Map();

  function registerTab(t) {
    if (!t.webview) {
      // Webview not created yet — retry shortly
      setTimeout(() => registerTab(t), 100);
      return;
    }
    // getWebContentsId only works after dom-ready
    const onReady = () => {
      try {
        const wcId = t.webview.getWebContentsId();
        if (wcId != null) {
          wcIdToTabId.set(wcId, t.id);
        }
      } catch { /* not ready */ }
    };
    if (t.domReady) onReady();
    else {
      t.webview.addEventListener('dom-ready', onReady, { once: true });
      // Also retry — dom-ready may have fired before our listener attached
      setTimeout(onReady, 200);
      setTimeout(onReady, 500);
      setTimeout(onReady, 1500);
      setTimeout(onReady, 3000);
    }
  }

  function render() {
    const t = getActive();
    const count = t ? (state.shieldsPerTab.get(t.id) || 0) : 0;
    shieldsCount.textContent = count;
    if (state.settings.shieldsEnabled) {
      shieldsBtn.classList.remove('off');
      shieldsBtn.title = `Lycon Shields ON — ${count} ads/trackers blocked on this tab. Click to disable.`;
    } else {
      shieldsBtn.classList.add('off');
      shieldsCount.textContent = '';
      shieldsBtn.title = 'Lycon Shields OFF — click to enable';
    }
  }

  shieldsBtn.addEventListener('click', () => {
    const enabled = !state.settings.shieldsEnabled;
    if (window.lycon && window.lycon.shields) {
      window.lycon.shields.toggle(enabled).then(newSettings => {
        Object.assign(state.settings, newSettings);
        render();
      });
    }
  });

  // Increment per-tab counter when a block happens
  if (window.lycon && window.lycon.shields) {
    window.lycon.shields.onBlocked(({ tabId }) => {
      // tabId is the webContentsId; map back to our tab id
      const lyconTabId = wcIdToTabId.get(tabId);
      if (!lyconTabId) return;
      const cur = state.shieldsPerTab.get(lyconTabId) || 0;
      state.shieldsPerTab.set(lyconTabId, cur + 1);
      state.shieldsBlocked++;
      // Only re-render if it happened on the active tab
      const active = getActive();
      if (active && active.id === lyconTabId) render();
    });
  }

  // HTTPS upgrade indicator
  if (window.lycon && window.lycon.https) {
    window.lycon.https.onUpgraded(({ from, to }) => {
      console.info('[Lycon Shields] HTTPS upgrade:', from, '->', to);
    });
  }

  on('tab:added', (t) => registerTab(t));
  on('tab:active', render);
  on('tab:removed', (t) => {
    state.shieldsPerTab.delete(t.id);
    // Clean up the wcId map entries pointing to this tab
    for (const [wcId, tabId] of wcIdToTabId) {
      if (tabId === t.id) wcIdToTabId.delete(wcId);
    }
  });

  // Register any tabs that already exist (in case shields.js loaded after first tab was created)
  if (window.LyconState && window.LyconState.state.tabs) {
    for (const t of window.LyconState.state.tabs) {
      registerTab(t);
    }
  }

  function refresh() { render(); }

  window.LyconShields = { refresh, render, registerTab };
})();
