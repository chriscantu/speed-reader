# Regression Test Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bash regression test script with a modular Node.js test suite that covers all shipped v1 features, adds poll-until-ready timing, and includes a manual iOS/iPadOS checklist.

**Architecture:** Safari driver module wraps `osascript` into an async Node.js API. Content script gets a generic `speedreader-test-dispatch` postMessage handler for new test actions (keypress, theme, font, WPM). Each test area is a separate `*.test.js` file in `tests/regression/`. A manual checklist covers what automation cannot (iOS, iPadOS, VoiceOver).

**Tech Stack:** Node.js (`node:test`, `node:assert`), `child_process.execSync` for `osascript`, ES modules.

**Spec:** `docs/superpowers/specs/2026-04-04-regression-test-infrastructure-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `scripts/lib/safari-driver.js` | osascript bridge: execJS, navigate, queryState, dispatch, clickOverlay, toggle, waitFor |
| Create | `tests/regression/helpers.js` | Shared test setup: navigate to test page, ensure overlay open/closed, constants |
| Create | `tests/regression/01-prerequisites.test.js` | Safari running, JS-from-Apple-Events, content script loaded |
| Create | `tests/regression/02-overlay-lifecycle.test.js` | Open, close, shadow DOM, re-toggle |
| Create | `tests/regression/03-playback.test.js` | Play, pause, word frozen, progress advancing |
| Create | `tests/regression/04-navigation.test.js` | Next/prev sentence, context on pause |
| Create | `tests/regression/05-keyboard.test.js` | Space, Escape, arrows for play/pause/close/nav/WPM |
| Create | `tests/regression/06-wpm.test.js` | Set WPM, clamping at min/max, label sync |
| Create | `tests/regression/07-theme.test.js` | Light, dark, system theme switching |
| Create | `tests/regression/08-font.test.js` | OpenDyslexic toggle |
| Create | `tests/regression/09-selection.test.js` | Text selection mode, word count comparison |
| Create | `tests/regression/10-re-toggle.test.js` | Full open/play/close/re-open cycle |
| Create | `docs/regression-checklist.md` | Manual iOS/iPadOS verification checklist |
| Modify | `SpeedReader/SpeedReaderExtension/Resources/content.js:200-250` | Add `speedreader-test-dispatch` handler, extend query response with theme/font |
| Modify | `Makefile:25-26` | Update `test-regression` target to use `node --test` |
| Delete | `scripts/regression-test.sh` | Replaced by Node.js suite |

---

### Task 1: Safari Driver — Core Functions

**Files:**
- Create: `scripts/lib/safari-driver.js`

- [ ] **Step 1: Create safari-driver.js with all exports**

```js
// scripts/lib/safari-driver.js
// Safari automation bridge — wraps osascript for Node.js regression tests.
// NOTE: Uses execSync intentionally — osascript is a local-only test tool,
// not production code. No user input reaches these commands.

import { execSync } from 'node:child_process';

const TEST_URL = 'https://en.wikipedia.org/wiki/Speed_reading';

/**
 * Run arbitrary JavaScript in Safari's active document via osascript.
 * Returns the string result. Throws on osascript failure.
 */
export function execJS(jsCode) {
  const escaped = jsCode.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const cmd = `osascript -e 'tell application "Safari" to do JavaScript "${escaped}" in document 1'`;
  try {
    const result = execSync(cmd, { encoding: 'utf-8', timeout: 10000 });
    return result.trim();
  } catch (e) {
    const msg = e.stderr ? e.stderr.trim() : e.message;
    throw new Error(`execJS failed: ${msg}`);
  }
}

/**
 * Navigate Safari to a URL and wait for the page to load.
 */
export async function navigate(url = TEST_URL) {
  execSync(
    `osascript -e 'tell application "Safari" to set URL of document 1 to "${url}"'`,
    { encoding: 'utf-8', timeout: 10000 }
  );
  execSync(
    `osascript -e 'tell application "Safari" to activate'`,
    { encoding: 'utf-8', timeout: 5000 }
  );
  await waitFor(() => {
    const state = execJS('document.readyState');
    return state === 'complete';
  }, { timeout: 15000, interval: 500 });
}

/**
 * Poll a predicate function until it returns true.
 * Predicate can be sync (returns bool) or async (returns Promise<bool>).
 */
export async function waitFor(predicate, { timeout = 5000, interval = 200 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const result = await predicate();
      if (result) return;
    } catch {
      // predicate threw — keep polling
    }
    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error(`waitFor timed out after ${timeout}ms`);
}

/**
 * Query overlay state via the content script's speedreader-test-query handler.
 * Returns a parsed object with overlay state fields.
 */
export async function queryState() {
  execJS(
    "window.__srTestResult = null;" +
    "window.addEventListener('message', function handler(e) {" +
    "  if (e.data && e.data.type === 'speedreader-test-result') {" +
    "    window.__srTestResult = JSON.stringify(e.data.data);" +
    "    window.removeEventListener('message', handler);" +
    "  }" +
    "});" +
    "window.postMessage({type: 'speedreader-test-query'}, '*');"
  );

  let json = null;
  await waitFor(() => {
    const raw = execJS('window.__srTestResult || "null"');
    if (raw && raw !== 'null') {
      json = raw;
      return true;
    }
    return false;
  }, { timeout: 3000, interval: 100 });

  try {
    return JSON.parse(json);
  } catch {
    throw new Error(`queryState: failed to parse JSON: ${json}`);
  }
}

/**
 * Send a generic dispatch command to the content script.
 * Uses the speedreader-test-dispatch postMessage type.
 */
export function dispatch(action, payload = {}) {
  const msg = JSON.stringify({ type: 'speedreader-test-dispatch', action, payload });
  execJS("window.postMessage(" + msg.replace(/"/g, '\\"') + ", '*')");
}

/**
 * Toggle the overlay open/closed via speedreader-test-toggle.
 */
export function toggle() {
  execJS("window.postMessage({type: 'speedreader-test-toggle'}, '*')");
}

/**
 * Click an element inside the overlay's shadow DOM by CSS selector.
 */
export function clickOverlay(selector) {
  const escaped = selector.replace(/'/g, "\\'");
  execJS("window.postMessage({type: 'speedreader-test-click', selector: '" + escaped + "'}, '*')");
}

export { TEST_URL };
```

- [ ] **Step 2: Verify the module parses**

Run: `node -e "import('./scripts/lib/safari-driver.js').then(() => console.log('OK'))"`

Expected: `OK` (no syntax errors)

- [ ] **Step 3: Commit**

```
git add scripts/lib/safari-driver.js
git commit -m "Add safari-driver module with osascript bridge for regression tests"
```

---

### Task 2: Content Script — Add Dispatch Handler and Extend Query

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/content.js:200-250`

- [ ] **Step 1: Add theme and font to the query response**

In `content.js`, inside the `speedreader-test-query` handler, find the block that builds the `result` object (around line 217-234). Add two lines before the closing `}` of the `if (overlay && overlay.host && overlay.shadow)` block, after line 234 (`result.hasClose = ...`):

```js
      result.theme = overlay.host.getAttribute('data-theme') || 'system';
      result.font = overlay.host.getAttribute('data-font') || 'default';
```

- [ ] **Step 2: Add the dispatch handler**

After the `speedreader-test-next` handler (after line 249), add:

```js
  if (event.data.type === 'speedreader-test-dispatch') {
    var action = event.data.action;
    var payload = event.data.payload || {};

    if (action === 'keypress') {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: payload.key, bubbles: true }));
    }

    if (action === 'set-theme' && overlay) {
      overlay.updateSettings({ theme: payload.theme });
    }

    if (action === 'set-font' && overlay) {
      overlay.updateSettings({ font: payload.font });
    }

    if (action === 'set-wpm' && overlay) {
      overlay.updateSettings({ wpm: payload.wpm });
    }

    if (action === 'get-host-attrs') {
      var attrs = {};
      if (overlay && overlay.host) {
        attrs.theme = overlay.host.getAttribute('data-theme') || 'system';
        attrs.font = overlay.host.getAttribute('data-font') || 'default';
      }
      window.postMessage({ type: 'speedreader-test-result', data: attrs }, '*');
    }
  }
```

- [ ] **Step 3: Commit**

```
git add SpeedReader/SpeedReaderExtension/Resources/content.js
git commit -m "Add speedreader-test-dispatch handler and theme/font to query response"
```

---

### Task 3: Test Helpers

**Files:**
- Create: `tests/regression/helpers.js`

- [ ] **Step 1: Create helpers.js with shared setup functions**

```js
// tests/regression/helpers.js
// Shared setup and utilities for regression tests.

import {
  execJS, navigate, queryState, waitFor,
  toggle, dispatch, clickOverlay, TEST_URL
} from '../../scripts/lib/safari-driver.js';

/**
 * Navigate to the test page and wait for the content script to load.
 */
export async function setupTestPage() {
  await navigate(TEST_URL);
  await waitFor(() => {
    const attr = execJS("document.documentElement.getAttribute('data-speedreader-loaded')");
    return attr === 'true';
  }, { timeout: 10000, interval: 500 });
}

/**
 * Ensure the overlay is open. If closed, toggle it open and wait.
 */
export async function ensureOverlayOpen() {
  const state = await queryState();
  if (!state.overlayOpen) {
    toggle();
    await waitFor(async () => {
      const s = await queryState();
      return s.overlayOpen === true;
    }, { timeout: 8000, interval: 300 });
  }
}

/**
 * Ensure the overlay is closed. If open, toggle it closed and wait.
 */
export async function ensureOverlayClosed() {
  const state = await queryState();
  if (state.overlayOpen) {
    toggle();
    await waitFor(async () => {
      const s = await queryState();
      return s.overlayOpen === false;
    }, { timeout: 5000, interval: 200 });
  }
}

/**
 * Ensure playback is paused. If playing, click play button to pause.
 */
export async function ensurePaused() {
  const state = await queryState();
  if (state.isPlaying) {
    clickOverlay('.sr-btn-play');
    await waitFor(async () => {
      const s = await queryState();
      return s.isPlaying === false;
    }, { timeout: 3000 });
  }
}

export { execJS, navigate, queryState, waitFor, toggle, dispatch, clickOverlay, TEST_URL };
```

- [ ] **Step 2: Verify the module parses**

Run: `node -e "import('./tests/regression/helpers.js').then(() => console.log('OK'))"`

Expected: `OK`

- [ ] **Step 3: Commit**

```
git add tests/regression/helpers.js
git commit -m "Add regression test helpers with shared setup functions"
```

---

### Task 4: Prerequisites Test

**Files:**
- Create: `tests/regression/01-prerequisites.test.js`

- [ ] **Step 1: Write the prerequisites test**

```js
// tests/regression/01-prerequisites.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execJS, navigate, waitFor } from './helpers.js';

describe('Prerequisites', () => {
  it('Safari accepts JavaScript from Apple Events', () => {
    const result = execJS('1+1');
    assert.strictEqual(result, '2');
  });

  it('navigates to test page', async () => {
    await navigate();
    const url = execJS('window.location.href');
    assert.ok(url.includes('Speed_reading'), `Expected Speed_reading in URL, got: ${url}`);
  });

  it('content script is loaded', async () => {
    await waitFor(() => {
      const attr = execJS("document.documentElement.getAttribute('data-speedreader-loaded')");
      return attr === 'true';
    }, { timeout: 10000, interval: 500 });

    const attr = execJS("document.documentElement.getAttribute('data-speedreader-loaded')");
    assert.strictEqual(attr, 'true');
  });
});
```

- [ ] **Step 2: Commit**

```
git add tests/regression/01-prerequisites.test.js
git commit -m "Add prerequisites regression test"
```

---

### Task 5: Overlay Lifecycle Test

**Files:**
- Create: `tests/regression/02-overlay-lifecycle.test.js`

- [ ] **Step 1: Write the overlay lifecycle test**

```js
// tests/regression/02-overlay-lifecycle.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestPage, ensureOverlayClosed, queryState, toggle, waitFor } from './helpers.js';

describe('Overlay Lifecycle', () => {
  before(async () => {
    await setupTestPage();
  });

  it('overlay is initially closed', async () => {
    await ensureOverlayClosed();
    const state = await queryState();
    assert.strictEqual(state.overlayOpen, false);
  });

  it('toggle opens the overlay', async () => {
    toggle();
    await waitFor(async () => {
      const s = await queryState();
      return s.overlayOpen === true;
    }, { timeout: 8000 });

    const state = await queryState();
    assert.strictEqual(state.overlayOpen, true);
  });

  it('shadow DOM is attached', async () => {
    const state = await queryState();
    assert.strictEqual(state.hasShadow, true);
  });

  it('has a rendered word', async () => {
    const state = await queryState();
    assert.ok(state.wordText.length > 0, `Expected a word, got: "${state.wordText}"`);
  });

  it('has focus highlight', async () => {
    const state = await queryState();
    assert.strictEqual(state.hasFocus, true);
  });

  it('has all control buttons', async () => {
    const state = await queryState();
    assert.strictEqual(state.hasPlay, true);
    assert.strictEqual(state.hasPrev, true);
    assert.strictEqual(state.hasNext, true);
    assert.strictEqual(state.hasClose, true);
  });

  it('has WPM label', async () => {
    const state = await queryState();
    assert.ok(state.wpmLabel.includes('wpm'), `Expected wpm in label, got: "${state.wpmLabel}"`);
  });

  it('toggle closes the overlay', async () => {
    toggle();
    await waitFor(async () => {
      const s = await queryState();
      return s.overlayOpen === false;
    }, { timeout: 5000 });

    const state = await queryState();
    assert.strictEqual(state.overlayOpen, false);
  });
});
```

- [ ] **Step 2: Commit**

```
git add tests/regression/02-overlay-lifecycle.test.js
git commit -m "Add overlay lifecycle regression test"
```

---

### Task 6: Playback Test

**Files:**
- Create: `tests/regression/03-playback.test.js`

- [ ] **Step 1: Write the playback test**

```js
// tests/regression/03-playback.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestPage, ensureOverlayOpen, queryState, clickOverlay, waitFor } from './helpers.js';

describe('Playback', () => {
  before(async () => {
    await setupTestPage();
    await ensureOverlayOpen();
  });

  it('play starts advancing words', async () => {
    const before = await queryState();
    const startIndex = before.currentIndex;

    clickOverlay('.sr-btn-play');
    await waitFor(async () => {
      const s = await queryState();
      return s.isPlaying === true && s.currentIndex > startIndex;
    }, { timeout: 5000 });

    const state = await queryState();
    assert.strictEqual(state.isPlaying, true);
    assert.ok(state.currentIndex > startIndex, `Expected index > ${startIndex}, got ${state.currentIndex}`);
  });

  it('pause freezes the word', async () => {
    clickOverlay('.sr-btn-play');
    await waitFor(async () => {
      const s = await queryState();
      return s.isPlaying === false;
    }, { timeout: 3000 });

    const stateA = await queryState();
    assert.strictEqual(stateA.isPlaying, false);

    await new Promise(r => setTimeout(r, 500));
    const stateB = await queryState();
    assert.strictEqual(stateA.wordText, stateB.wordText);
  });

  it('context text appears on pause', async () => {
    const state = await queryState();
    assert.ok(state.contextText.length > 0, `Expected context text, got: "${state.contextText}"`);
  });

  it('word count is positive', async () => {
    const state = await queryState();
    assert.ok(state.wordCount > 0, `Expected positive word count, got: ${state.wordCount}`);
  });
});
```

- [ ] **Step 2: Commit**

```
git add tests/regression/03-playback.test.js
git commit -m "Add playback regression test"
```

---

### Task 7: Navigation Test

**Files:**
- Create: `tests/regression/04-navigation.test.js`

- [ ] **Step 1: Write the navigation test**

```js
// tests/regression/04-navigation.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestPage, ensureOverlayOpen, ensurePaused, queryState, execJS, waitFor } from './helpers.js';

describe('Navigation', () => {
  before(async () => {
    await setupTestPage();
    await ensureOverlayOpen();
    await ensurePaused();
  });

  it('next sentence changes the word', async () => {
    const before = await queryState();
    const wordBefore = before.wordText;

    execJS("window.postMessage({type: 'speedreader-test-next'}, '*')");
    await new Promise(r => setTimeout(r, 300));

    const after = await queryState();
    assert.notStrictEqual(after.wordText, wordBefore,
      `Expected word to change from "${wordBefore}"`);
  });

  it('navigation while paused stays paused', async () => {
    execJS("window.postMessage({type: 'speedreader-test-next'}, '*')");
    await new Promise(r => setTimeout(r, 300));

    const state = await queryState();
    assert.strictEqual(state.isPlaying, false);
  });

  it('context updates after navigation', async () => {
    const state = await queryState();
    assert.ok(state.contextText.length > 0, 'Expected context text after nav');
  });
});
```

- [ ] **Step 2: Commit**

```
git add tests/regression/04-navigation.test.js
git commit -m "Add navigation regression test"
```

---

### Task 8: Keyboard Shortcuts Test

**Files:**
- Create: `tests/regression/05-keyboard.test.js`

- [ ] **Step 1: Write the keyboard shortcuts test**

```js
// tests/regression/05-keyboard.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestPage, ensureOverlayOpen, ensurePaused, queryState, dispatch, waitFor } from './helpers.js';

describe('Keyboard Shortcuts', () => {
  before(async () => {
    await setupTestPage();
    await ensureOverlayOpen();
    await ensurePaused();
  });

  it('Space toggles play', async () => {
    dispatch('keypress', { key: ' ' });
    await waitFor(async () => (await queryState()).isPlaying === true, { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.isPlaying, true);
  });

  it('Space toggles pause', async () => {
    dispatch('keypress', { key: ' ' });
    await waitFor(async () => (await queryState()).isPlaying === false, { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.isPlaying, false);
  });

  it('ArrowRight advances sentence', async () => {
    const before = await queryState();
    const idxBefore = before.currentIndex;

    dispatch('keypress', { key: 'ArrowRight' });
    await new Promise(r => setTimeout(r, 300));

    const after = await queryState();
    assert.ok(after.currentIndex !== idxBefore,
      `Expected index to change from ${idxBefore}`);
  });

  it('ArrowLeft goes back', async () => {
    const before = await queryState();
    const idxBefore = before.currentIndex;

    dispatch('keypress', { key: 'ArrowLeft' });
    await new Promise(r => setTimeout(r, 300));

    const after = await queryState();
    assert.ok(after.currentIndex < idxBefore,
      `Expected index < ${idxBefore}, got ${after.currentIndex}`);
  });

  it('ArrowUp increases WPM by 25', async () => {
    const before = await queryState();
    const wpmBefore = before.wpm;

    dispatch('keypress', { key: 'ArrowUp' });
    await new Promise(r => setTimeout(r, 300));

    const after = await queryState();
    const expectedWpm = Math.min(600, wpmBefore + 25);
    assert.strictEqual(after.wpm, expectedWpm);
  });

  it('ArrowDown decreases WPM by 25', async () => {
    const before = await queryState();
    const wpmBefore = before.wpm;

    dispatch('keypress', { key: 'ArrowDown' });
    await new Promise(r => setTimeout(r, 300));

    const after = await queryState();
    const expectedWpm = Math.max(100, wpmBefore - 25);
    assert.strictEqual(after.wpm, expectedWpm);
  });

  it('Escape closes the overlay', async () => {
    dispatch('keypress', { key: 'Escape' });
    await waitFor(async () => (await queryState()).overlayOpen === false, { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.overlayOpen, false);
  });
});
```

- [ ] **Step 2: Commit**

```
git add tests/regression/05-keyboard.test.js
git commit -m "Add keyboard shortcuts regression test"
```

---

### Task 9: WPM Test

**Files:**
- Create: `tests/regression/06-wpm.test.js`

- [ ] **Step 1: Write the WPM test**

```js
// tests/regression/06-wpm.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestPage, ensureOverlayOpen, queryState, dispatch } from './helpers.js';

describe('WPM Controls', () => {
  before(async () => {
    await setupTestPage();
    await ensureOverlayOpen();
  });

  it('set-wpm dispatches to 400 and updates state', async () => {
    dispatch('set-wpm', { wpm: 400 });
    await new Promise(r => setTimeout(r, 300));

    const state = await queryState();
    assert.strictEqual(state.wpm, 400);
    assert.strictEqual(state.wpmLabel, '400 wpm');
  });

  it('ArrowUp from 600 stays clamped at 600', async () => {
    dispatch('set-wpm', { wpm: 600 });
    await new Promise(r => setTimeout(r, 200));

    dispatch('keypress', { key: 'ArrowUp' });
    await new Promise(r => setTimeout(r, 300));

    const state = await queryState();
    assert.strictEqual(state.wpm, 600);
    assert.strictEqual(state.wpmLabel, '600 wpm');
  });

  it('ArrowDown from 100 stays clamped at 100', async () => {
    dispatch('set-wpm', { wpm: 100 });
    await new Promise(r => setTimeout(r, 200));

    dispatch('keypress', { key: 'ArrowDown' });
    await new Promise(r => setTimeout(r, 300));

    const state = await queryState();
    assert.strictEqual(state.wpm, 100);
    assert.strictEqual(state.wpmLabel, '100 wpm');
  });

  it('restores WPM to default after test', async () => {
    dispatch('set-wpm', { wpm: 250 });
    await new Promise(r => setTimeout(r, 200));

    const state = await queryState();
    assert.strictEqual(state.wpm, 250);
  });
});
```

- [ ] **Step 2: Commit**

```
git add tests/regression/06-wpm.test.js
git commit -m "Add WPM regression test"
```

---

### Task 10: Theme Test

**Files:**
- Create: `tests/regression/07-theme.test.js`

- [ ] **Step 1: Write the theme test**

```js
// tests/regression/07-theme.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestPage, ensureOverlayOpen, queryState, dispatch } from './helpers.js';

describe('Theme Switching', () => {
  before(async () => {
    await setupTestPage();
    await ensureOverlayOpen();
  });

  it('set-theme dark applies data-theme attribute', async () => {
    dispatch('set-theme', { theme: 'dark' });
    await new Promise(r => setTimeout(r, 300));

    const state = await queryState();
    assert.strictEqual(state.theme, 'dark');
  });

  it('set-theme light applies data-theme attribute', async () => {
    dispatch('set-theme', { theme: 'light' });
    await new Promise(r => setTimeout(r, 300));

    const state = await queryState();
    assert.strictEqual(state.theme, 'light');
  });

  it('set-theme system removes data-theme attribute', async () => {
    dispatch('set-theme', { theme: 'system' });
    await new Promise(r => setTimeout(r, 300));

    const state = await queryState();
    assert.strictEqual(state.theme, 'system');
  });
});
```

- [ ] **Step 2: Commit**

```
git add tests/regression/07-theme.test.js
git commit -m "Add theme switching regression test"
```

---

### Task 11: Font Test

**Files:**
- Create: `tests/regression/08-font.test.js`

- [ ] **Step 1: Write the font test**

```js
// tests/regression/08-font.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestPage, ensureOverlayOpen, queryState, dispatch } from './helpers.js';

describe('Font Switching', () => {
  before(async () => {
    await setupTestPage();
    await ensureOverlayOpen();
  });

  it('set-font opendyslexic applies data-font attribute', async () => {
    dispatch('set-font', { font: 'opendyslexic' });
    await new Promise(r => setTimeout(r, 300));

    const state = await queryState();
    assert.strictEqual(state.font, 'opendyslexic');
  });

  it('set-font system removes data-font attribute', async () => {
    dispatch('set-font', { font: 'system' });
    await new Promise(r => setTimeout(r, 300));

    const state = await queryState();
    // 'system' triggers removeAttribute — query returns 'default' fallback
    assert.ok(
      state.font === 'default' || state.font === 'system',
      `Expected default or system, got: ${state.font}`
    );
  });
});
```

- [ ] **Step 2: Commit**

```
git add tests/regression/08-font.test.js
git commit -m "Add font switching regression test"
```

---

### Task 12: Selection Test

**Files:**
- Create: `tests/regression/09-selection.test.js`

- [ ] **Step 1: Write the selection test**

```js
// tests/regression/09-selection.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestPage, ensureOverlayClosed, queryState, toggle, waitFor, execJS, clickOverlay } from './helpers.js';

describe('Text Selection Mode', () => {
  before(async () => {
    await setupTestPage();
    await ensureOverlayClosed();
  });

  it('opens with selected text and has fewer words than full article', async () => {
    // Get full article word count
    toggle();
    await waitFor(async () => (await queryState()).overlayOpen === true, { timeout: 8000 });
    const fullState = await queryState();
    const fullWordCount = fullState.wordCount;

    // Close overlay
    clickOverlay('.sr-close');
    await waitFor(async () => (await queryState()).overlayOpen === false, { timeout: 5000 });

    // Select a paragraph
    execJS(
      "window.getSelection().removeAllRanges();" +
      "var r = document.createRange();" +
      "var el = document.querySelector('#mw-content-text p');" +
      "if(el){r.selectNodeContents(el); window.getSelection().addRange(r);}"
    );
    await new Promise(r => setTimeout(r, 300));

    // Toggle with selection
    toggle();
    await waitFor(async () => (await queryState()).overlayOpen === true, { timeout: 8000 });

    const selState = await queryState();
    assert.strictEqual(selState.overlayOpen, true);
    assert.ok(selState.wordCount > 0, 'Expected some words from selection');
    assert.ok(selState.wordCount < fullWordCount,
      `Expected selection (${selState.wordCount}) < full article (${fullWordCount})`);

    // Clean up
    clickOverlay('.sr-close');
    await waitFor(async () => (await queryState()).overlayOpen === false, { timeout: 5000 });
  });
});
```

- [ ] **Step 2: Commit**

```
git add tests/regression/09-selection.test.js
git commit -m "Add selection mode regression test"
```

---

### Task 13: Re-toggle Cycle Test

**Files:**
- Create: `tests/regression/10-re-toggle.test.js`

- [ ] **Step 1: Write the re-toggle cycle test**

```js
// tests/regression/10-re-toggle.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestPage, ensureOverlayClosed, queryState, toggle, clickOverlay, waitFor, execJS } from './helpers.js';

describe('Re-toggle Cycle', () => {
  before(async () => {
    await setupTestPage();
    await ensureOverlayClosed();
    execJS("window.getSelection().removeAllRanges()");
  });

  it('open, play, close, re-open works cleanly', async () => {
    // Open
    toggle();
    await waitFor(async () => (await queryState()).overlayOpen === true, { timeout: 8000 });

    // Play briefly
    clickOverlay('.sr-btn-play');
    await waitFor(async () => (await queryState()).isPlaying === true, { timeout: 3000 });
    await new Promise(r => setTimeout(r, 500));

    // Close
    clickOverlay('.sr-close');
    await waitFor(async () => (await queryState()).overlayOpen === false, { timeout: 5000 });

    // Re-open
    toggle();
    await waitFor(async () => (await queryState()).overlayOpen === true, { timeout: 8000 });

    const state = await queryState();
    assert.strictEqual(state.overlayOpen, true);
    assert.ok(state.wordText.length > 0, 'Expected a word after re-open');
    assert.ok(state.wordCount > 0, 'Expected positive word count after re-open');
  });

  it('toggle closes overlay cleanly', async () => {
    toggle();
    await waitFor(async () => (await queryState()).overlayOpen === false, { timeout: 5000 });

    const state = await queryState();
    assert.strictEqual(state.overlayOpen, false);
  });
});
```

- [ ] **Step 2: Commit**

```
git add tests/regression/10-re-toggle.test.js
git commit -m "Add re-toggle cycle regression test"
```

---

### Task 14: Manual Regression Checklist

**Files:**
- Create: `docs/regression-checklist.md`

- [ ] **Step 1: Write the manual checklist**

```markdown
# SpeedReader Manual Regression Checklist

> Run `make test-regression` first. This checklist covers what automation cannot.

## iOS (iPhone)

- [ ] Overlay opens from extension icon
- [ ] Tap anywhere on word area toggles play/pause
- [ ] Swipe-friendly: controls have large tap targets
- [ ] WPM slider works with touch drag
- [ ] Theme follows system (toggle device dark mode)
- [ ] OpenDyslexic font renders correctly
- [ ] Context preview shows on pause
- [ ] Close button dismisses overlay
- [ ] Toast messages appear and auto-dismiss

## iPadOS

- [ ] All iOS checks above pass
- [ ] Keyboard shortcuts work with external keyboard (Space, arrows, Escape)
- [ ] Split View / Slide Over does not break overlay layout
- [ ] Overlay respects safe areas in all orientations

## macOS — Gaps Not Covered by Automation

- [ ] VoiceOver reads all controls and word area
- [ ] Slider is draggable with mouse (not just programmatic set)
- [ ] Overlay appears correctly in both standard and full-screen Safari
- [ ] Extension icon shows correct state (no stale badge)
```

- [ ] **Step 2: Commit**

```
git add docs/regression-checklist.md
git commit -m "Add manual regression checklist for iOS/iPadOS/macOS gaps"
```

---

### Task 15: Makefile Update and Migration

**Files:**
- Modify: `Makefile:25-26`
- Modify: `STRUCTURE.md`
- Delete: `scripts/regression-test.sh`

- [ ] **Step 1: Update the Makefile test-regression target**

Replace lines 25-26:

```makefile
test-regression:
	./scripts/regression-test.sh
```

with:

```makefile
test-regression:
	node --test tests/regression/*.test.js
```

- [ ] **Step 2: Delete the old bash script**

Run: `git rm scripts/regression-test.sh`

- [ ] **Step 3: Update STRUCTURE.md**

In the directory layout section, add the test directories (after the `docs/` section):

```
├── tests/
│   ├── js/                             # Unit tests (Node.js test runner)
│   └── regression/                     # Regression tests (Safari automation)
```

In the "Where Things Go" table, add two rows:

| What | Where |
|------|-------|
| Unit tests (JS) | `tests/js/` |
| Regression tests | `tests/regression/` |
| Safari driver (test infra) | `scripts/lib/` |

- [ ] **Step 4: Verify the Makefile target parses**

Run: `make -n test-regression`

Expected: prints `node --test tests/regression/*.test.js`

- [ ] **Step 5: Commit**

```
git add Makefile STRUCTURE.md
git commit -m "Migrate test-regression from bash to Node.js suite, update structure docs"
```

---

### Task 16: Full Suite Smoke Test

- [ ] **Step 1: Build and run the extension in Safari**

Open Xcode, build and run SpeedReader (Cmd+R). Enable the extension in Safari if not already enabled. Enable Safari > Develop > Allow JavaScript from Apple Events.

- [ ] **Step 2: Run the full regression suite**

Run: `make test-regression`

Expected: all tests pass.

- [ ] **Step 3: Run existing unit tests to verify no regressions**

Run: `make test-js`

Expected: all unit tests pass.

- [ ] **Step 4: Commit any fixes if needed**

If any tests needed fixes during the smoke test:

```
git add -A
git commit -m "Fix issues found during regression suite smoke test"
```

Skip this step if no fixes were needed.

---

### Task 17: Update ROADMAP.md

**Files:**
- Modify: `ROADMAP.md:30`

- [ ] **Step 1: Check off the hardening item**

Change line 30:

```markdown
- [ ] Full regression test infrastructure — `make send`-style command router, scripted assertions for all overlay states, keyboard shortcuts, WPM changes, theme switching, multi-platform coverage
```

to:

```markdown
- [x] Full regression test infrastructure — modular Node.js suite with Safari driver, dispatch command router, keyboard/WPM/theme/font coverage, manual iOS/iPadOS checklist
```

- [ ] **Step 2: Commit**

```
git add ROADMAP.md
git commit -m "Mark regression test infrastructure complete in roadmap"
```
