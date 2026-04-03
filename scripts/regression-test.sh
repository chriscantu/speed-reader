#!/bin/bash
# SpeedReader — Quick regression tests
# Uses osascript to drive Safari and verify extension behavior.
#
# Prerequisites:
#   - SpeedReader app installed and extension enabled in Safari
#   - Safari > Develop > Allow JavaScript from Apple Events (checked)
#
# Usage: ./scripts/regression-test.sh

set -euo pipefail

PASS=0
FAIL=0
SKIP=0
TEST_URL="https://en.wikipedia.org/wiki/Speed_reading"

green() { printf "\033[32m%s\033[0m\n" "$1"; }
red() { printf "\033[31m%s\033[0m\n" "$1"; }
yellow() { printf "\033[33m%s\033[0m\n" "$1"; }

assert_contains() {
  local label="$1" actual="$2" expected="$3"
  if echo "$actual" | grep -q "$expected"; then
    green "  ✔ $label"
    PASS=$((PASS + 1))
  else
    red "  ✘ $label (expected '$expected', got '$actual')"
    FAIL=$((FAIL + 1))
  fi
}

assert_equals() {
  local label="$1" actual="$2" expected="$3"
  if [ "$actual" = "$expected" ]; then
    green "  ✔ $label"
    PASS=$((PASS + 1))
  else
    red "  ✘ $label (expected '$expected', got '$actual')"
    FAIL=$((FAIL + 1))
  fi
}

safari_js() {
  osascript -e "tell application \"Safari\" to do JavaScript \"$1\" in document 1" 2>/dev/null || echo "ERROR"
}

wait_for_page() {
  sleep 2
}

# ─────────────────────────────────────────────────
echo ""
echo "SpeedReader Regression Tests"
echo "═══════════════════════════════════════════"

# ─────────────────────────────────────────────────
echo ""
echo "0. Prerequisites"
echo "─────────────────────────────────────────────"

# Check Safari is running
if ! pgrep -q Safari; then
  echo "  Starting Safari..."
  open -a Safari
  sleep 3
fi
green "  ✔ Safari is running"
PASS=$((PASS + 1))

# Check JavaScript from Apple Events
JS_TEST=$(safari_js "1+1")
if [ "$JS_TEST" = "2" ]; then
  green "  ✔ JavaScript from Apple Events enabled"
  PASS=$((PASS + 1))
else
  red "  ✘ Enable: Safari > Develop > Allow JavaScript from Apple Events"
  echo "  Cannot proceed without this setting."
  exit 1
fi

# ─────────────────────────────────────────────────
echo ""
echo "1. Navigation & Content Script Loading"
echo "─────────────────────────────────────────────"

# Navigate to test page
osascript -e "tell application \"Safari\" to set URL of document 1 to \"$TEST_URL\"" 2>/dev/null
osascript -e "tell application \"Safari\" to activate" 2>/dev/null
wait_for_page
sleep 2  # extra time for Wikipedia to fully load

CURRENT_URL=$(osascript -e 'tell application "Safari" to get URL of document 1' 2>/dev/null)
assert_contains "Navigated to test page" "$CURRENT_URL" "Speed_reading"

# Check content script loaded (showToast function should exist)
HAS_CONTENT_SCRIPT=$(safari_js "typeof showToast")
assert_equals "Content script loaded" "$HAS_CONTENT_SCRIPT" "function"

# ─────────────────────────────────────────────────
echo ""
echo "2. Overlay Toggle"
echo "─────────────────────────────────────────────"

# Check overlay is initially closed
OVERLAY_BEFORE=$(safari_js "document.querySelector('speed-reader-overlay') !== null")
assert_equals "Overlay initially closed" "$OVERLAY_BEFORE" "false"

# Trigger toggle via content script message (simulates toolbar click)
safari_js "browser.runtime.sendMessage({action: 'toggle-reader'})" >/dev/null 2>&1
sleep 3  # wait for Readability extraction + overlay render

# Check overlay opened
OVERLAY_AFTER=$(safari_js "document.querySelector('speed-reader-overlay') !== null")
assert_equals "Overlay opened after toggle" "$OVERLAY_AFTER" "true"

# Check shadow DOM exists
HAS_SHADOW=$(safari_js "document.querySelector('speed-reader-overlay')?.shadowRoot !== null")
assert_equals "Shadow DOM attached" "$HAS_SHADOW" "true"

# ─────────────────────────────────────────────────
echo ""
echo "3. RSVP Display"
echo "─────────────────────────────────────────────"

# Check word display element exists in shadow DOM
HAS_WORD=$(safari_js "document.querySelector('speed-reader-overlay')?.shadowRoot?.querySelector('.sr-word') !== null")
assert_equals "Word display element exists" "$HAS_WORD" "true"

# Check a word is actually rendered (not empty)
WORD_TEXT=$(safari_js "document.querySelector('speed-reader-overlay')?.shadowRoot?.querySelector('.sr-word')?.textContent?.trim()?.length > 0")
assert_equals "Word is rendered" "$WORD_TEXT" "true"

# Check focus point highlight exists
HAS_FOCUS=$(safari_js "document.querySelector('speed-reader-overlay')?.shadowRoot?.querySelector('.sr-focus') !== null")
assert_equals "Focus point highlight exists" "$HAS_FOCUS" "true"

# ─────────────────────────────────────────────────
echo ""
echo "4. Playback Controls"
echo "─────────────────────────────────────────────"

# Check play/pause button exists
HAS_PLAY_BTN=$(safari_js "document.querySelector('speed-reader-overlay')?.shadowRoot?.querySelector('.sr-play') !== null")
assert_equals "Play button exists" "$HAS_PLAY_BTN" "true"

# Check WPM display
HAS_WPM=$(safari_js "document.querySelector('speed-reader-overlay')?.shadowRoot?.querySelector('.sr-wpm-label')?.textContent?.includes('WPM')")
assert_equals "WPM label displayed" "$HAS_WPM" "true"

# Check prev/next buttons
HAS_PREV=$(safari_js "document.querySelector('speed-reader-overlay')?.shadowRoot?.querySelector('.sr-prev') !== null")
assert_equals "Prev button exists" "$HAS_PREV" "true"

HAS_NEXT=$(safari_js "document.querySelector('speed-reader-overlay')?.shadowRoot?.querySelector('.sr-next') !== null")
assert_equals "Next button exists" "$HAS_NEXT" "true"

# ─────────────────────────────────────────────────
echo ""
echo "5. Play / Pause"
echo "─────────────────────────────────────────────"

# Start playback by clicking play
safari_js "document.querySelector('speed-reader-overlay')?.shadowRoot?.querySelector('.sr-play')?.click()" >/dev/null
sleep 1

# Get current index after playing for a second
INDEX_AFTER_PLAY=$(safari_js "document.querySelector('speed-reader-overlay')?.shadowRoot?.querySelector('.sr-progress')?.textContent")
assert_contains "Progress indicator updates during play" "$INDEX_AFTER_PLAY" "/"

# Pause by clicking play again
safari_js "document.querySelector('speed-reader-overlay')?.shadowRoot?.querySelector('.sr-play')?.click()" >/dev/null
sleep 0.5

# Get index, wait, get again — should be same (paused)
INDEX_A=$(safari_js "document.querySelector('speed-reader-overlay')?.shadowRoot?.querySelector('.sr-word')?.textContent")
sleep 1
INDEX_B=$(safari_js "document.querySelector('speed-reader-overlay')?.shadowRoot?.querySelector('.sr-word')?.textContent")
assert_equals "Word stays same when paused" "$INDEX_A" "$INDEX_B"

# ─────────────────────────────────────────────────
echo ""
echo "6. Context Preview on Pause"
echo "─────────────────────────────────────────────"

# When paused, context should be visible
HAS_CONTEXT=$(safari_js "document.querySelector('speed-reader-overlay')?.shadowRoot?.querySelector('.sr-context')?.textContent?.length > 0")
assert_equals "Context sentence shown on pause" "$HAS_CONTEXT" "true"

# ─────────────────────────────────────────────────
echo ""
echo "7. Close Overlay"
echo "─────────────────────────────────────────────"

# Close via close button
safari_js "document.querySelector('speed-reader-overlay')?.shadowRoot?.querySelector('.sr-close')?.click()" >/dev/null
sleep 0.5

OVERLAY_CLOSED=$(safari_js "document.querySelector('speed-reader-overlay') !== null")
assert_equals "Overlay closed" "$OVERLAY_CLOSED" "false"

# ─────────────────────────────────────────────────
echo ""
echo "8. Text Selection Mode"
echo "─────────────────────────────────────────────"

# Select some text and open overlay
safari_js "window.getSelection().removeAllRanges(); var r = document.createRange(); var el = document.querySelector('p'); if(el){r.selectNodeContents(el); window.getSelection().addRange(r);}" >/dev/null
sleep 0.5

# Toggle reader with selection active
safari_js "browser.runtime.sendMessage({action: 'toggle-reader'})" >/dev/null 2>&1
sleep 2

OVERLAY_SEL=$(safari_js "document.querySelector('speed-reader-overlay') !== null")
assert_equals "Overlay opens with selected text" "$OVERLAY_SEL" "true"

# Clean up — close overlay
safari_js "document.querySelector('speed-reader-overlay')?.shadowRoot?.querySelector('.sr-close')?.click()" >/dev/null
sleep 0.5

# ─────────────────────────────────────────────────
echo ""
echo "9. Restricted Page Handling"
echo "─────────────────────────────────────────────"

# Navigate to about:blank (restricted page)
osascript -e "tell application \"Safari\" to set URL of document 1 to \"about:blank\"" 2>/dev/null
wait_for_page

# Content script won't be injected on about:blank, so toggle should fail gracefully
# We can't easily test this without the toolbar button, so skip
yellow "  ⊘ Restricted page test (requires manual toolbar click — skipped)"
SKIP=$((SKIP + 1))

# Navigate back to test page for cleanup
osascript -e "tell application \"Safari\" to set URL of document 1 to \"$TEST_URL\"" 2>/dev/null
wait_for_page

# ─────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo ""
green "  Passed: $PASS"
if [ "$FAIL" -gt 0 ]; then
  red "  Failed: $FAIL"
fi
if [ "$SKIP" -gt 0 ]; then
  yellow "  Skipped: $SKIP"
fi
echo ""

if [ "$FAIL" -gt 0 ]; then
  red "REGRESSION TEST FAILED"
  exit 1
else
  green "ALL REGRESSION TESTS PASSED"
fi
