# Lycon Bridge Contract

This document defines the **native bridge contract** that each platform's
native layer implements. The canonical React frontend (in `client/`) is
self-contained — it manages its own tabs, bookmarks, history, downloads, and
settings in `localStorage`, and uses `<iframe>` elements for web browsing.
It does **not** call `__lyconNative` for data operations.

However, the native layer is still essential for platform capabilities the
React frontend cannot provide:

- **Content blocking (shields)** — GeckoView tracking protection on Android,
  WebView-level blocking on Tauri.
- **HTTPS-Only mode** — native navigation delegates upgrade `http://` to `https://`.
- **System downloads** — native download managers with progress reporting.
- **Local file access** — platform-specific file pickers and path resolution.

The `__lyconNative` bridge is retained so that native↔JS event channels
remain available for features that require platform integration beyond what
the React frontend can do alone. See `SINGLE_SOURCE.md` for the full
single-source-of-truth policy.

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
| `local:resolvePath` | `{ input: string }` | `string \| null` | Convert a user-entered local path to a file URL |
| `agents:list` | — | `AgentConnector[]` | List sanitized optional intelligence connections; secrets are never returned |
| `agents:save` | `AgentConnectorInput` | `AgentConnector` | Validate and persist a local or remote compatible connection |
| `agents:remove` | `id: string` | `AgentConnector[]` | Remove a connection and its protected credential |
| `agents:test` | `AgentConnectorInput` | `{ ok, status }` | Explicitly test an endpoint without page context |
| `agents:request` | `AgentRequest` | `{ text, status }` | Send an explicitly confirmed request through a compatible connection |
| `agents:audit` | — | `AgentAudit[]` | Return local metadata for outbound intelligence requests |
| `agents:audit:clear` | — | `[]` | Clear local intelligence request metadata |
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
| `agents:auditChanged` | `AgentAudit` | A user-initiated connection test or request is recorded locally |
| `agents:openRequested` | — | A start-page action asks the shell to open the optional intelligence panel |

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
  sensitivity: 'hardened' | 'balanced' | 'permissive';
  agentDefaultConnectorId: string;
  siteSensitivity: { [origin: string]: 'hardened' | 'balanced' | 'permissive' };
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

interface AgentConnector {
  id: string;
  name: string;
  location: 'local' | 'remote';
  protocol: 'openai-chat';
  endpoint: string;
  model?: string;
  enabled: boolean;
  contextScopes: ('none' | 'selection' | 'page' | 'tab' | 'localFile')[];
  createdAt: number;
  updatedAt: number;
}

interface AgentConnectorInput extends Partial<AgentConnector> {
  apiKey?: string; // write-only; stored by the native host using protected storage
}

interface AgentRequest {
  connectorId: string;
  prompt: string;
  scope: 'none' | 'selection' | 'page' | 'tab' | 'localFile';
  contextText?: string;
  page?: { title?: string; url?: string };
  confirmed: true; // native hosts must reject requests without explicit confirmation
}

interface AgentAudit {
  id: string;
  createdAt: number;
  connectorId: string;
  connectorName: string;
  destination: string;
  scope: string;
  state: 'tested' | 'completed' | 'failed';
  status?: number;
  error?: string;
}
```

## Platform-specific implementation notes

### Tauri (desktop)

- Tauri 2 loads the Vite-built `dist/public/` as its `frontendDist`.
- The Rust shell (`src-tauri/src/main.rs`) provides the WebView container.
- Content blocking and HTTPS-only are handled by the WebView at the
  framework level.

### Android + GeckoView

- Load the React build from `resource://android/assets/lycon-ui/index.html`.
- GeckoView's prompt delegate intercepts `window.prompt()` if the React app
  ever needs JS→native calls (currently self-contained in localStorage).
- Content blocking is configured via `LyconShieldsService.configureRuntime(runtime)`
  at the `GeckoRuntime` level — applies to all sessions automatically.
- HTTPS-only is enforced in `MainActivity`'s `NavigationDelegate.onLoadRequest`.
- See `android/app/src/main/java/com/lycon/browser/MainActivity.kt` for the
  full reference implementation.
- Android receives a safe local-file bridge response and the React UI falls
  back to an Android-compatible browser file input when the native picker is
  unavailable.

## Script load order

The canonical React frontend is built by Vite into a static bundle
(`dist/public/`). The built `index.html` references hashed JS/CSS bundles
that are loaded automatically — there is no manual script ordering.

Native bridge scripts (e.g., GeckoView's prompt RPC adapter) are injected
or handled by the native host before the page loads. The React app does not
depend on `__lyconNative` for its core functionality, but native features
(shields, HTTPS-only, downloads) are active regardless.
