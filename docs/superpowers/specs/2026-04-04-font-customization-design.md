# Font Customization — Design Spec

**Date:** 2026-04-04
**Branch:** `feature/font-customization`
**Scope:** Font picker (5 fonts) + font size stepper in overlay + overflow bug fix
**Out of scope:** Font weight control, background/contrast colors, chunk size

## Problem

Neurodivergent readers (ADHD, dyslexia) using SpeedReader have only two font options (system, OpenDyslexic) at a fixed size configurable only in the companion app. Font customization is a core accessibility need and table stakes for a v1 App Store release that feels full-featured.

## Decisions

### Font Set (5 fonts)

| # | Font | CSS Family Stack | Category | Bundled? | Why |
|---|------|-----------------|----------|----------|-----|
| 1 | San Francisco | `-apple-system, system-ui, 'Helvetica Neue', sans-serif` | Sans-serif | System | Default — highest RSVP legibility (large x-height, generous spacing) |
| 2 | OpenDyslexic | `'OpenDyslexic', sans-serif` | Accessibility | Yes (~50KB woff2) | Weighted bottoms prevent letter rotation; already bundled |
| 3 | New York | `'New York', 'Iowan Old Style', Georgia, serif` | Reading serif | System (iOS 13+/Catalina+) | Apple's reading serif, large x-height, used in Apple Books |
| 4 | Georgia | `Georgia, 'Times New Roman', serif` | Classic serif | System | Classic screen serif, familiar book-like feel |
| 5 | Menlo | `Menlo, 'Courier New', monospace` | Monospace | System | Fixed-width keeps ORP focal point stable between words |

**Default:** San Francisco. Research basis: inter-letter spacing (#1) and x-height (#2) are the most impactful RSVP font properties (Arditi & Cho 2005; Cooreman & Beier). SF scores highest on both. See `docs/superpowers/decisions/2026-04-04-font-selection.md` for full research.

### Where Controls Live

| Control | Surface | Rationale |
|---------|---------|-----------|
| Font face | Companion app only | Set-once decision — doesn't change per-article. Reduces overlay complexity. |
| Font size | Overlay (A−/A+ stepper) + companion app (slider for default) | Changes situationally (phone vs iPad vs Mac, viewing distance). Minimizes interaction cost — no app-switching mid-reading. Matches Kindle/Apple Books convention. |
| Font weight | Not exposed | Internal design decision. 300/600 contrast powers ORP focus point. Exposing it risks flattening the core feature. Research says regular weight is optimal for RSVP. |

UX principles applied: Nielsen #3 (User Control & Freedom), Nielsen #7 (Flexibility & Efficiency), Jakob's Law (match reading app conventions), minimize interaction cost.

## Architecture

**Approach:** Extend current pattern (no new abstractions). The existing 2-font system scales to 5 with additional enum cases and CSS attribute selectors.

### 1. Settings Model (Swift)

**File:** `SpeedReader/Shared/SettingsKeys.swift`

Extend `ReaderFont` enum:

```swift
enum ReaderFont: String {
    case system        // San Francisco (existing)
    case openDyslexic  // OpenDyslexic (existing)
    case newYork       // New York
    case georgia       // Georgia
    case menlo         // Menlo
}
```

Font size bounds: `[24–96]` (widened from `[28–64]`). Default: 42px. Step: 2px.

No new settings keys — `sr_font` and `sr_fontSize` already exist. `SafariWebExtensionHandler.swift` passes values through opaquely — no structural change needed.

### 2. Overlay CSS

**File:** `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.css`

Add `data-font` attribute selectors following the existing OpenDyslexic pattern:

```css
:host([data-font="newYork"]) {
  --sr-font-family: 'New York', 'Iowan Old Style', Georgia, serif;
}
:host([data-font="georgia"]) {
  --sr-font-family: Georgia, 'Times New Roman', serif;
}
:host([data-font="menlo"]) {
  --sr-font-family: Menlo, 'Courier New', monospace;
}
```

No new `@font-face` declarations — all three are system fonts. No manifest.json changes needed.

The existing `_syncHostAttr('data-font', ...)` in `overlay.js` already sets the attribute for any non-'system' value. No JS changes needed for font face rendering.

### 3. Font Size Stepper (Overlay)

**Files:** `overlay.js` (DOM creation + event handling), `overlay.css` (styling)

**Behavior:**
- Two buttons: A− and A+
- Step size: 2px per tap
- Range: 24–96px, clamped at bounds
- Updates `--sr-word-size` CSS variable via existing `_syncFontSizeOverride()` method
- Persists change to `browser.storage.sync` so it survives overlay close/reopen
- Writes back to native app via `sendNativeMessage` → `saveSettings` handler (handler exists in `SafariWebExtensionHandler.swift` but is not yet called from JS — needs wiring up)

**Placement:** Below WPM slider, separated by a 1px divider line. Label ("Text Size") left-aligned, stepper buttons right-aligned with value label centered between them.

**Responsive sizing (existing 480px breakpoint):**

| Property | macOS / iPad (>480px) | iPhone (≤480px) |
|----------|----------------------|-----------------|
| Button size | 26 × 26px | 36 × 36px |
| Button font | 13px | 16px |
| Value label | 12px | 14px |
| Gap | 10px | 14px |

### 4. Companion App

**File:** `SpeedReader/SpeedReader/Views/SettingsView.swift`

- Font picker: expand from 2 → 5 options with descriptive labels (e.g., "New York (Serif)")
- Font size slider: range widens from `[28–64]` → `[24–96]`
- No new UI patterns — extends existing SwiftUI `Picker` and `Slider`

### 5. Overflow Bug Fix (Prerequisite)

**Problem:** Large text bleeds outside the overlay card at high font sizes. The font size range expansion (→96px) makes this worse.

**Fix (overlay.css):**
- Add `overflow: hidden` on `.sr-word-area` to contain text within card boundaries
- Add `word-break: break-all` on `.sr-word` as safety net for extremely long words at max size
- Remove the mobile breakpoint override that forces `--sr-word-size: 36px` — respect user-set sizes on all screen sizes. Overflow containment handles graceful degradation.

**Principle:** Respect user intent. Accessibility tools should not silently override user settings. If 72px is too big on their phone, the user can step down — but we don't decide for them.

## Data Flow

No new data paths. The existing settings pipeline handles this:

```
SwiftUI Picker/Slider
  → App Group UserDefaults (sr_font, sr_fontSize)
    → SafariWebExtensionHandler (getSettings)
      → background.js → browser.storage.sync
        → content.js → overlay.updateSettings()
          → _syncHostAttr('data-font', value)
          → _syncFontSizeOverride(fontSize)
```

Overlay stepper writes to `browser.storage.sync` (for extension persistence) and calls `sendNativeMessage` with `saveSettings` action to push the updated font size back to the companion app's App Group UserDefaults. The `saveSettings` handler already exists in `SafariWebExtensionHandler.swift` but the JS call path needs to be wired up in `background.js`.

## Testing

- **Settings model:** Verify new `ReaderFont` enum cases round-trip through UserDefaults
- **CSS rendering:** Each font renders correctly with ORP focus-point contrast preserved
- **Stepper behavior:** Increment/decrement, clamping at 24/96 bounds, persistence across overlay close/reopen
- **Overflow:** Verify long words at 96px don't break card layout on all viewport sizes
- **Responsive:** Stepper buttons scale correctly across 480px breakpoint
- **Cross-platform:** Font face renders correctly on iOS, iPadOS, and macOS (system font availability)

## Implementation Order

1. Overflow bug fix (prerequisite)
2. Settings model changes (Swift enum + bounds)
3. Overlay CSS (new `data-font` selectors)
4. Font size stepper (overlay JS + CSS)
5. Companion app UI (picker + slider range)
6. Testing across all platforms
