#!/bin/bash
# capture-screenshots.sh
# Launches simulators and opens a test article for App Store screenshot capture.
#
# Usage: ./scripts/capture-screenshots.sh
#
# After each simulator opens Safari with the test URL:
#   1. Activate the SpeedReader extension
#   2. Take a screenshot with: xcrun simctl io <device> screenshot <filename>.png
#      Or use Cmd+S in Simulator.app
#
# Required screenshot sizes for App Store:
#   - iPhone 6.7" (iPhone 15 Pro Max / iPhone 16 Pro Max)
#   - iPhone 6.1" (iPhone 15 Pro / iPhone 16 Pro)
#   - iPad 13"   (iPad Pro 13-inch M4)

set -euo pipefail

TEST_URL="https://en.wikipedia.org/wiki/Speed_reading"
OUTPUT_DIR="screenshots"

mkdir -p "$OUTPUT_DIR"

# Device types matching App Store required sizes
# Adjust these if your Xcode version has different simulator names
DEVICES=(
  "iPhone 17 Pro Max"       # 6.7" - required
  "iPhone 17 Pro"           # 6.1" - required
  "iPad Pro 13-inch (M5)"   # 13" - required
)

echo "=== SpeedReader Screenshot Helper ==="
echo ""
echo "This script will:"
echo "  1. Boot each required simulator"
echo "  2. Open a test article in Safari"
echo ""
echo "You then need to:"
echo "  1. Tap the SpeedReader extension icon"
echo "  2. Take screenshots (Cmd+S in Simulator or use the commands printed below)"
echo ""

for DEVICE in "${DEVICES[@]}"; do
  echo "--- $DEVICE ---"

  # Find the device UDID
  UDID=$(xcrun simctl list devices available -j | python3 -c "
import json, sys
data = json.load(sys.stdin)
for runtime, devices in data['devices'].items():
    for d in devices:
        if d['name'] == '$DEVICE' and d['isAvailable']:
            print(d['udid'])
            sys.exit(0)
sys.exit(1)
" 2>/dev/null) || {
    echo "  ⚠ Simulator '$DEVICE' not found. Skipping."
    echo "  Available devices:"
    xcrun simctl list devices available | grep -E "(iPhone|iPad)" | head -10
    echo ""
    continue
  }

  echo "  UDID: $UDID"
  echo "  Booting..."
  xcrun simctl boot "$UDID" 2>/dev/null || true

  echo "  Opening Safari with test article..."
  xcrun simctl openurl "$UDID" "$TEST_URL"

  SAFE_NAME=$(echo "$DEVICE" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')
  echo ""
  echo "  📸 To capture screenshot:"
  echo "     xcrun simctl io $UDID screenshot $OUTPUT_DIR/$SAFE_NAME.png"
  echo ""
done

echo "=== All simulators launched ==="
echo ""
echo "Steps:"
echo "  1. Activate SpeedReader in each simulator"
echo "  2. Set up the overlay how you want it to look (playing, paused with context, etc.)"
echo "  3. Run the screenshot commands above"
echo "  4. Screenshots will be saved to ./$OUTPUT_DIR/"
echo ""
echo "Tip: For best App Store screenshots, capture while the RSVP overlay is"
echo "     actively displaying a word — it shows the product in action."
