// tests/regression/08-font.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestPage, ensureOverlayOpen, queryState, dispatch, waitFor } from './helpers.js';

describe('Font Switching', () => {
  before(async () => {
    await setupTestPage();
    await ensureOverlayOpen();
  });

  it('set-font opendyslexic applies data-font attribute', async () => {
    dispatch('set-font', { font: 'opendyslexic' });
    await waitFor(async () => (await queryState()).font === 'opendyslexic', { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.font, 'opendyslexic');
  });

  it('set-font system removes data-font attribute', async () => {
    dispatch('set-font', { font: 'system' });
    // _syncHostAttr removes the attribute when value is 'system',
    // so getAttribute returns null and query handler falls back to 'default'.
    await waitFor(async () => (await queryState()).font === 'default', { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.font, 'default');
  });
});
