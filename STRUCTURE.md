# SpeedReader — Project Structure

## Overview

Single Xcode project with two targets: a SwiftUI container app and a Safari Web Extension. Settings sync via shared App Group.

## Directory Layout

```
ios-speed-reader/
├── SpeedReader/                        # Xcode project root
│   ├── SpeedReader/                    # SwiftUI container app target
│   │   ├── SpeedReaderApp.swift        # App entry point
│   │   ├── Views/
│   │   │   ├── ContentView.swift       # Main app view (onboarding + settings)
│   │   │   ├── SettingsView.swift      # WPM, font, theme controls
│   │   │   └── OnboardingView.swift    # Enable extension instructions
│   │   ├── Models/
│   │   │   └── Settings.swift          # Shared settings model
│   │   └── Assets.xcassets             # App icons, colors
│   │
│   ├── SpeedReaderExtension/           # Safari Web Extension target
│   │   ├── SafariWebExtensionHandler.swift  # Native extension handler
│   │   ├── Info.plist                  # Extension configuration
│   │   └── Resources/                  # Web resources (JS, CSS, fonts)
│   │       ├── manifest.json           # WebExtension manifest
│   │       ├── background.js           # Settings sync, message routing
│   │       ├── content.js              # Text extraction, overlay injection
│   │       ├── rsvp/                   # RSVP reader UI
│   │       │   ├── overlay.js          # Overlay UI logic
│   │       │   ├── overlay.css         # Shadow DOM styles (light + dark)
│   │       │   ├── focus-point.js      # ORP calculation
│   │       │   └── word-processor.js   # Text splitting, punctuation timing
│   │       ├── lib/
│   │       │   └── Readability.js      # Mozilla Readability (vendored)
│   │       ├── fonts/
│   │       │   └── OpenDyslexic-Regular.woff2  # Bundled font
│   │       └── images/                 # Extension icons (various sizes)
│   │
│   ├── Shared/                         # Code shared between app + extension
│   │   └── SettingsKeys.swift          # App Group keys, defaults
│   │
│   └── SpeedReader.xcodeproj           # Xcode project file
│
├── tests/
│   ├── js/                             # Unit tests (JS/TS, Bun test runner)
│   └── regression/                     # Regression tests (Bun test runner)
│
├── docs/
│   ├── superpowers/
│   │   └── specs/                      # Design specs
│   └── plans/                          # Implementation plans (one per feature)
│
├── scripts/
│   └── lib/                            # Safari driver and shared test infra
│
├── CLAUDE.md                           # Claude Code project instructions
├── PRINCIPLES.md                       # Design decisions, conventions, workflow
├── STRUCTURE.md                        # This file — project layout reference
├── ROADMAP.md                          # Future features
├── LICENSE
└── README.md
```

## Tech Stack

- **Swift / SwiftUI** — container app, iOS 26+ / macOS 26+
- **JavaScript (ES2020+)** — Safari Web Extension (content script, background script)
- **Readability.js** — Mozilla's text extraction library (vendored, not npm)
- **Shadow DOM** — overlay isolation from page styles
- **WebExtension APIs** — browser.storage, content scripts, messaging

## Where Things Go

| What | Where |
|------|-------|
| Swift UI views | `SpeedReader/SpeedReader/Views/` |
| Swift models | `SpeedReader/SpeedReader/Models/` |
| Extension JS (core) | `SpeedReader/SpeedReaderExtension/Resources/` |
| RSVP reader code | `SpeedReader/SpeedReaderExtension/Resources/rsvp/` |
| Vendored libraries | `SpeedReader/SpeedReaderExtension/Resources/lib/` |
| Bundled fonts | `SpeedReader/SpeedReaderExtension/Resources/fonts/` |
| Extension icons | `SpeedReader/SpeedReaderExtension/Resources/images/` |
| Shared Swift code | `SpeedReader/Shared/` |
| Design specs | `docs/superpowers/specs/` |
| Implementation plans | `docs/plans/` |
| App assets | `SpeedReader/SpeedReader/Assets.xcassets` |
| Unit tests (JS/TS) | `tests/js/` |
| Regression tests | `tests/regression/` |
| Build scripts | `scripts/` |
| Safari driver (test infra) | `scripts/lib/` |

## Build & Run

```bash
# Open in Xcode
open SpeedReader/SpeedReader.xcodeproj

# Build and run on simulator or device from Xcode (⌘R)
# After first run: enable the extension in Safari > Settings > Extensions
```

## Testing & Linting

```bash
make test-all     # Run JS + Swift tests
make lint-all     # Run ESLint + SwiftLint
make ci           # Run everything (lint + test)
```

- **Swift tests**: `make test-swift` (or Xcode ⌘U)
- **JS tests**: `make test-js` (Bun test runner)
- **SwiftLint**: `make lint-swift` (enforces style + safety rules)
- **ESLint**: `make lint-js` (enforces JS quality rules)
- Test on all three platforms: iPhone simulator, iPad simulator, Mac (native)

## CI

GitHub Actions runs on every push to `main` and on pull requests:
- JS tests + ESLint (ubuntu)
- SwiftLint (ubuntu)
- Swift build + test on macOS, iOS simulator build
