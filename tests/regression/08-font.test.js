// tests/regression/08-font.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestPage, ensureOverlayOpen, queryState, dispatch } from './helpers.js';

describe('Font Switching', () => {
  before(async () => {
    await setupTestPage();
    await ensureOverlayOpen();
  });

  it('set-font opendyslexic applies data-font attribute', async () => {
    dispatch('set-font', { font: 'opendyslexic' });
    await new Promise(r => setTimeout(r, 300));

    const state = await queryState();
    assert.strictEqual(state.font, 'opendyslexic');
  });

  it('set-font system removes data-font attribute', async () => {
    dispatch('set-font', { font: 'system' });
    await new Promise(r => setTimeout(r, 300));

    const state = await queryState();
    assert.ok(
      state.font === 'default' || state.font === 'system',
      `Expected default or system, got: ${state.font}`
    );
  });
});
