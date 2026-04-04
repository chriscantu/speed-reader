// tests/regression/05-keyboard.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestPage, ensureOverlayOpen, ensurePaused, queryState, dispatch, waitFor } from './helpers.js';

describe('Keyboard Shortcuts', () => {
  before(async () => {
    await setupTestPage();
    await ensureOverlayOpen();
    await ensurePaused();
  });

  it('Space toggles play', async () => {
    dispatch('keypress', { key: ' ' });
    await waitFor(async () => (await queryState()).isPlaying === true, { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.isPlaying, true);
  });

  it('Space toggles pause', async () => {
    dispatch('keypress', { key: ' ' });
    await waitFor(async () => (await queryState()).isPlaying === false, { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.isPlaying, false);
  });

  it('ArrowRight advances sentence', async () => {
    const before = await queryState();
    const idxBefore = before.currentIndex;

    dispatch('keypress', { key: 'ArrowRight' });
    await new Promise(r => setTimeout(r, 300));

    const after = await queryState();
    assert.ok(after.currentIndex !== idxBefore,
      `Expected index to change from ${idxBefore}`);
  });

  it('ArrowLeft goes back', async () => {
    const before = await queryState();
    const idxBefore = before.currentIndex;

    dispatch('keypress', { key: 'ArrowLeft' });
    await new Promise(r => setTimeout(r, 300));

    const after = await queryState();
    assert.ok(after.currentIndex < idxBefore,
      `Expected index < ${idxBefore}, got ${after.currentIndex}`);
  });

  it('ArrowUp increases WPM by 25', async () => {
    const before = await queryState();
    const wpmBefore = before.wpm;

    dispatch('keypress', { key: 'ArrowUp' });
    await new Promise(r => setTimeout(r, 300));

    const after = await queryState();
    const expectedWpm = Math.min(600, wpmBefore + 25);
    assert.strictEqual(after.wpm, expectedWpm);
  });

  it('ArrowDown decreases WPM by 25', async () => {
    const before = await queryState();
    const wpmBefore = before.wpm;

    dispatch('keypress', { key: 'ArrowDown' });
    await new Promise(r => setTimeout(r, 300));

    const after = await queryState();
    const expectedWpm = Math.max(100, wpmBefore - 25);
    assert.strictEqual(after.wpm, expectedWpm);
  });

  it('Escape closes the overlay', async () => {
    dispatch('keypress', { key: 'Escape' });
    await waitFor(async () => (await queryState()).overlayOpen === false, { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.overlayOpen, false);
  });
});
