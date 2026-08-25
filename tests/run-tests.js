/**
 * Lycon Browser — Test Harness
 *
 * A standalone Electron main process that launches the real Lycon app,
 * then drives it via webContents.executeJavaScript() and IPC, and verifies
 * behavior. Each test produces a screenshot + a JSON report.
 *
 * Usage:
 *   node tests/run-tests.js [test-name]
 *
 * Tests are defined in ./tests/*.test.js — each exports
 *   { name, description, run(api) -> Promise<{pass, fail, details}> }
 *
 * The `api` exposes:
 *   - api.window            — the BrowserWindow running Lycon
 *   - api.exec(js)          — execute JS in the renderer, return result
 *   - api.screenshot(name)  — capture screenshot, save to download/
 *   - api.wait(ms)          — sleep
 *   - api.waitForTabLoad(timeoutMs)
 *                          — wait until active tab finishes loading
 *   - api.activeTab()       — {id, url, title, loading}
 *   - api.tabCount()        — number of open tabs
 *   - api.shieldsCount()    — active tab blocked count
 *   - api.history()         — browsing history list
 *   - api.bookmarks()       — bookmarks list
 *   - api.downloads()       — downloads list
 *   - api.sendKey(key, modifiers) — synthetic keyboard input to renderer
 *   - api.typeInUrlbar(text)      — focus URL bar, clear, type, press Enter
 *   - api.openNewTab(url)         — open a tab via the renderer API
 *   - api.closeActiveTab()
 */
const { app, BrowserWindow, ipcMain: _ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

const _ROOT = path.resolve(__dirname, '..');
const OUT_DIR = '/home/z/my-project/download/lycon-tests';
fs.mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Local test HTTP server — serves files with Content-Disposition: attachment
// so we can reliably test downloads without depending on external sites.
// ---------------------------------------------------------------------------
let testServer = null;
const TEST_FILE_CONTENT = Buffer.from('Lycon test download — '.repeat(500));
const TEST_FILE_NAME = 'lycon-test-download.txt';
const TEST_PORT = 18923;

function startTestServer() {
  return new Promise((resolve) => {
    testServer = http.createServer((req, res) => {
      const url = req.url;
      if (url === '/download') {
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${TEST_FILE_NAME}"`,
          'Content-Length': TEST_FILE_CONTENT.length,
        });
        // Slow drip to ensure progress events fire
        const chunkSize = 1024;
        let offset = 0;
        const interval = setInterval(() => {
          const end = Math.min(offset + chunkSize, TEST_FILE_CONTENT.length);
          res.write(TEST_FILE_CONTENT.slice(offset, end));
          offset = end;
          if (offset >= TEST_FILE_CONTENT.length) {
            clearInterval(interval);
            res.end();
          }
        }, 10);
      } else if (url === '/large-download') {
        // ~500KB file for shields/timing tests
        const big = Buffer.alloc(500 * 1024, 'X');
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="lycon-large.bin"`,
          'Content-Length': big.length,
        });
        res.end(big);
      } else if (url === '/page') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html><html><head><title>Lycon Test Page</title></head>
          <body><h1>Hello from Lycon test server</h1>
          <p>This page was served from localhost:${TEST_PORT}.</p>
          <a href="/download">Download small file</a><br>
          <a href="/large-download">Download large file</a>
          </body></html>`);
      } else if (url === '/ad') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end('console.log("this is an ad script");');
      } else {
        res.writeHead(404);
        res.end('not found');
      }
    });
    testServer.listen(TEST_PORT, '127.0.0.1', () => {
      console.log(`[harness] test server listening on http://127.0.0.1:${TEST_PORT}`);
      resolve();
    });
  });
}

// Test results accumulator
const results = [];

// Parse CLI args: which test to run
// Skip argv entries that start with '--' (Electron app switches)
const argTest = process.argv.slice(2).find(a => !a.startsWith('--'));
const testFiles = fs.readdirSync(__dirname)
  .filter(f => f.endsWith('.test.js'))
  .map(f => require(path.join(__dirname, f)));

const toRun = argTest
  ? testFiles.filter(t => t.name === argTest)
  : testFiles;

if (toRun.length === 0) {
  console.error(`No tests matched. Available: ${testFiles.map(t => t.name).join(', ')}`);
  process.exit(1);
}

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');

let mainWindow = null;

function buildApi(window) {
  const exec = async (js) => {
    try {
      return await window.webContents.executeJavaScript(js, true);
    } catch (e) {
      console.error('exec failed:', e.message, '\n  JS:', js.slice(0, 200));
      throw e;
    }
  };
  return {
    window,
    exec,
    testServerUrl: `http://127.0.0.1:${TEST_PORT}`,
    screenshot: async (name) => {
      const img = await window.webContents.capturePage();
      const outPath = path.join(OUT_DIR, name + '.png');
      fs.writeFileSync(outPath, img.toPNG());
      return outPath;
    },
    wait: (ms) => new Promise(r => setTimeout(r, ms)),
    waitForTabLoad: async (timeoutMs = 20000) => {
      const start = Date.now();
      let sawLoading = false;
      while (Date.now() - start < timeoutMs) {
        const t = await exec(`(function(){
          try {
            const t = window.LyconState && window.LyconState.getActive();
            if (!t) return { loading: false, error: 'no active tab', url: '' };
            let isLoading = t.loading;
            try { if (t.webview && t.webview.isLoading) isLoading = isLoading || t.webview.isLoading(); } catch(e) {}
            return { loading: isLoading, url: t.url, title: t.title };
          } catch(e) { return { loading: false, error: e.message }; }
        })()`);
        if (t.loading) {
          sawLoading = true;
        } else if (sawLoading) {
          // We saw loading start, and now it stopped. Done.
          return t;
        }
        // Otherwise still waiting for load to begin
        await new Promise(r => setTimeout(r, 200));
      }
      throw new Error(`Tab did not finish loading within ${timeoutMs}ms (sawLoading=${sawLoading})`);
    },
    activeTab: () => exec(`(function(){
      try {
        const t = window.LyconState && window.LyconState.getActive();
        if (!t) return null;
        return { id: t.id, url: t.url, title: t.title, loading: t.loading, private: t.private };
      } catch(e) { return { error: e.message }; }
    })()`),
    tabCount: () => exec(`window.LyconState ? window.LyconState.state.tabs.length : 0`),
    shieldsCount: () => exec(`(function(){
      const t = window.LyconState && window.LyconState.getActive();
      if (!t) return 0;
      return window.LyconState.state.shieldsPerTab.get(t.id) || 0;
    })()`),
    history: () => exec(`window.LyconState ? window.LyconState.state.history : []`),
    bookmarks: () => exec(`window.LyconState ? window.LyconState.state.bookmarks : []`),
    downloads: () => exec(`window.LyconState ? window.LyconState.state.downloads : []`),
    sendKey: async (key, modifiers = {}) => {
      await window.webContents.sendInputEvent({
        type: 'keyDown',
        keyCode: key,
        modifiers: Object.keys(modifiers).filter(k => modifiers[k]),
      });
      await window.webContents.sendInputEvent({
        type: 'char',
        keyCode: key,
        modifiers: Object.keys(modifiers).filter(k => modifiers[k]),
      });
      await window.webContents.sendInputEvent({
        type: 'keyUp',
        keyCode: key,
        modifiers: Object.keys(modifiers).filter(k => modifiers[k]),
      });
    },
    typeInUrlbar: async (text) => {
      await exec(`(function(){
        const ub = document.getElementById('urlbar');
        ub.focus();
        ub.value = '';
      })()`);
      for (const ch of text) {
        await window.webContents.sendInputEvent({ type: 'char', keyCode: ch });
      }
      await window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
      await window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' });
    },
    openNewTab: async (url) => {
      const beforeId = await exec(`window.LyconState.state.activeId`);
      await exec(`window.LyconTabs.createTab({ url: ${JSON.stringify(url)} })`);
      // Wait for the active tab to change to a new one
      for (let i = 0; i < 50; i++) {
        const afterId = await exec(`window.LyconState.state.activeId`);
        if (afterId && afterId !== beforeId) return afterId;
        await new Promise(r => setTimeout(r, 100));
      }
      return null;
    },
    closeActiveTab: () => exec(`(function(){
      const t = window.LyconState.getActive();
      if (t) window.LyconTabs.closeTab(t.id);
    })()`),
  };
}

async function runTests() {
  // Start the local test HTTP server (used for downloads, shields, etc.)
  await startTestServer();

  // Require the real Lycon main.js so its IPC handlers, sessions, blocker,
  // and downloads wiring all get set up. It will also try to create its own
  // BrowserWindow, but we'll set up a hook so we can capture a reference to it.
  require('../main.js');

  // Wait for the Lycon main process to create its window.
  // main.js exports nothing, so we poll for the window via app.getWindows / BrowserWindow.getAllWindows
  let window = null;
  for (let i = 0; i < 60; i++) {
    const wins = BrowserWindow.getAllWindows();
    if (wins.length > 0) {
      window = wins[0];
      break;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  if (!window) {
    throw new Error('Lycon did not create a window within 30s');
  }
  mainWindow = window;

  // Wait for the renderer to be ready (init() complete, first tab open)
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Renderer init timeout')), 30000);
    mainWindow.webContents.on('did-finish-load', () => {
      // Poll for LyconState to be ready
      const check = async () => {
        const ready = await mainWindow.webContents.executeJavaScript(
          `!!(window.LyconState && window.LyconTabs && window.LyconState.state.tabs.length > 0)`,
          true
        ).catch(() => false);
        if (ready) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(check, 200);
        }
      };
      check();
    });
  });

  // Give the start page a moment to load
  await new Promise(r => setTimeout(r, 1500));

  // Debug: dump renderer state
  try {
    const debug = await mainWindow.webContents.executeJavaScript(`(function(){
      return {
        hasLyconState: !!window.LyconState,
        hasLyconTabs: !!window.LyconTabs,
        hasLycon: !!window.lycon,
        tabCount: window.LyconState ? window.LyconState.state.tabs.length : 0,
        activeId: window.LyconState ? window.LyconState.state.activeId : null,
        readyState: document.readyState,
        url: window.location.href,
      };
    })()`, true);
    console.log('[harness] renderer state:', JSON.stringify(debug, null, 2));
  } catch (e) {
    console.error('[harness] debug failed:', e.message);
  }

  const api = buildApi(mainWindow);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Lycon Test Suite — ${toRun.length} test(s)`);
  console.log(`${'='.repeat(60)}\n`);

  for (const test of toRun) {
    // Reset state between tests: close all tabs except one (startpage)
    try {
      const tabs = await api.tabCount();
      for (let j = tabs; j > 1; j--) {
        await api.closeActiveTab();
        await api.wait(150);
      }
    } catch { /* ignore */ }

    console.log(`▶ ${test.name}: ${test.description}`);
    const t0 = Date.now();
    let pass = 0, fail = 0;
    const details = [];
    try {
      const result = await test.run(api);
      pass = result.pass || 0;
      fail = result.fail || 0;
      details.push(...(result.details || []));
    } catch (e) {
      fail++;
      details.push({ name: 'uncaught exception', ok: false, message: e.message, stack: e.stack });
    }
    const dur = Date.now() - t0;
    const status = fail === 0 ? 'PASS' : 'FAIL';
    console.log(`  ${status} — ${pass} passed, ${fail} failed (${dur}ms)\n`);
    for (const d of details) {
      const icon = d.ok ? '✓' : '✗';
      console.log(`    ${icon} ${d.name}${d.message ? ' — ' + d.message : ''}`);
    }
    console.log('');
    results.push({ name: test.name, pass, fail, duration: dur, details });
  }

  // Write JSON report
  const reportPath = path.join(OUT_DIR, 'test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    runAt: new Date().toISOString(),
    tests: results,
    totalPass: results.reduce((s, r) => s + r.pass, 0),
    totalFail: results.reduce((s, r) => s + r.fail, 0),
  }, null, 2));
  console.log(`Report: ${reportPath}`);
  console.log(`Screenshots: ${OUT_DIR}/`);

  const totalFail = results.reduce((s, r) => s + r.fail, 0);
  app.exit(totalFail === 0 ? 0 : 1);
}

app.whenReady().then(runTests).catch(e => {
  console.error('Test harness crashed:', e);
  app.exit(2);
});
