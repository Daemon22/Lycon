# Lycon Bridge Contract

This document defines the **exact API surface** each native platform must
implement to host the shared Lycon UI bundle.

The shared UI (in `src/`) is platform-agnostic. It does NOT call Electron's
`ipcRenderer`, WinUI's `chrome.webview`, or GeckoView's `WebMessageDelegate`
directly. Instead, it expects a single global object — `window.__lyconNative` —
to be provided by the host **before** `src/bridge/bridge.js` loads.

`bridge.js` then wraps `__lyconNative` into the high-level `window.lycon` API
that the UI modules use.

## The contract

The host must define `window.__lyconNative` with the following shape:

```typescript
interface LyconNative {
  /**
   * Invoke a native handler and await its result.
   * @param action — one of the actions listed below
   * @param payload — optional single argument (any JSON-serializable value)
   * @returns Promise<any> — the handler's return value, JSON-serializable
   */
  invoke(action: string, payload?: any): Promise<any>;

  /**
   * Subscribe to a native event.
   * @param event — one of the events listed below
   * @param cb — callback invoked with the event payload
   * @returns unsubscribe function
   */
  on(event: string, cb: (payload: any) => void): () => void;

  /** Lowercase platform identifier: 'electron' | 'winui' | 'android' */
  platform: string;

  /** Runtime versions, shown in the About panel */
  versions: { [key: string]: string };

  /** Optional URL to load in the first tab (set by test harness or CLI) */
  initialUrl: string | null;
}
```

## Actions (invoke)

| Action | Payload | Returns | Description |
|---|---|---|---|
| `settings:get` | — | `Settings` | Load persisted settings (with defaults applied) |
| `settings:set` | `Partial<Settings>` | `Settings` | Merge patch into settings, persist, return new value |
| `search:list` | — | `SearchEngines` | Map of engine key → { name, url, suggest } |
| `search:build` | `{ engine, query }` | `string` | Build a search URL for the given engine + query |
| `bookmarks:list` | — | `Bookmark[]` | All bookmarks, newest last |
| `bookmarks:add` | `Bookmark` | `Bookmark[]` | Add (dedupe by URL), return new list |
| `bookmarks:remove` | `id: string` | `Bookmark[]` | Remove by id, return new list |
| `history:list` | — | `HistoryEntry[]` | All visits, newest first |
| `history:add` | `HistoryEntry` | `HistoryEntry[]` | Add (dedupe consecutive), return new list |
| `history:remove` | `id: string` | `HistoryEntry[]` | Remove by id |
| `history:clear` | — | `[]` | Empty the history |
| `downloads:list` | — | `Download[]` | Last 100 download records |
| `downloads:open` | `path: string` | `boolean` | Open a downloaded file with the OS default app |
| `downloads:show` | `path: string` | `boolean` | Reveal the file in the OS file manager |
| `downloads:clear` | — | `[]` | Empty the downloads list (does NOT delete files on disk) |
| `shields:toggle` | `enabled: boolean` | `Settings` | Enable/disable ad blocker for the default session |
| `shields:status` | — | `{ enabled, totalBlocked, blockerLoaded }` | Diagnostic info |
| `window:minimize` | — | `void` | Minimize the host window |
| `window:maximize` | — | `void` | Toggle maximize/restore |
| `window:close` | — | `void` | Close the host window |
| `local:chooseFile` | — | `{ path, url, name } \| null` | Open a native file picker and return a local file URL |
| `local:resolvePath` | `path: string` | `string \| null` | Convert a user-entered local path to a file URL |
| `shell:openExternal` | `url: string` | `void` | Open a URL in the OS default browser (for external links) |

## Events (on)

| Event | Payload | When fired |
|---|---|---|
| `settings:changed` | `Settings` | After `settings:set` completes — broadcast to all listeners |
| `shields:blocked` | `{ url, tabId, private, filter }` | Each time the blocker rejects a request. `tabId` is the webContents ID |
| `downloads:new` | `Download` | A new download starts |
| `downloads:progress` | `Download` | A download's byte count updates |
| `downloads:done` | `Download` | A download completes (state = 'completed' or 'interrupted') |
| `tabs:openRequested` | `{ url }` | A page calls `window.open()` — host should open a new tab |
| `https:upgraded` | `{ from, to }` | HTTP→HTTPS upgrade fires (only when HTTPS-Only mode is on) |

## Types

```typescript
interface Settings {
  theme: 'dark' | 'light' | 'system';
  accent: 'orange' | 'purple' | 'pink';
  searchEngine: 'duckduckgo' | 'google' | 'bing' | 'startpage';
  shieldsEnabled: boolean;
  startupPage: 'startpage' | 'blank';
  privateTabDefault: boolean;
  httpsOnly: boolean;
}

interface SearchEngines {
  [key: string]: { name: string; url: string; suggest: string };
}

interface Bookmark {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  addedAt: number; // epoch ms
}

interface HistoryEntry {
  id: string;
  url: string;
  title: string;
  visitedAt: number; // epoch ms
}

interface Download {
  id: string;
  url: string;
  filename: string;
  savePath: string;
  total: number; // bytes
  received: number; // bytes
  state: 'progressing' | 'completed' | 'interrupted' | 'cancelled';
  startTime: number;
  endTime?: number;
  private?: boolean;
}

interface LocalFile {
  path: string;
  url: string;
  name: string;
}
```

## Platform-specific implementation notes

### Electron

- `__lyconNative.invoke` → `ipcRenderer.invoke(action, payload)`
- `local:chooseFile` → `dialog.showOpenDialog({ properties: ['openFile'] })`, returning a `file://` URL
- `local:resolvePath` → `pathToFileURL(path.resolve(input))` with `~/` expansion
- `__lyconNative.on` → subscribe to channel `lycon:event:${event}` via `ipcRenderer.on`
- Main process sends events via `mainWindow.webContents.send('lycon:event:<name>', payload)`
- See `preload.js` for the reference implementation

### WinUI 3 + WebView2

- Inject a script that creates `window.__lyconNative` BEFORE the page's other scripts run
- `invoke` → call `chrome.webview.hostObjects.lycon.Invoke(action, payload)` (returns a Promise of the result)
- `on` → listen on `window.chrome.webview.addEventListener('message', e => e.data.type === 'lycon:event' && ...)`
- Native side calls `coreWebView2.PostWebMessageAsJson(JSON.stringify({type:'lycon:event', event, payload}))` to push events
- See `windows/LyconWindows/LyconBridge.cs` for the reference implementation
- **Ad blocker:** use WebView2's `NavigationStarting` event + a URL filter (EasyList parsed in C#), or use the `AddScriptToExecuteOnDocumentCreated` to inject a uBlock-style cosmetic filter

### Android + GeckoView

- Use `GeckoSession.WebMessageDelegate` to receive `window.postMessage` calls from JS
- Inject a script via `session.loadString(...)` or `runtime.loadAddonScript(...)` that creates `window.__lyconNative`
- `invoke` → JS calls `window.__lyconBridge.send(JSON.stringify({action, payload, id}))` and awaits a response message
- `on` → JS subscribes; native pushes events via `session.evaluateJavaScript("window.__lyconBridge.onEvent(event, payload)")`
- See `android/app/src/main/java/com/lycon/browser/LyconBridge.kt` for the reference implementation
- **Ad blocker:** GeckoView's `Runtime` ships with built-in tracking protection. Enable it via `runtime.settings.trackingProtectionEnabled = true`. For URL-based ad blocking (cosmetic + EasyList), use `ContentBlockingController` to register custom filter lists.

## Script load order

The host must ensure scripts load in this order:

1. **Native bridge script** — creates `window.__lyconNative`
   - Electron: `preload.js` (via `webPreferences.preload`)
   - WinUI: `coreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(lyconNativeScript)`
   - GeckoView: prepend to the loaded HTML, or use `runtime.loadAddonScript`

2. **`src/bridge/bridge.js`** — wraps `__lyconNative` into `window.lycon`

3. **UI modules** (`src/js/state.js`, `tabs.js`, `navigation.js`, etc.)

4. **`src/js/app.js`** — initialization (creates the first tab, loads the start page)

The provided `src/index.html` already loads scripts in this order via `<script>` tags.
