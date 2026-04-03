# SpeedReader — CLAUDE.md

## Project Overview

SpeedReader is a free Safari Web Extension that provides Rapid Serial Visual Presentation (RSVP) speed reading for any web page across iOS, iPadOS, and macOS. Built for accessibility — particularly for neurodivergent readers (ADHD, dyslexia) who find traditional reading tiring but process sequential word presentation more easily.

## Architecture

- **Safari Web Extension** (JavaScript) — content script injects a Shadow DOM RSVP overlay onto web pages
- **SwiftUI Container App** (Swift) — settings, onboarding, future companion features
- **Shared App Group** — settings sync between native app and extension via UserDefaults + browser.storage
- **Single Xcode project** with two targets: app + extension

## Tech Stack

- **Swift / SwiftUI** — container app, iOS 17+ / macOS 14+
- **JavaScript** — Safari Web Extension (content script, background script)
- **Readability.js** — Mozilla's text extraction library (vendored, not npm)
- **Shadow DOM** — overlay isolation from page styles
- **WebExtension APIs** — browser.storage, content scripts, messaging

## Project Structure

```
SpeedReader/
├── SpeedReader/              # SwiftUI container app target
├── SpeedReaderExtension/     # Safari Web Extension target
│   ├── rsvp/                 # RSVP reader UI (overlay, focus-point, word processing)
│   ├── lib/                  # Vendored libraries (Readability.js)
│   └── fonts/                # Bundled fonts (OpenDyslexic)
└── Shared/                   # Code shared between targets (settings keys)
```

## Key Design Decisions

- **Shadow DOM for overlay** — isolates RSVP UI from arbitrary page CSS
- **Readability.js + text selection fallback** — reliable extraction with manual escape hatch
- **Focus-point (ORP) highlighting** — letter at ~30% of word length highlighted in accent color
- **Tap anywhere to pause** — large hit area for ADHD users who tap impulsively
- **Context preview on pause** — shows surrounding sentence to help re-orient after losing focus
- **Punctuation pausing** — period 1.5x delay, comma 1.2x delay for natural reading rhythm

## Build & Run

```bash
# Open in Xcode
open SpeedReader/SpeedReader.xcodeproj

# Build and run on simulator or device from Xcode
# After first run: enable the extension in Safari > Settings > Extensions
```

## Testing

- Run tests from Xcode: ⌘U
- JavaScript tests: TBD (will add test runner for extension code)
- Test on all three platforms: iPhone simulator, iPad simulator, Mac (native)

## Conventions

- Swift: follow Swift API Design Guidelines
- JavaScript: ES2020+, no transpilation needed (Safari supports it)
- Git branches: `feature/<short-description>`
- Commits: concise subject, imperative mood
- No direct pushes to main without review

## Design Spec

Full design spec: `docs/superpowers/specs/2026-04-02-speed-reader-design.md`
Roadmap: `ROADMAP.md`
