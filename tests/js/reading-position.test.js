import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, hashText } from '../../SpeedReader/SpeedReaderExtension/Resources/rsvp/reading-position.js';

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
});
