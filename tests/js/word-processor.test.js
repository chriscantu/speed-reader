import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { processText, calculateDelay, wpmToDelay } from '../../SpeedReader/SpeedReaderExtension/Resources/rsvp/word-processor.js';

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

  it('returns base delay for empty string', () => {
    assert.strictEqual(calculateDelay('', baseDelay), baseDelay);
  });

  it('returns base delay for undefined', () => {
    assert.strictEqual(calculateDelay(undefined, baseDelay), baseDelay);
  });

  it('returns base delay for null', () => {
    assert.strictEqual(calculateDelay(null, baseDelay), baseDelay);
  });
});

describe('wpmToDelay', () => {
  it('converts 250 WPM to 240ms', () => {
    assert.strictEqual(wpmToDelay(250), 240);
  });

  it('converts 100 WPM to 600ms', () => {
    assert.strictEqual(wpmToDelay(100), 600);
  });

  it('converts 600 WPM to 100ms', () => {
    assert.strictEqual(wpmToDelay(600), 100);
  });
});
