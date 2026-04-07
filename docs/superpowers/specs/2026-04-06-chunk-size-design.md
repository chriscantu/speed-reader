# Configurable Chunk Size — Design Spec

**Issue:** #18 — Configurable chunk size (1, 2, or 3 words at a time)
**Date:** 2026-04-06

## Problem Statement

**User**: Neurodivergent readers (ADHD, dyslexia) using SpeedReader's RSVP mode on iOS/iPadOS/macOS Safari.

**Problem**: SpeedReader presents text one word at a time with no option to adjust chunk size. For readers who process phrase-level units more naturally — or who find single-word flashing at higher speeds overwhelming — the fixed single-word presentation reduces comprehension and comfort, with no way to adapt.

**Impact**: Comprehension drops sharply above 300 WPM with single-word RSVP (Castelhano & Muter, Öquist & Lundin). Users who don't click with single-word mode have no fallback — they either tolerate a suboptimal experience or stop using the app entirely.

**Evidence**: Academic research (Castelhano & Muter 2001, Öquist & Lundin 2007, Benedetto et al. 2015, Schneps et al. 2013) consistently supports 2-3 word chunks for improved comprehension. Competitor apps (Spreeder, SwiftRead, Reedy, AccelaReader, Jetzt) all offer this feature — it is table stakes on desktop/Android but largely absent on iOS.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| WPM semantics | Word rate stays constant | 250 WPM always means 250 individual words/min. A 2-word chunk displays for 2x base delay. Chunks affect comfort, not speed. Matches Spreeder/SwiftRead behavior. |
| Sentence boundaries | Chunks break at sentence ends | Never cross `.!?` boundary in a single chunk. Preserves sentence-level comprehension. Leverages existing `sentenceStart` markers in word-processor output. |
| ORP highlighting | Active in 1-word mode only; disabled (plain text) in chunk mode | Eye-tracking research (Inhoff & Rayner 1986, Drieghe et al. 2005) shows readers process 2-3 word phrases as perceptual units, not word-by-word. Per-word ORP adds visual noise without cognitive benefit. All competitor apps disable ORP in multi-word mode. |
| Default chunk size | 1 word | Preserves current experience. New feature is opt-in. |
| First-use tip | One-time dismissible banner | Points users to "Words per flash" setting. Dismissed on tap or first play. Stored in `browser.storage.sync`. |
| Settings UI | Segmented control: `1 \| 2 \| 3` | Standard iOS pattern for small fixed sets. Labeled "Words per flash". |
| Architecture | Dedicated `chunk-builder.js` module | Single responsibility — separates content shaping from playback control. Pure function, independently testable. State machine consumes chunks, not raw words. |

## Architecture

### Module Pipeline

```
processText(text) → words[]
       ↓
buildChunks(words, chunkSize) → chunks[]
       ↓
RSVPStateMachine (ticks through chunks)
       ↓
RSVPOverlay (renders ORP or plain text based on chunk mode)
```

### New Module: `chunk-builder.js`

Pure-function module between word-processor and state machine.

**Interface:**

```js
buildChunks(words, chunkSize) → chunk[]
```

- `words`: array from `processText()` — `[{text, index, sentenceStart}, ...]`
- `chunkSize`: 1, 2, or 3
- Returns: array of chunk objects

**Chunk object shape:**

```js
{
  words: [{text, index, sentenceStart}, ...],  // 1 to chunkSize word objects
  startIndex: 0,     // index of first word in original words array
  endIndex: 2,       // index of last word (inclusive)
  text: "the beautiful sunset"  // pre-joined display string
}
```

**Rules:**
- Each chunk contains up to `chunkSize` words
- Chunks never cross sentence boundaries (if `words[i+1].sentenceStart`, end chunk at `words[i]`)
- Final chunk may be shorter than `chunkSize`
- When `chunkSize` is 1, output is 1:1 with input (backward compatible)

### State Machine Changes

**New properties:**
- `chunkSize` — from settings, default 1
- `chunks` — array from `buildChunks()`
- `chunkIndex` — current position in chunk array

**`init(text, settings)`:**
- Calls `processText(text)` as before (stores as `this.words`)
- Calls `buildChunks(this.words, this.chunkSize)` (stores as `this.chunks`)

**`tick()`:**
- Advances `chunkIndex` by 1
- Delay: `baseDelay * chunk.words.length` — proportional to word count in chunk (constant WPM)
- Punctuation pause applies to **last word** in chunk only

**`currentDisplay()`** (replaces `currentWord()`):

- `chunkSize === 1`: returns `{before, focus, after, isChunk: false}` — ORP active
- `chunkSize > 1`: returns `{text: chunk.text, isChunk: true}` — plain text
- Overlay switches rendering path based on `isChunk`

**Sentence navigation:**
- `prevSentence()`/`nextSentence()` find the chunk whose first word has `sentenceStart === true`

**`seekTo(wordIndex)`:**
- Accepts word-level index (scrubber operates in word-space)
- Maps to the chunk containing that word index

**`progress()`, `timeElapsed()`, `timeRemaining()`:**
- Computed from word-level position (`chunk.startIndex` mapped to word count)
- WPM math unchanged

**`contextSentence()`:**
- Returns `highlightRange: {start, end}` instead of single `highlightIndex` for multi-word chunks

**Backward compatibility invariant:** When `chunkSize === 1`, every chunk has one word, `chunkIndex` tracks the same position as `currentIndex` did, and `currentDisplay()` returns ORP-split output. Behavior is identical to current code.

### Overlay Rendering Changes

**Dual rendering path in `_renderDisplay()`:**

- `isChunk === true`: Hide ORP spans (`wordBefore`, `wordFocus`, `wordAfter`). Show new `<span class="sr-chunk-text">` with plain text.
- `isChunk === false`: Hide chunk span. Show ORP spans as before.

**New DOM element:** `<span class="sr-chunk-text">` inside `wordContainer`. Styled to match existing word color (no accent highlight). Hidden when `chunkSize === 1`.

**Context preview (`_showContext()`):**
- Multi-word chunks: highlights all words in the current chunk range
- Uses `highlightRange` from `contextSentence()` to wrap range in highlight spans

**Scrubber:** Unchanged — still operates in word-space (0 to `words.length - 1`). `seekTo()` maps to chunks internally.

**`_scaleWordToFit()`:** No change needed — already handles overflow by measuring `scrollWidth` vs container width. Multi-word chunks are wider, so scaling kicks in more often naturally.

**Alignment:** ORP alignment mode (`data-alignment="orp"`) only applies when `chunkSize === 1`. When `isChunk` is true, overlay renders centered regardless of alignment setting. No new setting needed.

### Settings Infrastructure

**JS — `settings-defaults.js`:**

```js
export const CHUNK_SIZE_DEFAULT = 1;
export const CHUNK_SIZE_MIN = 1;
export const CHUNK_SIZE_MAX = 3;
```

Add `'chunkSize'` to `SETTINGS_KEYS` and `SETTINGS_DEFAULTS`. Add `clampChunkSize()` validator.

**Swift — `SettingsKeys.swift`:**

- Key: `static let chunkSize = "sr_chunkSize"`
- Default: `static let chunkSize = 1`
- Bounds: `chunkSizeMin = 1`, `chunkSizeMax = 3`
- Add to `saveSettings()` with `Int` type check and clamping

**Settings UI (Swift companion app):**

- Segmented control labeled "Words per flash" with segments `1 | 2 | 3`
- Placed below Speed (WPM) control, above Text Size
- Bound to `chunkSize` in UserDefaults via App Group

**Live update:** `overlay.updateSettings()` accepts `chunkSize`. If changed mid-session, state machine rebuilds chunks from the same word array, maps current word position to nearest chunk, and pauses. User resumes manually.

### One-Time Tip

**Trigger:** First overlay open after feature ships.

**Storage:** `sr_chunkSizeTipSeen` boolean in `browser.storage.sync` (JS-side only, not in App Group).

**Display:** Dismissible banner below word area, above controls:

```
 Tip: Try reading 2-3 words at a time.
 Change "Words per flash" in Settings.
                                [Got it]
```

- Appears in paused state before first play
- Dismisses on "Got it" tap or when playback starts
- Sets flag to `true` on dismiss — never shows again
- Styled in shadow DOM, respects current theme

## Edge Cases

**Short text (fewer words than chunk size):** `buildChunks()` returns whatever words exist. No padding, no error.

**Empty text:** `buildChunks([])` returns `[]`. State machine handles identically to empty words.

**Chunk size changed mid-session:** Rebuild chunks, map position, pause. User resumes.

**Sentence boundary at position 1 of a would-be chunk:** Chunk ends at word before boundary (may produce 1-word chunk). Next chunk starts the new sentence.

**Reading position save/restore:** Positions saved as word-level indices. Valid regardless of chunk size changes between sessions. `seekTo()` maps word index to chunk.

**Alignment interaction:** ORP alignment applies only when `chunkSize === 1`. Chunk mode always centers. No new setting.

## Testing Strategy

### New: `chunk-builder.test.js`
- Chunks words correctly for sizes 1, 2, 3
- Respects sentence boundaries (never crosses `.!?`)
- Handles short final chunks
- Empty input returns empty array
- Single-word input with any chunk size
- Chunk `text` field correctly joined with spaces

### Additions to `state-machine.test.js`
- `chunkSize=1` identical to current behavior (backward compat)
- `tick()` with `chunkSize=2` returns delay = `baseDelay * 2`
- Punctuation pause applies to last word in chunk only
- `prevSentence()`/`nextSentence()` navigate by chunk boundaries
- `seekTo(wordIndex)` maps correctly to chunk position
- `currentDisplay()` returns `isChunk: true` with plain text for chunk sizes > 1
- `currentDisplay()` returns ORP split for chunk size 1
- `contextSentence()` returns highlight range for multi-word chunks
- Progress/time calculations still word-based

### Overlay regression tests
- Chunk text element visible when `chunkSize > 1`, hidden when 1
- ORP spans visible when `chunkSize === 1`, hidden when > 1
- Tip banner shows on first open, dismissed on tap, never shows again
- Alignment falls back to center in chunk mode
- Scrubber operates in word-space

### Settings tests
- `clampChunkSize()` clamps to 1-3 range
- Invalid input (string, NaN, 0, 4) falls back to default
- Swift `saveSettings()` persists and clamps chunk size
