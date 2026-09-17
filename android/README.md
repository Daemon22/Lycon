# Lycon for Android (Kotlin + GeckoView)

Native Android app that hosts the **canonical Lycon React frontend** (built
from `client/`) in a GeckoView control, using Firefox's engine and built-in
tracking protection.

The UI is identical to the Windows Tauri build — both render the same Vite
output from `client/`. The native layer adds platform-specific capabilities
(tracking protection, HTTPS-Only mode, system downloads) on top.

## Requirements

- **Android Studio Hedgehog (2023.1.1)+** with:
  - Android SDK 34
  - Kotlin 2.0+
  - Gradle 8.5+
  - NDK 26.1.10909125 (for GeckoView native libs)
- **Android device or emulator** running API 24+ (Android 7.0+)
- **Node.js + pnpm** (only needed to rebuild the React frontend)

## Building the APK

### Quick build (uses pre-synced assets)

```bash
cd android
./gradlew :app:assembleDebug
# Output: app/build/outputs/apk/debug/app-debug.apk
```

### Rebuild the React frontend first

After any change to `client/`:

```bash
# From the project root:
pnpm install
pnpm run build
rm -rf android/app/src/main/assets/lycon-ui
mkdir -p android/app/src/main/assets/lycon-ui
cp -r dist/public/* android/app/src/main/assets/lycon-ui/
```

Or simply:

```bash
pnpm run version:sync-ui
```

Then rebuild:

```bash
cd android
./gradlew :app:assembleDebug
```

The app installs as "Lycon Browser" with the Lycon logo in your launcher.

## Project layout

```
android/
├── settings.gradle.kts            # Includes :app, adds Mozilla Maven repo
├── build.gradle.kts               # Top-level plugins
├── gradle.properties              # Kotlin / AndroidX flags
├── README.md                      # This file
├── gradle/
│   └── wrapper/                   # Gradle wrapper
├── app/
│   ├── build.gradle.kts           # App module — version read from ../../VERSION
│   ├── proguard-rules.pro
│   └── src/main/
│       ├── AndroidManifest.xml    # Activity, intent-filters for http/https
│       ├── assets/
│       │   └── lycon-ui/          # React frontend build output (dist/public/)
│       ├── java/com/lycon/browser/
│       │   ├── MainActivity.kt         # GeckoView host, navigation delegate
│       │   ├── LyconBridge.kt          # JS←→native bridge (prompt-RPC protocol)
│       │   ├── LyconDataService.kt     # JSON persistence (bookmarks/history/...)
│       │   ├── LyconShieldsService.kt  # GeckoView tracking protection config
│       │   └── LyconAgentService.kt    # Optional intelligence provider management
│       ├── res/
│       │   ├── layout/activity_main.xml  # GeckoView container
│       │   ├── drawable/                 # Wolf logo foreground (adaptive icon)
│       │   ├── mipmap-*/                 # Launcher icons at all densities
│       │   └── values/                   # strings, colors, themes
│       └── AndroidManifest.xml
└── build/                          # Gradle build output (git-ignored)
```

## How the native bridge works

The canonical React frontend (`client/`) is self-contained — it manages tabs,
bookmarks, history, downloads, and settings in `localStorage`. It does **not**
call `window.__lyconNative` for data operations.

However, the native layer still provides two essential platform capabilities
that the React frontend cannot replicate:

1. **GeckoView Content Blocking (Shields)** — configured in
   `LyconShieldsService.configureRuntime()` using Firefox's built-in tracking
   protection lists. This blocks ads, trackers, cryptominers, and fingerprinters
   at the network level, before they reach the React UI's iframes.

2. **HTTPS-Only Mode** — implemented in `MainActivity`'s
   `NavigationDelegate.onLoadRequest`: any `http://` URL (except localhost)
   is upgraded to `https://` before the page loads.

3. **The prompt-RPC bridge** (`LyconBridge.kt`) is retained so that the
   native→JS event channel (`shell:collectEvents`) and any future JS→native
   calls remain functional. The React frontend simply does not use these
   calls for its current feature set.

### Bridge protocol reference

For details on the `__lyconNative` contract, see
[`../BRIDGE_CONTRACT.md`](../BRIDGE_CONTRACT.md).

## HTTPS-Only mode

Implemented in `MainActivity`'s `NavigationDelegate.onLoadRequest`:
intercepts any `http://` URL (except localhost / 127.0.0.1) and reloads
as `https://` before the page loads. The React frontend's HTTPS-Only setting
is stored in `localStorage`, but the native layer enforces it at the
GeckoSession level for all content.

## Data storage

The React frontend persists all user data in `localStorage` (tabs,
bookmarks, history, downloads, settings). The native `LyconDataService`
is retained for platform features (shields settings, HTTPS-Only preference)
that control GeckoView behavior at the native level.

Local data directory: `/data/data/com.lycon.browser/files/lycon-data/`

## Building an .apk / .aab

### Debug APK
```bash
cd android
./gradlew :app:assembleDebug
# Output: app/build/outputs/apk/debug/app-debug.apk
```

### Release APK (unsigned)
```bash
cd android
./gradlew :app:assembleRelease
# Output: app/build/outputs/apk/release/app-release-unsigned.apk
```

### Android App Bundle (for Play Store)
```bash
cd android
./gradlew :app:bundleRelease
# Output: app/build/outputs/bundle/release/app-release.aab
```

## CI/CD

GitHub Actions automatically builds the Android APK on every `v*` tag and
on every push to `main`. The workflow:

1. Checks out the repo
2. Verifies version consistency (`pnpm run version:check`)
3. Installs dependencies
4. Builds the React frontend (`pnpm run build`)
5. Syncs the build output to Android assets
6. Builds the APK with Gradle
7. Uploads the artifact

See [`.github/workflows/android-release.yml`](../.github/workflows/android-release.yml)
for details.

## GeckoView version notes

The dependency is pinned to `124.0.20240311145044` (the closest published
124.0 release to the originally-documented `124.0.20240304043214`, which was
never published to the Mozilla Maven repo). To upgrade:

1. Check https://maven.mozilla.org/?prefix=maven2/org/mozilla/geckoview/
   for the latest stable release.
2. Update the version string in `app/build.gradle.kts`.
3. Sync Gradle and rebuild.

Each GeckoView release supports the last 3 major Android versions
(API 21+ at time of writing).
