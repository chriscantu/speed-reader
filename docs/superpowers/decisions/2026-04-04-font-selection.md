# Font Selection for SpeedReader v1

**Date:** 2026-04-04
**Status:** Decided
**Context:** Font customization feature — selecting the curated font set for v1 App Store release

## Decision

SpeedReader will offer 5 fonts, with San Francisco (system) as the default:

| # | Font | Category | Bundled? | Why included |
|---|------|----------|----------|-------------|
| 1 | **San Francisco** (system) | Sans-serif | System | Default — highest RSVP legibility (large x-height, generous spacing) |
| 2 | **OpenDyslexic** | Accessibility | Yes (~50KB woff2) | Weighted bottoms prevent letter rotation; already bundled; user-reported cognitive load reduction |
| 3 | **New York** | Reading serif | System (iOS 13+/Catalina+) | Apple's companion serif, large x-height, used in Apple Books |
| 4 | **Georgia** | Classic serif | System | Classic screen serif, familiar book-like feel |
| 5 | **Menlo** | Monospace | System | Fixed-width keeps ORP focal point stable between words — unique RSVP advantage |

## Research Basis

**Key finding:** For RSVP, the two most impactful font properties are inter-letter spacing (#1) and x-height (#2). Serif vs. sans-serif has no measurable effect at normal display sizes.

Sources:
- Arditi & Cho (2005) — "Serifs and font legibility" (Vision Research) — inter-letter spacing dominant factor in RSVP; serifs showed no systematic effect
- Morris, Aquilante, Yager & Bigelow (2002) — serifs only slow RSVP at very small sizes (~4pt)
- Cooreman & Beier — x-height improves letter recognition speed for all letters
- Russell & Chaparro (2001) — no font size effect on RSVP comprehension, but strong preference for 20pt+

**OpenDyslexic note:** Multiple studies found no measurable performance improvement, but one study (Franzen) found shorter fixation durations interpreted as reduced cognitive load. Kept as an option for users who prefer it, not as a performance recommendation.

## Design Principles Applied

- **5-font limit** — meaningful choice without overwhelming (reduces decision fatigue for neurodivergent users)
- **Each font serves a distinct purpose** — no two overlap in category
- **4 of 5 are system fonts** — zero additional bundle size
- **Default optimized for RSVP research** — not general reading conventions

## Where Controls Live

- **Overlay (mid-reading):** Font size only — changes situationally (phone vs. iPad vs. Mac, viewing distance)
- **Companion app (set once):** Font face, font weight — personal preference, doesn't change per-article

Rationale: UX principles (Nielsen #7 flexibility, minimize interaction cost, match reading app conventions like Kindle's Aa panel) support in-overlay controls for situational adjustments. Font face is a set-once decision — forcing a multi-app context switch to change it adds cognitive load counter to SpeedReader's purpose.
