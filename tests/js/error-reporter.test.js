import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatErrorPayload,
  extractHostname,
  ERROR_LOG_CAP,
  storeError,
  reportError,
  installWindowHandlers,
  installServiceWorkerHandlers,
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
    assert.ok(payload.userAgent !== undefined);
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
