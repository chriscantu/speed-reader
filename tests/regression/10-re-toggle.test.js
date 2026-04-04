// tests/regression/10-re-toggle.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestPage, ensureOverlayClosed, queryState, toggle, clickOverlay, waitFor, execJS } from './helpers.js';

describe('Re-toggle Cycle', () => {
  before(async () => {
    await setupTestPage();
    await ensureOverlayClosed();
    execJS("window.getSelection().removeAllRanges()");
  });

  it('open, play, close, re-open works cleanly', async () => {
    // Open
    toggle();
    await waitFor(async () => (await queryState()).overlayOpen === true, { timeout: 8000 });

    // Play briefly
    clickOverlay('.sr-btn-play');
    await waitFor(async () => (await queryState()).isPlaying === true, { timeout: 3000 });
    await new Promise(r => setTimeout(r, 500));

    // Close
    clickOverlay('.sr-close');
    await waitFor(async () => (await queryState()).overlayOpen === false, { timeout: 5000 });

    // Re-open
    toggle();
    await waitFor(async () => (await queryState()).overlayOpen === true, { timeout: 8000 });

    const state = await queryState();
    assert.strictEqual(state.overlayOpen, true);
    assert.strictEqual(state.currentIndex, 0, 'Expected currentIndex to reset to 0 on re-open');
    assert.ok(state.wordText.length > 0, 'Expected a word after re-open');
    assert.ok(state.wordCount > 0, 'Expected positive word count after re-open');
  });

  it('toggle closes overlay cleanly', async () => {
    toggle();
    await waitFor(async () => (await queryState()).overlayOpen === false, { timeout: 5000 });

    const state = await queryState();
    assert.strictEqual(state.overlayOpen, false);
  });
});
