// tests/regression/07-theme.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestPage, ensureOverlayOpen, queryState, dispatch, waitFor } from './helpers.js';

describe('Theme Switching', () => {
  before(async () => {
    await setupTestPage();
    await ensureOverlayOpen();
  });

  it('set-theme dark applies data-theme attribute', async () => {
    dispatch('set-theme', { theme: 'dark' });
    await waitFor(async () => (await queryState()).theme === 'dark', { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.theme, 'dark');
  });

  it('set-theme light applies data-theme attribute', async () => {
    dispatch('set-theme', { theme: 'light' });
    await waitFor(async () => (await queryState()).theme === 'light', { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.theme, 'light');
  });

  it('set-theme system removes data-theme attribute', async () => {
    dispatch('set-theme', { theme: 'system' });
    await waitFor(async () => (await queryState()).theme === 'system', { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.theme, 'system');
  });
});
