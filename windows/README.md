# Lycon for Windows (WinUI 3 + WebView2)

Native Windows app that hosts the shared Lycon browser UI in a WebView2 control.

## Requirements

- **Windows 10 1809+** (build 17763+) or Windows 11
- **Visual Studio 2022 17.10+** with:
  - .NET 8 SDK
  - Windows App SDK 1.5 workload
  - Universal Windows Platform (UWP) workload (for build tools)
- **WebView2 Runtime** (preinstalled on Windows 11; for Windows 10 download from
  https://developer.microsoft.com/microsoft-edge/webview2/)

## Build

1. Open `LyconWindows.sln` in Visual Studio 2022.
2. Set configuration to `Debug` or `Release` and platform to `x64`.
3. Press `F5` (or `Ctrl+Shift+B` to build only).
4. The app launches with the Lycon UI loaded in a WebView2 control.

## Project layout

```
windows/
├── LyconWindows.sln
└── LyconWindows/
    ├── LyconWindows.csproj       # .NET 8 + WinUI 3 + WebView2 packages
    ├── App.xaml / App.xaml.cs    # Application entry
    ├── MainWindow.xaml           # WebView2 host window
    ├── MainWindow.xaml.cs        # WebView2 setup, download/popup/nav handlers
    ├── LyconBridge.cs            # JS↔native bridge (invoke + events)
    ├── LyconDataService.cs       # JSON persistence (bookmarks/history/settings)
    ├── LyconShieldsService.cs    # Ad/tracker blocker (EasyList URL filter)
    ├── Package.appxmanifest      # MSIX package manifest
    └── Assets/
        ├── lycon-ui/             # Shared UI bundle (synced from ../../src/)
        ├── StoreLogo.png
        ├── Square*.png           # Tile icons
        └── SplashScreen.png
```

## How the bridge works

1. **Init script** (injected via `AddScriptToExecuteOnDocumentCreatedAsync`):
   Creates `window.__lyconNative` on every page load. JS calls go through
   `window.chrome.webview.postMessage(JSON)` to native.

2. **Native handler** (`LyconBridge.HandleMessageFromJs`):
   Receives the JSON message, dispatches to the right handler based on
   the `action` field, and returns the result via
   `PostWebMessageAsJson("lycon:response:...")`.

3. **Events** (native → JS):
   `MainWindow.SendEventToJs(event, payload)` calls
   `PostWebMessageAsJson("lycon:event:...")` which the init script forwards
   to subscribers registered via `__lyconNative.on(event, cb)`.

## Ad blocker (Lycon Shields)

The `LyconShieldsService` downloads EasyList to
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

## Building an .exe installer

To produce a distributable .exe (not MSIX):

1. In Visual Studio, right-click the project → **Publish** → **Folder**.
2. Set the target location and click **Publish**.
3. The output folder contains `LyconWindows.exe` plus all dependencies.

For MSIX packaging (Microsoft Store / sideload):

1. Right-click the project → **Package** → **Create App Packages**.
2. Follow the wizard to produce a `.msix` file.

## Integrating into an existing WinUI app

See [../INTEGRATION.md](../INTEGRATION.md) for step-by-step instructions on
embedding Lycon into your own WinUI 3 / WPF / WinForms app.
