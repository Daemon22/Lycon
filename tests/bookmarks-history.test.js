/**
 * Test: bookmarks + history
 * Adds a bookmark, verifies it appears in the bookmarks list,
 * removes it, verifies removal. Visits a real site, verifies
 * history tracking adds an entry, then clears history.
 */
module.exports = {
  name: 'bookmarks-history',
  description: 'Bookmark add/remove + history tracking + clear',
  run: async (api) => {
    const details = [];
    let pass = 0, fail = 0;

    // ----- Bookmark add -----
    const initialBookmarks = await api.bookmarks();
    const bm = { url: 'https://lycon-test.local/example', title: 'Lycon Test Page', favicon: '' };
    // Use the renderer's LyconBookmarks.addCurrent-style flow:
    // call IPC directly, then refresh state
    await api.exec(`window.lycon.bookmarks.add(${JSON.stringify(bm)})`);
    // Manually refresh the renderer's bookmarks state (return a promise we can await)
    await api.exec(`window.LyconBookmarks.refresh()`);
    await api.wait(500);
    const afterAdd = await api.bookmarks();
    const added = afterAdd.find(b => b.url === bm.url);
    if (added) {
      details.push({ name: 'Bookmark added', ok: true, message: `id=${added.id}, total=${afterAdd.length}` });
      pass++;
    } else {
      details.push({ name: 'Bookmark added', ok: false, message: `not found in list (initial=${initialBookmarks.length}, after=${afterAdd.length})` });
      fail++;
    }

    // ----- Bookmark remove -----
    if (added) {
      await api.exec(`window.lycon.bookmarks.remove(${JSON.stringify(added.id)})`);
      await api.exec(`window.LyconBookmarks.refresh()`);
      await api.wait(500);
      const afterRemove = await api.bookmarks();
      const stillThere = afterRemove.find(b => b.id === added.id);
      if (!stillThere) {
        details.push({ name: 'Bookmark removed', ok: true, message: `total=${afterRemove.length}` });
        pass++;
      } else {
        details.push({ name: 'Bookmark removed', ok: false });
        fail++;
      }
    }

    // ----- History tracking -----
    const beforeHistory = await api.history();
    // Visit a real site — close other tabs first to ensure fresh load
    const tabs = await api.tabCount();
    for (let j = tabs; j > 1; j--) {
      await api.closeActiveTab();
      await api.wait(200);
    }
    const newTabId = await api.openNewTab('https://example.com');
    if (!newTabId) {
      details.push({ name: 'Open tab for history test', ok: false, message: 'failed to open tab' });
      fail++;
      return { pass, fail, details };
    }
    try {
      await api.waitForTabLoad(30000);
    } catch (e) {
      details.push({ name: 'Visit example.com for history test', ok: false, message: e.message });
      fail++;
      return { pass, fail, details };
    }
    // Give history a moment to be written
    await api.wait(2000);

    const afterHistory = await api.history();
    const found = afterHistory.find(h => h.url && h.url.includes('example.com'));
    if (found) {
      details.push({ name: 'History entry created after visit', ok: true, message: `url=${found.url}, title="${found.title}"` });
      pass++;
    } else {
      details.push({ name: 'History entry created after visit', ok: false, message: `before=${beforeHistory.length}, after=${afterHistory.length}` });
      fail++;
    }

    // ----- Clear history -----
    await api.exec(`window.LyconHistory.clear()`);
    await api.wait(500);
    const clearedHistory = await api.history();
    if (clearedHistory.length === 0) {
      details.push({ name: 'History cleared', ok: true });
      pass++;
    } else {
      details.push({ name: 'History cleared', ok: false, message: `${clearedHistory.length} entries remain` });
      fail++;
    }

    await api.screenshot('bookmarks-history-final');

    return { pass, fail, details };
  },
};
