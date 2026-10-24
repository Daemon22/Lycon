/**
 * Test: shields (ad/tracker blocker)
 * Visits a known ad-heavy site and verifies the per-tab blocked count
 * increments above zero.
 */
module.exports = {
  name: 'shields',
  description: 'Visit ad-heavy site, verify Lycon Shields blocks requests',
  run: async (api) => {
    const details = [];
    let pass = 0, fail = 0;

    // First, verify shields are enabled in settings
    const shieldsOn = await api.exec(`window.LyconState.state.settings.shieldsEnabled === true`);
    if (shieldsOn) {
      details.push({ name: 'Shields enabled by default', ok: true });
      pass++;
    } else {
      details.push({ name: 'Shields enabled by default', ok: false, message: 'shieldsEnabled=false' });
      fail++;
    }

    // Check that the blocker was actually set up by querying the main process
    const status = await api.exec(`window.lycon.shields.status()`);
    if (status && status.blockerLoaded) {
      details.push({ name: 'Blocker loaded in main process', ok: true, message: `totalBlocked=${status.totalBlocked}` });
      pass++;
    } else {
      details.push({ name: 'Blocker loaded in main process', ok: false, message: JSON.stringify(status) });
      fail++;
    }

    // Visit a site known to have ads/trackers.
    // Try several — some sites have switched to first-party ads.
    // theverge.com, bbc.com, cnn.com all have third-party trackers.
    const testUrl = 'https://www.theverge.com';

    // Open a fresh tab so counters are zero
    const newTabId = await api.openNewTab(testUrl);
    if (!newTabId) {
      details.push({ name: 'open tab', ok: false, message: 'failed to open tab' });
      fail++;
      return { pass, fail, details };
    }

    try {
      await api.waitForTabLoad(45000);
    } catch (e) {
      details.push({ name: 'Tab loads', ok: false, message: e.message });
      fail++;
      return { pass, fail, details };
    }

    // Give the page 12 seconds to fire all its third-party requests
    await api.wait(12000);

    // Capture screenshot of the loaded page with shields active
    await api.screenshot('shields-1-site-loaded');

    // Read the per-tab shield counter AND the global total from main
    const count = await api.shieldsCount();
    const mainStatus = await api.exec(`window.lycon.shields.status()`);

    if (count > 0 || (mainStatus && mainStatus.totalBlocked > 0)) {
      const total = mainStatus ? mainStatus.totalBlocked : count;
      details.push({ name: `Lycon Shields blocked requests`, ok: true, message: `${total} total requests blocked (per-tab=${count})` });
      pass++;
    } else {
      // Try one more site known to have many trackers
      const newId2 = await api.openNewTab('https://www.cnn.com');
      if (newId2) {
        try { await api.waitForTabLoad(45000); } catch {}
        await api.wait(12000);
      }
      const count2 = await api.shieldsCount();
      const mainStatus2 = await api.exec(`window.lycon.shields.status()`);
      const total2 = mainStatus2 ? mainStatus2.totalBlocked : count2;
      if (count2 > 0 || total2 > 0) {
        details.push({ name: `Lycon Shields blocked requests (cnn fallback)`, ok: true, message: `${total2} total blocked (per-tab=${count2})` });
        pass++;
      } else {
        details.push({ name: `Lycon Shields blocked requests`, ok: false, message: `per-tab=${count2}, total=${total2} — blocker may not be engaging on these sites` });
        fail++;
      }
    }

    // Verify the shields badge in the URL bar shows the count
    const badgeText = await api.exec(`document.getElementById('shields-count').textContent`);
    if (badgeText === String(count)) {
      details.push({ name: 'URL bar badge matches counter', ok: true, message: `badge="${badgeText}"` });
      pass++;
    } else {
      details.push({ name: 'URL bar badge matches counter', ok: false, message: `badge="${badgeText}", expected="${count}"` });
      fail++;
    }

    return { pass, fail, details };
  },
};
