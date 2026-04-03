# RSVPOverlay State Machine Extraction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a pure `RSVPStateMachine` class from `overlay.js` so the core playback logic is unit-testable in Node.js without a DOM.

**Architecture:** New `rsvp/state-machine.js` owns all state (words, currentIndex, isPlaying, wpm) and exposes a pure API. `overlay.js` becomes a thin rendering shell that delegates to the state machine and handles DOM + scheduling. `tick()` returns `{ delay }` instead of calling `setTimeout`, so timing is testable without mocks.

**Tech Stack:** JavaScript ES2020+, Node.js built-in test runner (`node:test`), existing `word-processor.js` and `focus-point.js` modules.

---

## File Map

| File | Responsibility | Task |
|------|---------------|------|
| `SpeedReader/SpeedReaderExtension/Resources/rsvp/state-machine.js` | Pure state machine — all playback logic, zero DOM | 1, 2 |
| `tests/js/state-machine.test.js` | State machine unit tests | 1, 2 |
| `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js` | Thin rendering shell — DOM creation, events, scheduling | 3 |

---

### Task 1: State Machine — Core State & Playback

**Files:**
- Create: `SpeedReader/SpeedReaderExtension/Resources/rsvp/state-machine.js`
- Create: `tests/js/state-machine.test.js`

**Spec ref:** [2026-04-03-rsvp-state-machine-design.md](../superpowers/specs/2026-04-03-rsvp-state-machine-design.md) — "New Module" and "Public API" sections.

- [ ] **Step 1: Write failing tests for `init()`**

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RSVPStateMachine } from '../../SpeedReader/SpeedReaderExtension/Resources/rsvp/state-machine.js';

describe('RSVPStateMachine', () => {

  describe('init', () => {
    it('processes text into words and resets state', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world. Goodbye world.');
      assert.strictEqual(sm.isPlaying, false);
      assert.strictEqual(sm.currentIndex, 0);
      assert.strictEqual(sm.words.length, 4);
    });

    it('clamps wpm below 100 to 100', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { wpm: 50 });
      assert.strictEqual(sm.wpm, 100);
    });

    it('clamps wpm above 600 to 600', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { wpm: 999 });
      assert.strictEqual(sm.wpm, 600);
    });

    it('accepts valid wpm', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { wpm: 300 });
      assert.strictEqual(sm.wpm, 300);
    });

    it('defaults wpm to 250', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.');
      assert.strictEqual(sm.wpm, 250);
    });

    it('returns empty words for empty text', () => {
      const sm = new RSVPStateMachine();
      sm.init('');
      assert.strictEqual(sm.words.length, 0);
    });

    it('resets state on re-init', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three.');
      sm.currentIndex = 2;
      sm.isPlaying = true;
      sm.init('New text here.');
      assert.strictEqual(sm.currentIndex, 0);
      assert.strictEqual(sm.isPlaying, false);
      assert.strictEqual(sm.words.length, 3);
    });
  });

});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/js/state-machine.test.js`
Expected: FAIL — cannot import `RSVPStateMachine` (module does not exist)

- [ ] **Step 3: Implement `RSVPStateMachine` with `init()`**

```js
import { processText, calculateDelay, wpmToDelay } from './word-processor.js';
import { splitWordAtFocus } from './focus-point.js';

export class RSVPStateMachine {
  constructor() {
    this.words = [];
    this.currentIndex = 0;
    this.isPlaying = false;
    this.wpm = 250;
    this.punctuationPause = true;
  }

  init(text, settings = {}) {
    this.words = processText(text);
    this.currentIndex = 0;
    this.isPlaying = false;
    this.wpm = Math.max(100, Math.min(600, settings.wpm ?? 250));
    this.punctuationPause = settings.punctuationPause ?? true;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/js/state-machine.test.js`
Expected: 7 tests PASS

- [ ] **Step 5: Write failing tests for `play()`, `pause()`, `togglePlayPause()`**

Append to the `describe('RSVPStateMachine')` block in `tests/js/state-machine.test.js`:

```js
  describe('play', () => {
    it('sets isPlaying to true', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.');
      sm.play();
      assert.strictEqual(sm.isPlaying, true);
    });

    it('resets index to 0 when at end of text', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.');
      sm.currentIndex = sm.words.length;
      sm.play();
      assert.strictEqual(sm.currentIndex, 0);
      assert.strictEqual(sm.isPlaying, true);
    });

    it('does not reset index when in the middle of text', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world again.');
      sm.currentIndex = 1;
      sm.play();
      assert.strictEqual(sm.currentIndex, 1);
    });
  });

  describe('pause', () => {
    it('sets isPlaying to false', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.');
      sm.play();
      sm.pause();
      assert.strictEqual(sm.isPlaying, false);
    });
  });

  describe('togglePlayPause', () => {
    it('plays when paused', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.');
      sm.togglePlayPause();
      assert.strictEqual(sm.isPlaying, true);
    });

    it('pauses when playing', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.');
      sm.play();
      sm.togglePlayPause();
      assert.strictEqual(sm.isPlaying, false);
    });
  });
```

- [ ] **Step 6: Run tests to verify the new ones fail**

Run: `node --test tests/js/state-machine.test.js`
Expected: new play/pause/toggle tests FAIL

- [ ] **Step 7: Implement `play()`, `pause()`, `togglePlayPause()`**

Add to the `RSVPStateMachine` class in `state-machine.js`:

```js
  play() {
    if (this.currentIndex >= this.words.length) {
      this.currentIndex = 0;
    }
    this.isPlaying = true;
  }

  pause() {
    this.isPlaying = false;
  }

  togglePlayPause() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `node --test tests/js/state-machine.test.js`
Expected: all tests PASS

- [ ] **Step 9: Write failing tests for `tick()`**

Append to the `describe('RSVPStateMachine')` block:

```js
  describe('tick', () => {
    it('advances currentIndex by 1', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world again.');
      sm.play();
      sm.tick();
      assert.strictEqual(sm.currentIndex, 1);
    });

    it('returns delay based on wpm', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { wpm: 250 });
      sm.play();
      const result = sm.tick();
      assert.strictEqual(result.delay, 240); // 60000/250 = 240ms
      assert.strictEqual(result.done, undefined);
    });

    it('returns longer delay for punctuation when enabled', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { wpm: 250, punctuationPause: true });
      sm.play();
      sm.currentIndex = 1; // "world." has period
      const result = sm.tick();
      assert.strictEqual(result.delay, Math.round(240 * 1.5)); // 360ms
    });

    it('returns uniform delay when punctuationPause is disabled', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { wpm: 250, punctuationPause: false });
      sm.play();
      sm.currentIndex = 1; // "world." has period, but pausing is off
      const result = sm.tick();
      assert.strictEqual(result.delay, 240);
    });

    it('returns done when at last word', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.');
      sm.play();
      sm.currentIndex = sm.words.length - 1;
      const result = sm.tick();
      assert.strictEqual(result.done, true);
      assert.strictEqual(sm.isPlaying, false);
    });

    it('returns done when not playing', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.');
      // not playing — isPlaying is false by default
      const result = sm.tick();
      assert.strictEqual(result.done, true);
    });
  });
```

- [ ] **Step 10: Run tests to verify the new ones fail**

Run: `node --test tests/js/state-machine.test.js`
Expected: tick tests FAIL

- [ ] **Step 11: Implement `tick()`**

Add to the `RSVPStateMachine` class in `state-machine.js`:

```js
  tick() {
    if (!this.isPlaying || this.currentIndex >= this.words.length) {
      if (this.currentIndex >= this.words.length) {
        this.pause();
      }
      return { done: true };
    }

    const word = this.words[this.currentIndex];
    const baseDelay = wpmToDelay(this.wpm);
    const delay = this.punctuationPause
      ? calculateDelay(word.text, baseDelay)
      : baseDelay;

    this.currentIndex++;

    if (this.currentIndex >= this.words.length) {
      this.pause();
      return { done: true, delay };
    }

    return { delay };
  }
```

- [ ] **Step 12: Run tests to verify they pass**

Run: `node --test tests/js/state-machine.test.js`
Expected: all tests PASS

- [ ] **Step 13: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/state-machine.js tests/js/state-machine.test.js
git commit -m "Add RSVPStateMachine with init, play/pause, and tick loop"
```

---

### Task 2: State Machine — Navigation & Accessors

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/state-machine.js`
- Modify: `tests/js/state-machine.test.js`

**Spec ref:** [2026-04-03-rsvp-state-machine-design.md](../superpowers/specs/2026-04-03-rsvp-state-machine-design.md) — Sentence Navigation, WPM Adjustment, and Read-Only Accessors sections.

- [ ] **Step 1: Write failing tests for sentence navigation**

Append to the `describe('RSVPStateMachine')` block in `tests/js/state-machine.test.js`:

```js
  describe('prevSentence', () => {
    it('moves to start of current sentence', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.');
      sm.play();
      sm.currentIndex = 3; // "Second" is index 2, "sentence." is index 3
      sm.prevSentence();
      assert.strictEqual(sm.currentIndex, 2); // "Second" — start of 2nd sentence
      assert.strictEqual(sm.isPlaying, false);
    });

    it('moves to previous sentence when at sentence start', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.');
      sm.play();
      sm.currentIndex = 2; // "Second" — already at sentence start
      sm.prevSentence();
      assert.strictEqual(sm.currentIndex, 0); // "First" — start of 1st sentence
    });

    it('stays at 0 when already at beginning', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.');
      sm.play();
      sm.currentIndex = 0;
      sm.prevSentence();
      assert.strictEqual(sm.currentIndex, 0);
    });

    it('pauses playback', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.');
      sm.play();
      sm.currentIndex = 3;
      sm.prevSentence();
      assert.strictEqual(sm.isPlaying, false);
    });
  });

  describe('nextSentence', () => {
    it('jumps to next sentence boundary', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.');
      sm.play();
      sm.currentIndex = 0;
      sm.nextSentence();
      assert.strictEqual(sm.currentIndex, 2); // "Second"
      assert.strictEqual(sm.isPlaying, false);
    });

    it('stays put at last sentence', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.');
      sm.play();
      sm.currentIndex = 2; // "Second" — start of last sentence
      sm.nextSentence();
      assert.strictEqual(sm.currentIndex, 2); // no next sentence, stays
    });

    it('pauses playback', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.');
      sm.play();
      sm.currentIndex = 0;
      sm.nextSentence();
      assert.strictEqual(sm.isPlaying, false);
    });
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `node --test tests/js/state-machine.test.js`
Expected: prevSentence/nextSentence tests FAIL

- [ ] **Step 3: Implement `prevSentence()` and `nextSentence()`**

Add to the `RSVPStateMachine` class in `state-machine.js`:

```js
  prevSentence() {
    this.pause();
    let i = this.currentIndex - 1;
    while (i > 0) {
      if (this.words[i].sentenceStart) {
        break;
      }
      i--;
    }
    this.currentIndex = Math.max(0, i);
  }

  nextSentence() {
    this.pause();
    let i = this.currentIndex + 1;
    while (i < this.words.length) {
      if (this.words[i].sentenceStart) {
        break;
      }
      i++;
    }
    if (i < this.words.length) {
      this.currentIndex = i;
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/js/state-machine.test.js`
Expected: all tests PASS

- [ ] **Step 5: Write failing tests for `adjustWpm()`**

Append to the `describe('RSVPStateMachine')` block:

```js
  describe('adjustWpm', () => {
    it('increments wpm by delta', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { wpm: 250 });
      const result = sm.adjustWpm(25);
      assert.strictEqual(result, 275);
      assert.strictEqual(sm.wpm, 275);
    });

    it('decrements wpm by delta', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { wpm: 250 });
      const result = sm.adjustWpm(-25);
      assert.strictEqual(result, 225);
      assert.strictEqual(sm.wpm, 225);
    });

    it('clamps at floor of 100', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { wpm: 100 });
      const result = sm.adjustWpm(-25);
      assert.strictEqual(result, 100);
    });

    it('clamps at ceiling of 600', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { wpm: 600 });
      const result = sm.adjustWpm(25);
      assert.strictEqual(result, 600);
    });
  });
```

- [ ] **Step 6: Run tests to verify the new ones fail**

Run: `node --test tests/js/state-machine.test.js`
Expected: adjustWpm tests FAIL

- [ ] **Step 7: Implement `adjustWpm()`**

Add to the `RSVPStateMachine` class:

```js
  adjustWpm(delta) {
    this.wpm = Math.max(100, Math.min(600, this.wpm + delta));
    return this.wpm;
  }
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `node --test tests/js/state-machine.test.js`
Expected: all tests PASS

- [ ] **Step 9: Write failing tests for read-only accessors**

Append to the `describe('RSVPStateMachine')` block:

```js
  describe('currentWord', () => {
    it('returns split word at current index', () => {
      const sm = new RSVPStateMachine();
      sm.init('Reading is fun.');
      sm.currentIndex = 0;
      const word = sm.currentWord();
      // "Reading" — ORP at floor(7*0.3) = index 2 → "Re" + "a" + "ding"
      assert.strictEqual(word.before, 'Re');
      assert.strictEqual(word.focus, 'a');
      assert.strictEqual(word.after, 'ding');
    });

    it('returns empty parts when past end', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello.');
      sm.currentIndex = sm.words.length;
      const word = sm.currentWord();
      assert.strictEqual(word.before, '');
      assert.strictEqual(word.focus, '');
      assert.strictEqual(word.after, '');
    });
  });

  describe('progress', () => {
    it('returns 0% at start', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three four.');
      const p = sm.progress();
      assert.strictEqual(p.percent, 0);
      assert.strictEqual(p.current, 0);
      assert.strictEqual(p.total, 4);
    });

    it('returns 50% at midpoint', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three four.');
      sm.currentIndex = 2;
      const p = sm.progress();
      assert.strictEqual(p.percent, 50);
      assert.strictEqual(p.current, 2);
      assert.strictEqual(p.total, 4);
    });

    it('returns 100% at end', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three four.');
      sm.currentIndex = 4;
      const p = sm.progress();
      assert.strictEqual(p.percent, 100);
    });

    it('returns 0% for empty text', () => {
      const sm = new RSVPStateMachine();
      sm.init('');
      const p = sm.progress();
      assert.strictEqual(p.percent, 0);
      assert.strictEqual(p.total, 0);
    });
  });

  describe('contextSentence', () => {
    it('returns words in current sentence with highlight index', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.');
      sm.currentIndex = 3; // "sentence." in 2nd sentence
      const ctx = sm.contextSentence();
      assert.deepStrictEqual(ctx.words, ['Second', 'sentence.']);
      assert.strictEqual(ctx.highlightIndex, 1); // "sentence." is index 1 in this slice
    });

    it('returns first sentence when at start', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.');
      sm.currentIndex = 0;
      const ctx = sm.contextSentence();
      assert.deepStrictEqual(ctx.words, ['First', 'sentence.']);
      assert.strictEqual(ctx.highlightIndex, 0);
    });

    it('returns empty for index past end', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.');
      sm.currentIndex = sm.words.length;
      const ctx = sm.contextSentence();
      assert.deepStrictEqual(ctx.words, []);
      assert.strictEqual(ctx.highlightIndex, -1);
    });
  });
```

- [ ] **Step 10: Run tests to verify the new ones fail**

Run: `node --test tests/js/state-machine.test.js`
Expected: accessor tests FAIL

- [ ] **Step 11: Implement `currentWord()`, `progress()`, `contextSentence()`**

Add to the `RSVPStateMachine` class:

```js
  currentWord() {
    if (this.currentIndex >= this.words.length) {
      return { before: '', focus: '', after: '' };
    }
    return splitWordAtFocus(this.words[this.currentIndex].text);
  }

  progress() {
    const total = this.words.length;
    const current = this.currentIndex;
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    return { percent, current, total };
  }

  contextSentence() {
    if (this.currentIndex >= this.words.length) {
      return { words: [], highlightIndex: -1 };
    }

    let sentenceStart = this.currentIndex;
    while (sentenceStart > 0 && !this.words[sentenceStart].sentenceStart) {
      sentenceStart--;
    }

    let sentenceEnd = this.currentIndex + 1;
    while (sentenceEnd < this.words.length && !this.words[sentenceEnd].sentenceStart) {
      sentenceEnd++;
    }

    const words = [];
    for (let i = sentenceStart; i < sentenceEnd; i++) {
      words.push(this.words[i].text);
    }

    return {
      words,
      highlightIndex: this.currentIndex - sentenceStart,
    };
  }
```

- [ ] **Step 12: Run tests to verify they pass**

Run: `node --test tests/js/state-machine.test.js`
Expected: all tests PASS

- [ ] **Step 13: Run full JS test suite**

Run: `node --test tests/js/*.test.js`
Expected: all tests PASS across all test files (word-processor, focus-point, state-machine)

- [ ] **Step 14: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/state-machine.js tests/js/state-machine.test.js
git commit -m "Add sentence navigation, WPM adjustment, and accessors to state machine"
```

---

### Task 3: Rewire `overlay.js` to Use State Machine

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js`

**Spec ref:** [2026-04-03-rsvp-state-machine-design.md](../superpowers/specs/2026-04-03-rsvp-state-machine-design.md) — "Changes to overlay.js" section.

This task replaces the inline state in `overlay.js` with delegation to `RSVPStateMachine`. Behavior is identical — the regression script is the integration safety net.

- [ ] **Step 1: Replace state fields and imports in `overlay.js`**

Replace the import line and constructor:

Old imports (line 1-2):
```js
import { processText, calculateDelay, wpmToDelay } from './word-processor.js';
import { splitWordAtFocus } from './focus-point.js';
```

New imports:
```js
import { RSVPStateMachine } from './state-machine.js';
```

Old constructor (lines 5-22):
```js
  constructor() {
    this.words = [];
    this.currentIndex = 0;
    this.isPlaying = false;
    this.wpm = 250;
    this.timerId = null;
    this.title = '';
    this.settings = {
      theme: 'system',
      font: 'system',
      fontSize: 42,
      punctuationPause: true,
    };
    this.host = null;
    this.shadow = null;
    this.elements = {};
    this._boundKeyHandler = null;
  }
```

New constructor:
```js
  constructor() {
    this.state = new RSVPStateMachine();
    this.timerId = null;
    this.title = '';
    this.settings = {
      theme: 'system',
      font: 'system',
      fontSize: 42,
    };
    this.host = null;
    this.shadow = null;
    this.elements = {};
    this._boundKeyHandler = null;
  }
```

- [ ] **Step 2: Replace `open()` to delegate to state machine**

Old `open()` (lines 24-48):
```js
  open(text, title, settings = {}) {
    if (this.host) {
      this.close();
    }

    Object.assign(this.settings, settings);
    if (settings.wpm !== undefined) {
      this.wpm = Math.max(100, Math.min(600, settings.wpm));
    }
    this.title = title || '';
    this.words = processText(text);

    if (this.words.length === 0) {
      this._showPageToast('No readable content found.');
      return;
    }

    this.currentIndex = 0;
    this.isPlaying = false;

    this._createDOM();
    this._bindEvents();
    this._renderWord();
    this._updateProgress();
  }
```

New `open()`:
```js
  open(text, title, settings = {}) {
    if (this.host) {
      this.close();
    }

    Object.assign(this.settings, settings);
    this.title = title || '';
    this.state.init(text, {
      wpm: settings.wpm,
      punctuationPause: settings.punctuationPause ?? true,
    });

    if (this.state.words.length === 0) {
      this._showPageToast('No readable content found.');
      return;
    }

    this._createDOM();
    this._bindEvents();
    this._renderWord();
    this._updateProgress();
  }
```

- [ ] **Step 3: Replace `close()`, `play()`, `pause()`, `togglePlayPause()`**

Old `close()` (lines 50-62) — replace `this.pause()`:
```js
  close() {
    this.pause();
    if (this.host && this.host.parentNode) {
      this.host.parentNode.removeChild(this.host);
    }
    this.host = null;
    this.shadow = null;
    this.elements = {};
    if (this._boundKeyHandler) {
      document.removeEventListener('keydown', this._boundKeyHandler);
      this._boundKeyHandler = null;
    }
  }
```
(No change needed — `this.pause()` still works since we're rewriting that method.)

Old `play()` (lines 64-72):
```js
  play() {
    if (this.currentIndex >= this.words.length) {
      this.currentIndex = 0;
    }
    this.isPlaying = true;
    this._updatePlayButton();
    this._hideContext();
    this._tick();
  }
```

New `play()`:
```js
  play() {
    this.state.play();
    this._updatePlayButton();
    this._hideContext();
    this._startLoop();
  }
```

Old `pause()` (lines 74-82):
```js
  pause() {
    this.isPlaying = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this._updatePlayButton();
    this._showContext();
  }
```

New `pause()`:
```js
  pause() {
    this.state.pause();
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this._updatePlayButton();
    this._showContext();
  }
```

Old `togglePlayPause()` (lines 84-90):
```js
  togglePlayPause() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }
```

New `togglePlayPause()`:
```js
  togglePlayPause() {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }
```

- [ ] **Step 4: Replace navigation and WPM methods**

Old `prevSentence()` (lines 92-104):
```js
  prevSentence() {
    this.pause();
    let i = this.currentIndex - 1;
    while (i > 0) {
      if (this.words[i].sentenceStart) {
        break;
      }
      i--;
    }
    this.currentIndex = Math.max(0, i);
    this._renderWord();
    this._updateProgress();
  }
```

New `prevSentence()`:
```js
  prevSentence() {
    this.state.prevSentence();
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this._updatePlayButton();
    this._showContext();
    this._renderWord();
    this._updateProgress();
  }
```

Old `nextSentence()` (lines 106-120):
```js
  nextSentence() {
    this.pause();
    let i = this.currentIndex + 1;
    while (i < this.words.length) {
      if (this.words[i].sentenceStart) {
        break;
      }
      i++;
    }
    if (i < this.words.length) {
      this.currentIndex = i;
    }
    this._renderWord();
    this._updateProgress();
  }
```

New `nextSentence()`:
```js
  nextSentence() {
    this.state.nextSentence();
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this._updatePlayButton();
    this._showContext();
    this._renderWord();
    this._updateProgress();
  }
```

Old `adjustWpm()` (lines 122-130):
```js
  adjustWpm(delta) {
    this.wpm = Math.max(100, Math.min(600, this.wpm + delta));
    if (this.elements.wpmLabel) {
      this.elements.wpmLabel.textContent = this.wpm + ' wpm';
    }
    if (this.elements.slider) {
      this.elements.slider.value = this.wpm;
    }
  }
```

New `adjustWpm()`:
```js
  adjustWpm(delta) {
    this.state.adjustWpm(delta);
    if (this.elements.wpmLabel) {
      this.elements.wpmLabel.textContent = this.state.wpm + ' wpm';
    }
    if (this.elements.slider) {
      this.elements.slider.value = this.state.wpm;
    }
  }
```

- [ ] **Step 5: Replace `_tick()` with `_startLoop()` and update render methods**

Old `_tick()` (lines 132-154):
```js
  _tick() {
    if (!this.isPlaying || this.currentIndex >= this.words.length) {
      if (this.currentIndex >= this.words.length) {
        this.pause();
      }
      return;
    }

    this._renderWord();
    this._updateProgress();

    const word = this.words[this.currentIndex];
    const baseDelay = wpmToDelay(this.wpm);
    const delay = this.settings.punctuationPause
      ? calculateDelay(word.text, baseDelay)
      : baseDelay;

    this.currentIndex++;

    this.timerId = setTimeout(() => {
      this._tick();
    }, delay);
  }
```

New `_startLoop()`:
```js
  _startLoop() {
    this._renderWord();
    this._updateProgress();

    const result = this.state.tick();
    if (result.done) {
      this.pause();
      return;
    }

    this.timerId = setTimeout(() => {
      this._startLoop();
    }, result.delay);
  }
```

Old `_renderWord()` (lines 156-169):
```js
  _renderWord() {
    if (this.currentIndex >= this.words.length) return;
    const word = this.words[this.currentIndex];
    const parts = splitWordAtFocus(word.text);
    if (this.elements.wordBefore) {
      this.elements.wordBefore.textContent = parts.before;
    }
    if (this.elements.wordFocus) {
      this.elements.wordFocus.textContent = parts.focus;
    }
    if (this.elements.wordAfter) {
      this.elements.wordAfter.textContent = parts.after;
    }
  }
```

New `_renderWord()`:
```js
  _renderWord() {
    const parts = this.state.currentWord();
    if (this.elements.wordBefore) {
      this.elements.wordBefore.textContent = parts.before;
    }
    if (this.elements.wordFocus) {
      this.elements.wordFocus.textContent = parts.focus;
    }
    if (this.elements.wordAfter) {
      this.elements.wordAfter.textContent = parts.after;
    }
  }
```

Old `_updateProgress()` (lines 171-181):
```js
  _updateProgress() {
    const pct = this.words.length > 0
      ? Math.round((this.currentIndex / this.words.length) * 100)
      : 0;
    if (this.elements.progressFill) {
      this.elements.progressFill.style.width = pct + '%';
    }
    if (this.elements.progressLabel) {
      this.elements.progressLabel.textContent = pct + '%';
    }
  }
```

New `_updateProgress()`:
```js
  _updateProgress() {
    const p = this.state.progress();
    if (this.elements.progressFill) {
      this.elements.progressFill.style.width = p.percent + '%';
    }
    if (this.elements.progressLabel) {
      this.elements.progressLabel.textContent = p.percent + '%';
    }
  }
```

Old `_updatePlayButton()` (lines 183-187):
```js
  _updatePlayButton() {
    if (this.elements.playBtn) {
      this.elements.playBtn.textContent = this.isPlaying ? '⏸' : '▶';
    }
  }
```

New `_updatePlayButton()`:
```js
  _updatePlayButton() {
    if (this.elements.playBtn) {
      this.elements.playBtn.textContent = this.state.isPlaying ? '⏸' : '▶';
    }
  }
```

- [ ] **Step 6: Replace `_showContext()` to use state machine**

Old `_showContext()` (lines 189-228):
```js
  _showContext() {
    if (!this.elements.context) return;
    this.elements.context.setAttribute('data-visible', 'true');

    const contentEl = this.elements.contextContent;
    if (!contentEl) return;

    // Clear existing content
    while (contentEl.firstChild) {
      contentEl.removeChild(contentEl.firstChild);
    }

    if (this.currentIndex >= this.words.length) return;

    // Find sentence boundaries
    let sentenceStart = this.currentIndex;
    while (sentenceStart > 0 && !this.words[sentenceStart].sentenceStart) {
      sentenceStart--;
    }

    let sentenceEnd = this.currentIndex + 1;
    while (sentenceEnd < this.words.length && !this.words[sentenceEnd].sentenceStart) {
      sentenceEnd++;
    }

    // Build context with highlighted current word
    for (let i = sentenceStart; i < sentenceEnd; i++) {
      if (i > sentenceStart) {
        contentEl.appendChild(document.createTextNode(' '));
      }
      if (i === this.currentIndex) {
        const highlight = document.createElement('span');
        highlight.className = 'sr-context-highlight';
        highlight.textContent = this.words[i].text;
        contentEl.appendChild(highlight);
      } else {
        contentEl.appendChild(document.createTextNode(this.words[i].text));
      }
    }
  }
```

New `_showContext()`:
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
      if (i === ctx.highlightIndex) {
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

- [ ] **Step 7: Update `_createDOM()` to read wpm and words from state machine**

In `_createDOM()`, replace references to `this.wpm` and `this.words`:

Line 422-423 — old:
```js
    wpmLabel.textContent = this.wpm + ' wpm';
```
New:
```js
    wpmLabel.textContent = this.state.wpm + ' wpm';
```

Line 436 — old:
```js
    slider.value = this.wpm;
```
New:
```js
    slider.value = this.state.wpm;
```

Line 455 — old:
```js
    wordsCountLabel.textContent = this.words.length + ' words';
```
New:
```js
    wordsCountLabel.textContent = this.state.words.length + ' words';
```

- [ ] **Step 8: Update `_bindEvents()` slider handler**

Line 508-510 — old:
```js
    this.elements.slider.addEventListener('input', () => {
      this.wpm = parseInt(this.elements.slider.value, 10);
      this.elements.wpmLabel.textContent = this.wpm + ' wpm';
    });
```

New:
```js
    this.elements.slider.addEventListener('input', () => {
      const value = parseInt(this.elements.slider.value, 10);
      this.state.wpm = Math.max(100, Math.min(600, value));
      this.elements.wpmLabel.textContent = this.state.wpm + ' wpm';
    });
```

- [ ] **Step 9: Run full JS test suite**

Run: `node --test tests/js/*.test.js`
Expected: all tests PASS (state-machine, word-processor, focus-point). This confirms the state machine still works correctly after overlay rewiring.

- [ ] **Step 10: Run ESLint**

Run: `npx eslint SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js SpeedReader/SpeedReaderExtension/Resources/rsvp/state-machine.js`
Expected: no errors

- [ ] **Step 11: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js
git commit -m "Rewire overlay.js to delegate to RSVPStateMachine"
```

---

### Task 4: Verify & Clean Up

**Files:**
- Verify: all `tests/js/*.test.js`
- Verify: ESLint on all modified files

- [ ] **Step 1: Run full JS test suite**

Run: `node --test tests/js/*.test.js`
Expected: all tests PASS

- [ ] **Step 2: Run ESLint on all extension JS**

Run: `npx eslint .`
Expected: no errors

- [ ] **Step 3: Update ROADMAP.md — check off state machine tests item**

In `ROADMAP.md`, change:
```markdown
- [ ] RSVPOverlay state machine tests (play/pause/nav/wpm clamping) — extract testable logic or use DOM shim
```
to:
```markdown
- [x] RSVPOverlay state machine tests (play/pause/nav/wpm clamping) — extracted to `rsvp/state-machine.js`
```

- [ ] **Step 4: Commit**

```bash
git add ROADMAP.md
git commit -m "Mark RSVPOverlay state machine tests complete in roadmap"
```
