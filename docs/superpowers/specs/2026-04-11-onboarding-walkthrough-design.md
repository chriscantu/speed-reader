# Safari Usage Walkthrough — Design Spec

**Date**: 2026-04-11
**Issue**: [#53 — Onboarding: add Safari usage walkthrough for post-enable activation](https://github.com/chriscantu/speed-reader/issues/53)
**ADR**: [#0002 — On-device only funnel tracking](../adr/0002-on-device-only-funnel-tracking.md)

## Problem

Most iOS users don't know how to enable or use Safari extensions. SpeedReader's current onboarding guides users through enabling the extension in Settings, but provides no guidance on how to actually invoke it in Safari (puzzle-piece icon → tap SpeedReader). Users who can't figure this out assume the app is broken and abandon it before experiencing the core value.

Evidence: Safari extension developers consistently report "the app doesn't do anything" as their #1 support complaint. Estimated 30-50% of downloaders never activate the extension. Apple has iteratively improved extension discoverability across iOS 16-18, confirming the problem persists.

## Approach

**Phased onboarding** — split the current single-shot onboarding into two phases with platform-specific content for iOS and macOS.

- **Phase 1**: Enable the extension in system Settings (refined version of existing flow)
- **Phase 2**: Find and use SpeedReader in Safari (new 4-step wizard)

Each phase is shown at the right time — Phase 1 on first launch, Phase 2 after the user returns post-enable. This reduces cognitive load per session, which is critical for the neurodivergent target audience.

## State Model

### OnboardingPhase enum

```swift
enum OnboardingPhase: String {
    case enableExtension    // Phase 1
    case safariWalkthrough  // Phase 2
    case completed
}
```

### UserDefaults keys (App Group)

| Key | Type | Purpose |
|-----|------|---------|
| `sr_onboardingPhase` | String | Current phase |
| `sr_walkthrough_lastStep_ios` | Int | Last iOS walkthrough step reached (0-indexed) |
| `sr_walkthrough_lastStep_macos` | Int | Last macOS walkthrough step reached (0-indexed) |
| `sr_walkthrough_completedAt` | Double | Timestamp of walkthrough completion |
| `sr_firstExtensionActivation` | Double | Timestamp of first extension activation |
| `sr_walkthrough_replays` | Int | Times user re-opened walkthrough from Settings |

### Phase transitions

- App launch → read `sr_onboardingPhase`
  - `nil` or `enableExtension` → show Phase 1
  - User taps "Done — show me how to use it" → set to `safariWalkthrough`, show Phase 2
  - `safariWalkthrough` → show Phase 2
  - User completes Phase 2 → set to `completed`
  - `completed` → show Settings (normal state)

### Backward compatibility

If the existing `hasCompletedOnboarding` AppStorage key is `true` and `sr_onboardingPhase` is nil, set phase to `completed`. Existing users are not re-onboarded.

## Phase 1 — Enable Extension

Platform-specific views replacing the current shared `OnboardingContent` pattern.

### iOS (`EnableExtensionView_iOS`)

- Numbered step list with stylized diagram of the Settings path
- "Open Settings App" button (existing deep-link behavior)
- Helper text about navigating back from the app's settings page
- "Done — show me how to use it" transitions to Phase 2

### macOS (`EnableExtensionView_macOS`)

- Simpler step list (Safari → Settings → Extensions is more straightforward)
- "Open Safari Settings" button (existing `SFSafariApplication.showPreferencesForExtension` behavior)
- "Done — show me how to use it" transitions to Phase 2

## Phase 2 — Safari Walkthrough

A 4-step wizard with stylized SwiftUI diagrams. Fully separate implementations for iOS and macOS.

### iOS steps (`SafariWalkthroughView_iOS`)

| Step | Title | Visual | Copy |
|------|-------|--------|------|
| 1 | Open Safari | Stylized Safari app icon | "Navigate to any article or web page you'd like to read" |
| 2 | Tap the puzzle piece | Stylized address bar with pulsing `puzzlepiece.extension` SF Symbol | "It's in the address bar — this opens your extensions" |
| 3 | Tap SpeedReader | Stylized extension menu with actual SpeedReader icon (red) highlighted | "Look for the red icon — the page content will load into the speed reader" |
| 4 | You're reading! | Stylized RSVP overlay with controls | "Tap anywhere to pause. Use ‹ › to skip between sentences." |

### macOS steps (`SafariWalkthroughView_macOS`)

| Step | Title | Visual | Copy |
|------|-------|--------|------|
| 1 | Open Safari | Stylized Safari app icon | "Navigate to any article or web page you'd like to read" |
| 2 | Find extensions in the toolbar | Stylized macOS Safari toolbar with extensions area highlighted | "Look for the extensions area to the right of the address bar" |
| 3 | Click SpeedReader | Stylized extension dropdown with SpeedReader icon (red) highlighted | "Click the red SpeedReader icon — the page content will load into the speed reader" |
| 4 | Start reading! | Stylized RSVP overlay with controls | "Press Space to pause. Use ← → to navigate between sentences." |

### Navigation pattern

- `TabView` with `.tabViewStyle(.page)` for swipe navigation
- Progress dots at top showing current position
- "Next" button to advance (in addition to swipe)
- "Skip" button (top-right) for experienced users
- "Got it" on step 4 completes the walkthrough
- Each step writes `sr_walkthrough_lastStep_{ios,macos}` for funnel tracking

### Stylized diagrams

Built as reusable SwiftUI views (not screenshots). Advantages:
- Automatically adapt to Dark Mode and Dynamic Type
- VoiceOver accessible (each element is describable)
- No image assets to update when Apple redesigns Safari
- Lightweight — no bundled images

Key components:
- `SafariAddressBar` — address bar with puzzle piece icon (iOS) or toolbar (macOS)
- `ExtensionMenu` — dropdown showing SpeedReader with the actual app icon, highlighted with accent color
- `RSVPOverlayPreview` — simplified RSVP reader showing word display and controls

SF Symbols used: `puzzlepiece.extension`, `safari`, `hand.tap`, `pause.circle`, `arrow.left.arrow.right`

## Re-Accessible Help

Replace the existing "How to Use" `DisclosureGroup` in `SettingsView` with a "How to Use in Safari" button that re-opens the Phase 2 walkthrough as a sheet.

```swift
Section {
    Button("How to Use in Safari") {
        showingSafariWalkthrough = true
    }
}
.sheet(isPresented: $showingSafariWalkthrough) {
    // Platform-specific walkthrough view
    // isReplay: true — don't re-record funnel steps
}
```

Replays increment `sr_walkthrough_replays` but do not overwrite `sr_walkthrough_lastStep`.

## First Activation Detection

The extension signals first use back to the app via the existing native messaging bridge.

### background.js change

```javascript
// Inside toggle-reader listener, after successful toggle:
browser.storage.local.get({ hasReportedFirstActivation: false })
  .then((result) => {
    if (!result.hasReportedFirstActivation) {
      browser.runtime.sendNativeMessage('com.chriscantu.SpeedReader',
        { action: 'firstActivation' });
      browser.storage.local.set({ hasReportedFirstActivation: true });
    }
  });
```

### SafariWebExtensionHandler change

Add a `firstActivation` case that writes `sr_firstExtensionActivation` to App Group UserDefaults with the current timestamp.

## Developer Debug Screen

A hidden section in SettingsView (activated by long-press on the app version or similar gesture) that displays:

- Current onboarding phase
- Last walkthrough step reached (iOS/macOS)
- Walkthrough completion timestamp
- First extension activation timestamp
- Replay count

For diagnostics only — not user-facing.

## File Structure

```
SpeedReader/SpeedReader/Views/
├── ContentView.swift                    # Updated: phase-aware onboarding logic
├── Onboarding/
│   ├── OnboardingCoordinator.swift      # Phase state machine, transition logic
│   ├── EnableExtensionView_iOS.swift    # Phase 1 (iOS)
│   ├── EnableExtensionView_macOS.swift  # Phase 1 (macOS)
│   ├── SafariWalkthroughView_iOS.swift  # Phase 2 (iOS)
│   ├── SafariWalkthroughView_macOS.swift# Phase 2 (macOS)
│   └── StylizedDiagrams/
│       ├── SafariAddressBar.swift       # Address bar with puzzle piece
│       ├── ExtensionMenu.swift          # Extension dropdown
│       └── RSVPOverlayPreview.swift     # RSVP overlay preview

SpeedReader/Shared/
├── SettingsKeys.swift                   # Updated: new UserDefaults keys
├── OnboardingPhase.swift                # Enum + migration logic

SpeedReader/SpeedReaderExtension/
├── SafariWebExtensionHandler.swift      # Updated: firstActivation handler
├── Resources/background.js             # Updated: firstActivation message
```

`OnboardingView.swift` is retired — its functionality moves into the phase-specific views.

## Testing

- **Unit tests**: OnboardingPhase transitions, backward compatibility migration, funnel key writes
- **JS tests**: firstActivation message sent exactly once, subsequent toggles skip
- **Manual regression**: full walkthrough on iPhone, iPad, and Mac; verify each step renders correctly in light/dark mode; verify "How to Use" button re-opens walkthrough; verify debug screen shows correct state
