# 🐺 Lycon Browser

> *Browse wild. Browse free.*

A privacy-first web browser with a fierce wolf mascot.

Lycon is a **single application** that runs identically on Windows (Tauri),
Android (GeckoView), and the web. The frontend is a React + Vite bundle built
once from `client/` and deployed to every platform. There are no legacy shells,
no separate per-platform UI, and no version drift.

See [SINGLE_SOURCE.md](SINGLE_SOURCE.md) for the single-source-of-truth policy.

> ⚠️ This is currently a private repository.

![Lycon Browser](client/public/assets/lycon-logo.png)

## Architecture

```
                         ┌──────────────────┐
                         │  client/          │
                         │  React • Vite     │  ← the ONLY frontend
                         │  TypeScript       │
                         └───────┬───────────┘
                                 │ tRPC / REST
                  ┌──────────────┴──────────────┐
                  │                             │
         ┌────────▼────────┐         ┌─────────▼────────┐
         │  server/        │         │  shared/          │
         │  tRPC • Express │         │  shared types     │
         │  Drizzle ORM    │         │  constants        │
         └────────┬────────┘         └─────────┬────────┘
                  │                             │
        pnpm run build (Vite)                   │
                  │                             │
                  ▼                             │
         ┌────────┴────────┐                    │
         │ dist/public/     │                    │
         │  (static bundle)│                    │
         └────────┬────────┘                    │
                  │                              │
    ┌─────────────┼─────────────┐              │
    │             │             │              │
    ▼             ▼             ▼              │
 ┌──────┐   ┌─────────┐  ┌──────────┐        │
 │Tauri │   │Android  │  │Web       │◀───────┘
 │desktop│   │GeckoView│  │(vite    │
 │src-   │   │  loads  │  │ preview │
 │tauri/  │   │  the    │  │  or    │
 │        │  │  same   │  │  nginx) │
 │        │  │  bundle │  │        │
 └──────┘   └─────────┘  └──────────┘
```

**One frontend. One build. One version.**

- The **canonical frontend** lives in `client/` (React 19 + Vite + Tailwind).
- `pnpm run build` compiles it → `dist/public/` (static HTML/JS/CSS).
- **Tauri** serves `dist/public/` directly for Windows, macOS, and Linux.
- **Android** copies `dist/public/` into `android/app/src/main/assets/lycon-ui/`
  via `sync-ui-bundle.sh`; GeckoView loads it at runtime.
- **Web** can be served from `dist/public/` by any static file server.

The native layer on each platform provides capabilities the React frontend
cannot implement alone:

| Capability | Desktop (Tauri) | Android (GeckoView) |
|---|---|---|
| Content blocking (shields) | WebView-level | Built-in TP lists |
| HTTPS-Only mode | Navigation delegate | Navigation delegate |
| System downloads | Native file picker | Download manager |
| Local file access | File system API | File input fallback |

## Status

| Platform | Build target | Status |
|---|---|---|
| **Tauri (desktop)** — Windows, macOS, Linux | `pnpm desktop:build` | ✅ Primary |
| **Android** — Kotlin + GeckoView | `./gradlew :app:assembleDebug` | ✅ Primary |
| **Web** | `pnpm build` → `dist/public/` | ✅ Serve anywhere |
| ~~Electron~~ | — | ⛔ Removed (replaced by Tauri) |
| ~~WinUI 3 (WPF)~~ | — | ⛔ Removed (replaced by Tauri) |

## Project structure

```
lycon-browser/
├── VERSION                    # Canonical app version (single source of truth)
├── package.json               # Scripts + dependencies
├── vite.config.ts             # Frontend build (root=client, output=dist/public)
├── vitest.config.ts           # Unit tests
├── .github/workflows/         # CI/CD (Tauri + Android)
│   ├── tauri-release.yml
│   └── android-release.yml
├── sync-ui-bundle.sh          # Build React + sync to Android assets
├── SINGLE_SOURCE.md           # Single-source-of-truth policy
├── BRIDGE_CONTRACT.md         # Native bridge API reference
├── AGENT_ARCHITECTURE.md      # Agent-agnostic design
├── LYCON_VISION.md            # Product vision
│
├── client/                    # ✅ Canonical React + Vite frontend
│   └── src/
│       ├── App.tsx            # Entry → <Home />
│       ├── main.tsx           # React root + tRPC provider
│       ├── pages/             # Start, Search, Bookmarks, History,
│       │                     #   Downloads, Settings, Online
│       ├── components/        # Browser shell, UI components
│       ├── hooks/             # useAuth, useMobile, usePersistFn
│       ├── lib/               # trpc, syncStatus, utils, voice
│       └── index.css
├── server/                    # ✅ TypeScript backend (tRPC + Express)
│   └── _core/                 # index, routers, db, oauth, LLM, voice, etc.
├── shared/                    # ✅ Shared types and constants
├── src-tauri/                 # ✅ Tauri 2 (Rust) desktop shell
│   ├── Cargo.toml
│   ├── tauri.conf.json        # Uses dist/public/ as frontendDist
│   ├── icons/                 # App icons (32…512px + .ico)
│   └── src/main.rs
├── android/                   # ✅ Kotlin + GeckoView mobile shell
│   ├── app/
│   │   ├── build.gradle.kts   # Version read from ../../VERSION
│   │   ├── src/main/
│   │   │   ├── android/
│   │   │   │   ├── MainActivity.kt    # GeckoView host + nav delegate
│   │   │   │   ├── LyconBridge.kt      # Native↔JS bridge
│   │   │   │   ├── LyconDataService.kt # JSON persistence
│   │   │   │   ├── LyconShieldsService.kt # Tracking protection
│   │   │   │   └── LyconAgentService.kt # Intelligence connectors
│   │   │   ├── assets/lycon-ui/  # React build output (synced)
│   │   │   └── res/                # Layouts, icons, strings, themes
│   │   └── proguard-rules.pro
│   └── README.md
├── scripts/
│   └── check-version.cjs      # CI version-consistency checker
├── tests/                     # Unit + integration tests (vitest)
├── drizzle/                   # Database schema + migrations
├── .env                       # Local environment (not committed)
└── todo.md                    # Development roadmap
```

## Quick start

### Prerequisites

- **Node.js** 22+
- **pnpm** 10+ (`npm install -g pnpm`)
- For desktop: **Rust** toolchain + Tauri dependencies
- For Android: **Android Studio** + SDK 34 + NDK 26.1.10909125

### Install dependencies

```bash
pnpm install
```

### Desktop (Tauri) — primary desktop target

```bash
pnpm dev                    # backend + Vite HMR on http://localhost:3000
pnpm desktop:dev            # Tauri dev shell
pnpm desktop:build          # → src-tauri/target/release/bundle/
```

### Android

```bash
# 1. Build the React frontend and sync to Android assets
pnpm run build
rm -rf android/app/src/main/assets/lycon-ui
mkdir -p android/app/src/main/assets/lycon-ui
cp -r dist/public/* android/app/src/main/assets/lycon-ui/

# 2. Build the APK
cd android
./gradlew :app:assembleDebug
# Output: app/build/outputs/apk/debug/app-debug.apk
```

Or in one step:

```bash
pnpm run version:sync-ui    # builds React + copies to Android assets
cd android && ./gradlew :app:assembleDebug
```

### Web

```bash
pnpm run build
npx serve dist/public       # or any static file server
```

See [android/README.md](android/README.md) for Android details.

## Version management

The canonical version lives in the root `VERSION` file. All platform configs
derive from it:

```
VERSION (1.0.0)
  ├── package.json            → npm version
  ├── src-tauri/tauri.conf.json → bundle version
  └── android/app/build.gradle.kts → versionCode + versionName (computed)
```

Verify consistency at any time:

```bash
pnpm run version:check
```

CI runs this check on every push and pull request.

## Preventing version drift

1. **CI checks** — `version:check` + `test` + `build` run on every PR.
2. **Single build script** — `sync-ui-bundle.sh` builds `client/` and
   deploys the identical bundle to Android.
3. **No hand-edited copies** — Never edit files in `dist/` or
   `android/app/src/main/assets/lycon-ui/`. Modify `client/` source and rebuild.
4. **Tag-based releases** — GitHub Actions builds both Tauri and Android
   from the same git tag, ensuring identical frontends.

## Features

| Feature | Status |
|---|---|
| Multi-tab browsing (drag-reorder / close / private) | ✅ |
| Smart URL bar (URLs vs. search queries) | ✅ |
| Security indicator (🔒 HTTPS / ℹ️ info / ⚠️ HTTP warning) | ✅ |
| **Lycon Shields** — ad + tracker blocking | ✅ |
| **HTTPS-Only Mode** (auto-upgrade HTTP→HTTPS) | ✅ |
| Bookmarks (add/remove/search, JSON export/import) | ✅ |
| History (searchable, clearable, granular delete) | ✅ |
| Download manager (live progress, local indexing) | ✅ |
| Private mode (separate session) | ✅ |
| Find in page | ✅ |
| Theme picker (dark/light/system + accents) | ✅ |
| Local file browsing (`file://` URLs, local paths) | ✅ |
| Voice search (online / on-device / offline Vosk) | ✅ |
| South African English (en-ZA) offline voice | ✅ |
| Optional intelligence panel (local/remote AI) | ✅ |
| Local-first data export/import | ✅ |
| Sync (opt-in, account-based, conflict-safe) | ✅ |

## Agent-agnostic intelligence

Lycon is fully usable with **zero intelligence connected**. The optional
intelligence panel is an intermediary for user-selected local models,
self-hosted endpoints, cloud providers, browser-native services, or future
adapters. Lycon does not start a background agent, inspect pages automatically,
or silently transmit context.

See [AGENT_ARCHITECTURE.md](AGENT_ARCHITECTURE.md) and
[LYCON_VISION.md](LYCON_VISION.md) for details.

## Testing

```bash
pnpm test          # unit tests via vitest
```

## License

MPL-2.0 — Mozilla Public License 2.0.

---

*Browse wild. Browse free.* 🦊
