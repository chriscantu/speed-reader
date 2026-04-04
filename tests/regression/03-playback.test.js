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
