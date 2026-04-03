# SpeedReader — Design Spec

## Problem Statement

**User**: Neurodivergent readers (ADHD, dyslexia) who find traditional reading tiring and cognitively draining, but process RSVP-style presentation much more easily. Broader target: anyone who wants a free, reliable RSVP tool for web content across Apple platforms.

**Problem**: No free, reliable RSVP speed reading tool exists that works universally across websites on iOS, iPadOS, and macOS. Existing paid solutions are clunky or overpriced. For neurodivergent readers, RSVP is a genuine accessibility bridge locked behind paywalls or unreliable tools.

**Impact**: Users skip web articles entirely, default to audiobooks, or abandon tools that add friction. This limits learning for people whose brains process sequential word presentation better than traditional reading.

**Evidence**: First-hand experience — ADHD diagnosis, suspected dyslexia, finds reading tiring, gravitates to audiobooks, tried paid RSVP tools and found them clunky/overpriced.

**Constraints**: Must work across iOS, iPadOS, and macOS. Free. Must handle arbitrary web content. Iterative — POC first, polish over time. Accessibility-aware design.

---

## Architecture

**Approach**: Safari Web Extension with injected Shadow DOM RSVP overlay + SwiftUI companion app.

The extension handles text extraction and renders the RSVP reader as an overlay on the current web page using Shadow DOM isolation. The SwiftUI container app handles settings, onboarding, and future companion features (reading history, saved articles).

```
┌─────────────────────────────────────────────────────┐
│                   Safari Browser                     │
│                                                       │
│  Content Script          Background Script            │
│  - Readability.js        - browser.storage sync       │
│  - Text selection        - Message routing             │
│  - DOM injection         - State management            │
│  - Overlay lifecycle                                   │
│                                                       │
│  Shadow DOM Overlay (RSVP Reader)                     │
│  - Focus-point word display                           │
│  - Play/pause controls                                │
│  - WPM slider with circle thumb                       │
│  - Context preview on pause                           │
│  - Progress bar                                       │
└───────────────────────────────────────────────────────┘
          ↕ App Group UserDefaults + browser.storage
┌───────────────────────────────────────────────────────┐
│              SwiftUI Container App                     │
│  - Extension enable/disable onboarding                 │
│  - Settings (WPM, font, theme)                         │
│  - Future: reading history, saved articles             │
└───────────────────────────────────────────────────────┘
```

### Key Components

1. **Content Script** — injected into every page. Bundles Readability.js for text extraction. Handles text selection fallback. Injects the RSVP overlay as a Shadow DOM element.

2. **Background Script** — manages settings sync via `browser.storage`, routes messages between content script and popup, tracks state.

3. **Shadow DOM Overlay** — the RSVP reader UI. Fully self-contained CSS/HTML/JS inside a shadow root. Isolated from page styles.

4. **SwiftUI Container App** — native app for settings, onboarding, and future companion features.

### Activation Flow

1. User navigates to an article
2. Taps the extension icon in Safari toolbar (or keyboard shortcut on macOS)
3. Content script runs Readability.js → extracts article text
4. RSVP overlay appears with the extracted text
5. User taps play → words appear one at a time with focus point highlighting

---

## RSVP Reader Interface

### Focus Point Display

Single word at a time with a highlighted "optimal recognition point" (ORP) — the letter at approximately 30% of the word length. This is the character the eye naturally anchors to. The focus point is highlighted in the accent color (red), with a small marker arrow above it.

### Context Preview (on pause)

When paused, a panel below the word display shows the surrounding sentence as static text. The current word is highlighted within that sentence. This allows users (especially those with ADHD) to quickly re-orient after losing focus.

### Controls

- Play/pause button (center, accent-colored circle)
- Previous sentence / Next sentence buttons (flanking play/pause)
- WPM slider with circle thumb (iOS-style)
- Progress bar with percentage

### Responsive Adaptations

| Platform | Card Width | Tap Targets | Extras |
|----------|-----------|-------------|--------|
| iPhone | Nearly full-width | 52px (thumb-friendly) | Context preview below card |
| iPad | 480px centered | 48px | Context preview inline, keyboard support |
| Mac | 520px centered | Standard | Keyboard shortcut hints, ESC to close |

### Theme Support

- Light mode: white card, dimmed page behind, red accent
- Dark mode: dark card (#2a2a2a), deeply dimmed page, softer red (#ff6b6b) accent
- Follows system preference by default, overridable in settings

---

## Text Extraction Pipeline

### Primary: Readability.js

1. Clone the document DOM
2. Run Readability `parse()`
3. Returns: title, content (clean HTML), textContent (plain text), excerpt, byline
4. Split textContent into word array
5. Calculate focus point for each word (letter at `Math.floor(word.length * 0.3)`, clamped)

### Fallback: User Text Selection

1. Show toast: "Couldn't extract article. Select text and tap the extension again."
2. User selects text on page
3. User taps extension icon again
4. Content script reads `window.getSelection()`
5. Split into word array → launch overlay

### Word Processing

- Split on whitespace, preserve punctuation attached to words
- Punctuation pausing: period = 1.5x normal delay, comma = 1.2x normal delay
- Focus point: `Math.floor(word.length * 0.3)`, short words (1-3 chars) highlight first character

---

## Data Flow & Settings Sync

### Two Sync Mechanisms

1. **`browser.storage.sync`** — WebExtension API. Extension reads/writes. Cross-device via iCloud.
2. **App Group UserDefaults** — native mechanism. SwiftUI app and extension share an App Group container.

The SwiftUI app writes to App Group UserDefaults. The background script reads from both and normalizes into `browser.storage` for the content script.

### Default Settings (v1)

| Setting | Default | Range |
|---------|---------|-------|
| WPM | 250 | 100–600 |
| Font | System (San Francisco) | System, OpenDyslexic |
| Theme | System | Light, Dark, System |
| Font size | 42px desktop, 36px mobile | 28–64px |
| Punctuation pause | On | On/Off |

---

## Interaction Model

| Action | iPhone/iPad (touch) | iPad (keyboard) | Mac |
|--------|-------------------|-----------------|-----|
| Play/Pause | Tap anywhere on overlay | Space | Space |
| Prev sentence | Tap ⏮ button | ← arrow | ← arrow |
| Next sentence | Tap ⏭ button | → arrow | → arrow |
| Adjust WPM | Drag slider thumb | ↑/↓ arrows | ↑/↓ arrows |
| Close | Tap ✕ button | ESC | ESC |

"Tap anywhere to pause" provides a large hit area — the entire overlay card. Important for ADHD users who may tap impulsively when losing focus.

### Accessibility

- VoiceOver support for all controls (labels, hints, traits)
- Respects system Dynamic Type for non-RSVP UI
- Reduce Motion: skip transition animations on overlay appearance

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Readability.js fails | Toast + fall back to text selection mode |
| No text content | Toast: "No readable content found." No overlay. |
| Very short content (<10 words) | Works normally |
| Very long content (>10,000 words) | Works normally, progress bar essential |
| Navigate away mid-read | Overlay destroyed, position lost |
| Multiple tabs | Independent per tab |
| Extension not enabled | SwiftUI app shows onboarding instructions |
| iframes | Top-level document only (v1) |
| Paywalled content | Shows what DOM has, text selection covers partial access |

No silent failures — every error surfaces a visible toast message.

---

## Project Structure

```
ios-speed-reader/
├── SpeedReader/                    # Xcode project root
│   ├── SpeedReader/                # SwiftUI container app
│   │   ├── SpeedReaderApp.swift
│   │   ├── Views/
│   │   │   ├── ContentView.swift
│   │   │   ├── SettingsView.swift
│   │   │   └── OnboardingView.swift
│   │   ├── Models/
│   │   │   └── Settings.swift
│   │   └── Assets.xcassets
│   │
│   ├── SpeedReaderExtension/       # Safari Web Extension
│   │   ├── manifest.json
│   │   ├── background.js
│   │   ├── content.js
│   │   ├── rsvp/
│   │   │   ├── overlay.js
│   │   │   ├── overlay.css
│   │   │   ├── focus-point.js
│   │   │   └── word-processor.js
│   │   ├── lib/
│   │   │   └── readability.js
│   │   └── fonts/
│   │       └── OpenDyslexic.woff2
│   │
│   ├── Shared/
│   │   └── SettingsKeys.swift
│   │
│   └── SpeedReader.xcodeproj
│
├── docs/superpowers/specs/
├── ROADMAP.md
├── CLAUDE.md
├── LICENSE
└── README.md
```

### Key Decisions

- Vendored Readability.js (specific release, not npm dependency)
- Shadow DOM styles in separate CSS file
- Shared/ directory for Swift code shared between app and extension targets
- Single Xcode project with two targets (app + extension)
