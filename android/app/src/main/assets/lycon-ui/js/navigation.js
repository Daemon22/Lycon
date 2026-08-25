/**
 * Lycon Browser — Navigation
 * URL bar, back/forward/reload/home, smart URL/search resolution.
 */
(function () {
  'use strict';

  const urlbar = document.getElementById('urlbar');
  const backBtn = document.getElementById('nav-back');
  const fwdBtn = document.getElementById('nav-forward');
  const reloadBtn = document.getElementById('nav-reload');
  const homeBtn = document.getElementById('nav-home');

  const { state, on, getActive } = window.LyconState;

  // ---------------- Input resolution ----------------
  const URL_RE = /^(https?:\/\/|file:\/\/|lycon-startpage:\/\/|about:)/i;
  const DOMAIN_RE = /^([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/.*)?$/i;
  const IP_RE = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/.*)?$/;
  const LOCALHOST_RE = /^localhost(:\d+)?(\/.*)?$/i;

  function resolveInput(text) {
    text = (text || '').trim();
    if (!text) return '';
    if (URL_RE.test(text)) return text;
    if (text.startsWith('//')) return 'https:' + text;
    if (DOMAIN_RE.test(text) || IP_RE.test(text) || LOCALHOST_RE.test(text)) {
      return 'https://' + text;
    }
    // Otherwise treat as a search query
    const engine = state.settings.searchEngine || 'duckduckgo';
    const engines = state.searchEngines || {};
    const eng = engines[engine] || { url: 'https://duckduckgo.com/?q=%s' };
    return eng.url.replace('%s', encodeURIComponent(text));
  }

  // ---------------- UI events ----------------
  function commit() {
    const text = urlbar.value.trim();
    if (!text) return;
    const t = getActive();
    if (!t) return;
    const url = resolveInput(text);
    urlbar.value = url;
    if (window.LyconTabs) window.LyconTabs.loadUrlInTab(t, url);
  }

  urlbar.addEventListener('focus', () => urlbar.select());
  urlbar.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') {
      e.preventDefault();
      const t = getActive();
      urlbar.value = t ? (t.url || '') : '';
      urlbar.blur();
    }
  });

  backBtn.addEventListener('click', () => {
    const t = getActive();
    if (t && t.webview) {
      if (t.webview.canGoBack()) t.webview.goBack();
      else if (t.historyIdx > 0) {
        t.historyIdx--;
        t.webview.loadURL(t.history[t.historyIdx]);
      }
    }
  });

  fwdBtn.addEventListener('click', () => {
    const t = getActive();
    if (t && t.webview) {
      if (t.webview.canGoForward()) t.webview.goForward();
      else if (t.historyIdx < t.history.length - 1) {
        t.historyIdx++;
        t.webview.loadURL(t.history[t.historyIdx]);
      }
    }
  });

  reloadBtn.addEventListener('click', (e) => {
    const t = getActive();
    if (t && t.webview) {
      if (e.shiftKey) t.webview.reloadIgnoringCache();
      else t.webview.reload();
    }
  });

  homeBtn.addEventListener('click', () => {
    const t = getActive();
    if (!t) return;
    if (window.LyconTabs) window.LyconTabs.loadStartpage(t);
  });

  // ---------------- Refresh UI on tab change ----------------
  function refreshNav() {
    const t = getActive();
    if (!t) {
      urlbar.value = '';
      backBtn.disabled = true;
      fwdBtn.disabled = true;
      updateSecurityIndicator('');
      return;
    }
    // Hide startpage/internal URLs from the URL bar
    const url = t.url || '';
    const isStartpage = url.includes('startpage.html') || url.startsWith('about:') || url.startsWith('data:');
    urlbar.value = isStartpage ? '' : url;
    // Update security indicator
    updateSecurityIndicator(isStartpage ? '' : url);
    // Guard: only call webview methods after dom-ready
    if (!t.domReady) {
      backBtn.disabled = true;
      fwdBtn.disabled = true;
      return;
    }
    try {
      backBtn.disabled = !t.webview.canGoBack() && t.historyIdx <= 0;
      fwdBtn.disabled = !t.webview.canGoForward() && t.historyIdx >= t.history.length - 1;
    } catch {
      backBtn.disabled = true;
      fwdBtn.disabled = true;
    }
  }

  function updateSecurityIndicator(url) {
    const lock = document.getElementById('sec-icon-lock');
    const info = document.getElementById('sec-icon-info');
    const warn = document.getElementById('sec-icon-warning');
    const wrap = document.getElementById('urlbar-security');
    if (!lock || !info || !warn) return;
    lock.style.display = 'none';
    info.style.display = 'none';
    warn.style.display = 'none';
    if (!url) {
      info.style.display = '';
      wrap.style.color = 'var(--fg-muted)';
      wrap.title = 'Lycon Start Page';
    } else if (url.startsWith('https://')) {
      lock.style.display = '';
      wrap.style.color = 'var(--success)';
      wrap.title = 'Secure HTTPS connection';
    } else if (url.startsWith('http://')) {
      warn.style.display = '';
      wrap.style.color = 'var(--warning)';
      wrap.title = 'Insecure HTTP — Lycon HTTPS-Only mode will upgrade this';
    } else if (url.startsWith('file://')) {
      info.style.display = '';
      wrap.style.color = 'var(--fg-muted)';
      wrap.title = 'Local file';
    } else {
      info.style.display = '';
      wrap.style.color = 'var(--fg-muted)';
      wrap.title = url;
    }
  }

  on('tab:active', refreshNav);
  on('tab:updated', refreshNav);

  // Expose
  window.LyconNav = { resolveInput, refreshNav, commit };
})();
