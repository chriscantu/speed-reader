# Crash Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add crash and error visibility using Apple-native crash reporting for Swift and custom JS error capture for the extension — zero third-party dependencies, zero PII collection, zero cost.

**Architecture:** Two independent subsystems: (1) MetricKit subscriber in the container app that logs crash diagnostics via `os_log`, and (2) a JS error capture module (`error-reporter.js`) that intercepts uncaught errors, persists them to `browser.storage.local` (FIFO, 50-entry cap), and bridges them to native `os_log` via `sendNativeMessage()`. The native message handler in `SafariWebExtensionHandler.swift` receives JS error payloads and writes them to `os_log` with category `JSError`.

**Tech Stack:** Swift (MetricKit, os_log, OSLog), JavaScript (ES2020+, WebExtension APIs), Node.js built-in test runner

**Spec:** `docs/superpowers/specs/2026-04-09-crash-reporting-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `SpeedReader/SpeedReaderExtension/Resources/error-reporter.js` | Create | JS error capture: interceptors, payload formatting, FIFO storage, PII scrubbing, native bridge |
| `SpeedReader/SpeedReaderExtension/Resources/background.js` | Modify | Import error reporter, register service worker error handlers |
| `SpeedReader/SpeedReaderExtension/Resources/content.js` | Modify | Import error reporter, register window error handlers |
| `SpeedReader/SpeedReaderExtension/SafariWebExtensionHandler.swift` | Modify | Handle `jsError` action, log via os_log with JSError category |
| `SpeedReader/SpeedReader/SpeedReaderApp.swift` | Modify | Register MetricKit subscriber on app init |
| `SpeedReader/SpeedReader/Models/CrashDiagnosticsSubscriber.swift` | Create | MXMetricManagerSubscriber implementation |
| `tests/js/error-reporter.test.js` | Create | Unit tests for JS error capture module |

---

## Task 1: JS Error Reporter Module — Core Payload & Storage

Build the pure-logic core of `error-reporter.js`: payload formatting, PII scrubbing (hostname extraction), and FIFO storage with 50-entry cap. No browser event listeners yet — just the functions that the interceptors will call.

**Files:**
- Create: `SpeedReader/SpeedReaderExtension/Resources/error-reporter.js`
- Create: `tests/js/error-reporter.test.js`

### Step 1: Write failing tests for payload formatting and PII scrubbing

- [ ] **1.1 Create test file with payload and scrubbing tests**

```js
// tests/js/error-reporter.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatErrorPayload,
  extractHostname,
  ERROR_LOG_CAP,
} from '../../SpeedReader/SpeedReaderExtension/Resources/error-reporter.js';

describe('extractHostname', () => {
  it('extracts hostname from a full URL', () => {
    assert.strictEqual(extractHostname('https://example.com/path?q=1#hash'), 'example.com');
  });

  it('extracts hostname from URL with port', () => {
    assert.strictEqual(extractHostname('https://example.com:8080/path'), 'example.com');
  });

  it('returns empty string for empty input', () => {
    assert.strictEqual(extractHostname(''), '');
  });

  it('returns empty string for null/undefined', () => {
    assert.strictEqual(extractHostname(null), '');
    assert.strictEqual(extractHostname(undefined), '');
  });

  it('returns empty string for malformed URL', () => {
    assert.strictEqual(extractHostname('not a url'), '');
  });
});

describe('formatErrorPayload', () => {
  it('formats an Error object into the expected shape', () => {
    const error = new TypeError('Cannot read property');
    error.stack = 'TypeError: Cannot read property\n    at content.js:42:12';
    const payload = formatErrorPayload(error, 'content', 'https://example.com/article?id=5');

    assert.strictEqual(payload.message, 'Cannot read property');
    assert.strictEqual(payload.stack, 'TypeError: Cannot read property\n    at content.js:42:12');
    assert.strictEqual(payload.source, 'content');
    assert.strictEqual(payload.url, 'example.com');
    assert.ok(payload.timestamp);
    assert.ok(payload.userAgent);
  });

  it('strips path and query from URL — hostname only', () => {
    const payload = formatErrorPayload(
      new Error('test'),
      'content',
      'https://secret.example.com/private/path?token=abc123'
    );
    assert.strictEqual(payload.url, 'secret.example.com');
  });

  it('handles error with no stack trace', () => {
    const error = new Error('no stack');
    error.stack = undefined;
    const payload = formatErrorPayload(error, 'overlay', '');
    assert.strictEqual(payload.stack, '');
    assert.strictEqual(payload.source, 'overlay');
  });

  it('handles string error message instead of Error object', () => {
    const payload = formatErrorPayload('Something broke', 'background', '');
    assert.strictEqual(payload.message, 'Something broke');
    assert.strictEqual(payload.stack, '');
  });

  it('truncates very long error messages to 500 chars', () => {
    const longMessage = 'x'.repeat(1000);
    const payload = formatErrorPayload(new Error(longMessage), 'content', '');
    assert.ok(payload.message.length <= 500);
  });
});

describe('ERROR_LOG_CAP', () => {
  it('is 50', () => {
    assert.strictEqual(ERROR_LOG_CAP, 50);
  });
});
```

- [ ] **1.2 Run tests to verify they fail**

Run: `node --test tests/js/error-reporter.test.js`
Expected: FAIL — module not found

### Step 2: Implement core functions

- [ ] **1.3 Create error-reporter.js with payload formatting, hostname extraction, and constants**

```js
// SpeedReader/SpeedReaderExtension/Resources/error-reporter.js

/**
 * Lightweight error capture for the SpeedReader extension.
 * Intercepts uncaught errors and unhandled promise rejections,
 * persists them to browser.storage.local (FIFO, capped),
 * and bridges them to native os_log via sendNativeMessage().
 *
 * @module error-reporter
 */

export const ERROR_LOG_CAP = 50;
const MAX_MESSAGE_LENGTH = 500;

/**
 * Extract hostname from a URL string. Returns empty string on failure.
 * Strips path, query params, port — PII-safe.
 */
export function extractHostname(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Format an error into a storage-safe payload.
 * @param {Error|string} error - The caught error or error message string
 * @param {string} source - Which script: 'content', 'background', 'overlay'
 * @param {string} pageUrl - The full page URL (will be stripped to hostname)
 * @returns {object} Payload with timestamp, message, stack, source, url, userAgent
 */
export function formatErrorPayload(error, source, pageUrl) {
  let message = '';
  let stack = '';

  if (error instanceof Error) {
    message = error.message || '';
    stack = error.stack || '';
  } else {
    message = String(error);
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    message = message.slice(0, MAX_MESSAGE_LENGTH);
  }

  return {
    timestamp: new Date().toISOString(),
    message,
    stack,
    source,
    url: extractHostname(pageUrl),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  };
}
```

- [ ] **1.4 Run tests to verify they pass**

Run: `node --test tests/js/error-reporter.test.js`
Expected: All tests PASS

- [ ] **1.5 Commit**

```
git add SpeedReader/SpeedReaderExtension/Resources/error-reporter.js tests/js/error-reporter.test.js
git commit -m "Add error-reporter module with payload formatting and PII scrubbing"
```

---

## Task 2: JS Error Reporter — FIFO Storage

Add the storage layer: `storeError()` writes to `browser.storage.local` under key `errorLog`, capped at 50 entries FIFO. Tested with a mock `browser.storage.local`.

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/error-reporter.js`
- Modify: `tests/js/error-reporter.test.js`

### Step 1: Write failing tests for FIFO storage

- [ ] **2.1 Add storage tests to error-reporter.test.js**

Append to `tests/js/error-reporter.test.js`:

```js
import { storeError } from '../../SpeedReader/SpeedReaderExtension/Resources/error-reporter.js';

// Minimal mock of browser.storage.local for testing storeError().
// storeError() accepts an optional storage parameter for testability.
function createMockStorage(initialData = {}) {
  const data = { ...initialData };
  return {
    get(keys) {
      const result = {};
      for (const key of Object.keys(keys)) {
        result[key] = data[key] !== undefined ? data[key] : keys[key];
      }
      return Promise.resolve(result);
    },
    set(items) {
      Object.assign(data, items);
      return Promise.resolve();
    },
    _getData() { return data; },
  };
}

describe('storeError — FIFO storage', () => {
  it('stores an error payload in errorLog array', async () => {
    const storage = createMockStorage({});
    const payload = { message: 'test', timestamp: '2026-01-01T00:00:00Z', source: 'content', stack: '', url: '', userAgent: '' };
    await storeError(payload, storage);
    const data = storage._getData();
    assert.strictEqual(data.errorLog.length, 1);
    assert.strictEqual(data.errorLog[0].message, 'test');
  });

  it('appends to existing errorLog', async () => {
    const existing = [{ message: 'first' }];
    const storage = createMockStorage({ errorLog: existing });
    await storeError({ message: 'second' }, storage);
    const data = storage._getData();
    assert.strictEqual(data.errorLog.length, 2);
    assert.strictEqual(data.errorLog[1].message, 'second');
  });

  it('caps at 50 entries, dropping oldest', async () => {
    const existing = Array.from({ length: 50 }, (_, i) => ({ message: `error-${i}` }));
    const storage = createMockStorage({ errorLog: existing });
    await storeError({ message: 'new-error' }, storage);
    const data = storage._getData();
    assert.strictEqual(data.errorLog.length, 50);
    assert.strictEqual(data.errorLog[0].message, 'error-1');
    assert.strictEqual(data.errorLog[49].message, 'new-error');
  });

  it('caps correctly when writing 5 over the limit', async () => {
    const existing = Array.from({ length: 50 }, (_, i) => ({ message: `error-${i}` }));
    const storage = createMockStorage({ errorLog: existing });
    for (let i = 0; i < 5; i++) {
      await storeError({ message: `overflow-${i}` }, storage);
    }
    const data = storage._getData();
    assert.strictEqual(data.errorLog.length, 50);
    assert.strictEqual(data.errorLog[45].message, 'overflow-0');
    assert.strictEqual(data.errorLog[49].message, 'overflow-4');
  });
});
```

- [ ] **2.2 Run tests to verify new tests fail**

Run: `node --test tests/js/error-reporter.test.js`
Expected: FAIL — `storeError` not exported

### Step 2: Implement storeError

- [ ] **2.3 Add storeError function to error-reporter.js**

Add to the bottom of `error-reporter.js`, before the closing:

```js
/**
 * Persist an error payload to browser.storage.local under 'errorLog'.
 * FIFO: drops oldest entries when the log exceeds ERROR_LOG_CAP.
 *
 * @param {object} payload - Formatted error payload from formatErrorPayload()
 * @param {object} [storage] - Storage backend (defaults to browser.storage.local). Accepts any object with get()/set() returning promises — used for testing.
 */
export async function storeError(payload, storage) {
  const store = storage || browser.storage.local;
  const { errorLog } = await store.get({ errorLog: [] });
  errorLog.push(payload);
  if (errorLog.length > ERROR_LOG_CAP) {
    errorLog.splice(0, errorLog.length - ERROR_LOG_CAP);
  }
  await store.set({ errorLog });
}
```

- [ ] **2.4 Run tests to verify they pass**

Run: `node --test tests/js/error-reporter.test.js`
Expected: All tests PASS

- [ ] **2.5 Commit**

```
git add SpeedReader/SpeedReaderExtension/Resources/error-reporter.js tests/js/error-reporter.test.js
git commit -m "Add FIFO error storage with 50-entry cap"
```

---

## Task 3: JS Error Reporter — Native Bridge & reportError()

Add `sendToNative()` (fire-and-forget bridge to `SafariWebExtensionHandler`) and `reportError()` (the public API for explicit try-catch usage). `sendToNative()` calls `browser.runtime.sendNativeMessage()` — failures are swallowed (fire-and-forget per spec).

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/error-reporter.js`
- Modify: `tests/js/error-reporter.test.js`

### Step 1: Write failing tests

- [ ] **3.1 Add tests for reportError and sendToNative**

Append to `tests/js/error-reporter.test.js`:

```js
import { reportError } from '../../SpeedReader/SpeedReaderExtension/Resources/error-reporter.js';

describe('reportError — public API', () => {
  it('formats, stores, and returns the payload', async () => {
    const storage = createMockStorage({});
    const payload = await reportError(
      new Error('explicit catch'),
      'overlay',
      'https://example.com/page',
      { storage }
    );
    assert.strictEqual(payload.message, 'explicit catch');
    assert.strictEqual(payload.source, 'overlay');
    assert.strictEqual(payload.url, 'example.com');
    const data = storage._getData();
    assert.strictEqual(data.errorLog.length, 1);
  });

  it('does not throw when storage fails', async () => {
    const brokenStorage = {
      get() { return Promise.reject(new Error('storage broken')); },
      set() { return Promise.reject(new Error('storage broken')); },
    };
    // Should not throw — reportError is defensive
    const payload = await reportError(new Error('test'), 'content', '', { storage: brokenStorage });
    assert.strictEqual(payload, null);
  });
});
```

- [ ] **3.2 Run tests to verify new tests fail**

Run: `node --test tests/js/error-reporter.test.js`
Expected: FAIL — `reportError` not exported

### Step 2: Implement sendToNative and reportError

- [ ] **3.3 Add sendToNative and reportError to error-reporter.js**

Add to the bottom of `error-reporter.js`:

```js
/**
 * Fire-and-forget: send error payload to native SafariWebExtensionHandler
 * via sendNativeMessage. Swallows errors — if native side is unavailable,
 * the error remains in browser.storage.local as fallback.
 */
function sendToNative(payload) {
  if (typeof browser === 'undefined' || !browser.runtime || !browser.runtime.sendNativeMessage) {
    return;
  }
  browser.runtime.sendNativeMessage(
    'com.chriscantu.SpeedReader',
    { action: 'jsError', error: payload }
  ).catch(() => {
    // Fire-and-forget — native handler unavailable is not fatal
  });
}

/**
 * Public API for explicit error reporting from try-catch blocks.
 * Formats the error, stores it, and bridges it to native logging.
 *
 * @param {Error|string} error - The caught error
 * @param {string} source - Which script: 'content', 'background', 'overlay'
 * @param {string} [pageUrl=''] - Current page URL (stripped to hostname)
 * @param {object} [options={}] - Options. Pass { storage } for testing.
 * @returns {Promise<object|null>} The stored payload, or null if storage failed
 */
export async function reportError(error, source, pageUrl, options) {
  const opts = options || {};
  const payload = formatErrorPayload(error, source, pageUrl || '');
  try {
    await storeError(payload, opts.storage);
    sendToNative(payload);
    return payload;
  } catch {
    return null;
  }
}
```

- [ ] **3.4 Run tests to verify they pass**

Run: `node --test tests/js/error-reporter.test.js`
Expected: All tests PASS

- [ ] **3.5 Commit**

```
git add SpeedReader/SpeedReaderExtension/Resources/error-reporter.js tests/js/error-reporter.test.js
git commit -m "Add reportError public API and native bridge"
```

---

## Task 4: JS Error Reporter — Event Interceptors

Add `installWindowHandlers(source, pageUrl)` for content/overlay scripts and `installServiceWorkerHandlers(source)` for the background script. These register the global `error` and `unhandledrejection` listeners that feed into `reportError()`.

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/error-reporter.js`
- Modify: `tests/js/error-reporter.test.js`

### Step 1: Write failing tests

- [ ] **4.1 Add interceptor tests**

Append to `tests/js/error-reporter.test.js`:

```js
import {
  installWindowHandlers,
  installServiceWorkerHandlers,
} from '../../SpeedReader/SpeedReaderExtension/Resources/error-reporter.js';

// Mock event target — simulates window or self for handler registration
function createMockTarget() {
  const listeners = {};
  return {
    addEventListener(type, handler) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(handler);
    },
    dispatch(type, event) {
      (listeners[type] || []).forEach((h) => h(event));
    },
    getListeners(type) {
      return listeners[type] || [];
    },
  };
}

describe('installWindowHandlers', () => {
  it('registers error and unhandledrejection listeners', () => {
    const target = createMockTarget();
    const storage = createMockStorage({});
    installWindowHandlers('content', '', { target, storage });
    assert.strictEqual(target.getListeners('error').length, 1);
    assert.strictEqual(target.getListeners('unhandledrejection').length, 1);
  });

  it('error listener stores a formatted payload', async () => {
    const target = createMockTarget();
    const storage = createMockStorage({});
    installWindowHandlers('content', 'https://example.com', { target, storage });

    target.dispatch('error', {
      error: new TypeError('null ref'),
      message: 'Uncaught TypeError: null ref',
    });

    // Give the async handler time to complete
    await new Promise((r) => setTimeout(r, 50));
    const data = storage._getData();
    assert.strictEqual(data.errorLog.length, 1);
    assert.strictEqual(data.errorLog[0].source, 'content');
    assert.strictEqual(data.errorLog[0].url, 'example.com');
  });

  it('unhandledrejection listener stores a formatted payload', async () => {
    const target = createMockTarget();
    const storage = createMockStorage({});
    installWindowHandlers('overlay', '', { target, storage });

    target.dispatch('unhandledrejection', {
      reason: new Error('promise failed'),
    });

    await new Promise((r) => setTimeout(r, 50));
    const data = storage._getData();
    assert.strictEqual(data.errorLog.length, 1);
    assert.ok(data.errorLog[0].message.includes('promise failed'));
  });
});

describe('installServiceWorkerHandlers', () => {
  it('registers error and unhandledrejection on self-like target', () => {
    const target = createMockTarget();
    const storage = createMockStorage({});
    installServiceWorkerHandlers({ target, storage });
    assert.strictEqual(target.getListeners('error').length, 1);
    assert.strictEqual(target.getListeners('unhandledrejection').length, 1);
  });

  it('error listener uses source "background"', async () => {
    const target = createMockTarget();
    const storage = createMockStorage({});
    installServiceWorkerHandlers({ target, storage });

    target.dispatch('error', {
      error: new Error('sw error'),
      message: 'Uncaught Error: sw error',
    });

    await new Promise((r) => setTimeout(r, 50));
    const data = storage._getData();
    assert.strictEqual(data.errorLog[0].source, 'background');
  });
});
```

- [ ] **4.2 Run tests to verify new tests fail**

Run: `node --test tests/js/error-reporter.test.js`
Expected: FAIL — functions not exported

### Step 2: Implement interceptors

- [ ] **4.3 Add installWindowHandlers and installServiceWorkerHandlers to error-reporter.js**

Add to the bottom of `error-reporter.js`:

```js
/**
 * Install global error and unhandledrejection handlers on a window-like target.
 * Used by content.js and overlay.js (runs in page context with `window`).
 *
 * @param {string} source - Script identifier: 'content' or 'overlay'
 * @param {string} pageUrl - Current page URL (will be stripped to hostname)
 * @param {object} [options={}] - Options. Pass { target, storage } for testing.
 */
export function installWindowHandlers(source, pageUrl, options) {
  const opts = options || {};
  const target = opts.target || window;

  target.addEventListener('error', (event) => {
    const error = event.error || event.message || 'Unknown error';
    reportError(error, source, pageUrl, { storage: opts.storage });
  });

  target.addEventListener('unhandledrejection', (event) => {
    const error = event.reason || 'Unhandled promise rejection';
    reportError(error, source, pageUrl, { storage: opts.storage });
  });
}

/**
 * Install global error and unhandledrejection handlers on a service worker target.
 * Used by background.js (runs in service worker context — no `window`).
 *
 * @param {object} [options={}] - Options. Pass { target, storage } for testing.
 */
export function installServiceWorkerHandlers(options) {
  const opts = options || {};
  const target = opts.target || self;

  target.addEventListener('error', (event) => {
    const error = event.error || event.message || 'Unknown error';
    reportError(error, 'background', '', { storage: opts.storage });
  });

  target.addEventListener('unhandledrejection', (event) => {
    const error = event.reason || 'Unhandled promise rejection';
    reportError(error, 'background', '', { storage: opts.storage });
  });
}
```

- [ ] **4.4 Run tests to verify they pass**

Run: `node --test tests/js/error-reporter.test.js`
Expected: All tests PASS

- [ ] **4.5 Commit**

```
git add SpeedReader/SpeedReaderExtension/Resources/error-reporter.js tests/js/error-reporter.test.js
git commit -m "Add window and service worker error interceptors"
```

---

## Task 5: Wire Error Reporter into content.js and background.js

Import `error-reporter.js` into the two extension scripts and activate the interceptors.

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/Resources/content.js` (top of file)
- Modify: `SpeedReader/SpeedReaderExtension/Resources/background.js` (top of file)

### Step 1: Wire into content.js

- [ ] **5.1 Add error reporter import and initialization to content.js**

Add these lines near the top of `content.js`, after the existing `let` declarations (after line 6):

```js
// Error reporting — capture uncaught errors and unhandled rejections.
// Uses dynamic import since content.js runs as a classic script in Safari.
import(browser.runtime.getURL('error-reporter.js')).then((mod) => {
  mod.installWindowHandlers('content', window.location.href);
}).catch((e) => {
  console.error('[SpeedReader] Failed to load error reporter:', e);
});
```

### Step 2: Wire into background.js

- [ ] **5.2 Add error reporter import and initialization to background.js**

Add these lines at the very top of `background.js`, before the existing `browser.action.onClicked` listener:

```js
// Error reporting — capture uncaught errors and unhandled rejections
// in the service worker context.
import(browser.runtime.getURL('error-reporter.js')).then((mod) => {
  mod.installServiceWorkerHandlers();
}).catch((e) => {
  console.error('[SpeedReader] Failed to load error reporter:', e);
});
```

- [ ] **5.3 Commit**

```
git add SpeedReader/SpeedReaderExtension/Resources/content.js SpeedReader/SpeedReaderExtension/Resources/background.js
git commit -m "Wire error reporter into content and background scripts"
```

---

## Task 6: Native Bridge — SafariWebExtensionHandler Handles jsError

Add a `jsError` case to the message handler in `SafariWebExtensionHandler.swift` that receives JS error payloads and logs them via `os_log` with a dedicated `JSError` category.

**Files:**
- Modify: `SpeedReader/SpeedReaderExtension/SafariWebExtensionHandler.swift`

### Step 1: Add jsError handler

- [ ] **6.1 Add Logger and jsError case to SafariWebExtensionHandler.swift**

At the top of the class (after the class declaration on line 4), add the logger:

```swift
private static let jsErrorLog = Logger(
    subsystem: "com.chriscantu.SpeedReader",
    category: "JSError"
)
```

Then in the `switch action` block (after the `"ping"` case, before `default:`), add:

```swift
case "jsError":
    if let errorData = messageDict["error"] as? [String: Any] {
        let message = errorData["message"] as? String ?? "Unknown error"
        let source = errorData["source"] as? String ?? "unknown"
        let stack = errorData["stack"] as? String ?? ""
        let host = errorData["url"] as? String ?? ""

        let stackLine = stack.isEmpty ? "" : "\nStack: \(stack.components(separatedBy: "\n").prefix(3).joined(separator: " → "))"
        let hostLine = host.isEmpty ? "" : "\nHost: \(host)"

        Self.jsErrorLog.error("[SpeedReader:JSError] \(source, privacy: .public) — \(message, privacy: .public)\(stackLine, privacy: .public)\(hostLine, privacy: .public)")
    } else {
        Self.jsErrorLog.error("[SpeedReader:JSError] Received jsError with missing/invalid error payload")
    }
    response.userInfo = [SFExtensionMessageKey: ["status": "ok"]]
```

- [ ] **6.2 Verify it builds**

Run: `xcodebuild build -project SpeedReader/SpeedReader.xcodeproj -scheme SpeedReader -destination 'platform=macOS' -quiet`
Expected: BUILD SUCCEEDED

- [ ] **6.3 Commit**

```
git add SpeedReader/SpeedReaderExtension/SafariWebExtensionHandler.swift
git commit -m "Handle jsError messages in SafariWebExtensionHandler with os_log"
```

---

## Task 7: MetricKit Subscriber — CrashDiagnosticsSubscriber

Create the `MXMetricManagerSubscriber` that registers on app launch and logs crash diagnostics via `os_log`.

**Files:**
- Create: `SpeedReader/SpeedReader/Models/CrashDiagnosticsSubscriber.swift`
- Modify: `SpeedReader/SpeedReader/SpeedReaderApp.swift`

### Step 1: Create the subscriber

- [ ] **7.1 Create CrashDiagnosticsSubscriber.swift**

```swift
// SpeedReader/SpeedReader/Models/CrashDiagnosticsSubscriber.swift

import MetricKit
import OSLog

/// Receives MetricKit diagnostic payloads (crash reports, hangs, disk/memory warnings)
/// and logs them via os_log for Console.app visibility.
///
/// MetricKit delivers payloads at most once per day. Crash diagnostics include
/// stack traces, signal info, and exception details — all anonymized by Apple.
final class CrashDiagnosticsSubscriber: NSObject, MXMetricManagerSubscriber {

    static let shared = CrashDiagnosticsSubscriber()

    private static let log = Logger(
        subsystem: "com.chriscantu.SpeedReader",
        category: "CrashDiagnostics"
    )

    private override init() {
        super.init()
    }

    /// Register this subscriber with MetricKit. Call once at app launch.
    func register() {
        MXMetricManager.shared.add(self)
        Self.log.info("[SpeedReader:CrashDiagnostics] Subscriber registered")
    }

    // MARK: - MXMetricManagerSubscriber

    func didReceive(_ payloads: [MXMetricPayload]) {
        Self.log.info("[SpeedReader:CrashDiagnostics] Received \(payloads.count) metric payload(s)")
    }

    func didReceive(_ payloads: [MXDiagnosticPayload]) {
        for payload in payloads {
            if let crashDiagnostics = payload.crashDiagnostics {
                for crash in crashDiagnostics {
                    Self.log.error(
                        "[SpeedReader:CrashDiagnostics] Crash: \(crash.applicationVersion, privacy: .public) signal \(crash.signal?.description ?? "unknown", privacy: .public)"
                    )
                }
            }

            if let hangDiagnostics = payload.hangDiagnostics {
                Self.log.warning(
                    "[SpeedReader:CrashDiagnostics] \(hangDiagnostics.count) hang diagnostic(s) received"
                )
            }

            if let diskWriteExceptions = payload.diskWriteExceptionDiagnostics {
                Self.log.warning(
                    "[SpeedReader:CrashDiagnostics] \(diskWriteExceptions.count) disk write exception(s) received"
                )
            }
        }
    }
}
```

### Step 2: Register on app launch

- [ ] **7.2 Add MetricKit registration to SpeedReaderApp.swift**

In `SpeedReaderApp.init()`, after `Self.registerCustomFonts()`, add:

```swift
CrashDiagnosticsSubscriber.shared.register()
```

Also add `import MetricKit` at the top of the file (after the existing imports).

- [ ] **7.3 Verify it builds**

Run: `xcodebuild build -project SpeedReader/SpeedReader.xcodeproj -scheme SpeedReader -destination 'platform=macOS' -quiet`
Expected: BUILD SUCCEEDED

- [ ] **7.4 Commit**

```
git add SpeedReader/SpeedReader/Models/CrashDiagnosticsSubscriber.swift SpeedReader/SpeedReader/SpeedReaderApp.swift
git commit -m "Add MetricKit crash diagnostics subscriber"
```

---

## Task 8: Add error-reporter.js to Xcode Project

The new `error-reporter.js` file needs to be included in the extension target's "Copy Bundle Resources" build phase so Safari can load it at runtime.

**Files:**
- Modify: `SpeedReader/SpeedReader.xcodeproj/project.pbxproj`

- [ ] **8.1 Add error-reporter.js to the Xcode project**

Open the Xcode project and add `error-reporter.js` to the SpeedReaderExtension target's resources:

Run: `open SpeedReader/SpeedReader.xcodeproj`

In Xcode:
1. Right-click `SpeedReaderExtension/Resources` in the project navigator
2. Select "Add Files to SpeedReader..."
3. Select `error-reporter.js`
4. Ensure "SpeedReaderExtension" target is checked
5. Click Add

Alternatively, if using `xcodebuild` and the file is already in the Resources directory, verify it's included:

Run: `grep -c 'error-reporter' SpeedReader/SpeedReader.xcodeproj/project.pbxproj`
Expected: At least 1 match after adding

- [ ] **8.2 Similarly add CrashDiagnosticsSubscriber.swift to the SpeedReader app target**

In Xcode:
1. Right-click `SpeedReader/Models` in the project navigator
2. Select "Add Files to SpeedReader..."
3. Select `CrashDiagnosticsSubscriber.swift`
4. Ensure "SpeedReader" target is checked
5. Click Add

- [ ] **8.3 Verify full build succeeds**

Run: `xcodebuild build -project SpeedReader/SpeedReader.xcodeproj -scheme SpeedReader -destination 'platform=macOS' -quiet`
Expected: BUILD SUCCEEDED

- [ ] **8.4 Commit**

```
git add SpeedReader/SpeedReader.xcodeproj/project.pbxproj
git commit -m "Add error-reporter.js and CrashDiagnosticsSubscriber to Xcode project"
```

---

## Task 9: Run Full Test Suite & Lint

Final verification that nothing is broken.

- [ ] **9.1 Run JS tests**

Run: `make test-js`
Expected: All tests pass, including new error-reporter tests

- [ ] **9.2 Run linters**

Run: `make lint-all`
Expected: No errors

- [ ] **9.3 Run Swift build + test**

Run: `make test-swift`
Expected: BUILD SUCCEEDED, tests pass

- [ ] **9.4 Fix any issues found, commit fixes if needed**

---

## Summary

| Task | What | Tests |
|------|------|-------|
| 1 | Core payload formatting, PII scrubbing, constants | 9 unit tests |
| 2 | FIFO storage with 50-entry cap | 4 unit tests |
| 3 | reportError() public API + native bridge | 2 unit tests |
| 4 | Window + service worker error interceptors | 5 unit tests |
| 5 | Wire into content.js + background.js | Manual verify |
| 6 | SafariWebExtensionHandler jsError handler | Build verify |
| 7 | MetricKit CrashDiagnosticsSubscriber | Build verify |
| 8 | Add new files to Xcode project | Build verify |
| 9 | Full test suite + lint | CI gate |
