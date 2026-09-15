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

  // ---- Embedded-native fallback --------------------------------------------
  // Watching hosts (WinUI WebView2, Electron) inject window.__lyconNative before
  // this script runs. Android's GeckoView 124 has no script-before-navigation
  // API, so when the host cannot inject, Lycon bootstraps a prompt-RPC adapter
  // itself. It speaks the exact protocol implemented by PromptDelegate in
  // LyconBridge.kt (android/):
  //     window.prompt('lycon:invoke:<callId>:<action>:<payloadJson>')
  // returns a JSON text { result, error } synchronously.
  function bootstrapNative() {
    if (window.__lyconNative) return window.__lyconNative;

    const pending = new Map();
    let nextCallId = 1;

    function callNative(action, payload) {
      return new Promise((resolve, reject) => {
        const callId = nextCallId++;
        pending.set(callId, { resolve, reject });
        const msg = 'lycon:invoke:' + callId + ':' + action + ':' +
          (payload === undefined || payload === null ? 'null' : JSON.stringify(payload));
        try {
          const response = window.prompt(msg);
          if (response === null || typeof response === 'undefined') {
            pending.delete(callId);
            reject(new Error('Native returned null'));
            return;
          }
          const parsed = JSON.parse(response);
          pending.delete(callId);
          if (parsed.error) reject(new Error(parsed.error));
          else resolve(parsed.result);
        } catch (e) {
          pending.delete(callId);
          reject(e);
        }
      });
    }

    const listeners = new Map();

    function emit(event, payload) {
      const set = listeners.get(event);
      if (!set) return;
      for (const cb of Array.from(set)) {
        try { cb(payload); } catch (e) { console.error('[Lycon] listener error', e); }
      }
    }

    const ua = (navigator.userAgent || '').toLowerCase();
    const platform = ua.indexOf('gecko') !== -1 ? 'geckoview'
      : ua.indexOf('electron') !== -1 ? 'electron'
      : ua.indexOf('android') !== -1 ? 'android'
      : 'web';

    const native = {
      invoke: callNative,
      on: function (event, cb) {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(cb);
        return function () { const s = listeners.get(event); if (s) s.delete(cb); };
      },
      platform,
      versions: { engine: 'prompt-rpc', geckoview: '124.0', os: 'Android' },
      initialUrl: null,
    };

    // GeckoView 124 dropped host->page JS execution, so native events are
    // delivered by polling a queue native fills (see shell:collectEvents in
    // LyconBridge.kt). Hosts that push events out-of-band are unaffected.
    setInterval(function () {
      callNative('shell:collectEvents', null).then(function (batch) {
        if (!Array.isArray(batch)) return;
        for (const ev of batch) {
          if (ev && ev.event) emit(ev.event, ev.payload);
        }
      }).catch(function () {});
    }, 800);

    window.__lyconNative = native;
    console.log('[Lycon] embedded prompt-RPC bridge bootstrapped');
    return native;
  }

  const native = bootstrapNative();

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
      remove: (id) => native.invoke('agents:remove', { id }),
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
