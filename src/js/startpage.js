/**
 * Lycon Browser — Start Page
 * Loads src/startpage.html as a file:// URL with settings as query params.
 */
(function () {
  'use strict';

  const { state } = window.LyconState;

  function url() {
    const s = state.settings;
    // The renderer is loaded from src/index.html, so startpage.html is in the same dir.
    const base = window.location.href.replace(/index\.html.*$/, 'startpage.html');
    const params = new URLSearchParams({
      engine: s.searchEngine || 'duckduckgo',
      accent: s.accent || 'orange',
      theme: s.theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : (s.theme || 'dark'),
    });
    return base + '?' + params.toString();
  }

  window.LyconStartpage = { url };
})();
