# ORP-Aligned Word Positioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ORP-aligned word positioning as a user preference (default), where the focus letter stays fixed at the horizontal center of the word area.

**Architecture:** CSS grid (`1fr / auto / 1fr`) positions the three word spans so the focus letter is always centered. A new `alignment` setting flows through the existing settings pipeline (Swift + JS). The ▼ focus marker is removed — the accent-colored letter is the sole indicator.

**Tech Stack:** Swift (SwiftUI, UserDefaults), JavaScript (ES2020, Shadow DOM), CSS Grid, Node.js test runner, XCTest

---

### Task 1: Add alignment to JS settings constants

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/settings-defaults.js`
- Modify: `tests/js/settings-defaults.test.js`

- [ ] **Step 1: Write the failing test**

Add to `tests/js/settings-defaults.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampFontSize, FONT_SIZE_DEFAULT, FONT_SIZE_MIN, FONT_SIZE_MAX,
  SETTINGS_KEYS, SETTINGS_DEFAULTS,
} from '../../SpeedReader/SpeedReaderExtension/Resources/rsvp/settings-defaults.js';

// ... existing clampFontSize tests ...

describe('SETTINGS_KEYS', () => {
  it('includes alignment', () => {
    assert.ok(SETTINGS_KEYS.includes('alignment'));
  });
});

describe('SETTINGS_DEFAULTS', () => {
  it('defaults alignment to orp', () => {
    assert.strictEqual(SETTINGS_DEFAULTS.alignment, 'orp');
  });
});
```

Update the existing import at the top of the file to include `SETTINGS_KEYS` and `SETTINGS_DEFAULTS`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/js/settings-defaults.test.js`
Expected: FAIL — `SETTINGS_KEYS` does not include `'alignment'`, `SETTINGS_DEFAULTS.alignment` is `undefined`

- [ ] **Step 3: Add alignment to settings-defaults.js**

In `SpeedReader/SpeedReaderExtension/Resources/rsvp/settings-defaults.js`, add `'alignment'` to the `SETTINGS_KEYS` array and `alignment: 'orp'` to `SETTINGS_DEFAULTS`:

```js
export const SETTINGS_KEYS = ['wpm', 'font', 'theme', 'fontSize', 'punctuationPause', 'alignment'];

export const SETTINGS_DEFAULTS = {
  wpm: WPM_DEFAULT,
  font: 'system',
  theme: 'system',
  fontSize: FONT_SIZE_DEFAULT,
  punctuationPause: true,
  alignment: 'orp',
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/js/settings-defaults.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/settings-defaults.js tests/js/settings-defaults.test.js
git commit -m "Add alignment setting to JS settings defaults (#13)"
```

---

### Task 2: Add alignment to Swift settings

**Files:**
- Modify: `SpeedReader/Shared/SettingsKeys.swift`
- Modify: `SpeedReader/SpeedReader/Models/Settings.swift`
- Modify: `SpeedReader/SpeedReaderTests/SettingsTests.swift`

- [ ] **Step 1: Write failing Swift tests**

Add to `SpeedReader/SpeedReaderTests/SettingsTests.swift`:

```swift
// MARK: - Alignment

func testDefaultAlignment() {
    let settings = makeSettings()
    XCTAssertEqual(settings.alignment, .orpAligned)
}

func testAlignmentRoundTrips() {
    let store = makeDefaults()
    let settings = ReaderSettings(defaults: store)
    settings.setAlignment(.center)
    let reloaded = ReaderSettings(defaults: store)
    XCTAssertEqual(reloaded.alignment, .center)
}

func testInitFallsBackForInvalidAlignmentRawValue() {
    let store = makeDefaults()
    store.set("scrambled", forKey: SettingsKeys.alignment)
    let settings = ReaderSettings(defaults: store)
    XCTAssertEqual(settings.alignment, SettingsKeys.Defaults.alignment)
}

func testSaveSettingsAcceptsValidAlignmentValues() {
    let store = makeDefaults()
    for rawValue in ["orp", "center"] {
        let count = SettingsKeys.saveSettings(["alignment": rawValue], to: store)
        XCTAssertEqual(count, 1, "Expected '\(rawValue)' to be accepted")
        XCTAssertEqual(store.string(forKey: SettingsKeys.alignment), rawValue)
    }
}

func testSaveSettingsRejectsInvalidAlignmentRawValue() {
    let store = makeDefaults()
    let count = SettingsKeys.saveSettings(["alignment": "scrambled"], to: store)
    XCTAssertEqual(count, 0)
}
```

Also update `testSaveSettingsWithValidPayloadSavesAllFields` to include alignment in the payload and bump the expected count from 5 to 6:

```swift
func testSaveSettingsWithValidPayloadSavesAllFields() {
    let store = makeDefaults()
    let payload: [String: Any] = [
        "wpm": 300,
        "font": "opendyslexic",
        "theme": "dark",
        "fontSize": 36,
        "punctuationPause": false,
        "alignment": "center",
    ]
    let count = SettingsKeys.saveSettings(payload, to: store)
    XCTAssertEqual(count, 6)
    XCTAssertEqual(store.integer(forKey: SettingsKeys.wpm), 300)
    XCTAssertEqual(store.string(forKey: SettingsKeys.font), "opendyslexic")
    XCTAssertEqual(store.string(forKey: SettingsKeys.theme), "dark")
    XCTAssertEqual(store.integer(forKey: SettingsKeys.fontSize), 36)
    XCTAssertFalse(store.bool(forKey: SettingsKeys.punctuationPause))
    XCTAssertEqual(store.string(forKey: SettingsKeys.alignment), "center")
}
```

Update `testSettingsPersistAcrossInstances` to include alignment:

```swift
func testSettingsPersistAcrossInstances() {
    let store = makeDefaults()
    let first = ReaderSettings(defaults: store)
    first.setWpm(400)
    first.setFont(.openDyslexic)
    first.setTheme(.dark)
    first.setFontSize(36)
    first.setPunctuationPause(false)
    first.setAlignment(.center)

    let second = ReaderSettings(defaults: store)
    XCTAssertEqual(second.wpm, 400)
    XCTAssertEqual(second.font, .openDyslexic)
    XCTAssertEqual(second.theme, .dark)
    XCTAssertEqual(second.fontSize, 36)
    XCTAssertFalse(second.punctuationPause)
    XCTAssertEqual(second.alignment, .center)
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `make test-swift`
Expected: Compilation errors — `ReaderAlignment` type, `alignment` property, `setAlignment()` method don't exist yet

- [ ] **Step 3: Add ReaderAlignment enum to SettingsKeys.swift**

Add after the `ReaderTheme` enum in `SpeedReader/Shared/SettingsKeys.swift`:

```swift
/// Alignment options for the RSVP word display.
enum ReaderAlignment: String, CaseIterable, Identifiable {
    case orpAligned = "orp"
    case center = "center"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .orpAligned: return "Focus Lock (ORP)"
        case .center: return "Centered"
        }
    }
}
```

Add the key and default inside `SettingsKeys`:

```swift
static let alignment = "sr_alignment"
```

Inside `Defaults`:

```swift
static let alignment: ReaderAlignment = .orpAligned
```

Add alignment handling to `saveSettings(_:to:)`, after the `punctuationPause` block:

```swift
if let alignment = settings["alignment"] as? String,
   ReaderAlignment(rawValue: alignment) != nil {
    defaults.set(alignment, forKey: SettingsKeys.alignment)
    savedCount += 1
}
```

- [ ] **Step 4: Add alignment property to Settings.swift**

In `SpeedReader/SpeedReader/Models/Settings.swift`, add the property:

```swift
var alignment: ReaderAlignment = SettingsKeys.Defaults.alignment
```

Add the setter method:

```swift
/// Sets alignment and persists to UserDefaults.
func setAlignment(_ value: ReaderAlignment) {
    alignment = value
    defaults.set(alignment.rawValue, forKey: SettingsKeys.alignment)
}
```

Add to `loadFromDefaults(_:)`, after the `punctuationPause` loading:

```swift
let alignmentRaw = store.string(forKey: SettingsKeys.alignment)
    ?? SettingsKeys.Defaults.alignment.rawValue
alignment = ReaderAlignment(rawValue: alignmentRaw) ?? SettingsKeys.Defaults.alignment
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `make test-swift`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```
git add SpeedReader/Shared/SettingsKeys.swift SpeedReader/SpeedReader/Models/Settings.swift SpeedReader/SpeedReaderTests/SettingsTests.swift
git commit -m "Add ReaderAlignment enum and alignment setting to Swift layer (#13)"
```

---

### Task 3: Remove focus marker and add ORP grid CSS

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.css`
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js`

- [ ] **Step 1: Remove focus marker from overlay.js _createDOM()**

In `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js`, remove these lines from `_createDOM()`:

Remove (lines 382-384):
```js
    const focusMarker = document.createElement('div');
    focusMarker.className = 'sr-focus-marker';
    focusMarker.textContent = '▼';
```

Replace (line 406):
```js
    wordArea.appendChild(focusMarker);
    wordArea.appendChild(wordContainer);
```
with:
```js
    wordArea.appendChild(wordContainer);
```

- [ ] **Step 2: Add data-alignment attribute syncing to overlay.js**

In the constructor, add `alignment` to the default settings object (after `fontSize`):

```js
this.settings = {
  theme: 'system',
  font: 'system',
  fontSize: FONT_SIZE_DEFAULT,
  alignment: 'orp',
};
```

In `_createDOM()`, after the `this._syncHostAttr('data-font', ...)` line, add:

```js
    // Alignment defaults to 'orp' — always set the attribute so CSS grid activates.
    this.host.setAttribute('data-alignment', this.settings.alignment || 'orp');
```

In `updateSettings()`, after the `this._syncHostAttr('data-font', settings.font);` line, add:

```js
    if (settings.alignment !== undefined) {
      this.host.setAttribute('data-alignment', settings.alignment);
    }
```

- [ ] **Step 3: Update overlay.css — remove marker, adjust height, add grid rules**

In `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.css`:

**a) Remove `.sr-focus-marker` rule** (lines 143-147):
```css
.sr-focus-marker {
  color: var(--sr-accent);
  font-size: 10px;
  margin-bottom: 4px;
}
```

**b) Reduce word area height** — change `--sr-word-area-height: 194px` to `176px` in `:host` (line 28).

**c) Update the comment** above `--sr-word-area-height` (lines 25-27) to:
```css
  /* Fixed height to prevent layout shift during RSVP playback.
     Sized to fit max font (96px * 1.6 line-height + padding).
     Mobile override in @media (max-width: 480px) below. */
```

**d) Reduce mobile height** — change `--sr-word-area-height: 120px` to `102px` in the `@media (max-width: 480px)` block (line 394).

**e) Add ORP grid rules** after the `.sr-word-focus` rule (after line 166):

```css
/* ORP-aligned: focus letter locked at horizontal center via CSS grid. */
:host([data-alignment="orp"]) .sr-word {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
}

:host([data-alignment="orp"]) .sr-word-before {
  text-align: right;
}

:host([data-alignment="orp"]) .sr-word-after {
  text-align: left;
}
```

- [ ] **Step 4: Run JS tests to check nothing broke**

Run: `node --test tests/js/*.test.js`
Expected: All tests PASS (no JS logic changed, just DOM and CSS)

- [ ] **Step 5: Commit**

```
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.css
git commit -m "Remove focus marker and add ORP-aligned CSS grid layout (#13)"
```

---

### Task 4: Add alignment picker to SettingsView

**Files:**
- Modify: `SpeedReader/SpeedReader/Views/SettingsView.swift`

- [ ] **Step 1: Update RSVPPreview to accept alignment**

In `SpeedReader/SpeedReader/Views/SettingsView.swift`, add `alignment` parameter to `RSVPPreview`:

```swift
private struct RSVPPreview: View {
    let font: ReaderFont
    let fontSize: Int
    let theme: ReaderTheme
    let alignment: ReaderAlignment

    // ... existing word, focusIndex, before, focus, after, backgroundColor, textColor ...

    var body: some View {
        Group {
            if alignment == .orpAligned {
                HStack(spacing: 0) {
                    Text(before)
                        .foregroundColor(textColor)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                    Text(focus)
                        .foregroundColor(orpAccentColor)
                    Text(after)
                        .foregroundColor(textColor)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .font(font.font(size: CGFloat(fontSize)))
            } else {
                HStack(spacing: 0) {
                    Spacer()
                    (Text(before).foregroundColor(textColor)
                    + Text(focus).foregroundColor(orpAccentColor)
                    + Text(after).foregroundColor(textColor))
                        .font(font.font(size: CGFloat(fontSize)))
                    Spacer()
                }
            }
        }
        .padding(.vertical, 24)
        .background(backgroundColor)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
```

- [ ] **Step 2: Update RSVPPreview call site**

In `SettingsView.body`, update the `RSVPPreview` instantiation (inside `Section("Appearance")`):

```swift
RSVPPreview(font: settings.font, fontSize: settings.fontSize, theme: settings.theme, alignment: settings.alignment)
```

- [ ] **Step 3: Add alignment Picker**

In `SettingsView.body`, add the alignment picker inside `Section("Appearance")`, after the Theme picker:

```swift
Picker("Word Alignment", selection: Binding(
    get: { settings.alignment },
    set: { settings.setAlignment($0) }
)) {
    ForEach(ReaderAlignment.allCases) { alignment in
        Text(alignment.displayName).tag(alignment)
    }
}
```

- [ ] **Step 4: Build to verify compilation**

Run: `make test-swift`
Expected: All tests PASS (compilation succeeds, existing tests still pass)

- [ ] **Step 5: Commit**

```
git add SpeedReader/SpeedReader/Views/SettingsView.swift
git commit -m "Add alignment picker and ORP-aware preview to SettingsView (#13)"
```

---

### Task 5: Verify end-to-end and run full test suite

**Files:** None (verification only)

- [ ] **Step 1: Run full JS test suite**

Run: `make test-js`
Expected: All tests PASS

- [ ] **Step 2: Run full Swift test suite**

Run: `make test-swift`
Expected: All tests PASS

- [ ] **Step 3: Run full CI suite**

Run: `make ci`
Expected: All lints and tests PASS

- [ ] **Step 4: Final commit (if any lint fixes needed)**

Only if lint fixes are required — commit them with:
```
git commit -m "Fix lint issues from ORP alignment changes (#13)"
```
