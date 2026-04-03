import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateFocusPoint, splitWordAtFocus } from '../../SpeedReader/SpeedReaderExtension/Resources/rsvp/focus-point.js';

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
