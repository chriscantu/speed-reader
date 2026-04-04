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
    dispatch('keydown', { key: ' ' });
    await waitFor(async () => (await queryState()).isPlaying === true, { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.isPlaying, true);
  });

  it('Space toggles pause', async () => {
    dispatch('keydown', { key: ' ' });
    await waitFor(async () => (await queryState()).isPlaying === false, { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.isPlaying, false);
  });

  it('ArrowRight advances sentence', async () => {
    const before = await queryState();
    const idxBefore = before.currentIndex;

    dispatch('keydown', { key: 'ArrowRight' });
    await waitFor(async () => (await queryState()).currentIndex !== idxBefore, { timeout: 3000 });

    const after = await queryState();
    assert.ok(after.currentIndex !== idxBefore,
      `Expected index to change from ${idxBefore}`);
  });

  it('ArrowLeft goes back', async () => {
    const before = await queryState();
    const idxBefore = before.currentIndex;

    dispatch('keydown', { key: 'ArrowLeft' });
    await waitFor(async () => (await queryState()).currentIndex < idxBefore, { timeout: 3000 });

    const after = await queryState();
    assert.ok(after.currentIndex < idxBefore,
      `Expected index < ${idxBefore}, got ${after.currentIndex}`);
  });

  it('ArrowUp increases WPM by 25', async () => {
    const before = await queryState();
    const wpmBefore = before.wpm;
    const expectedWpm = Math.min(600, wpmBefore + 25);

    dispatch('keydown', { key: 'ArrowUp' });
    await waitFor(async () => (await queryState()).wpm === expectedWpm, { timeout: 3000 });

    const after = await queryState();
    assert.strictEqual(after.wpm, expectedWpm);
  });

  it('ArrowDown decreases WPM by 25', async () => {
    const before = await queryState();
    const wpmBefore = before.wpm;
    const expectedWpm = Math.max(100, wpmBefore - 25);

    dispatch('keydown', { key: 'ArrowDown' });
    await waitFor(async () => (await queryState()).wpm === expectedWpm, { timeout: 3000 });

    const after = await queryState();
    assert.strictEqual(after.wpm, expectedWpm);
  });

  it('Escape closes the overlay', async () => {
    dispatch('keydown', { key: 'Escape' });
    await waitFor(async () => (await queryState()).overlayOpen === false, { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.overlayOpen, false);
  });
});
