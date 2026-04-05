// tests/regression/11-alignment.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestPage, ensureOverlayOpen, ensurePaused, queryState, dispatch, waitFor } from './helpers.js';

describe('ORP Alignment', () => {
  before(async () => {
    await setupTestPage();
    await ensureOverlayOpen();
    await ensurePaused();
  });

  after(async () => {
    // Reset to defaults
    dispatch('set-alignment', { alignment: 'orp' });
    dispatch('set-font-size', { fontSize: 42 });
  });

  it('defaults to orp alignment', async () => {
    const state = await queryState();
    assert.strictEqual(state.alignment, 'orp');
  });

  it('set-alignment center applies data-alignment attribute', async () => {
    dispatch('set-alignment', { alignment: 'center' });
    await waitFor(async () => (await queryState()).alignment === 'center', { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.alignment, 'center');
  });

  it('set-alignment orp applies data-alignment attribute', async () => {
    dispatch('set-alignment', { alignment: 'orp' });
    await waitFor(async () => (await queryState()).alignment === 'orp', { timeout: 3000 });

    const state = await queryState();
    assert.strictEqual(state.alignment, 'orp');
  });

  it('long word at max font size triggers scale-to-fit in orp mode', async () => {
    // Set max font size to force a long word to overflow
    dispatch('set-font-size', { fontSize: 96 });
    await waitFor(async () => (await queryState()).fontSize === 96, { timeout: 3000 });

    dispatch('set-alignment', { alignment: 'orp' });
    await waitFor(async () => (await queryState()).alignment === 'orp', { timeout: 3000 });

    // Navigate forward until we find a word long enough to overflow at 96px.
    // The test page (Speed Reading Wikipedia) has words like "comprehension",
    // "subvocalization", "schoolteacher" which are 13+ characters.
    var found = false;
    for (var i = 0; i < 200; i++) {
      var state = await queryState();
      if (state.wordText.length >= 10) {
        // Re-query after a brief pause to let scale-to-fit run
        await new Promise(r => setTimeout(r, 100));
        state = await queryState();
        if (state.wordTransform && state.wordTransform.includes('scale')) {
          found = true;
          break;
        }
      }
      // Advance one word by playing briefly then pausing
      dispatch('keydown', { key: 'ArrowRight' });
      await new Promise(r => setTimeout(r, 150));
    }

    assert.ok(found, 'Expected scale transform on a long word at 96px in ORP mode');
  });

  it('long word at max font size triggers scale-to-fit in center mode', async () => {
    dispatch('set-alignment', { alignment: 'center' });
    await waitFor(async () => (await queryState()).alignment === 'center', { timeout: 3000 });

    // Navigate forward until we find a long word
    var found = false;
    for (var i = 0; i < 200; i++) {
      var state = await queryState();
      if (state.wordText.length >= 10) {
        await new Promise(r => setTimeout(r, 100));
        state = await queryState();
        if (state.wordTransform && state.wordTransform.includes('scale')) {
          found = true;
          break;
        }
      }
      dispatch('keydown', { key: 'ArrowRight' });
      await new Promise(r => setTimeout(r, 150));
    }

    assert.ok(found, 'Expected scale transform on a long word at 96px in center mode');
  });
});
