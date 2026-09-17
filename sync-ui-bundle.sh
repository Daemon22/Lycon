#!/bin/bash
# Sync the canonical Lycon React frontend (client/) into the Android asset folder.
#
# SINGULAR SOURCE OF TRUTH
# The only frontend is the React app in client/. Every platform — Windows
# (Tauri), Android (GeckoView), and the web — is built from this single
# codebase. This script builds the React frontend with Vite and deploys the
# static bundle to Android's asset directory so it is always in lock-step
# with the Windows Tauri build.
#
# Run this after any change to client/ to update the Android asset bundle:
#   ./sync-ui-bundle.sh
#
# In CI this step runs automatically before the Android Gradle build.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building the canonical Lycon React frontend from client/..."
pnpm run build
echo "  [OK] Frontend built → dist/public/"

# ----- Android -----
# Clear the old (stale) UI bundle and replace it with the fresh Vite build.
ANDROID_UI_DIR="android/app/src/main/assets/lycon-ui"
rm -rf "$ANDROID_UI_DIR"
mkdir -p "$ANDROID_UI_DIR"
cp -r dist/public/* "$ANDROID_UI_DIR/"
echo "  [OK] Android: $ANDROID_UI_DIR"

# ----- Web preview (optional, for local previewing) -----
# The web preview can serve dist/public directly via `pnpm start` or any
# static file server. No copy needed — Vite's preview or the dev server handles it.

echo ""
echo "Done. The Android asset bundle now reflects the single canonical"
echo "React frontend that is also installed on Windows (Tauri)."
