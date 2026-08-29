# Lycon for Windows (WinUI 3 + WebView2)

Native Windows app that hosts the shared Lycon browser UI in a WebView2 control.
Builds via `dotnet build` with no Visual Studio required.

## Status

| Check | Result |
|-------|--------|
| `dotnet build -c Release -r win-x64 -p:Platform=x64` | ✅ 0 errors, 0 warnings |
| Shared UI asset sync (`sync-ui-bundle.bat`) | ✅ 31/31 files byte-identical |
| Bridge contract compliance | ✅ All actions & events mapped |
| Runtime execution | ⚠️ Build-only — see [Limitations](#limitations) |

## Requirements

- **Windows 10 1809+** (build 17763+) or Windows 11
- **.NET 8 SDK** (tested with 8.0.424)
- **Windows App SDK 1.7** + **WebView2 runtime** (preinstalled on Windows 11)
- **Windows SDK 10.0.26100.0** (for MSIX packaging; not required for `dotnet build`)
- **NuGet feed** at `nuget.org` (packages restore from cache; no local feed needed)

### NuGet packages (via NuGet.Config)

| Package | Version | Purpose |
|---------|---------|---------|
| `Microsoft.WindowsAppSDK` | 1.7.250310001 | WinUI 3 + Windows App SDK types |
| `Microsoft.Web.WebView2` | 1.0.3405.78 | WebView2 core + control |
| `Newtonsoft.Json` | 13.0.3 | JSON serialization (POCO attributes respected) |

## Build

**Command line:**

```bash
cd windows\LyconWindows
dotnet build LyconWindows.csproj -c Release -r win-x64 -p:Platform=x64
```

Or from the repo root:

```bash
dotnet build windows/LyconWindows/LyconWindows.csproj -c Release -r win-x64 -p:Platform=x64
```

**Visual Studio (alternative):**

1. Open `LyconWindows.sln` in Visual Studio 2022.
2. Set configuration to `Release` and platform to `x64`.
3. Press `F5` (or `Ctrl+Shift+B` to build only).

### Build architecture notes

- The project uses a **hand-written `App.g.cs`** and **`MainWindow.g.i.cs`** as
  compile-time substitutes for the XAML markup compiler output. The csproj sets
  `EnableDefaultPageItems=false` and `EnableDefaultApplicationDefinition=false` to
  suppress the default XAML build step, allowing `dotnet build` to work without
  the WinUI workload.
- `Application.Start(_ => new App())` is the WinUI 3 entry point (WinUI 3 has no
  `Application.Run` like WPF/WINFORMS).
- MSIX/PRI tooling is disabled (`<EnableCoreMrtTooling>false>`,
  `<AppxGeneratePriEnabled>false>`) so `dotnet build` succeeds in environments
  without Visual Studio. MSIX packaging requires VS build tools
  (see [Packaging](#packaging)).

## Project layout

```
windows/
├── LyconWindows.sln
└── LyconWindows/
    ├── LyconWindows.csproj       # .NET 8 + WinUI 3 + WebView2 packages
    ├── App.xaml / App.xaml.cs    # Application entry (hand-written App.g.cs)
    ├── MainWindow.xaml           # WebView2 host window
    ├── MainWindow.xaml.cs        # WebView2 setup, download/popup/nav handlers
    ├── MainWindow.g.i.cs         # Hand-written XAML init (FindName on content tree)
    ├── App.g.cs                  # Hand-written App entry point
    ├── LyconBridge.cs            # JS↔native bridge (invoke + events)
    ├── LyconDataService.cs       # JSON persistence (bookmarks/history/settings)
    ├── LyconShieldsService.cs    # Ad/tracker blocker (EasyList URL filter)
    ├── LyconAgentService.cs      # LLM intelligence/agent integration
    ├── Package.appxmanifest      # MSIX package manifest
    ├── NuGet.Config              # nuget.org only
    └── Assets/
        ├── lycon-ui/             # Shared UI bundle (synced from ../../src/)
        ├── StoreLogo.png
        ├── Square*.png           # Tile icons
        └── SplashScreen.png
```

## How the bridge works

The bridge follows the contract in [`../BRIDGE_CONTRACT.md`](../BRIDGE_CONTRACT.md).

1. **Init script** (injected via
   `CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync`): creates
   `window.__lyconNative` on every document load. JS `invoke()` calls go through
   `window.chrome.webview.postMessage(JSON)`.

2. **Native handler** (`LyconBridge.HandleMessageFromJs`): receives the JSON
   message, dispatches to the right handler based on the `action` field, and
   returns the result via `BrowserWebView.CoreWebView2.PostWebMessageAsJson`.

3. **Events** (native → JS): `MainWindow.SendEventToJs(event, payload)` posts a
   `lycon:event` message that the init script forwards to subscribers
   registered via `__lyconNative.on(event, callback)`.

### Bridge actions (C# handler → JS invoke)

| Action | Handler |
|--------|---------|
| `settings:get` | `LyconDataService.LoadSettings()` |
| `settings:set` | `LyconDataService.UpdateSettings()` → emits `settings:changed` |
| `search:list` | Returns built-in search engines |
| `search:build` | Builds a search URL from engine + query |
| `bookmarks:list\|add\|remove` | `LyconDataService` bookmark operations |
| `history:list\|add\|remove\|clear` | `LyconDataService` history operations |
| `downloads:list\|open\|show\|clear` | File explorer + data service ops |
| `shields:toggle\|status` | `LyconShieldsService` toggle/status |
| `window:minimize\|maximize\|close` | `MainWindow` window-state controls |
| `local:chooseFile\|resolvePath` | `FileOpenPicker` / path resolution |
| `agents:list\|save\|remove` | `LyconAgentService` CRUD |
| `agents:test\|request` | `LyconAgentService` async → emits `agents:auditChanged` |
| `agents:audit\|audit:clear` | Returns/clears agent audit log |
| `agents:openRequested` | Re-emits `agents:openRequested` event |
| `shell:openExternal` | `Process.Start` with `UseShellExecute` |

### Bridge events (native → JS)

`settings:changed`, `shields:blocked`, `downloads:new|progress|done`,
`tabs:openRequested`, `https:upgraded`, `agents:auditChanged`,
`agents:openRequested`

All events are emitted via `MainWindow.SendEventToJs` →
`CoreWebView2.PostWebMessageAsJson`.

## Startup path

```
App.xaml.cs (OnLaunched)
  → new MainWindow()
    → InitializeComponent()  (loads App.xaml via Application.LoadComponent)
      → InitializeWebViewAsync()
        → EnsureCoreWebView2Async()
        → _shields.InitializeAsync()  (loads EasyList filter)
        → core.DownloadStarting  → Core_DownloadStarting
        → core.NewWindowRequested → Core_NewWindowRequested
        → AddScriptToExecuteOnDocumentCreatedAsync(bridgeScript)
        → SetVirtualHostNameToFolderMapping("lycon.app", .../Assets/lycon-ui)
        → core.Navigate("https://lycon.app/index.html")
  ← JS loads shared UI (index.html → bridge.js → js/*.js → app.js)
  ← JS calls window.__lyconNative.invoke(action, payload)
    → chrome.webview.postMessage → WebMessageReceived
    → LyconBridge.HandleMessageFromJs → handler → SendResponse
```

## Shared UI synchronization

The shared `src/` UI is synced into `windows/LyconWindows/Assets/lycon-ui/` via:

```bash
sync-ui-bundle.bat
```

(Bash equivalent: `sync-ui-bundle.sh` — syncs both Windows and Android.)

The script copies `src/index.html`, `src/startpage.html`, `src/bridge/bridge.js`,
`src/js/*`, `src/styles/*`, `src/assets/wolf-logo.png`, and
`src/assets/brands/*` into the `lycon-ui/` folder. The WebView2 hosts this
bundle via virtual host mapping (`https://lycon.app/index.html`).

## Ad blocker (Lycon Shields)

`LyconShieldsService` downloads EasyList to
`%LOCALAPPDATA%\Lycon\lycon-data\easylist.txt` on first run, parses it into
`BlockRule` objects (supporting `||domain^`, regex `/pattern/`, and plain
substrings), and checks each `NavigationStarting` URL against the rules.

Blocked requests emit a `shields:blocked` event to JS, which increments the
active tab's counter and updates the URL bar badge.

## Data storage

All user data lives under `%LOCALAPPDATA%\Lycon\lycon-data\`:

- `bookmarks.json`
- `history.json`
- `settings.json`
- `downloads.json`
- `window-state.json`
- `easylist.txt` (cached filter list)
- `agent-audit.json` (agent test/request audit log)

## Packaging

**MSIX packaging** (Microsoft Store / sideload) requires Visual Studio 2022
with the `Windows App SDK` + `Desktop development with C++` workloads. Run:

1. Open `LyconWindows.sln` in Visual Studio.
2. Right-click the project → **Publish** → **Folder** (for .exe) or
   **Package** → **Create App Packages** (for .msix).

The `Package.appxmanifest` is included as a `<None>` item in the csproj; MSIX
packaging tools are not available in a pure `dotnet build` environment.

## Limitations

- **No multi-tab support**: The Windows app uses a single WebView2 control
  (one window, one webview). Multi-tab functionality from the shared UI
  (`tabs:openRequested` event) is dispatched to JS but there is no native tab
  container. The JS layer handles tab state in memory.
- **Keyboard shortcuts**: `agents:openRequested` cannot be triggered via a
  keyboard accelerator (WinUI 3 `Window.KeyboardAccelerators` is not projected
  in the WindowsAppSDK 1.7 metadata). It can only be triggered programmatically
  or via `invoke('agents:openRequested')` from JS.
- **MSIX packaging**: Requires Visual Studio build tools; not available via
  `dotnet build` alone.
- **Runtime execution**: Not tested in CI environments without a Windows
  desktop session. The build path is fully validated; runtime behavior is
  verified by static inspection of the source.
- **Credential storage**: Uses `Windows.Security.Credentials.PasswordVault`
  (Windows Credential Manager). Available on Windows only; the Electron/Tauri
  shells use their respective keychain APIs.
