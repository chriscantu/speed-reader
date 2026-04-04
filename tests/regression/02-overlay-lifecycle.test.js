// tests/regression/02-overlay-lifecycle.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestPage, ensureOverlayClosed, queryState, toggle, waitFor } from './helpers.js';

describe('Overlay Lifecycle', () => {
  before(async () => {
    await setupTestPage();
  });

  it('overlay is initially closed', async () => {
    await ensureOverlayClosed();
    const state = await queryState();
    assert.strictEqual(state.overlayOpen, false);
  });

  it('toggle opens the overlay', async () => {
    toggle();
    await waitFor(async () => {
      const s = await queryState();
      return s.overlayOpen === true;
    }, { timeout: 8000 });

    const state = await queryState();
    assert.strictEqual(state.overlayOpen, true);
  });

  it('shadow DOM is attached', async () => {
    const state = await queryState();
    assert.strictEqual(state.hasShadow, true);
  });

  it('has a rendered word', async () => {
    const state = await queryState();
    assert.ok(state.wordText.length > 0, `Expected a word, got: "${state.wordText}"`);
  });

  it('has focus highlight', async () => {
    const state = await queryState();
    assert.strictEqual(state.hasFocus, true);
  });

  it('has all control buttons', async () => {
    const state = await queryState();
    assert.strictEqual(state.hasPlay, true);
    assert.strictEqual(state.hasPrev, true);
    assert.strictEqual(state.hasNext, true);
    assert.strictEqual(state.hasClose, true);
  });

  it('has WPM label', async () => {
    const state = await queryState();
    assert.ok(state.wpmLabel.includes('wpm'), `Expected wpm in label, got: "${state.wpmLabel}"`);
  });

  it('toggle closes the overlay', async () => {
    toggle();
    await waitFor(async () => {
      const s = await queryState();
      return s.overlayOpen === false;
    }, { timeout: 5000 });

    const state = await queryState();
    assert.strictEqual(state.overlayOpen, false);
  });
});
