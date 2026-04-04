// tests/regression/09-selection.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestPage, ensureOverlayClosed, queryState, toggle, waitFor, execJS, clickOverlay } from './helpers.js';

describe('Text Selection Mode', () => {
  before(async () => {
    await setupTestPage();
    await ensureOverlayClosed();
  });

  it('opens with selected text and has fewer words than full article', async () => {
    // Get full article word count
    toggle();
    await waitFor(async () => (await queryState()).overlayOpen === true, { timeout: 8000 });
    const fullState = await queryState();
    const fullWordCount = fullState.wordCount;

    // Close overlay
    clickOverlay('.sr-close');
    await waitFor(async () => (await queryState()).overlayOpen === false, { timeout: 5000 });

    // Select a paragraph
    execJS(
      "window.getSelection().removeAllRanges();" +
      "var r = document.createRange();" +
      "var el = document.querySelector('#mw-content-text p');" +
      "if(el){r.selectNodeContents(el); window.getSelection().addRange(r);}"
    );
    await new Promise(r => setTimeout(r, 300));

    // Toggle with selection
    toggle();
    await waitFor(async () => (await queryState()).overlayOpen === true, { timeout: 8000 });

    const selState = await queryState();
    assert.strictEqual(selState.overlayOpen, true);
    assert.ok(selState.wordCount > 0, 'Expected some words from selection');
    assert.ok(selState.wordCount < fullWordCount,
      `Expected selection (${selState.wordCount}) < full article (${fullWordCount})`);

    // Clean up
    clickOverlay('.sr-close');
    await waitFor(async () => (await queryState()).overlayOpen === false, { timeout: 5000 });
  });
});
