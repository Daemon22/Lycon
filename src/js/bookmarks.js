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
    if (t && t.url && isBookmarked(t.url)) {
      btn.classList.add('active');
      btn.textContent = '★';
      btn.title = 'Remove bookmark';
    } else {
      btn.classList.remove('active');
      btn.textContent = '☆';
      btn.title = 'Bookmark this page';
    }
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
