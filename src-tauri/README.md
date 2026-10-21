# Lycon Browser Desktop

Lycon’s desktop target uses **Tauri 2**, not Electron. The Tauri window loads the existing Lycon web shell, so local-first storage and the deliberate online handoff remain shared with the web build.

## Local development

Install the Tauri prerequisites for the target operating system, then run:

```bash
pnpm run desktop:dev
```

To create a release bundle:

```bash
pnpm run desktop:build
```

## Linux prerequisites

The Linux build host needs Rust through `rustup`, the Tauri-compatible `webkit2gtk` development package, and `librsvg2-dev`/`rsvg2` support. The current Manus sandbox has the Tauri CLI but does not include Rust or those native libraries, so the configuration is ready for a connected desktop or CI runner but cannot be compiled here yet.

## Application icon

The icon files in `icons/` are generated from the preserved canonical LYCON logo source. The web favicon remains the uploaded canonical logo URL in `client/index.html`; native bundles use the generated PNG/ICO set from the same artwork.
