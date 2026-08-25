/**
 * Lycon Browser — Downloads
 * Live download progress + persisted history. Sidebar shows the list.
 */
(function () {
  'use strict';

  const { state, emit } = window.LyconState;

  async function refresh() {
    if (!window.lycon) return;
    state.downloads = await window.lycon.downloads.list();
    emit('downloads:changed', state.downloads);
  }

  function fmtBytes(n) {
    if (!n || n < 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return n.toFixed(n < 10 ? 1 : 0) + ' ' + units[i];
  }

  function fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  // Hook live events
  if (window.lycon && window.lycon.downloads) {
    window.lycon.downloads.onNew((d) => {
      state.downloads = [d, ...state.downloads];
      emit('downloads:changed', state.downloads);
      emit('downloads:new', d);
    });
    window.lycon.downloads.onProgress((d) => {
      const idx = state.downloads.findIndex(x => x.id === d.id);
      if (idx >= 0) state.downloads[idx] = d;
      emit('downloads:progress', d);
    });
    window.lycon.downloads.onDone((d) => {
      const idx = state.downloads.findIndex(x => x.id === d.id);
      if (idx >= 0) state.downloads[idx] = d;
      emit('downloads:done', d);
    });
  }

  async function open(p) { if (window.lycon) await window.lycon.downloads.open(p); }
  async function show(p) { if (window.lycon) await window.lycon.downloads.show(p); }
  async function clear() {
    if (!window.lycon) return;
    state.downloads = await window.lycon.downloads.clear();
    emit('downloads:changed', state.downloads);
  }

  window.LyconDownloads = { refresh, open, show, clear, fmtBytes, fmtTime };
})();
