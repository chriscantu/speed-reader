# SpeedReader Roadmap

Detailed tracking lives in [GitHub Issues](https://github.com/chriscantu/speed-reader/issues). Filter by label to see what's in scope.

## v1 — Full-Featured RSVP Reader (App Store Release)

**Label:** [`v1`](https://github.com/chriscantu/speed-reader/issues?q=is%3Aissue+label%3Av1)

### Complete

- Core RSVP engine (text extraction, ORP highlighting, play/pause/nav, WPM control)
- Safari Web Extension across iOS, iPadOS, macOS
- Light/dark mode, OpenDyslexic font, punctuation pausing
- SwiftUI companion app with settings + onboarding
- Keyboard shortcuts on Mac
- Font picker (5 fonts) + font size stepper in overlay
- Full test infrastructure (Swift, JS unit, Safari regression)

### Remaining

- [`v1:navigation`](https://github.com/chriscantu/speed-reader/issues?q=is%3Aissue+is%3Aopen+label%3Av1%3Anavigation) — scrubber, reading position, history
- [`v1:customization`](https://github.com/chriscantu/speed-reader/issues?q=is%3Aissue+is%3Aopen+label%3Av1%3Acustomization) — background colors, chunk size
- [`v1:polish`](https://github.com/chriscantu/speed-reader/issues?q=is%3Aissue+is%3Aopen+label%3Av1%3Apolish) — overlay stability, preview accuracy, ORP alignment

## Future Ideas

**Label:** [`future`](https://github.com/chriscantu/speed-reader/issues?q=is%3Aissue+label%3Afuture)

Saved articles, PDF/ePub import, iCloud sync, share extension, reading stats widget, iframe extraction, cross-device reading position sync (via `browser.storage.sync`).
