import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildChunks } from '../../SpeedReader/SpeedReaderExtension/Resources/rsvp/chunk-builder.js';
import { processText } from '../../SpeedReader/SpeedReaderExtension/Resources/rsvp/word-processor.js';

describe('buildChunks', () => {

  // Helper: delegate to processText() so sentence-boundary logic stays in sync
  function words(texts) {
    return processText(texts.join(' '));
  }

  describe('chunkSize = 1', () => {
    it('produces one chunk per word', () => {
      const w = words(['Hello', 'world.']);
      const chunks = buildChunks(w, 1);
      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(chunks[0].text, 'Hello');
      assert.strictEqual(chunks[0].startIndex, 0);
      assert.strictEqual(chunks[0].endIndex, 0);
      assert.strictEqual(chunks[1].text, 'world.');
      assert.strictEqual(chunks[1].startIndex, 1);
      assert.strictEqual(chunks[1].endIndex, 1);
    });
  });

  describe('chunkSize = 2', () => {
    it('groups words into pairs', () => {
      const w = words(['The', 'quick', 'brown', 'fox.']);
      const chunks = buildChunks(w, 2);
      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(chunks[0].text, 'The quick');
      assert.strictEqual(chunks[0].startIndex, 0);
      assert.strictEqual(chunks[0].endIndex, 1);
      assert.strictEqual(chunks[1].text, 'brown fox.');
      assert.strictEqual(chunks[1].startIndex, 2);
      assert.strictEqual(chunks[1].endIndex, 3);
    });

    it('handles odd word count with shorter final chunk', () => {
      const w = words(['One', 'two', 'three.']);
      const chunks = buildChunks(w, 2);
      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(chunks[0].text, 'One two');
      assert.strictEqual(chunks[1].text, 'three.');
      assert.strictEqual(chunks[1].words.length, 1);
    });
  });

  describe('chunkSize = 3', () => {
    it('groups words into triples', () => {
      const w = words(['The', 'quick', 'brown', 'fox', 'jumps', 'over.']);
      const chunks = buildChunks(w, 3);
      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(chunks[0].text, 'The quick brown');
      assert.strictEqual(chunks[1].text, 'fox jumps over.');
    });
  });

  describe('sentence boundaries', () => {
    it('breaks chunk at sentence boundary', () => {
      const w = words(['Hello', 'world.', 'Goodbye', 'world.']);
      const chunks = buildChunks(w, 3);
      // "Hello world." is one chunk (2 words, shorter than 3 because sentence ends)
      // "Goodbye world." is another chunk
      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(chunks[0].text, 'Hello world.');
      assert.strictEqual(chunks[0].words.length, 2);
      assert.strictEqual(chunks[1].text, 'Goodbye world.');
      assert.strictEqual(chunks[1].words.length, 2);
    });

    it('produces single-word chunk when sentence is one word', () => {
      const w = words(['Stop.', 'Go.']);
      const chunks = buildChunks(w, 3);
      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(chunks[0].text, 'Stop.');
      assert.strictEqual(chunks[1].text, 'Go.');
    });

    it('handles sentence boundary at position 2 of a 3-word chunk', () => {
      // "A B. C D E." — chunk size 3
      // Chunk 1: "A B." (sentence ends at B)
      // Chunk 2: "C D E."
      const w = words(['A', 'B.', 'C', 'D', 'E.']);
      const chunks = buildChunks(w, 3);
      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(chunks[0].text, 'A B.');
      assert.strictEqual(chunks[1].text, 'C D E.');
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty input', () => {
      assert.deepStrictEqual(buildChunks([], 2), []);
    });

    it('handles single word', () => {
      const w = words(['Hello.']);
      const chunks = buildChunks(w, 3);
      assert.strictEqual(chunks.length, 1);
      assert.strictEqual(chunks[0].text, 'Hello.');
    });

    it('chunk words array contains references to original word objects', () => {
      const w = words(['The', 'cat.']);
      const chunks = buildChunks(w, 2);
      assert.strictEqual(chunks[0].words[0], w[0]);
      assert.strictEqual(chunks[0].words[1], w[1]);
    });
  });
});
