# Sync Pipeline Hardening

**Date:** 2026-04-03
**Scope:** Pre-release hardening — settings sync failure visibility

## Problem

The settings sync pipeline between the SwiftUI companion app and the Safari extension fails silently at every layer. A user whose sync is broken sees no error — settings just appear "stuck." This violates the project's "no silent failures" principle.

## Assessment Summary

| Item | Risk | Effort | Status |
|------|------|--------|--------|
| App Group unavailable — SwiftUI warning | HIGH | Medium | TODO |
| `saveSettingsToAppGroup` — field match tracking | MEDIUM | Low | TODO |
| `syncSettingsFromNative` — surface sync failure | MED-HIGH | Medium | TODO |

## Remaining Hardening (not in this plan)

| Item | Risk | Effort |
|------|------|--------|
| Content script decision tree tests | MED-HIGH | Medium |
| Guard `calculateDelay` empty input | LOW | Trivial |
| Out-of-range UserDefaults init test | LOW-MED | Low |
| Full regression test infrastructure | MEDIUM | High (defer) |

## Implementation

### 1. App Group Unavailable — SwiftUI Warning

**Problem:** `ReaderSettings.init()` falls back to `.standard` UserDefaults silently when the App Group isn't available. User has no idea sync is broken.

**Plan:**
- Add `@Published var appGroupAvailable: Bool` to `ReaderSettings`
- Set during init based on whether `UserDefaults(suiteName:)` succeeds
- Show warning banner in `SettingsView` when `appGroupAvailable == false`
- Write test: init with invalid suite name → `appGroupAvailable` is false

### 2. `saveSettingsToAppGroup` — Field Match Tracking

**Problem:** Type-guarded `if let` blocks fail silently when JS sends wrong types. Zero fields saved, no warning logged.

**Plan:**
- Count how many fields matched their expected types
- Log warning when zero fields matched (likely corrupted payload)
- Return matched count to caller for potential upstream handling
- Write test: send all-wrong-type payload → warning logged, zero fields saved

### 3. `syncSettingsFromNative` — Surface Sync Failure

**Problem:** Sync failures are caught and logged to console only. User sees stale settings with no indication.

**Plan:**
- Track `lastSyncStatus` (success/failure + timestamp) in `browser.storage.local`
- Expose sync status to content script via message handler
- Show subtle indicator in RSVP overlay when last sync failed
- Write test: mock `sendNativeMessage` failure → status flag set, indicator shown
