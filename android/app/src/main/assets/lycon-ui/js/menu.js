/**
 * Lycon Browser — Menu dropdown
 * Top-right ☰ menu with shortcuts to all features.
 */
(function () {
  'use strict';

  const menu = document.getElementById('menu-dropdown');
  const menuBtn = document.getElementById('act-menu');

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('hidden') && !menu.contains(e.target) && e.target !== menuBtn) {
      menu.classList.add('hidden');
    }
  });

  menu.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    menu.classList.add('hidden');
    handle(action);
  });

  function handle(action) {
    const { getActive } = window.LyconState;
    switch (action) {
      case 'new-tab':
        window.LyconTabs.createTab({ private: window.LyconState.state.settings.privateTabDefault });
        break;
      case 'new-private':
        window.LyconPrivate.createPrivateTab();
        break;
      case 'find':
        window.LyconFinder.open();
        break;
      case 'downloads':
        window.LyconSidebar.open('downloads');
        break;
      case 'bookmarks':
        window.LyconSidebar.open('bookmarks');
        break;
      case 'history':
        window.LyconSidebar.open('history');
        break;
      case 'devtools': {
        const t = getActive();
        if (t && t.webview) {
          if (t.webview.isDevToolsOpened()) t.webview.closeDevTools();
          else t.webview.openDevTools();
        }
        break;
      }
      case 'screenshot': {
        const t = getActive();
        if (t && t.webview) {
          t.webview.capturePage().then((img) => {
            // Save via download
            const a = document.createElement('a');
            a.href = img.toDataURL();
            a.download = 'lycon-screenshot-' + Date.now() + '.png';
            a.click();
          });
        }
        break;
      }
      case 'settings':
        window.LyconSettings.open();
        break;
      case 'about':
        window.LyconSettings.open();
        break;
    }
  }
})();
