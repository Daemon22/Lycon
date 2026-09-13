# 🐺 Lycon Browser

> *Browse wild. Browse free.*

A privacy-first web browser with a fierce wolf mascot.

Lycon is built as a **modern full-stack application**: a React + tRPC + Vite
frontend (`client/`) served by a TypeScript backend (`server/`), packaged as a
native **Tauri** desktop app (`src-tauri/`) — with a standalone **Web** build
(`web/`) and a legacy native-shell lineage (WinUI 3 + WebView2, and Kotlin +
GeckoView) that host the original shared `src/` UI bundle.

The classic **Electron** shell is **deprecated** in favor of Tauri.

> ⚠️ This is currently a private repository.

![Lycon](src/assets/wolf-logo.png)

## Architecture

```
   MODERN STACK (primary)
   ┌─────────────────────────────┐
   │  Frontend: client/            │
   │  React • Vite • tailwind     │
   │  tRPC API consumers          │
   └──────────────┬──────────────┘
                  │ tRPC / REST
   ┌──────────────┴──────────────┐
   │  Backend: server/            │
   │  tRPC routers • Express     │
   │  TypeScript (tsx)            │
   └──────────────┬──────────────┘
                  │
        ┌─────────┴──────────┐
        │                    │
   ┌────▼──────────┐  ┌─────▼──────────┐
   │ Tauri desktop │  │ Web (web/)     │
   │ src-tauri/    │  │ standalone     │
   │ Rust shell    │  │ Vite build     │
   │ (MSI/NSIS)    │  │ web/dist/      │
   └───────────────┘  └────────────────┘

   LEGACY SHELLS (host the shared src/ bundle via the bridge contract)
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │ WinUI 3      │  │ Kotlin +     │  │ Electron      │
   │ + WebView2   │  │ GeckoView    │  │  (DEPRECATED) │
   │ windows/     │  │ android/     │  │ main.cjs      │
   └──────┬───────┘  └──────┬───────┘  └────────────────┘
          │                 │
          └──────┬──────────┘
                 │
   ┌─────────────▼──────────────┐
   │  Shared UI bundle: src/    │
   │  HTML/CSS/Vanilla JS       │
   │  talks to window.__lycon   │
   │  (BRIDGE_CONTRACT.md)      │
   └────────────────────────────┘
```

The modern Tauri/Web UI lives in `client/` (+ `web/client/`) and talks to the
backend via tRPC. The legacy shells (Windows, Android) host an older, framework-
free UI bundle in `src/` and use the single `window.__lyconNative` bridge so the
exact same UI runs unchanged on each platform.

## Status

| Platform | Build target | Status | Tests |
|---|---|---|---|
| **Tauri (desktop)** | `pnpm desktop:build` | ✅ Primary desktop, builds MSI + NSIS | `pnpm test` (vitest) |
| **Web** | `cd web && pnpm build` | ✅ Standalone build → `web/dist/` | `pnpm test` (vitest) |
| Android (Kotlin + GeckoView) | `./gradlew :app:assembleDebug` | ✅ Reference project | Manual build |
| Windows (WinUI 3 + WebView2) | `dotnet build` | ⏳ Reference project — working tree uses the custom `-lycon` projection packages; blocked by a `WebView2` type collision (CS0433) between `Microsoft.UI.Xaml 2.8.7-lycon` and `Microsoft.WindowsAppSDK 1.5.240227000-lycon` | Manual build |
| ~~Electron~~ | — | ⛔ Deprecated (option B) — `electron` + `@cliqz/adblocker-electron` removed from `package.json` | Legacy `tests/` (38/40) kept as reference |

## Project structure

```
lycon-browser/
├── package.json               # Modern stack: Tauri + Vite + tRPC dev scripts
├── pnpm-workspace.yaml        # PNPM workspace (modern stack)
├── vite.config.ts             # Frontend build: root=client, tRPC beforeDevCommand
├── vitest.config.ts           # Unit tests: server/ + client/src
├── todo.md
│
├── Modern stack
├── client/                    # React + Vite + Tailwind frontend
│   └── src/                   # App.tsx → <Home/>, pages/, components/, hooks/
├── server/                    # tRPC/Express backend (tsx), DB, auth, LLM, etc.
├── src-tauri/                 # Tauri Rust shell
│   ├── Cargo.toml             # Tauri 2 (tauri, tauri-plugin-*, wry)
│   ├── tauri.conf.json
│   ├── icons/                 # 32..512px + icon.ico
│   ├── gen/                   # Generated Tauri bridge API
│   └── target/                # Build artifacts (MSI/NSIS in bundle/)
├── web/                       # Standalone Web build (own client/server copy)
│   └── dist/                  # Build output (index.html + JS/CSS)
├── shared/                    # Empty — alias target for modern imports
│
├── Legacy shells (host src/)
├── src/                       # Shared UI bundle (HTML/CSS/Vanilla JS → window.__lycon)
│   ├── index.html             # Browser chrome shell
│   ├── startpage.html         # Wolf-themed new-tab page
│   ├── bridge/bridge.js       # Wraps __lyconNative → window.lycon
│   ├── js/, styles/, assets/
│   └── BRIDGE_CONTRACT.md     # The __lyconNative API contract
├── windows/                   # WinUI 3 + WebView2 (.NET 8, C#)
│   ├── LyconWindows.sln
│   ├── NuGet.Config           # Local -lycon feed + nuget.org
│   └── LyconWindows/
│       ├── LyconWindows.csproj
│       ├── App.xaml/.cs       # WinUI entry
│       ├── MainWindow.xaml/.cs# WebView2 host + nav/download handlers
│       ├── LyconBridge.cs     # JS↔native bridge
│       └── Assets/lycon-ui/   # Copy of src/
├── android/                   # Kotlin + GeckoView
│   └── app/src/main/
│       ├── java/.../MainActivity.kt  # GeckoView host + prompt delegate
│       ├── LyconBridge.kt
│       └── assets/lycon-ui/   # Copy of src/
│
├── Legacy automation
├── main.cjs                   # Electron main (deprecated) — full bridge IPC + adblocker
├── preload.cjs                # Electron preload → __lyconNative
├── tests/                     # E2E suite (Electron-based), kept as reference
└── sync-ui-bundle.*           # Sync src/ → platform asset folders
```

## Quick start

### Desktop (Tauri) — primary desktop target

```bash
cd lycon-browser
pnpm install
pnpm dev                    # starts the tRPC backend on :3000 + Vite HMR
pnpm desktop:dev            # Tauri dev shell (mirrors the frontend)
pnpm desktop:build          # -> src-tauri/target/release/bundle/{msi,nsis}
```

### Web

```bash
cd lycon-browser/web
pnpm install
pnpm build                  # -> web/dist/
pnpm preview                # serve the static build
```

### Android app

1. Open the `android/` folder in Android Studio (Hedgehog+).
2. Let Gradle sync (downloads GeckoView, one-time).
3. Connect a device (API 24+) or start an emulator.
4. `./gradlew :app:assembleDebug` → `app/build/outputs/apk/debug/app-debug.apk`.

See [android/README.md](android/README.md) for details.

### Windows native app (legacy)

1. Open `windows/LyconWindows.sln` in Visual Studio 2022.
2. The `LyconWindows.csproj` is the SDK-style project that references the custom
   `-lycon` NuGet feed declared in `windows/LyconWindows/NuGet.Config`.
3. Build as `x64`.

> Currently blocked by the CS0433 `WebView2` collision described in the Status
> table above. Until resolved, develop/test the shared UI via the Tauri or Web
> build, or the legacy Electron shell in `tests/`.

See [windows/README.md](windows/README.md) for details.

### Sync the UI bundle (legacy shells only)

After editing the shared `src/` bundle, push it to the Windows + Android asset
folders:

```bash
./sync-ui-bundle.sh   # or sync-ui-bundle.bat on Windows
```

## Features

| Feature | Status |
|---|---|
| Multi-tab browsing (drag-reorder / pin / mute / duplicate) | ✅ |
| Right-click tab context menu | ✅ |
| Smart URL bar (URLs vs. search queries) | ✅ |
| Security indicator (🔒 HTTPS / ℹ️ info / ⚠️ HTTP warning) | ✅ |
| **Lycon Shields** — ad + tracker blocking (per-tab counter) | ✅ |
| **HTTPS-Only Mode** (auto-upgrade HTTP→HTTPS) | ✅ |
| Bookmarks (add/remove/search) | ✅ |
| History (searchable, clearable) | ✅ |
| Download manager (live progress) | ✅ |
| Private mode (separate session) | ✅ |
| Find in page (Ctrl+F) | ✅ |
| Theme picker (dark/light/system + 3 accents) | ✅ |
| Local-first browsing (native file picker, file URLs, local paths) | ✅ |
| Optional intelligence panel (local/remote OpenAI-compatible) | ✅ |
| Hunting posture indicator (Hardened / Balanced / Permissive) | ✅ |
| Window state persistence | ✅ |
| Built-in PDF viewer | ✅ (Tauri + legacy Windows) |
| DevTools (F12) | ✅ (Tauri) |

## Agent-agnostic intelligence

Lycon is fully usable with **zero intelligence connected**. The optional intelligence panel is an intermediary for user-selected local models, self-hosted endpoints, cloud providers, browser-native services, or future adapters. Lycon does not start a background agent, inspect pages automatically, or silently transmit context.

A connection records its name, local/remote location, endpoint, model, and allowed context scopes. API keys are accepted only by the native host and stored using protected platform storage; they are never returned to the renderer or included in normal settings JSON.

Before a request leaves the device, Lycon shows the destination and the exact context category (prompt only, selected text, current page, or local file). The user must confirm the request. Lycon stores only request metadata locally—destination, connector, scope, timestamp, and result state—not the prompts or page contents. See [AGENT_ARCHITECTURE.md](AGENT_ARCHITECTURE.md) and [LYCON_VISION.md](LYCON_VISION.md).

## Hunting posture and sovereignty

The visible posture control provides **Hardened**, **Balanced**, and **Permissive** modes. Hardened is intended for unknown terrain, Balanced for everyday browsing, and Permissive for trusted development contexts. Changing posture does not enable intelligence or send any data. Lycon continues to treat `localhost`, `file://`, offline pages, and local web apps as first-class explicit destinations.

## Bridge architecture

The legacy shells host a **platform-agnostic** UI bundle (`src/`) that does NOT call Electron's `ipcRenderer`, WinUI's `webview`, or GeckoView's `WebMessageDelegate` directly. Instead it expects a single global object — `window.__lyconNative` — to be provided by the host **before** `src/bridge/bridge.js` loads.

`bridge.js` then wraps `__lyconNative` into the high-level `window.lycon` API used by all UI modules.

The modern Tauri/Web stack is built differently (tRPC API + context-bridge-free, the browser engine is the Tauri/Wry or Web runtime).

| Platform | How `__lyconNative` is provided |
|---|---|
| WinUI 3 | `AddScriptToExecuteOnDocumentCreatedAsync(bridgeScript)` |
| GeckoView | `session.promptDelegate` intercepts `window.prompt()` |
| ~~Electron~~ | `preload.cjs` via `contextBridge` (deprecated) |

See [BRIDGE_CONTRACT.md](BRIDGE_CONTRACT.md) for the full API reference.

## Testing

| Suite | Command | What it covers |
|---|---|---|
| Modern unit tests | `pnpm test` | tRPC routes + React client (`server/**/*.test.ts`, `client/src/**/*.test.ts`) — vitest |
| Legacy E2E (reference) | `./tests/run-all-tests.sh` | drives the shared `src/` bundle via Electron; 38/40 pass (see `download/lycon-tests/test-report.json`) |

The Electron E2E suite is kept as a reference harness because it exercises the shared `src/` bundle that the WinUI and Android shells also host.

## Documentation

| File | What it covers |
|---|---|
| `README.md` | Project overview + cross-platform architecture |
| `START-HERE.md` | Getting started guide |
| `BRIDGE_CONTRACT.md` | The `window.__lyconNative` API contract |
| `INTEGRATION.md` | Merging the shared bundle into existing Windows + Android apps |
| `windows/README.md` | Building the Windows .exe |
| `android/README.md` | Building the Android .apk |
| `src-tauri/README.md` | Tauri build notes |

## Tech stack

- **Modern frontend**: React 19 • TypeScript 5 • Vite • Tailwind CSS + shadcn/ui style
- **Backend**: TypeScript (tsx) • tRPC • Express • Drizzle ORM (+ PostgreSQL/SQLite)
- **Desktop (primary)**: Tauri 2 (Rust) + Wry webview, bundled as MSI + NSIS
- **Web**: standalone Vite static build
- **Windows (legacy)**: WinUI 3 (.NET 8, C#) + WebView2 + Newtonsoft.Json
- **Android (legacy)**: Kotlin + GeckoView (Firefox engine) + built-in tracking protection
- ~~Desktop: Electron~~ — deprecated

## License

MPL-2.0 — Mozilla Public License 2.0.

---

*Browse wild. Browse free.* 🦊
