# Integrating Lycon Into Your Existing Apps

This guide shows how to embed the Lycon browser UI into an existing Windows
(WinUI 3 + WebView2) app and an existing Android (Kotlin + GeckoView) app.

## Architecture overview

```
                +---------------------+
                |  shared UI bundle   |   (src/index.html + src/js/* + src/styles/*)
                |  Platform-agnostic  |
                +----------+----------+
                           |
                           | loaded by native webview
                           |
              +------------+------------+
              |                         |
   +----------v----------+   +----------v----------+
   |   Windows host      |   |   Android host      |
   |   (WinUI 3 +        |   |   (Kotlin +         |
   |    WebView2)        |   |    GeckoView)       |
   |                     |   |                     |
   |  LyconBridge.cs     |   |  LyconBridge.kt     |
   |  LyconDataService   |   |  LyconDataService   |
   |  LyconShieldsSvc    |   |  LyconShieldsSvc    |
   +---------------------+   +---------------------+
```

The shared UI bundle is **identical** across platforms — only the native
bridge implementation differs. The UI talks to the bridge via the contract
in [BRIDGE_CONTRACT.md](BRIDGE_CONTRACT.md).

## Step 1 — Drop the UI bundle into your app

### Windows

1. Copy the entire `src/` folder to your WinUI project as `Assets/lycon-ui/`:
   ```
   YourWinUIApp/
   └── Assets/
       └── lycon-ui/
           ├── index.html
           ├── startpage.html
           ├── bridge/
           │   └── bridge.js
           ├── js/         (all UI modules)
           ├── styles/     (CSS)
           └── assets/
               └── wolf-logo.png
   ```
2. Set **Build Action** → `Content` and **Copy to Output Directory** →
   `PreserveNewest` for all files under `Assets/lycon-ui/`.
3. Also copy the wolf logo PNGs to `Assets/` for the tile/store icons
   (use the sizes in `build/icon-*.png`).

### Android

1. Copy the entire `src/` folder to your Android project as
   `app/src/main/assets/lycon-ui/` (same structure as Windows).
2. Copy launcher icons from `build/icon-*.png` into the various
   `res/mipmap-*/` folders.

## Step 2 — Add the bridge contract to your app

### Windows (WinUI 3 + WebView2)

1. Add the **Microsoft.Web.WebView2** NuGet package:
   ```xml
   <PackageReference Include="Microsoft.Web.WebView2" Version="1.0.2739.15" />
   ```
2. Copy these files from `windows/LyconWindows/` into your project:
   - `LyconBridge.cs` — handles invoke() calls from JS
   - `LyconDataService.cs` — JSON persistence
   - `LyconShieldsService.cs` — ad blocker
3. Add a `WebView2` control to your window and wire up the bridge:
   ```csharp
   var core = await webView.EnsureCoreWebView2Async();
   await core.AddScriptToExecuteOnDocumentCreatedAsync(bridge.GetBridgeInitScript());
   core.WebMessageReceived += (s, e) => bridge.HandleMessageFromJs(e.TryGetWebMessageAsString());
   core.SetVirtualHostNameToFolderMapping(
       "lycon.app",
       Path.Combine(AppContext.BaseDirectory, "Assets", "lycon-ui"),
       CoreWebView2HostResourceAccessKind.Allow);
   core.Navigate("https://lycon.app/index.html");
   ```
4. Set up downloads + popups + navigation handlers as shown in
   `windows/LyconWindows/MainWindow.xaml.cs`.

### Android (Kotlin + GeckoView)

1. Add GeckoView to `app/build.gradle.kts`:
   ```kotlin
   dependencies {
       implementation("org.mozilla.geckoview:geckoview:124.0.20240304043214")
   }
   ```
2. Add Mozilla's Maven repo to `settings.gradle.kts`:
   ```kotlin
   dependencyResolutionManagement {
       repositories {
           maven("https://maven.mozilla.org/maven2/")
       }
   }
   ```
3. Copy these files from `android/app/src/main/java/com/lycon/browser/` into
   your project (adjust package name as needed):
   - `LyconBridge.kt`
   - `LyconDataService.kt`
   - `LyconShieldsService.kt`
4. Add a `GeckoView` to your layout and wire up the bridge in your Activity:
   ```kotlin
   val runtime = GeckoRuntime.create(this)
   shieldsService.configureRuntime(runtime)

   val session = GeckoSession()
   session.open(runtime)

   session.promptDelegate = object : GeckoSession.PromptDelegate {
       override fun onPromptPrompt(session: GeckoSession, prompt: GeckoSession.PromptDelegate.PromptPrompt) =
           GeckoResult.fromValue(handleBridgePrompt(prompt))
   }

   geckoView.setSession(session)
   session.loadUri("resource://android/assets/lycon-ui/index.html")
   ```
5. See `android/app/src/main/java/com/lycon/browser/MainActivity.kt` for the
   full reference implementation.

## Step 3 — Test the integration

### Windows

1. Open `windows/LyconWindows.sln` in Visual Studio 2022 (17.10+).
2. Set the target to `x64` and build.
3. Run — the Lycon UI should load in the WebView2 window.
4. Verify:
   - Start page renders with the wolf logo
   - Typing `example.com` in the URL bar loads the site
   - Visiting a news site shows a non-zero shields count
   - Downloads panel shows files after download
   - Settings persist across restarts

### Android

1. Open the `android/` folder in Android Studio (Hedgehog+).
2. Let Gradle sync (it'll download GeckoView — ~50MB).
3. Connect an Android device (API 24+) or start an emulator.
4. Run — the Lycon UI should load in the GeckoView.
5. Verify the same items as Windows.

## Step 4 — Merge with your existing app's chrome

Your existing app probably has its own navigation, menu, or branding. Two
common merge patterns:

### Pattern A: Lycon as a full-screen tab in your app

Launch Lycon as a separate Activity (Android) or Window (Windows) when the
user taps a "Browser" button. Pass an initial URL via intent/launch args:

```kotlin
// Android
val intent = Intent(this, MainActivity::class.java).apply {
    putExtra("initialUrl", "https://example.com")
    flags = Intent.FLAG_ACTIVITY_NEW_TASK
}
startActivity(intent)
```

```csharp
// Windows
var window = new MainWindow();
window.BrowserWebView.CoreWebView2.Navigate("https://example.com");
window.Activate();
```

### Pattern B: Lycon as an embedded view

Add the WebView2/GeckoView to an existing Activity/Page in your app:

```xml
<!-- Android: existing layout fragment -->
<fragment
    android:name="com.lycon.browser.LyconFragment"
    android:layout_width="match_parent"
    android:layout_height="match_parent" />
```

```xml
<!-- Windows: existing page -->
<wv2:WebView2 x:Name="LyconWebView" />
```

Then wire up the bridge in your host code as shown in Step 2.

## Step 5 — Customize branding

All Lycon branding is in the UI bundle:

- **Wolf logo**: `lycon-ui/assets/wolf-logo.png` — replace to rebrand
- **Brand name**: `lycon-ui/index.html` line 19 (`<span class="titlebar-name">Lycon</span>`)
- **Start page**: `lycon-ui/startpage.html` — edit name, tagline, shortcuts
- **Accent colors**: `lycon-ui/styles/themes.css` (`--lycon-orange`, `--lycon-purple`, `--lycon-pink`)
- **Default search engine**: passed via `settings.json` — see `LyconDataService`

## Step 6 — Share data between your app and Lycon

Both `LyconDataService.cs` and `LyconDataService.kt` expose the same JSON
file format. To share bookmarks/history between your app's existing UI and
Lycon:

1. Have your app write to the same JSON files:
   - `%LOCALAPPDATA%\Lycon\lycon-data\bookmarks.json` (Windows)
   - `/data/data/your.app/files/lycon-data/bookmarks.json` (Android)
2. Use the same schema — see `BRIDGE_CONTRACT.md` for the exact types.
3. To trigger Lycon to re-read after external writes, call
   `window.lycon.bookmarks.list()` (or `history.list()` etc.) from JS —
   it always returns the current on-disk contents.

## Step 7 — Handle deep links

To make your app open URLs in Lycon when tapped from outside:

### Windows
Register a URI scheme in your `Package.appxmanifest`:
```xml
<Application>
  <uap:Extensions>
    <uap:Protocol Name="lycon">
      <uap:Logo>Assets\lycon-logo.png</uap:Logo>
    </uap:Protocol>
  </uap:Extensions>
</Application>
```

### Android
The provided `AndroidManifest.xml` already declares an intent-filter for
`http://` and `https://` URLs. When another app shares a URL, your
`MainActivity` receives it via `intent.data` — pass that to the renderer:
```kotlin
intent.data?.let { url ->
    session.evaluateJavaScript("window.LyconTabs.createTab({ url: '$url' })", null)
}
```

## Troubleshooting

### UI loads but `window.lycon` is undefined
- Check that the bridge script is injected BEFORE other scripts run
- On WinUI: use `AddScriptToExecuteOnDocumentCreatedAsync` (not `Navigate`'s onload)
- On GeckoView: use `session.loadUri` first, then the prompt delegate must be set

### `invoke()` calls return "No handler registered"
- The action name in your JS call doesn't match the keys in `_handlers` (WinUI)
  or `handlers` (Android)
- Verify case sensitivity — actions use lowercase with colons: `settings:get`

### Shields counter stays at 0
- WinUI: verify the EasyList filter list downloaded successfully
  (check `%LOCALAPPDATA%\Lycon\lycon-data\easylist.txt`)
- Android: verify `shieldsService.configureRuntime(runtime)` was called
  before any session was opened

### Downloads don't trigger the file picker
- WinUI: verify the `DownloadStarting` event handler is attached
- Android: you'll need to use `DownloadManager` for system-level downloads
  (GeckoView doesn't expose a download event the same way WebView2 does)

## Need more help?

- See `BRIDGE_CONTRACT.md` for the full API reference
- See `windows/LyconWindows/` and `android/app/` for complete reference apps
- Run the Electron test suite (`./tests/run-all-tests.sh`) to verify the
  shared UI bundle itself is healthy before debugging platform bridges
