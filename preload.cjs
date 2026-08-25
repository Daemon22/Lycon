/**
 * Lycon Browser — Electron Preload
 *
 * Exposes `window.__lyconNative` (the platform-agnostic bridge contract).
 * The shared `src/bridge/bridge.js` script then wraps this into `window.lycon`.
 *
 * Events from main arrive on `lycon:event:<name>` channels and are forwarded
 * to subscribers registered via `on()`.
 */
const { contextBridge, ipcRenderer } = require('electron');

// Per-event listener sets (kept in the isolated world so callbacks can be
// properly removed later)
const listenerRegistry = new Map(); // event -> Set<fn>

function subscribe(event, cb) {
  if (!listenerRegistry.has(event)) {
    listenerRegistry.set(event, new Set());
  }
  const channel = `lycon:event:${event}`;
  const handler = (_e, payload) => {
    try { cb(payload); } catch (err) { console.error('[Lycon preload] listener error', err); }
  };
  listenerRegistry.get(event).add({ cb, handler });
  ipcRenderer.on(channel, handler);
  return () => {
    const set = listenerRegistry.get(event);
    if (set) {
      for (const entry of set) {
        if (entry.cb === cb) {
          ipcRenderer.removeListener(channel, entry.handler);
          set.delete(entry);
          break;
        }
      }
    }
  };
}

contextBridge.exposeInMainWorld('__lyconNative', {
  /**
   * Invoke a native handler.
   * @param {string} action — e.g. 'settings:get'
   * @param {*} [payload] — optional argument
   * @returns {Promise<any>}
   */
  invoke: (action, payload) => ipcRenderer.invoke(action, payload),

  /**
   * Subscribe to a native event.
   * @param {string} event — e.g. 'shields:blocked'
   * @param {(payload: any) => void} cb
   * @returns {() => void} unsubscribe
   */
  on: subscribe,

  // Platform info
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  initialUrl: process.env.LYCON_INITIAL_URL || null,
});
