// tests/regression/04-navigation.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestPage, ensureOverlayOpen, ensurePaused, queryState, execJS } from './helpers.js';

describe('Navigation', () => {
  before(async () => {
    await setupTestPage();
    await ensureOverlayOpen();
    await ensurePaused();
  });

  it('next sentence changes the word', async () => {
    const before = await queryState();
    const wordBefore = before.wordText;

    execJS("window.postMessage({type: 'speedreader-test-next'}, '*')");
    await new Promise(r => setTimeout(r, 300));

    const after = await queryState();
    assert.notStrictEqual(after.wordText, wordBefore,
      `Expected word to change from "${wordBefore}"`);
  });

  it('navigation while paused stays paused', async () => {
    execJS("window.postMessage({type: 'speedreader-test-next'}, '*')");
    await new Promise(r => setTimeout(r, 300));

    const state = await queryState();
    assert.strictEqual(state.isPlaying, false);
  });

  it('context updates after navigation', async () => {
    const state = await queryState();
    assert.ok(state.contextText.length > 0, 'Expected context text after nav');
  });
});
