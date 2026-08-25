#!/bin/bash
# Sync the shared Lycon UI bundle (src/) into both platform project asset folders.
# Run this after making changes to src/ to update the platform builds.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
cd "$PROJECT_DIR"

echo "Syncing Lycon UI bundle to platform projects..."

# ----- Windows -----
WIN_UI_DIR="windows/LyconWindows/Assets/lycon-ui"
mkdir -p "$WIN_UI_DIR/bridge" "$WIN_UI_DIR/js" "$WIN_UI_DIR/styles" "$WIN_UI_DIR/assets"
cp src/index.html "$WIN_UI_DIR/"
cp src/startpage.html "$WIN_UI_DIR/"
cp src/bridge/bridge.js "$WIN_UI_DIR/bridge/"
cp -r src/js/* "$WIN_UI_DIR/js/"
cp -r src/styles/* "$WIN_UI_DIR/styles/"
cp src/assets/wolf-logo.png "$WIN_UI_DIR/assets/"
echo "  [OK] Windows: $WIN_UI_DIR"

# ----- Android -----
ANDROID_UI_DIR="android/app/src/main/assets/lycon-ui"
mkdir -p "$ANDROID_UI_DIR/bridge" "$ANDROID_UI_DIR/js" "$ANDROID_UI_DIR/styles" "$ANDROID_UI_DIR/assets"
cp src/index.html "$ANDROID_UI_DIR/"
cp src/startpage.html "$ANDROID_UI_DIR/"
cp src/bridge/bridge.js "$ANDROID_UI_DIR/bridge/"
cp -r src/js/* "$ANDROID_UI_DIR/js/"
cp -r src/styles/* "$ANDROID_UI_DIR/styles/"
cp src/assets/wolf-logo.png "$ANDROID_UI_DIR/assets/"
echo "  [OK] Android: $ANDROID_UI_DIR"

echo ""
echo "Done. Both platform projects now have the latest UI bundle."
