# Frozen Version — v1.0.0

> **This repository is frozen at version 1.0.0 as of 2026-09-15.**
>
> This file serves as the canonical sentinel. The state described below is the
> single, unified source of truth for the Lycon application across all
> platforms.

## What "frozen" means

There is **one** Lycon application. It runs identically on Windows (Tauri),
Android (GeckoView), and any web host. No platform holds a separate or older
version of the UI. No legacy shells or duplicate project forks remain.

## Canonical version: 1.0.0

| Component | Version | Source |
|---|---|---|
| App version | 1.0.0 | `VERSION` (root file) |
| package.json | 1.0.0 | mirrors VERSION |
| Tauri config | 1.0.0 | `tauri.conf.json` mirrors VERSION |
| Android | 1.0.0 (versionName) | `build.gradle.kts` reads VERSION file |
| Android versionCode | 10000 | computed: `major*10000 + minor*100 + patch` |

## Unified architecture

```
                    ┌────────────────┐
                    │  client/       │  ← ONLY frontend (React + Vite)
                    │  src/          │
                    └───────┬────────┘
                            │ pnpm run build
                            ▼
                    ┌────────────────┐
                    │  dist/public/  │  ← Vite build output
                    └───────┬────────┘
    ┌───────────────────────┼──────────────────────┐
    ▼                       ▼                      ▼
┌──────────┐       ┌─────────────┐       ┌──────────────┐
│ Tauri    │       │ Android     │       │ Web (static) │
│ src-tauri/│      │  loads the  │       │  serve from  │
│  desktop  │       │  same bundle│       │  dist/public │
│  (Win/Mac│       │  from       │       │              │
│  /Linux)  │       │  assets/    │       │              │
└──────────┘       │  lycon-ui/  │       └──────────────┘
                   └─────────────┘
```

## Removed (no longer present in the repo)

The following directories, files, and platforms existed in older versions and
have been **permanently removed** to eliminate version divergence:

| Removed | Reason |
|---|---|
| `web/` directory | Full duplicate project with stale dependencies |
| `src/` directory (old) | Static HTML/CSS/Vanilla-JS UI bundle, out of date |
| `main.js`, `main.cjs` | Old Electron main process entry points |
| `preload.js`, `preload.cjs` | Old Electron preload scripts |
| `windows/` directory | Old WinUI 3 + WebView2 (.NET 8 C#) app |
| 18 stale build/test logs | Old artifacts at project root |

## How to keep this frozen state

1. **Never create a second frontend.** All UI code goes in `client/`.
2. **Never edit synced assets by hand.** `dist/`, `android/.../assets/lycon-ui/`,
   and `src-tauri/` bundle outputs are build artifacts, not source.
3. **Always verify versions before release.** Run `pnpm run version:check`.
4. **Always build from `client/`.** Run `pnpm run build` or `./sync-ui-bundle.sh`.
5. **Version changes touch only `VERSION`.** Update the file, then sync configs.

If a platform is ever found running a different UI, re-run the sync process and
investigate which step in this policy was violated.

## CI enforcement

- `pnpm run version:check` — runs in CI on every push and PR
- `pnpm run build` — compiles the canonical frontend
- `pnpm test` — runs unit tests

CI builds both Tauri (desktop) and Android APKs from the same checkout, ensuring
identical frontends in every release.

---

*Established by the Lycon maintainers on 2026-09-15.*
