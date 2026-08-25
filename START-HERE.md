# 🐺 Lycon Browser — Portable Bundle

You've downloaded the complete Lycon source. Here's how to get started.

## What's inside

```
lycon-browser/
├── README.md                  ← Start here — full overview
├── BRIDGE_CONTRACT.md         ← API contract for host platforms
├── INTEGRATION.md             ← Step-by-step merge guide for your existing apps
├── package.json               ← Electron app metadata
├── main.js                    ← Electron main process
├── preload.js                 ← Electron preload — exposes window.__lyconNative
├── sync-ui-bundle.sh          ← One-command sync of src/ to Windows + Android
│
├── src/                       ← Shared UI bundle (platform-agnostic)
│   ├── index.html             ← Browser shell (title bar, tabs, toolbar, content)
│   ├── startpage.html         ← Custom new-tab page with wolf logo + search
│   ├── bridge/bridge.js       ← Wraps __lyconNative into window.lycon
│   ├── js/                    ← UI modules (state/tabs/nav/shields/...)
│   ├── styles/                ← CSS (themes/main/tabs)
│   └── assets/wolf-logo.png   ← Claire the wolf
│
├── windows/                   ← Windows WinUI 3 + WebView2 project (.NET 8, C#)
│   ├── LyconWindows.sln       ← Open in Visual Studio 2022
│   ├── README.md
│   └── LyconWindows/
│       ├── *.cs / *.xaml      ← Native bridge + WebView2 host
│       └── Assets/lycon-ui/   ← Copy of src/
│
├── android/                   ← Android Kotlin + GeckoView project
│   ├── settings.gradle.kts    ← Open folder in Android Studio
│   ├── README.md
│   └── app/
│       ├── build.gradle.kts
│       └── src/main/
│           ├── java/com/lycon/browser/*.kt
│           ├── assets/lycon-ui/   ← Copy of src/
│           └── res/                ← Layouts, icons, themes
│
├── tests/                     ← E2E test suite (Electron-based)
│   ├── run-all-tests.sh       ← Run all tests under Xvfb
│   └── *.test.js              ← 6 test suites
│
└── build/                     ← Wolf logo + icon assets (PNG, ICO, ICNS)
```

## Three ways to run Lycon

### 1. Desktop (Electron) — fastest way to try

```bash
cd lycon-browser
npm install
npm start
```

On Linux containers / WSL, add Chromium flags:
```bash
npx electron . --no-sandbox --disable-gpu --disable-dev-shm-usage
```

### 2. Windows native app

1. Open `windows/LyconWindows.sln` in Visual Studio 2022 (17.10+).
2. Set target to `x64`, press F5 to run.
3. To produce a standalone `.exe`: right-click project → Publish → Folder.

See `windows/README.md` for details.

### 3. Android app

1. Open the `android/` folder in Android Studio (Hedgehog+).
2. Let Gradle sync (downloads GeckoView, ~50MB, one-time).
3. Connect an Android device (API 24+) or start an emulator.
4. Press Run.

To produce an installable `.apk`:
```bash
cd android
./gradlew :app:assembleDebug
# Output: app/build/outputs/apk/debug/app-debug.apk
```

See `android/README.md` for details.

## After editing src/

If you modify the shared UI bundle (`src/`), push changes to both platform
projects:

```bash
./sync-ui-bundle.sh
```

## Embedding Lycon into your existing apps

Read `INTEGRATION.md` — it's a 7-step guide covering:

1. Drop the UI bundle into your app
2. Add the bridge contract (3 files per platform)
3. Test the integration
4. Merge with your existing chrome
5. Customize branding (wolf logo, name, colors)
6. Share data between your app and Lycon
7. Handle deep links (http/https URLs opening in Lycon)

## Tests

Verify the shared UI bundle is healthy:

```bash
cd lycon-browser
./tests/run-all-tests.sh
```

Expected: 26/26 assertions pass across 6 test suites
(navigation, single-tab, keyboard, bookmarks-history, downloads, shields).

Test reports land in `download/lycon-tests/test-report.json`.

## Documentation

| File | What it covers |
|---|---|
| `README.md` | Project overview + cross-platform architecture |
| `BRIDGE_CONTRACT.md` | The `window.__lyconNative` API contract (19 actions + 7 events) |
| `INTEGRATION.md` | Merging Lycon into your existing Windows + Android apps |
| `windows/README.md` | Building the Windows .exe |
| `android/README.md` | Building the Android .apk |

## Tech stack

- **Shared UI**: HTML / CSS / Vanilla JS (no framework, no build step)
- **Desktop**: Electron 33 + Chromium + `@cliqz/adblocker-electron`
- **Windows**: WinUI 3 (.NET 8, C#) + WebView2 + Newtonsoft.Json
- **Android**: Kotlin + GeckoView (Firefox engine) + built-in tracking protection

## License

MPL-2.0 — Mozilla Public License 2.0.

---

*Browse wild. Browse free.* 🦊
