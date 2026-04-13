# Paper Backgrounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current `ReaderTheme` setting (`system | light | dark`) with a new `ReaderPaper` setting (`white | cream | slate | black`), with Cream as the new default, a one-shot migration for existing users, and per-paper CSS styling.

**Architecture:** Semantic rename + behavior change, not a parallel setting. The entire theme concept is removed in favor of paper. Settings traverse the existing pipeline (SwiftUI → `ReaderSettings` → App Group UserDefaults → extension background.js → content.js → overlay.js → `:host([data-paper=...])` → CSS custom properties) — only the shape of one field changes. Migration runs once inside `ReaderSettings.init()`, idempotent via `sr_migratedToPaper` flag. Tasks are ordered so old (`theme`) and new (`paper`) code briefly coexist, then `theme` is removed once all consumers have been swapped.

**Tech Stack:** Swift 5 / SwiftUI (iOS 26+, macOS 26+), JavaScript ES2020+ (Safari Web Extension, Shadow DOM), CSS custom properties. Tests: XCTest (Swift), `node:test` runner invoked via Bun (JS), Safari driver regression harness in `tests/regression/`.

**Spec reference:** [docs/superpowers/specs/2026-04-13-paper-backgrounds-design.md](../superpowers/specs/2026-04-13-paper-backgrounds-design.md)

---

## File Structure

| Path | Role | Change |
|---|---|---|
| [SpeedReader/Shared/SettingsKeys.swift](../../SpeedReader/Shared/SettingsKeys.swift) | Shared constants, types, validators, migration | Add `ReaderPaper`, `paper`/`migratedToPaper` keys, `Defaults.paper`, paper validation in `saveSettings`, `migrateThemeToPaper()` function. Delete `ReaderTheme`, `theme` key, `Defaults.theme`, theme validation. |
| [SpeedReader/SpeedReader/Models/Settings.swift](../../SpeedReader/SpeedReader/Models/Settings.swift) | `@Observable` settings model | Replace `theme`/`setTheme`/theme-load with `paper`/`setPaper`/paper-load. Run migration at start of `init()`. |
| [SpeedReader/SpeedReader/Views/SettingsView.swift](../../SpeedReader/SpeedReader/Views/SettingsView.swift) | Settings UI + `RSVPPreview` | Replace Theme Picker with Paper Picker. Add `ReaderPaper.previewColors` extension. Update `RSVPPreview` to compute background/text from paper. |
| [SpeedReader/SpeedReaderTests/SettingsTests.swift](../../SpeedReader/SpeedReaderTests/SettingsTests.swift) | Swift unit tests | Add paper tests (default, round-trip, save, migration). Remove theme-specific tests that no longer apply. |
| [SpeedReader/SpeedReaderExtension/Resources/rsvp/settings-defaults.js](../../SpeedReader/SpeedReaderExtension/Resources/rsvp/settings-defaults.js) | JS constants, validators | Add `VALID_PAPERS`, `PAPER_DEFAULT`, `validatePaper`. Replace `'theme'` with `'paper'` in `SETTINGS_KEYS` / `SETTINGS_DEFAULTS`. Remove theme references. |
| [SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js](../../SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js) | Shadow DOM overlay | Replace `theme`/`data-theme` with `paper`/`data-paper`. Bypass `_syncHostAttr` for paper (no 'system' state — matches alignment pattern). |
| [SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.css](../../SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.css) | Shadow DOM styles | Delete `@media (prefers-color-scheme: dark)` color block, `:host([data-theme="dark"])` block, and their `.sr-context-highlight` duplicates. Add 4 `:host([data-paper=...])` blocks + new `--sr-context-highlight` custom property. |
| [SpeedReader/SpeedReaderExtension/Resources/background.js](../../SpeedReader/SpeedReaderExtension/Resources/background.js) | Message routing between native and extension | Replace `'theme'` with `'paper'` in allowed-key lists and defaults. |
| [SpeedReader/SpeedReaderExtension/Resources/content.js](../../SpeedReader/SpeedReaderExtension/Resources/content.js) | Page content script | Replace `theme`/`set-theme`/`data-theme` with `paper`/`set-paper`/`data-paper`. |
| [tests/js/settings-defaults.test.js](../../tests/js/settings-defaults.test.js) | JS unit tests | Add `validatePaper` test block. Update `SETTINGS_KEYS`/`SETTINGS_DEFAULTS` expectations. |
| [tests/regression/07-theme.test.js](../../tests/regression/07-theme.test.js) | Safari driver regression | Rewrite as paper test — `set-paper` action, `data-paper` assertions. Rename file to `07-paper.test.js`. |

---

## Task order rationale

Phases A–C add new APIs without removing old ones, so the project compiles and tests pass throughout. Phase D rewrites consumers to the new API. Phase E removes the old API. Phase F handles CSS. Phase G is regression tests. Phase H is manual verification.

Each task ends with a commit. Commit messages use the conventional `feat:` / `test:` / `refactor:` / `chore:` prefixes seen in recent history.

---

## Phase A — Add Swift `ReaderPaper` type (coexists with `ReaderTheme`)

### Task 1: ReaderPaper enum + SettingsKeys additions

**Files:**
- Modify: `SpeedReader/Shared/SettingsKeys.swift`
- Test: `SpeedReader/SpeedReaderTests/SettingsTests.swift`

- [ ] **Step 1: Write failing tests**

Add these test methods to the existing `SettingsTests` class in `SpeedReader/SpeedReaderTests/SettingsTests.swift`, after the "Alignment" section:

```swift
    // MARK: - Paper

    func testReaderPaperRawValues() {
        XCTAssertEqual(ReaderPaper.white.rawValue, "white")
        XCTAssertEqual(ReaderPaper.cream.rawValue, "cream")
        XCTAssertEqual(ReaderPaper.slate.rawValue, "slate")
        XCTAssertEqual(ReaderPaper.black.rawValue, "black")
    }

    func testReaderPaperAllCasesCount() {
        XCTAssertEqual(ReaderPaper.allCases.count, 4)
    }

    func testReaderPaperDisplayNames() {
        XCTAssertEqual(ReaderPaper.white.displayName, "White")
        XCTAssertEqual(ReaderPaper.cream.displayName, "Cream")
        XCTAssertEqual(ReaderPaper.slate.displayName, "Slate")
        XCTAssertEqual(ReaderPaper.black.displayName, "Black")
    }

    func testPaperDefaultIsCream() {
        XCTAssertEqual(SettingsKeys.Defaults.paper, .cream)
    }

    func testPaperKeyIsNamespaced() {
        XCTAssertEqual(SettingsKeys.paper, "sr_paper")
        XCTAssertEqual(SettingsKeys.migratedToPaper, "sr_migratedToPaper")
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `make test-swift` (or in Xcode: ⌘U filtered to `SettingsTests`)
Expected: compilation errors — `ReaderPaper` undefined, `SettingsKeys.paper` undefined, `SettingsKeys.Defaults.paper` undefined.

- [ ] **Step 3: Add `ReaderPaper` enum and keys to SettingsKeys.swift**

Insert this enum immediately after the existing `ReaderAlignment` enum (around line 55, before `enum SettingsKeys`):

```swift
/// Paper (background + text palette) options for the RSVP reader.
/// Replaces the old ReaderTheme — see docs/superpowers/specs/2026-04-13-paper-backgrounds-design.md.
///
/// Keep in sync with overlay.css `:host([data-paper=...])` blocks and
/// SettingsView.swift `ReaderPaper.previewColors` extension.
enum ReaderPaper: String, CaseIterable, Identifiable {
    case white
    case cream
    case slate
    case black

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .white: return "White"
        case .cream: return "Cream"
        case .slate: return "Slate"
        case .black: return "Black"
        }
    }
}
```

Inside the existing `enum SettingsKeys` body, add these two constants immediately after the `alignment` and `chunkSize` keys (around line 72):

```swift
    static let paper = "sr_paper"
    static let migratedToPaper = "sr_migratedToPaper"
```

Inside the existing `enum Defaults` nested enum (around line 85, after `alignment` and `chunkSize`), add:

```swift
        static let paper: ReaderPaper = .cream
```

Do **not** remove `ReaderTheme`, `SettingsKeys.theme`, or `SettingsKeys.Defaults.theme` yet — Phase E handles deletion.

- [ ] **Step 4: Run tests to verify they pass**

Run: `make test-swift`
Expected: the five new tests pass. All pre-existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add SpeedReader/Shared/SettingsKeys.swift SpeedReader/SpeedReaderTests/SettingsTests.swift
git commit -m "feat: add ReaderPaper enum and sr_paper keys

First step toward paper-based backgrounds (issue #17).
ReaderTheme remains in place temporarily — removed in a later commit
once all consumers migrate.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase B — Add paper validation to `saveSettings`

### Task 2: saveSettings accepts paper field

**Files:**
- Modify: `SpeedReader/Shared/SettingsKeys.swift`
- Test: `SpeedReader/SpeedReaderTests/SettingsTests.swift`

- [ ] **Step 1: Write failing tests**

Add to `SettingsTests.swift` in the same "Paper" section:

```swift
    func testSaveSettingsAcceptsAllValidPaperValues() {
        let store = makeDefaults()
        for rawValue in ["white", "cream", "slate", "black"] {
            let count = SettingsKeys.saveSettings(["paper": rawValue], to: store)
            XCTAssertEqual(count, 1, "Expected '\(rawValue)' to be accepted")
            XCTAssertEqual(store.string(forKey: SettingsKeys.paper), rawValue)
        }
    }

    func testSaveSettingsRejectsInvalidPaperRawValue() {
        let store = makeDefaults()
        let count = SettingsKeys.saveSettings(["paper": "magenta"], to: store)
        XCTAssertEqual(count, 0)
    }

    func testSaveSettingsRejectsPaperWithWrongType() {
        let store = makeDefaults()
        let count = SettingsKeys.saveSettings(["paper": 42], to: store)
        XCTAssertEqual(count, 0)
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `make test-swift`
Expected: the three new tests fail — `saveSettings` ignores unknown `paper` key and returns 0.

- [ ] **Step 3: Add paper validation block to `saveSettings`**

In `SettingsKeys.swift`, inside `saveSettings(_:to:)`, add this block immediately after the existing `theme` block (around line 135, before `fontSize`):

```swift
        if let paper = settings["paper"] as? String,
           ReaderPaper(rawValue: paper) != nil {
            defaults.set(paper, forKey: SettingsKeys.paper)
            savedCount += 1
        }
```

The existing `theme` block is **not** removed yet — both keys are temporarily valid.

- [ ] **Step 4: Run tests to verify they pass**

Run: `make test-swift`
Expected: the three new tests pass. All other tests still pass.

- [ ] **Step 5: Commit**

```bash
git add SpeedReader/Shared/SettingsKeys.swift SpeedReader/SpeedReaderTests/SettingsTests.swift
git commit -m "feat: saveSettings accepts paper field

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase C — Migration function

### Task 3: migrateThemeToPaper function

**Files:**
- Modify: `SpeedReader/Shared/SettingsKeys.swift`
- Test: `SpeedReader/SpeedReaderTests/SettingsTests.swift`

- [ ] **Step 1: Write failing tests**

Add to `SettingsTests.swift` in a new "Migration" section at the end of the class:

```swift
    // MARK: - Migration from theme to paper

    func testMigrationMapsLightToWhite() {
        let store = makeDefaults()
        store.set("light", forKey: "sr_theme")
        SettingsKeys.migrateThemeToPaper(in: store)
        XCTAssertEqual(store.string(forKey: SettingsKeys.paper), "white")
    }

    func testMigrationMapsDarkToSlate() {
        let store = makeDefaults()
        store.set("dark", forKey: "sr_theme")
        SettingsKeys.migrateThemeToPaper(in: store)
        XCTAssertEqual(store.string(forKey: SettingsKeys.paper), "slate")
    }

    func testMigrationMapsSystemToCream() {
        let store = makeDefaults()
        store.set("system", forKey: "sr_theme")
        SettingsKeys.migrateThemeToPaper(in: store)
        XCTAssertEqual(store.string(forKey: SettingsKeys.paper), "cream")
    }

    func testMigrationMapsMissingThemeToCream() {
        let store = makeDefaults()
        // No sr_theme key set
        SettingsKeys.migrateThemeToPaper(in: store)
        XCTAssertEqual(store.string(forKey: SettingsKeys.paper), "cream")
    }

    func testMigrationMapsUnknownThemeToCream() {
        let store = makeDefaults()
        store.set("neon-pink", forKey: "sr_theme")
        SettingsKeys.migrateThemeToPaper(in: store)
        XCTAssertEqual(store.string(forKey: SettingsKeys.paper), "cream")
    }

    func testMigrationSetsMigratedFlag() {
        let store = makeDefaults()
        store.set("light", forKey: "sr_theme")
        SettingsKeys.migrateThemeToPaper(in: store)
        XCTAssertTrue(store.bool(forKey: SettingsKeys.migratedToPaper))
    }

    func testMigrationDeletesOldThemeKey() {
        let store = makeDefaults()
        store.set("dark", forKey: "sr_theme")
        SettingsKeys.migrateThemeToPaper(in: store)
        XCTAssertNil(store.object(forKey: "sr_theme"))
    }

    func testMigrationIsIdempotent() {
        let store = makeDefaults()
        store.set("dark", forKey: "sr_theme")
        SettingsKeys.migrateThemeToPaper(in: store)
        // Second run: user has since changed paper to "white" explicitly
        store.set("white", forKey: SettingsKeys.paper)
        SettingsKeys.migrateThemeToPaper(in: store)
        // Expect user's explicit choice preserved, not reset to "slate"
        XCTAssertEqual(store.string(forKey: SettingsKeys.paper), "white")
    }

    func testMigrationSkipsIfAlreadyMigrated() {
        let store = makeDefaults()
        store.set(true, forKey: SettingsKeys.migratedToPaper)
        store.set("dark", forKey: "sr_theme")  // Should be ignored
        SettingsKeys.migrateThemeToPaper(in: store)
        XCTAssertNil(store.string(forKey: SettingsKeys.paper))
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `make test-swift`
Expected: the nine new tests fail — `migrateThemeToPaper` is undefined.

- [ ] **Step 3: Add `migrateThemeToPaper` to SettingsKeys**

Add this static function to the `enum SettingsKeys` in `SettingsKeys.swift`, immediately after the `clamp` function (around line 115):

```swift
    /// One-shot migration from legacy `sr_theme` to `sr_paper`.
    ///
    /// Mapping (see spec 2026-04-13-paper-backgrounds-design.md):
    /// - `light`   → `white`  (preserve explicit choice)
    /// - `dark`    → `slate`  (preserve explicit choice)
    /// - `system`  → `cream`  (upgrade implicit choice to new accessible default)
    /// - missing / unknown → `cream`
    ///
    /// Idempotent — keyed off `sr_migratedToPaper`. Deletes `sr_theme` after
    /// successful migration to prevent stale reads.
    static func migrateThemeToPaper(in defaults: UserDefaults) {
        if defaults.bool(forKey: migratedToPaper) {
            return
        }

        let legacyKey = "sr_theme"
        let legacyValue = defaults.string(forKey: legacyKey)
        let mapped: ReaderPaper
        switch legacyValue {
        case "light":  mapped = .white
        case "dark":   mapped = .slate
        case "system": mapped = .cream
        default:       mapped = .cream
        }

        defaults.set(mapped.rawValue, forKey: paper)
        defaults.set(true, forKey: migratedToPaper)
        defaults.removeObject(forKey: legacyKey)
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `make test-swift`
Expected: all nine new migration tests pass.

- [ ] **Step 5: Commit**

```bash
git add SpeedReader/Shared/SettingsKeys.swift SpeedReader/SpeedReaderTests/SettingsTests.swift
git commit -m "feat: add one-shot migration from sr_theme to sr_paper

Idempotent, keyed off sr_migratedToPaper. Preserves explicit light/dark
choices; routes 'system' (implicit) to cream, the new accessible default.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase D — Rewrite consumers to use paper

### Task 4: ReaderSettings uses paper, runs migration on init

**Files:**
- Modify: `SpeedReader/SpeedReader/Models/Settings.swift`
- Test: `SpeedReader/SpeedReaderTests/SettingsTests.swift`

- [ ] **Step 1: Write failing tests**

Add to `SettingsTests.swift` in the "Paper" section:

```swift
    func testDefaultPaperIsCream() {
        let settings = makeSettings()
        XCTAssertEqual(settings.paper, .cream)
    }

    func testSetPaperPersists() {
        let store = makeDefaults()
        let first = ReaderSettings(defaults: store)
        first.setPaper(.slate)
        let second = ReaderSettings(defaults: store)
        XCTAssertEqual(second.paper, .slate)
    }

    func testInitFallsBackForInvalidPaperRawValue() {
        let store = makeDefaults()
        store.set(true, forKey: SettingsKeys.migratedToPaper)  // skip migration
        store.set("magenta", forKey: SettingsKeys.paper)
        let settings = ReaderSettings(defaults: store)
        XCTAssertEqual(settings.paper, SettingsKeys.Defaults.paper)
    }

    func testInitRunsMigrationFromLegacyTheme() {
        let store = makeDefaults()
        store.set("dark", forKey: "sr_theme")
        // No sr_migratedToPaper flag — migration should run
        let settings = ReaderSettings(defaults: store)
        XCTAssertEqual(settings.paper, .slate)
        XCTAssertNil(store.object(forKey: "sr_theme"))
    }

    func testInitSkipsMigrationWhenAlreadyMigrated() {
        let store = makeDefaults()
        store.set(true, forKey: SettingsKeys.migratedToPaper)
        store.set("white", forKey: SettingsKeys.paper)
        store.set("dark", forKey: "sr_theme")  // Should be ignored
        let settings = ReaderSettings(defaults: store)
        XCTAssertEqual(settings.paper, .white)
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `make test-swift`
Expected: the five new tests fail — `ReaderSettings` has no `paper` property, no `setPaper` method, and doesn't run migration.

- [ ] **Step 3: Rewrite ReaderSettings theme handling as paper**

Replace lines 15–18 of `SpeedReader/SpeedReader/Models/Settings.swift`:

```swift
    var wpm: Int = SettingsKeys.Defaults.wpm
    var font: ReaderFont = SettingsKeys.Defaults.font
    var theme: ReaderTheme = SettingsKeys.Defaults.theme
    var fontSize: Int = SettingsKeys.Defaults.fontSize
```

with:

```swift
    var wpm: Int = SettingsKeys.Defaults.wpm
    var font: ReaderFont = SettingsKeys.Defaults.font
    var paper: ReaderPaper = SettingsKeys.Defaults.paper
    var fontSize: Int = SettingsKeys.Defaults.fontSize
```

In `init(defaults:)`, immediately after the `self.defaults = store` line (around line 39) and **before** the existing `loadFromDefaults(store)` call, add:

```swift
        SettingsKeys.migrateThemeToPaper(in: store)
```

Replace the existing `setTheme` method (lines 63–67):

```swift
    /// Sets theme and persists to UserDefaults.
    func setTheme(_ value: ReaderTheme) {
        theme = value
        defaults.set(theme.rawValue, forKey: SettingsKeys.theme)
    }
```

with:

```swift
    /// Sets paper and persists to UserDefaults.
    func setPaper(_ value: ReaderPaper) {
        paper = value
        defaults.set(paper.rawValue, forKey: SettingsKeys.paper)
    }
```

Replace lines 96–98 inside `loadFromDefaults(_:)`:

```swift
        let themeRaw = store.string(forKey: SettingsKeys.theme)
            ?? SettingsKeys.Defaults.theme.rawValue
        theme = ReaderTheme(rawValue: themeRaw) ?? SettingsKeys.Defaults.theme
```

with:

```swift
        let paperRaw = store.string(forKey: SettingsKeys.paper)
            ?? SettingsKeys.Defaults.paper.rawValue
        paper = ReaderPaper(rawValue: paperRaw) ?? SettingsKeys.Defaults.paper
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `make test-swift`
Expected: the five new paper tests pass. Pre-existing tests that reference `settings.theme` / `settings.setTheme` / `testDefaultTheme` / `testInitFallsBackForInvalidThemeRawValue` / `testSettingsPersistAcrossInstances` (theme-related assertions) **will now fail to compile** — that is expected and fixed in Step 5.

- [ ] **Step 5: Rewrite failing theme tests as paper tests in SettingsTests.swift**

Replace `testDefaultTheme`:

```swift
    func testDefaultTheme() {
        let settings = makeSettings()
        XCTAssertEqual(settings.theme, .system)
    }
```

— delete it entirely. It's replaced by `testDefaultPaperIsCream` added in Step 1.

Replace `testInitFallsBackForInvalidThemeRawValue`:

```swift
    func testInitFallsBackForInvalidThemeRawValue() {
        let store = makeDefaults()
        store.set("neon-pink", forKey: SettingsKeys.theme)
        let settings = ReaderSettings(defaults: store)
        XCTAssertEqual(settings.theme, SettingsKeys.Defaults.theme)
    }
```

— delete it. Covered by `testInitFallsBackForInvalidPaperRawValue`.

In `testSettingsPersistAcrossInstances`, replace:

```swift
        first.setTheme(.dark)
```

with:

```swift
        first.setPaper(.slate)
```

and replace:

```swift
        XCTAssertEqual(second.theme, .dark)
```

with:

```swift
        XCTAssertEqual(second.paper, .slate)
```

- [ ] **Step 6: Run tests again**

Run: `make test-swift`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add SpeedReader/SpeedReader/Models/Settings.swift SpeedReader/SpeedReaderTests/SettingsTests.swift
git commit -m "refactor: ReaderSettings uses paper, runs migration on init

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: SettingsView Picker + RSVPPreview + previewColors extension

**Files:**
- Modify: `SpeedReader/SpeedReader/Views/SettingsView.swift`

No unit tests for SwiftUI — verify with a build + manual check in Phase H.

- [ ] **Step 1: Add `previewColors` extension**

Insert this extension immediately after the existing `ReaderFont` extension at the top of `SettingsView.swift` (around line 15, before the `SliderBoundLabel` struct):

```swift
extension ReaderPaper {
    /// Background + text colors for the SwiftUI preview.
    /// MUST match overlay.css `:host([data-paper=...])` color tokens exactly.
    /// Keep in sync with CSS — there is no shared source of truth for these 4 colors.
    var previewColors: (background: Color, text: Color) {
        switch self {
        case .white:
            return (Color(red: 1.0,   green: 1.0,   blue: 1.0),
                    Color(red: 0.2,   green: 0.2,   blue: 0.2))
        case .cream:
            return (Color(red: 0.992, green: 0.965, blue: 0.890),
                    Color(red: 0.361, green: 0.290, blue: 0.165))
        case .slate:
            return (Color(red: 0.165, green: 0.165, blue: 0.165),
                    Color(red: 0.867, green: 0.867, blue: 0.867))
        case .black:
            return (Color(red: 0.0,   green: 0.0,   blue: 0.0),
                    Color(red: 0.878, green: 0.878, blue: 0.878))
        }
    }
}
```

- [ ] **Step 2: Update `RSVPPreview` to use paper**

In `SettingsView.swift`, replace lines 35–39 in the `RSVPPreview` struct:

```swift
    let font: ReaderFont
    let fontSize: Int
    let theme: ReaderTheme
    let alignment: ReaderAlignment
    let chunkSize: Int
```

with:

```swift
    let font: ReaderFont
    let fontSize: Int
    let paper: ReaderPaper
    let alignment: ReaderAlignment
    let chunkSize: Int
```

Replace the `backgroundColor` and `textColor` computed properties (lines 51–70):

```swift
    private var backgroundColor: Color {
        switch theme {
        case .dark: return Color.black
        case .light: return Color.white
        case .system:
            #if os(macOS)
            return Color(nsColor: .windowBackgroundColor)
            #else
            return Color(uiColor: .systemBackground)
            #endif
        }
    }

    private var textColor: Color {
        switch theme {
        case .dark: return Color.white
        case .light: return Color.black
        case .system: return Color.primary
        }
    }
```

with:

```swift
    private var backgroundColor: Color { paper.previewColors.background }
    private var textColor: Color { paper.previewColors.text }
```

- [ ] **Step 3: Update RSVPPreview call site**

In the `SettingsView.body` Appearance section (around line 171), replace:

```swift
                RSVPPreview(
                    font: settings.font,
                    fontSize: settings.fontSize,
                    theme: settings.theme,
                    alignment: settings.alignment,
                    chunkSize: settings.chunkSize
                )
                    .accessibilityHidden(true)
```

with:

```swift
                RSVPPreview(
                    font: settings.font,
                    fontSize: settings.fontSize,
                    paper: settings.paper,
                    alignment: settings.alignment,
                    chunkSize: settings.chunkSize
                )
                    .accessibilityHidden(true)
```

- [ ] **Step 4: Replace Theme Picker with Paper Picker**

In the same Appearance section (around line 189), replace:

```swift
                Picker("Theme", selection: Binding(
                    get: { settings.theme },
                    set: { settings.setTheme($0) }
                )) {
                    ForEach(ReaderTheme.allCases) { theme in
                        Text(theme.displayName).tag(theme)
                    }
                }
```

with:

```swift
                Picker("Paper", selection: Binding(
                    get: { settings.paper },
                    set: { settings.setPaper($0) }
                )) {
                    ForEach(ReaderPaper.allCases) { paper in
                        Text(paper.displayName).tag(paper)
                    }
                }
```

- [ ] **Step 5: Build to verify compilation**

Run: `make lint-swift && xcodebuild -project SpeedReader/SpeedReader.xcodeproj -scheme SpeedReader -destination 'platform=iOS Simulator,name=iPhone 15' build 2>&1 | tail -20`
Expected: build succeeds. `ReaderTheme` is still defined in `SettingsKeys.swift`, so no unused-type warnings yet.

- [ ] **Step 6: Commit**

```bash
git add SpeedReader/SpeedReader/Views/SettingsView.swift
git commit -m "refactor: Settings UI uses Paper picker

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase E — Remove legacy `ReaderTheme` / `sr_theme`

### Task 6: Delete ReaderTheme, sr_theme key, theme validation

**Files:**
- Modify: `SpeedReader/Shared/SettingsKeys.swift`
- Modify: `SpeedReader/SpeedReaderTests/SettingsTests.swift`

- [ ] **Step 1: Delete `ReaderTheme` enum from SettingsKeys.swift**

Delete lines 25–40 (the entire `enum ReaderTheme` definition):

```swift
/// Theme options for the RSVP reader.
enum ReaderTheme: String, CaseIterable, Identifiable {
    case system
    case light
    case dark

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .system: return "System"
        case .light: return "Light"
        case .dark: return "Dark"
        }
    }
}
```

- [ ] **Step 2: Delete `theme` key and `Defaults.theme`**

In `enum SettingsKeys`, delete the line:

```swift
    static let theme = "sr_theme"
```

In `enum Defaults`, delete the line:

```swift
        static let theme: ReaderTheme = .system
```

- [ ] **Step 3: Delete theme validation block from saveSettings**

In `saveSettings(_:to:)`, delete the entire block (lines 132–136 approximately):

```swift
        if let theme = settings["theme"] as? String,
           ReaderTheme(rawValue: theme) != nil {
            defaults.set(theme, forKey: SettingsKeys.theme)
            savedCount += 1
        }
```

- [ ] **Step 4: Delete or rewrite theme-related tests in SettingsTests.swift**

Delete these test methods (they reference removed API):
- `testSaveSettingsRejectsInvalidThemeRawValue` — covered by `testSaveSettingsRejectsInvalidPaperRawValue`

Update `testSaveSettingsWithValidPayloadSavesAllFields`: replace `"theme": "dark",` line with `"paper": "slate",`, and replace:

```swift
        XCTAssertEqual(count, 6)
        // ...
        XCTAssertEqual(store.string(forKey: SettingsKeys.theme), "dark")
```

with:

```swift
        XCTAssertEqual(count, 6)
        // ...
        XCTAssertEqual(store.string(forKey: SettingsKeys.paper), "slate")
```

Update `testSaveSettingsWithAllWrongTypesSavesZero`: replace the `"theme": true,` entry with `"paper": 42,`.

Update `testSaveSettingsWithPartialMismatchSavesOnlyValid`: replace:

```swift
            "theme": "dark",      // valid
```

with:

```swift
            "paper": "slate",     // valid
```

and replace:

```swift
        XCTAssertEqual(store.string(forKey: SettingsKeys.theme), "dark")
```

with:

```swift
        XCTAssertEqual(store.string(forKey: SettingsKeys.paper), "slate")
```

- [ ] **Step 5: Run full Swift test suite**

Run: `make test-swift`
Expected: all tests pass. No references to `ReaderTheme`, `SettingsKeys.theme`, or `setTheme` remain in the Swift codebase (confirmed by compilation).

- [ ] **Step 6: Verify no stragglers**

Run: `grep -rn "ReaderTheme\|SettingsKeys.theme\|setTheme\|sr_theme" SpeedReader/SpeedReader SpeedReader/Shared SpeedReader/SpeedReaderTests`
Expected: output is empty. If any results come back, fix them before committing.

(Note: the migration function's string literal `"sr_theme"` is intentional — the migration reads the legacy key by string, not by the removed constant, which is why the constant can be deleted safely. The grep should still show the migration's string literal — that's expected and correct.)

- [ ] **Step 7: Commit**

```bash
git add SpeedReader/Shared/SettingsKeys.swift SpeedReader/SpeedReaderTests/SettingsTests.swift
git commit -m "refactor: remove ReaderTheme enum and sr_theme key

All Swift consumers now use ReaderPaper. Migration preserves the
legacy sr_theme string literal to read old values during upgrade.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase F — JavaScript data model

### Task 7: settings-defaults.js — add paper constants and validator

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/settings-defaults.js`
- Test: `tests/js/settings-defaults.test.js`

- [ ] **Step 1: Write failing tests**

Add to `tests/js/settings-defaults.test.js`, at the end of the file:

```js
import {
  validatePaper, VALID_PAPERS, PAPER_DEFAULT,
} from '../../SpeedReader/SpeedReaderExtension/Resources/rsvp/settings-defaults.js';

describe('validatePaper', () => {
  it('returns valid paper values unchanged', () => {
    assert.strictEqual(validatePaper('white'), 'white');
    assert.strictEqual(validatePaper('cream'), 'cream');
    assert.strictEqual(validatePaper('slate'), 'slate');
    assert.strictEqual(validatePaper('black'), 'black');
  });

  it('returns default for invalid string', () => {
    assert.strictEqual(validatePaper('magenta'), PAPER_DEFAULT);
  });

  it('returns default for non-string input', () => {
    assert.strictEqual(validatePaper(42), PAPER_DEFAULT);
    assert.strictEqual(validatePaper(undefined), PAPER_DEFAULT);
    assert.strictEqual(validatePaper(null), PAPER_DEFAULT);
    assert.strictEqual(validatePaper(true), PAPER_DEFAULT);
  });

  it('returns default for empty string', () => {
    assert.strictEqual(validatePaper(''), PAPER_DEFAULT);
  });

  it('PAPER_DEFAULT is cream', () => {
    assert.strictEqual(PAPER_DEFAULT, 'cream');
  });

  it('VALID_PAPERS contains all four papers', () => {
    assert.ok(VALID_PAPERS.includes('white'));
    assert.ok(VALID_PAPERS.includes('cream'));
    assert.ok(VALID_PAPERS.includes('slate'));
    assert.ok(VALID_PAPERS.includes('black'));
    assert.strictEqual(VALID_PAPERS.length, 4);
  });
});

describe('SETTINGS_KEYS includes paper', () => {
  it('has paper in key list', () => {
    assert.ok(SETTINGS_KEYS.includes('paper'));
  });

  it('does not have theme in key list', () => {
    assert.ok(!SETTINGS_KEYS.includes('theme'));
  });
});

describe('SETTINGS_DEFAULTS.paper', () => {
  it('defaults paper to cream', () => {
    assert.strictEqual(SETTINGS_DEFAULTS.paper, 'cream');
  });

  it('does not include theme key', () => {
    assert.ok(!Object.prototype.hasOwnProperty.call(SETTINGS_DEFAULTS, 'theme'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `make test-js`
Expected: import errors — `validatePaper`, `VALID_PAPERS`, `PAPER_DEFAULT` undefined. If they import successfully (because Phase A already stubbed them), the key-list/default tests fail because `theme` is still in `SETTINGS_KEYS`.

- [ ] **Step 3: Update settings-defaults.js**

Replace the full contents of `SpeedReader/SpeedReaderExtension/Resources/rsvp/settings-defaults.js` with:

```js
// Shared settings constants — single source of truth for JS layer.
// Mirrors SettingsKeys.swift on the native side.

export const WPM_MIN = 100;
export const WPM_MAX = 600;
export const WPM_DEFAULT = 250;
export const FONT_SIZE_DEFAULT = 42;
export const FONT_SIZE_MIN = 24;
export const FONT_SIZE_MAX = 96;
export const FONT_SIZE_STEP = 2;
export const CHUNK_SIZE_DEFAULT = 1;
export const CHUNK_SIZE_MIN = 1;
export const CHUNK_SIZE_MAX = 3;
export const ALIGNMENT_DEFAULT = 'orp';
export const VALID_ALIGNMENTS = ['orp', 'center'];

export const PAPER_DEFAULT = 'cream';
export const VALID_PAPERS = ['white', 'cream', 'slate', 'black'];

export const SETTINGS_KEYS = [
  'wpm', 'font', 'paper', 'fontSize', 'punctuationPause', 'alignment', 'chunkSize',
];

export const SETTINGS_DEFAULTS = {
  wpm: WPM_DEFAULT,
  font: 'system',
  paper: PAPER_DEFAULT,
  fontSize: FONT_SIZE_DEFAULT,
  punctuationPause: true,
  alignment: ALIGNMENT_DEFAULT,
  chunkSize: CHUNK_SIZE_DEFAULT,
};

export function clampWpm(value) {
  if (typeof value !== 'number' || isNaN(value)) return WPM_DEFAULT;
  return Math.max(WPM_MIN, Math.min(WPM_MAX, value));
}

export function clampFontSize(value) {
  if (typeof value !== 'number' || isNaN(value)) return FONT_SIZE_DEFAULT;
  return Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, value));
}

export function validateAlignment(value) {
  if (typeof value === 'string' && VALID_ALIGNMENTS.includes(value)) return value;
  return ALIGNMENT_DEFAULT;
}

export function validatePaper(value) {
  if (typeof value === 'string' && VALID_PAPERS.includes(value)) return value;
  return PAPER_DEFAULT;
}

export function clampChunkSize(value) {
  if (typeof value !== 'number' || isNaN(value)) return CHUNK_SIZE_DEFAULT;
  return Math.max(CHUNK_SIZE_MIN, Math.min(CHUNK_SIZE_MAX, Math.round(value)));
}
```

Key differences from the current file: `font: 'system'` stays (font has a legitimate system default); `theme: 'system'` is removed; `paper: 'cream'` is added; `VALID_PAPERS` + `PAPER_DEFAULT` + `validatePaper` are added.

- [ ] **Step 4: Run tests**

Run: `make test-js`
Expected: all new paper tests pass. Pre-existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/settings-defaults.js tests/js/settings-defaults.test.js
git commit -m "refactor: replace theme with paper in JS settings defaults

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: overlay.js — use paper and data-paper attribute

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js`

No unit tests for overlay.js directly — covered by regression tests in Phase G.

- [ ] **Step 1: Update the import**

At the top of `overlay.js`, replace line 2:

```js
import { FONT_SIZE_DEFAULT, FONT_SIZE_STEP, ALIGNMENT_DEFAULT, clampWpm, clampFontSize, validateAlignment } from './settings-defaults.js';
```

with:

```js
import { FONT_SIZE_DEFAULT, FONT_SIZE_STEP, ALIGNMENT_DEFAULT, PAPER_DEFAULT, clampWpm, clampFontSize, validateAlignment, validatePaper } from './settings-defaults.js';
```

- [ ] **Step 2: Update default settings in constructor**

Replace lines 10–15:

```js
    this.settings = {
      theme: 'system',
      font: 'system',
      fontSize: FONT_SIZE_DEFAULT,
      alignment: ALIGNMENT_DEFAULT,
    };
```

with:

```js
    this.settings = {
      paper: PAPER_DEFAULT,
      font: 'system',
      fontSize: FONT_SIZE_DEFAULT,
      alignment: ALIGNMENT_DEFAULT,
    };
```

- [ ] **Step 3: Update `updateSettings` to sync paper attribute**

In `updateSettings(settings)` (around line 67), replace:

```js
    if (this.host) {
      this._syncHostAttr('data-theme', settings.theme);
      this._syncHostAttr('data-font', settings.font);
      // Alignment bypasses _syncHostAttr intentionally: unlike theme/font,
      // alignment has no 'system' state — the attribute must always be present
      // for the CSS grid selector to match.
      if (settings.alignment !== undefined) {
        this.host.setAttribute('data-alignment', validateAlignment(settings.alignment));
      }
    }
```

with:

```js
    if (this.host) {
      // Paper bypasses _syncHostAttr: unlike font, paper has no 'system' state —
      // the attribute must always be present so the CSS :host([data-paper=...])
      // selector matches and tokens resolve.
      if (settings.paper !== undefined) {
        this.host.setAttribute('data-paper', validatePaper(settings.paper));
      }
      this._syncHostAttr('data-font', settings.font);
      // Alignment bypasses _syncHostAttr intentionally: unlike font, alignment
      // has no 'system' state — the attribute must always be present for the
      // CSS grid selector to match.
      if (settings.alignment !== undefined) {
        this.host.setAttribute('data-alignment', validateAlignment(settings.alignment));
      }
    }
```

- [ ] **Step 4: Update `_createDOM` to set paper attribute on host**

Around line 460, replace:

```js
    // Set theme and font attributes
    this._syncHostAttr('data-theme', this.settings.theme);
    this._syncHostAttr('data-font', this.settings.font);
```

with:

```js
    // Set paper and font attributes. Paper is always explicit (no 'system' state).
    this.host.setAttribute('data-paper', validatePaper(this.settings.paper));
    this._syncHostAttr('data-font', this.settings.font);
```

- [ ] **Step 5: Build the extension and check linting**

Run: `make lint-js`
Expected: clean. No references to `data-theme` or `settings.theme` remain in `overlay.js`.

- [ ] **Step 6: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js
git commit -m "refactor: overlay.js uses paper and data-paper attribute

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: content.js — route paper through set-paper action

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/content.js`

- [ ] **Step 1: Update the default settings object**

Around line 156, replace:

```js
  theme: 'system',
```

with:

```js
  paper: 'cream',
```

- [ ] **Step 2: Update `queryState` to read `data-paper`**

Around line 245, replace:

```js
      result.theme = overlay.host.getAttribute('data-theme') || 'system';
```

with:

```js
      result.paper = overlay.host.getAttribute('data-paper') || 'cream';
```

- [ ] **Step 3: Update `overlayActions` list and the handler**

Around line 270, replace:

```js
    var overlayActions = ['set-theme', 'set-font', 'set-wpm', 'set-font-size', 'set-alignment', 'set-chunk-size'];
```

with:

```js
    var overlayActions = ['set-paper', 'set-font', 'set-wpm', 'set-font-size', 'set-alignment', 'set-chunk-size'];
```

Around line 276, replace:

```js
    } else if (action === 'set-theme') {
      overlay.updateSettings({ theme: payload.theme });
```

with:

```js
    } else if (action === 'set-paper') {
      overlay.updateSettings({ paper: payload.paper });
```

- [ ] **Step 4: Lint**

Run: `make lint-js`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/content.js
git commit -m "refactor: content.js routes paper via set-paper action

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: background.js — allow paper key in settings payloads

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/background.js`

- [ ] **Step 1: Update allowed-key lists**

Around lines 58 and 134 (both instances), replace:

```js
      var allowed = ['wpm', 'font', 'theme', 'fontSize', 'punctuationPause', 'alignment', 'chunkSize'];
```

with:

```js
      var allowed = ['wpm', 'font', 'paper', 'fontSize', 'punctuationPause', 'alignment', 'chunkSize'];
```

- [ ] **Step 2: Update default settings object**

Around line 98, replace:

```js
          theme: 'system',
```

with:

```js
          paper: 'cream',
```

- [ ] **Step 3: Lint**

Run: `make lint-js`
Expected: clean.

- [ ] **Step 4: Verify no theme stragglers in extension JS**

Run: `grep -rn "theme\|Theme" SpeedReader/SpeedReaderExtension/Resources --include="*.js"`
Expected: output is empty. If any results come back, fix them before committing.

- [ ] **Step 5: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/background.js
git commit -m "refactor: background.js allowlist uses paper

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase G — CSS and regression tests

### Task 11: overlay.css — replace theme blocks with paper blocks

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.css`

No unit tests for CSS — covered by regression tests (Task 12) and manual verification (Task 13).

- [ ] **Step 1: Replace the color-token section of overlay.css**

In `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.css`, locate the `:host` block (line 11) and the blocks immediately after it up to and including `:host([data-theme="dark"])` (ending around line 55).

Delete the existing `@media (prefers-color-scheme: dark)` block (lines 31–43) and the `:host([data-theme="dark"])` block (lines 45–55).

In the remaining `:host` block (lines 11–29), remove these color-token lines:

```css
  --sr-accent: #0891b2;
  --sr-accent-soft: #06b6d4;
  --sr-bg: #ffffff;
  --sr-bg-secondary: #f5f5f5;
  --sr-text: #333333;
  --sr-text-dim: #aaaaaa;
  --sr-text-muted: #888888;
  --sr-border: #eeeeee;
  --sr-overlay-bg: rgba(0, 0, 0, 0.5);
  --sr-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
```

So the `:host` block is reduced to just the paper-independent tokens:

```css
:host {
  --sr-accent: #0891b2;
  --sr-accent-soft: #06b6d4;
  --sr-card-radius: 16px;
  --sr-font-family: -apple-system, system-ui, 'Helvetica Neue', sans-serif;
  --sr-word-size: 42px;
  /* Fixed height to prevent layout shift during RSVP playback.
     Sized to fit max font (96px * 1.6 line-height + padding).
     Mobile override in @media (max-width: 480px) below. */
  --sr-word-area-height: 176px;
}
```

(Note: `--sr-accent` stays in `:host` — it's unchanged across papers.)

Immediately after the `:host` block, add the four paper blocks:

```css
/* Paper color tokens. MUST match ReaderPaper.previewColors in SettingsView.swift.
   See docs/superpowers/specs/2026-04-13-paper-backgrounds-design.md. */

:host([data-paper="white"]) {
  --sr-bg: #ffffff;
  --sr-bg-secondary: #f5f5f5;
  --sr-text: #333333;
  --sr-text-dim: #aaaaaa;
  --sr-text-muted: #888888;
  --sr-border: #eeeeee;
  --sr-overlay-bg: rgba(0, 0, 0, 0.5);
  --sr-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  --sr-context-highlight: rgba(8, 145, 178, 0.15);
}

:host([data-paper="cream"]),
:host(:not([data-paper])) {
  --sr-bg: #fdf6e3;
  --sr-bg-secondary: #f5eed5;
  --sr-text: #5c4a2a;
  --sr-text-dim: #a89878;
  --sr-text-muted: #8a7858;
  --sr-border: #ebe2c7;
  --sr-overlay-bg: rgba(60, 45, 20, 0.4);
  --sr-shadow: 0 8px 32px rgba(60, 45, 20, 0.25);
  --sr-context-highlight: rgba(8, 145, 178, 0.18);
}

:host([data-paper="slate"]) {
  --sr-bg: #2a2a2a;
  --sr-bg-secondary: #222222;
  --sr-text: #dddddd;
  --sr-text-dim: #555555;
  --sr-text-muted: #777777;
  --sr-border: #333333;
  --sr-overlay-bg: rgba(0, 0, 0, 0.7);
  --sr-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  --sr-context-highlight: rgba(8, 145, 178, 0.25);
}

:host([data-paper="black"]) {
  --sr-bg: #000000;
  --sr-bg-secondary: #0a0a0a;
  --sr-text: #e0e0e0;
  --sr-text-dim: #4a4a4a;
  --sr-text-muted: #6a6a6a;
  --sr-border: #1a1a1a;
  --sr-overlay-bg: rgba(0, 0, 0, 0.85);
  --sr-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  --sr-context-highlight: rgba(8, 145, 178, 0.6);
}
```

(The `:host(:not([data-paper]))` selector piggybacks on the Cream block so the overlay still renders correctly if the attribute is somehow missing at render time — a defensive fallback matching the spec.)

- [ ] **Step 2: Update `.sr-context-highlight` to use the new token**

In `overlay.css`, replace the existing `.sr-context-highlight` rule (around line 211–216):

```css
.sr-context-highlight {
  background: rgba(8, 145, 178, 0.15);
  padding: 2px 4px;
  border-radius: 3px;
  color: var(--sr-text);
}
```

with:

```css
.sr-context-highlight {
  background: var(--sr-context-highlight);
  padding: 2px 4px;
  border-radius: 3px;
  color: var(--sr-text);
}
```

Delete the two override rules that follow it (around lines 218–226):

```css
@media (prefers-color-scheme: dark) {
  :host(:not([data-theme="light"])) .sr-context-highlight {
    background: rgba(8, 145, 178, 0.25);
  }
}

:host([data-theme="dark"]) .sr-context-highlight {
  background: rgba(61, 53, 32, 0.8);
}
```

Delete them entirely. The per-paper `--sr-context-highlight` token replaces them, and the orphaned brown `rgba(61, 53, 32, 0.8)` override is gone (it was an existing inconsistency — the dark theme used brown while light and the media-query dark used teal).

- [ ] **Step 3: Verify no theme selectors remain**

Run: `grep -n "data-theme\|prefers-color-scheme" SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.css`
Expected: only the `@media (max-width: 480px)`, `@media (min-width: 481px)`, and `@media (prefers-reduced-motion: reduce)` rules should match (those are legitimate responsive/a11y queries unrelated to theme). There should be zero `data-theme` matches and zero `prefers-color-scheme` matches.

- [ ] **Step 4: Open the app in simulator and smoke-test**

Run (macOS): `xcodebuild -project SpeedReader/SpeedReader.xcodeproj -scheme SpeedReader -destination 'platform=macOS' build 2>&1 | tail -10`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.css
git commit -m "feat: paper CSS tokens replace theme blocks

Four explicit :host([data-paper=...]) blocks. New --sr-context-highlight
custom property tuned per paper. Removes orphaned brown highlight
override that contradicted the teal used elsewhere.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Rewrite regression test from theme to paper

**Files:**
- Rename: `tests/regression/07-theme.test.js` → `tests/regression/07-paper.test.js`
- Modify: contents of the renamed file

- [ ] **Step 1: Rename the file**

```bash
git mv tests/regression/07-theme.test.js tests/regression/07-paper.test.js
```

- [ ] **Step 2: Replace the file contents**

Overwrite `tests/regression/07-paper.test.js` with:

```js
// tests/regression/07-paper.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestPage, ensureOverlayOpen, queryState, dispatch, waitFor } from './helpers.js';

describe('Paper Switching', () => {
  before(async () => {
    await setupTestPage();
    await ensureOverlayOpen();
  });

  it('set-paper white applies data-paper attribute', async () => {
    dispatch('set-paper', { paper: 'white' });
    await waitFor(async () => (await queryState()).paper === 'white', { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.paper, 'white');
  });

  it('set-paper cream applies data-paper attribute', async () => {
    dispatch('set-paper', { paper: 'cream' });
    await waitFor(async () => (await queryState()).paper === 'cream', { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.paper, 'cream');
  });

  it('set-paper slate applies data-paper attribute', async () => {
    dispatch('set-paper', { paper: 'slate' });
    await waitFor(async () => (await queryState()).paper === 'slate', { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.paper, 'slate');
  });

  it('set-paper black applies data-paper attribute', async () => {
    dispatch('set-paper', { paper: 'black' });
    await waitFor(async () => (await queryState()).paper === 'black', { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.paper, 'black');
  });
});
```

- [ ] **Step 3: Run the regression test**

Run: `make test-regression` (or the equivalent from the project Makefile — check `make help` if unclear)
Expected: all four paper switching tests pass.

If the project has no separate regression test command and regression tests run as part of `make test-all`, use that instead. The `07-paper.test.js` file is what matters.

- [ ] **Step 4: Commit**

```bash
git add tests/regression/07-paper.test.js
git commit -m "test: rewrite theme regression test as paper

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase H — Full verification and manual regression

### Task 13: Full test sweep

**Files:** none modified

- [ ] **Step 1: Run the full test + lint matrix**

Run: `make ci`
Expected: everything green — JS tests, Swift tests, ESLint, SwiftLint, Swift build.

If anything fails, **fix and re-run before proceeding**. Do not paper over a failure.

- [ ] **Step 2: Grep for any lingering theme references project-wide**

Run: `grep -rn "ReaderTheme\|setTheme\|data-theme\|sr_theme\|prefers-color-scheme.*:host" --include="*.swift" --include="*.js" --include="*.css" SpeedReader tests`

Expected matches (allowed):
- `SpeedReader/Shared/SettingsKeys.swift` — the migration function's string literal `"sr_theme"`
- Nothing else.

If anything else comes back, fix it.

- [ ] **Step 3: Commit any cleanup (if needed)**

If Step 2 found and fixed strays:

```bash
git add -u
git commit -m "chore: clean up lingering theme references

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

Otherwise, skip this step.

---

### Task 14: Manual regression on all three platforms

**Files:** none modified. This is the PRINCIPLES.md-mandated manual regression gate.

Each item below must be checked off with verified output (screenshot or visual confirmation) before the PR is merged. Do not check items off sight-unseen.

- [ ] **iPhone simulator: paper renders correctly**
  1. Run the app on an iPhone simulator.
  2. Open Settings → Appearance.
  3. For each paper (White, Cream, Slate, Black):
     - Select it in the Picker.
     - Verify the inline `RSVPPreview` updates to show the expected background + text colors.
     - Open Safari, navigate to a test article, activate the SpeedReader extension.
     - Verify the overlay background matches the selected paper.
     - Verify the focus letter (teal `#0891b2`) is visible and readable on the paper.
     - Pause the reader to view the context highlight — verify it's visible and readable.

- [ ] **iPad simulator: paper renders correctly**
  - Same steps as iPhone, on an iPad simulator.

- [ ] **macOS: paper renders correctly**
  - Same steps as iPhone, on macOS.

- [ ] **Fresh install: Cream is the default**
  1. Delete any existing `ReaderSettings` / `sr_paper` keys (fresh install or reset simulator).
  2. Launch the app.
  3. Open Settings → Appearance and verify Paper shows "Cream".
  4. Open the overlay and verify the background is `#fdf6e3`.

- [ ] **Upgrade path: `sr_theme=system` → Cream**
  1. With the app installed, manually set the legacy key: `defaults write group.com.speedreader.shared sr_theme system` (or use a debug helper).
  2. Delete `sr_migratedToPaper` and `sr_paper` to force migration.
  3. Launch the app.
  4. Verify Settings shows Paper = Cream.
  5. Verify `sr_theme` no longer exists in the App Group defaults.

- [ ] **Upgrade path: `sr_theme=light` → White**
  - Same steps, but set `sr_theme=light`. Verify Paper = White.

- [ ] **Upgrade path: `sr_theme=dark` → Slate**
  - Same steps, but set `sr_theme=dark`. Verify Paper = Slate.

- [ ] **Migration idempotency**
  1. After a successful upgrade, manually edit Paper in Settings to a different value.
  2. Relaunch the app.
  3. Verify the manually chosen Paper persists — migration did not overwrite it.

- [ ] **OpenDyslexic + each paper**
  1. In Settings, choose Font = OpenDyslexic.
  2. Cycle through all four papers.
  3. Verify each renders the OpenDyslexic font correctly on the paper background with the teal focus letter.

- [ ] **Tip banner legibility on each paper**
  1. Reset the "tip seen" flag so the tip banner appears.
  2. Open the overlay on each paper.
  3. Verify the teal-background tip banner with white text is legible on every paper (it sits inside the card, so the paper background is the surrounding area).

- [ ] **Report findings**
  - If any item fails, file the bug and fix it before marking the checklist complete.
  - Do not merge with unchecked items.

---

## Self-Review

After completing all tasks, the implementer should verify:

1. **Spec coverage:** Every item in the [spec](../superpowers/specs/2026-04-13-paper-backgrounds-design.md) is covered by a task. Specifically:
   - ReaderPaper enum with 4 cases → Task 1
   - `sr_paper` and `sr_migratedToPaper` keys → Task 1
   - Cream as default → Task 1
   - Paper validation in `saveSettings` → Task 2
   - Migration function with 5 mapping rows + idempotency → Task 3
   - ReaderSettings uses paper → Task 4
   - Migration runs on init → Task 4
   - SwiftUI Paper Picker + RSVPPreview + previewColors → Task 5
   - ReaderTheme enum removed → Task 6
   - JS `VALID_PAPERS`, `PAPER_DEFAULT`, `validatePaper` → Task 7
   - JS `SETTINGS_KEYS` / `SETTINGS_DEFAULTS` updated → Task 7
   - overlay.js uses `data-paper` → Task 8
   - content.js `set-paper` action → Task 9
   - background.js allowlist → Task 10
   - CSS `:host([data-paper=...])` blocks → Task 11
   - CSS `--sr-context-highlight` token → Task 11
   - Orphaned brown highlight removed → Task 11
   - Regression test → Task 12
   - Full CI + manual regression → Tasks 13, 14

2. **Tests cover what the spec requires** — every test listed in the spec's Testing section has a corresponding test in Tasks 1–7 and Task 12.

3. **No placeholder text** — every "TODO", "TBD", or "similar to above" has actual content.
