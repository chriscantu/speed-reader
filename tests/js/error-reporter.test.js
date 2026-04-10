import { describe, it } from 'node:test';
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
