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
    await waitFor(async () => (await queryState()).font === 'default', { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.font, 'default');
  });

  it('set-font newYork applies data-font attribute', async () => {
    dispatch('set-font', { font: 'newYork' });
    await waitFor(async () => (await queryState()).font === 'newYork', { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.font, 'newYork');
  });

  it('set-font georgia applies data-font attribute', async () => {
    dispatch('set-font', { font: 'georgia' });
    await waitFor(async () => (await queryState()).font === 'georgia', { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.font, 'georgia');
  });

  it('set-font menlo applies data-font attribute', async () => {
    dispatch('set-font', { font: 'menlo' });
    await waitFor(async () => (await queryState()).font === 'menlo', { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.font, 'menlo');
  });

  it('set-font-size updates overlay font size', async () => {
    dispatch('set-font-size', { fontSize: 60 });
    await waitFor(async () => (await queryState()).fontSize === 60, { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.fontSize, 60);
  });

  it('set-font back to system after testing all fonts', async () => {
    dispatch('set-font', { font: 'system' });
    await waitFor(async () => (await queryState()).font === 'default', { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.font, 'default');
  });
});
