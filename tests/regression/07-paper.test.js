// tests/regression/07-paper.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestPage, ensureOverlayOpen, queryState, dispatch, waitFor } from './helpers.js';

describe('Paper Switching', () => {
  before(async () => {
    await setupTestPage();
    await ensureOverlayOpen();
  });

  it('set-paper white applies data-paper attribute', async () => {
    dispatch('set-paper', { paper: 'white' });
    await waitFor(async () => (await queryState()).paper === 'white', { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.paper, 'white');
  });

  it('set-paper cream applies data-paper attribute', async () => {
    dispatch('set-paper', { paper: 'cream' });
    await waitFor(async () => (await queryState()).paper === 'cream', { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.paper, 'cream');
  });

  it('set-paper slate applies data-paper attribute', async () => {
    dispatch('set-paper', { paper: 'slate' });
    await waitFor(async () => (await queryState()).paper === 'slate', { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.paper, 'slate');
  });

  it('set-paper black applies data-paper attribute', async () => {
    dispatch('set-paper', { paper: 'black' });
    await waitFor(async () => (await queryState()).paper === 'black', { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.paper, 'black');
  });
});
