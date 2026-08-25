/**
 * Test: download manager
 * Downloads a file from the local test HTTP server and verifies:
 *   1. downloads:new event fires
 *   2. downloads:progress events fire (file is dripped slowly)
 *   3. downloads:done event fires with state='completed'
 *   4. File exists on disk and is non-empty
 *   5. Download appears in state.downloads list
 */
const _path = require('path');
const fs = require('fs');
const _os = require('os');

module.exports = {
  name: 'downloads',
  description: 'Download a file from the local test server, verify progress events and file on disk',
  run: async (api) => {
    const details = [];
    let pass = 0, fail = 0;

    const downloadUrl = `${api.testServerUrl}/download`;
    const _expectedFilename = 'lycon-test-download.txt';

    // Subscribe to download events via the renderer
    await api.exec(`(function(){
      window.__testDlEvents = { new: 0, progress: 0, done: 0, lastState: null };
      if (window.lycon && window.lycon.downloads) {
        window.lycon.downloads.onNew(() => window.__testDlEvents.new++);
        window.lycon.downloads.onProgress(() => window.__testDlEvents.progress++);
        window.lycon.downloads.onDone((d) => {
          window.__testDlEvents.done++;
          window.__testDlEvents.lastState = d.state;
          window.__testDlEvents.lastFilename = d.filename;
          window.__testDlEvents.lastSavePath = d.savePath;
        });
      }
      return true;
    })()`);

    // Trigger the download by navigating to the attachment URL
    const newTabId = await api.openNewTab(downloadUrl);
    if (!newTabId) {
      details.push({ name: 'Open download tab', ok: false, message: 'failed to open tab' });
      fail++;
      return { pass, fail, details };
    }

    // Wait up to 30s for the download to complete
    let done = false;
    let lastEventState = null;
    for (let i = 0; i < 60; i++) {
      await api.wait(500);
      const ev = await api.exec(`window.__testDlEvents`);
      if (ev && ev.done > 0) {
        done = true;
        lastEventState = ev;
        break;
      }
    }

    if (!done) {
      details.push({ name: 'Download completes within 30s', ok: false, message: 'timed out waiting for download' });
      fail++;
      await api.screenshot('downloads-timeout');
      return { pass, fail, details };
    }
    details.push({ name: 'Download completes within 30s', ok: true });
    pass++;

    // Verify events fired
    if (lastEventState.new >= 1) {
      details.push({ name: 'downloads:new event fired', ok: true, message: `count=${lastEventState.new}` });
      pass++;
    } else {
      details.push({ name: 'downloads:new event fired', ok: false, message: `count=${lastEventState.new}` });
      fail++;
    }

    if (lastEventState.progress >= 1) {
      details.push({ name: 'downloads:progress event(s) fired', ok: true, message: `count=${lastEventState.progress}` });
      pass++;
    } else {
      details.push({ name: 'downloads:progress event(s) fired', ok: false, message: `count=${lastEventState.progress}` });
      fail++;
    }

    if (lastEventState.done === 1) {
      details.push({ name: 'downloads:done event fired once', ok: true });
      pass++;
    } else {
      details.push({ name: 'downloads:done event fired once', ok: false, message: `count=${lastEventState.done}` });
      fail++;
    }

    if (lastEventState.lastState === 'completed') {
      details.push({ name: 'final state = completed', ok: true });
      pass++;
    } else {
      details.push({ name: 'final state = completed', ok: false, message: `state=${lastEventState.lastState}` });
      fail++;
    }

    // Verify the file exists on disk
    const savePath = lastEventState.lastSavePath;
    if (savePath && fs.existsSync(savePath)) {
      const stats = fs.statSync(savePath);
      details.push({ name: 'File exists on disk', ok: true, message: `${savePath} (${stats.size} bytes)` });
      pass++;
      if (stats.size > 0) {
        details.push({ name: 'File is non-empty', ok: true, message: `${stats.size} bytes` });
        pass++;
      } else {
        details.push({ name: 'File is non-empty', ok: false, message: '0 bytes' });
        fail++;
      }
    } else {
      details.push({ name: 'File exists on disk', ok: false, message: `path=${savePath}` });
      fail++;
    }

    // Verify the download shows up in the downloads list state
    const downloads = await api.downloads();
    if (downloads && downloads.length > 0) {
      details.push({ name: 'Download appears in state.downloads', ok: true, message: `${downloads.length} entries` });
      pass++;
    } else {
      details.push({ name: 'Download appears in state.downloads', ok: false, message: `${downloads ? downloads.length : 0} entries` });
      fail++;
    }

    await api.screenshot('downloads-1-final');

    return { pass, fail, details };
  },
};
