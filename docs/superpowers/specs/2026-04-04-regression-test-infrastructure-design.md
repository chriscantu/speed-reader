# Regression Test Infrastructure — Design Spec

## Problem Statement

**User**: Chris (solo developer, pre-release and ongoing)

**Problem**: The regression test script covers core overlay lifecycle but is missing keyboard shortcuts, WPM changes, theme switching, and font toggling — all shipped v1 features. The script's bash architecture doesn't scale: adding new test scenarios requires duplicating `osascript`/`postMessage` wiring with fragile string quoting and JSON parsing via `python3`. As v2/v3 features land, this becomes a growing tax.

**Impact**: Every PR cycle requires manually verifying features that could be scripted. Untested features can regress silently. The cost of adding new regression tests grows linearly with script complexity.

**Evidence**: Existing script has 10 test sections but zero coverage for 4 shipped features. Roadmap shows 10+ additional features coming in v2/v3 that would each need regression coverage.

**Constraints**: macOS-only (`osascript` to drive Safari). Extension must be manually built/enabled. Safari JS-from-Apple-Events must be on.

## Architecture

### Approach

Modular Node.js test suite using `node:test` and `node:assert` (same framework as existing unit tests). A Safari driver module wraps `osascript` into a clean async API. Content script gets a generic dispatch command for extensibility. Manual regression checklist covers iOS/iPadOS.

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Timing | Poll-until-ready (`waitFor`) | Eliminates fixed `sleep` calls; reliable and fast |
| Multi-platform | Automated macOS + manual checklist | No `osascript` equivalent on iOS; checklist stays visible at PR review |
| Command routing | Generic `speedreader-test-dispatch` | One handler scales to any future action; existing 4 commands stay for backward compat |
| Language | Node.js over bash | Native JSON, real assertions, async/await for polling, consistent with unit tests |
| Test framework | `node:test` + `node:assert` | Already used for unit tests; no new dependencies |

## File Structure

```
scripts/
└── lib/
    └── safari-driver.js            # osascript bridge
tests/
└── regression/
    ├── helpers.js                  # Shared setup (navigate, open overlay, etc.)
    ├── 01-prerequisites.test.js
    ├── 02-overlay-lifecycle.test.js
    ├── 03-playback.test.js
    ├── 04-navigation.test.js
    ├── 05-keyboard.test.js
    ├── 06-wpm.test.js
    ├── 07-theme.test.js
    ├── 08-font.test.js
    ├── 09-selection.test.js
    └── 10-re-toggle.test.js
docs/
└── regression-checklist.md         # Manual iOS/iPadOS verification checklist
```

## Safari Driver (`scripts/lib/safari-driver.js`)

The core infrastructure module bridging Node.js to Safari via `osascript`.

### Exports

| Function | Purpose |
|----------|---------|
| `execJS(jsCode)` | Run arbitrary JS in Safari's active document via `osascript`. Returns the string result. Handles escaping internally. |
| `navigate(url)` | Set Safari's document URL and wait for page load. |
| `queryState()` | Send `speedreader-test-query` via postMessage, return parsed JSON object with all overlay state fields. |
| `dispatch(action, payload)` | Send `speedreader-test-dispatch` with action name + payload object. |
| `clickOverlay(selector)` | Send `speedreader-test-click` for a CSS selector. |
| `toggle()` | Send `speedreader-test-toggle`. |
| `waitFor(predicateFn, {timeout, interval})` | Poll `queryState()` until `predicateFn(state)` returns true. Rejects after timeout (default 5s). Uses `setTimeout` promise loop. |

### Design Notes

- `execJS` handles quoting — callers pass a normal JS string, it escapes for `osascript -e`.
- `queryState` calls `execJS` twice: once to set up the listener + send the query, once to read `window.__srTestResult`. Polls with a short interval until result is non-null.
- All functions are `async` for consistency and to allow future transport changes.

## Content Script Changes (`content.js`)

### New Dispatch Handler

A generic `speedreader-test-dispatch` message type added to the existing postMessage router. The 4 existing commands (`toggle`, `query`, `click`, `next`) remain unchanged.

**Message format:**

```js
{ type: 'speedreader-test-dispatch', action: 'keypress', payload: { key: 'Space' } }
```

### Supported Actions

| Action | Payload | Behavior |
|--------|---------|----------|
| `keypress` | `{ key }` | Dispatches `KeyboardEvent('keydown')` on `document` with the given key |
| `set-theme` | `{ theme }` | Calls `overlay.updateSettings({ theme })` |
| `set-font` | `{ font }` | Calls `overlay.updateSettings({ font })` |
| `set-wpm` | `{ wpm }` | Sets `overlay.state.wpm` via `clampWpm()`, updates `overlay.elements.slider.value` and `overlay.elements.wpmLabel.textContent` |
| `get-host-attrs` | none | Returns `data-theme` and `data-font` attributes from `overlay.host` via test-result message |

### Query State Extension

The existing `speedreader-test-query` response gets two new fields:

| Field | Source |
|-------|--------|
| `theme` | `overlay.host.getAttribute('data-theme')` or `'system'` if absent |
| `font` | `overlay.host.getAttribute('data-font')` or `'default'` if absent |

## Test Scenarios

### 01-prerequisites
- Safari running
- JS-from-Apple-Events enabled (execute `1+1`, expect `2`)
- Content script loaded (`data-speedreader-loaded` attribute on `<html>`)

### 02-overlay-lifecycle
- Overlay initially closed
- Toggle opens overlay
- Shadow DOM attached
- Toggle again closes overlay
- Re-open after close works

### 03-playback
- Play starts advancing (`currentIndex` increases)
- Pause freezes word
- Word text unchanged while paused
- Context text appears on pause

### 04-navigation
- Next sentence changes word
- Prev sentence changes word
- Navigation while paused stays paused

### 05-keyboard (new coverage)
- `Space` toggles play/pause
- `Escape` closes overlay
- `ArrowRight` advances sentence
- `ArrowLeft` goes back
- `ArrowUp` increases WPM by 25
- `ArrowDown` decreases WPM by 25

### 06-wpm (new coverage)
- Dispatch `set-wpm` to 400, verify `queryState().wpm === 400` and label reads `"400 wpm"`
- `ArrowUp` from 600 stays clamped at 600
- `ArrowDown` from 100 stays clamped at 100

### 07-theme (new coverage)
- Dispatch `set-theme: 'dark'`, verify `queryState().theme === 'dark'`
- Dispatch `set-theme: 'light'`, verify `queryState().theme === 'light'`
- Dispatch `set-theme: 'system'`, verify theme returns `'system'`

### 08-font (new coverage)
- Dispatch `set-font: 'opendyslexic'`, verify `queryState().font === 'opendyslexic'`
- Dispatch `set-font: 'default'`, verify attribute removed

### 09-selection
- Select text on page
- Toggle overlay
- Verify word count is less than full article

### 10-re-toggle
- Full cycle: open, play, close, re-open
- State resets cleanly

## Manual Regression Checklist (`docs/regression-checklist.md`)

A standalone checklist for PR reviews covering what automation cannot.

**Sections:**
- **iOS (iPhone)** — overlay opens, tap to pause, swipe-friendly controls, WPM slider with touch, theme follows system, OpenDyslexic renders
- **iPadOS** — same as iOS plus keyboard shortcuts with external keyboard, split-view doesn't break overlay
- **macOS gaps** — VoiceOver interaction, actual slider drag vs. programmatic set

Header states: "Run `make test-regression` first. This checklist covers what automation cannot."

Updated when new features ship.

## Makefile

```makefile
test-regression:
	node --test tests/regression/*.test.js
```

Replaces the current `./scripts/regression-test.sh` invocation.

## Migration

- Existing `scripts/regression-test.sh` is deleted after all scenarios are ported
- No parallel existence — one replaces the other (pre-release, no backward compat needed)
- Individual test files runnable for iteration: `node --test tests/regression/05-keyboard.test.js`
