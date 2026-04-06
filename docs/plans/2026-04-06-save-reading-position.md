# Save Reading Position Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the current word index per URL so users can close and reopen an article without losing their place.

**Architecture:** New `reading-position.js` module with pure functions for URL normalization, text hashing, and CRUD operations against `browser.storage.local`. Overlay calls save on pause/close/30s auto-save, restore on open. LRU eviction at 100 entries.

**Tech Stack:** JavaScript (ES2020+), WebExtension `browser.storage.local` API, Node.js test runner

**Spec:** `docs/superpowers/specs/2026-04-06-save-reading-position-design.md`

---

### Task 1: Create reading-position.js — URL normalization

**Files:**
- Create: `SpeedReader/SpeedReaderExtension/Resources/rsvp/reading-position.js`
- Test: `tests/js/reading-position.test.js`

- [ ] **Step 1: Write failing tests for normalizeUrl**

Create `tests/js/reading-position.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl } from '../../SpeedReader/SpeedReaderExtension/Resources/rsvp/reading-position.js';

describe('normalizeUrl', () => {
  it('returns protocol + host + path unchanged for clean URLs', () => {
    assert.strictEqual(
      normalizeUrl('https://example.com/article'),
      'https://example.com/article'
    );
  });

  it('strips fragment', () => {
    assert.strictEqual(
      normalizeUrl('https://example.com/article#section2'),
      'https://example.com/article'
    );
  });

  it('strips trailing slash', () => {
    assert.strictEqual(
      normalizeUrl('https://example.com/article/'),
      'https://example.com/article'
    );
  });

  it('strips utm_* tracking params', () => {
    assert.strictEqual(
      normalizeUrl('https://example.com/article?utm_source=twitter&utm_medium=social'),
      'https://example.com/article'
    );
  });

  it('strips fbclid and gclid', () => {
    assert.strictEqual(
      normalizeUrl('https://example.com/article?fbclid=abc123&gclid=def456'),
      'https://example.com/article'
    );
  });

  it('strips ref and source params', () => {
    assert.strictEqual(
      normalizeUrl('https://example.com/article?ref=homepage&source=nav'),
      'https://example.com/article'
    );
  });

  it('preserves non-tracking query params', () => {
    assert.strictEqual(
      normalizeUrl('https://example.com/article?page=2&id=123'),
      'https://example.com/article?id=123&page=2'
    );
  });

  it('preserves non-tracking params while stripping tracking ones', () => {
    assert.strictEqual(
      normalizeUrl('https://example.com/article?utm_source=twitter&page=2'),
      'https://example.com/article?page=2'
    );
  });

  it('sorts remaining query params for consistent keys', () => {
    assert.strictEqual(
      normalizeUrl('https://example.com/article?z=1&a=2'),
      'https://example.com/article?a=2&z=1'
    );
  });

  it('removes ? when all params are tracking params', () => {
    assert.strictEqual(
      normalizeUrl('https://example.com/article?utm_source=twitter'),
      'https://example.com/article'
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/js/reading-position.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement normalizeUrl**

Create `SpeedReader/SpeedReaderExtension/Resources/rsvp/reading-position.js`:

```js
// reading-position.js — Per-URL reading position persistence.
// Uses browser.storage.local to save/restore word index per article.

const STORAGE_KEY = 'readingPositions';
const MAX_ENTRIES = 100;
const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'ref', 'source',
];

export function normalizeUrl(rawUrl) {
  const url = new URL(rawUrl);
  // Strip fragment
  url.hash = '';
  // Strip tracking params
  for (const param of TRACKING_PARAMS) {
    url.searchParams.delete(param);
  }
  // Sort remaining params for consistent keys
  url.searchParams.sort();
  // Build result, stripping trailing slash
  let result = url.origin + url.pathname.replace(/\/$/, '');
  const qs = url.searchParams.toString();
  if (qs) {
    result += '?' + qs;
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/js/reading-position.test.js`
Expected: All normalizeUrl tests PASS

- [ ] **Step 5: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/reading-position.js tests/js/reading-position.test.js
git commit -m "Add reading-position module with URL normalization (#15)"
```

---

### Task 2: Text hashing

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/reading-position.js`
- Modify: `tests/js/reading-position.test.js`

- [ ] **Step 1: Write failing tests for hashText**

Append to `tests/js/reading-position.test.js`:

```js
import { hashText } from '../../SpeedReader/SpeedReaderExtension/Resources/rsvp/reading-position.js';

describe('hashText', () => {
  it('returns a string', () => {
    assert.strictEqual(typeof hashText('Hello world'), 'string');
  });

  it('returns same hash for same text', () => {
    const text = 'The quick brown fox jumps over the lazy dog.';
    assert.strictEqual(hashText(text), hashText(text));
  });

  it('returns different hash for different text', () => {
    assert.notStrictEqual(
      hashText('Article about cats'),
      hashText('Article about dogs')
    );
  });

  it('uses first and last 100 chars for long text', () => {
    const prefix = 'A'.repeat(100);
    const suffix = 'Z'.repeat(100);
    const text1 = prefix + 'MIDDLE_ONE' + suffix;
    const text2 = prefix + 'MIDDLE_TWO' + suffix;
    // Same first 100 and last 100 chars → same hash
    assert.strictEqual(hashText(text1), hashText(text2));
  });

  it('detects changes in first 100 chars', () => {
    const suffix = 'Z'.repeat(100);
    const text1 = 'A'.repeat(100) + 'middle' + suffix;
    const text2 = 'B'.repeat(100) + 'middle' + suffix;
    assert.notStrictEqual(hashText(text1), hashText(text2));
  });

  it('detects changes in last 100 chars', () => {
    const prefix = 'A'.repeat(100);
    const text1 = prefix + 'middle' + 'Y'.repeat(100);
    const text2 = prefix + 'middle' + 'Z'.repeat(100);
    assert.notStrictEqual(hashText(text1), hashText(text2));
  });

  it('handles short text (under 200 chars)', () => {
    const hash = hashText('short');
    assert.strictEqual(typeof hash, 'string');
    assert.ok(hash.length > 0);
  });

  it('handles empty string', () => {
    const hash = hashText('');
    assert.strictEqual(typeof hash, 'string');
  });
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `node --test tests/js/reading-position.test.js`
Expected: FAIL — hashText not exported

- [ ] **Step 3: Implement hashText**

Add to `reading-position.js` after the normalizeUrl function:

```js
export function hashText(text) {
  const sample = text.length <= 200
    ? text
    : text.slice(0, 100) + text.slice(-100);
  // djb2 hash
  let hash = 5381;
  for (let i = 0; i < sample.length; i++) {
    hash = ((hash << 5) + hash + sample.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/js/reading-position.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/reading-position.js tests/js/reading-position.test.js
git commit -m "Add text hashing for content drift detection (#15)"
```

---

### Task 3: Save and restore with LRU eviction

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/reading-position.js`
- Modify: `tests/js/reading-position.test.js`

- [ ] **Step 1: Write failing tests for save, restore, clear, and eviction**

Append to `tests/js/reading-position.test.js`. These tests need a mock for `browser.storage.local`. Add the mock setup at the top of the file and the new describe blocks:

At the top of the file, after the existing imports, add:

```js
// Mock browser.storage.local for save/restore/clear tests
let mockStorage = {};
globalThis.browser = {
  storage: {
    local: {
      get: async (keys) => {
        const result = {};
        if (typeof keys === 'string') {
          result[keys] = mockStorage[keys];
        } else if (Array.isArray(keys)) {
          for (const k of keys) result[k] = mockStorage[k];
        } else if (typeof keys === 'object') {
          for (const k in keys) result[k] = mockStorage[k] ?? keys[k];
        }
        return result;
      },
      set: async (items) => { Object.assign(mockStorage, items); },
    },
  },
};
```

Then add these test blocks:

```js
import { save, restore, clear } from '../../SpeedReader/SpeedReaderExtension/Resources/rsvp/reading-position.js';

describe('save', () => {
  it('stores position for a URL', async () => {
    mockStorage = {};
    await save('https://example.com/article', 'Some article text here', 50, 200);
    const stored = mockStorage.readingPositions;
    assert.ok(stored);
    const key = Object.keys(stored)[0];
    assert.strictEqual(stored[key].index, 50);
    assert.strictEqual(stored[key].total, 200);
    assert.ok(stored[key].textHash);
    assert.ok(stored[key].timestamp);
  });

  it('updates existing entry for same URL', async () => {
    mockStorage = {};
    await save('https://example.com/article', 'Some text', 50, 200);
    await save('https://example.com/article', 'Some text', 100, 200);
    const stored = mockStorage.readingPositions;
    const keys = Object.keys(stored);
    assert.strictEqual(keys.length, 1);
    assert.strictEqual(stored[keys[0]].index, 100);
  });

  it('does not save when index is 0', async () => {
    mockStorage = {};
    await save('https://example.com/article', 'Some text', 0, 200);
    const stored = mockStorage.readingPositions;
    assert.strictEqual(stored, undefined);
  });

  it('evicts oldest entry when exceeding MAX_ENTRIES', async () => {
    mockStorage = {};
    const positions = {};
    for (let i = 0; i < 100; i++) {
      positions['https://example.com/page' + i] = {
        index: 10, total: 100, textHash: 'abc', timestamp: 1000 + i,
      };
    }
    mockStorage = { readingPositions: positions };
    // Save one more — should evict the oldest (timestamp 1000)
    await save('https://example.com/new-page', 'New article text', 5, 50);
    const stored = mockStorage.readingPositions;
    assert.strictEqual(Object.keys(stored).length, 100);
    assert.strictEqual(stored['https://example.com/page0'], undefined);
    assert.ok(stored['https://example.com/new-page']);
  });
});

describe('restore', () => {
  it('returns saved index for matching URL and text', async () => {
    mockStorage = {};
    const text = 'The quick brown fox jumps over the lazy dog.';
    await save('https://example.com/article', text, 42, 200);
    const index = await restore('https://example.com/article', text);
    assert.strictEqual(index, 42);
  });

  it('returns null when no entry exists', async () => {
    mockStorage = {};
    const index = await restore('https://example.com/missing', 'Some text');
    assert.strictEqual(index, null);
  });

  it('returns null when text hash does not match', async () => {
    mockStorage = {};
    await save('https://example.com/article', 'Original text', 42, 200);
    const index = await restore('https://example.com/article', 'Completely different text');
    assert.strictEqual(index, null);
  });

  it('returns null when saved index exceeds total words', async () => {
    mockStorage = {};
    // Manually set an entry with index beyond what restore will accept
    const url = 'https://example.com/article';
    const text = 'Short text';
    mockStorage = {
      readingPositions: {
        [normalizeUrl(url)]: {
          index: 500, total: 200, textHash: hashText(text), timestamp: Date.now(),
        },
      },
    };
    // restore checks index < words.length, but since we pass text,
    // it uses total from the entry. We need to verify via the totalWords param.
    // Actually restore uses the stored total field as a sanity check.
    const index = await restore(url, text);
    // index 500 > total 200, so should return null
    assert.strictEqual(index, null);
  });

  it('normalizes URL before lookup', async () => {
    mockStorage = {};
    await save('https://example.com/article', 'Some text', 42, 200);
    const index = await restore('https://example.com/article?utm_source=twitter#section', 'Some text');
    assert.strictEqual(index, 42);
  });
});

describe('clear', () => {
  it('removes entry for a URL', async () => {
    mockStorage = {};
    await save('https://example.com/article', 'Some text', 42, 200);
    await clear('https://example.com/article');
    const stored = mockStorage.readingPositions;
    assert.strictEqual(Object.keys(stored).length, 0);
  });

  it('does nothing when URL has no entry', async () => {
    mockStorage = { readingPositions: {} };
    await clear('https://example.com/missing');
    assert.strictEqual(Object.keys(mockStorage.readingPositions).length, 0);
  });

  it('normalizes URL before clearing', async () => {
    mockStorage = {};
    await save('https://example.com/article', 'Some text', 42, 200);
    await clear('https://example.com/article?utm_source=twitter');
    const stored = mockStorage.readingPositions;
    assert.strictEqual(Object.keys(stored).length, 0);
  });
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `node --test tests/js/reading-position.test.js`
Expected: FAIL — save, restore, clear not exported

- [ ] **Step 3: Implement save, restore, and clear**

Add to `reading-position.js` after hashText:

```js
export async function save(rawUrl, text, index, total) {
  if (index === 0) return;
  const key = normalizeUrl(rawUrl);
  const entry = {
    index,
    total,
    textHash: hashText(text),
    timestamp: Math.floor(Date.now() / 1000),
  };
  const data = await browser.storage.local.get(STORAGE_KEY);
  const positions = data[STORAGE_KEY] || {};
  positions[key] = entry;
  // LRU eviction
  const keys = Object.keys(positions);
  if (keys.length > MAX_ENTRIES) {
    let oldestKey = keys[0];
    let oldestTime = positions[keys[0]].timestamp;
    for (let i = 1; i < keys.length; i++) {
      if (positions[keys[i]].timestamp < oldestTime) {
        oldestTime = positions[keys[i]].timestamp;
        oldestKey = keys[i];
      }
    }
    delete positions[oldestKey];
  }
  await browser.storage.local.set({ [STORAGE_KEY]: positions });
}

export async function restore(rawUrl, text) {
  const key = normalizeUrl(rawUrl);
  const hash = hashText(text);
  const data = await browser.storage.local.get(STORAGE_KEY);
  const positions = data[STORAGE_KEY] || {};
  const entry = positions[key];
  if (!entry) return null;
  if (entry.textHash !== hash) return null;
  if (entry.index >= entry.total) return null;
  return entry.index;
}

export async function clear(rawUrl) {
  const key = normalizeUrl(rawUrl);
  const data = await browser.storage.local.get(STORAGE_KEY);
  const positions = data[STORAGE_KEY] || {};
  if (!(key in positions)) return;
  delete positions[key];
  await browser.storage.local.set({ [STORAGE_KEY]: positions });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/js/reading-position.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/reading-position.js tests/js/reading-position.test.js
git commit -m "Add save/restore/clear with LRU eviction (#15)"
```

---

### Task 4: Integrate restore into overlay open

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js:22-43`
- Modify: `SpeedReader/SpeedReaderExtension/Resources/content.js:113-133`

- [ ] **Step 1: Add url parameter to overlay.open() and call restore**

In `overlay.js`, add the import at line 2:

```js
import { restore } from './reading-position.js';
```

Change the `open` method signature and add restore logic after `state.init()` but before `_createDOM()`:

```js
  async open(text, title, settings = {}, url = '') {
    if (this.host) {
      this.close();
    }

    Object.assign(this.settings, settings);
    this.title = title || '';
    this._url = url;
    this._text = text;
    this.state.init(text, {
      wpm: settings.wpm,
      punctuationPause: settings.punctuationPause ?? true,
    });

    if (this.state.words.length === 0) {
      this._showPageToast('No readable content found.');
      return;
    }

    // Restore saved reading position if available
    if (url) {
      try {
        const savedIndex = await restore(url, text);
        if (savedIndex !== null) {
          this.state.seekTo(savedIndex);
        }
      } catch (e) {
        console.warn('[SpeedReader] Failed to restore reading position:', e.message || e);
      }
    }

    this._createDOM();
    this._bindEvents();
    this._renderWord();
    this._updateProgress();
  }
```

- [ ] **Step 2: Pass URL from content.js to overlay.open()**

In `content.js`, update the two `reader.open()` calls to pass `window.location.href`:

In the `use-selection` branch (around line 115):

```js
      reader.open(decision.text, document.title, await getSettings(), window.location.href);
```

In the `use-article` branch (around line 127):

```js
      reader.open(decision.text, decision.title || document.title, settings, window.location.href);
```

- [ ] **Step 3: Run full test suite to verify nothing broke**

Run: `make test-js`
Expected: All tests PASS (reading-position tests + existing tests)

- [ ] **Step 4: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js SpeedReader/SpeedReaderExtension/Resources/content.js
git commit -m "Restore saved reading position on overlay open (#15)"
```

---

### Task 5: Integrate save into pause, close, and playback complete

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js:114-126,135-143,213-226`

- [ ] **Step 1: Add save and clear imports**

Update the import in `overlay.js` line 2:

```js
import { save, restore, clear } from './reading-position.js';
```

- [ ] **Step 2: Add _savePosition helper method**

Add a helper method to the RSVPOverlay class (after the `_persistFontSize` method, around line 211):

```js
  _savePosition() {
    if (!this._url || this.state.currentIndex === 0) return;
    save(this._url, this._text, this.state.currentIndex, this.state.words.length)
      .catch(function(err) {
        console.warn('[SpeedReader] Failed to save reading position:', err.message || err);
      });
  }
```

- [ ] **Step 3: Call _savePosition in pause()**

In the `pause()` method (line 135), add `this._savePosition()` after pausing the state:

```js
  pause() {
    this.state.pause();
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this._updatePlayButton();
    this._showContext();
    this._savePosition();
  }
```

- [ ] **Step 4: Call _savePosition in close()**

In the `close()` method (line 114), add `this._savePosition()` before DOM teardown:

```js
  close() {
    this._savePosition();
    this.pause();
    if (this.host && this.host.parentNode) {
      this.host.parentNode.removeChild(this.host);
    }
    this.host = null;
    this.shadow = null;
    this.elements = {};
    this._url = '';
    this._text = '';
    if (this._boundKeyHandler) {
      document.removeEventListener('keydown', this._boundKeyHandler);
      this._boundKeyHandler = null;
    }
  }
```

- [ ] **Step 5: Call clear on playback complete**

In `_startLoop()` (line 213), when `result.done` is true, clear the saved position:

```js
  _startLoop() {
    this._renderWord();
    this._updateProgress();

    const result = this.state.tick();
    if (result.done) {
      this.pause();
      if (this._url) {
        clear(this._url).catch(function(err) {
          console.warn('[SpeedReader] Failed to clear reading position:', err.message || err);
        });
      }
      return;
    }

    this.timerId = setTimeout(() => {
      this._startLoop();
    }, result.delay);
  }
```

- [ ] **Step 6: Run full test suite**

Run: `make test-js`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js
git commit -m "Save position on pause/close, clear on playback complete (#15)"
```

---

### Task 6: Periodic auto-save during playback

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js`

- [ ] **Step 1: Add auto-save timer property to constructor**

In the constructor (line 5), add:

```js
    this._autoSaveTimerId = null;
```

- [ ] **Step 2: Add _startAutoSave and _stopAutoSave methods**

Add after `_savePosition`:

```js
  _startAutoSave() {
    this._stopAutoSave();
    this._autoSaveTimerId = setInterval(() => {
      this._savePosition();
    }, 30000);
  }

  _stopAutoSave() {
    if (this._autoSaveTimerId !== null) {
      clearInterval(this._autoSaveTimerId);
      this._autoSaveTimerId = null;
    }
  }
```

- [ ] **Step 3: Start auto-save in play(), stop in pause()**

In `play()` method, add `this._startAutoSave()` after `this._startLoop()`:

```js
  play() {
    this.state.play();
    this._updatePlayButton();
    this._hideContext();
    this._startLoop();
    this._startAutoSave();
  }
```

In `pause()` method, add `this._stopAutoSave()` before `this._savePosition()`:

```js
  pause() {
    this.state.pause();
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this._stopAutoSave();
    this._updatePlayButton();
    this._showContext();
    this._savePosition();
  }
```

- [ ] **Step 4: Stop auto-save in close()**

In `close()`, add `this._stopAutoSave()` after `this._savePosition()`:

```js
  close() {
    this._savePosition();
    this._stopAutoSave();
    this.pause();
    ...
  }
```

Note: `pause()` also calls `_stopAutoSave()`, but calling it before `pause()` in `close()` ensures the timer is cleared even if `pause()` logic changes. The `_stopAutoSave` method is idempotent.

- [ ] **Step 5: Run full test suite**

Run: `make test-js`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/rsvp/overlay.js
git commit -m "Add 30-second periodic auto-save during playback (#15)"
```

---

### Task 7: Register in manifest.json

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/manifest.json`

- [ ] **Step 1: Add reading-position.js to web_accessible_resources**

In `manifest.json`, add `"reading-position.js"` to the resources array (after `"focus-point.js"`):

```json
      "resources": [
        "overlay.css",
        "overlay.js",
        "state-machine.js",
        "settings-defaults.js",
        "word-processor.js",
        "focus-point.js",
        "reading-position.js",
        "content-resolver.js",
        "Readability.js",
        "OpenDyslexic-Regular.woff2"
      ],
```

- [ ] **Step 2: Run full test suite**

Run: `make test-js`
Expected: All tests PASS

- [ ] **Step 3: Run linting**

Run: `make lint-js`
Expected: No lint errors

- [ ] **Step 4: Commit**

```bash
git add SpeedReader/SpeedReaderExtension/Resources/manifest.json
git commit -m "Register reading-position.js in manifest web_accessible_resources (#15)"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run full CI check**

Run: `make ci`
Expected: All tests and linting pass

- [ ] **Step 2: Verify file structure compliance**

Confirm new files are in the correct locations per STRUCTURE.md:
- `SpeedReader/SpeedReaderExtension/Resources/rsvp/reading-position.js` — RSVP reader code ✓
- `tests/js/reading-position.test.js` — Unit tests (JS) ✓

- [ ] **Step 3: Review all changes**

Run: `git log --oneline main..HEAD`
Expected: 6 commits for this feature, each focused on a single concern
