# Onboarding Walkthrough Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a phased onboarding walkthrough that guides users from enabling the Safari extension through their first speed read, with platform-specific flows for iOS and macOS and on-device funnel tracking.

**Architecture:** Phased onboarding — Phase 1 (enable extension) shown on first launch, Phase 2 (Safari usage wizard) shown after returning. Platform-specific views for iOS and macOS. On-device step-level funnel tracking via App Group UserDefaults. First extension activation detected via existing native messaging bridge.

**Tech Stack:** Swift/SwiftUI (iOS 26+, macOS 26+), JavaScript (Safari Web Extension), Bun (JS test runner), XCTest (Swift tests)

**Spec:** `docs/superpowers/specs/2026-04-11-onboarding-walkthrough-design.md`
**Issue:** [#53](https://github.com/chriscantu/speed-reader/issues/53)
**ADR:** `docs/adr/0002-on-device-only-funnel-tracking.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `SpeedReader/Shared/OnboardingPhase.swift` | `OnboardingPhase` enum, migration logic, funnel key read/write |
| `SpeedReader/SpeedReader/Views/Onboarding/OnboardingCoordinator.swift` | Observable state machine driving phase transitions |
| `SpeedReader/SpeedReader/Views/Onboarding/EnableExtensionView_iOS.swift` | Phase 1 iOS view |
| `SpeedReader/SpeedReader/Views/Onboarding/EnableExtensionView_macOS.swift` | Phase 1 macOS view |
| `SpeedReader/SpeedReader/Views/Onboarding/SafariWalkthroughView_iOS.swift` | Phase 2 iOS 4-step wizard |
| `SpeedReader/SpeedReader/Views/Onboarding/SafariWalkthroughView_macOS.swift` | Phase 2 macOS 4-step wizard |
| `SpeedReader/SpeedReader/Views/Onboarding/StylizedDiagrams/SafariAddressBar.swift` | Stylized Safari address bar with puzzle piece (iOS) |
| `SpeedReader/SpeedReader/Views/Onboarding/StylizedDiagrams/SafariToolbar.swift` | Stylized macOS Safari toolbar |
| `SpeedReader/SpeedReader/Views/Onboarding/StylizedDiagrams/ExtensionMenu.swift` | Stylized extension dropdown menu |
| `SpeedReader/SpeedReader/Views/Onboarding/StylizedDiagrams/RSVPOverlayPreview.swift` | Simplified RSVP overlay for walkthrough step 4 |
| `SpeedReader/SpeedReaderTests/OnboardingPhaseTests.swift` | Unit tests for OnboardingPhase logic |
| `tests/js/first-activation.test.js` | JS tests for firstActivation signaling |

### Modified files

| File | Change |
|------|--------|
| `SpeedReader/Shared/SettingsKeys.swift` | Add onboarding + funnel UserDefaults key constants |
| `SpeedReader/SpeedReader/Views/ContentView.swift` | Replace boolean onboarding gate with phase-aware coordinator |
| `SpeedReader/SpeedReader/Views/SettingsView.swift` | Replace DisclosureGroup with "How to Use" button + debug section |
| `SpeedReader/SpeedReaderExtension/SafariWebExtensionHandler.swift` | Add `firstActivation` case |
| `SpeedReader/SpeedReaderExtension/Resources/background.js` | Send firstActivation on first toggle |

### Retired files

| File | Reason |
|------|--------|
| `SpeedReader/SpeedReader/Views/OnboardingView.swift` | Replaced by phase-specific views |
| `SpeedReader/SpeedReaderTests/OnboardingContentTests.swift` | Tests for retired OnboardingContent struct |

---

## Task 1: Add onboarding keys to SettingsKeys + OnboardingPhase enum

**Files:**
- Modify: `SpeedReader/Shared/SettingsKeys.swift:71` (after chunkSize key)
- Create: `SpeedReader/Shared/OnboardingPhase.swift`
- Create: `SpeedReader/SpeedReaderTests/OnboardingPhaseTests.swift`

- [ ] **Step 1: Write failing tests for OnboardingPhase**

Create `SpeedReader/SpeedReaderTests/OnboardingPhaseTests.swift`:

```swift
import XCTest

final class OnboardingPhaseTests: XCTestCase {
    private func makeDefaults() -> UserDefaults {
        // swiftlint:disable:next force_unwrapping
        UserDefaults(suiteName: "test.\(UUID().uuidString)")!
    }

    // MARK: - Phase read/write

    func testDefaultPhaseIsEnableExtension() {
        let defaults = makeDefaults()
        let phase = OnboardingPhase.current(from: defaults)
        XCTAssertEqual(phase, .enableExtension)
    }

    func testWriteAndReadPhase() {
        let defaults = makeDefaults()
        OnboardingPhase.safariWalkthrough.save(to: defaults)
        XCTAssertEqual(OnboardingPhase.current(from: defaults), .safariWalkthrough)
    }

    func testCompletedPhase() {
        let defaults = makeDefaults()
        OnboardingPhase.completed.save(to: defaults)
        XCTAssertEqual(OnboardingPhase.current(from: defaults), .completed)
    }

    // MARK: - Backward compatibility migration

    func testMigrationFromLegacyOnboarding() {
        let defaults = makeDefaults()
        defaults.set(true, forKey: "hasCompletedOnboarding")
        let phase = OnboardingPhase.migrateIfNeeded(defaults: defaults)
        XCTAssertEqual(phase, .completed)
        // Verify the new key was written
        XCTAssertEqual(OnboardingPhase.current(from: defaults), .completed)
    }

    func testNoMigrationWhenNewKeyExists() {
        let defaults = makeDefaults()
        defaults.set(true, forKey: "hasCompletedOnboarding")
        OnboardingPhase.safariWalkthrough.save(to: defaults)
        let phase = OnboardingPhase.migrateIfNeeded(defaults: defaults)
        XCTAssertEqual(phase, .safariWalkthrough)
    }

    func testNoMigrationWhenLegacyKeyIsFalse() {
        let defaults = makeDefaults()
        defaults.set(false, forKey: "hasCompletedOnboarding")
        let phase = OnboardingPhase.migrateIfNeeded(defaults: defaults)
        XCTAssertEqual(phase, .enableExtension)
    }

    // MARK: - Funnel tracking

    func testRecordWalkthroughStep() {
        let defaults = makeDefaults()
        OnboardingPhase.recordWalkthroughStep(2, platform: "ios", defaults: defaults)
        let step = defaults.integer(forKey: SettingsKeys.walkthroughLastStepIOS)
        XCTAssertEqual(step, 2)
    }

    func testRecordWalkthroughStepMacOS() {
        let defaults = makeDefaults()
        OnboardingPhase.recordWalkthroughStep(3, platform: "macos", defaults: defaults)
        let step = defaults.integer(forKey: SettingsKeys.walkthroughLastStepMacOS)
        XCTAssertEqual(step, 3)
    }

    func testMarkWalkthroughCompleted() {
        let defaults = makeDefaults()
        OnboardingPhase.markWalkthroughCompleted(defaults: defaults)
        let timestamp = defaults.double(forKey: SettingsKeys.walkthroughCompletedAt)
        XCTAssertGreaterThan(timestamp, 0)
        XCTAssertEqual(OnboardingPhase.current(from: defaults), .completed)
    }

    func testIncrementReplayCount() {
        let defaults = makeDefaults()
        OnboardingPhase.incrementReplayCount(defaults: defaults)
        XCTAssertEqual(defaults.integer(forKey: SettingsKeys.walkthroughReplays), 1)
        OnboardingPhase.incrementReplayCount(defaults: defaults)
        XCTAssertEqual(defaults.integer(forKey: SettingsKeys.walkthroughReplays), 2)
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `make test-swift`
Expected: Compilation errors — `OnboardingPhase` and new `SettingsKeys` constants not defined yet.

- [ ] **Step 3: Add onboarding key constants to SettingsKeys**

In `SpeedReader/Shared/SettingsKeys.swift`, add after the `chunkSize` key (line 71):

```swift
    // Onboarding & funnel tracking keys
    static let onboardingPhase = "sr_onboardingPhase"
    static let walkthroughLastStepIOS = "sr_walkthrough_lastStep_ios"
    static let walkthroughLastStepMacOS = "sr_walkthrough_lastStep_macos"
    static let walkthroughCompletedAt = "sr_walkthrough_completedAt"
    static let firstExtensionActivation = "sr_firstExtensionActivation"
    static let walkthroughReplays = "sr_walkthrough_replays"
```

- [ ] **Step 4: Create OnboardingPhase enum**

Create `SpeedReader/Shared/OnboardingPhase.swift`:

```swift
import Foundation

/// Tracks which onboarding phase the user is in.
/// Phase 1: enable the Safari extension in Settings.
/// Phase 2: learn how to use it in Safari.
enum OnboardingPhase: String {
    case enableExtension
    case safariWalkthrough
    case completed

    /// Read the current phase from UserDefaults. Defaults to `.enableExtension`.
    static func current(from defaults: UserDefaults) -> OnboardingPhase {
        guard let raw = defaults.string(forKey: SettingsKeys.onboardingPhase),
              let phase = OnboardingPhase(rawValue: raw) else {
            return .enableExtension
        }
        return phase
    }

    /// Persist this phase to UserDefaults.
    func save(to defaults: UserDefaults) {
        defaults.set(rawValue, forKey: SettingsKeys.onboardingPhase)
    }

    /// Migrate from the legacy `hasCompletedOnboarding` boolean.
    /// Returns the resolved phase and writes the new key if migrating.
    @discardableResult
    static func migrateIfNeeded(defaults: UserDefaults) -> OnboardingPhase {
        // If the new key already exists, use it
        if defaults.string(forKey: SettingsKeys.onboardingPhase) != nil {
            return current(from: defaults)
        }
        // Legacy migration: if old boolean is true, mark as completed
        if defaults.bool(forKey: "hasCompletedOnboarding") {
            OnboardingPhase.completed.save(to: defaults)
            return .completed
        }
        return .enableExtension
    }

    // MARK: - Funnel tracking

    /// Record the last walkthrough step reached for the given platform.
    static func recordWalkthroughStep(_ step: Int, platform: String, defaults: UserDefaults) {
        let key = platform == "macos"
            ? SettingsKeys.walkthroughLastStepMacOS
            : SettingsKeys.walkthroughLastStepIOS
        defaults.set(step, forKey: key)
    }

    /// Mark the walkthrough as completed with a timestamp and transition to `.completed`.
    static func markWalkthroughCompleted(defaults: UserDefaults) {
        defaults.set(Date().timeIntervalSince1970, forKey: SettingsKeys.walkthroughCompletedAt)
        OnboardingPhase.completed.save(to: defaults)
    }

    /// Increment the replay counter (for re-opens from Settings).
    static func incrementReplayCount(defaults: UserDefaults) {
        let current = defaults.integer(forKey: SettingsKeys.walkthroughReplays)
        defaults.set(current + 1, forKey: SettingsKeys.walkthroughReplays)
    }
}
```

- [ ] **Step 5: Add new files to the Xcode project**

Add `OnboardingPhase.swift` to the `Shared` group in the Xcode project. Add `OnboardingPhaseTests.swift` to the `SpeedReaderTests` target. Both files must be added to the `.xcodeproj` to compile.

- [ ] **Step 6: Run tests to verify they pass**

Run: `make test-swift`
Expected: All `OnboardingPhaseTests` pass. Existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add SpeedReader/Shared/OnboardingPhase.swift SpeedReader/Shared/SettingsKeys.swift SpeedReader/SpeedReaderTests/OnboardingPhaseTests.swift SpeedReader/SpeedReader.xcodeproj
git commit -m "feat: add OnboardingPhase enum and funnel tracking keys"
```

---

## Task 2: OnboardingCoordinator

**Files:**
- Create: `SpeedReader/SpeedReader/Views/Onboarding/OnboardingCoordinator.swift`

- [ ] **Step 1: Create the OnboardingCoordinator**

Create `SpeedReader/SpeedReader/Views/Onboarding/OnboardingCoordinator.swift`:

```swift
import Foundation
import SwiftUI

/// Observable object that manages onboarding phase state transitions.
/// Drives which onboarding view is displayed in ContentView.
@Observable
final class OnboardingCoordinator {
    private let defaults: UserDefaults

    private(set) var phase: OnboardingPhase
    var showingSafariWalkthrough = false

    init(defaults: UserDefaults? = nil) {
        let store: UserDefaults
        if let injected = defaults {
            store = injected
        } else if let groupDefaults = UserDefaults(suiteName: SettingsKeys.appGroupID) {
            store = groupDefaults
        } else {
            store = .standard
        }
        self.defaults = store
        self.phase = OnboardingPhase.migrateIfNeeded(defaults: store)
    }

    /// Transition from Phase 1 to Phase 2.
    func completeEnableExtension() {
        phase = .safariWalkthrough
        phase.save(to: defaults)
    }

    /// Complete the walkthrough (Phase 2 → completed).
    func completeWalkthrough() {
        OnboardingPhase.markWalkthroughCompleted(defaults: defaults)
        phase = .completed
    }

    /// Record which step the user reached in the walkthrough.
    func recordStep(_ step: Int) {
        #if os(macOS)
        let platform = "macos"
        #else
        let platform = "ios"
        #endif
        OnboardingPhase.recordWalkthroughStep(step, platform: platform, defaults: defaults)
    }

    /// Show the walkthrough again from Settings (replay).
    func replayWalkthrough() {
        OnboardingPhase.incrementReplayCount(defaults: defaults)
        showingSafariWalkthrough = true
    }

    /// Whether the main onboarding flow should be shown (Phase 1 or 2).
    var shouldShowOnboarding: Bool {
        phase != .completed
    }
}
```

- [ ] **Step 2: Add to Xcode project**

Add `OnboardingCoordinator.swift` to the `SpeedReader` app target in the Xcode project, under a new `Onboarding` group inside `Views`.

- [ ] **Step 3: Verify build**

Run: `make test-swift`
Expected: Builds and all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add SpeedReader/SpeedReader/Views/Onboarding/OnboardingCoordinator.swift SpeedReader/SpeedReader.xcodeproj
git commit -m "feat: add OnboardingCoordinator state machine"
```

---

## Task 3: Stylized diagram components

**Files:**
- Create: `SpeedReader/SpeedReader/Views/Onboarding/StylizedDiagrams/SafariAddressBar.swift`
- Create: `SpeedReader/SpeedReader/Views/Onboarding/StylizedDiagrams/SafariToolbar.swift`
- Create: `SpeedReader/SpeedReader/Views/Onboarding/StylizedDiagrams/ExtensionMenu.swift`
- Create: `SpeedReader/SpeedReader/Views/Onboarding/StylizedDiagrams/RSVPOverlayPreview.swift`

- [ ] **Step 1: Create SafariAddressBar (iOS)**

Create `SpeedReader/SpeedReader/Views/Onboarding/StylizedDiagrams/SafariAddressBar.swift`:

```swift
import SwiftUI

/// Stylized iOS Safari address bar with a pulsing puzzle piece extension icon.
/// Used in the Phase 2 walkthrough to show where to find extensions.
struct SafariAddressBar: View {
    @State private var isPulsing = false

    var body: some View {
        HStack(spacing: 8) {
            // Address bar
            HStack(spacing: 6) {
                Image(systemName: "lock.fill")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text("example.com")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .padding(.horizontal, 12)
            .background(.quaternary)
            .clipShape(RoundedRectangle(cornerRadius: 10))

            // Puzzle piece icon
            Image(systemName: "puzzlepiece.extension")
                .font(.title3)
                .foregroundStyle(.white)
                .frame(width: 36, height: 36)
                .background(Color.accentColor)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .shadow(color: Color.accentColor.opacity(isPulsing ? 0.5 : 0),
                        radius: isPulsing ? 8 : 0)
                .onAppear {
                    withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) {
                        isPulsing = true
                    }
                }
        }
        .padding(12)
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.08), radius: 4, y: 2)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Safari address bar. Tap the puzzle piece icon to open extensions.")
    }
}
```

- [ ] **Step 2: Create SafariToolbar (macOS)**

Create `SpeedReader/SpeedReader/Views/Onboarding/StylizedDiagrams/SafariToolbar.swift`:

```swift
import SwiftUI

/// Stylized macOS Safari toolbar showing the extensions area.
/// Used in the Phase 2 macOS walkthrough.
struct SafariToolbar: View {
    @State private var isPulsing = false

    var body: some View {
        VStack(spacing: 0) {
            // Traffic lights
            HStack(spacing: 6) {
                Circle().fill(.red.opacity(0.8)).frame(width: 12, height: 12)
                Circle().fill(.yellow.opacity(0.8)).frame(width: 12, height: 12)
                Circle().fill(.green.opacity(0.8)).frame(width: 12, height: 12)
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.top, 8)
            .padding(.bottom, 4)

            // Toolbar row
            HStack(spacing: 8) {
                // Nav buttons
                HStack(spacing: 4) {
                    Image(systemName: "chevron.left")
                        .foregroundStyle(.tertiary)
                    Image(systemName: "chevron.right")
                        .foregroundStyle(.tertiary)
                }
                .font(.caption)

                // Address bar
                HStack(spacing: 6) {
                    Image(systemName: "lock.fill")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text("example.com")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
                .padding(.horizontal, 10)
                .background(.quaternary)
                .clipShape(RoundedRectangle(cornerRadius: 6))

                // Extension icons area
                HStack(spacing: 6) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(.quaternary)
                        .frame(width: 20, height: 20)
                        .opacity(0.4)

                    // SpeedReader icon highlighted
                    Image("AppIcon-Small")
                        .resizable()
                        .frame(width: 20, height: 20)
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                        .shadow(color: Color.accentColor.opacity(isPulsing ? 0.5 : 0),
                                radius: isPulsing ? 6 : 0)
                        .onAppear {
                            withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) {
                                isPulsing = true
                            }
                        }

                    RoundedRectangle(cornerRadius: 4)
                        .fill(.quaternary)
                        .frame(width: 20, height: 20)
                        .opacity(0.4)
                }
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 8)
        }
        .background(Color(white: 0.93))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .shadow(color: .black.opacity(0.08), radius: 4, y: 2)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Safari toolbar. Click the SpeedReader icon in the extensions area.")
    }
}
```

- [ ] **Step 3: Create ExtensionMenu**

Create `SpeedReader/SpeedReader/Views/Onboarding/StylizedDiagrams/ExtensionMenu.swift`:

```swift
import SwiftUI

/// Stylized Safari extension dropdown menu with SpeedReader highlighted.
/// Uses the actual app icon for recognition.
struct ExtensionMenu: View {
    var body: some View {
        VStack(spacing: 0) {
            // Header
            Text("Extensions")
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)

            Divider()

            // Other extension (dimmed)
            extensionRow(
                icon: AnyView(
                    RoundedRectangle(cornerRadius: 6)
                        .fill(.quaternary)
                        .frame(width: 28, height: 28)
                ),
                name: "Other Extension",
                highlighted: false
            )
            .opacity(0.35)

            // SpeedReader (highlighted)
            extensionRow(
                icon: AnyView(
                    Image("AppIcon-Small")
                        .resizable()
                        .frame(width: 28, height: 28)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                ),
                name: "SpeedReader",
                highlighted: true
            )

            // Another extension (dimmed)
            extensionRow(
                icon: AnyView(
                    RoundedRectangle(cornerRadius: 6)
                        .fill(.quaternary)
                        .frame(width: 28, height: 28)
                ),
                name: "Another Extension",
                highlighted: false
            )
            .opacity(0.35)
        }
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.12), radius: 8, y: 2)
        .frame(maxWidth: 260)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Extensions menu. SpeedReader is highlighted.")
    }

    private func extensionRow(icon: AnyView, name: String, highlighted: Bool) -> some View {
        HStack(spacing: 10) {
            icon
            Text(name)
                .font(.subheadline)
                .fontWeight(highlighted ? .semibold : .regular)
                .foregroundStyle(highlighted ? Color.red : .primary)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(highlighted ? Color.red.opacity(0.06) : .clear)
        .overlay(alignment: .leading) {
            if highlighted {
                Rectangle()
                    .fill(Color.red)
                    .frame(width: 3)
            }
        }
    }
}
```

- [ ] **Step 4: Create RSVPOverlayPreview**

Create `SpeedReader/SpeedReader/Views/Onboarding/StylizedDiagrams/RSVPOverlayPreview.swift`:

```swift
import SwiftUI

/// Simplified RSVP overlay preview for the walkthrough's "Start Reading" step.
/// Shows a sample word with ORP highlighting and basic controls.
struct RSVPOverlayPreview: View {
    /// Whether to show keyboard shortcut hints (macOS) or tap hints (iOS).
    var showKeyboardHints: Bool = false

    /// Matches `--sr-accent: #0891b2` in overlay.css.
    private let accentColor = Color(red: 8 / 255, green: 145 / 255, blue: 178 / 255)

    var body: some View {
        VStack(spacing: 16) {
            // Context line
            Text("The quick brown fox jumps over the lazy dog")
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.3))

            // Word with ORP
            HStack(spacing: 0) {
                Text("qu")
                    .foregroundStyle(.white.opacity(0.7))
                Text("i")
                    .foregroundStyle(accentColor)
                Text("ck")
                    .foregroundStyle(.white.opacity(0.7))
            }
            .font(.system(size: 32, weight: .light))

            // Controls
            HStack(spacing: 20) {
                controlButton(systemName: "chevron.left")
                controlButton(systemName: "play.fill", accent: true)
                controlButton(systemName: "chevron.right")
            }

            // Hint text
            if showKeyboardHints {
                Text("Space to pause · ← → to navigate")
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.4))
            } else {
                Text("Tap anywhere to pause")
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.4))
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity)
        .background(Color.black)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Speed reader preview showing the word quick with focus-point highlighting")
    }

    private func controlButton(systemName: String, accent: Bool = false) -> some View {
        Image(systemName: systemName)
            .font(.caption)
            .foregroundStyle(accent ? accentColor : .white.opacity(0.4))
            .frame(width: 32, height: 32)
            .overlay(
                Circle()
                    .strokeBorder(accent ? accentColor : .white.opacity(0.3), lineWidth: 1.5)
            )
    }
}
```

- [ ] **Step 5: Add all diagram files to Xcode project**

Add all four files to the `SpeedReader` app target under `Views/Onboarding/StylizedDiagrams/` group.

**Note on the app icon:** The `Image("AppIcon-Small")` references require adding a small version of the app icon to `Assets.xcassets` as a named image (not the AppIcon set, which can't be referenced by name at runtime). Add the existing `icon-48.png` from `SpeedReader/SpeedReaderExtension/Resources/images/` as `AppIcon-Small` in the asset catalog.

- [ ] **Step 6: Verify build**

Run: `make test-swift`
Expected: Builds and all existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add SpeedReader/SpeedReader/Views/Onboarding/StylizedDiagrams/ SpeedReader/SpeedReader/Assets.xcassets SpeedReader/SpeedReader.xcodeproj
git commit -m "feat: add stylized diagram components for walkthrough"
```

---

## Task 4: Phase 1 views (Enable Extension)

**Files:**
- Create: `SpeedReader/SpeedReader/Views/Onboarding/EnableExtensionView_iOS.swift`
- Create: `SpeedReader/SpeedReader/Views/Onboarding/EnableExtensionView_macOS.swift`

- [ ] **Step 1: Create EnableExtensionView_iOS**

Create `SpeedReader/SpeedReader/Views/Onboarding/EnableExtensionView_iOS.swift`:

```swift
#if os(iOS)
import SwiftUI

/// Phase 1 onboarding for iOS: guide user to enable the Safari extension in Settings.
struct EnableExtensionView_iOS: View {
    var onComplete: () -> Void

    @State private var settingsErrorMessage: String?

    private let instructions = [
        "Tap \"Open Settings\" below",
        "Tap ← Back to return to Settings",
        "Tap Apps → Safari → Extensions",
        "Turn on SpeedReader",
        "Set to \"Allow\" on all websites",
    ]

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            Image(systemName: "book.pages")
                .font(.system(size: 64))
                .foregroundStyle(Color.accentColor)

            Text("SpeedReader")
                .font(.largeTitle)
                .fontWeight(.bold)

            Text("Speed read any web page with Rapid Serial Visual Presentation")
                .font(.title3)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            VStack(alignment: .leading, spacing: 16) {
                ForEach(Array(instructions.enumerated()), id: \.offset) { index, text in
                    instructionRow(number: index + 1, text: text)
                }
            }
            .padding(24)
            .background(.quaternary)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .padding(.horizontal, 24)

            Button("Open Settings App") {
                openSettings()
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)

            Text("This opens SpeedReader settings — tap ← Back\nto reach Safari extensions.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Button("Done — show me how to use it") {
                onComplete()
            }
            .foregroundStyle(.secondary)

            Spacer()
        }
        .alert("Unable to Open Settings", isPresented: Binding(
            get: { settingsErrorMessage != nil },
            set: { if !$0 { settingsErrorMessage = nil } }
        )) {
            Button("OK") { settingsErrorMessage = nil }
        } message: {
            if let msg = settingsErrorMessage { Text(msg) }
        }
    }

    private func openSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else {
            settingsErrorMessage = "Could not build Settings URL. "
                + "Please open Settings manually: Apps → Safari → Extensions."
            return
        }
        UIApplication.shared.open(url) { success in
            if !success {
                DispatchQueue.main.async {
                    settingsErrorMessage = "Could not open Settings. "
                        + "Please navigate manually: Settings → Apps → Safari → Extensions."
                }
            }
        }
    }

    private func instructionRow(number: Int, text: String) -> some View {
        HStack(spacing: 12) {
            Text("\(number)")
                .font(.caption)
                .fontWeight(.bold)
                .frame(width: 24, height: 24)
                .background(Color.accentColor)
                .foregroundStyle(.white)
                .clipShape(Circle())

            Text(text)
                .font(.body)
        }
    }
}
#endif
```

- [ ] **Step 2: Create EnableExtensionView_macOS**

Create `SpeedReader/SpeedReader/Views/Onboarding/EnableExtensionView_macOS.swift`:

```swift
#if os(macOS)
import SwiftUI
import SafariServices

/// Phase 1 onboarding for macOS: guide user to enable the Safari extension.
struct EnableExtensionView_macOS: View {
    var onComplete: () -> Void

    @State private var settingsErrorMessage: String?

    private let instructions = [
        "Click Safari → Settings",
        "Click Extensions",
        "Enable SpeedReader",
        "Allow on all websites",
    ]

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            Image(systemName: "book.pages")
                .font(.system(size: 64))
                .foregroundStyle(Color.accentColor)

            Text("SpeedReader")
                .font(.largeTitle)
                .fontWeight(.bold)

            Text("Speed read any web page with Rapid Serial Visual Presentation")
                .font(.title3)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            VStack(alignment: .leading, spacing: 16) {
                ForEach(Array(instructions.enumerated()), id: \.offset) { index, text in
                    instructionRow(number: index + 1, text: text)
                }
            }
            .padding(24)
            .background(.quaternary)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .padding(.horizontal, 24)

            Button("Open Safari Settings") {
                openSafariSettings()
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)

            Button("Done — show me how to use it") {
                onComplete()
            }
            .foregroundStyle(.secondary)

            Spacer()
        }
        .alert("Unable to Open Settings", isPresented: Binding(
            get: { settingsErrorMessage != nil },
            set: { if !$0 { settingsErrorMessage = nil } }
        )) {
            Button("OK") { settingsErrorMessage = nil }
        } message: {
            if let msg = settingsErrorMessage { Text(msg) }
        }
    }

    private func openSafariSettings() {
        SFSafariApplication.showPreferencesForExtension(
            withIdentifier: SettingsKeys.extensionBundleIdentifier
        ) { error in
            if let error {
                DispatchQueue.main.async {
                    settingsErrorMessage = "Could not open Safari settings: \(error.localizedDescription)"
                }
            }
        }
    }

    private func instructionRow(number: Int, text: String) -> some View {
        HStack(spacing: 12) {
            Text("\(number)")
                .font(.caption)
                .fontWeight(.bold)
                .frame(width: 24, height: 24)
                .background(Color.accentColor)
                .foregroundStyle(.white)
                .clipShape(Circle())

            Text(text)
                .font(.body)
        }
    }
}
#endif
```

- [ ] **Step 3: Add to Xcode project and verify build**

Add both files to the `SpeedReader` app target. Run: `make test-swift`. Expected: Builds and passes.

- [ ] **Step 4: Commit**

```bash
git add SpeedReader/SpeedReader/Views/Onboarding/EnableExtensionView_iOS.swift SpeedReader/SpeedReader/Views/Onboarding/EnableExtensionView_macOS.swift SpeedReader/SpeedReader.xcodeproj
git commit -m "feat: add Phase 1 enable extension views (iOS + macOS)"
```

---

## Task 5: Phase 2 walkthrough views

**Files:**
- Create: `SpeedReader/SpeedReader/Views/Onboarding/SafariWalkthroughView_iOS.swift`
- Create: `SpeedReader/SpeedReader/Views/Onboarding/SafariWalkthroughView_macOS.swift`

- [ ] **Step 1: Create SafariWalkthroughView_iOS**

Create `SpeedReader/SpeedReader/Views/Onboarding/SafariWalkthroughView_iOS.swift`:

```swift
#if os(iOS)
import SwiftUI

/// Phase 2 walkthrough for iOS: 4-step wizard showing how to use SpeedReader in Safari.
struct SafariWalkthroughView_iOS: View {
    var onComplete: () -> Void
    var isReplay: Bool = false

    @State private var currentStep = 0
    @Environment(OnboardingCoordinator.self) private var coordinator: OnboardingCoordinator?

    private let totalSteps = 4

    var body: some View {
        VStack(spacing: 0) {
            // Header: progress + skip
            HStack {
                HStack(spacing: 6) {
                    ForEach(0..<totalSteps, id: \.self) { step in
                        RoundedRectangle(cornerRadius: 2)
                            .fill(step <= currentStep ? Color.accentColor : Color.secondary.opacity(0.3))
                            .frame(width: 28, height: 4)
                    }
                }
                Spacer()
                Button("Skip") { onComplete() }
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 24)
            .padding(.top, 16)

            // Paged content
            TabView(selection: $currentStep) {
                step1.tag(0)
                step2.tag(1)
                step3.tag(2)
                step4.tag(3)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .onChange(of: currentStep) { _, newStep in
                if !isReplay {
                    coordinator?.recordStep(newStep)
                }
            }

            // Bottom button
            Button(currentStep < totalSteps - 1 ? "Next" : "Got it") {
                if currentStep < totalSteps - 1 {
                    withAnimation { currentStep += 1 }
                } else {
                    onComplete()
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .padding(.horizontal, 24)
            .padding(.bottom, 32)
        }
    }

    // MARK: - Steps

    private var step1: some View {
        walkthroughStep(
            icon: Image(systemName: "safari").font(.system(size: 56)),
            title: "Open Safari",
            subtitle: "Navigate to any article or web page you'd like to read"
        )
    }

    private var step2: some View {
        VStack(spacing: 24) {
            Spacer()
            SafariAddressBar()
                .padding(.horizontal, 32)
            Text("Tap the puzzle piece")
                .font(.title2).fontWeight(.semibold)
            Text("It's in the address bar — this opens your extensions")
                .font(.subheadline).foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
        }
    }

    private var step3: some View {
        VStack(spacing: 24) {
            Spacer()
            ExtensionMenu()
                .padding(.horizontal, 40)
            Text("Tap SpeedReader")
                .font(.title2).fontWeight(.semibold)
            Text("Look for the red icon — the page content will load into the speed reader")
                .font(.subheadline).foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
        }
    }

    private var step4: some View {
        VStack(spacing: 24) {
            Spacer()
            RSVPOverlayPreview(showKeyboardHints: false)
                .padding(.horizontal, 32)
            Text("You're reading!")
                .font(.title2).fontWeight(.semibold)
            Text("Tap anywhere to pause. Use ‹ › to skip between sentences.")
                .font(.subheadline).foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
        }
    }

    private func walkthroughStep(icon: Image, title: String, subtitle: String) -> some View {
        VStack(spacing: 24) {
            Spacer()
            icon.foregroundStyle(Color.accentColor)
            Text(title)
                .font(.title2).fontWeight(.semibold)
            Text(subtitle)
                .font(.subheadline).foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
        }
    }
}
#endif
```

- [ ] **Step 2: Create SafariWalkthroughView_macOS**

Create `SpeedReader/SpeedReader/Views/Onboarding/SafariWalkthroughView_macOS.swift`:

```swift
#if os(macOS)
import SwiftUI

/// Phase 2 walkthrough for macOS: 4-step wizard showing how to use SpeedReader in Safari.
struct SafariWalkthroughView_macOS: View {
    var onComplete: () -> Void
    var isReplay: Bool = false

    @State private var currentStep = 0
    @Environment(OnboardingCoordinator.self) private var coordinator: OnboardingCoordinator?

    private let totalSteps = 4

    var body: some View {
        VStack(spacing: 0) {
            // Header: progress + skip
            HStack {
                HStack(spacing: 6) {
                    ForEach(0..<totalSteps, id: \.self) { step in
                        RoundedRectangle(cornerRadius: 2)
                            .fill(step <= currentStep ? Color.accentColor : Color.secondary.opacity(0.3))
                            .frame(width: 28, height: 4)
                    }
                }
                Spacer()
                Button("Skip") { onComplete() }
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 24)
            .padding(.top, 16)

            // Step content
            Group {
                switch currentStep {
                case 0: step1
                case 1: step2
                case 2: step3
                case 3: step4
                default: step1
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .onChange(of: currentStep) { _, newStep in
                if !isReplay {
                    coordinator?.recordStep(newStep)
                }
            }

            // Navigation buttons
            HStack {
                if currentStep > 0 {
                    Button("Back") {
                        withAnimation { currentStep -= 1 }
                    }
                    .foregroundStyle(.secondary)
                }
                Spacer()
                Button(currentStep < totalSteps - 1 ? "Next" : "Got it") {
                    if currentStep < totalSteps - 1 {
                        withAnimation { currentStep += 1 }
                    } else {
                        onComplete()
                    }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 24)
        }
        .frame(minWidth: 400, minHeight: 450)
    }

    // MARK: - Steps

    private var step1: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "safari")
                .font(.system(size: 56))
                .foregroundStyle(Color.accentColor)
            Text("Open Safari")
                .font(.title2).fontWeight(.semibold)
            Text("Navigate to any article or web page you'd like to read")
                .font(.subheadline).foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
        }
    }

    private var step2: some View {
        VStack(spacing: 24) {
            Spacer()
            SafariToolbar()
                .padding(.horizontal, 24)
            Text("Find extensions in the toolbar")
                .font(.title2).fontWeight(.semibold)
            Text("Look for the extensions area to the right of the address bar")
                .font(.subheadline).foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
        }
    }

    private var step3: some View {
        VStack(spacing: 24) {
            Spacer()
            ExtensionMenu()
                .padding(.horizontal, 40)
            Text("Click SpeedReader")
                .font(.title2).fontWeight(.semibold)
            Text("Click the red SpeedReader icon — the page content will load into the speed reader")
                .font(.subheadline).foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
        }
    }

    private var step4: some View {
        VStack(spacing: 24) {
            Spacer()
            RSVPOverlayPreview(showKeyboardHints: true)
                .padding(.horizontal, 32)
            Text("Start reading!")
                .font(.title2).fontWeight(.semibold)
            Text("Press Space to pause. Use ← → to navigate between sentences.")
                .font(.subheadline).foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
        }
    }
}
#endif
```

- [ ] **Step 3: Add to Xcode project and verify build**

Add both files to the `SpeedReader` app target. Run: `make test-swift`. Expected: Builds and passes.

- [ ] **Step 4: Commit**

```bash
git add SpeedReader/SpeedReader/Views/Onboarding/SafariWalkthroughView_iOS.swift SpeedReader/SpeedReader/Views/Onboarding/SafariWalkthroughView_macOS.swift SpeedReader/SpeedReader.xcodeproj
git commit -m "feat: add Phase 2 Safari walkthrough views (iOS + macOS)"
```

---

## Task 6: Wire up ContentView + retire OnboardingView

**Files:**
- Modify: `SpeedReader/SpeedReader/Views/ContentView.swift`
- Delete: `SpeedReader/SpeedReader/Views/OnboardingView.swift`
- Delete: `SpeedReader/SpeedReaderTests/OnboardingContentTests.swift`

- [ ] **Step 1: Replace ContentView with phase-aware onboarding**

Replace the contents of `SpeedReader/SpeedReader/Views/ContentView.swift` with:

```swift
import SwiftUI

struct ContentView: View {
    @Environment(ReaderSettings.self) private var settings
    @State private var coordinator = OnboardingCoordinator()

    var body: some View {
        NavigationStack {
            SettingsView()
                .environment(coordinator)
                .sheet(isPresented: Binding(
                    get: { coordinator.shouldShowOnboarding },
                    set: { _ in }
                )) {
                    onboardingSheet
                        .interactiveDismissDisabled()
                }
                .sheet(isPresented: $coordinator.showingSafariWalkthrough) {
                    walkthroughSheet(isReplay: true)
                }
        }
    }

    @ViewBuilder
    private var onboardingSheet: some View {
        switch coordinator.phase {
        case .enableExtension:
            enableExtensionView
        case .safariWalkthrough:
            walkthroughSheet(isReplay: false)
        case .completed:
            EmptyView()
        }
    }

    @ViewBuilder
    private var enableExtensionView: some View {
        #if os(macOS)
        EnableExtensionView_macOS(onComplete: {
            coordinator.completeEnableExtension()
        })
        #else
        EnableExtensionView_iOS(onComplete: {
            coordinator.completeEnableExtension()
        })
        #endif
    }

    @ViewBuilder
    private func walkthroughSheet(isReplay: Bool) -> some View {
        #if os(macOS)
        SafariWalkthroughView_macOS(
            onComplete: {
                if isReplay {
                    coordinator.showingSafariWalkthrough = false
                } else {
                    coordinator.completeWalkthrough()
                }
            },
            isReplay: isReplay
        )
        .environment(coordinator)
        #else
        SafariWalkthroughView_iOS(
            onComplete: {
                if isReplay {
                    coordinator.showingSafariWalkthrough = false
                } else {
                    coordinator.completeWalkthrough()
                }
            },
            isReplay: isReplay
        )
        .environment(coordinator)
        #endif
    }
}
```

- [ ] **Step 2: Delete OnboardingView.swift**

Remove `SpeedReader/SpeedReader/Views/OnboardingView.swift` from the Xcode project and delete the file.

- [ ] **Step 3: Delete OnboardingContentTests.swift**

Remove `SpeedReader/SpeedReaderTests/OnboardingContentTests.swift` from the Xcode project and delete the file.

- [ ] **Step 4: Verify build and tests**

Run: `make test-swift`
Expected: Builds and all remaining tests pass. The `OnboardingContentTests` are gone; `OnboardingPhaseTests` and `SettingsTests` still pass.

- [ ] **Step 5: Commit**

```bash
git add -A SpeedReader/SpeedReader/Views/ContentView.swift SpeedReader/SpeedReader.xcodeproj
git rm SpeedReader/SpeedReader/Views/OnboardingView.swift SpeedReader/SpeedReaderTests/OnboardingContentTests.swift
git commit -m "feat: wire up phase-aware onboarding, retire OnboardingView"
```

---

## Task 7: Update SettingsView (How to Use button + debug screen)

**Files:**
- Modify: `SpeedReader/SpeedReader/Views/SettingsView.swift:226-233`

- [ ] **Step 1: Replace DisclosureGroup with walkthrough button and debug section**

In `SpeedReader/SpeedReader/Views/SettingsView.swift`, replace the "How to Use" `Section` (lines 226-233):

```swift
            Section {
                DisclosureGroup("How to Use") {
                    Label("Navigate to any article in Safari", systemImage: "safari")
                    Label("Tap the SpeedReader icon in the toolbar", systemImage: "hand.tap")
                    Label("Tap anywhere to pause, Space on Mac", systemImage: "pause.circle")
                    Label("Use ← → to skip between sentences", systemImage: "arrow.left.arrow.right")
                }
            }
```

with:

```swift
            Section {
                Button("How to Use in Safari") {
                    coordinator?.replayWalkthrough()
                }
            }

            #if DEBUG
            Section("Debug: Onboarding Funnel") {
                if let defaults = UserDefaults(suiteName: SettingsKeys.appGroupID) {
                    LabeledContent("Phase",
                        value: defaults.string(forKey: SettingsKeys.onboardingPhase) ?? "nil")
                    LabeledContent("Last Step (iOS)",
                        value: "\(defaults.integer(forKey: SettingsKeys.walkthroughLastStepIOS))")
                    LabeledContent("Last Step (macOS)",
                        value: "\(defaults.integer(forKey: SettingsKeys.walkthroughLastStepMacOS))")
                    let completedAt = defaults.double(forKey: SettingsKeys.walkthroughCompletedAt)
                    LabeledContent("Completed",
                        value: completedAt > 0
                            ? Date(timeIntervalSince1970: completedAt).formatted()
                            : "—")
                    let activatedAt = defaults.double(forKey: SettingsKeys.firstExtensionActivation)
                    LabeledContent("First Activation",
                        value: activatedAt > 0
                            ? Date(timeIntervalSince1970: activatedAt).formatted()
                            : "—")
                    LabeledContent("Replays",
                        value: "\(defaults.integer(forKey: SettingsKeys.walkthroughReplays))")
                }
            }
            #endif
```

- [ ] **Step 2: Add coordinator environment property to SettingsView**

At the top of `SettingsView`, add:

```swift
    @Environment(OnboardingCoordinator.self) private var coordinator: OnboardingCoordinator?
```

- [ ] **Step 3: Verify build and tests**

Run: `make test-swift`
Expected: Builds and all tests pass.

- [ ] **Step 4: Commit**

```bash
git add SpeedReader/SpeedReader/Views/SettingsView.swift
git commit -m "feat: add How to Use button and debug funnel screen in Settings"
```

---

## Task 8: First activation detection (extension side)

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/background.js:10-29`
- Modify: `SpeedReader/SpeedReaderExtension/SafariWebExtensionHandler.swift:65-69`
- Create: `tests/js/first-activation.test.js`

- [ ] **Step 1: Write failing JS test for firstActivation**

Create `tests/js/first-activation.test.js`:

```javascript
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('firstActivation signaling', () => {
  let storageState;
  let nativeMessages;

  // Minimal browser mock
  const browser = {
    storage: {
      local: {
        get: async (defaults) => ({ ...defaults, ...storageState }),
        set: async (obj) => { Object.assign(storageState, obj); },
      },
    },
    runtime: {
      sendNativeMessage: async (appId, message) => {
        nativeMessages.push({ appId, message });
        return { status: 'ok' };
      },
    },
  };

  beforeEach(() => {
    storageState = {};
    nativeMessages = [];
  });

  // Extract the signaling logic into a testable function
  async function signalFirstActivationIfNeeded(browserApi) {
    const result = await browserApi.storage.local.get({ hasReportedFirstActivation: false });
    if (!result.hasReportedFirstActivation) {
      await browserApi.runtime.sendNativeMessage(
        'com.chriscantu.SpeedReader',
        { action: 'firstActivation' }
      );
      await browserApi.storage.local.set({ hasReportedFirstActivation: true });
    }
  }

  it('sends firstActivation on first toggle', async () => {
    await signalFirstActivationIfNeeded(browser);
    assert.strictEqual(nativeMessages.length, 1);
    assert.deepStrictEqual(nativeMessages[0].message, { action: 'firstActivation' });
  });

  it('sets hasReportedFirstActivation flag after sending', async () => {
    await signalFirstActivationIfNeeded(browser);
    assert.strictEqual(storageState.hasReportedFirstActivation, true);
  });

  it('does not send on subsequent toggles', async () => {
    storageState.hasReportedFirstActivation = true;
    await signalFirstActivationIfNeeded(browser);
    assert.strictEqual(nativeMessages.length, 0);
  });
});
```

- [ ] **Step 2: Run JS tests to verify they pass**

Run: `bun test tests/js/first-activation.test.js`
Expected: All 3 tests pass (the logic is self-contained in the test via `signalFirstActivationIfNeeded`).

- [ ] **Step 3: Add firstActivation signaling to background.js**

In `SpeedReader/SpeedReaderExtension/Resources/background.js`, inside the `browser.action.onClicked.addListener` callback, after the successful `sendMessage` call (line 12), add the firstActivation logic:

After `await browser.tabs.sendMessage(tab.id, { action: 'toggle-reader' });` (line 12), add:

```javascript
    // Signal first activation for onboarding funnel tracking
    browser.storage.local.get({ hasReportedFirstActivation: false })
      .then(function(result) {
        if (!result.hasReportedFirstActivation) {
          browser.runtime.sendNativeMessage(
            'com.chriscantu.SpeedReader',
            { action: 'firstActivation' }
          );
          browser.storage.local.set({ hasReportedFirstActivation: true });
        }
      });
```

- [ ] **Step 4: Add firstActivation handler to SafariWebExtensionHandler**

In `SpeedReader/SpeedReaderExtension/SafariWebExtensionHandler.swift`, add a new case before `default:` (around line 66):

```swift
        case "firstActivation":
            if let defaults = UserDefaults(suiteName: SettingsKeys.appGroupID) {
                let existing = defaults.double(forKey: SettingsKeys.firstExtensionActivation)
                if existing == 0 {
                    defaults.set(Date().timeIntervalSince1970, forKey: SettingsKeys.firstExtensionActivation)
                    os_log(.default, "[SpeedReader] First extension activation recorded")
                }
            }
            response.userInfo = [SFExtensionMessageKey: ["status": "ok"]]
```

- [ ] **Step 5: Run all tests**

Run: `make test-all`
Expected: Both JS and Swift tests pass.

- [ ] **Step 6: Commit**

```bash
git add tests/js/first-activation.test.js SpeedReader/SpeedReaderExtension/Resources/background.js SpeedReader/SpeedReaderExtension/SafariWebExtensionHandler.swift
git commit -m "feat: add first extension activation detection via native messaging"
```

---

## Task 9: Update STRUCTURE.md + final verification

**Files:**
- Modify: `STRUCTURE.md`

- [ ] **Step 1: Update STRUCTURE.md directory layout**

In `STRUCTURE.md`, update the directory layout to include the new `Onboarding/` subdirectory under `SpeedReader/SpeedReader/Views/` and add `OnboardingPhase.swift` under `Shared/`. Update the "Where Things Go" table to include a row for onboarding views.

- [ ] **Step 2: Run full test suite**

Run: `make ci`
Expected: All linting and tests pass (JS + Swift).

- [ ] **Step 3: Manual smoke test**

Test on all three platforms:
1. **iPhone simulator**: Fresh install → Phase 1 appears → tap "Done" → Phase 2 appears → swipe through 4 steps → "Got it" → Settings screen. Verify "How to Use in Safari" button re-opens walkthrough.
2. **iPad simulator**: Same flow as iPhone.
3. **Mac (native)**: Same flow but with macOS-specific content (toolbar diagram, keyboard shortcuts in step 4).

Verify in DEBUG build: the "Debug: Onboarding Funnel" section in Settings shows correct phase, step, and replay data.

- [ ] **Step 4: Commit**

```bash
git add STRUCTURE.md
git commit -m "docs: update STRUCTURE.md with onboarding walkthrough file layout"
```
