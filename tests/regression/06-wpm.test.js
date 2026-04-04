// tests/regression/06-wpm.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestPage, ensureOverlayOpen, queryState, dispatch, waitFor } from './helpers.js';

describe('WPM Controls', () => {
  before(async () => {
    await setupTestPage();
    await ensureOverlayOpen();
  });

  it('set-wpm dispatches to 400 and updates state', async () => {
    dispatch('set-wpm', { wpm: 400 });
    await waitFor(async () => (await queryState()).wpm === 400, { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.wpm, 400);
    assert.strictEqual(state.wpmLabel, '400 wpm');
  });

  it('ArrowUp from 600 stays clamped at 600', async () => {
    dispatch('set-wpm', { wpm: 600 });
    await waitFor(async () => (await queryState()).wpm === 600, { timeout: 3000 });

    dispatch('keydown', { key: 'ArrowUp' });
    await waitFor(async () => (await queryState()).wpm === 600, { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.wpm, 600);
    assert.strictEqual(state.wpmLabel, '600 wpm');
  });

  it('ArrowDown from 100 stays clamped at 100', async () => {
    dispatch('set-wpm', { wpm: 100 });
    await waitFor(async () => (await queryState()).wpm === 100, { timeout: 3000 });

    dispatch('keydown', { key: 'ArrowDown' });
    await waitFor(async () => (await queryState()).wpm === 100, { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.wpm, 100);
    assert.strictEqual(state.wpmLabel, '100 wpm');
  });

  it('restores WPM to default after test', async () => {
    dispatch('set-wpm', { wpm: 250 });
    await waitFor(async () => (await queryState()).wpm === 250, { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.wpm, 250);
  });
});
