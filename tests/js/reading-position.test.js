import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl } from '../../SpeedReader/SpeedReaderExtension/Resources/rsvp/reading-position.js';

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
