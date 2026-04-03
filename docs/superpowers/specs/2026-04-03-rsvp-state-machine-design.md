# RSVPOverlay State Machine Extraction

**Date**: 2026-04-03
**Status**: Approved
**Scope**: v1.1 — Test Coverage & Hardening

## Problem

The RSVPOverlay (550 lines in `rsvp/overlay.js`) couples state machine logic with DOM
rendering. This makes the core playback logic — play/pause transitions, sentence
navigation, WPM adjustment, tick timing — untestable outside a browser. Any change to
overlay behavior risks silent regressions with no automated safety net beyond the
manual regression script.

## Approach

Extract a pure `RSVPStateMachine` class into `rsvp/state-machine.js`. The overlay
becomes a thin rendering shell that owns a state machine instance and delegates all
state transitions to it.

Key design choice: `tick()` returns `{ delay }` or `{ done: true }` instead of calling
`setTimeout` internally. The overlay handles scheduling. This makes the timing loop
fully testable without timer mocks.

## New Module: `rsvp/state-machine.js`

### State

```
words: []              // from processText()
currentIndex: 0
isPlaying: false
wpm: 250               // clamped 100–600
punctuationPause: true
```

### Public API

| Method | Returns | State change |
|--------|---------|-------------|
| `init(text, settings)` | `void` | Resets words/index/playing, clamps wpm |
| `play()` | `void` | Sets isPlaying=true, resets index if at end |
| `pause()` | `void` | Sets isPlaying=false |
| `togglePlayPause()` | same as play/pause | Delegates |
| `tick()` | `{ delay }` or `{ done: true }` | Advances currentIndex, computes next delay |
| `prevSentence()` | `void` | Navigates to previous sentence start, pauses |
| `nextSentence()` | `void` | Navigates to next sentence start, pauses |
| `adjustWpm(delta)` | `number` (new wpm) | Clamps and updates wpm |
| `currentWord()` | `{ before, focus, after }` | None (read-only) |
| `contextSentence()` | `{ words: string[], highlightIndex: number }` | None (read-only) |
| `progress()` | `{ percent, current, total }` | None (read-only) |

### Imports

- `processText`, `calculateDelay`, `wpmToDelay` from `./word-processor.js`
- `splitWordAtFocus` from `./focus-point.js`

No DOM APIs. No `setTimeout`. No `document` or `browser` globals.

## Changes to `overlay.js`

The overlay keeps all DOM code (`_createDOM`, `_bindEvents`, `_renderWord`,
`_updateProgress`, `_updatePlayButton`, `_showContext`, `_hideContext`,
`_showPageToast`) and becomes a rendering shell:

1. Imports `RSVPStateMachine`
2. `open()` → `this.state.init(text, settings)`, then creates DOM and renders
3. `play()` → `this.state.play()`, starts scheduling loop
4. Scheduling loop: `this.state.tick()` → render from state → `setTimeout` with
   returned delay, or pause if `done`
5. Navigation/WPM → delegate to state machine, re-render
6. Read-only accessors (`currentWord()`, `progress()`, `contextSentence()`) replace
   direct state reads in render methods

Overlay shrinks by ~80 lines. Identical external behavior.

## Test File: `tests/js/state-machine.test.js`

Using `node:test` + `node:assert/strict` (matches existing infra).

### Test Groups

**Initialization**
- `init()` processes text, resets index to 0, sets isPlaying=false
- WPM clamped: below 100 → 100, above 600 → 600
- Empty text → words.length === 0

**Play/Pause**
- `play()` sets isPlaying=true
- `play()` at end of text resets index to 0
- `pause()` sets isPlaying=false
- `togglePlayPause()` alternates

**Tick Loop**
- `tick()` advances currentIndex by 1
- `tick()` returns `{ delay }` based on wpm and punctuation
- `tick()` at last word returns `{ done: true }`, auto-pauses
- `tick()` when not playing returns `{ done: true }`
- Punctuation pause: longer delay for `.!?` words when enabled
- Punctuation pause disabled: uniform delay

**Sentence Navigation**
- `prevSentence()` moves to start of current sentence
- `prevSentence()` at sentence start moves to previous sentence
- `prevSentence()` at index 0 stays at 0
- `nextSentence()` jumps to next sentence boundary
- `nextSentence()` at last sentence stays put
- Both pause playback

**WPM Adjustment**
- `adjustWpm(25)` increments, returns new value
- `adjustWpm(-25)` decrements, returns new value
- Clamps at 100 (floor) and 600 (ceiling)

**Read-Only Accessors**
- `currentWord()` returns split `{ before, focus, after }`
- `progress()` returns correct percentage at various positions
- `contextSentence()` returns words in current sentence with highlight index

## What This Does NOT Change

- `_createDOM()` — untouched
- `_bindEvents()` — untouched
- `overlay.css` — untouched
- `content.js` — untouched (interacts with overlay's public API, not state machine)
- Existing `word-processor.test.js` and `focus-point.test.js` — untouched
- `scripts/regression-test.sh` — remains the integration safety net

## Dependencies

- No new npm packages
- No new test frameworks
- Existing `node:test` runner auto-discovers new test file via `tests/js/*.test.js` glob
