# SpeedReader Roadmap

## v1 — Core RSVP Reader

- [x] Safari Web Extension across iOS, iPadOS, macOS
- [x] Readability.js text extraction + text selection fallback
- [x] RSVP overlay with focus-point highlighting (ORP)
- [x] Context preview on pause (surrounding sentence)
- [x] Play/pause, prev/next sentence controls
- [x] WPM slider (100–600, circle thumb)
- [x] Light/dark mode (follows system, overridable)
- [x] OpenDyslexic font option
- [x] Punctuation pausing
- [x] SwiftUI container app with settings + onboarding
- [x] Keyboard shortcuts on Mac (Space, arrows, ESC)

## v1.1 — Test Coverage & Hardening

- [ ] RSVPOverlay state machine tests (play/pause/nav/wpm clamping) — extract testable logic or use DOM shim
- [ ] Content script decision tree tests (selection priority, Readability fallback, error paths)
- [x] Settings persistence round-trip test (write → new instance → verify)
- [ ] Settings init with pre-populated out-of-range UserDefaults test
- [x] Guard `splitWordAtFocus` against empty string input
- [ ] Guard `calculateDelay` against empty string input
- [x] Settings test isolation — inject ephemeral UserDefaults to prevent test pollution
- [ ] `saveSettingsToAppGroup` — track saved field count, log warning when zero fields match types
- [ ] `syncSettingsFromNative` — surface sync failure to user (e.g., store lastSyncStatus flag)
- [x] Selection read failure — show toast when selection is ignored due to API error
- [ ] App Group unavailable — surface visible warning in SwiftUI app when settings won't sync

## v2 — Enhanced Navigation

- [ ] Scrubber/progress bar — draggable video-player-style position control
- [ ] Save reading position per URL — resume where you left off
- [ ] Reading history in companion app

## v3 — Full Customization

- [ ] Font picker — curated set (system, OpenDyslexic, monospace, serif)
- [ ] Font size, weight, and contrast controls
- [ ] Background color options (cream/pastel for dyslexic readers)
- [ ] Configurable chunk size (1, 2, or 3 words at a time)

## Future Ideas

- [ ] Saved articles / reading list in companion app
- [ ] Import local files (PDF, ePub, plain text)
- [ ] Cross-device reading position sync via iCloud
- [ ] Share extension (share article from any app → SpeedReader)
- [ ] Widget showing reading stats
- [ ] iframe content extraction
