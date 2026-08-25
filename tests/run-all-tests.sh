#!/bin/bash
# Lycon test runner — launches the test suite under Xvfb with all required
# Chromium flags for the container environment.
#
# Usage:
#   ./run-all-tests.sh           # run all tests
#   ./run-all-tests.sh navigation # run a single test by name

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# Kill any stale Electron / Xvfb processes
pkill -9 Xvfb 2>/dev/null || true
pkill -9 electron 2>/dev/null || true
sleep 1

# Start Xvfb on display :99
(Xvfb :99 -screen 0 1280x820x24 -nolisten tcp -nolisten unix >/tmp/lycon-xvfb.log 2>&1 &)
sleep 2

# Run tests
TEST_NAME="$1"
ARGS="tests/run-tests.js"
if [ -n "$TEST_NAME" ]; then
  ARGS="$ARGS $TEST_NAME"
fi

# Note: flags AFTER tests/run-tests.js are picked up by Electron as app-level
# switches because they appear after the main script path. This works in
# Electron 33+.
DISPLAY=:99 timeout 300 npx electron $ARGS \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  2>&1 | grep -vE 'bus.cc|Failed to connect|shared_memory|dev/shm|platform_shared|ffmpeg_common|gles2_cmd_decoder|gl_utils|GroupMarkerNotSet|WebGL' \
  || true

EXIT_CODE=${PIPESTATUS[0]}

pkill -9 Xvfb 2>/dev/null || true
pkill -9 electron 2>/dev/null || true

echo ""
echo "Test report: /home/z/my-project/download/lycon-tests/test-report.json"
echo "Screenshots: /home/z/my-project/download/lycon-tests/"

exit $EXIT_CODE
