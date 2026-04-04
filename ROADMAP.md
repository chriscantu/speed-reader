# SpeedReader Roadmap

## v1 — Full-Featured RSVP Reader (App Store Release)

### Core (complete)

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

### Hardening (complete)

- [x] RSVPOverlay state machine tests (play/pause/nav/wpm clamping) — extracted to `rsvp/state-machine.js`
- [x] Content script decision tree tests (selection priority, Readability fallback, error paths)
- [x] Settings persistence round-trip test (write → new instance → verify)
- [x] Settings init with pre-populated out-of-range UserDefaults test
- [x] Guard `splitWordAtFocus` against empty string input
- [x] Guard `calculateDelay` against empty string input
- [x] Settings test isolation — inject ephemeral UserDefaults to prevent test pollution
- [x] `saveSettingsToAppGroup` — track saved field count, log warning when zero fields match types
- [x] `syncSettingsFromNative` — surface sync failure to user (e.g., store lastSyncStatus flag)
- [x] Selection read failure — show toast when selection is ignored due to API error
- [x] App Group unavailable — surface visible warning in SwiftUI app when settings won't sync
- [x] Full regression test infrastructure — modular Node.js suite with Safari driver, dispatch command router, keyboard/WPM/theme/font coverage, manual iOS/iPadOS checklist

### Navigation

- [ ] Scrubber/progress bar — draggable video-player-style position control
- [ ] Save reading position per URL — resume where you left off
- [ ] Reading history in companion app

### Customization

- [x] Font picker — curated set (San Francisco, OpenDyslexic, New York, Georgia, Menlo)
- [x] Font size stepper in overlay (A−/A+, 24–96px)
- [ ] Background color options (cream/pastel for dyslexic readers)
- [ ] Configurable chunk size (1, 2, or 3 words at a time)

### Polish

- [ ] Fix overlay vertical shift on long words (#10)
- [ ] Fix font size stepper jitter (#11) — same root cause as #10
- [ ] Match settings preview ORP color to overlay accent (#12)
- [ ] Investigate ORP-centered alignment for stable focus point (#13)

## Future Ideas

- [ ] Saved articles / reading list in companion app
- [ ] Import local files (PDF, ePub, plain text)
- [ ] Cross-device reading position sync via iCloud
- [ ] Share extension (share article from any app → SpeedReader)
- [ ] Widget showing reading stats
- [ ] iframe content extraction
