# SpeedReader v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a free Safari Web Extension that provides RSVP speed reading with focus-point highlighting on any web page, across iOS, iPadOS, and macOS.

**Architecture:** Safari Web Extension injects a Shadow DOM overlay onto web pages for RSVP display. Content script handles text extraction (Readability.js + selection fallback) and overlay lifecycle. Background script manages settings sync. SwiftUI container app provides settings UI and extension onboarding. Settings sync via App Group UserDefaults + browser.storage.

**Tech Stack:** Swift/SwiftUI (container app), JavaScript ES2020+ (extension), Readability.js (vendored), Shadow DOM, WebExtension APIs, XCTest (Swift tests), Node.js with built-in test runner (JS tests)

---

## File Map

| File | Responsibility | Task |
|------|---------------|------|
| `SpeedReader/SpeedReaderExtension/rsvp/word-processor.js` | Text splitting, punctuation delay calculation | 1 |
| `SpeedReader/SpeedReaderExtension/rsvp/focus-point.js` | ORP (optimal recognition point) calculation | 2 |
| `tests/js/word-processor.test.js` | Word processor tests | 1 |
| `tests/js/focus-point.test.js` | Focus point tests | 2 |
| `package.json` | Node test runner config (dev only, not bundled) | 1 |
| `Makefile` | Build/test commands | 1 |
| `SpeedReader/SpeedReaderExtension/rsvp/overlay.css` | Shadow DOM styles (light + dark, responsive) | 3 |
| `SpeedReader/SpeedReaderExtension/rsvp/overlay.js` | RSVP overlay UI, controls, keyboard/touch interaction | 4 |
| `SpeedReader/SpeedReaderExtension/lib/readability.js` | Vendored Mozilla Readability | 5 |
| `SpeedReader/SpeedReaderExtension/content.js` | Text extraction, overlay injection, selection fallback | 5 |
| `SpeedReader/SpeedReaderExtension/background.js` | Settings sync, message routing | 6 |
| `SpeedReader/SpeedReaderExtension/manifest.json` | WebExtension manifest | 6 |
| `SpeedReader/Shared/SettingsKeys.swift` | App Group keys and defaults | 7 |
| `SpeedReader/SpeedReader/Models/Settings.swift` | Observable settings model | 7 |
| `SpeedReader/SpeedReaderTests/SettingsTests.swift` | Settings model tests | 7 |
| `SpeedReader/SpeedReader/Views/SettingsView.swift` | WPM, font, theme controls | 8 |
| `SpeedReader/SpeedReader/Views/OnboardingView.swift` | Enable extension instructions | 8 |
| `SpeedReader/SpeedReader/Views/ContentView.swift` | Main app view (routes onboarding vs settings) | 8 |
| `SpeedReader/SpeedReader/SpeedReaderApp.swift` | App entry point | 8 |
| `SpeedReader/SpeedReaderExtension/fonts/OpenDyslexic-Regular.woff2` | Bundled OpenDyslexic font | 3 |

---

### Task 1: Word Processor Module

**Files:**
- Create: `SpeedReader/SpeedReaderExtension/rsvp/word-processor.js`
- Create: `tests/js/word-processor.test.js`
- Create: `package.json`
- Create: `Makefile`

This module splits raw text into a word array and calculates timing delays for each word based on punctuation.

- [ ] **Step 1: Create package.json for test runner**

```json
{
  "name": "speed-reader-tests",
  "private": true,
  "description": "Test runner for SpeedReader extension JavaScript (dev only, not bundled)",
  "scripts": {
    "test": "node --test tests/js/",
    "test:word-processor": "node --test tests/js/word-processor.test.js",
    "test:focus-point": "node --test tests/js/focus-point.test.js"
  }
}
```

Write this to `package.json` at the project root.

- [ ] **Step 2: Create Makefile**

```makefile
.PHONY: test-js test-swift test-all

test-js:
	node --test tests/js/

test-swift:
	xcodebuild test \
		-project SpeedReader/SpeedReader.xcodeproj \
		-scheme SpeedReader \
		-destination 'platform=macOS' \
		-quiet

test-all: test-js test-swift
```

Write this to `Makefile` at the project root.

- [ ] **Step 3: Write the failing tests for word-processor**

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { processText, calculateDelay } from '../../SpeedReader/SpeedReaderExtension/rsvp/word-processor.js';

describe('processText', () => {
  it('splits text into words on whitespace', () => {
    const result = processText('hello world');
    assert.deepStrictEqual(result.map(w => w.text), ['hello', 'world']);
  });

  it('handles multiple spaces between words', () => {
    const result = processText('hello   world');
    assert.deepStrictEqual(result.map(w => w.text), ['hello', 'world']);
  });

  it('preserves punctuation attached to words', () => {
    const result = processText('Hello, world.');
    assert.deepStrictEqual(result.map(w => w.text), ['Hello,', 'world.']);
  });

  it('returns empty array for empty string', () => {
    const result = processText('');
    assert.deepStrictEqual(result, []);
  });

  it('returns empty array for whitespace-only string', () => {
    const result = processText('   ');
    assert.deepStrictEqual(result, []);
  });

  it('assigns sequential indices to words', () => {
    const result = processText('one two three');
    assert.deepStrictEqual(result.map(w => w.index), [0, 1, 2]);
  });

  it('tracks sentence boundaries at periods', () => {
    const result = processText('First sentence. Second sentence.');
    const sentenceStarts = result.filter(w => w.sentenceStart).map(w => w.text);
    assert.deepStrictEqual(sentenceStarts, ['First', 'Second']);
  });

  it('tracks sentence boundaries at question marks', () => {
    const result = processText('Is this right? Yes it is.');
    const sentenceStarts = result.filter(w => w.sentenceStart).map(w => w.text);
    assert.deepStrictEqual(sentenceStarts, ['Is', 'Yes']);
  });

  it('tracks sentence boundaries at exclamation marks', () => {
    const result = processText('Wow! That is great.');
    const sentenceStarts = result.filter(w => w.sentenceStart).map(w => w.text);
    assert.deepStrictEqual(sentenceStarts, ['Wow!', 'That']);
  });
});

describe('calculateDelay', () => {
  const baseDelay = 240; // 250 WPM = 240ms per word

  it('returns base delay for words without punctuation', () => {
    const delay = calculateDelay('hello', baseDelay);
    assert.strictEqual(delay, baseDelay);
  });

  it('returns 1.5x delay for words ending with period', () => {
    const delay = calculateDelay('hello.', baseDelay);
    assert.strictEqual(delay, Math.round(baseDelay * 1.5));
  });

  it('returns 1.2x delay for words ending with comma', () => {
    const delay = calculateDelay('hello,', baseDelay);
    assert.strictEqual(delay, Math.round(baseDelay * 1.2));
  });

  it('returns 1.5x delay for words ending with question mark', () => {
    const delay = calculateDelay('why?', baseDelay);
    assert.strictEqual(delay, Math.round(baseDelay * 1.5));
  });

  it('returns 1.5x delay for words ending with exclamation mark', () => {
    const delay = calculateDelay('wow!', baseDelay);
    assert.strictEqual(delay, Math.round(baseDelay * 1.5));
  });

  it('returns 1.2x delay for words ending with semicolon', () => {
    const delay = calculateDelay('here;', baseDelay);
    assert.strictEqual(delay, Math.round(baseDelay * 1.2));
  });

  it('returns 1.2x delay for words ending with colon', () => {
    const delay = calculateDelay('note:', baseDelay);
    assert.strictEqual(delay, Math.round(baseDelay * 1.2));
  });
});
```

Write this to `tests/js/word-processor.test.js`.

- [ ] **Step 4: Run tests to verify they fail**

Run: `node --test tests/js/word-processor.test.js`
Expected: FAIL — module not found

- [ ] **Step 5: Implement word-processor.js**

```javascript
/**
 * Splits raw text into an array of word objects with metadata.
 * Each word object: { text, index, sentenceStart }
 *
 * @param {string} text - Raw text to process
 * @returns {Array<{text: string, index: number, sentenceStart: boolean}>}
 */
export function processText(text) {
  if (!text || !text.trim()) return [];

  const words = text.split(/\s+/).filter(w => w.length > 0);
  let nextIsSentenceStart = true;

  return words.map((word, index) => {
    const entry = {
      text: word,
      index,
      sentenceStart: nextIsSentenceStart,
    };

    // Check if this word ends a sentence
    nextIsSentenceStart = /[.!?]$/.test(word);

    return entry;
  });
}

/**
 * Calculates display duration for a word based on punctuation.
 * Period/question/exclamation = 1.5x, comma/colon/semicolon = 1.2x.
 *
 * @param {string} word - The word text (may include trailing punctuation)
 * @param {number} baseDelay - Base delay in ms (derived from WPM)
 * @returns {number} Adjusted delay in ms
 */
export function calculateDelay(word, baseDelay) {
  const lastChar = word[word.length - 1];

  if ('.!?'.includes(lastChar)) {
    return Math.round(baseDelay * 1.5);
  }
  if (',:;'.includes(lastChar)) {
    return Math.round(baseDelay * 1.2);
  }

  return baseDelay;
}

/**
 * Converts WPM to base delay in milliseconds.
 *
 * @param {number} wpm - Words per minute
 * @returns {number} Delay in ms per word
 */
export function wpmToDelay(wpm) {
  return Math.round(60000 / wpm);
}
```

Write this to `SpeedReader/SpeedReaderExtension/rsvp/word-processor.js`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test tests/js/word-processor.test.js`
Expected: All 13 tests PASS

- [ ] **Step 7: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/rsvp/word-processor.js tests/js/word-processor.test.js package.json Makefile
git commit -m "feat: add word processor with punctuation timing"
```

---

### Task 2: Focus Point Calculator

**Files:**
- Create: `SpeedReader/SpeedReaderExtension/rsvp/focus-point.js`
- Create: `tests/js/focus-point.test.js`

Pure function that calculates the optimal recognition point (ORP) for a word — the letter index that gets highlighted in the accent color.

- [ ] **Step 1: Write the failing tests**

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateFocusPoint, splitWordAtFocus } from '../../SpeedReader/SpeedReaderExtension/rsvp/focus-point.js';

describe('calculateFocusPoint', () => {
  it('returns 0 for single-character words', () => {
    assert.strictEqual(calculateFocusPoint('I'), 0);
  });

  it('returns 0 for two-character words', () => {
    assert.strictEqual(calculateFocusPoint('it'), 0);
  });

  it('returns 0 for three-character words', () => {
    assert.strictEqual(calculateFocusPoint('the'), 0);
  });

  it('returns index at ~30% for longer words', () => {
    // "hello" length 5 → floor(5 * 0.3) = 1 → 'e'
    assert.strictEqual(calculateFocusPoint('hello'), 1);
  });

  it('calculates correctly for "comprehension"', () => {
    // "comprehension" length 13 → floor(13 * 0.3) = 3 → 'p'
    assert.strictEqual(calculateFocusPoint('comprehension'), 3);
  });

  it('calculates correctly for "reading"', () => {
    // "reading" length 7 → floor(7 * 0.3) = 2 → 'a'
    assert.strictEqual(calculateFocusPoint('reading'), 2);
  });

  it('handles words with trailing punctuation by ignoring punctuation', () => {
    // "hello," → strip punctuation → "hello" length 5 → floor(5 * 0.3) = 1
    assert.strictEqual(calculateFocusPoint('hello,'), 1);
  });

  it('handles words with trailing period', () => {
    // "world." → strip → "world" length 5 → floor(5 * 0.3) = 1
    assert.strictEqual(calculateFocusPoint('world.'), 1);
  });
});

describe('splitWordAtFocus', () => {
  it('splits word into before, focus, after parts', () => {
    const result = splitWordAtFocus('comprehension');
    assert.deepStrictEqual(result, {
      before: 'com',
      focus: 'p',
      after: 'rehension',
    });
  });

  it('splits single-char word correctly', () => {
    const result = splitWordAtFocus('I');
    assert.deepStrictEqual(result, {
      before: '',
      focus: 'I',
      after: '',
    });
  });

  it('splits short word correctly', () => {
    const result = splitWordAtFocus('the');
    assert.deepStrictEqual(result, {
      before: '',
      focus: 't',
      after: 'he',
    });
  });

  it('preserves trailing punctuation in after part', () => {
    const result = splitWordAtFocus('hello,');
    assert.deepStrictEqual(result, {
      before: 'h',
      focus: 'e',
      after: 'llo,',
    });
  });
});
```

Write this to `tests/js/focus-point.test.js`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/js/focus-point.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement focus-point.js**

```javascript
/**
 * Calculates the optimal recognition point (ORP) index for a word.
 * For short words (1-3 chars), returns 0 (first character).
 * For longer words, returns the index at ~30% of the word length,
 * ignoring trailing punctuation.
 *
 * @param {string} word - The word (may include trailing punctuation)
 * @returns {number} Index of the focus character
 */
export function calculateFocusPoint(word) {
  const stripped = word.replace(/[.,!?;:]+$/, '');
  if (stripped.length <= 3) return 0;
  return Math.floor(stripped.length * 0.3);
}

/**
 * Splits a word into three parts around the focus point:
 * before (dimmer), focus (highlighted), after (dimmer).
 *
 * @param {string} word - The word to split
 * @returns {{ before: string, focus: string, after: string }}
 */
export function splitWordAtFocus(word) {
  const focusIndex = calculateFocusPoint(word);
  return {
    before: word.slice(0, focusIndex),
    focus: word[focusIndex],
    after: word.slice(focusIndex + 1),
  };
}
```

Write this to `SpeedReader/SpeedReaderExtension/rsvp/focus-point.js`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/js/focus-point.test.js`
Expected: All 12 tests PASS

- [ ] **Step 5: Run all JS tests**

Run: `node --test tests/js/`
Expected: All 25 tests PASS (13 word-processor + 12 focus-point)

- [ ] **Step 6: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/rsvp/focus-point.js tests/js/focus-point.test.js
git commit -m "feat: add focus point (ORP) calculator"
```

---

### Task 3: RSVP Overlay Styles

**Files:**
- Create: `SpeedReader/SpeedReaderExtension/rsvp/overlay.css`
- Download: `SpeedReader/SpeedReaderExtension/fonts/OpenDyslexic-Regular.woff2`

Shadow DOM styles for the RSVP reader overlay. All styles are scoped inside the shadow root, so they cannot leak to or be affected by the host page.

- [ ] **Step 1: Download OpenDyslexic font**

```bash
mkdir -p SpeedReader/SpeedReaderExtension/fonts
curl -L -o SpeedReader/SpeedReaderExtension/fonts/OpenDyslexic-Regular.woff2 \
  "https://github.com/antijingoist/opendyslexic/raw/master/compiled/OpenDyslexic-Regular.woff2"
```

If the URL is unavailable, search for the latest release on the OpenDyslexic GitHub repo and download the `.woff2` file.

- [ ] **Step 2: Write overlay.css**

```css
/* SpeedReader RSVP Overlay — Shadow DOM Styles */

@font-face {
  font-family: 'OpenDyslexic';
  src: url('../fonts/OpenDyslexic-Regular.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

:host {
  --sr-accent: #e74c3c;
  --sr-accent-soft: #ff6b6b;
  --sr-bg: #ffffff;
  --sr-bg-secondary: #f5f5f5;
  --sr-text: #333333;
  --sr-text-dim: #aaaaaa;
  --sr-text-muted: #888888;
  --sr-border: #eeeeee;
  --sr-overlay-bg: rgba(0, 0, 0, 0.5);
  --sr-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  --sr-card-radius: 16px;
  --sr-font-family: -apple-system, system-ui, 'Helvetica Neue', sans-serif;
  --sr-word-size: 42px;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  :host(:not([data-theme="light"])) {
    --sr-accent: #ff6b6b;
    --sr-bg: #2a2a2a;
    --sr-bg-secondary: #222222;
    --sr-text: #dddddd;
    --sr-text-dim: #555555;
    --sr-text-muted: #777777;
    --sr-border: #333333;
    --sr-overlay-bg: rgba(0, 0, 0, 0.7);
    --sr-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }
}

/* Explicit dark override */
:host([data-theme="dark"]) {
  --sr-accent: #ff6b6b;
  --sr-bg: #2a2a2a;
  --sr-bg-secondary: #222222;
  --sr-text: #dddddd;
  --sr-text-dim: #555555;
  --sr-text-muted: #777777;
  --sr-border: #333333;
  --sr-overlay-bg: rgba(0, 0, 0, 0.7);
  --sr-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

/* OpenDyslexic font override */
:host([data-font="opendyslexic"]) {
  --sr-font-family: 'OpenDyslexic', sans-serif;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.sr-backdrop {
  position: fixed;
  inset: 0;
  background: var(--sr-overlay-bg);
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--sr-font-family);
}

.sr-card {
  background: var(--sr-bg);
  border-radius: var(--sr-card-radius);
  padding: 24px;
  width: 520px;
  max-width: calc(100vw - 32px);
  box-shadow: var(--sr-shadow);
  user-select: none;
  -webkit-user-select: none;
}

/* --- Header --- */

.sr-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.sr-title {
  font-size: 13px;
  color: var(--sr-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 80%;
}

.sr-close {
  background: none;
  border: none;
  font-size: 18px;
  color: var(--sr-text-muted);
  cursor: pointer;
  padding: 4px;
  line-height: 1;
}

.sr-close:hover {
  color: var(--sr-text);
}

/* --- Word Display --- */

.sr-word-area {
  text-align: center;
  padding: 36px 0;
  border-top: 1px solid var(--sr-border);
  border-bottom: 1px solid var(--sr-border);
  cursor: pointer;
}

.sr-focus-marker {
  color: var(--sr-accent);
  font-size: 10px;
  margin-bottom: 4px;
}

.sr-word {
  font-size: var(--sr-word-size);
  font-weight: 300;
  letter-spacing: 2px;
  font-family: var(--sr-font-family);
}

.sr-word-before,
.sr-word-after {
  color: var(--sr-text);
}

.sr-word-focus {
  color: var(--sr-accent);
  font-weight: 600;
}

/* --- Context Preview --- */

.sr-context {
  background: var(--sr-bg-secondary);
  border-radius: 8px;
  padding: 12px;
  margin-top: 14px;
  font-size: 13px;
  color: var(--sr-text-muted);
  line-height: 1.6;
  display: none;
}

.sr-context[data-visible="true"] {
  display: block;
}

.sr-context-label {
  color: var(--sr-text-dim);
  display: block;
  margin-bottom: 4px;
}

.sr-context-highlight {
  background: rgba(255, 243, 205, 0.8);
  padding: 2px 4px;
  border-radius: 3px;
  color: var(--sr-text);
}

@media (prefers-color-scheme: dark) {
  :host(:not([data-theme="light"])) .sr-context-highlight {
    background: rgba(61, 53, 32, 0.8);
  }
}

:host([data-theme="dark"]) .sr-context-highlight {
  background: rgba(61, 53, 32, 0.8);
}

/* --- Controls --- */

.sr-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-top: 18px;
}

.sr-control-group {
  text-align: center;
}

.sr-btn {
  background: none;
  border: none;
  font-size: 22px;
  color: var(--sr-text-muted);
  cursor: pointer;
  padding: 8px;
  line-height: 1;
}

.sr-btn:hover {
  color: var(--sr-text);
}

.sr-btn-play {
  background: var(--sr-accent);
  border: none;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  color: white;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sr-btn-play:hover {
  filter: brightness(1.1);
}

.sr-shortcut-hint {
  font-size: 9px;
  color: var(--sr-text-dim);
  margin-top: 2px;
}

/* --- WPM Slider --- */

.sr-slider-area {
  margin-top: 16px;
}

.sr-slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--sr-text-muted);
  margin-bottom: 8px;
}

.sr-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  background: var(--sr-border);
  border-radius: 4px;
  outline: none;
}

.sr-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  background: var(--sr-accent);
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid var(--sr-bg);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

/* --- Progress Bar --- */

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

/* --- Toast --- */

.sr-toast {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--sr-bg);
  color: var(--sr-text);
  padding: 12px 20px;
  border-radius: 10px;
  font-size: 14px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  z-index: 2147483647;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.sr-toast[data-visible="true"] {
  opacity: 1;
}

/* --- Responsive: iPhone --- */

@media (max-width: 480px) {
  .sr-card {
    width: calc(100vw - 24px);
    padding: 16px;
  }

  :host {
    --sr-word-size: 36px;
  }

  .sr-btn-play {
    width: 52px;
    height: 52px;
    font-size: 20px;
  }

  .sr-btn {
    font-size: 24px;
    padding: 10px;
  }

  .sr-context {
    margin-top: 8px;
    font-size: 12px;
  }

  .sr-shortcut-hint {
    display: none;
  }
}

/* --- Responsive: iPad --- */

@media (min-width: 481px) and (max-width: 1024px) {
  .sr-card {
    width: 480px;
  }
}

/* --- Reduce Motion --- */

@media (prefers-reduced-motion: reduce) {
  .sr-progress-fill {
    transition: none;
  }

  .sr-toast {
    transition: none;
  }
}
```

Write this to `SpeedReader/SpeedReaderExtension/rsvp/overlay.css`.

- [ ] **Step 3: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/rsvp/overlay.css SpeedReader/SpeedReaderExtension/fonts/
git commit -m "feat: add RSVP overlay styles and OpenDyslexic font"
```

---

### Task 4: RSVP Overlay Controller

**Files:**
- Create: `SpeedReader/SpeedReaderExtension/rsvp/overlay.js`

The overlay controller builds the Shadow DOM, manages playback state, handles keyboard/touch interaction, and renders the RSVP display. It imports word-processor and focus-point modules.

- [ ] **Step 1: Write overlay.js**

```javascript
import { processText, calculateDelay, wpmToDelay } from './word-processor.js';
import { splitWordAtFocus } from './focus-point.js';

/**
 * Creates and manages the RSVP reader overlay.
 * All UI lives inside a Shadow DOM attached to a host element.
 */
export class RSVPOverlay {
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
  }

  /**
   * Opens the overlay with the given text and title.
   * @param {string} text - Article text to display
   * @param {string} title - Article title for the header
   * @param {object} settings - User settings from browser.storage
   */
  open(text, title, settings = {}) {
    if (this.host) this.close();

    Object.assign(this.settings, settings);
    if (settings.wpm) this.wpm = settings.wpm;

    this.title = title || '';
    this.words = processText(text);
    this.currentIndex = 0;
    this.isPlaying = false;

    if (this.words.length === 0) {
      this._showPageToast('No readable content found.');
      return;
    }

    this._createDOM();
    this._bindEvents();
    this._renderWord();
    this._updateProgress();
  }

  /** Closes and removes the overlay from the page. */
  close() {
    this.pause();
    if (this.host && this.host.parentNode) {
      this.host.parentNode.removeChild(this.host);
    }
    this.host = null;
    this.shadow = null;
    this.elements = {};
    document.removeEventListener('keydown', this._handleKeyDown);
  }

  /** Starts or resumes playback. */
  play() {
    if (this.currentIndex >= this.words.length) {
      this.currentIndex = 0;
    }
    this.isPlaying = true;
    this._updatePlayButton();
    this._hideContext();
    this._tick();
  }

  /** Pauses playback and shows context preview. */
  pause() {
    this.isPlaying = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this._updatePlayButton();
    this._showContext();
  }

  /** Toggles between play and pause. */
  togglePlayPause() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /** Jumps to the start of the previous sentence. */
  prevSentence() {
    this.pause();
    for (let i = this.currentIndex - 1; i >= 0; i--) {
      if (this.words[i].sentenceStart) {
        this.currentIndex = i;
        this._renderWord();
        this._updateProgress();
        this._showContext();
        return;
      }
    }
    this.currentIndex = 0;
    this._renderWord();
    this._updateProgress();
    this._showContext();
  }

  /** Jumps to the start of the next sentence. */
  nextSentence() {
    this.pause();
    for (let i = this.currentIndex + 1; i < this.words.length; i++) {
      if (this.words[i].sentenceStart) {
        this.currentIndex = i;
        this._renderWord();
        this._updateProgress();
        this._showContext();
        return;
      }
    }
  }

  /** Adjusts WPM by the given delta (positive or negative). */
  adjustWpm(delta) {
    this.wpm = Math.max(100, Math.min(600, this.wpm + delta));
    if (this.elements.wpmLabel) {
      this.elements.wpmLabel.textContent = `${this.wpm} WPM`;
    }
    if (this.elements.wpmSlider) {
      this.elements.wpmSlider.value = this.wpm;
    }
  }

  // --- Private Methods ---

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

    this.timerId = setTimeout(() => this._tick(), delay);
  }

  _renderWord() {
    if (this.currentIndex >= this.words.length) return;

    const word = this.words[this.currentIndex];
    const parts = splitWordAtFocus(word.text);

    this.elements.wordBefore.textContent = parts.before;
    this.elements.wordFocus.textContent = parts.focus;
    this.elements.wordAfter.textContent = parts.after;
  }

  _updateProgress() {
    const pct = this.words.length > 0
      ? Math.round((this.currentIndex / this.words.length) * 100)
      : 0;

    if (this.elements.progressFill) {
      this.elements.progressFill.style.width = `${pct}%`;
    }
    if (this.elements.progressLabel) {
      this.elements.progressLabel.textContent = `${pct}%`;
    }
  }

  _updatePlayButton() {
    if (this.elements.playBtn) {
      this.elements.playBtn.textContent = this.isPlaying ? '⏸' : '▶';
    }
  }

  _showContext() {
    if (!this.elements.context) return;
    this.elements.context.setAttribute('data-visible', 'true');

    const wordObj = this.words[this.currentIndex] || this.words[this.words.length - 1];
    if (!wordObj) return;

    // Find sentence boundaries
    let sentenceStart = wordObj.index;
    for (let i = wordObj.index; i >= 0; i--) {
      if (this.words[i].sentenceStart) {
        sentenceStart = i;
        break;
      }
    }

    let sentenceEnd = this.words.length - 1;
    for (let i = wordObj.index + 1; i < this.words.length; i++) {
      if (this.words[i].sentenceStart) {
        sentenceEnd = i - 1;
        break;
      }
    }

    // Build context using safe DOM methods (no innerHTML)
    const contextContent = this.elements.contextContent;
    while (contextContent.firstChild) {
      contextContent.removeChild(contextContent.firstChild);
    }

    const beforeWords = this.words.slice(sentenceStart, wordObj.index).map(w => w.text).join(' ');
    const currentWord = wordObj.text;
    const afterWords = this.words.slice(wordObj.index + 1, sentenceEnd + 1).map(w => w.text).join(' ');

    if (beforeWords) {
      const span = document.createElement('span');
      span.textContent = beforeWords + ' ';
      contextContent.appendChild(span);
    }

    const highlight = document.createElement('span');
    highlight.className = 'sr-context-highlight';
    highlight.textContent = currentWord;
    contextContent.appendChild(highlight);

    if (afterWords) {
      const span = document.createElement('span');
      span.textContent = ' ' + afterWords;
      contextContent.appendChild(span);
    }
  }

  _hideContext() {
    if (this.elements.context) {
      this.elements.context.setAttribute('data-visible', 'false');
    }
  }

  _showPageToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      background: #333; color: #fff; padding: 12px 20px; border-radius: 10px;
      font-size: 14px; z-index: 2147483647; font-family: -apple-system, system-ui, sans-serif;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  _createDOM() {
    this.host = document.createElement('speed-reader-overlay');
    this.shadow = this.host.attachShadow({ mode: 'closed' });

    // Apply theme and font attributes
    if (this.settings.theme && this.settings.theme !== 'system') {
      this.host.setAttribute('data-theme', this.settings.theme);
    }
    if (this.settings.font === 'opendyslexic') {
      this.host.setAttribute('data-font', 'opendyslexic');
    }

    // Link stylesheet
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = browser.runtime.getURL('rsvp/overlay.css');
    this.shadow.appendChild(link);

    // Build DOM structure
    const backdrop = document.createElement('div');
    backdrop.className = 'sr-backdrop';

    const card = document.createElement('div');
    card.className = 'sr-card';

    // Header
    const header = document.createElement('div');
    header.className = 'sr-header';

    const title = document.createElement('span');
    title.className = 'sr-title';
    title.textContent = this.title;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'sr-close';
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Close reader');

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Word display area
    const wordArea = document.createElement('div');
    wordArea.className = 'sr-word-area';
    wordArea.setAttribute('role', 'status');
    wordArea.setAttribute('aria-live', 'polite');
    wordArea.setAttribute('aria-label', 'Current word');

    const focusMarker = document.createElement('div');
    focusMarker.className = 'sr-focus-marker';
    focusMarker.textContent = '▼';

    const wordContainer = document.createElement('div');
    wordContainer.className = 'sr-word';

    const wordBefore = document.createElement('span');
    wordBefore.className = 'sr-word-before';

    const wordFocus = document.createElement('span');
    wordFocus.className = 'sr-word-focus';

    const wordAfter = document.createElement('span');
    wordAfter.className = 'sr-word-after';

    wordContainer.appendChild(wordBefore);
    wordContainer.appendChild(wordFocus);
    wordContainer.appendChild(wordAfter);
    wordArea.appendChild(focusMarker);
    wordArea.appendChild(wordContainer);

    // Context preview
    const context = document.createElement('div');
    context.className = 'sr-context';

    const contextLabel = document.createElement('span');
    contextLabel.className = 'sr-context-label';
    contextLabel.textContent = '▸ Paused — context:';

    const contextContent = document.createElement('div');

    context.appendChild(contextLabel);
    context.appendChild(contextContent);

    // Controls
    const controls = document.createElement('div');
    controls.className = 'sr-controls';

    const prevGroup = document.createElement('div');
    prevGroup.className = 'sr-control-group';
    const prevBtn = document.createElement('button');
    prevBtn.className = 'sr-btn';
    prevBtn.textContent = '⏮';
    prevBtn.setAttribute('aria-label', 'Previous sentence');
    const prevHint = document.createElement('div');
    prevHint.className = 'sr-shortcut-hint';
    prevHint.textContent = '← key';
    prevGroup.appendChild(prevBtn);
    prevGroup.appendChild(prevHint);

    const playGroup = document.createElement('div');
    playGroup.className = 'sr-control-group';
    const playBtn = document.createElement('button');
    playBtn.className = 'sr-btn-play';
    playBtn.textContent = '▶';
    playBtn.setAttribute('aria-label', 'Play or pause');
    const playHint = document.createElement('div');
    playHint.className = 'sr-shortcut-hint';
    playHint.textContent = 'Space';
    playGroup.appendChild(playBtn);
    playGroup.appendChild(playHint);

    const nextGroup = document.createElement('div');
    nextGroup.className = 'sr-control-group';
    const nextBtn = document.createElement('button');
    nextBtn.className = 'sr-btn';
    nextBtn.textContent = '⏭';
    nextBtn.setAttribute('aria-label', 'Next sentence');
    const nextHint = document.createElement('div');
    nextHint.className = 'sr-shortcut-hint';
    nextHint.textContent = '→ key';
    nextGroup.appendChild(nextBtn);
    nextGroup.appendChild(nextHint);

    controls.appendChild(prevGroup);
    controls.appendChild(playGroup);
    controls.appendChild(nextGroup);

    // WPM Slider
    const sliderArea = document.createElement('div');
    sliderArea.className = 'sr-slider-area';

    const sliderLabels = document.createElement('div');
    sliderLabels.className = 'sr-slider-labels';
    const wpmLabel = document.createElement('span');
    wpmLabel.textContent = `${this.wpm} WPM`;
    const wpmHint = document.createElement('span');
    wpmHint.className = 'sr-shortcut-hint';
    wpmHint.textContent = '↑↓ to adjust';
    sliderLabels.appendChild(wpmLabel);
    sliderLabels.appendChild(wpmHint);

    const slider = document.createElement('input');
    slider.className = 'sr-slider';
    slider.type = 'range';
    slider.min = '100';
    slider.max = '600';
    slider.value = this.wpm;
    slider.setAttribute('aria-label', 'Words per minute');

    sliderArea.appendChild(sliderLabels);
    sliderArea.appendChild(slider);

    // Progress bar
    const progressArea = document.createElement('div');
    progressArea.className = 'sr-progress-area';

    const progressLabels = document.createElement('div');
    progressLabels.className = 'sr-progress-labels';
    const progressWpmLabel = document.createElement('span');
    progressWpmLabel.textContent = `${this.words.length} words`;
    const progressPctLabel = document.createElement('span');
    progressPctLabel.textContent = '0%';
    progressLabels.appendChild(progressWpmLabel);
    progressLabels.appendChild(progressPctLabel);

    const progressTrack = document.createElement('div');
    progressTrack.className = 'sr-progress-track';
    const progressFill = document.createElement('div');
    progressFill.className = 'sr-progress-fill';
    progressTrack.appendChild(progressFill);

    progressArea.appendChild(progressLabels);
    progressArea.appendChild(progressTrack);

    // Assemble card
    card.appendChild(header);
    card.appendChild(wordArea);
    card.appendChild(context);
    card.appendChild(controls);
    card.appendChild(sliderArea);
    card.appendChild(progressArea);
    backdrop.appendChild(card);
    this.shadow.appendChild(backdrop);
    document.body.appendChild(this.host);

    // Store element references
    this.elements = {
      backdrop,
      card,
      closeBtn,
      wordArea,
      wordBefore,
      wordFocus,
      wordAfter,
      context,
      contextContent,
      prevBtn,
      playBtn,
      nextBtn,
      wpmLabel,
      wpmSlider: slider,
      progressFill,
      progressLabel: progressPctLabel,
    };
  }

  _bindEvents() {
    this.elements.closeBtn.addEventListener('click', () => this.close());
    this.elements.wordArea.addEventListener('click', () => this.togglePlayPause());
    this.elements.playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePlayPause();
    });
    this.elements.prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.prevSentence();
    });
    this.elements.nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.nextSentence();
    });
    this.elements.wpmSlider.addEventListener('input', (e) => {
      this.wpm = parseInt(e.target.value, 10);
      this.elements.wpmLabel.textContent = `${this.wpm} WPM`;
    });

    // Click on backdrop (outside card) closes overlay
    this.elements.backdrop.addEventListener('click', (e) => {
      if (e.target === this.elements.backdrop) {
        this.close();
      }
    });

    // Keyboard shortcuts
    this._handleKeyDown = (e) => {
      if (!this.host) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          this.togglePlayPause();
          break;
        case 'Escape':
          this.close();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.prevSentence();
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.nextSentence();
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.adjustWpm(25);
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.adjustWpm(-25);
          break;
      }
    };
    document.addEventListener('keydown', this._handleKeyDown);
  }
}
```

Write this to `SpeedReader/SpeedReaderExtension/rsvp/overlay.js`.

- [ ] **Step 2: Verify no syntax errors**

Run: `node -e "import('./SpeedReader/SpeedReaderExtension/rsvp/overlay.js').catch(e => { console.error(e.message); process.exit(1); })"`

Expected: Fails with "browser is not defined" (expected — `browser` API only exists in Safari), NOT a syntax error.

Note: Full integration testing requires running in Safari. Unit-testable logic lives in word-processor.js and focus-point.js. The overlay controller will be tested via manual Safari testing.

- [ ] **Step 3: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/rsvp/overlay.js
git commit -m "feat: add RSVP overlay controller with playback and keyboard controls"
```

---

### Task 5: Content Script & Text Extraction

**Files:**
- Create: `SpeedReader/SpeedReaderExtension/content.js`
- Download: `SpeedReader/SpeedReaderExtension/lib/readability.js`

The content script is the entry point injected into web pages. It handles text extraction via Readability.js, the text selection fallback, and overlay lifecycle.

- [ ] **Step 1: Download Readability.js**

Download Mozilla's Readability.js from its official GitHub repository:

```bash
mkdir -p SpeedReader/SpeedReaderExtension/lib
curl -L -o SpeedReader/SpeedReaderExtension/lib/Readability.js \
  "https://raw.githubusercontent.com/nickstenning/readability/main/Readability.js"
```

**Verification:** The file should define a `Readability` class/constructor that accepts a DOM document. Open the downloaded file and confirm it exports `Readability`. If the file uses CommonJS (`module.exports`), add an ESM export wrapper at the end:

```javascript
export { Readability };
```

**Alternative source** if the above URL is unavailable: use the `@nickstenning/readability` npm package or Mozilla's `@mozilla/readability` package. Download, extract, and copy the main JS file.

- [ ] **Step 2: Write content.js**

```javascript
import { RSVPOverlay } from './rsvp/overlay.js';

const overlay = new RSVPOverlay();
let pendingSelectionMode = false;

/**
 * Extracts article text from the current page using Readability.js.
 * Falls back to user text selection if extraction fails.
 */
async function extractAndLaunch() {
  // Check for user text selection first
  const selection = window.getSelection();
  if (selection && selection.toString().trim().length > 0) {
    const text = selection.toString().trim();
    overlay.open(text, document.title, await getSettings());
    pendingSelectionMode = false;
    return;
  }

  // If we're in selection fallback mode, remind user to select text
  if (pendingSelectionMode) {
    showToast('Select some text on the page, then tap the extension icon again.');
    return;
  }

  try {
    // Dynamic import for Readability (loaded as a separate script)
    const { Readability } = await import(browser.runtime.getURL('lib/Readability.js'));

    // Clone the document so Readability doesn't mutate the live DOM
    const docClone = document.cloneNode(true);
    const reader = new Readability(docClone);
    const article = reader.parse();

    if (article && article.textContent && article.textContent.trim().length > 0) {
      const settings = await getSettings();
      overlay.open(article.textContent.trim(), article.title || document.title, settings);
    } else {
      // Extraction failed — fall back to selection mode
      pendingSelectionMode = true;
      showToast("Couldn't extract article. Select text and tap the extension icon again.");
    }
  } catch (error) {
    console.error('[SpeedReader] Extraction failed:', error);
    pendingSelectionMode = true;
    showToast("Couldn't extract article. Select text and tap the extension icon again.");
  }
}

/**
 * Fetches user settings from browser.storage.
 */
async function getSettings() {
  try {
    const stored = await browser.storage.sync.get({
      wpm: 250,
      font: 'system',
      theme: 'system',
      fontSize: 42,
      punctuationPause: true,
    });
    return stored;
  } catch {
    return {
      wpm: 250,
      font: 'system',
      theme: 'system',
      fontSize: 42,
      punctuationPause: true,
    };
  }
}

/**
 * Shows a temporary toast message on the page.
 */
function showToast(message) {
  const existing = document.querySelector('.speed-reader-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'speed-reader-toast';
  toast.style.cssText = `
    position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
    background: #333; color: #fff; padding: 12px 20px; border-radius: 10px;
    font-size: 14px; z-index: 2147483647; font-family: -apple-system, system-ui, sans-serif;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// Listen for messages from background script (triggered by toolbar icon tap)
browser.runtime.onMessage.addListener((message) => {
  if (message.action === 'toggle-reader') {
    if (overlay.host) {
      overlay.close();
    } else {
      extractAndLaunch();
    }
  }
});
```

Write this to `SpeedReader/SpeedReaderExtension/content.js`.

- [ ] **Step 3: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/content.js SpeedReader/SpeedReaderExtension/lib/
git commit -m "feat: add content script with Readability.js text extraction"
```

---

### Task 6: Background Script & Manifest

**Files:**
- Create: `SpeedReader/SpeedReaderExtension/background.js`
- Create: `SpeedReader/SpeedReaderExtension/manifest.json`

The background script routes toolbar icon clicks to the content script and manages settings storage. The manifest declares extension permissions and resources.

- [ ] **Step 1: Write background.js**

```javascript
// Send toggle message to active tab when toolbar icon is clicked
browser.action.onClicked.addListener(async (tab) => {
  try {
    await browser.tabs.sendMessage(tab.id, { action: 'toggle-reader' });
  } catch (error) {
    console.error('[SpeedReader] Could not reach content script:', error);
  }
});

// Initialize default settings on install
browser.runtime.onInstalled.addListener(() => {
  browser.storage.sync.get({
    wpm: null,
  }).then((result) => {
    if (result.wpm === null) {
      browser.storage.sync.set({
        wpm: 250,
        font: 'system',
        theme: 'system',
        fontSize: 42,
        punctuationPause: true,
      });
    }
  });
});
```

Write this to `SpeedReader/SpeedReaderExtension/background.js`.

- [ ] **Step 2: Write manifest.json**

```json
{
  "manifest_version": 3,
  "name": "SpeedReader",
  "version": "1.0.0",
  "description": "Free RSVP speed reading for any web page. Built for accessibility.",
  "permissions": [
    "activeTab",
    "storage"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_title": "SpeedReader"
  },
  "web_accessible_resources": [
    {
      "resources": [
        "rsvp/overlay.css",
        "rsvp/overlay.js",
        "rsvp/word-processor.js",
        "rsvp/focus-point.js",
        "lib/Readability.js",
        "fonts/OpenDyslexic-Regular.woff2"
      ],
      "matches": ["<all_urls>"]
    }
  ],
  "icons": {
    "48": "images/icon-48.png",
    "96": "images/icon-96.png",
    "128": "images/icon-128.png",
    "256": "images/icon-256.png"
  }
}
```

Write this to `SpeedReader/SpeedReaderExtension/manifest.json`.

**Note:** Icon images will be created in Task 8 as part of the Xcode project setup. The manifest references them but they aren't required for initial development and testing.

**Important Safari-specific note:** Safari Web Extensions use Manifest V3 but with `browser.*` APIs (not `chrome.*`). The `content_scripts` field with ES module imports may require validation — if Safari doesn't support `import` in content scripts loaded via manifest, the content script will need to be restructured as a single bundled file or use dynamic `import()` for the RSVP modules. Validate during Task 8 Xcode setup.

- [ ] **Step 3: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/background.js SpeedReader/SpeedReaderExtension/manifest.json
git commit -m "feat: add background script and WebExtension manifest"
```

---

### Task 7: Shared Settings Model (Swift)

**Files:**
- Create: `SpeedReader/Shared/SettingsKeys.swift`
- Create: `SpeedReader/SpeedReader/Models/Settings.swift`
- Create: `SpeedReader/SpeedReaderTests/SettingsTests.swift`

The settings model is shared between the SwiftUI app and the extension's native host. It reads/writes to an App Group UserDefaults suite.

- [ ] **Step 1: Write the failing test**

```swift
import XCTest
@testable import SpeedReader

final class SettingsTests: XCTestCase {
    func testDefaultWPM() {
        let settings = ReaderSettings()
        XCTAssertEqual(settings.wpm, 250)
    }

    func testWPMClampedToMinimum() {
        let settings = ReaderSettings()
        settings.wpm = 50
        XCTAssertEqual(settings.wpm, 100)
    }

    func testWPMClampedToMaximum() {
        let settings = ReaderSettings()
        settings.wpm = 800
        XCTAssertEqual(settings.wpm, 600)
    }

    func testDefaultFont() {
        let settings = ReaderSettings()
        XCTAssertEqual(settings.font, .system)
    }

    func testDefaultTheme() {
        let settings = ReaderSettings()
        XCTAssertEqual(settings.theme, .system)
    }

    func testDefaultPunctuationPause() {
        let settings = ReaderSettings()
        XCTAssertTrue(settings.punctuationPause)
    }

    func testDefaultFontSize() {
        let settings = ReaderSettings()
        XCTAssertEqual(settings.fontSize, 42)
    }
}
```

Write this to `SpeedReader/SpeedReaderTests/SettingsTests.swift`.

- [ ] **Step 2: Write SettingsKeys.swift**

```swift
import Foundation

/// Constants for App Group settings shared between the app and extension.
enum SettingsKeys {
    /// App Group identifier — must match the entitlements file.
    static let appGroupID = "group.com.speedreader.shared"

    static let wpm = "sr_wpm"
    static let font = "sr_font"
    static let theme = "sr_theme"
    static let fontSize = "sr_fontSize"
    static let punctuationPause = "sr_punctuationPause"

    /// Default values
    enum Defaults {
        static let wpm = 250
        static let font = "system"
        static let theme = "system"
        static let fontSize = 42
        static let punctuationPause = true
    }

    /// WPM bounds
    static let wpmMin = 100
    static let wpmMax = 600

    /// Font size bounds
    static let fontSizeMin = 28
    static let fontSizeMax = 64
}
```

Write this to `SpeedReader/Shared/SettingsKeys.swift`.

- [ ] **Step 3: Write Settings.swift**

```swift
import Foundation
import SwiftUI

/// Font options for the RSVP reader.
enum ReaderFont: String, CaseIterable, Identifiable {
    case system = "system"
    case openDyslexic = "opendyslexic"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .system: return "System (San Francisco)"
        case .openDyslexic: return "OpenDyslexic"
        }
    }
}

/// Theme options for the RSVP reader.
enum ReaderTheme: String, CaseIterable, Identifiable {
    case system = "system"
    case light = "light"
    case dark = "dark"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .system: return "System"
        case .light: return "Light"
        case .dark: return "Dark"
        }
    }
}

/// Observable settings model backed by App Group UserDefaults.
@Observable
final class ReaderSettings {
    private let defaults: UserDefaults

    var wpm: Int {
        didSet { wpm = max(SettingsKeys.wpmMin, min(SettingsKeys.wpmMax, wpm))
                 defaults.set(wpm, forKey: SettingsKeys.wpm) }
    }

    var font: ReaderFont {
        didSet { defaults.set(font.rawValue, forKey: SettingsKeys.font) }
    }

    var theme: ReaderTheme {
        didSet { defaults.set(theme.rawValue, forKey: SettingsKeys.theme) }
    }

    var fontSize: Int {
        didSet { fontSize = max(SettingsKeys.fontSizeMin, min(SettingsKeys.fontSizeMax, fontSize))
                 defaults.set(fontSize, forKey: SettingsKeys.fontSize) }
    }

    var punctuationPause: Bool {
        didSet { defaults.set(punctuationPause, forKey: SettingsKeys.punctuationPause) }
    }

    init(defaults: UserDefaults? = nil) {
        let store = defaults
            ?? UserDefaults(suiteName: SettingsKeys.appGroupID)
            ?? .standard

        self.defaults = store

        self.wpm = store.object(forKey: SettingsKeys.wpm) as? Int
            ?? SettingsKeys.Defaults.wpm

        let fontRaw = store.string(forKey: SettingsKeys.font)
            ?? SettingsKeys.Defaults.font
        self.font = ReaderFont(rawValue: fontRaw) ?? .system

        let themeRaw = store.string(forKey: SettingsKeys.theme)
            ?? SettingsKeys.Defaults.theme
        self.theme = ReaderTheme(rawValue: themeRaw) ?? .system

        self.fontSize = store.object(forKey: SettingsKeys.fontSize) as? Int
            ?? SettingsKeys.Defaults.fontSize

        self.punctuationPause = store.object(forKey: SettingsKeys.punctuationPause) as? Bool
            ?? SettingsKeys.Defaults.punctuationPause
    }
}
```

Write this to `SpeedReader/SpeedReader/Models/Settings.swift`.

- [ ] **Step 4: Run tests**

Run: `xcodebuild test -project SpeedReader/SpeedReader.xcodeproj -scheme SpeedReader -destination 'platform=macOS' -quiet`
Expected: All 7 tests PASS

**Note:** This step requires the Xcode project from Task 8. If running tasks in dependency order, create the Xcode project first (Task 8 Step 1), then return here to run the tests.

- [ ] **Step 5: Commit**

```bash
git add SpeedReader/Shared/SettingsKeys.swift SpeedReader/SpeedReader/Models/Settings.swift SpeedReader/SpeedReaderTests/SettingsTests.swift
git commit -m "feat: add shared settings model with App Group UserDefaults"
```

---

### Task 8: Xcode Project & SwiftUI App

**Files:**
- Create: `SpeedReader/SpeedReader/SpeedReaderApp.swift`
- Create: `SpeedReader/SpeedReader/Views/ContentView.swift`
- Create: `SpeedReader/SpeedReader/Views/SettingsView.swift`
- Create: `SpeedReader/SpeedReader/Views/OnboardingView.swift`
- Create: Xcode project via Xcode

This task creates the Xcode project with both targets (app + extension) and the SwiftUI views.

**Important:** The Xcode project (`.xcodeproj`) must be created through Xcode because it generates the project file, build settings, signing configuration, entitlements, and target linkage that cannot be reliably reproduced via command line. All `.swift` and `.js` files from previous tasks will be added to the project at this stage.

- [ ] **Step 1: Create Xcode project**

Open Xcode and create a new project:
1. File → New → Project
2. Choose **App** template (Multiplatform)
3. Product Name: `SpeedReader`
4. Organization Identifier: `com.speedreader`
5. Interface: SwiftUI
6. Language: Swift
7. Save to: `ios-speed-reader/SpeedReader/`

Then add the Safari Web Extension target:
1. File → New → Target
2. Choose **Safari Web Extension**
3. Product Name: `SpeedReaderExtension`
4. Language: Swift (for the native host, JS for extension code)
5. Embed in: SpeedReader app

Configure the project:
1. Set deployment targets: iOS 17.0, macOS 14.0
2. Add App Group capability to both targets: `group.com.speedreader.shared`
3. Add the existing JS/CSS files from `SpeedReaderExtension/` to the extension target
4. Add `Shared/` files to both targets (target membership)
5. Create `SpeedReaderTests` test target if not auto-created

- [ ] **Step 2: Write SpeedReaderApp.swift**

```swift
import SwiftUI

@main
struct SpeedReaderApp: App {
    @State private var settings = ReaderSettings()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(settings)
        }
    }
}
```

Write this to `SpeedReader/SpeedReader/SpeedReaderApp.swift` (replacing any template file).

- [ ] **Step 3: Write ContentView.swift**

```swift
import SwiftUI
import SafariServices

struct ContentView: View {
    @Environment(ReaderSettings.self) private var settings
    @State private var extensionEnabled = false
    @State private var hasCheckedExtension = false

    var body: some View {
        NavigationStack {
            if hasCheckedExtension && extensionEnabled {
                SettingsView()
            } else {
                OnboardingView(
                    extensionEnabled: $extensionEnabled,
                    hasChecked: $hasCheckedExtension
                )
            }
        }
    }
}
```

Write this to `SpeedReader/SpeedReader/Views/ContentView.swift`.

- [ ] **Step 4: Write OnboardingView.swift**

```swift
import SwiftUI

struct OnboardingView: View {
    @Binding var extensionEnabled: Bool
    @Binding var hasChecked: Bool

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            Image(systemName: "book.pages")
                .font(.system(size: 64))
                .foregroundStyle(.accent)

            Text("SpeedReader")
                .font(.largeTitle)
                .fontWeight(.bold)

            Text("Speed read any web page with Rapid Serial Visual Presentation")
                .font(.title3)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            VStack(alignment: .leading, spacing: 16) {
                instructionRow(number: 1, text: "Open Safari Settings")
                instructionRow(number: 2, text: "Tap Extensions")
                instructionRow(number: 3, text: "Enable SpeedReader")
                instructionRow(number: 4, text: "Allow on all websites")
            }
            .padding(24)
            .background(.quaternary)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .padding(.horizontal, 24)

            #if os(macOS)
            Button("Open Safari Settings") {
                SFSafariApplication.showPreferencesForExtension(
                    withIdentifier: "com.speedreader.SpeedReader.SpeedReaderExtension"
                ) { error in
                    if let error {
                        print("[SpeedReader] Could not open settings: \(error)")
                    }
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            #else
            Button("Open Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            #endif

            Button("I've enabled it") {
                checkExtensionStatus()
            }
            .foregroundStyle(.secondary)

            Spacer()
        }
        .onAppear {
            checkExtensionStatus()
        }
    }

    private func instructionRow(number: Int, text: String) -> some View {
        HStack(spacing: 12) {
            Text("\(number)")
                .font(.caption)
                .fontWeight(.bold)
                .frame(width: 24, height: 24)
                .background(.accent)
                .foregroundStyle(.white)
                .clipShape(Circle())

            Text(text)
                .font(.body)
        }
    }

    private func checkExtensionStatus() {
        #if os(macOS)
        SFSafariExtensionManager.getStateOfSafariExtension(
            withIdentifier: "com.speedreader.SpeedReader.SpeedReaderExtension"
        ) { state, error in
            DispatchQueue.main.async {
                hasChecked = true
                extensionEnabled = state?.isEnabled ?? false
            }
        }
        #else
        // iOS doesn't have a programmatic way to check extension state.
        // After user taps "I've enabled it", trust them and show settings.
        hasChecked = true
        extensionEnabled = true
        #endif
    }
}
```

Write this to `SpeedReader/SpeedReader/Views/OnboardingView.swift`.

**Note:** On macOS, import `SafariServices` at the top of this file. On iOS, `SFSafariExtensionManager` is not available — the `#if os(macOS)` blocks handle this.

- [ ] **Step 5: Write SettingsView.swift**

```swift
import SwiftUI

struct SettingsView: View {
    @Environment(ReaderSettings.self) private var settings

    var body: some View {
        @Bindable var settings = settings

        Form {
            Section("Reading Speed") {
                VStack(alignment: .leading) {
                    Text("\(settings.wpm) WPM")
                        .font(.headline)
                        .monospacedDigit()

                    Slider(
                        value: Binding(
                            get: { Double(settings.wpm) },
                            set: { settings.wpm = Int($0) }
                        ),
                        in: 100...600,
                        step: 25
                    ) {
                        Text("Words per minute")
                    }
                }

                Toggle("Pause on punctuation", isOn: $settings.punctuationPause)
            }

            Section("Appearance") {
                Picker("Font", selection: $settings.font) {
                    ForEach(ReaderFont.allCases) { font in
                        Text(font.displayName).tag(font)
                    }
                }

                Picker("Theme", selection: $settings.theme) {
                    ForEach(ReaderTheme.allCases) { theme in
                        Text(theme.displayName).tag(theme)
                    }
                }

                VStack(alignment: .leading) {
                    Text("Font Size: \(settings.fontSize)px")

                    Slider(
                        value: Binding(
                            get: { Double(settings.fontSize) },
                            set: { settings.fontSize = Int($0) }
                        ),
                        in: 28...64,
                        step: 2
                    ) {
                        Text("Font size")
                    }
                }
            }

            Section("How to Use") {
                Label("Navigate to any article in Safari", systemImage: "safari")
                Label("Tap the SpeedReader icon in the toolbar", systemImage: "hand.tap")
                Label("Tap anywhere to pause, Space on Mac", systemImage: "pause.circle")
                Label("Use ← → to skip between sentences", systemImage: "arrow.left.arrow.right")
            }
        }
        .navigationTitle("SpeedReader")
        #if os(macOS)
        .formStyle(.grouped)
        .frame(minWidth: 400, minHeight: 500)
        #endif
    }
}
```

Write this to `SpeedReader/SpeedReader/Views/SettingsView.swift`.

- [ ] **Step 6: Build and run**

Run: `xcodebuild build -project SpeedReader/SpeedReader.xcodeproj -scheme SpeedReader -destination 'platform=macOS' -quiet`
Expected: BUILD SUCCEEDED

- [ ] **Step 7: Run Swift tests**

Run: `xcodebuild test -project SpeedReader/SpeedReader.xcodeproj -scheme SpeedReader -destination 'platform=macOS' -quiet`
Expected: All settings tests PASS

- [ ] **Step 8: Run all tests**

Run: `make test-all`
Expected: All JS tests (25) and Swift tests (7) PASS

- [ ] **Step 9: Commit**

```bash
git add SpeedReader/
git commit -m "feat: add Xcode project with SwiftUI app and Safari extension targets"
```

---

## Execution Order

Tasks 1-2 are pure JavaScript with no dependencies — they can run in parallel.

Task 3 (styles) has no code dependencies — can run in parallel with 1-2.

Task 4 (overlay controller) depends on Tasks 1-2 (imports word-processor and focus-point).

Task 5 (content script) depends on Task 4 (imports overlay).

Task 6 (background + manifest) depends on Task 5 (manifest references content.js).

Task 7 (Swift settings) can run in parallel with Tasks 1-6 (no cross-language dependencies), but tests require Task 8's Xcode project.

Task 8 (Xcode project + SwiftUI) depends on all previous tasks (adds all files to project).

```
Task 1 (word-processor) ─┐
Task 2 (focus-point)     ├─► Task 4 (overlay) ─► Task 5 (content) ─► Task 6 (manifest) ─┐
Task 3 (styles)    ──────┘                                                                 ├─► Task 8 (Xcode + SwiftUI)
Task 7 (Swift settings) ─────────────────────────────────────────────────────────────────────┘
```

## Post-Implementation Verification

After all tasks are complete:

1. Run `make test-all` — all tests must pass
2. Build for all three platforms in Xcode (iPhone simulator, iPad simulator, Mac)
3. Manual test on macOS Safari:
   - Enable extension in Safari preferences
   - Navigate to a long-form article (e.g., Wikipedia)
   - Tap extension icon → overlay should appear
   - Verify: play/pause, prev/next sentence, WPM slider, keyboard shortcuts
   - Verify: light/dark mode follows system
   - Verify: close via ✕ or ESC
   - Navigate to a non-article page → verify toast message
   - Select text → tap icon → verify selection fallback works
4. Verify STRUCTURE.md compliance — all files match the documented layout
