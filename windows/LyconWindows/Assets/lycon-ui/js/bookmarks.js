/**
 * Lycon Browser — Bookmarks
 * Add / list / remove bookmarks. Stored in main process JSON.
 */
(function () {
  'use strict';

  const { state, on, getActive, emit } = window.LyconState;

  async function refresh() {
    if (!window.lycon) return;
    state.bookmarks = await window.lycon.bookmarks.list();
    emit('bookmarks:changed', state.bookmarks);
  }

  async function addCurrent() {
    const t = getActive();
    if (!t || !t.url) return;
    await window.lycon.bookmarks.add({
      url: t.url,
      title: t.title || t.url,
      favicon: t.favicon || '',
    });
    await refresh();
    // Update the URL bar bookmark indicator
    updateUrlbarBookmark();
  }

  async function remove(id) {
    await window.lycon.bookmarks.remove(id);
    await refresh();
  }

  function isBookmarked(url) {
    return state.bookmarks.some(b => b.url === url);
  }

  function updateUrlbarBookmark() {
    const t = getActive();
    const btn = document.getElementById('urlbar-bookmark');
    if (!btn) return;
    const saved = Boolean(t && t.url && isBookmarked(t.url));
    btn.classList.toggle('active', saved);
    btn.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>';
    btn.title = saved ? 'Remove bookmark' : 'Bookmark this page';
    btn.setAttribute('aria-label', saved ? 'Remove bookmark' : 'Bookmark this page');
  }

  document.getElementById('urlbar-bookmark').addEventListener('click', async () => {
    const t = getActive();
    if (!t || !t.url) return;
    const existing = state.bookmarks.find(b => b.url === t.url);
    if (existing) {
      await remove(existing.id);
    } else {
      await addCurrent();
    }
  });

  on('tab:active', updateUrlbarBookmark);
  on('tab:updated', updateUrlbarBookmark);
  on('bookmarks:changed', updateUrlbarBookmark);

  window.LyconBookmarks = { refresh, remove, isBookmarked, addCurrent };
})();
