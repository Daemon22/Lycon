# Lycon — Single Source of Truth

> **Frozen baseline: v1.0.0 (2026-09-15)**

This document defines the **single-source-of-truth** policy for the Lycon
codebase. It exists to ensure that no platform ever again ships an outdated
version of the UI.

## The principle

There is **one** frontend. There is **one** version. There is **one**
deployable.

| Dimension | Canonical source |
|---|---|
| **UI code** | `client/src/` (React + Vite + TypeScript + Tailwind) |
| **Backend** | `server/_core/index.ts` (Express + tRPC + Drizzle) |
| **Shared types** | `shared/` |
| **Version** | `VERSION` (single file, read by all configs) |
| **Desktop build** | `src-tauri/` (Tauri 2, uses `dist/public/` as `frontendDist`) |
| **Android build** | `android/` (Kotlin + GeckoView, loads from `assets/lycon-ui/`) |

## How it works

```
client/ ──pnpm run build──▶ dist/public/ ──┐
                                          ├─▶ src-tauri/ (Tauri serves it)
                                          └─▶ android/assets/lycon-ui/ (via sync-ui-bundle.sh)
```

1. `client/` is the **only** frontend directory. All changes happen here.
2. `pnpm run build` (Vite) compiles `client/` → `dist/public/`.
3. **Tauri** reads `dist/public/` directly — no copy needed.
4. **Android** receives a copy of `dist/public/` via `sync-ui-bundle.sh`
   (or the CI workflow, which does the same thing).
5. Both platforms are built from the **same git checkout** in CI, so the
   deployed binaries are always in sync.

## What is NOT done (ever)

- ❌ No separate UI bundle per platform (no `src/` copy, no `web/` fork)
- ❌ No hand-editing assets in `android/app/src/main/assets/lycon-ui/`
- ❌ No hand-editing files in `src-tauri/` for UI purposes
- ❌ No separate `package.json` per platform
- ❌ No committing of `dist/`, `node_modules/`, or build artifacts

## Version policy

```
VERSION file (1.0.0) ← all configs derive from this
   ├── package.json          (NPM version)
   ├── src-tauri/tauri.conf.json  (bundle version)
   └── android/app/build.gradle.kts  (versionCode + versionName, computed)
```

To bump the version:

```bash
echo "1.1.0" > VERSION
pnpm run version:check   # verifies all configs agree
```

Then update `package.json` and `tauri.conf.json` to match, and create a
git tag (`git tag v1.1.0 && git push --tags`).

## Prevention checklist

Every PR and every release must pass:

1. `pnpm run version:check` — version consistency
2. `pnpm run build` — frontend compiles cleanly
3. `pnpm test` — unit tests pass

CI enforces all three automatically. If any step fails, the build is blocked.

## Recovery from drift

If a platform ships with a different UI:

1. **Do not patch the deployed binary.** Find the root cause in the repo.
2. Run `./sync-ui-bundle.sh` to rebuild and redeploy the canonical frontend.
3. Identify which step in the prevention checklist failed and fix it.
4. Document the incident to prevent recurrence.

---

*This policy was established on 2026-09-15 to enforce the sovereignty,
unity, and connectivity principles defined in `LYCON_VISION.md`.*
