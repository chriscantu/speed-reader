// tests/regression/07-theme.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestPage, ensureOverlayOpen, queryState, dispatch } from './helpers.js';

describe('Theme Switching', () => {
  before(async () => {
    await setupTestPage();
    await ensureOverlayOpen();
  });

  it('set-theme dark applies data-theme attribute', async () => {
    dispatch('set-theme', { theme: 'dark' });
    await new Promise(r => setTimeout(r, 300));

    const state = await queryState();
    assert.strictEqual(state.theme, 'dark');
  });

  it('set-theme light applies data-theme attribute', async () => {
    dispatch('set-theme', { theme: 'light' });
    await new Promise(r => setTimeout(r, 300));

    const state = await queryState();
    assert.strictEqual(state.theme, 'light');
  });

  it('set-theme system removes data-theme attribute', async () => {
    dispatch('set-theme', { theme: 'system' });
    await new Promise(r => setTimeout(r, 300));

    const state = await queryState();
    assert.strictEqual(state.theme, 'system');
  });
});
