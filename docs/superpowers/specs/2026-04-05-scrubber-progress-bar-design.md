# Scrubber / Progress Bar — Design Spec

**Issue:** #14 — Scrubber/progress bar — draggable position control
**Date:** 2026-04-05
**Status:** Approved

## Problem Statement

**User**: Neurodivergent readers (ADHD, dyslexia) using SpeedReader's RSVP overlay to read web articles.

**Problem**: During RSVP reading, users have no sense of where they are in the article and no way to jump forward/backward. If they zone out (common with ADHD), the only option is to restart or tap through word-by-word — there's no scrubbing control like video players provide.

**Impact**: Loss of reading position is a frequent event for ADHD users. Research shows ADHD readers experience mind wandering 45-69% of the time. Without a scrubber, recovering position is tedious enough that users may abandon the article. RSVP's #1 cited usability flaw is the inability to make regressions (re-reads).

**Evidence**: Empirical RSVP research documents regression loss as a fundamental limitation. Chris (developer, ADHD) identified this as v1-required. The existing overlay has play/pause and prev/next sentence, but no continuous position control for medium-length attention lapses (30sec - 2min).

## Design Decisions

### Scrubber replaces progress bar

The existing display-only progress bar (`sr-progress-track`, 4px) is replaced with an interactive slider-style scrubber. Per Apple HIG:

- **Progress indicators are passive** — display-only status elements, not interactive
- **Sliders are interactive** — "a horizontal track with a thumb, which you can slide to move between a minimum and maximum value, such as position during media playback"
- **44pt minimum touch target** required for all interactive controls

A thin bar that is secretly interactive would violate affordance principles. The scrubber uses a visible thumb to signal interactivity.

### Native `<input type="range">`

Uses the same HTML element pattern as the existing WPM slider. This provides:

- Built-in touch, drag, and tap-to-seek for free
- Accessibility (VoiceOver, keyboard navigation) built-in
- Proven CSS already exists (`.sr-slider` class)
- Minimal new code

### Time-based labels (Apple media player convention)

Labels show elapsed time (left) and remaining time (right) in `m:ss` format, following the universal media player pattern:

```
1:24                    -2:08
────●─────────────────────────
```

**Why time over percentage or word count:**
- "2 min left" is immediately actionable; "42%" requires mental math
- Matches every audio/video player users already know — zero learning curve
- Time is computed from `wordsRemaining / wpm * 60` (estimate, excludes punctuation pausing — acceptable for an estimate)

### Pause on scrub, stay paused

When the user grabs the scrubber or taps the track:
1. Playback pauses immediately
2. Word display and context preview update to the new position
3. Playback stays paused after thumb release — user must press play to resume

This gives the user a moment to read the context preview and orient before resuming. Matches the "tap anywhere to pause" philosophy and the ADHD need to re-orient after losing focus.

### Analytics eventing

Lightweight scrub event emitted via `browser.runtime.sendMessage` on each scrub completion:

```js
{
  action: 'analytics-event',
  event: 'scrub',
  data: {
    direction: 'backward' | 'forward',
    distance: 142,        // words jumped (absolute)
    fromIndex: 524,
    toIndex: 382,
    totalWords: 1247
  }
}
```

For v1, `background.js` logs to `console.debug` only — no storage, no network. Provides Safari Web Inspector visibility during testing. When ready for real collection, swap the handler — overlay code doesn't change.

**Purpose:** Inform future navigation features (e.g., chapter markers, section jumping) with real usage data about how users seek through content.

## Architecture

### Files modified

| File | Change |
|------|--------|
| `state-machine.js` | Add `seekTo(index)`, `timeElapsed()`, `timeRemaining()` |
| `overlay.js` | Replace progress bar DOM with scrubber, bind events, add `_formatTime()`, update `_updateProgress()` |
| `overlay.css` | Remove `.sr-progress-*` styles, add `.sr-scrubber-area` and `.sr-scrubber-labels` |
| `background.js` | Add `analytics-event` message handler (console.debug) |

### State machine (`state-machine.js`)

New methods:

```js
seekTo(index)      // pause + clamp + set currentIndex
timeElapsed()      // seconds elapsed based on currentIndex / wpm
timeRemaining()    // seconds remaining based on wordsLeft / wpm
```

All existing methods (`progress()`, `currentWord()`, `contextSentence()`) already work off `currentIndex` — no changes needed.

### Overlay DOM (`overlay.js`)

The progress area in `_createDOM()` is replaced:

**Removed:**
- `sr-progress-area` > `sr-progress-labels` (percentage + word count) > `sr-progress-track` > `sr-progress-fill`

**Added:**
- `sr-scrubber-area` > `sr-scrubber-labels` (`timeElapsed` + `timeRemaining` spans) > `<input type="range" class="sr-slider">` (min=0, max=words.length-1)

**Updated methods:**
- `_updateProgress()` — sets scrubber value and time label text instead of fill width and percentage
- New `_formatTime(seconds)` — converts seconds to `m:ss`, prefixed with `-` for remaining

### Event binding (`overlay.js`)

- `input` event on scrubber: `seekTo()` + `_renderWord()` + `_updateProgress()` + `_showContext()`
- `mousedown` / `touchstart` on scrubber: pause if playing, capture `this._scrubFromIndex = this.state.currentIndex` for analytics
- `change` event on scrubber: fire analytics event using `_scrubFromIndex` and current `scrubber.value` to compute direction and distance
- Keyboard guard: ArrowLeft/ArrowRight in the document keydown handler skip `prevSentence()`/`nextSentence()` when `e.target === scrubber` (let native range handle it)

### CSS (`overlay.css`)

**Removed:** `.sr-progress-area`, `.sr-progress-labels`, `.sr-progress-track`, `.sr-progress-fill`

**Added:**
- `.sr-scrubber-area` — `margin-top: 12px`
- `.sr-scrubber-labels` — flex, space-between, 11px, muted color, `font-variant-numeric: tabular-nums` (prevents layout jitter as digits change)

The scrubber `<input type="range">` reuses `.sr-slider` — same track and thumb styling as WPM slider. Net reduction in CSS.

### Background script (`background.js`)

New message handler case:

```js
case 'analytics-event':
  console.debug('[SpeedReader]', message.event, message.data);
```

## Testing

### Unit tests (`tests/js/`)

**state-machine.test.js** — new tests:
- `seekTo` clamps to bounds (0, words.length - 1)
- `seekTo` pauses playback
- `timeElapsed` and `timeRemaining` return correct seconds at various positions and WPM
- `timeElapsed + timeRemaining` equals total time (consistency)

### Regression tests (`tests/regression/`)

- Scrubber renders with correct min/max/value attributes on open
- Scrubber `input` event updates displayed word and time labels
- Scrubbing while playing pauses playback
- Playback stays paused after thumb release
- Arrow keys on focused scrubber don't trigger prev/next sentence
- Analytics event fires on `change` with correct direction and distance
- Time labels show `m:ss` format and update during playback

### Manual testing checklist

- [ ] iPhone simulator: drag scrubber, tap-to-seek, verify touch target
- [ ] iPad simulator: same interactions
- [ ] Mac (native): mouse drag, click-to-seek, arrow keys on focused scrubber
