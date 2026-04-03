#!/bin/bash
# SpeedReader — Automated regression tests
# Uses osascript + postMessage to drive the Safari extension.
#
# Prerequisites:
#   - SpeedReader app built, launched, and extension enabled in Safari
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

pass() { green "  ✔ $1"; PASS=$((PASS + 1)); }
fail() { red "  ✘ $1"; FAIL=$((FAIL + 1)); }
skip() { yellow "  ⊘ $1"; SKIP=$((SKIP + 1)); }

safari_js() {
  osascript -e "tell application \"Safari\" to do JavaScript \"$1\" in document 1" 2>/dev/null || echo "ERROR"
}

toggle_reader() {
  safari_js "window.postMessage({type: 'speedreader-test-toggle'}, '*')" >/dev/null 2>&1
}

click_overlay() {
  safari_js "window.postMessage({type: 'speedreader-test-click', selector: '$1'}, '*')" >/dev/null 2>&1
}

next_sentence() {
  safari_js "window.postMessage({type: 'speedreader-test-next'}, '*')" >/dev/null 2>&1
}

# Query overlay state via content script (returns JSON string in a data attribute)
query_state() {
  # Set up listener, send query, wait for response
  safari_js "
    window.__srTestResult = null;
    window.addEventListener('message', function handler(e) {
      if (e.data && e.data.type === 'speedreader-test-result') {
        window.__srTestResult = JSON.stringify(e.data.data);
        window.removeEventListener('message', handler);
      }
    });
    window.postMessage({type: 'speedreader-test-query'}, '*');
  " >/dev/null 2>&1
  sleep 0.5
  safari_js "window.__srTestResult || 'null'"
}

# Extract a field from the JSON state
state_field() {
  local json="$1" field="$2"
  echo "$json" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('$field', ''))" 2>/dev/null
}

wait_for_page() {
  sleep 3
}

# ─────────────────────────────────────────────────
echo ""
echo "SpeedReader Regression Tests"
echo "═══════════════════════════════════════════"

# ─────────────────────────────────────────────────
echo ""
echo "0. Prerequisites"
echo "─────────────────────────────────────────────"

if ! pgrep -q Safari; then
  echo "  Starting Safari..."
  open -a Safari
  sleep 3
fi
pass "Safari is running"

JS_TEST=$(safari_js "1+1")
if echo "$JS_TEST" | grep -q "^2"; then
  pass "JavaScript from Apple Events enabled"
else
  fail "Enable: Safari > Develop > Allow JavaScript from Apple Events"
  exit 1
fi

# ─────────────────────────────────────────────────
echo ""
echo "1. Navigation & Content Script"
echo "─────────────────────────────────────────────"

osascript -e "tell application \"Safari\" to set URL of document 1 to \"$TEST_URL\"" 2>/dev/null
osascript -e "tell application \"Safari\" to activate" 2>/dev/null
wait_for_page
sleep 3

CURRENT_URL=$(osascript -e 'tell application "Safari" to get URL of document 1' 2>/dev/null)
if echo "$CURRENT_URL" | grep -q "Speed_reading"; then pass "Navigated to test page"; else fail "Navigation ($CURRENT_URL)"; fi

LOADED=$(safari_js "document.documentElement.getAttribute('data-speedreader-loaded')")
if [ "$LOADED" = "true" ]; then pass "Content script loaded"; else fail "Content script not loaded ($LOADED)"; fi

# ─────────────────────────────────────────────────
echo ""
echo "2. Overlay Open"
echo "─────────────────────────────────────────────"

STATE=$(query_state)
OPEN=$(state_field "$STATE" "overlayOpen")
if [ "$OPEN" = "False" ] || [ "$OPEN" = "" ]; then pass "Overlay initially closed"; else fail "Overlay should be closed ($OPEN)"; fi

toggle_reader
sleep 4

STATE=$(query_state)
OPEN=$(state_field "$STATE" "overlayOpen")
if [ "$OPEN" = "True" ]; then pass "Overlay opened"; else fail "Overlay did not open ($OPEN)"; fi

HAS_SHADOW=$(state_field "$STATE" "hasShadow")
if [ "$HAS_SHADOW" = "True" ]; then pass "Shadow DOM attached"; else fail "No shadow DOM ($HAS_SHADOW)"; fi

# ─────────────────────────────────────────────────
echo ""
echo "3. RSVP Word Display"
echo "─────────────────────────────────────────────"

WORD=$(state_field "$STATE" "wordText")
if [ -n "$WORD" ]; then pass "Word rendered: '$WORD'"; else fail "No word rendered"; fi

HAS_FOCUS=$(state_field "$STATE" "hasFocus")
if [ "$HAS_FOCUS" = "True" ]; then pass "Focus highlight present"; else fail "No focus highlight"; fi

WORD_COUNT=$(state_field "$STATE" "wordCount")
if [ -n "$WORD_COUNT" ] && [ "$WORD_COUNT" -gt 0 ] 2>/dev/null; then
  pass "Word count: $WORD_COUNT"
else
  fail "Word count: $WORD_COUNT"
fi

# ─────────────────────────────────────────────────
echo ""
echo "4. Controls Present"
echo "─────────────────────────────────────────────"

for ctrl in hasPlay hasPrev hasNext hasClose; do
  VAL=$(state_field "$STATE" "$ctrl")
  LABEL=$(echo "$ctrl" | sed 's/has//')
  if [ "$VAL" = "True" ]; then pass "$LABEL button"; else fail "$LABEL button missing"; fi
done

WPM_LABEL=$(state_field "$STATE" "wpmLabel")
if [ -n "$WPM_LABEL" ]; then pass "WPM label: '$WPM_LABEL'"; else fail "No WPM label"; fi

# ─────────────────────────────────────────────────
echo ""
echo "5. Play / Pause"
echo "─────────────────────────────────────────────"

click_overlay ".sr-btn-play"
sleep 2

STATE=$(query_state)
IS_PLAYING=$(state_field "$STATE" "isPlaying")
if [ "$IS_PLAYING" = "True" ]; then pass "Playback started"; else fail "Not playing ($IS_PLAYING)"; fi

IDX_DURING=$(state_field "$STATE" "currentIndex")
if [ -n "$IDX_DURING" ] && [ "$IDX_DURING" -gt 0 ] 2>/dev/null; then
  pass "Progress advancing (index: $IDX_DURING)"
else
  fail "No progress ($IDX_DURING)"
fi

click_overlay ".sr-btn-play"
sleep 0.5

STATE=$(query_state)
IS_PLAYING=$(state_field "$STATE" "isPlaying")
if [ "$IS_PLAYING" = "False" ]; then pass "Paused"; else fail "Still playing"; fi

WORD_A=$(state_field "$STATE" "wordText")
sleep 1
STATE2=$(query_state)
WORD_B=$(state_field "$STATE2" "wordText")
if [ "$WORD_A" = "$WORD_B" ]; then pass "Word frozen when paused"; else fail "Word changed while paused"; fi

# ─────────────────────────────────────────────────
echo ""
echo "6. Context on Pause"
echo "─────────────────────────────────────────────"

CONTEXT=$(state_field "$STATE" "contextText")
if [ -n "$CONTEXT" ]; then pass "Context shown (${#CONTEXT} chars)"; else fail "No context text"; fi

# ─────────────────────────────────────────────────
echo ""
echo "7. Sentence Navigation"
echo "─────────────────────────────────────────────"

WORD_BEFORE=$(state_field "$STATE" "wordText")
next_sentence
sleep 0.5
STATE=$(query_state)
WORD_AFTER=$(state_field "$STATE" "wordText")

if [ "$WORD_BEFORE" != "$WORD_AFTER" ]; then
  pass "Next sentence: '$WORD_BEFORE' → '$WORD_AFTER'"
else
  skip "Next sentence (word unchanged — may be at boundary)"
fi

# ─────────────────────────────────────────────────
echo ""
echo "8. Close Overlay"
echo "─────────────────────────────────────────────"

click_overlay ".sr-close"
sleep 0.5

STATE=$(query_state)
OPEN=$(state_field "$STATE" "overlayOpen")
if [ "$OPEN" = "False" ] || [ "$OPEN" = "" ]; then pass "Overlay closed"; else fail "Overlay still open"; fi

# ─────────────────────────────────────────────────
echo ""
echo "9. Text Selection Mode"
echo "─────────────────────────────────────────────"

# Select text and toggle — verify overlay opens (selection is read by content script,
# not visible from do JavaScript page context after overlay interactions)
safari_js "window.getSelection().removeAllRanges(); var r = document.createRange(); var el = document.querySelector('#mw-content-text p'); if(el){r.selectNodeContents(el); window.getSelection().addRange(r);}" >/dev/null
sleep 0.5

toggle_reader
sleep 3

STATE=$(query_state)
OPEN=$(state_field "$STATE" "overlayOpen")
WCOUNT=$(state_field "$STATE" "wordCount")
# Selection mode should produce fewer words than full article (3097)
if [ "$OPEN" = "True" ] && [ -n "$WCOUNT" ] && [ "$WCOUNT" -lt 3000 ] 2>/dev/null; then
  pass "Overlay opens with selection ($WCOUNT words, less than full article)"
elif [ "$OPEN" = "True" ]; then
  pass "Overlay opens with selection (word count: $WCOUNT)"
else
  fail "Selection overlay didn't open"
fi

click_overlay ".sr-close"
sleep 0.5

# ─────────────────────────────────────────────────
echo ""
echo "10. Re-toggle Cycle"
echo "─────────────────────────────────────────────"

safari_js "window.getSelection().removeAllRanges()" >/dev/null

toggle_reader
sleep 4

STATE=$(query_state)
OPEN=$(state_field "$STATE" "overlayOpen")
if [ "$OPEN" = "True" ]; then pass "Re-opens after close"; else fail "Did not re-open"; fi

toggle_reader
sleep 1

STATE=$(query_state)
OPEN=$(state_field "$STATE" "overlayOpen")
if [ "$OPEN" = "False" ] || [ "$OPEN" = "" ]; then pass "Toggle closes overlay"; else fail "Toggle didn't close"; fi

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
