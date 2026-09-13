# 🐺 Lycon Browser — Getting Started

You've downloaded the complete Lycon source. This guide gets you running fast.

## What's inside

```
lycon-browser/
├── package.json               ← Modern stack: Tauri + Vite + tRPC
├── pnpm-workspace.yaml
├── vite.config.ts             ← Frontend: root=client, tRPC backend
├──
├── Modern stack
├── ├── client/                ← React + Vite + Tailwind frontend
├── ├── server/                ← tRPC/Express backend (tsx)
├── ├── src-tauri/             ← Tauri Rust desktop shell (MSI/NSIS)
├── ├── web/                   ← Standalone Web build (own client/server copy)
├── └── shared/                ← Alias target (empty)
│
├── Legacy shells (host the shared src/ bundle)
├── ├── src/                   ← Shared UI bundle (HTML/CSS/Vanilla JS)
├── │   └── bridge/bridge.js   ← __lyconNative → window.lycon (+ BRIDGE_CONTRACT.md)
├── ├── windows/               ← WinUI 3 + WebView2 (.NET 8, C#)
├── ├── android/               ← Kotlin + GeckoView
├── └── main.cjs / preload.cjs ← Electron (DEPRECATED)
│
├── tests/                     ← Legacy E2E suite (Electron, 38/40 — reference)
├── sync-ui-bundle.*           ← Sync src/ → platform asset folders
├── windows/README.md
├── android/README.md
├── src-tauri/README.md
└── todo.md
```

## Three ways to run Lycon

### 1. Desktop (Tauri) — primary desktop target ✅

```bash
cd lycon-browser
pnpm install
pnpm dev                    # backend (tRPC, :3000) + Vite HMR
pnpm desktop:dev            # Tauri dev shell
# Produce bundles:
pnpm desktop:build          # -> src-tauri/target/release/bundle/ (MSI + NSIS)
```

### 2. Web ✅

```bash
cd lycon-browser/web
pnpm install
pnpm build                  # -> web/dist/
pnpm preview                # serve the static build locally
```

### 3. Android ✅

1. Open the `android/` folder in Android Studio (Hedgehog+).
2. Let Gradle sync (downloads GeckoView, ~50MB, one-time).
3. Connect a device (API 24+) or start an emulator.
4. Run, or build an APK:
```bash
cd android
./gradlew :app:assembleDebug
# Output: app/build/outputs/apk/debug/app-debug.apk
```

See [android/README.md](android/android/README.md) for details.

### Windows (legacy, ⏳ blocked)

The Windows project (`windows/LyconWindows`) hosts the shared `src/` bundle in a
WinUI 3 + WebView2 (.NET 8) shell. Its `LyconWindows.csproj` is the SDK-style
project that references the custom `-lycon` NuGet feed declared in
`windows/LyconWindows/NuGet.Config`.

Open `windows/LyconWindows.sln` in Visual Studio 2022 and build as `x64`.

> ⚠️ The working tree is currently blocked by a `WebView2` type collision
> (CS0433) between two custom `-lycon` projection packages — see the Status
> table in [README.md](README.md). Until resolved, use the **Tauri** or **Web**
> build, or the legacy **Electron** shell.

See [windows/README.md](windows/README.md) for full prerequisites.

### Legacy Electron (deprecated)

The classic Electron shell (`main.cjs`) and its E2E harness live in the repo root
as a reference. `electron` + `@cliqz/adblocker-electron` have been **removed**
from `package.json` devDependencies. The sources remain to document the bridge
contract in action and to run the legacy E2E suite.

## After editing src/ (legacy shells)

If you modify the shared UI bundle (`src/`), push changes to the Windows + Android
asset folders:

```bash
./sync-ui-bundle.sh        # macOS / Linux
.\sync-ui-bundle.bat       # Windows
```

## Tests

| Suite | Command | What it covers |
|---|---|---|
| Modern unit tests | `pnpm test` | tRPC routes + React client (vitest) |
| Legacy E2E (reference) | `./tests/run-all-tests.sh` | shared `src/` bundle via Electron; 38/40 pass |

Reports land in `download/lycon-tests/test-report.json`.

## Documentation

| File | What it covers |
|---|---|
| [README.md](README.md) | Project overview + full architecture & status table |
| [BRIDGE_CONTRACT.md](BRIDGE_CONTRACT.md) | The `window.__lyconNative` API contract |
| [INTEGRATION.md](INTEGRATION.md) | Merging the shared bundle into your own apps |
| [windows/README.md](windows/README.md) | Windows .exe build prerequisites |
| [android/README.md](android/README.md) | Android .apk build prerequisites |

## Tech stack

- **Frontend**: React 19 • TypeScript • Vite • Tailwind CSS
- **Backend**: TypeScript (tsx) • tRPC • Express • Drizzle ORM
- **Desktop (primary)**: Tauri 2 (Rust) + Wry — MSI + NSIS
- **Web**: standalone Vite static build
- **Windows (legacy)**: WinUI 3 (.NET 8) + WebView2
- **Android (legacy)**: Kotlin + GeckoView (Firefox engine)
- ~~Electron~~ — deprecated

## License

MPL-2.0 — Mozilla Public License 2.0.

---

*Browse wild. Browse free.* 🦊
