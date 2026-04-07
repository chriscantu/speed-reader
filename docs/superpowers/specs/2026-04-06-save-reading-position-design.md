# Save Reading Position Per URL — Design Spec

**Issue**: #15
**Date**: 2026-04-06
**Status**: Draft

## Problem Statement

**User**: Neurodivergent readers (ADHD, dyslexia) using SpeedReader for long-form web articles
**Problem**: When the overlay is closed — intentionally or accidentally (tab closed, page refreshed, phone locked) — the reading position is lost. Users must reopen and manually scrub through potentially thousands of words to find their place.
**Impact**: Discourages returning to articles. ADHD readers are especially likely to read in multiple short sessions, and the scrubbing friction punishes that pattern.
**Evidence**: Direct personal experience. Every media player (podcasts, audiobooks, video) persists position because losing your place is universally frustrating.

## Approach

`browser.storage.local` with LRU eviction. Local-only for v1 — cross-device sync via `browser.storage.sync` is a future roadmap item.

### Why local, not sync

- `browser.storage.sync` has a 100KB total quota shared with settings — position data could pressure it
- The primary pain is same-device resume; cross-device is nice-to-have
- Local-only is simpler and leaves a clean upgrade path

## Data Model

Single storage key `readingPositions` in `browser.storage.local`, holding an object keyed by normalized URL:

```json
{
  "readingPositions": {
    "https://example.com/article-slug": {
      "index": 347,
      "total": 2891,
      "textHash": "a1b2c3d4",
      "timestamp": 1712400000
    }
  }
}
```

| Field | Type | Purpose |
|-------|------|---------|
| `index` | number | Saved word index (`state.currentIndex`) |
| `total` | number | Total word count (sanity check on restore) |
| `textHash` | string | Hash of first+last 100 chars of extracted text — detects content drift |
| `timestamp` | number | Epoch seconds — used for LRU eviction |

### LRU Eviction

Cap at 100 entries. When saving would exceed the cap, evict the oldest by `timestamp`. At ~100 bytes per entry, 100 entries is ~10KB — well within `browser.storage.local` quota.

## URL Normalization

Same article must map to the same storage key regardless of tracking params or fragments.

**Rules:**
1. Strip fragment (`#section2` removed)
2. Strip known tracking query params (`utm_*`, `ref`, `source`, `fbclid`, `gclid`)
3. Strip trailing slash (`/article/` becomes `/article`)
4. Preserve non-tracking query params (`?page=2`, `?id=123`) — some sites use these for content identity

```
normalizeUrl("https://example.com/article?utm_source=twitter&page=2#comments")
→ "https://example.com/article?page=2"
```

## Text Hashing

**Strategy**: Hash the first 100 + last 100 characters of the extracted text using a simple string hash (djb2 or similar).

**Rationale**: Catches complete content replacement and major rewrites. Minor mid-article edits won't invalidate the position, which is acceptable — the saved position is likely still close enough.

Full-text hashing is unnecessary overhead. Word count alone is too coarse (different articles with the same word count would falsely match).

## Save Behavior

**Triggers:**
1. **On pause** — most reliable signal of "stopping here"
2. **On close** — `overlay.close()` saves before teardown
3. **Periodic auto-save** — every 30 seconds during playback, as a safety net for tab kills, page unloads, and phone locks where `close()` never fires

**Do NOT save when:**
- `currentIndex === 0` (user never started)
- Playback reached the end (`done === true`) — clear the entry instead

**Save flow:**
```
pause() / close() / 30s interval
  → readingPosition.save(url, text, currentIndex, totalWords)
    → normalize url internally (normalizeUrl)
    → hash text internally (hashText)
    → read readingPositions from storage.local
    → upsert entry with new index + timestamp
    → evict oldest if count > 100
    → write back to storage.local
```

Callers pass raw URL and raw text. Normalization and hashing are internal to `reading-position.js`.

## Restore Behavior

**When**: During `overlay.open()`, after `state.init()` (words array populated) but before first render.

**Restore flow:**
```
overlay.open(text, title, settings, url)
  → state.init(text, settings)
  → readingPosition.restore(url, text)
    → normalize url internally (normalizeUrl)
    → hash text internally (hashText)
    → read readingPositions from storage.local
    → find entry matching normalized URL
    → validate: textHash matches AND index < total words
    → return savedIndex or null
  → if savedIndex: state.seekTo(savedIndex)
  → _createDOM(), _renderWord(), _updateProgress()
```

`content.js` passes the raw `window.location.href` and raw extracted text. The `reading-position.js` module handles normalization and hashing internally — callers never deal with normalized URLs or hashes directly.

**On hash mismatch or invalid index**: Silently discard. Start from the beginning. The article changed; the old position is meaningless.

**On successful restore**: Overlay opens at the saved position. Scrubber, time elapsed, and time remaining all reflect the restored position. No toast, no prompt — seamless auto-resume.

**On playback complete**: Delete the entry for that URL so the next open starts fresh.

## Resume UX

Auto-resume silently. The overlay opens at the saved position with no prompt or notification. The scrubber position communicates where the user is. To start over, the user scrubs to the beginning.

This matches the mental model from podcast and audiobook players — pick up where you left off with zero friction.

## Module Structure

### New file: `rsvp/reading-position.js`

Pure functions (except storage I/O):

- `normalizeUrl(url)` — URL normalization (exported for testability, not used by callers)
- `hashText(text)` — first+last 100 chars to hash string (exported for testability, not used by callers)
- `save(url, text, index, total)` — normalize + hash internally, upsert entry + LRU eviction
- `restore(url, text)` — normalize + hash internally, returns saved index or null
- `clear(url)` — normalize internally, removes entry (called on playback complete)

### Modified files

| File | Change |
|------|--------|
| `overlay.js` | Import `reading-position.js`. Call `save()` in `pause()`, `close()`, and 30s auto-save timer in `_startLoop()`. Call `clear()` when `tick()` returns `done`. |
| `content.js` | Pass `window.location.href` into `overlay.open()`. Call `restore()` after `state.init()`, before first render. |
| `manifest.json` | Add `rsvp/reading-position.js` to `web_accessible_resources` |

### Not modified

`state-machine.js`, `word-processor.js`, `background.js`, `settings-defaults.js`. Position persistence is an overlay concern. The state machine's existing `seekTo()` is the only interface needed.

## Tests

New file: `tests/js/reading-position.test.js`

Coverage:
- URL normalization (tracking params, fragments, trailing slash, preserved params)
- Text hashing (same text = same hash, different text = different hash)
- Save/restore round-trip
- Hash mismatch returns null
- Index out of bounds returns null
- LRU eviction at cap
- Clear removes entry
- Save skipped when index is 0

## Future: Cross-Device Sync

Not in scope for v1. Roadmap item: sync the N most recent positions to `browser.storage.sync` for cross-device resume. Design the `reading-position.js` API so the storage backend can be swapped without changing call sites.
