/**
 * Test: single-tab smoke
 * Opens ONE tab to example.com — minimal test to debug crash issue.
 */
module.exports = {
  name: 'single-tab',
  description: 'Open a single tab to example.com',
  run: async (api) => {
    const details = [];
    let pass = 0, fail = 0;

    const newId = await api.openNewTab('https://example.com');
    if (!newId) {
      details.push({ name: 'open new tab', ok: false, message: 'no new tab id returned' });
      fail++;
      return { pass, fail, details };
    }
    try {
      const _loaded = await api.waitForTabLoad(30000);
      await api.wait(2000);
      const tab = await api.activeTab();
      if (tab.url && tab.url.includes('example.com') && tab.title && !tab.title.includes('Crash')) {
        details.push({ name: 'example.com loads in single new tab', ok: true, message: `title="${tab.title}", url=${tab.url}` });
        pass++;
      } else {
        details.push({ name: 'example.com loads in single new tab', ok: false, message: `title="${tab.title}", url=${tab.url}` });
        fail++;
      }
      await api.screenshot('single-tab-example');
    } catch (e) {
      details.push({ name: 'example.com loads', ok: false, message: e.message });
      fail++;
    }
    return { pass, fail, details };
  },
};
