/**
 * Lycon Browser — Find in Page
 * Ctrl+F bar that uses webview.findInPage / stopFindInPage.
 */
(function () {
  'use strict';

  const findbar = document.getElementById('findbar');
  const input = document.getElementById('find-input');
  const nextBtn = document.getElementById('find-next');
  const prevBtn = document.getElementById('find-prev');
  const closeBtn = document.getElementById('find-close');
  const countEl = document.getElementById('find-count');

  const { getActive } = window.LyconState;

  let active = false;
  let _requestId = 0;
  let lastResult = { activeMatchOrdinal: 0, matches: 0 };

  function open() {
    if (active) { input.focus(); input.select(); return; }
    active = true;
    findbar.classList.remove('hidden');
    input.value = '';
    countEl.textContent = '0/0';
    input.focus();
  }

  function close() {
    if (!active) return;
    active = false;
    findbar.classList.add('hidden');
    const t = getActive();
    if (t && t.webview) t.webview.stopFindInPage('clearSelection');
  }

  function find(forward = true) {
    const t = getActive();
    if (!t || !t.webview) return;
    const text = input.value;
    if (!text) {
      countEl.textContent = '0/0';
      t.webview.stopFindInPage('clearSelection');
      return;
    }
    _requestId = t.webview.findInPage(text, { forward, findNext: false });
  }

  input.addEventListener('input', () => find(true));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      find(!e.shiftKey);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });
  nextBtn.addEventListener('click', () => find(true));
  prevBtn.addEventListener('click', () => find(false));
  closeBtn.addEventListener('click', close);

  // Listen for find results
  document.addEventListener('webkitbrowser-find-in-page-results-updated' , () => {});
  // For webview tag, listen on the element
  document.addEventListener('did-get-find-in-page-results', (_e) => {
    // Not standard; rely on webview's 'found-in-page'
  });

  // Wire found-in-page events to all webviews dynamically
  function attach(webview) {
    if (webview.__findWired) return;
    webview.__findWired = true;
    webview.addEventListener('found-in-page', (e) => {
      lastResult = {
        activeMatchOrdinal: e.activeMatchOrdinal || 0,
        matches: e.matches || 0,
      };
      countEl.textContent = `${lastResult.activeMatchOrdinal}/${lastResult.matches}`;
    });
  }
  // Attach to existing webviews and watch for new ones
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.tagName === 'WEBVIEW') attach(node);
      }
    }
  });
  observer.observe(document.getElementById('content'), { childList: true });

  // Keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      open();
    } else if (e.key === 'F3' || ((e.ctrlKey || e.metaKey) && e.key === 'g')) {
      e.preventDefault();
      if (active) find(!e.shiftKey);
    }
  });

  window.LyconFinder = { open, close };
})();
