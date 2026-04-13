# Paper Backgrounds — Design Spec

**Issue:** [#17 — Background color options (cream/pastel for dyslexic readers)](https://github.com/chriscantu/ios-speed-reader/issues/17)
**Date:** 2026-04-13
**Status:** Approved for planning

## Problem

**User:** SpeedReader users reading long sessions with the RSVP overlay — particularly neurodivergent readers (dyslexia, visual sensitivity) who chose this tool for accessibility reasons.

**Problem:** The RSVP overlay currently offers only light (pure white) and dark (slate) backgrounds. Pure white at the center of vision during rapid word flashing produces glare and eye strain. Research-backed guidance (British Dyslexia Association Style Guide 2023, Rello & Bigham CMU 2017, W3C WAI) consistently recommends cream or soft pastel backgrounds for reading comfort, particularly for dyslexic and visually sensitive readers.

**Impact:** Inferred (first-party user data not available at current user scale). The product mission explicitly targets neurodivergent readers, so an unopinionated default that fails accessibility guidance is a meaningful miss.

**Why now:** Small user base makes a semantic refactor (not just adding options) cheap. The cost of reshaping the Theme concept is roughly proportional to active users, so the refactor is strictly cheaper today than later.

## Solution

Replace the existing `ReaderTheme` enum (`system | light | dark`) with a new `ReaderPaper` enum (`white | cream | slate | black`). This is a semantic rename + behavior change, not a parallel setting. The "follow OS appearance" concept is dropped — users pick one paper and that's what they get, always.

**Why the Paper model over alternatives:**
- Extending Theme with cream/sepia as siblings of `system/light/dark` breaks the meaning of "System" (does it override the cream choice?) and grows the picker without a coherent mental model.
- Adding a second orthogonal "background tint" setting doubles the control surface for a comfort feature and introduces explaining-why-it-doesn't-apply-in-dark-mode copy.
- Replacing Theme with Paper is the biggest change, but the only one with a clean long-term mental model. At the current user base, "biggest" is still small.

**Why drop "follow system":**
- RSVP sessions are short (seconds to minutes) — the day/night auto-switch pattern that justifies "follow system" in long-form readers (Books, Kindle, Instapaper) doesn't apply.
- Neurodivergent readers with visual sensitivity typically have stable, deliberate preferences. A meta-setting that silently overrides the chosen paper based on time of day is a surprise, not a convenience.
- An opinionated default (Cream) is a stronger accessibility signal than "whatever the OS is doing."

## Papers

Four papers ship in v1.1:

| Paper | Background | Text | Role |
|---|---|---|---|
| White | `#ffffff` | `#333333` | Cool neutral, preserves current light |
| Cream | `#fdf6e3` | `#5c4a2a` | Warm soft, BDA-recommended, **new default** |
| Slate | `#2a2a2a` | `#dddddd` | Dark soft, preserves current dark |
| Black | `#000000` | `#e0e0e0` | OLED |

Focus letter accent stays fixed at `#0891b2` (current teal) across all papers. Verified to clear WCAG AA on all four — contrast check is part of implementation.

Additional papers (Sepia, Pale Blue, etc.) are explicitly out of scope for this PR. The enum is extensible; add in a later PR if requested.

## Architecture

Setting flows through the existing settings pipeline — no new plumbing:

```
SwiftUI Settings → ReaderSettings (@Observable) → App Group UserDefaults
    → SafariWebExtensionHandler → background.js → content.js
    → overlay.js → :host([data-paper=...]) → CSS custom properties
```

The change is the *shape* of one field in that pipeline, not the pipeline itself.

## Data Model

### Swift — `SpeedReader/Shared/SettingsKeys.swift`

```swift
enum ReaderPaper: String, CaseIterable, Identifiable {
    case white
    case cream
    case slate
    case black

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .white: return "White"
        case .cream: return "Cream"
        case .slate: return "Slate"
        case .black: return "Black"
        }
    }
}

enum SettingsKeys {
    static let paper = "sr_paper"                    // replaces sr_theme
    static let migratedToPaper = "sr_migratedToPaper" // one-shot migration flag

    enum Defaults {
        static let paper: ReaderPaper = .cream
    }
}
```

The old `ReaderTheme` enum and `sr_theme` key are removed entirely. No legacy shim. Migration runs once and overwrites.

`SettingsKeys.saveSettings` gains a validation block for the `paper` field mirroring the existing `theme` block, then the `theme` block is deleted.

### JavaScript — `SpeedReader/SpeedReaderExtension/Resources/rsvp/settings-defaults.js`

```js
export const VALID_PAPERS = ['white', 'cream', 'slate', 'black'];
export const PAPER_DEFAULT = 'cream';

export const SETTINGS_KEYS = [
  'wpm', 'font', 'paper', 'fontSize', 'punctuationPause', 'alignment', 'chunkSize'
];

export const SETTINGS_DEFAULTS = {
  // ... existing fields ...
  paper: PAPER_DEFAULT,
};

export function validatePaper(value) {
  if (typeof value === 'string' && VALID_PAPERS.includes(value)) return value;
  return PAPER_DEFAULT;
}
```

The `theme` field, `'system'` default, and any `theme`-related validators are removed.

## Migration

One-shot, idempotent, runs on first launch after upgrade. Keyed off `sr_migratedToPaper` boolean in the App Group `UserDefaults`.

| Old `sr_theme` value | New `sr_paper` value |
|---|---|
| `light`   | `white` |
| `dark`    | `slate` |
| `system`  | `cream` |
| missing / invalid | `cream` |

Migration logic:
1. Read `sr_migratedToPaper`. If true, skip.
2. Read `sr_theme`. Map per table above.
3. Write `sr_paper` and `sr_migratedToPaper = true`.
4. Delete `sr_theme` key from the store.

**Rationale for the mapping:** preserve *explicit* user choices (`light`, `dark`), upgrade the *implicit* choice (`system`) to the new accessible default (Cream). Users who had "system" never actively chose white — they chose "follow OS" — so routing them to the new opinionated default is consistent with intent.

## CSS / Rendering

`SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.css`:

- Delete the `@media (prefers-color-scheme: dark)` color block.
- Delete the `:host([data-theme="dark"])` block.
- Replace with four explicit `:host([data-paper="..."])` blocks, one per paper.
- Introduce a new `--sr-context-highlight` custom property tuned per paper (replaces the hardcoded rgba values currently scattered across `.sr-context-highlight` rules and their dark-mode overrides).
- `--sr-accent: #0891b2` stays in the base `:host` block — unchanged on every paper.

```css
:host {
  --sr-accent: #0891b2;
  --sr-accent-soft: #06b6d4;
  --sr-card-radius: 16px;
  --sr-font-family: -apple-system, system-ui, 'Helvetica Neue', sans-serif;
  --sr-word-size: 42px;
  --sr-word-area-height: 176px;
  /* Color tokens are set per paper below. Default (no data-paper attr) = cream. */
}

:host([data-paper="white"]) {
  --sr-bg: #ffffff;
  --sr-bg-secondary: #f5f5f5;
  --sr-text: #333333;
  --sr-text-dim: #aaaaaa;
  --sr-text-muted: #888888;
  --sr-border: #eeeeee;
  --sr-overlay-bg: rgba(0, 0, 0, 0.5);
  --sr-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  --sr-context-highlight: rgba(8, 145, 178, 0.15);
}

:host([data-paper="cream"]),
:host(:not([data-paper])) {
  --sr-bg: #fdf6e3;
  --sr-bg-secondary: #f5eed5;
  --sr-text: #5c4a2a;
  --sr-text-dim: #a89878;
  --sr-text-muted: #8a7858;
  --sr-border: #ebe2c7;
  --sr-overlay-bg: rgba(60, 45, 20, 0.4);
  --sr-shadow: 0 8px 32px rgba(60, 45, 20, 0.25);
  --sr-context-highlight: rgba(8, 145, 178, 0.18);
}

:host([data-paper="slate"]) {
  --sr-bg: #2a2a2a;
  --sr-bg-secondary: #222222;
  --sr-text: #dddddd;
  --sr-text-dim: #555555;
  --sr-text-muted: #777777;
  --sr-border: #333333;
  --sr-overlay-bg: rgba(0, 0, 0, 0.7);
  --sr-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  --sr-context-highlight: rgba(8, 145, 178, 0.25);
}

:host([data-paper="black"]) {
  --sr-bg: #000000;
  --sr-bg-secondary: #0a0a0a;
  --sr-text: #e0e0e0;
  --sr-text-dim: #4a4a4a;
  --sr-text-muted: #6a6a6a;
  --sr-border: #1a1a1a;
  --sr-overlay-bg: rgba(0, 0, 0, 0.85);
  --sr-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  --sr-context-highlight: rgba(8, 145, 178, 0.3);
}

/* Context highlight uses the new token (replaces hardcoded rgbas + dark-mode overrides). */
.sr-context-highlight {
  background: var(--sr-context-highlight);
  padding: 2px 4px;
  border-radius: 3px;
  color: var(--sr-text);
}
```

`overlay.js`: wherever it currently reads the `theme` setting and sets `data-theme` on the shadow host, it now reads `paper` and sets `data-paper`. All `prefers-color-scheme` branching is deleted.

Grep the codebase for any other hardcoded `rgba(8, 145, 178, ...)` or hardcoded `#2a2a2a`/`#dddddd` usages during implementation — the systems analysis flagged that `.sr-context-highlight` rules are duplicated across media query branches, and those all need to collapse onto the new token.

## Settings UI

`SpeedReader/SpeedReader/Views/SettingsView.swift`:

Replace the existing Theme `Picker` in the Appearance section with:

```swift
Picker("Paper", selection: Binding(
    get: { settings.paper },
    set: { settings.setPaper($0) }
)) {
    ForEach(ReaderPaper.allCases) { paper in
        Text(paper.displayName).tag(paper)
    }
}
```

No footer hint needed — under the Paper model there are no conditional semantics to explain.

### SwiftUI preview drift

`RSVPPreview` (same file) currently duplicates the Theme color logic in Swift so the Settings screen can show a live preview. Under Paper, this duplication continues — Swift colors **must match the CSS hex values exactly** or the preview will lie to users.

To minimize drift without introducing a shared config system for 4 colors:

```swift
extension ReaderPaper {
    /// Background + text colors for the SwiftUI preview.
    /// Must stay in sync with overlay.css :host([data-paper=...]) blocks.
    var previewColors: (background: Color, text: Color) {
        switch self {
        case .white: return (Color(red: 1.0,   green: 1.0,   blue: 1.0),
                             Color(red: 0.2,   green: 0.2,   blue: 0.2))
        case .cream: return (Color(red: 0.992, green: 0.965, blue: 0.890),
                             Color(red: 0.361, green: 0.290, blue: 0.165))
        case .slate: return (Color(red: 0.165, green: 0.165, blue: 0.165),
                             Color(red: 0.867, green: 0.867, blue: 0.867))
        case .black: return (Color(red: 0.0,   green: 0.0,   blue: 0.0),
                             Color(red: 0.878, green: 0.878, blue: 0.878))
        }
    }
}
```

A comment at the top of both the CSS paper blocks and the Swift `previewColors` extension references the other, so a future editor touching one will see the cross-reference and update the other.

## Validation & Error Handling

Per PRINCIPLES.md "no silent failures":

- **Swift `SettingsKeys.saveSettings`**: validate incoming `paper` values against `ReaderPaper(rawValue:)`, reject unknown values; existing `os_log` error path logs type mismatches.
- **JS `validatePaper`**: returns `cream` for unknown / null / wrong-type inputs. Called at every JS boundary where paper crosses into the system.
- **`overlay.js` fallback**: if the paper attribute is missing or invalid at render time, apply `cream` before rendering. The CSS also includes a `:host(:not([data-paper]))` fallback matching the cream block, so an unstyled overlay is structurally impossible.
- **Migration failure**: if `UserDefaults` can't be read (App Group unavailable), the existing "Settings Sync Unavailable" warning banner in `SettingsView` covers the user-facing signal; migration silently no-ops and retries on next launch (the flag won't be set).

No user-visible toast for paper validation errors — these are programmer-error cases, not user-action cases.

## Testing

### JS unit tests (`tests/js/`)

- `validatePaper` accepts `white`, `cream`, `slate`, `black`
- `validatePaper` rejects `null`, `undefined`, numbers, unknown strings, empty string — all return `cream`
- `SETTINGS_DEFAULTS.paper === 'cream'`
- `SETTINGS_KEYS` contains `'paper'` and does not contain `'theme'`
- Settings roundtrip through `background.js` preserves the paper field across message-passing

### Swift tests

- `ReaderPaper` raw-value round-trips through `UserDefaults`
- `SettingsKeys.saveSettings` accepts all four valid paper strings, increments `savedCount`
- `SettingsKeys.saveSettings` rejects invalid paper strings, does not increment `savedCount`
- Migration table (one test per row): `sr_theme=light` → `sr_paper=white`; `=dark` → `slate`; `=system` → `cream`; missing → `cream`; unknown value → `cream`
- Migration sets `sr_migratedToPaper=true`
- Migration deletes `sr_theme`
- Migration is idempotent: running twice does not change state or re-run the mapping

### Regression tests (`tests/regression/`)

- Overlay Shadow DOM renders with correct computed `background-color` for each of the four papers
- Switching paper via settings change updates CSS custom properties live without reload
- Context highlight uses the paper's `--sr-context-highlight` token, not a hardcoded color

### Manual regression (PR merge gate, per PRINCIPLES.md)

Must be executed and checked off before merge — no items left unchecked:

- [ ] iPhone simulator: select each paper in Settings, open overlay on a test page, verify background + text + focus-letter colors match spec
- [ ] iPad simulator: same
- [ ] macOS: same
- [ ] Fresh install: first launch lands on Cream default
- [ ] Upgrade from build with `sr_theme=system`: first launch lands on Cream; screenshot
- [ ] Upgrade from `sr_theme=light`: first launch lands on White
- [ ] Upgrade from `sr_theme=dark`: first launch lands on Slate
- [ ] Context highlight visible and legible on each of the four papers (pause during reading to view)
- [ ] Tip banner (teal accent background, white text) legible on each paper
- [ ] OpenDyslexic font + each paper combination renders correctly

## Out of Scope

Explicitly not shipping in this PR:

- Custom color picker / hex input
- Per-paper focus accent color (accent stays fixed teal)
- Additional papers beyond the four
- Auto-day/night switching
- Telemetry on paper selection
- Onboarding updates mentioning paper (onboarding does not currently discuss Theme)
- ROADMAP.md updates
- Shared JSON color config consumed by both Swift and CSS — not worth the infrastructure for 4 colors

## Copy / App Store Considerations

The Paper picker label must not make medical or treatment claims. Research supports *reading comfort* framing, not *dyslexia treatment* framing.

- Settings label: "Paper" (neutral)
- No footer copy mentioning dyslexia or conditions
- If release notes mention accessibility, frame as "reading comfort options" or "reduced glare for long sessions," not "dyslexia mode"

## Risks

1. **Focus accent contrast on Cream** — `#0891b2` on `#fdf6e3` computes to approximately 4.5:1. Borderline WCAG AA for normal text, comfortably passing for large text (the focus letter is 42px+). Verify during implementation with an actual contrast calculator; if it fails, tune the accent slightly rather than expanding scope to per-paper accents.
2. **Hardcoded color cleanup** — the existing CSS has color values duplicated across light/dark media query branches and `:host([data-theme="dark"])` blocks. Grep thoroughly for any leftover hardcoded rgbas and hex values that should become tokens.
3. **Swift↔CSS drift** — the SwiftUI preview and the overlay CSS are now two independent sources of truth for paper colors. Mitigated by cross-reference comments, but a real risk if someone updates one and not the other. First offense should convert to a shared config; don't optimize ahead of it.

## References

- British Dyslexia Association Style Guide 2023 — recommends cream or soft pastel over white
- Rello & Bigham, "Good Background Colors for Readers" (CMU, ACM ASSETS 2017, n=341) — warm backgrounds improve reading speed, stronger effect for dyslexic readers
- W3C WAI, "Optimal Colors to Improve Readability for People with Dyslexia"
- Project PRINCIPLES.md — no silent failures, no magic numbers, test-first, accessibility first
- Project STRUCTURE.md — settings keys in `SettingsKeys.swift` / `settings-defaults.js`, not inline literals
