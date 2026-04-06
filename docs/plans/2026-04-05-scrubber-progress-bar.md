# Scrubber / Progress Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the display-only progress bar with an interactive slider-style scrubber that lets users seek through an article during RSVP reading.

**Architecture:** Add `seekTo()`, `timeElapsed()`, and `timeRemaining()` to the state machine. Replace the progress bar DOM with a native `<input type="range">` reusing the existing `.sr-slider` CSS. Bind scrub events with pause-on-scrub behavior. Add lightweight analytics eventing via `browser.runtime.sendMessage`.

**Tech Stack:** JavaScript (ES2020+), CSS, Shadow DOM, Safari WebExtension APIs, Node.js test runner

**Spec:** `docs/superpowers/specs/2026-04-05-scrubber-progress-bar-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `SpeedReader/SpeedReaderExtension/Resources/rsvp/state-machine.js` | Modify | Add `seekTo()`, `timeElapsed()`, `timeRemaining()` |
| `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js` | Modify | Replace progress bar DOM, bind scrubber events, add `_formatTime()`, update `_updateProgress()` |
| `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.css` | Modify | Remove `.sr-progress-*`, add `.sr-scrubber-area` and `.sr-scrubber-labels` |
| `SpeedReader/SpeedReaderExtension/Resources/background.js` | Modify | Add `analytics-event` message handler |
| `tests/js/state-machine.test.js` | Modify | Add tests for `seekTo`, `timeElapsed`, `timeRemaining` |

---

## Task 1: State Machine — `seekTo()` method

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/state-machine.js`
- Test: `tests/js/state-machine.test.js`

- [ ] **Step 1: Write failing tests for `seekTo`**

Add these tests to `tests/js/state-machine.test.js` inside a new `describe('seekTo')` block after the existing `describe('nextSentence')` block:

```js
describe('seekTo', () => {
  it('sets currentIndex to the given value', () => {
    const sm = new RSVPStateMachine();
    sm.init('One two three four five.');
    sm.seekTo(3);
    assert.strictEqual(sm.currentIndex, 3);
  });

  it('clamps to 0 when given a negative index', () => {
    const sm = new RSVPStateMachine();
    sm.init('One two three.');
    sm.seekTo(-5);
    assert.strictEqual(sm.currentIndex, 0);
  });

  it('clamps to last valid index when given index beyond words length', () => {
    const sm = new RSVPStateMachine();
    sm.init('One two three.');
    sm.seekTo(999);
    assert.strictEqual(sm.currentIndex, 2); // 3 words, last index is 2
  });

  it('pauses playback when seeking', () => {
    const sm = new RSVPStateMachine();
    sm.init('One two three four five.');
    sm.play();
    assert.strictEqual(sm.isPlaying, true);
    sm.seekTo(2);
    assert.strictEqual(sm.isPlaying, false);
  });

  it('works correctly when words array is empty', () => {
    const sm = new RSVPStateMachine();
    sm.init('');
    sm.seekTo(5);
    assert.strictEqual(sm.currentIndex, 0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `make test-js`
Expected: FAIL — `sm.seekTo is not a function`

- [ ] **Step 3: Implement `seekTo` in state-machine.js**

Add this method after the `nextSentence()` method in `state-machine.js` (after line 89):

```js
seekTo(index) {
  this.pause();
  if (this.words.length === 0) {
    this.currentIndex = 0;
    return;
  }
  this.currentIndex = Math.max(0, Math.min(index, this.words.length - 1));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `make test-js`
Expected: All tests PASS including the 5 new `seekTo` tests

- [ ] **Step 5: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/state-machine.js tests/js/state-machine.test.js
git commit -m "Add seekTo method to RSVPStateMachine (#14)"
```

---

## Task 2: State Machine — `timeElapsed()` and `timeRemaining()` methods

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/state-machine.js`
- Test: `tests/js/state-machine.test.js`

- [ ] **Step 1: Write failing tests for time methods**

Add these tests to `tests/js/state-machine.test.js` inside a new `describe('timeElapsed and timeRemaining')` block after the `describe('seekTo')` block:

```js
describe('timeElapsed and timeRemaining', () => {
  it('returns 0 elapsed and full remaining at start', () => {
    const sm = new RSVPStateMachine();
    sm.init('One two three four.', { wpm: 240 }); // 4 words, 240wpm = 4 words/sec = 1 sec total
    assert.strictEqual(sm.timeElapsed(), 0);
    assert.strictEqual(sm.timeRemaining(), 1);
  });

  it('returns correct times at midpoint', () => {
    const sm = new RSVPStateMachine();
    sm.init('One two three four five six.', { wpm: 300 }); // 6 words at 300wpm
    sm.currentIndex = 3; // halfway
    // elapsed: ceil(3 / 300 * 60) = ceil(0.6) = 1
    assert.strictEqual(sm.timeElapsed(), 1);
    // remaining: ceil(3 / 300 * 60) = ceil(0.6) = 1
    assert.strictEqual(sm.timeRemaining(), 1);
  });

  it('returns full elapsed and 0 remaining at end', () => {
    const sm = new RSVPStateMachine();
    sm.init('One two three four.', { wpm: 240 });
    sm.currentIndex = 4; // past last word
    assert.strictEqual(sm.timeRemaining(), 0);
    assert.strictEqual(sm.timeElapsed(), 1);
  });

  it('updates when wpm changes', () => {
    const sm = new RSVPStateMachine();
    sm.init('One two three four five six seven eight nine ten.', { wpm: 300 });
    // 10 words at 300wpm = 2 sec total
    assert.strictEqual(sm.timeRemaining(), 2);
    sm.wpm = 600;
    // 10 words at 600wpm = 1 sec total
    assert.strictEqual(sm.timeRemaining(), 1);
  });

  it('elapsed + remaining equals total time', () => {
    const sm = new RSVPStateMachine();
    // Use values that divide evenly to avoid rounding issues
    sm.init('One two three four five six.', { wpm: 120 }); // 6 words at 120wpm = 3 sec
    sm.currentIndex = 2; // 2 elapsed, 4 remaining
    // elapsed: ceil(2/120*60) = ceil(1) = 1
    // remaining: ceil(4/120*60) = ceil(2) = 2
    // total: ceil(6/120*60) = ceil(3) = 3
    assert.strictEqual(sm.timeElapsed() + sm.timeRemaining(), 3);
  });

  it('returns 0 for both when words array is empty', () => {
    const sm = new RSVPStateMachine();
    sm.init('');
    assert.strictEqual(sm.timeElapsed(), 0);
    assert.strictEqual(sm.timeRemaining(), 0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `make test-js`
Expected: FAIL — `sm.timeElapsed is not a function`

- [ ] **Step 3: Implement time methods in state-machine.js**

Add these methods after the `seekTo()` method:

```js
timeElapsed() {
  if (this.words.length === 0) return 0;
  return Math.ceil((this.currentIndex / this.wpm) * 60);
}

timeRemaining() {
  if (this.words.length === 0) return 0;
  const wordsLeft = this.words.length - this.currentIndex;
  if (wordsLeft <= 0) return 0;
  return Math.ceil((wordsLeft / this.wpm) * 60);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `make test-js`
Expected: All tests PASS including the 6 new time method tests

- [ ] **Step 5: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/state-machine.js tests/js/state-machine.test.js
git commit -m "Add timeElapsed and timeRemaining to RSVPStateMachine (#14)"
```

---

## Task 3: CSS — Replace progress bar styles with scrubber styles

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.css`

- [ ] **Step 1: Remove progress bar styles**

Delete the following CSS blocks from `overlay.css`:

```css
.sr-progress-area {
  margin-top: 12px;
}

.sr-progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--sr-text-muted);
  margin-bottom: 4px;
}

.sr-progress-track {
  background: var(--sr-border);
  border-radius: 4px;
  height: 4px;
  overflow: hidden;
}

.sr-progress-fill {
  background: var(--sr-accent);
  border-radius: 4px;
  height: 4px;
  width: 0%;
  transition: width 0.1s linear;
}
```

Also remove the `.sr-progress-fill` rule from the `@media (prefers-reduced-motion: reduce)` block:

```css
.sr-progress-fill {
  transition: none;
}
```

- [ ] **Step 2: Add scrubber area styles**

Add the following CSS in the same location where the progress styles were removed (after `.sr-font-size-value`):

```css
.sr-scrubber-area {
  margin-top: 12px;
}

.sr-scrubber-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--sr-text-muted);
  margin-bottom: 8px;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 3: Verify lint passes**

Run: `make lint-js`
Expected: PASS (CSS changes don't affect JS lint, but good to confirm nothing broke)

- [ ] **Step 4: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.css
git commit -m "Replace progress bar CSS with scrubber area styles (#14)"
```

---

## Task 4: Overlay — Replace progress bar DOM with scrubber

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js`

- [ ] **Step 1: Add `_formatTime` helper method**

Add this method after the `_scaleWordToFit()` method (after line 256):

```js
_formatTime(seconds) {
  var mins = Math.floor(seconds / 60);
  var secs = seconds % 60;
  return mins + ':' + (secs < 10 ? '0' : '') + secs;
}
```

- [ ] **Step 2: Replace progress bar DOM in `_createDOM()`**

In `_createDOM()`, find the progress area block (starts with `// Progress area` comment, approximately lines 548-576) and replace it entirely with:

```js
// Scrubber area
const scrubberArea = document.createElement('div');
scrubberArea.className = 'sr-scrubber-area';

const scrubberLabels = document.createElement('div');
scrubberLabels.className = 'sr-scrubber-labels';

const timeElapsed = document.createElement('span');
timeElapsed.textContent = '0:00';
this.elements.timeElapsed = timeElapsed;

const timeRemaining = document.createElement('span');
timeRemaining.textContent = '-' + this._formatTime(this.state.timeRemaining());
this.elements.timeRemaining = timeRemaining;

scrubberLabels.appendChild(timeElapsed);
scrubberLabels.appendChild(timeRemaining);

const scrubber = document.createElement('input');
scrubber.type = 'range';
scrubber.className = 'sr-slider';
scrubber.min = '0';
scrubber.max = String(Math.max(0, this.state.words.length - 1));
scrubber.value = '0';
scrubber.setAttribute('aria-label', 'Reading position');
this.elements.scrubber = scrubber;

scrubberArea.appendChild(scrubberLabels);
scrubberArea.appendChild(scrubber);
```

- [ ] **Step 3: Update card assembly**

In the card assembly block (the `card.appendChild(...)` sequence), replace `card.appendChild(progressArea)` with `card.appendChild(scrubberArea)`.

- [ ] **Step 4: Update `_updateProgress()` method**

Replace the entire `_updateProgress()` method with:

```js
_updateProgress() {
  if (this.elements.scrubber) {
    this.elements.scrubber.value = this.state.currentIndex;
  }
  if (this.elements.timeElapsed) {
    this.elements.timeElapsed.textContent = this._formatTime(this.state.timeElapsed());
  }
  if (this.elements.timeRemaining) {
    this.elements.timeRemaining.textContent = '-' + this._formatTime(this.state.timeRemaining());
  }
}
```

- [ ] **Step 5: Remove old element references**

In `_createDOM()`, remove the creation of these elements that no longer exist: `progressFill`, `progressLabel`. Search for `this.elements.progressFill` and `this.elements.progressLabel` — these should no longer be set.

- [ ] **Step 6: Verify the build is clean**

Run: `make lint-js`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js
git commit -m "Replace progress bar DOM with scrubber slider (#14)"
```

---

## Task 5: Overlay — Bind scrubber events

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js`

- [ ] **Step 1: Add scrubber event listeners in `_bindEvents()`**

Add the following after the existing `this.elements.fontSizeUp.addEventListener(...)` block and before the `this.elements.backdrop.addEventListener(...)` block:

```js
this.elements.scrubber.addEventListener('mousedown', () => {
  this._scrubFromIndex = this.state.currentIndex;
  if (this.state.isPlaying) {
    this.pause();
  }
});

this.elements.scrubber.addEventListener('touchstart', () => {
  this._scrubFromIndex = this.state.currentIndex;
  if (this.state.isPlaying) {
    this.pause();
  }
}, { passive: true });

this.elements.scrubber.addEventListener('input', () => {
  const index = parseInt(this.elements.scrubber.value, 10);
  this.state.seekTo(index);
  this._renderWord();
  this._updateProgress();
  this._showContext();
});

this.elements.scrubber.addEventListener('change', () => {
  const toIndex = this.state.currentIndex;
  const fromIndex = this._scrubFromIndex !== undefined ? this._scrubFromIndex : toIndex;
  if (fromIndex !== toIndex) {
    browser.runtime.sendMessage({
      action: 'analytics-event',
      event: 'scrub',
      data: {
        direction: toIndex < fromIndex ? 'backward' : 'forward',
        distance: Math.abs(toIndex - fromIndex),
        fromIndex: fromIndex,
        toIndex: toIndex,
        totalWords: this.state.words.length,
      },
    }).catch(function(err) {
      console.warn('[SpeedReader] Failed to send scrub analytics:', err.message || err);
    });
  }
  this._scrubFromIndex = undefined;
});
```

- [ ] **Step 2: Add keyboard guard for arrow keys**

In the `_boundKeyHandler` switch statement, update the `ArrowLeft` and `ArrowRight` cases. Replace:

```js
case 'ArrowLeft':
  e.preventDefault();
  this.prevSentence();
  break;
case 'ArrowRight':
  e.preventDefault();
  this.nextSentence();
  break;
```

With:

```js
case 'ArrowLeft':
  if (e.target === this.elements.scrubber) break;
  e.preventDefault();
  this.prevSentence();
  break;
case 'ArrowRight':
  if (e.target === this.elements.scrubber) break;
  e.preventDefault();
  this.nextSentence();
  break;
```

- [ ] **Step 3: Initialize `_scrubFromIndex` in the constructor**

Add `this._scrubFromIndex = undefined;` to the constructor, after `this._boundKeyHandler = null;`:

```js
this._boundKeyHandler = null;
this._scrubFromIndex = undefined;
```

- [ ] **Step 4: Verify lint passes**

Run: `make lint-js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js
git commit -m "Bind scrubber events with pause-on-scrub and analytics (#14)"
```

---

## Task 6: Background script — Analytics event handler

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/background.js`

- [ ] **Step 1: Add analytics-event handler**

In `background.js`, inside the `browser.runtime.onMessage.addListener` callback, add the following block after the `if (message.action === 'test-get-state')` block (before the closing `});` of the listener):

```js
if (message.action === 'analytics-event') {
  console.debug('[SpeedReader]', message.event, message.data);
}
```

Note: This handler is fire-and-forget — no `sendResponse`, no `return true`. The overlay's `.catch()` handles any errors.

- [ ] **Step 2: Verify lint passes**

Run: `make lint-js`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/background.js
git commit -m "Add analytics-event handler to background script (#14)"
```

---

## Task 7: Full integration verification

**Files:**
- All modified files

- [ ] **Step 1: Run all JS tests**

Run: `make test-js`
Expected: All tests PASS, including the 11 new state machine tests

- [ ] **Step 2: Run all lints**

Run: `make lint-all`
Expected: PASS

- [ ] **Step 3: Run full CI suite**

Run: `make ci`
Expected: PASS

- [ ] **Step 4: Commit any remaining fixes**

If any tests or lints failed, fix the issues and commit:

```bash
git add -A
git commit -m "Fix integration issues for scrubber (#14)"
```

If everything passed, skip this step.

- [ ] **Step 5: Verify git log looks clean**

Run: `git log --oneline -10`

Expected: 5-6 clean commits on `feature/scrubber-progress-bar` branch:
1. Add design spec for scrubber/progress bar (#14)
2. Add seekTo method to RSVPStateMachine (#14)
3. Add timeElapsed and timeRemaining to RSVPStateMachine (#14)
4. Replace progress bar CSS with scrubber area styles (#14)
5. Replace progress bar DOM with scrubber slider (#14)
6. Bind scrubber events with pause-on-scrub and analytics (#14)
7. Add analytics-event handler to background script (#14)
