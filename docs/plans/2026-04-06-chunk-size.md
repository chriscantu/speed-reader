# Configurable Chunk Size Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to display 1, 2, or 3 words at a time during RSVP playback, with sentence-boundary-aware chunking and a one-time feature tip.

**Architecture:** New `chunk-builder.js` module produces chunks from word arrays. State machine consumes chunks instead of raw words, ticking one chunk per frame with proportional delay. Overlay renders ORP for single-word mode, plain text for chunk mode. Settings flow through JS defaults + Swift SettingsKeys + SwiftUI companion app.

**Tech Stack:** JavaScript (ES modules, Node.js test runner), Swift/SwiftUI, Safari Web Extension APIs

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `SpeedReader/SpeedReaderExtension/Resources/rsvp/chunk-builder.js` | Create | Pure function: `buildChunks(words, chunkSize) → chunk[]` |
| `tests/js/chunk-builder.test.js` | Create | Unit tests for chunk building |
| `SpeedReader/SpeedReaderExtension/Resources/rsvp/settings-defaults.js` | Modify | Add `CHUNK_SIZE_*` constants, `clampChunkSize()`, update `SETTINGS_KEYS`/`SETTINGS_DEFAULTS` |
| `tests/js/settings-defaults.test.js` | Modify | Add `clampChunkSize()` tests |
| `SpeedReader/SpeedReaderExtension/Resources/rsvp/state-machine.js` | Modify | Consume chunks, add `currentDisplay()`, chunk-aware navigation |
| `tests/js/state-machine.test.js` | Modify | Add chunk-mode tests |
| `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js` | Modify | Dual render path, tip banner, chunk-aware context |
| `SpeedReader/SpeedReaderExtension/Resources/content.js` | Modify | Add `chunkSize` to `settingsDefaults` and test query hook |
| `SpeedReader/SpeedReaderExtension/Resources/manifest.json` | Modify | Register `chunk-builder.js` in `web_accessible_resources` |
| `SpeedReader/Shared/SettingsKeys.swift` | Modify | Add `chunkSize` key, defaults, bounds, `saveSettings()` |
| `SpeedReader/SpeedReader/Models/Settings.swift` | Modify | Add `chunkSize` property, setter, load logic |
| `SpeedReader/SpeedReader/Views/SettingsView.swift` | Modify | Add "Words per flash" segmented control |

---

### Task 1: Settings defaults — JS side

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/settings-defaults.js`
- Modify: `tests/js/settings-defaults.test.js`

- [ ] **Step 1: Write failing tests for `clampChunkSize()`**

Add to `tests/js/settings-defaults.test.js`:

```js
describe('clampChunkSize', () => {
  it('returns default for non-number input', () => {
    assert.strictEqual(clampChunkSize('two'), 1);
    assert.strictEqual(clampChunkSize(NaN), 1);
    assert.strictEqual(clampChunkSize(undefined), 1);
  });

  it('clamps below minimum to 1', () => {
    assert.strictEqual(clampChunkSize(0), 1);
    assert.strictEqual(clampChunkSize(-1), 1);
  });

  it('clamps above maximum to 3', () => {
    assert.strictEqual(clampChunkSize(4), 3);
    assert.strictEqual(clampChunkSize(99), 3);
  });

  it('accepts valid values', () => {
    assert.strictEqual(clampChunkSize(1), 1);
    assert.strictEqual(clampChunkSize(2), 2);
    assert.strictEqual(clampChunkSize(3), 3);
  });
});
```

Update the import at the top of the file to include `clampChunkSize`, `CHUNK_SIZE_DEFAULT`, `CHUNK_SIZE_MIN`, `CHUNK_SIZE_MAX`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/js/settings-defaults.test.js`
Expected: FAIL — `clampChunkSize` is not exported

- [ ] **Step 3: Implement settings constants and clampChunkSize**

Add to `settings-defaults.js` after the existing `FONT_SIZE_STEP` line:

```js
export const CHUNK_SIZE_DEFAULT = 1;
export const CHUNK_SIZE_MIN = 1;
export const CHUNK_SIZE_MAX = 3;
```

Add `'chunkSize'` to `SETTINGS_KEYS`:

```js
export const SETTINGS_KEYS = ['wpm', 'font', 'theme', 'fontSize', 'punctuationPause', 'alignment', 'chunkSize'];
```

Add `chunkSize: CHUNK_SIZE_DEFAULT` to `SETTINGS_DEFAULTS`.

Add the clamp function after `validateAlignment`:

```js
export function clampChunkSize(value) {
  if (typeof value !== 'number' || isNaN(value)) return CHUNK_SIZE_DEFAULT;
  return Math.max(CHUNK_SIZE_MIN, Math.min(CHUNK_SIZE_MAX, value));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/js/settings-defaults.test.js`
Expected: All tests PASS

- [ ] **Step 5: Lint**

Run: `make lint-js`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/settings-defaults.js tests/js/settings-defaults.test.js
git commit -m "Add chunkSize settings constants and clampChunkSize validator (#18)"
```

---

### Task 2: Chunk builder module

**Files:**
- Create: `SpeedReader/SpeedReaderExtension/Resources/rsvp/chunk-builder.js`
- Create: `tests/js/chunk-builder.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/js/chunk-builder.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildChunks } from '../../SpeedReader/SpeedReaderExtension/Resources/rsvp/chunk-builder.js';

describe('buildChunks', () => {

  // Helper: create word objects matching processText() output shape
  function words(texts) {
    let nextIsSentenceStart = true;
    return texts.map((text, index) => {
      const entry = { text, index, sentenceStart: nextIsSentenceStart };
      nextIsSentenceStart = /[.!?]$/.test(text);
      return entry;
    });
  }

  describe('chunkSize = 1', () => {
    it('produces one chunk per word', () => {
      const w = words(['Hello', 'world.']);
      const chunks = buildChunks(w, 1);
      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(chunks[0].text, 'Hello');
      assert.strictEqual(chunks[0].startIndex, 0);
      assert.strictEqual(chunks[0].endIndex, 0);
      assert.strictEqual(chunks[1].text, 'world.');
      assert.strictEqual(chunks[1].startIndex, 1);
      assert.strictEqual(chunks[1].endIndex, 1);
    });
  });

  describe('chunkSize = 2', () => {
    it('groups words into pairs', () => {
      const w = words(['The', 'quick', 'brown', 'fox.']);
      const chunks = buildChunks(w, 2);
      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(chunks[0].text, 'The quick');
      assert.strictEqual(chunks[0].startIndex, 0);
      assert.strictEqual(chunks[0].endIndex, 1);
      assert.strictEqual(chunks[1].text, 'brown fox.');
      assert.strictEqual(chunks[1].startIndex, 2);
      assert.strictEqual(chunks[1].endIndex, 3);
    });

    it('handles odd word count with shorter final chunk', () => {
      const w = words(['One', 'two', 'three.']);
      const chunks = buildChunks(w, 2);
      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(chunks[0].text, 'One two');
      assert.strictEqual(chunks[1].text, 'three.');
      assert.strictEqual(chunks[1].words.length, 1);
    });
  });

  describe('chunkSize = 3', () => {
    it('groups words into triples', () => {
      const w = words(['The', 'quick', 'brown', 'fox', 'jumps', 'over.']);
      const chunks = buildChunks(w, 3);
      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(chunks[0].text, 'The quick brown');
      assert.strictEqual(chunks[1].text, 'fox jumps over.');
    });
  });

  describe('sentence boundaries', () => {
    it('breaks chunk at sentence boundary', () => {
      const w = words(['Hello', 'world.', 'Goodbye', 'world.']);
      const chunks = buildChunks(w, 3);
      // "Hello world." is one chunk (2 words, shorter than 3 because sentence ends)
      // "Goodbye world." is another chunk
      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(chunks[0].text, 'Hello world.');
      assert.strictEqual(chunks[0].words.length, 2);
      assert.strictEqual(chunks[1].text, 'Goodbye world.');
      assert.strictEqual(chunks[1].words.length, 2);
    });

    it('produces single-word chunk when sentence is one word', () => {
      const w = words(['Stop.', 'Go.']);
      const chunks = buildChunks(w, 3);
      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(chunks[0].text, 'Stop.');
      assert.strictEqual(chunks[1].text, 'Go.');
    });

    it('handles sentence boundary at position 2 of a 3-word chunk', () => {
      // "A B. C D E." — chunk size 3
      // Chunk 1: "A B." (sentence ends at B)
      // Chunk 2: "C D E."
      const w = words(['A', 'B.', 'C', 'D', 'E.']);
      const chunks = buildChunks(w, 3);
      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(chunks[0].text, 'A B.');
      assert.strictEqual(chunks[1].text, 'C D E.');
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty input', () => {
      assert.deepStrictEqual(buildChunks([], 2), []);
    });

    it('handles single word', () => {
      const w = words(['Hello.']);
      const chunks = buildChunks(w, 3);
      assert.strictEqual(chunks.length, 1);
      assert.strictEqual(chunks[0].text, 'Hello.');
    });

    it('chunk words array contains references to original word objects', () => {
      const w = words(['The', 'cat.']);
      const chunks = buildChunks(w, 2);
      assert.strictEqual(chunks[0].words[0], w[0]);
      assert.strictEqual(chunks[0].words[1], w[1]);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/js/chunk-builder.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `buildChunks()`**

Create `SpeedReader/SpeedReaderExtension/Resources/rsvp/chunk-builder.js`:

```js
/**
 * Groups word objects into display chunks, respecting sentence boundaries.
 *
 * @param {Array<{text: string, index: number, sentenceStart: boolean}>} words
 * @param {number} chunkSize - 1, 2, or 3
 * @returns {Array<{words: Array, startIndex: number, endIndex: number, text: string}>}
 */
export function buildChunks(words, chunkSize) {
  if (words.length === 0) return [];

  const chunks = [];
  let i = 0;

  while (i < words.length) {
    const chunkWords = [words[i]];
    let j = i + 1;

    while (chunkWords.length < chunkSize && j < words.length) {
      // Stop before a sentence start — don't cross sentence boundaries
      if (words[j].sentenceStart) break;
      chunkWords.push(words[j]);
      j++;
    }

    chunks.push({
      words: chunkWords,
      startIndex: chunkWords[0].index,
      endIndex: chunkWords[chunkWords.length - 1].index,
      text: chunkWords.map(w => w.text).join(' '),
    });

    i = j;
  }

  return chunks;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/js/chunk-builder.test.js`
Expected: All tests PASS

- [ ] **Step 5: Lint**

Run: `make lint-js`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/chunk-builder.js tests/js/chunk-builder.test.js
git commit -m "Add chunk-builder module with sentence-boundary-aware grouping (#18)"
```

---

### Task 3: State machine — chunk integration

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/state-machine.js`
- Modify: `tests/js/state-machine.test.js`

- [ ] **Step 1: Write failing tests for chunk mode**

Add to `tests/js/state-machine.test.js`. Add this new `describe` block after the existing `contextSentence` describe:

```js
describe('chunk mode (chunkSize > 1)', () => {

  describe('init with chunkSize', () => {
    it('builds chunks from words', () => {
      const sm = new RSVPStateMachine();
      sm.init('The quick brown fox.', { chunkSize: 2 });
      assert.strictEqual(sm.chunks.length, 2); // "The quick" + "brown fox."
      assert.strictEqual(sm.chunkIndex, 0);
    });

    it('defaults to chunkSize 1', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.');
      assert.strictEqual(sm.chunkSize, 1);
      assert.strictEqual(sm.chunks.length, 2); // one chunk per word
    });
  });

  describe('tick with chunks', () => {
    it('advances chunkIndex by 1', () => {
      const sm = new RSVPStateMachine();
      sm.init('The quick brown fox.', { wpm: 250, chunkSize: 2 });
      sm.play();
      const result = sm.tick();
      assert.strictEqual(sm.chunkIndex, 1);
      assert.strictEqual(result.done, undefined);
    });

    it('returns delay proportional to words in chunk', () => {
      const sm = new RSVPStateMachine();
      sm.init('The quick brown fox.', { wpm: 250, chunkSize: 2 });
      sm.play();
      const result = sm.tick();
      // 2-word chunk: baseDelay (240) * 2 = 480
      assert.strictEqual(result.delay, 480);
    });

    it('applies punctuation pause to last word in chunk only', () => {
      const sm = new RSVPStateMachine();
      // "Hello world." is one 2-word chunk, last word has period
      sm.init('Hello world.', { wpm: 250, chunkSize: 2, punctuationPause: true });
      sm.play();
      const result = sm.tick();
      // baseDelay=240, 2 words=480, period on last word=480*1.5=720
      assert.strictEqual(result.delay, Math.round(480 * 1.5));
    });

    it('returns done at last chunk', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { chunkSize: 2 });
      sm.play();
      // Only one chunk: "Hello world."
      const result = sm.tick();
      assert.strictEqual(result.done, true);
      assert.strictEqual(sm.isPlaying, false);
    });
  });

  describe('currentDisplay', () => {
    it('returns isChunk false with ORP split for chunkSize 1', () => {
      const sm = new RSVPStateMachine();
      sm.init('Reading.', { chunkSize: 1 });
      const d = sm.currentDisplay();
      assert.strictEqual(d.isChunk, false);
      assert.strictEqual(typeof d.before, 'string');
      assert.strictEqual(typeof d.focus, 'string');
      assert.strictEqual(typeof d.after, 'string');
    });

    it('returns isChunk true with plain text for chunkSize 2', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { chunkSize: 2 });
      const d = sm.currentDisplay();
      assert.strictEqual(d.isChunk, true);
      assert.strictEqual(d.text, 'Hello world.');
    });

    it('returns empty display past end', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hi.', { chunkSize: 2 });
      sm.chunkIndex = sm.chunks.length;
      const d = sm.currentDisplay();
      assert.strictEqual(d.isChunk, false);
      assert.strictEqual(d.before, '');
      assert.strictEqual(d.focus, '');
      assert.strictEqual(d.after, '');
    });
  });

  describe('sentence navigation with chunks', () => {
    it('prevSentence jumps to chunk containing previous sentence start', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.', { chunkSize: 2 });
      sm.play();
      // chunks: ["First sentence."], ["Second sentence."]
      sm.chunkIndex = 1;
      sm.prevSentence();
      assert.strictEqual(sm.chunkIndex, 0);
    });

    it('nextSentence jumps to chunk containing next sentence start', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.', { chunkSize: 2 });
      sm.play();
      sm.chunkIndex = 0;
      sm.nextSentence();
      assert.strictEqual(sm.chunkIndex, 1);
    });
  });

  describe('seekTo with chunks', () => {
    it('maps word index to correct chunk', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three four.', { chunkSize: 2 });
      // chunks: ["One two"], ["three four."]
      sm.seekTo(2); // word "three" is in chunk 1
      assert.strictEqual(sm.chunkIndex, 1);
    });

    it('maps word index 0 to chunk 0', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three four.', { chunkSize: 2 });
      sm.seekTo(0);
      assert.strictEqual(sm.chunkIndex, 0);
    });
  });

  describe('progress with chunks', () => {
    it('reports word-level progress not chunk-level', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three four.', { chunkSize: 2 });
      sm.chunkIndex = 1; // chunk 1 starts at word index 2
      const p = sm.progress();
      assert.strictEqual(p.current, 2); // word index, not chunk index
      assert.strictEqual(p.total, 4);
      assert.strictEqual(p.percent, 50);
    });
  });

  describe('timeElapsed and timeRemaining with chunks', () => {
    it('computes from word position not chunk position', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three four.', { wpm: 240, chunkSize: 2 });
      sm.chunkIndex = 1; // word index 2
      // elapsed: ceil(2/240*60) = ceil(0.5) = 1
      assert.strictEqual(sm.timeElapsed(), 1);
      // remaining: ceil(2/240*60) = ceil(0.5) = 1
      assert.strictEqual(sm.timeRemaining(), 1);
    });
  });

  describe('contextSentence with chunks', () => {
    it('returns highlightRange for multi-word chunk', () => {
      const sm = new RSVPStateMachine();
      sm.init('The quick brown fox.', { chunkSize: 2 });
      // chunk 0: "The quick" (words 0-1), chunk 1: "brown fox." (words 2-3)
      sm.chunkIndex = 0;
      const ctx = sm.contextSentence();
      assert.deepStrictEqual(ctx.highlightRange, { start: 0, end: 1 });
    });

    it('returns single highlightIndex for chunkSize 1', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { chunkSize: 1 });
      sm.chunkIndex = 0;
      const ctx = sm.contextSentence();
      assert.strictEqual(ctx.highlightIndex, 0);
      assert.strictEqual(ctx.highlightRange, undefined);
    });
  });

  describe('backward compatibility (chunkSize 1)', () => {
    it('tick advances same as before', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world again.', { wpm: 250, chunkSize: 1 });
      sm.play();
      const result = sm.tick();
      assert.strictEqual(sm.chunkIndex, 1);
      assert.strictEqual(result.delay, 240); // single word, baseDelay * 1
    });

    it('currentDisplay returns ORP split', () => {
      const sm = new RSVPStateMachine();
      sm.init('Reading.', { chunkSize: 1 });
      const d = sm.currentDisplay();
      assert.strictEqual(d.isChunk, false);
      assert.strictEqual(d.before, 'Re');
      assert.strictEqual(d.focus, 'a');
      assert.strictEqual(d.after, 'ding.');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/js/state-machine.test.js`
Expected: FAIL — `chunks` property undefined, `currentDisplay` not a function

- [ ] **Step 3: Implement chunk integration in state machine**

Replace the full contents of `state-machine.js` with the chunk-aware version. Key changes from current code:

1. Import `buildChunks` and `clampChunkSize`:

```js
import { processText, calculateDelay, wpmToDelay } from './word-processor.js';
import { splitWordAtFocus } from './focus-point.js';
import { WPM_DEFAULT, CHUNK_SIZE_DEFAULT, clampWpm, clampChunkSize } from './settings-defaults.js';
import { buildChunks } from './chunk-builder.js';
```

2. Constructor adds new properties:

```js
constructor() {
  this.words = [];
  this.chunks = [];
  this.chunkIndex = 0;
  this.chunkSize = CHUNK_SIZE_DEFAULT;
  this.isPlaying = false;
  this.wpm = WPM_DEFAULT;
  this.punctuationPause = true;
}
```

3. `init()` builds chunks:

```js
init(text, settings = {}) {
  this.words = processText(text);
  this.chunkSize = clampChunkSize(settings.chunkSize ?? CHUNK_SIZE_DEFAULT);
  this.chunks = buildChunks(this.words, this.chunkSize);
  this.chunkIndex = 0;
  this.isPlaying = false;
  this.wpm = clampWpm(settings.wpm ?? WPM_DEFAULT);
  this.punctuationPause = settings.punctuationPause ?? true;
}
```

4. `play()` resets based on chunks:

```js
play() {
  if (this.chunkIndex >= this.chunks.length) {
    this.chunkIndex = 0;
  }
  this.isPlaying = true;
}
```

5. `tick()` uses chunks with proportional delay:

```js
tick() {
  if (!this.isPlaying || this.chunkIndex >= this.chunks.length) {
    if (this.chunkIndex >= this.chunks.length) {
      this.pause();
    }
    return { done: true };
  }

  const chunk = this.chunks[this.chunkIndex];
  const baseDelay = wpmToDelay(this.wpm);
  let delay = baseDelay * chunk.words.length;

  if (this.punctuationPause) {
    const lastWord = chunk.words[chunk.words.length - 1].text;
    const lastChar = lastWord[lastWord.length - 1];
    if ('.!?'.includes(lastChar)) {
      delay = Math.round(delay * 1.5);
    } else if (',:;'.includes(lastChar)) {
      delay = Math.round(delay * 1.2);
    }
  }

  this.chunkIndex++;

  if (this.chunkIndex >= this.chunks.length) {
    this.pause();
    return { done: true, delay };
  }

  return { delay };
}
```

6. `currentDisplay()` replaces `currentWord()`:

```js
currentDisplay() {
  if (this.chunkIndex >= this.chunks.length) {
    return { before: '', focus: '', after: '', isChunk: false };
  }

  const chunk = this.chunks[this.chunkIndex];
  if (this.chunkSize > 1) {
    return { text: chunk.text, isChunk: true };
  }

  const parts = splitWordAtFocus(chunk.words[0].text);
  return { before: parts.before, focus: parts.focus, after: parts.after, isChunk: false };
}
```

Keep `currentWord()` as an alias for backward compatibility with overlay code until Task 5 updates it:

```js
currentWord() {
  const d = this.currentDisplay();
  if (d.isChunk) return { before: '', focus: '', after: '' };
  return { before: d.before, focus: d.focus, after: d.after };
}
```

7. `prevSentence()` navigates chunks:

```js
prevSentence() {
  this.pause();
  let i = this.chunkIndex - 1;
  while (i > 0) {
    if (this.chunks[i].words[0].sentenceStart) break;
    i--;
  }
  this.chunkIndex = Math.max(0, i);
}
```

8. `nextSentence()` navigates chunks:

```js
nextSentence() {
  this.pause();
  let i = this.chunkIndex + 1;
  while (i < this.chunks.length) {
    if (this.chunks[i].words[0].sentenceStart) break;
    i++;
  }
  if (i < this.chunks.length) {
    this.chunkIndex = i;
  }
}
```

9. `seekTo()` maps word index to chunk:

```js
seekTo(index) {
  this.pause();
  if (!Number.isInteger(index)) return;
  if (this.words.length === 0) {
    this.chunkIndex = 0;
    return;
  }
  const wordIndex = Math.max(0, Math.min(index, this.words.length - 1));
  // Find the chunk containing this word index
  for (let i = 0; i < this.chunks.length; i++) {
    if (wordIndex >= this.chunks[i].startIndex && wordIndex <= this.chunks[i].endIndex) {
      this.chunkIndex = i;
      return;
    }
  }
  this.chunkIndex = this.chunks.length - 1;
}
```

10. `progress()`, `timeElapsed()`, `timeRemaining()` use word-level position via `_currentWordIndex()`:

```js
_currentWordIndex() {
  if (this.chunkIndex >= this.chunks.length) return this.words.length;
  return this.chunks[this.chunkIndex].startIndex;
}

timeElapsed() {
  if (this.words.length === 0) return 0;
  return Math.ceil((this._currentWordIndex() / this.wpm) * 60);
}

timeRemaining() {
  if (this.words.length === 0) return 0;
  const wordsLeft = this.words.length - this._currentWordIndex();
  if (wordsLeft <= 0) return 0;
  return Math.ceil((wordsLeft / this.wpm) * 60);
}

progress() {
  const total = this.words.length;
  const current = this._currentWordIndex();
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  return { percent, current, total };
}
```

11. `contextSentence()` returns highlight range for chunks:

```js
contextSentence() {
  if (this.chunkIndex >= this.chunks.length) {
    return { words: [], highlightIndex: -1 };
  }

  const chunk = this.chunks[this.chunkIndex];
  const wordIndex = chunk.startIndex;

  let sentenceStart = wordIndex;
  while (sentenceStart > 0 && !this.words[sentenceStart].sentenceStart) {
    sentenceStart--;
  }

  let sentenceEnd = wordIndex + 1;
  while (sentenceEnd < this.words.length && !this.words[sentenceEnd].sentenceStart) {
    sentenceEnd++;
  }

  const words = [];
  for (let i = sentenceStart; i < sentenceEnd; i++) {
    words.push(this.words[i].text);
  }

  const relativeStart = chunk.startIndex - sentenceStart;
  const relativeEnd = chunk.endIndex - sentenceStart;

  if (this.chunkSize === 1) {
    return { words, highlightIndex: relativeStart };
  }

  return { words, highlightRange: { start: relativeStart, end: relativeEnd } };
}
```

12. Add `rebuildChunks()` for mid-session chunk size changes:

```js
rebuildChunks(newChunkSize) {
  const wordIndex = this._currentWordIndex();
  this.chunkSize = clampChunkSize(newChunkSize);
  this.chunks = buildChunks(this.words, this.chunkSize);
  this.seekTo(wordIndex);
}
```

Also add a `currentIndex` getter for backward compatibility with overlay code that reads `state.currentIndex` (scrubber, content.js test hooks):

```js
get currentIndex() {
  return this._currentWordIndex();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/js/state-machine.test.js`
Expected: All tests PASS (both new chunk tests and existing tests)

- [ ] **Step 5: Lint**

Run: `make lint-js`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/state-machine.js tests/js/state-machine.test.js
git commit -m "Integrate chunk-builder into state machine with proportional delay (#18)"
```

---

### Task 4: Register chunk-builder.js in manifest

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/manifest.json`

- [ ] **Step 1: Add chunk-builder.js to web_accessible_resources**

In `manifest.json`, add `"chunk-builder.js"` to the resources array after `"reading-position.js"`:

```json
"resources": [
  "overlay.css",
  "overlay.js",
  "state-machine.js",
  "settings-defaults.js",
  "word-processor.js",
  "focus-point.js",
  "reading-position.js",
  "chunk-builder.js",
  "content-resolver.js",
  "Readability.js",
  "fonts/OpenDyslexic-Regular.woff2"
],
```

- [ ] **Step 2: Lint**

Run: `make lint-js`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/manifest.json
git commit -m "Register chunk-builder.js in manifest web_accessible_resources (#18)"
```

---

### Task 5: Overlay — dual rendering and chunk-aware context

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js`

- [ ] **Step 1: Add chunk text element to DOM creation**

In `_createDOM()`, after creating `wordAfter` and before `wordContainer.appendChild(wordBefore)`, add the chunk text span:

```js
const chunkText = document.createElement('span');
chunkText.className = 'sr-chunk-text';
chunkText.style.display = 'none';
this.elements.chunkText = chunkText;
```

Add it to `wordContainer` after the three ORP spans:

```js
wordContainer.appendChild(wordBefore);
wordContainer.appendChild(wordFocus);
wordContainer.appendChild(wordAfter);
wordContainer.appendChild(chunkText);
```

- [ ] **Step 2: Update `_renderWord()` to use `currentDisplay()`**

Replace the `_renderWord()` method:

```js
_renderWord() {
  const display = this.state.currentDisplay();

  if (display.isChunk) {
    // Chunk mode: hide ORP spans, show plain text
    if (this.elements.wordBefore) this.elements.wordBefore.textContent = '';
    if (this.elements.wordFocus) this.elements.wordFocus.textContent = '';
    if (this.elements.wordAfter) this.elements.wordAfter.textContent = '';
    if (this.elements.chunkText) {
      this.elements.chunkText.textContent = display.text;
      this.elements.chunkText.style.display = '';
    }
  } else {
    // ORP mode: hide chunk span, show split word
    if (this.elements.chunkText) this.elements.chunkText.style.display = 'none';
    if (this.elements.wordBefore) this.elements.wordBefore.textContent = display.before;
    if (this.elements.wordFocus) this.elements.wordFocus.textContent = display.focus;
    if (this.elements.wordAfter) this.elements.wordAfter.textContent = display.after;
  }

  this._scaleWordToFit();
}
```

- [ ] **Step 3: Update `_showContext()` for chunk highlight range**

Replace the context rendering loop in `_showContext()`:

```js
_showContext() {
  if (!this.elements.context) return;
  this.elements.context.setAttribute('data-visible', 'true');

  const contentEl = this.elements.contextContent;
  if (!contentEl) return;

  while (contentEl.firstChild) {
    contentEl.removeChild(contentEl.firstChild);
  }

  const ctx = this.state.contextSentence();
  if (ctx.words.length === 0) return;

  for (let i = 0; i < ctx.words.length; i++) {
    if (i > 0) {
      contentEl.appendChild(document.createTextNode(' '));
    }

    const isHighlighted = ctx.highlightRange
      ? (i >= ctx.highlightRange.start && i <= ctx.highlightRange.end)
      : (i === ctx.highlightIndex);

    if (isHighlighted) {
      const highlight = document.createElement('span');
      highlight.className = 'sr-context-highlight';
      highlight.textContent = ctx.words[i];
      contentEl.appendChild(highlight);
    } else {
      contentEl.appendChild(document.createTextNode(ctx.words[i]));
    }
  }
}
```

- [ ] **Step 4: Update `_updateProgress()` scrubber max**

The scrubber max should still use word count. No changes needed — `this.state.words.length` is still accessible. Verify the existing code uses `this.state.words.length` for `scrubber.max` in `_createDOM()` and `this.state.currentIndex` (now a getter) for the value.

- [ ] **Step 5: Pass chunkSize through `open()` and `updateSettings()`**

In `open()`, pass `chunkSize` to `state.init()`:

```js
this.state.init(text, {
  wpm: settings.wpm,
  punctuationPause: settings.punctuationPause ?? true,
  chunkSize: settings.chunkSize,
});
```

In `updateSettings()`, handle `chunkSize` changes:

```js
if (typeof settings.chunkSize === 'number') {
  this.state.rebuildChunks(settings.chunkSize);
  this.pause();
  this._renderWord();
  this._updateProgress();
}
```

- [ ] **Step 6: Handle alignment fallback for chunk mode**

In `_createDOM()`, after setting the alignment attribute, and in `_renderWord()`, add alignment switching:

In `_renderWord()`, after the existing render logic and before `_scaleWordToFit()`:

```js
// Chunk mode forces centered alignment — ORP anchor has no meaning with plain text
if (display.isChunk) {
  this.host.setAttribute('data-alignment', 'center');
} else {
  this.host.setAttribute('data-alignment', validateAlignment(this.settings.alignment));
}
```

Add `validateAlignment` to the import at the top of overlay.js (it's already imported, verify).

- [ ] **Step 7: Style the chunk text span**

Add CSS for `.sr-chunk-text` in `overlay.css`. The chunk text should match the existing word color but without the focus highlight. Find the `.sr-word-before` and `.sr-word-after` color declarations and apply the same to `.sr-chunk-text`:

```css
.sr-chunk-text {
  color: var(--sr-word-color, #e2e8f0);
}
```

- [ ] **Step 8: Run unit tests**

Run: `make test-js`
Expected: All tests PASS

- [ ] **Step 9: Lint**

Run: `make lint-js`
Expected: No errors

- [ ] **Step 10: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js SpeedReader/SpeedReaderExtension/Resources/overlay.css
git commit -m "Add dual render path for ORP and chunk display modes (#18)"
```

---

### Task 6: One-time tip banner

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js`

- [ ] **Step 1: Add tip banner DOM in `_createDOM()`**

After the context element and before the controls element, add:

```js
// Tip banner (shown once)
const tipBanner = document.createElement('div');
tipBanner.className = 'sr-tip-banner';
tipBanner.setAttribute('data-visible', 'false');

const tipText = document.createElement('span');
tipText.textContent = 'Tip: Try reading 2\u20133 words at a time. Change \u201CWords per flash\u201D in Settings.';

const tipDismiss = document.createElement('button');
tipDismiss.className = 'sr-tip-dismiss';
tipDismiss.textContent = 'Got it';
tipDismiss.setAttribute('aria-label', 'Dismiss tip');

tipBanner.appendChild(tipText);
tipBanner.appendChild(tipDismiss);
this.elements.tipBanner = tipBanner;
this.elements.tipDismiss = tipDismiss;
```

Add `tipBanner` to the card assembly, between `context` and `controls`:

```js
card.appendChild(context);
card.appendChild(tipBanner);
card.appendChild(controls);
```

- [ ] **Step 2: Show tip on first open, hide on dismiss or play**

Add a method to check and show the tip. Call it at the end of `open()`, after `_renderWord()`:

```js
async _maybeShowTip() {
  try {
    const result = await browser.storage.sync.get({ sr_chunkSizeTipSeen: false });
    if (result.sr_chunkSizeTipSeen) return;
    if (this.elements.tipBanner) {
      this.elements.tipBanner.setAttribute('data-visible', 'true');
    }
  } catch (e) {
    // Silently skip tip if storage fails
  }
}

_dismissTip() {
  if (this.elements.tipBanner) {
    this.elements.tipBanner.setAttribute('data-visible', 'false');
  }
  browser.storage.sync.set({ sr_chunkSizeTipSeen: true }).catch(() => {});
}
```

In `open()`, after `this._updateProgress();`:

```js
this._maybeShowTip();
```

In `play()`, add at the start:

```js
this._dismissTip();
```

- [ ] **Step 3: Bind dismiss button**

In `_bindEvents()`, add:

```js
if (this.elements.tipDismiss) {
  this.elements.tipDismiss.addEventListener('click', (e) => {
    e.stopPropagation();
    this._dismissTip();
  });
}
```

- [ ] **Step 4: Style the tip banner**

Add to `overlay.css`:

```css
.sr-tip-banner {
  display: none;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  margin: 0 16px;
  border-radius: 8px;
  background: var(--sr-accent, #0891b2);
  color: #fff;
  font-size: 13px;
  line-height: 1.4;
}

.sr-tip-banner[data-visible="true"] {
  display: flex;
}

.sr-tip-dismiss {
  flex-shrink: 0;
  padding: 4px 12px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 6px;
  background: transparent;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
}

.sr-tip-dismiss:hover {
  background: rgba(255, 255, 255, 0.15);
}
```

- [ ] **Step 5: Run unit tests**

Run: `make test-js`
Expected: All tests PASS

- [ ] **Step 6: Lint**

Run: `make lint-js`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js SpeedReader/SpeedReaderExtension/Resources/overlay.css
git commit -m "Add one-time tip banner for chunk size feature discovery (#18)"
```

---

### Task 7: Content script — settings defaults and test hooks

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/content.js`

- [ ] **Step 1: Add chunkSize to settingsDefaults**

In `content.js`, update the `settingsDefaults` object:

```js
var settingsDefaults = {
  wpm: 250,
  font: 'system',
  theme: 'system',
  fontSize: 42,
  punctuationPause: true,
  alignment: 'orp',
  chunkSize: 1,
};
```

- [ ] **Step 2: Add chunkSize to test query hook**

In the `speedreader-test-query` handler, add after the `result.alignment` line:

```js
result.chunkSize = overlay.state.chunkSize || 1;
```

- [ ] **Step 3: Add set-chunk-size dispatch action**

In the `speedreader-test-dispatch` handler, add `'set-chunk-size'` to the `overlayActions` array:

```js
var overlayActions = ['set-theme', 'set-font', 'set-wpm', 'set-font-size', 'set-alignment', 'set-chunk-size'];
```

Add the handler:

```js
} else if (action === 'set-chunk-size') {
  overlay.updateSettings({ chunkSize: payload.chunkSize });
}
```

- [ ] **Step 4: Lint**

Run: `make lint-js`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/content.js
git commit -m "Add chunkSize to content script settings defaults and test hooks (#18)"
```

---

### Task 8: Swift — SettingsKeys and Settings model

**Files:**
- Modify: `SpeedReader/Shared/SettingsKeys.swift`
- Modify: `SpeedReader/SpeedReader/Models/Settings.swift`

- [ ] **Step 1: Add chunkSize to SettingsKeys**

In `SettingsKeys.swift`, add the key after `alignment`:

```swift
static let chunkSize = "sr_chunkSize"
```

Add default:

```swift
enum Defaults {
    // ... existing defaults ...
    static let chunkSize = 1
}
```

Add bounds:

```swift
static let chunkSizeMin = 1
static let chunkSizeMax = 3
```

Add to `saveSettings()`, after the `alignment` block:

```swift
if let chunkSize = settings["chunkSize"] as? Int {
    defaults.set(clamp(chunkSize, min: chunkSizeMin, max: chunkSizeMax), forKey: SettingsKeys.chunkSize)
    savedCount += 1
}
```

- [ ] **Step 2: Add chunkSize to ReaderSettings model**

In `Settings.swift`, add the property:

```swift
var chunkSize: Int = SettingsKeys.Defaults.chunkSize
```

Add the setter after `setAlignment()`:

```swift
func setChunkSize(_ value: Int) {
    chunkSize = SettingsKeys.clamp(value, min: SettingsKeys.chunkSizeMin, max: SettingsKeys.chunkSizeMax)
    defaults.set(chunkSize, forKey: SettingsKeys.chunkSize)
}
```

Add to `loadFromDefaults()`, after the alignment loading:

```swift
let loadedChunkSize = store.object(forKey: SettingsKeys.chunkSize) as? Int
    ?? SettingsKeys.Defaults.chunkSize
chunkSize = SettingsKeys.clamp(
    loadedChunkSize, min: SettingsKeys.chunkSizeMin, max: SettingsKeys.chunkSizeMax
)
```

- [ ] **Step 3: Commit**

```bash
git add SpeedReader/Shared/SettingsKeys.swift SpeedReader/SpeedReader/Models/Settings.swift
git commit -m "Add chunkSize to Swift settings infrastructure (#18)"
```

---

### Task 9: SwiftUI — segmented control in SettingsView

**Files:**
- Modify: `SpeedReader/SpeedReader/Views/SettingsView.swift`

- [ ] **Step 1: Add "Words per flash" segmented control**

In `SettingsView.swift`, in the "Reading Speed" section, add after the punctuation pause toggle and before the section's closing brace:

```swift
Picker("Words per flash", selection: Binding(
    get: { settings.chunkSize },
    set: { settings.setChunkSize($0) }
)) {
    Text("1").tag(1)
    Text("2").tag(2)
    Text("3").tag(3)
}
.pickerStyle(.segmented)
```

- [ ] **Step 2: Update RSVPPreview to reflect chunk mode**

The preview should show plain text (no ORP highlight) when chunk size > 1. Update the `RSVPPreview` struct to accept `chunkSize` and conditionally render:

Add `let chunkSize: Int` to the struct properties.

Update the `body` computed property — when `chunkSize > 1`, show a multi-word plain text preview instead of ORP-highlighted single word:

```swift
var body: some View {
    Group {
        if chunkSize > 1 {
            Text("the quick brown")
                .foregroundColor(textColor)
                .font(font.font(size: CGFloat(fontSize)))
                .lineLimit(1)
                .minimumScaleFactor(0.3)
                .frame(maxWidth: .infinity)
        } else {
            wordText
                .font(font.font(size: CGFloat(fontSize)))
                .lineLimit(1)
                .minimumScaleFactor(0.3)
                .frame(maxWidth: .infinity)
        }
    }
    .padding(.vertical, 24)
    .background(backgroundColor)
    .clipShape(RoundedRectangle(cornerRadius: 12))
}
```

Update the call site in `SettingsView` to pass `chunkSize`:

```swift
RSVPPreview(
    font: settings.font,
    fontSize: settings.fontSize,
    theme: settings.theme,
    alignment: settings.alignment,
    chunkSize: settings.chunkSize
)
```

- [ ] **Step 3: Build the Swift project**

Run: `make test-swift`
Expected: Build and tests pass

- [ ] **Step 4: Commit**

```bash
git add SpeedReader/SpeedReader/Views/SettingsView.swift
git commit -m "Add Words per flash segmented control to settings UI (#18)"
```

---

### Task 10: Final verification

- [ ] **Step 1: Run full JS test suite**

Run: `make test-js`
Expected: All tests PASS

- [ ] **Step 2: Run linting**

Run: `make lint-js`
Expected: No errors

- [ ] **Step 3: Run Swift tests**

Run: `make test-swift`
Expected: All tests PASS

- [ ] **Step 4: Run full CI**

Run: `make ci`
Expected: All tests and linting pass

- [ ] **Step 5: Review git log**

Run: `git log --oneline -10`

Expected commits (newest first):
```
Add Words per flash segmented control to settings UI (#18)
Add chunkSize to Swift settings infrastructure (#18)
Add chunkSize to content script settings defaults and test hooks (#18)
Add one-time tip banner for chunk size feature discovery (#18)
Add dual render path for ORP and chunk display modes (#18)
Register chunk-builder.js in manifest web_accessible_resources (#18)
Integrate chunk-builder into state machine with proportional delay (#18)
Add chunk-builder module with sentence-boundary-aware grouping (#18)
Add chunkSize settings constants and clampChunkSize validator (#18)
```
