# Font Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 5-font picker in the companion app and an A−/A+ font size stepper in the RSVP overlay, with an overflow bug fix as prerequisite.

**Architecture:** Extend the existing `ReaderFont` enum with 3 new system font cases. Add CSS `data-font` attribute selectors. Build a font size stepper in the overlay DOM. Wire up overlay→native settings sync via the existing `saveSettings` handler. Fix word area overflow before expanding the font size range.

**Tech Stack:** Swift/SwiftUI (companion app), vanilla JS + CSS (Safari Web Extension), Node.js test runner (`node --test`), XCTest (Swift tests)

**Spec:** `docs/superpowers/specs/2026-04-04-font-customization-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `SpeedReader/Shared/SettingsKeys.swift` | Modify | Add 3 enum cases to `ReaderFont`, widen font size bounds |
| `SpeedReader/SpeedReader/Views/SettingsView.swift` | Modify | Font picker labels update (enum drives it automatically) |
| `SpeedReader/SpeedReader/Models/Settings.swift` | No change | Already reads `ReaderFont` via `rawValue` init |
| `SpeedReader/SpeedReaderExtension/SafariWebExtensionHandler.swift` | No change | Already passes `sr_font` opaquely |
| `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.css` | Modify | New `data-font` selectors, overflow fix, stepper styles |
| `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js` | Modify | Font size stepper DOM + events, save-settings call |
| `SpeedReader/SpeedReaderExtension/Resources/rsvp/settings-defaults.js` | Modify | Add font size min/max constants |
| `SpeedReader/SpeedReaderExtension/Resources/background.js` | Modify | Add `save-settings` message handler |
| `SpeedReader/SpeedReaderExtension/Resources/content.js` | Modify | Add `set-font-size` dispatch for tests |
| `SpeedReader/SpeedReaderTests/SettingsTests.swift` | Modify | Tests for new font cases + new bounds |
| `tests/regression/08-font.test.js` | Modify | Regression tests for new fonts + font size |

---

### Task 1: Fix overlay word area overflow

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.css:115-121` (`.sr-word-area`)
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.css:129-134` (`.sr-word`)
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.css:316-323` (mobile breakpoint)

- [ ] **Step 1: Add overflow containment to `.sr-word-area`**

In `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.css`, replace the `.sr-word-area` rule:

```css
.sr-word-area {
  text-align: center;
  padding: 36px 0;
  border-top: 1px solid var(--sr-border);
  border-bottom: 1px solid var(--sr-border);
  cursor: pointer;
  overflow: hidden;
}
```

- [ ] **Step 2: Add word-break safety to `.sr-word`**

In the same file, add `word-break` to the `.sr-word` rule:

```css
.sr-word {
  font-size: var(--sr-word-size);
  font-weight: 300;
  letter-spacing: 2px;
  font-family: var(--sr-font-family);
  word-break: break-all;
}
```

- [ ] **Step 3: Remove forced font size override in mobile breakpoint**

In the `@media (max-width: 480px)` block, remove the `:host` rule that forces `--sr-word-size: 36px`. The block should become:

```css
@media (max-width: 480px) {
  .sr-card {
    width: calc(100vw - 24px);
    padding: 16px;
  }

  .sr-btn-play {
    width: 52px;
    height: 52px;
    font-size: 20px;
  }

  .sr-btn {
    font-size: 24px;
    padding: 10px;
  }

  .sr-context {
    margin-top: 8px;
    font-size: 12px;
  }

  .sr-shortcut-hint {
    display: none;
  }
}
```

- [ ] **Step 4: Verify visually**

Open the extension in Safari, set font size to 64px via the companion app, open the overlay on a page with long words. Verify text stays contained within the card and doesn't bleed into surrounding elements.

- [ ] **Step 5: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.css
git commit -m "Fix overlay word area overflow at large font sizes

Add overflow:hidden on sr-word-area and word-break:break-all on sr-word.
Remove mobile breakpoint forced font size override to respect user settings."
```

---

### Task 2: Extend ReaderFont enum with 3 new fonts

**Files:**
- Modify: `SpeedReader/Shared/SettingsKeys.swift:5-17` (`ReaderFont` enum)
- Test: `SpeedReader/SpeedReaderTests/SettingsTests.swift`

- [ ] **Step 1: Write failing tests for new font cases**

In `SpeedReader/SpeedReaderTests/SettingsTests.swift`, add these tests after the existing `testSaveSettingsRejectsInvalidThemeRawValue` test:

```swift
// MARK: - New font cases

func testNewYorkFontRoundTrips() {
    let store = makeDefaults()
    let settings = ReaderSettings(defaults: store)
    settings.setFont(.newYork)
    let reloaded = ReaderSettings(defaults: store)
    XCTAssertEqual(reloaded.font, .newYork)
}

func testGeorgiaFontRoundTrips() {
    let store = makeDefaults()
    let settings = ReaderSettings(defaults: store)
    settings.setFont(.georgia)
    let reloaded = ReaderSettings(defaults: store)
    XCTAssertEqual(reloaded.font, .georgia)
}

func testMenloFontRoundTrips() {
    let store = makeDefaults()
    let settings = ReaderSettings(defaults: store)
    settings.setFont(.menlo)
    let reloaded = ReaderSettings(defaults: store)
    XCTAssertEqual(reloaded.font, .menlo)
}

func testSaveSettingsAcceptsNewFontRawValues() {
    let store = makeDefaults()
    for rawValue in ["newYork", "georgia", "menlo"] {
        let count = SettingsKeys.saveSettings(["font": rawValue], to: store)
        XCTAssertEqual(count, 1, "Expected \(rawValue) to be accepted")
        XCTAssertEqual(store.string(forKey: SettingsKeys.font), rawValue)
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `xcodebuild test -project SpeedReader/SpeedReader.xcodeproj -scheme SpeedReader -destination 'platform=macOS' -quiet 2>&1 | tail -20`

Expected: Compile errors — `.newYork`, `.georgia`, `.menlo` don't exist yet.

- [ ] **Step 3: Add new cases to ReaderFont enum**

In `SpeedReader/Shared/SettingsKeys.swift`, replace the `ReaderFont` enum:

```swift
/// Font options for the RSVP reader.
enum ReaderFont: String, CaseIterable, Identifiable {
    case system = "system"
    case openDyslexic = "opendyslexic"
    case newYork = "newYork"
    case georgia = "georgia"
    case menlo = "menlo"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .system: return "System (San Francisco)"
        case .openDyslexic: return "OpenDyslexic"
        case .newYork: return "New York (Serif)"
        case .georgia: return "Georgia (Serif)"
        case .menlo: return "Menlo (Monospace)"
        }
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `xcodebuild test -project SpeedReader/SpeedReader.xcodeproj -scheme SpeedReader -destination 'platform=macOS' -quiet 2>&1 | tail -20`

Expected: All tests pass, including the 4 new ones.

- [ ] **Step 5: Commit**

```bash
git add SpeedReader/Shared/SettingsKeys.swift SpeedReader/SpeedReaderTests/SettingsTests.swift
git commit -m "Add New York, Georgia, and Menlo to ReaderFont enum

Extend ReaderFont with 3 system font cases. All use descriptive
display names with category labels for the companion app picker."
```

---

### Task 3: Widen font size bounds to 24–96

**Files:**
- Modify: `SpeedReader/Shared/SettingsKeys.swift:63-68` (font size bounds)
- Test: `SpeedReader/SpeedReaderTests/SettingsTests.swift`

- [ ] **Step 1: Write failing tests for new bounds**

In `SpeedReader/SpeedReaderTests/SettingsTests.swift`, add these tests:

```swift
// MARK: - Widened font size bounds

func testFontSizeAccepts24() {
    let settings = makeSettings()
    settings.setFontSize(24)
    XCTAssertEqual(settings.fontSize, 24)
}

func testFontSizeAccepts96() {
    let settings = makeSettings()
    settings.setFontSize(96)
    XCTAssertEqual(settings.fontSize, 96)
}

func testFontSizeClampedToNewMinimum() {
    let settings = makeSettings()
    settings.setFontSize(10)
    XCTAssertEqual(settings.fontSize, 24)
}

func testFontSizeClampedToNewMaximum() {
    let settings = makeSettings()
    settings.setFontSize(200)
    XCTAssertEqual(settings.fontSize, 96)
}

func testSaveSettingsClampsFontSizeToNewRange() {
    let store = makeDefaults()
    let countLow = SettingsKeys.saveSettings(["fontSize": 10], to: store)
    XCTAssertEqual(countLow, 1)
    XCTAssertEqual(store.integer(forKey: SettingsKeys.fontSize), 24)

    let countHigh = SettingsKeys.saveSettings(["fontSize": 200], to: store)
    XCTAssertEqual(countHigh, 1)
    XCTAssertEqual(store.integer(forKey: SettingsKeys.fontSize), 96)
}
```

- [ ] **Step 2: Run tests to verify new bounds tests fail**

Run: `xcodebuild test -project SpeedReader/SpeedReader.xcodeproj -scheme SpeedReader -destination 'platform=macOS' -quiet 2>&1 | tail -30`

Expected: `testFontSizeAccepts24` fails (clamped to 28), `testFontSizeAccepts96` fails (clamped to 64).

- [ ] **Step 3: Update font size bounds**

In `SpeedReader/Shared/SettingsKeys.swift`, change the font size constants:

```swift
/// Font size bounds
static let fontSizeMin = 24
static let fontSizeMax = 96
```

- [ ] **Step 4: Update old tests that assert against old bounds**

In `SpeedReader/SpeedReaderTests/SettingsTests.swift`, update the existing tests:

Replace `testFontSizeClampedToMinimum`:
```swift
func testFontSizeClampedToMinimum() {
    let settings = makeSettings()
    settings.setFontSize(10)
    XCTAssertEqual(settings.fontSize, 24)
}
```

Replace `testFontSizeClampedToMaximum`:
```swift
func testFontSizeClampedToMaximum() {
    let settings = makeSettings()
    settings.setFontSize(200)
    XCTAssertEqual(settings.fontSize, 96)
}
```

Replace `testInitClampsFontSizeBelowMinimum`:
```swift
func testInitClampsFontSizeBelowMinimum() {
    let store = makeDefaults()
    store.set(10, forKey: SettingsKeys.fontSize)
    let settings = ReaderSettings(defaults: store)
    XCTAssertEqual(settings.fontSize, 24)
}
```

Replace `testInitClampsFontSizeAboveMaximum`:
```swift
func testInitClampsFontSizeAboveMaximum() {
    let store = makeDefaults()
    store.set(200, forKey: SettingsKeys.fontSize)
    let settings = ReaderSettings(defaults: store)
    XCTAssertEqual(settings.fontSize, 96)
}
```

Replace `testSaveSettingsClampsFontSizeToValidRange`:
```swift
func testSaveSettingsClampsFontSizeToValidRange() {
    let store = makeDefaults()
    let count = SettingsKeys.saveSettings(["fontSize": 1], to: store)
    XCTAssertEqual(count, 1)
    XCTAssertEqual(store.integer(forKey: SettingsKeys.fontSize), 24)
}
```

- [ ] **Step 5: Run all tests**

Run: `xcodebuild test -project SpeedReader/SpeedReader.xcodeproj -scheme SpeedReader -destination 'platform=macOS' -quiet 2>&1 | tail -20`

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add SpeedReader/Shared/SettingsKeys.swift SpeedReader/SpeedReaderTests/SettingsTests.swift
git commit -m "Widen font size range from 28-64 to 24-96

Supports larger display sizes for iPad and Mac at arm's length.
Update all existing tests to reflect new bounds."
```

---

### Task 4: Add CSS `data-font` selectors for new fonts

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.css:53-55`

- [ ] **Step 1: Add new font attribute selectors**

In `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.css`, after the existing `:host([data-font="opendyslexic"])` rule (line 53-55), add:

```css
:host([data-font="newYork"]) {
  --sr-font-family: 'New York', 'Iowan Old Style', Georgia, serif;
}

:host([data-font="georgia"]) {
  --sr-font-family: Georgia, 'Times New Roman', serif;
}

:host([data-font="menlo"]) {
  --sr-font-family: Menlo, 'Courier New', monospace;
}
```

- [ ] **Step 2: Verify visually**

Open the extension, set each new font via the companion app's picker (which now shows 5 options thanks to Task 2). Verify each font renders correctly in the overlay with the ORP focus point visible.

- [ ] **Step 3: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.css
git commit -m "Add CSS data-font selectors for New York, Georgia, and Menlo

Each has a fallback chain for platform safety. All are system fonts,
no new font files needed."
```

---

### Task 5: Add font size constants to settings-defaults.js

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/settings-defaults.js`

- [ ] **Step 1: Add font size min/max constants**

In `SpeedReader/SpeedReaderExtension/Resources/rsvp/settings-defaults.js`, add font size bounds after `FONT_SIZE_DEFAULT`:

```javascript
// Shared settings constants — single source of truth for JS layer.
// Mirrors SettingsKeys.swift on the native side.

export const WPM_MIN = 100;
export const WPM_MAX = 600;
export const WPM_DEFAULT = 250;
export const FONT_SIZE_DEFAULT = 42;
export const FONT_SIZE_MIN = 24;
export const FONT_SIZE_MAX = 96;
export const FONT_SIZE_STEP = 2;

export const SETTINGS_KEYS = ['wpm', 'font', 'theme', 'fontSize', 'punctuationPause'];

export const SETTINGS_DEFAULTS = {
  wpm: WPM_DEFAULT,
  font: 'system',
  theme: 'system',
  fontSize: FONT_SIZE_DEFAULT,
  punctuationPause: true,
};

export function clampWpm(value) {
  if (typeof value !== 'number' || isNaN(value)) return WPM_DEFAULT;
  return Math.max(WPM_MIN, Math.min(WPM_MAX, value));
}

export function clampFontSize(value) {
  if (typeof value !== 'number' || isNaN(value)) return FONT_SIZE_DEFAULT;
  return Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, value));
}
```

- [ ] **Step 2: Run existing JS tests to verify no regressions**

Run: `node --test tests/js/*.test.js`

Expected: All existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/settings-defaults.js
git commit -m "Add font size bounds and clampFontSize to settings-defaults.js

Mirrors the widened 24-96 range from SettingsKeys.swift. Provides
FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_STEP, and clampFontSize()."
```

---

### Task 6: Add save-settings handler to background.js

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/background.js:89-115`

- [ ] **Step 1: Add save-settings message listener**

In `SpeedReader/SpeedReaderExtension/Resources/background.js`, add a new case inside the `browser.runtime.onMessage.addListener` callback, after the `sync-settings` handler:

```javascript
  if (message.action === 'save-settings') {
    var settings = message.settings;
    if (!settings || typeof settings !== 'object') {
      sendResponse({ ok: false, error: 'Missing settings payload' });
      return true;
    }
    browser.runtime.sendNativeMessage(
      'com.chriscantu.SpeedReader',
      { action: 'saveSettings', settings: settings }
    ).then(function(response) {
      sendResponse({ ok: true, savedCount: response.savedCount || 0 });
    }).catch(function(err) {
      console.warn('[SpeedReader] save-settings to native failed:', err.message || err);
      sendResponse({ ok: false, error: err.message || String(err) });
    });
    return true; // async response
  }
```

- [ ] **Step 2: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/background.js
git commit -m "Add save-settings message handler to background.js

Bridges overlay settings changes back to native App Group UserDefaults
via the existing saveSettings handler in SafariWebExtensionHandler."
```

---

### Task 7: Build font size stepper in overlay

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js`
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.css`

- [ ] **Step 1: Add stepper CSS styles**

In `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.css`, add after the `.sr-slider` thumb rule (after line 266):

```css
.sr-font-size-area {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--sr-border);
}

.sr-font-size-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sr-font-size-label {
  font-size: 12px;
  color: var(--sr-text-muted);
}

.sr-font-size-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sr-font-size-btn {
  background: none;
  border: 1px solid var(--sr-border);
  border-radius: 5px;
  color: var(--sr-text-muted);
  font-size: 13px;
  width: 26px;
  height: 26px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--sr-font-family);
  padding: 0;
  line-height: 1;
}

.sr-font-size-btn:hover {
  color: var(--sr-text);
  border-color: var(--sr-text-muted);
}

.sr-font-size-value {
  font-size: 12px;
  color: var(--sr-text);
  min-width: 36px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 2: Add responsive sizing for mobile stepper**

In the `@media (max-width: 480px)` block, add:

```css
  .sr-font-size-btn {
    width: 36px;
    height: 36px;
    font-size: 16px;
    border-radius: 6px;
  }

  .sr-font-size-value {
    font-size: 14px;
    min-width: 40px;
  }

  .sr-font-size-controls {
    gap: 14px;
  }

  .sr-font-size-label {
    font-size: 13px;
  }
```

- [ ] **Step 3: Add stepper DOM creation to overlay.js**

In `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js`, update the import line at the top:

```javascript
import { RSVPStateMachine } from './state-machine.js';
import { FONT_SIZE_DEFAULT, FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_STEP, clampWpm, clampFontSize } from './settings-defaults.js';
```

Then in the `_createDOM()` method, after the `sliderArea` block (after `sliderArea.appendChild(slider);` around line 451) and before the `progressArea` block, add:

```javascript
    // Font size stepper area
    const fontSizeArea = document.createElement('div');
    fontSizeArea.className = 'sr-font-size-area';

    const fontSizeRow = document.createElement('div');
    fontSizeRow.className = 'sr-font-size-row';

    const fontSizeLabel = document.createElement('span');
    fontSizeLabel.className = 'sr-font-size-label';
    fontSizeLabel.textContent = 'Text Size';

    const fontSizeControls = document.createElement('div');
    fontSizeControls.className = 'sr-font-size-controls';

    const fontSizeDown = document.createElement('button');
    fontSizeDown.className = 'sr-font-size-btn';
    fontSizeDown.textContent = 'A\u2212';
    fontSizeDown.setAttribute('aria-label', 'Decrease text size');
    this.elements.fontSizeDown = fontSizeDown;

    const fontSizeValue = document.createElement('span');
    fontSizeValue.className = 'sr-font-size-value';
    fontSizeValue.textContent = (this.settings.fontSize || FONT_SIZE_DEFAULT) + 'px';
    fontSizeValue.setAttribute('aria-live', 'polite');
    this.elements.fontSizeValue = fontSizeValue;

    const fontSizeUp = document.createElement('button');
    fontSizeUp.className = 'sr-font-size-btn';
    fontSizeUp.textContent = 'A+';
    fontSizeUp.setAttribute('aria-label', 'Increase text size');
    this.elements.fontSizeUp = fontSizeUp;

    fontSizeControls.appendChild(fontSizeDown);
    fontSizeControls.appendChild(fontSizeValue);
    fontSizeControls.appendChild(fontSizeUp);

    fontSizeRow.appendChild(fontSizeLabel);
    fontSizeRow.appendChild(fontSizeControls);
    fontSizeArea.appendChild(fontSizeRow);
```

Then update the card assembly section. Find where `card.appendChild(sliderArea)` is, and add after it:

```javascript
    card.appendChild(fontSizeArea);
```

- [ ] **Step 4: Add `adjustFontSize` method**

In `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js`, add this method after the `adjustWpm` method:

```javascript
  adjustFontSize(delta) {
    var current = this.settings.fontSize || FONT_SIZE_DEFAULT;
    var newSize = clampFontSize(current + delta);
    this.settings.fontSize = newSize;
    this._syncFontSizeOverride(newSize);
    if (this.elements.fontSizeValue) {
      this.elements.fontSizeValue.textContent = newSize + 'px';
    }
    this._persistFontSize(newSize);
  }

  _persistFontSize(fontSize) {
    try {
      browser.storage.sync.set({ fontSize: fontSize });
      browser.runtime.sendMessage({
        action: 'save-settings',
        settings: { fontSize: fontSize },
      }).catch(function(err) {
        console.warn('[SpeedReader] Failed to save font size to native:', err.message || err);
      });
    } catch (e) {
      console.warn('[SpeedReader] Failed to persist font size:', e);
    }
  }
```

- [ ] **Step 5: Bind stepper events**

In the `_bindEvents()` method, add after the slider input listener:

```javascript
    this.elements.fontSizeDown.addEventListener('click', () => {
      this.adjustFontSize(-FONT_SIZE_STEP);
    });

    this.elements.fontSizeUp.addEventListener('click', () => {
      this.adjustFontSize(FONT_SIZE_STEP);
    });
```

- [ ] **Step 6: Update `updateSettings` to sync stepper label**

In the `updateSettings` method, after the `this._syncFontSizeOverride(settings.fontSize)` call, add:

```javascript
      if (this.elements.fontSizeValue) {
        this.elements.fontSizeValue.textContent = settings.fontSize + 'px';
      }
```

- [ ] **Step 7: Verify visually**

Open the overlay in Safari. Verify:
- A−/A+ stepper appears below the WPM slider with a divider line
- Tapping A+ increases font size by 2px, A− decreases by 2px
- Value label updates live
- Font size clamps at 24 (A− stops) and 96 (A+ stops)
- Word display updates immediately
- On mobile viewport (≤480px), buttons are larger

- [ ] **Step 8: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.css
git commit -m "Add font size stepper (A-/A+) to RSVP overlay

Placed below WPM slider with divider. Responsive sizing via existing
480px breakpoint. Persists to browser.storage.sync and native app.
Range: 24-96px, step 2px."
```

---

### Task 8: Add test dispatch for font size and new fonts

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/content.js:253-271`

- [ ] **Step 1: Add `set-font-size` dispatch and update query state**

In `SpeedReader/SpeedReaderExtension/Resources/content.js`, in the `speedreader-test-dispatch` handler, add `'set-font-size'` to the `overlayActions` array and add the handler:

Replace the `overlayActions` line and the dispatch block:

```javascript
    var overlayActions = ['set-theme', 'set-font', 'set-wpm', 'set-font-size'];

    if (overlayActions.indexOf(action) !== -1 && !overlay) {
      console.warn('[SpeedReader] dispatch ' + action + ' ignored: overlay not open');
    } else if (action === 'keydown') {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: payload.key, bubbles: true }));
    } else if (action === 'set-theme') {
      overlay.updateSettings({ theme: payload.theme });
    } else if (action === 'set-font') {
      overlay.updateSettings({ font: payload.font });
    } else if (action === 'set-wpm') {
      overlay.updateSettings({ wpm: payload.wpm });
    } else if (action === 'set-font-size') {
      overlay.updateSettings({ fontSize: payload.fontSize });
    } else {
      console.warn('[SpeedReader] Unknown dispatch action:', action);
    }
```

- [ ] **Step 2: Add `fontSize` to query state response**

In the `speedreader-test-query` handler, add after the `result.font` line:

```javascript
      result.fontSize = overlay.settings.fontSize || 42;
```

- [ ] **Step 3: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/content.js
git commit -m "Add set-font-size test dispatch and fontSize to query state

Enables regression tests to set and verify font size in the overlay."
```

---

### Task 9: Update regression tests for new fonts

**Files:**
- Modify: `tests/regression/08-font.test.js`

- [ ] **Step 1: Add regression tests for new font cases**

Replace `tests/regression/08-font.test.js` with:

```javascript
// tests/regression/08-font.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestPage, ensureOverlayOpen, queryState, dispatch, waitFor } from './helpers.js';

describe('Font Switching', () => {
  before(async () => {
    await setupTestPage();
    await ensureOverlayOpen();
  });

  it('set-font opendyslexic applies data-font attribute', async () => {
    dispatch('set-font', { font: 'opendyslexic' });
    await waitFor(async () => (await queryState()).font === 'opendyslexic', { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.font, 'opendyslexic');
  });

  it('set-font system removes data-font attribute', async () => {
    dispatch('set-font', { font: 'system' });
    await waitFor(async () => (await queryState()).font === 'default', { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.font, 'default');
  });

  it('set-font newYork applies data-font attribute', async () => {
    dispatch('set-font', { font: 'newYork' });
    await waitFor(async () => (await queryState()).font === 'newYork', { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.font, 'newYork');
  });

  it('set-font georgia applies data-font attribute', async () => {
    dispatch('set-font', { font: 'georgia' });
    await waitFor(async () => (await queryState()).font === 'georgia', { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.font, 'georgia');
  });

  it('set-font menlo applies data-font attribute', async () => {
    dispatch('set-font', { font: 'menlo' });
    await waitFor(async () => (await queryState()).font === 'menlo', { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.font, 'menlo');
  });

  it('set-font-size updates overlay font size', async () => {
    dispatch('set-font-size', { fontSize: 60 });
    await waitFor(async () => (await queryState()).fontSize === 60, { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.fontSize, 60);
  });

  it('set-font back to system after testing all fonts', async () => {
    dispatch('set-font', { font: 'system' });
    await waitFor(async () => (await queryState()).font === 'default', { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.font, 'default');
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/regression/08-font.test.js
git commit -m "Add regression tests for New York, Georgia, Menlo fonts and font size

Tests each new font applies the correct data-font attribute and
verifies font size dispatch updates the overlay."
```

---

### Task 10: Add companion app font preview for new fonts

**Files:**
- Modify: `SpeedReader/SpeedReader/Views/SettingsView.swift:4-10` (`ReaderFont.font(size:)` extension)

- [ ] **Step 1: Update `ReaderFont.font(size:)` for new cases**

In `SpeedReader/SpeedReader/Views/SettingsView.swift`, replace the `ReaderFont` font extension:

```swift
/// Returns a SwiftUI Font for a given ReaderFont at the specified size.
extension ReaderFont {
    func font(size: CGFloat) -> Font {
        switch self {
        case .system: return .system(size: size, weight: .regular)
        case .openDyslexic: return .custom("OpenDyslexic", size: size)
        case .newYork: return .custom("New York", size: size)
        case .georgia: return .custom("Georgia", size: size)
        case .menlo: return .custom("Menlo", size: size)
        }
    }
}
```

- [ ] **Step 2: Verify in companion app**

Build and run the macOS app. Open Settings. Verify:
- Font picker shows all 5 options with category labels
- RSVPPreview renders correctly for each font selection
- Font size slider range is 24–96
- Slider bound labels show 24 and 96

- [ ] **Step 3: Commit**

```bash
git add SpeedReader/SpeedReader/Views/SettingsView.swift
git commit -m "Add SwiftUI font rendering for New York, Georgia, and Menlo

RSVPPreview in companion app now renders all 5 fonts correctly.
Font size slider range automatically reflects widened 24-96 bounds."
```

---

### Task 11: Run full test suite and verify

**Files:** None — verification only.

- [ ] **Step 1: Run Swift tests**

Run: `xcodebuild test -project SpeedReader/SpeedReader.xcodeproj -scheme SpeedReader -destination 'platform=macOS' -quiet 2>&1 | tail -20`

Expected: All tests pass.

- [ ] **Step 2: Run JS unit tests**

Run: `node --test tests/js/*.test.js`

Expected: All tests pass.

- [ ] **Step 3: Visual verification checklist**

Open the extension and verify:
- [ ] All 5 fonts render correctly in overlay
- [ ] ORP focus point (colored letter) is visible for every font
- [ ] A−/A+ stepper works: size updates live, label updates, clamps at bounds
- [ ] Large font sizes (80px+) don't overflow the card
- [ ] Stepper buttons are larger on mobile viewport
- [ ] Companion app font picker shows all 5 options
- [ ] Companion app font size slider goes 24–96
- [ ] RSVPPreview updates when font or size changes
- [ ] Settings persist: change font in app → reopen overlay → correct font shows
