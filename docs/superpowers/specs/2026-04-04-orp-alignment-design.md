# ORP-Aligned Word Positioning

**Issue**: #13 — Investigate ORP-centered alignment (fixed focus point position)
**Date**: 2026-04-04
**Status**: Approved

## Problem

The RSVP overlay centers each word as a unit, causing the ORP (Optimal Recognition Point) focus letter to drift horizontally between words. At high WPM this forces micro-saccades that increase cognitive load — the opposite of what RSVP is designed to achieve.

Research (O'Regan, Rayner — Optimal Viewing Position studies) confirms that fixating at ~30% from the left edge of a word is where recognition is fastest. Independent studies show users subjectively prefer ORP-aligned presentation, though measurable comprehension differences are small. The market is split ~50/50 between ORP-aligned (Spritz, Reedy) and center-aligned (Spreeder, Velocity) apps.

Given that neither approach is universally superior, this is implemented as a **user preference** defaulting to ORP-aligned.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Default alignment | ORP-aligned | Pre-release, no migration concerns. Research-backed as subjectively preferred. |
| Preference values | `orp` / `center` | Two clear modes. Extensible if needed. |
| Implementation approach | CSS grid (`1fr / auto / 1fr`) | Pure CSS, no per-word JS measurement, works with existing `_scaleWordToFit()`. |
| Focus marker (▼) | Remove entirely | Accent-colored focus letter is the indicator. Marker is redundant visual noise. Applies to both modes. |

## Architecture

### Layout Mechanics

ORP-aligned mode uses a 3-column CSS grid on `.sr-word`:

```
|--- 1fr (right-aligned) ---|auto|--- 1fr (left-aligned) ---|
              "comp"          "r"       "ehension"
```

- Column 1 (`1fr`): `.sr-word-before`, right-aligned — text flows toward center
- Column 2 (`auto`): `.sr-word-focus` — sits at exact horizontal midpoint
- Column 3 (`1fr`): `.sr-word-after`, left-aligned — text flows away from center

Center-aligned mode retains existing inline layout (no grid).

The mode is controlled by a `data-alignment` attribute on the Shadow DOM host element, following the same pattern as `data-theme` and `data-font`.

```css
/* ORP-aligned (default) */
:host([data-alignment="orp"]) .sr-word {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
}
:host([data-alignment="orp"]) .sr-word-before {
  text-align: right;
}
:host([data-alignment="orp"]) .sr-word-after {
  text-align: left;
}

/* Center-aligned */
:host([data-alignment="center"]) .sr-word {
  /* existing inline layout, no grid */
}
```

### Settings Pipeline

New `alignment` setting follows the existing pattern through all layers:

| Layer | File | Change |
|---|---|---|
| Swift enum | `SettingsKeys.swift` | Add `ReaderAlignment` enum (`.orpAligned = "orp"`, `.center = "center"`), `sr_alignment` key, default `.orpAligned` |
| Swift model | `Settings.swift` | Add `alignment` property, `setAlignment()` method, load/save support |
| Swift UI | `SettingsView.swift` | Add `Picker` for alignment in Appearance section |
| JS constants | `settings-defaults.js` | Add `'alignment'` to `SETTINGS_KEYS`, default `'orp'` in `SETTINGS_DEFAULTS` |
| Overlay | `overlay.js` | `updateSettings()` syncs `data-alignment` host attribute; `_createDOM()` sets initial attribute |
| CSS | `overlay.css` | Grid rules scoped under `:host([data-alignment="orp"])` |

The native↔extension bridge (`SafariWebExtensionHandler.swift`, `background.js`) already forwards all keys in `SETTINGS_KEYS` — no bridge changes needed.

### Focus Marker Removal

Remove from both modes (not alignment-dependent):

- **overlay.js `_createDOM()`**: Remove `focusMarker` element creation and `wordArea.appendChild(focusMarker)`
- **overlay.css**: Remove `.sr-focus-marker` rule
- **overlay.css**: Reduce `--sr-word-area-height` from `194px` to `176px` (desktop) and `120px` to `102px` (mobile) — removing the ~18px the marker occupied (10px font + 4px margin + padding)

### RSVPPreview Update (SettingsView.swift)

The static preview in `SettingsView.swift` accepts the `alignment` setting and renders accordingly:

- **ORP mode**: `before` text in a right-aligned fixed-width frame, `focus` at center, `after` left-aligned — mirrors the CSS grid in SwiftUI
- **Center mode**: existing `Spacer()` + text + `Spacer()` layout

### Scale-to-Fit

`_scaleWordToFit()` measures `wordContainer.scrollWidth` vs `wordArea.clientWidth` and applies `transform: scale()` on overflow. In grid mode, the container spans the full area width — `scrollWidth` will still reflect true content width when text overflows the grid columns. **No changes expected.** Verify during implementation.

## ORP Calculation

No changes to `focus-point.js`. The existing `calculateFocusPoint()` returns the index at ~30% of word length (0 for words ≤3 chars), which aligns with OVP research (O'Regan, Rayner) and the Spritz heuristic. `splitWordAtFocus()` already produces the `before/focus/after` parts the grid consumes.

## Testing

### Automated
- **settings-defaults.test.js**: Verify `alignment` exists in `SETTINGS_KEYS` and `SETTINGS_DEFAULTS`, default is `'orp'`
- **SettingsTests.swift**: Verify `alignment` round-trips through `saveSettings`/`loadFromDefaults`, validates enum values, rejects invalid strings

### Manual Regression
- Both alignment modes × all 5 fonts × light/dark theme
- Edge cases: 1-char words ("I"), very long words ("comprehension"), words with trailing punctuation
- High WPM (500+): verify focus point stability in ORP mode
- Font size extremes (24px, 96px): verify `_scaleWordToFit()` still works with grid layout
- iOS, iPadOS, macOS Safari
- Settings sync: change alignment in companion app, verify overlay reflects it

## Files Changed

| File | Type |
|---|---|
| `SpeedReader/Shared/SettingsKeys.swift` | Modify — add enum, key, default |
| `SpeedReader/SpeedReader/Models/Settings.swift` | Modify — add property, setter, load/save |
| `SpeedReader/SpeedReader/Views/SettingsView.swift` | Modify — add picker, update preview |
| `SpeedReader/SpeedReaderExtension/Resources/rsvp/settings-defaults.js` | Modify — add key and default |
| `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js` | Modify — sync attribute, remove marker |
| `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.css` | Modify — add grid rules, remove marker style, adjust height |
| `tests/js/settings-defaults.test.js` | Modify — add alignment tests |
| `SpeedReader/SpeedReaderTests/SettingsTests.swift` | Modify — add alignment tests |
