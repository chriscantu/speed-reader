# ADR #0002: On-device only funnel tracking for onboarding walkthrough

Date: 2026-04-11

## Responsible Architect
Chris Cantu

## Author
Chris Cantu

## Contributors

* Claude (AI pair programmer)

## Lifecycle
Beta

## Status
Proposed

## Context

SpeedReader is adding a phased onboarding walkthrough to address the well-documented discoverability problem with iOS Safari extensions (see [issue #53](https://github.com/chriscantu/speed-reader/issues/53)). To evaluate whether the walkthrough actually reduces user friction, we need success metrics.

We evaluated three levels of measurement:

| Option | Data location | Infrastructure | Privacy impact | Signal quality |
|--------|--------------|----------------|----------------|----------------|
| Minimal flags (booleans only) | UserDefaults | None | None | Low — only know if completed, not where users drop off |
| Step-level on-device funnel | UserDefaults (App Group) | None | None | Medium — know which step users reach, can diagnose drop-off points |
| Anonymous aggregate reporting | Remote server | Server + consent flow | Moderate — requires privacy manifest updates, opt-in UX | High — aggregate patterns across users |

Key forces in tension:

- **Privacy vs. signal quality**: Server-side analytics would give the best aggregate data, but conflicts with the app's privacy-first mission. The privacy manifests currently declare zero collected data types (established in [ADR #0001](./0001-on-device-only-funnel-tracking.md)).
- **Cost**: The app is free with no revenue. A remote analytics server adds ongoing cost and operational burden for a solo developer.
- **Neurodivergent audience trust**: The target audience (ADHD, dyslexia users) benefits from tools they can trust aren't tracking them. Adding any form of remote telemetry — even opt-in — risks eroding that trust.
- **Diagnostic value**: When a user reports "the app doesn't work," knowing which onboarding step they reached would significantly speed up support. On-device tracking enables this via a debug screen without any remote infrastructure.

## Decision

We will use **step-level on-device funnel tracking** stored entirely in App Group UserDefaults, with no data transmitted off-device.

**Tracked events** (all stored in App Group UserDefaults so both the app and extension can read/write):

| Key | Type | Set When |
|-----|------|----------|
| `sr_onboardingPhase` | String | Phase transitions (enableExtension → safariWalkthrough → completed) |
| `sr_walkthrough_lastStep_ios` | Int | Each step the user reaches in the iOS walkthrough (0-indexed) |
| `sr_walkthrough_lastStep_macos` | Int | Each step the user reaches in the macOS walkthrough (0-indexed) |
| `sr_walkthrough_completedAt` | Double | User taps "Got it" on the final step |
| `sr_firstExtensionActivation` | Double | Extension signals first toggle-reader activation via native messaging |
| `sr_walkthrough_replays` | Int | Number of times user re-opened walkthrough from Settings |

**First activation detection**: On the first `toggle-reader` action, the background script sends a `firstActivation` native message to `SafariWebExtensionHandler`, which writes `sr_firstExtensionActivation` to App Group UserDefaults. Subsequent activations check `browser.storage.local` and skip.

**Developer visibility**: A debug-only section in SettingsView (behind a hidden gesture) displays the raw funnel state for diagnostics. No user-facing analytics UI.

**Success criteria** (evaluated manually, periodically):
- Walkthrough completion rate (step 4 reached) trending upward
- `sr_firstExtensionActivation` being set for most users who complete the walkthrough
- Low replay count (walkthrough was clear enough the first time)
- Fewer "doesn't work" App Store reviews over time

## Consequences

**Positive:**
- Zero infrastructure cost — no server, no database, no ops burden
- Privacy manifests remain clean — no new collected data type declarations
- Consistent with ADR #0001's approach of Apple-native + on-device only
- Provides enough signal to diagnose individual user issues via debug screen
- No consent flow needed — nothing to opt into since no data leaves the device
- App Group storage means both the SwiftUI app and Safari extension can participate in tracking

**Negative:**
- No aggregate view across users — cannot see overall funnel conversion rates without manually sampling devices
- Cannot detect patterns across the user population (e.g., "70% drop off at step 2") without user-reported data
- Debug screen only helps when the developer has physical access or the user can screenshot it
- Step-level tracking adds ~6 UserDefaults keys to App Group storage (negligible space, but increases the key surface area)

**Neutral:**
- Future option to add opt-in anonymous reporting later without changing the tracking architecture — the on-device keys would feed a future opt-in sync
- App Store review sentiment monitoring remains manual and subjective, but is the primary external success signal
