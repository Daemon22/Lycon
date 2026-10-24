# Lycon Integration Guide

This guide explains how Lycon is built, deployed, and integrated across
platforms. As of the **frozen baseline (v1.0.0)**, Lycon is a **single
application** — a React + Vite frontend (`client/`) that is compiled once
and deployed to every platform target.

> **Single source of truth**: The canonical frontend lives in `client/`.
> There is no separate UI bundle per platform. Every platform receives an
> identical Vite build output from `dist/public/`.

## Architecture overview

```
                     +-----------------------+
                     |  client/ (React+Vite)  |
                     |  — the ONLY frontend   |
                     +-----------+-----------+
                                 |
                    pnpm run build  (Vite)
                                 |
                                 v
                     +-----------------------+
                     |  dist/public/          |
                     |  (static bundle)       |
                     +-----------+-----------+
                                 |
                  +--------------+--------------+
                  |                             |
                  v                             v
        +---------+---------+        +----------+----------+
        |  Tauri (Windows   |        | Android (Kotlin +   |
        |  macOS Linux)     |        |  GeckoView)         |
        |  src-tauri/       |        |  android/           |
        +-------------------+        +---------------------+
```

### How the UI reaches each platform

| Platform | How the UI is loaded | Build step |
|---|---|---|
| **Tauri desktop** (Windows, macOS, Linux) | Vite outputs to `dist/public/`; Tauri's `tauri.conf.json` `frontendDist` points to `../dist/public` | `tauri build` runs `pnpm run build` automatically |
| **Android** | The React build is copied to `android/app/src/main/assets/lycon-ui/` and loaded via `resource://android/assets/lycon-ui/index.html` | `./sync-ui-bundle.sh` builds + copies; CI does the same |

### Native platform layer

The native code on each platform provides **features the React frontend
cannot implement on its own**:

- **Content blocking (shields)** — GeckoView's built-in tracking protection
  on Android; the ad-blocker engine on Tauri is handled at the WebView level.
- **HTTPS-Only mode** — native navigation delegates upgrade `http://` to
  `https://` before the page loads.
- **Downloads** — native download managers with progress reporting.
- **Local file access** — platform-specific file pickers and path resolution.

The React frontend manages application state (tabs, bookmarks, history,
settings) in `localStorage`, ensuring the UI is identical across platforms.
Native layers add platform-specific protection and capabilities on top.

## Building and deploying

### 1. Build the canonical frontend

```bash
pnpm install           # install dependencies
pnpm run build          # Vite build → dist/public/
```

### 2. Deploy to Android

```bash
pnpm run version:sync-ui   # builds frontend + copies to Android assets
```

Or manually:

```bash
pnpm run build
rm -rf android/app/src/main/assets/lycon-ui
mkdir -p android/app/src/main/assets/lycon-ui
cp -r dist/public/* android/app/src/main/assets/lycon-ui/
```

Then build the APK:

```bash
cd android
./gradlew :app:assembleDebug
# Output: app/build/outputs/apk/debug/app-debug.apk
```

### 3. Build for Windows (Tauri)

```bash
pnpm tauri build
```

The `tauri.conf.json` `beforeBuildCommand` automatically runs
`pnpm run build` before packaging the Tauri bundle.

## What was removed (old architecture)

Before the frozen baseline (v1.0.0), the repository contained several
out-of-sync versions of the application:

| Removed item | Why it was removed |
|---|---|
| `web/` directory | Complete duplicate project copy with stale dependencies |
| `src/` directory | Old static HTML/CSS/JS UI bundle (plain JS, not React) |
| `main.js` / `main.cjs` | Old Electron main process (replaced by Tauri) |
| `preload.js` / `preload.cjs` | Old Electron preload script (replaced by Tauri) |
| `windows/LyconWindows/` | Old .NET 8 + WebView2 app (replaced by Tauri) |

These all represented older versions that diverged from the canonical
Windows Tauri build. They have been removed to enforce unity.

## Version consistency

All platform versions derive from a single `VERSION` file at the project
root. A CI check (`scripts/check-version.cjs`) verifies that `package.json`,
`tauri.conf.json`, and `android/app/build.gradle.kts` all reference the same
version. This prevents version drift.

```bash
pnpm run version:check   # verifies consistency
```

## Preventing future divergence

1. **CI checks** — Every push and PR runs the version consistency check.
2. **Release workflow** — The GitHub Actions workflows (`tauri-release.yml`
   and `android-release.yml`) build both desktop and Android from the same
   checkout, ensuring the deployed binaries always share the same frontend.
3. **`sync-ui-bundle.sh`** — The single script that builds the React frontend
   and deploys it to all platform asset folders. Run this before any
   platform-specific build.
4. **No hand-edited copies** — Never edit files in `dist/`,
   `android/app/src/main/assets/lycon-ui/`, or `src-tauri/` by hand.
   Always modify `client/` source and rebuild.
