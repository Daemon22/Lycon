# Lycon for Android (Kotlin + GeckoView)

Native Android app that hosts the shared Lycon browser UI in a GeckoView control,
using Firefox's engine and built-in tracking protection.

## Requirements

- **Android Studio Hedgehog (2023.1.1)+** with:
  - Android SDK 34
  - Kotlin 2.0+
  - Gradle 8.5+
  - NDK 26.1.10909125 (for GeckoView native libs)
- **Android device or emulator** running API 24+ (Android 7.0+)

## Build

1. Open the `android/` folder in Android Studio.
2. Let Gradle sync (it will download GeckoView — ~50MB, first time only).
3. Connect an Android device with USB debugging enabled, or start an emulator.
4. Press the Run button (or `Shift+F10`).

The app installs as "Lycon" with the wolf icon in your launcher.

## Project layout

```
android/
├── settings.gradle.kts          # Includes :app, adds Mozilla Maven repo
├── build.gradle.kts             # Top-level plugins
├── gradle.properties            # Kotlin / AndroidX flags
└── app/
    ├── build.gradle.kts         # App module — GeckoView dependency
    ├── proguard-rules.pro
    └── src/main/
        ├── AndroidManifest.xml  # Activity, intent-filters for http/https
        ├── assets/
        │   └── lycon-ui/        # Shared UI bundle (synced from ../../src/)
        ├── java/com/lycon/browser/
        │   ├── MainActivity.kt          # GeckoView host, prompt delegate
        │   ├── LyconBridge.kt           # JS↔native bridge via window.prompt()
        │   ├── LyconDataService.kt      # JSON persistence (bookmarks/history/...)
        │   └── LyconShieldsService.kt   # GeckoView tracking protection config
        └── res/
            ├── layout/activity_main.xml # GeckoView container
            ├── drawable/                # Wolf logo foreground (adaptive icon)
            ├── mipmap-*/                # Launcher icons at all densities
            └── values/                  # strings, colors, themes
```

## How the bridge works

GeckoView doesn't have a direct `@JavascriptInterface` like Android WebView.
Instead, we use the standard **prompt-delegate bridge pattern**:

1. **Init script** (`LyconBridge.getBridgeInitScript()`):
   Creates `window.__lyconNative` on every page. When JS calls
   `__lyconNative.invoke(action, payload)`, the script encodes it as
   `window.prompt("lycon:invoke:<callId>:<action>:<payloadJson>")`.

2. **Prompt delegate** (`MainActivity.handleBridgePrompt`):
   Intercepts all `prompt()` calls from JS. If the message starts with
   `lycon:invoke:`, it parses the callId/action/payload, dispatches to
   the right handler, and returns the result as the prompt's response
   (a JSON string). Otherwise, dismisses the prompt.

3. **Events** (native → JS):
   `bridge.sendEvent(event, payload)` calls
   `session.evaluateJavaScript("window.__lyconBridge.onEvent(event, payload)")`.
   The init script sets up `window.__lyconBridge.onEvent` which forwards to
   subscribers registered via `__lyconNative.on(event, cb)`.

## Ad blocker (Lycon Shields)

Uses GeckoView's built-in tracking protection — the same engine that powers
Firefox Focus and Firefox for Android's strict ETP mode. Configured in
`LyconShieldsService.configureRuntime()`:

- **Ad blocking** (Disconnect ad list)
- **Analytics trackers** (Disconnect analytics list)
- **Social trackers** (Disconnect social list)
- **Content trackers** (cookies + storage)
- **Cryptomining** scripts
- **Fingerprinting** scripts
- **SafeBrowsing** (malware + unwanted + harmful)

The `ContentBlockingController.EventDelegate` fires `onContentBlocked`
whenever a request is rejected, which increments the counter and emits a
`shields:blocked` event to JS.

## HTTPS-Only mode

Implemented in `MainActivity.NavigationDelegate.onLoadRequest`:
intercepts any `http://` URL (except localhost / 127.0.0.1) and reloads
as `https://` before the page loads.

## Data storage

All user data lives under `/data/data/com.lycon.browser/files/lycon-data/`:

- `bookmarks.json`
- `history.json`
- `settings.json`
- `downloads.json`

## Building an .apk / .aab

### Debug APK
```bash
./gradlew :app:assembleDebug
# Output: app/build/outputs/apk/debug/app-debug.apk
```

### Release APK (unsigned)
```bash
./gradlew :app:assembleRelease
# Output: app/build/outputs/apk/release/app-release-unsigned.apk
```

### Android App Bundle (for Play Store)
```bash
./gradlew :app:bundleRelease
# Output: app/build/outputs/bundle/release/app-release.aab
```

To sign for release, configure `signingConfigs` in `app/build.gradle.kts`
with your keystore.

## GeckoView version notes

The dependency is pinned to `124.0.20240304043214`. To upgrade:

1. Check https://maven.mozilla.org/?prefix=maven2/org/mozilla/geckoview/
   for the latest stable release.
2. Update the version string in `app/build.gradle.kts`.
3. Sync Gradle and rebuild.

Each GeckoView release supports the last 3 major Android versions
(API 21+ at time of writing).

## Integrating into an existing Android app

See [../INTEGRATION.md](../INTEGRATION.md) for step-by-step instructions on
embedding Lycon into your own Android app (as a Fragment, Activity, or
embedded view).
