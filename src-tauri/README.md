# Lycon Browser — Desktop (Tauri)

Lycon's desktop target uses **Tauri 2** (Rust), not Electron. The Tauri window
loads the canonical React + Vite frontend built from `client/`, which is
identical to the bundle deployed on Android. There is a single frontend
across all platforms.

## Local development

Install the Tauri prerequisites for the target operating system, then run:

```bash
pnpm install
pnpm dev                    # backend (tRPC) + Vite HMR on http://localhost:3000
pnpm desktop:dev            # Tauri dev shell (mirrors the frontend)
```

To create a release bundle:

```bash
pnpm desktop:build          # → src-tauri/target/release/bundle/
```

The `tauri.conf.json` runs `pnpm run build` automatically as
`beforeBuildCommand`, so the React frontend is always compiled fresh before
Tauri packages it.

## Linux prerequisites

The Linux build host needs Rust through `rustup`, the Tauri-compatible
`webkit2gtk` development package, and `librsvg2-dev`/`rsvg2` support. The
current environment has the Tauri CLI but may not include Rust or those
native libraries, so the configuration is ready for a connected desktop
or CI runner.

## Application icon

The icon files in `icons/` are generated from the preserved canonical LYCON
logo source. The web favicon is set in `client/index.html`; native bundles use
the generated PNG/ICO set from the same artwork.

## Version

The Tauri bundle version is read from `tauri.conf.json`, which mirrors the
canonical `VERSION` file at the project root. Run
`pnpm run version:check` to verify consistency across all platforms.
