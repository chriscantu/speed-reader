// tests/regression/09-selection.test.js
// NOTE: Programmatic text selection via osascript is not visible to the content
// script (Safari isolates the page world from the content script world).
// This test verifies the Readability extraction fallback path instead.
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestPage, ensureOverlayClosed, queryState, toggle, waitFor, clickOverlay } from './helpers.js';

describe('Content Extraction', () => {
  before(async () => {
    await setupTestPage();
    await ensureOverlayClosed();
  });

  it('extracts article with Readability and produces reasonable word count', async () => {
    toggle();
    await waitFor(async () => (await queryState()).overlayOpen === true, { timeout: 8000 });

    const state = await queryState();
    assert.strictEqual(state.overlayOpen, true);
    assert.ok(state.wordCount > 100,
      `Expected substantial word count from article, got: ${state.wordCount}`);
    assert.ok(state.wordText.length > 0, 'Expected a word to be rendered');

    // Clean up
    clickOverlay('.sr-close');
    await waitFor(async () => (await queryState()).overlayOpen === false, { timeout: 5000 });
  });
});
