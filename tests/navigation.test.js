/**
 * Test: navigation
 * Visits 3 real websites and verifies each loads with correct URL + title.
 */
const _path = require('path');

module.exports = {
  name: 'navigation',
  description: 'Visit example.com, wikipedia.org, and github.com — verify each loads',
  run: async (api) => {
    const sites = [
      { url: 'https://example.com', expectTitleIncludes: 'Example Domain', expectUrlIncludes: 'example.com' },
      { url: 'https://www.wikipedia.org', expectTitleIncludes: 'Wikipedia', expectUrlIncludes: 'wikipedia.org' },
      { url: 'https://github.com', expectTitleIncludes: 'GitHub', expectUrlIncludes: 'github.com' },
    ];

    const details = [];
    let pass = 0, fail = 0;

    for (let i = 0; i < sites.length; i++) {
      const site = sites[i];
      // Close all tabs except the first (start page) before opening a new one
      // to avoid running too many render processes simultaneously.
      const tabs = await api.tabCount();
      for (let j = tabs; j > 1; j--) {
        await api.closeActiveTab();
        await api.wait(200);
      }
      // Open a new tab with this URL
      const newTabId = await api.openNewTab(site.url);
      if (!newTabId) {
        details.push({ name: `${site.url} loads`, ok: false, message: 'failed to open new tab' });
        fail++;
        continue;
      }
      // Wait for it to load
      let _loaded;
      try {
        _loaded = await api.waitForTabLoad(30000);
      } catch (e) {
        details.push({ name: `${site.url} loads`, ok: false, message: e.message });
        fail++;
        continue;
      }
      // Give a moment for title to update
      await api.wait(1500);
      const tab = await api.activeTab();

      const urlOk = tab.url && tab.url.includes(site.expectUrlIncludes);
      const titleOk = tab.title && tab.title.toLowerCase().includes(site.expectTitleIncludes.toLowerCase());
      const notLoading = !tab.loading;

      if (urlOk && titleOk && notLoading) {
        details.push({
          name: `${site.url} → "${tab.title}"`,
          ok: true,
          message: `url=${tab.url}`,
        });
        pass++;
      } else {
        details.push({
          name: `${site.url}`,
          ok: false,
          message: `url=${tab.url} (expected includes "${site.expectUrlIncludes}"), title="${tab.title}" (expected includes "${site.expectTitleIncludes}"), loading=${tab.loading}`,
        });
        fail++;
      }

      // Capture screenshot
      await api.screenshot(`navigation-${i + 1}-${site.url.replace(/^https?:\/\//, '').replace(/[/.]/g, '_')}`);
    }

    return { pass, fail, details };
  },
};
