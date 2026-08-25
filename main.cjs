/**
 * Lycon Browser — Main Process
 * Privacy-first web browser with a wolf soul.
 *
 * Responsibilities:
 *  - Create the shell BrowserWindow that hosts the UI
 *  - Manage sessions (default + private partition)
 *  - Integrate the @cliqz/adblocker-electron shields
 *  - Handle downloads with progress reporting
 *  - Persist bookmarks/history/settings via JSON files in userData
 *  - Expose IPC handlers to the renderer
 */

const { app, BrowserWindow, ipcMain, session, DownloadItem: _DownloadItem, shell, Menu, dialog: _dialog, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { ElectronBlocker } = require('@cliqz/adblocker-electron');

// Provide a fetch implementation backed by Electron's net module.
// Node's global fetch may not be available in Electron's main process
// depending on the version, so we provide our own to be safe.
function electronFetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: opts.method || 'GET',
      url: url.toString(),
      redirect: 'follow',
    });
    const headers = opts.headers || {};
    for (const [k, v] of Object.entries(headers)) {
      request.setHeader(k, v);
    }
    let body = '';
    request.on('response', (response) => {
      response.on('data', (chunk) => { body += chunk.toString('utf8'); });
      response.on('end', () => {
        resolve({
          ok: response.statusCode >= 200 && response.statusCode < 300,
          status: response.statusCode,
          statusText: response.statusMessage,
          text: () => Promise.resolve(body),
          json: () => Promise.resolve(JSON.parse(body)),
          arrayBuffer: () => Promise.resolve(Buffer.from(body)),
        });
      });
    });
    request.on('error', reject);
    if (opts.body) request.write(opts.body);
    request.end();
  });
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const USER_DATA = app.getPath('userData');
const DATA_DIR = path.join(USER_DATA, 'lycon-data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const FILES = {
  bookmarks: path.join(DATA_DIR, 'bookmarks.json'),
  history: path.join(DATA_DIR, 'history.json'),
  settings: path.join(DATA_DIR, 'settings.json'),
  downloads: path.join(DATA_DIR, 'downloads.json'),
  windowState: path.join(DATA_DIR, 'window-state.json'),
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let mainWindow = null;
let blocker = null;
let _blockerPrivate = null;
let totalBlockedCount = 0; // global counter for diagnostics

const defaultSettings = {
  theme: 'dark',          // 'dark' | 'light' | 'system'
  accent: '#FB542B',      // Lycon orange
  searchEngine: 'duckduckgo',  // duckduckgo | google | bing | startpage
  shieldsEnabled: true,
  startupPage: 'startpage',
  privateTabDefault: false,
  httpsOnly: true,
};

const SEARCH_ENGINES = {
  duckduckgo: { name: 'DuckDuckGo',       url: 'https://duckduckgo.com/?q=%s',             suggest: 'https://duckduckgo.com/ac/?q=%s' },
  google:     { name: 'Google',           url: 'https://www.google.com/search?q=%s',       suggest: 'https://suggestqueries.google.com/complete/search?client=firefox&q=%s' },
  bing:       { name: 'Bing',             url: 'https://www.bing.com/search?q=%s',         suggest: 'https://www.bing.com/osjson.aspx?query=%s' },
  startpage:  { name: 'Startpage',        url: 'https://www.startpage.com/sp/search?query=%s', suggest: 'https://www.startpage.com/sp/suggest?q=%s' },
};

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------
function readJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error('[Lycon] failed to read', file, e);
    return fallback;
  }
}
function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[Lycon] failed to write', file, e);
  }
}

function loadSettings() {
  return { ...defaultSettings, ...readJSON(FILES.settings, {}) };
}
function saveSettings(s) {
  writeJSON(FILES.settings, s);
}

// ---------------------------------------------------------------------------
// Adblocker (Lycon Shields)
// ---------------------------------------------------------------------------
async function setupBlocker(sess, isPrivate = false) {
  try {
    const b = await ElectronBlocker.fromPrebuiltAdsAndTracking(electronFetch);
    b.enableBlockingInSession(sess);
    // Per-tab shield counters — request.tabId is the webContents id
    b.on('request-blocked', (request) => {
      const tabId = request.tabId;
      totalBlockedCount++;
      if (!tabId) return;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('lycon:event:shields:blocked', {
          url: request.url,
          tabId,
          private: isPrivate,
          filter: request.filter || null,
        });
      }
    });
    return b;
  } catch (e) {
    console.error('[Lycon] blocker setup failed', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------
function createWindow() {
  const _settings = loadSettings();

  // Restore last window state (size, position, maximize)
  const winState = readJSON(FILES.windowState, { width: 1280, height: 820 });
  const bounds = {
    width: winState.width || 1280,
    height: winState.height || 820,
    minWidth: 720,
    minHeight: 480,
    x: Number.isFinite(winState.x) ? winState.x : undefined,
    y: Number.isFinite(winState.y) ? winState.y : undefined,
    title: 'Lycon',
    backgroundColor: '#1a1625',
    icon: path.join(__dirname, 'build', 'icon.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: false, // needed for webview tag IPC
      nodeIntegration: false,
      webviewTag: true,
      plugins: true, // PDF viewer
    },
  };

  mainWindow = new BrowserWindow(bounds);

  if (winState.maximized) {
    mainWindow.maximize();
  }

  // Persist window state on every change
  const saveWindowState = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const isMax = mainWindow.isMaximized();
    const rect = isMax ? winState : mainWindow.getBounds();
    const next = {
      width: rect.width,
      height: rect.height,
      x: rect.x,
      y: rect.y,
      maximized: isMax,
    };
    writeJSON(FILES.windowState, next);
  };
  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);
  mainWindow.on('maximize', saveWindowState);
  mainWindow.on('unmaximize', saveWindowState);

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    saveWindowState();
    mainWindow = null;
  });

  // Screenshot on startup for smoke testing (only if LYCON_SCREENSHOT env is set)
  if (process.env.LYCON_SCREENSHOT) {
    setTimeout(async () => {
      try {
        const img = await mainWindow.webContents.capturePage();
        const outPath = process.env.LYCON_SCREENSHOT;
        fs.writeFileSync(outPath, img.toPNG());
        console.log('[Lycon] screenshot saved to', outPath);
      } catch (e) {
        console.error('[Lycon] screenshot failed', e);
      }
    }, 5000);
  }

  // Hide the default app menu on Windows/Linux (keep on macOS for edit menus)
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
  } else {
    const template = [
      { label: app.name, submenu: [
        { role: 'about', label: 'About Lycon' },
        { type: 'separator' },
        { role: 'quit', label: 'Quit Lycon' },
      ]},
      { label: 'Edit', submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ]},
      { label: 'View', submenu: [
        { role: 'reload' }, { role: 'forceReload' }, { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' },
        { role: 'toggleDevTools', label: 'Toggle DevTools' }, { type: 'separator' },
        { role: 'togglefullscreen' },
      ]},
      { label: 'Window', submenu: [
        { role: 'minimize' }, { role: 'close' },
      ]},
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }
}

// ---------------------------------------------------------------------------
// Download Manager
// ---------------------------------------------------------------------------
const activeDownloads = new Map(); // id -> { item, state, ... }

function setupDownloads(sess, isPrivate = false) {
  sess.on('will-download', (event, item, _webContents) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const downloadsDir = app.getPath('downloads');
    const savePath = path.join(downloadsDir, item.getFilename());
    item.setSavePath(savePath);

    const record = {
      id,
      url: item.getURL(),
      filename: item.getFilename(),
      savePath,
      total: item.getTotalBytes(),
      received: 0,
      state: 'progressing',
      startTime: Date.now(),
      private: isPrivate,
    };
    activeDownloads.set(id, record);

    // Persist download list
    const list = readJSON(FILES.downloads, []);
    list.unshift({ ...record, state: 'progressing' });
    writeJSON(FILES.downloads, list.slice(0, 100));

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('lycon:event:downloads:new', record);
    }

    item.on('updated', (e, state) => {
      record.state = state;
      record.received = item.getReceivedBytes();
      record.total = item.getTotalBytes();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('lycon:event:downloads:progress', { ...record });
      }
    });

    item.once('done', (e, state) => {
      record.state = state;
      record.endTime = Date.now();
      activeDownloads.delete(id);
      // Update persisted list
      const list2 = readJSON(FILES.downloads, []);
      const idx = list2.findIndex(d => d.id === id);
      if (idx >= 0) {
        list2[idx] = { ...list2[idx], ...record };
        writeJSON(FILES.downloads, list2);
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('lycon:event:downloads:done', { ...record });
      }
    });
  });
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------
function registerIpc() {
  // ----- Settings -----
  ipcMain.handle('settings:get', () => loadSettings());
  ipcMain.handle('settings:set', (e, patch) => {
    const s = { ...loadSettings(), ...patch };
    saveSettings(s);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('lycon:event:settings:changed', s);
    }
    return s;
  });

  ipcMain.handle('search:list', () => SEARCH_ENGINES);
  ipcMain.handle('search:build', (e, { engine, query }) => {
    const eng = SEARCH_ENGINES[engine] || SEARCH_ENGINES.duckduckgo;
    return eng.url.replace('%s', encodeURIComponent(query));
  });

  // ----- Bookmarks -----
  ipcMain.handle('bookmarks:list', () => readJSON(FILES.bookmarks, []));
  ipcMain.handle('bookmarks:add', (e, bm) => {
    const list = readJSON(FILES.bookmarks, []);
    if (!list.find(b => b.url === bm.url)) {
      list.push({ id: Date.now().toString(36), ...bm, addedAt: Date.now() });
      writeJSON(FILES.bookmarks, list);
    }
    return list;
  });
  ipcMain.handle('bookmarks:remove', (e, id) => {
    let list = readJSON(FILES.bookmarks, []);
    list = list.filter(b => b.id !== id);
    writeJSON(FILES.bookmarks, list);
    return list;
  });

  // ----- History -----
  ipcMain.handle('history:list', () => readJSON(FILES.history, []));
  ipcMain.handle('history:add', (e, entry) => {
    if (entry.private) return readJSON(FILES.history, []);
    let list = readJSON(FILES.history, []);
    // Avoid duplicate-back-to-back
    if (list.length && list[0].url === entry.url) {
      list[0].visitedAt = entry.visitedAt;
      list[0].title = entry.title || list[0].title;
    } else {
      list.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2,5), ...entry });
      list = list.slice(0, 2000);
    }
    writeJSON(FILES.history, list);
    return list;
  });
  ipcMain.handle('history:remove', (e, id) => {
    let list = readJSON(FILES.history, []);
    list = list.filter(h => h.id !== id);
    writeJSON(FILES.history, list);
    return list;
  });
  ipcMain.handle('history:clear', () => {
    writeJSON(FILES.history, []);
    return [];
  });

  // ----- Downloads -----
  ipcMain.handle('downloads:list', () => readJSON(FILES.downloads, []));
  ipcMain.handle('downloads:open', (e, p) => shell.openPath(p));
  ipcMain.handle('downloads:show', (e, p) => shell.showItemInFolder(p));
  ipcMain.handle('downloads:clear', () => {
    writeJSON(FILES.downloads, []);
    return [];
  });

  // ----- Shields -----
  ipcMain.handle('shields:toggle', async (e, enabled) => {
    const s = { ...loadSettings(), shieldsEnabled: enabled };
    saveSettings(s);
    if (enabled && !blocker) {
      blocker = await setupBlocker(session.defaultSession, false);
    } else if (blocker) {
      if (enabled) blocker.enableBlockingInSession(session.defaultSession);
      else blocker.disableBlockingInSession(session.defaultSession);
    }
    return s;
  });
  ipcMain.handle('shields:status', () => ({
    enabled: !!blocker,
    totalBlocked: totalBlockedCount,
    blockerLoaded: blocker !== null,
  }));

  // ----- Window / tab controls -----
  ipcMain.handle('window:minimize', () => mainWindow && mainWindow.minimize());
  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.handle('window:close', () => mainWindow && mainWindow.close());

  // ----- Shell -----
  ipcMain.handle('shell:openExternal', (e, url) => shell.openExternal(url));
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(async () => {
  registerIpc();

  // Set up default session with shields
  const settings = loadSettings();
  if (settings.shieldsEnabled) {
    blocker = await setupBlocker(session.defaultSession, false);
  }

  // Private session (separate partition, no persistence)
  const privateSession = session.fromPartition('private', { cache: false });
  privateSession.setUserAgent(session.defaultSession.getUserAgent());
  if (settings.shieldsEnabled) {
    _blockerPrivate = await setupBlocker(privateSession, true);
  }

  // Downloads on both sessions
  setupDownloads(session.defaultSession, false);
  setupDownloads(privateSession, true);

  // Clear private session storage on quit
  app.on('before-quit', async () => {
    try {
      await privateSession.clearStorageData();
      await privateSession.clearCache();
    } catch (e) {
      console.error('[Lycon] private session clear failed', e);
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Block creation of unexpected web contents (popup handling can be added later)
app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('lycon:event:tabs:openRequested', { url });
    }
    return { action: 'deny' };
  });

  // HTTPS-Only mode: upgrade http:// to https:// before navigation
  contents.on('will-navigate', (e, url) => {
    const settings = loadSettings();
    if (settings.httpsOnly && url.startsWith('http://')) {
      // Allow localhost for development
      const parsed = (() => { try { return new URL(url); } catch { return null; } })();
      if (parsed && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
        return; // allow plain HTTP for local dev
      }
      e.preventDefault();
      const upgraded = 'https://' + url.slice(7);
      contents.loadURL(upgraded).catch(err => {
        console.error('[Lycon] HTTPS upgrade failed for', url, err);
      });
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('lycon:event:https:upgraded', { from: url, to: upgraded });
      }
    }
  });
});
