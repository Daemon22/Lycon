/**
 * Lycon Bridge — wraps the platform-provided `window.__lyconNative` into the
 * high-level `window.lycon` API used by the UI modules.
 *
 * Each platform (Electron / WinUI WebView2 / Android GeckoView) provides
 * `window.__lyconNative` BEFORE this script runs, with this contract:
 *
 *   __lyconNative.invoke(action: string, payload?: any): Promise<any>
 *     — call a native handler and await its result
 *
 *   __lyconNative.on(event: string, callback: (payload) => void): () => void
 *     — subscribe to a native event; returns an unsubscribe function
 *
 *   __lyconNative.platform: string
 *     — 'electron' | 'winui' | 'android' | 'geckoview' etc.
 *
 *   __lyconNative.versions: { [key: string]: string }
 *     — runtime versions for the About panel
 *
 *   __lyconNative.initialUrl: string | null
 *     — optional URL to load on first tab (set by test harness / CLI)
 *
 * See BRIDGE_CONTRACT.md for the full action/event list.
 */
(function () {
  'use strict';

  const native = window.__lyconNative;
  if (!native) {
    console.error('[Lycon] FATAL: window.__lyconNative not found. Bridge missing.');
    // Provide a no-op stub so the UI doesn't crash on load — every call rejects.
    window.lycon = new Proxy({}, {
      get: () => () => Promise.reject(new Error('No native bridge')),
    });
    return;
  }

  if (typeof native.invoke !== 'function') {
    console.error('[Lycon] FATAL: __lyconNative.invoke is not a function');
    return;
  }

  function chooseFileWithInput() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '*/*';
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        if (!file) return resolve(null);
        resolve({ name: file.name, path: file.name, url: URL.createObjectURL(file) });
      }, { once: true });
      input.click();
    });
  }

  // Build the high-level window.lycon API surface
  window.lycon = {
    // ----- Settings -----
    settings: {
      get: () => native.invoke('settings:get'),
      set: (patch) => native.invoke('settings:set', patch),
      onChanged: (cb) => native.on('settings:changed', cb),
    },

    // ----- Search engines -----
    search: {
      list: () => native.invoke('search:list'),
      build: (engine, query) => native.invoke('search:build', { engine, query }),
    },

    // ----- Bookmarks -----
    bookmarks: {
      list: () => native.invoke('bookmarks:list'),
      add: (bm) => native.invoke('bookmarks:add', bm),
      remove: (id) => native.invoke('bookmarks:remove', id),
    },

    // ----- History -----
    history: {
      list: () => native.invoke('history:list'),
      add: (entry) => native.invoke('history:add', entry),
      remove: (id) => native.invoke('history:remove', id),
      clear: () => native.invoke('history:clear'),
    },

    // ----- Downloads -----
    downloads: {
      list: () => native.invoke('downloads:list'),
      open: (p) => native.invoke('downloads:open', p),
      show: (p) => native.invoke('downloads:show', p),
      clear: () => native.invoke('downloads:clear'),
      onNew: (cb) => native.on('downloads:new', cb),
      onProgress: (cb) => native.on('downloads:progress', cb),
      onDone: (cb) => native.on('downloads:done', cb),
    },

    // ----- Shields (ad/tracker blocker) -----
    shields: {
      toggle: (enabled) => native.invoke('shields:toggle', enabled),
      status: () => native.invoke('shields:status'),
      onBlocked: (cb) => native.on('shields:blocked', cb),
    },

    // ----- Tabs (events only; tab creation is renderer-internal) -----
    tabs: {
      onOpenRequested: (cb) => native.on('tabs:openRequested', cb),
    },

    // ----- Window controls -----
    window: {
      minimize: () => native.invoke('window:minimize'),
      maximize: () => native.invoke('window:maximize'),
      close: () => native.invoke('window:close'),
    },

    // ----- HTTPS-Only events -----
    https: {
      onUpgraded: (cb) => native.on('https:upgraded', cb),
    },

    // ----- Local files -----
    local: {
      chooseFile: () => native.invoke('local:chooseFile').then((result) => result && result.url ? result : chooseFileWithInput()).catch(() => chooseFileWithInput()),
      resolvePath: (input) => native.invoke('local:resolvePath', { input }).catch(() => {
        if (/^(?:file|blob|content):/i.test(input || '')) return input;
        return null;
      }),
    },

    // ----- Optional intelligence -----
    agents: {
      list: () => native.invoke('agents:list'),
      save: (connector) => native.invoke('agents:save', connector),
      remove: (id) => native.invoke('agents:remove', id),
      test: (connector) => native.invoke('agents:test', connector),
      request: (request) => native.invoke('agents:request', request),
      audit: () => native.invoke('agents:audit'),
      clearAudit: () => native.invoke('agents:audit:clear'),
      onAuditChanged: (cb) => native.on('agents:auditChanged', cb),
      onOpenRequested: (cb) => native.on('agents:openRequested', cb),
    },

    // ----- Shell -----
    shell: {
      openExternal: (url) => native.invoke('shell:openExternal', url),
    },

    // ----- Platform info -----
    platform: native.platform || 'unknown',
    versions: native.versions || {},
    initialUrl: native.initialUrl || null,
  };

  console.log('[Lycon] bridge ready on platform:', window.lycon.platform);
})();
