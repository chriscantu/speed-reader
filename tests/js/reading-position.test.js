import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

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

import { normalizeUrl, hashText, save, restore, clear } from '../../SpeedReader/SpeedReaderExtension/Resources/rsvp/reading-position.js';

describe('normalizeUrl', () => {
  it('returns protocol + host + path unchanged for clean URLs', () => {
    assert.strictEqual(normalizeUrl('https://example.com/article'), 'https://example.com/article');
  });
  it('strips fragment', () => {
    assert.strictEqual(normalizeUrl('https://example.com/article#section2'), 'https://example.com/article');
  });
  it('strips trailing slash', () => {
    assert.strictEqual(normalizeUrl('https://example.com/article/'), 'https://example.com/article');
  });
  it('strips utm_* tracking params', () => {
    assert.strictEqual(normalizeUrl('https://example.com/article?utm_source=twitter&utm_medium=social'), 'https://example.com/article');
  });
  it('strips fbclid and gclid', () => {
    assert.strictEqual(normalizeUrl('https://example.com/article?fbclid=abc123&gclid=def456'), 'https://example.com/article');
  });
  it('strips ref and source params', () => {
    assert.strictEqual(normalizeUrl('https://example.com/article?ref=homepage&source=nav'), 'https://example.com/article');
  });
  it('preserves non-tracking query params', () => {
    assert.strictEqual(normalizeUrl('https://example.com/article?page=2&id=123'), 'https://example.com/article?id=123&page=2');
  });
  it('preserves non-tracking params while stripping tracking ones', () => {
    assert.strictEqual(normalizeUrl('https://example.com/article?utm_source=twitter&page=2'), 'https://example.com/article?page=2');
  });
  it('sorts remaining query params for consistent keys', () => {
    assert.strictEqual(normalizeUrl('https://example.com/article?z=1&a=2'), 'https://example.com/article?a=2&z=1');
  });
  it('removes ? when all params are tracking params', () => {
    assert.strictEqual(normalizeUrl('https://example.com/article?utm_source=twitter'), 'https://example.com/article');
  });
  it('returns raw string for invalid URLs', () => {
    assert.strictEqual(normalizeUrl('not-a-url'), 'not-a-url');
  });
});

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

  it('uses full text at exactly 200 chars', () => {
    const text200 = 'A'.repeat(100) + 'X' + 'B'.repeat(99);
    const text200alt = 'A'.repeat(100) + 'Y' + 'B'.repeat(99);
    assert.notStrictEqual(hashText(text200), hashText(text200alt));
  });

  it('samples only first/last 100 chars at 201 chars', () => {
    const text201a = 'A'.repeat(100) + 'X' + 'B'.repeat(100);
    const text201b = 'A'.repeat(100) + 'Y' + 'B'.repeat(100);
    assert.strictEqual(hashText(text201a), hashText(text201b));
  });
});

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
    await save('https://example.com/new-page', 'New article text', 5, 50);
    const stored = mockStorage.readingPositions;
    assert.strictEqual(Object.keys(stored).length, 100);
    assert.strictEqual(stored['https://example.com/page0'], undefined);
    assert.ok(stored['https://example.com/new-page']);
  });

  it('evicts oldest by timestamp, not insertion order', async () => {
    mockStorage = {};
    const positions = {};
    for (let i = 0; i < 100; i++) {
      positions['https://example.com/page' + i] = {
        index: 10, total: 100, textHash: 'abc', timestamp: 2000 + i,
      };
    }
    // Make page50 the oldest entry
    positions['https://example.com/page50'].timestamp = 100;
    mockStorage = { readingPositions: positions };
    await save('https://example.com/new-page', 'New article text', 5, 50);
    const stored = mockStorage.readingPositions;
    assert.strictEqual(Object.keys(stored).length, 100);
    assert.strictEqual(stored['https://example.com/page50'], undefined);
    assert.ok(stored['https://example.com/page0']);
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
    const url = 'https://example.com/article';
    const text = 'Short text';
    mockStorage = {
      readingPositions: {
        [normalizeUrl(url)]: {
          index: 500, total: 200, textHash: hashText(text), timestamp: Date.now(),
        },
      },
    };
    const index = await restore(url, text);
    assert.strictEqual(index, null);
  });

  it('returns null when index equals total (out of bounds)', async () => {
    mockStorage = {};
    const url = 'https://example.com/article';
    const text = 'Some text';
    mockStorage = {
      readingPositions: {
        [normalizeUrl(url)]: {
          index: 200, total: 200, textHash: hashText(text), timestamp: Date.now(),
        },
      },
    };
    const index = await restore(url, text);
    assert.strictEqual(index, null);
  });

  it('returns index when index equals total minus one (last valid word)', async () => {
    mockStorage = {};
    const url = 'https://example.com/article';
    const text = 'Some text';
    mockStorage = {
      readingPositions: {
        [normalizeUrl(url)]: {
          index: 199, total: 200, textHash: hashText(text), timestamp: Date.now(),
        },
      },
    };
    const index = await restore(url, text);
    assert.strictEqual(index, 199);
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
