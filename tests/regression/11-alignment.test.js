// tests/regression/11-alignment.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestPage, ensureOverlayOpen, ensurePaused, queryState, dispatch, waitFor } from './helpers.js';

/**
 * Navigate forward through words until predicate(state) returns true.
 * Returns the matching state, or null if not found within maxSteps.
 */
async function findWord(predicate, maxSteps = 300) {
  for (var i = 0; i < maxSteps; i++) {
    var state = await queryState();
    if (predicate(state)) {
      // Brief pause to let rendering settle
      await new Promise(r => setTimeout(r, 100));
      return await queryState();
    }
    dispatch('keydown', { key: 'ArrowRight' });
    await new Promise(r => setTimeout(r, 100));
  }
  return null;
}

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
    dispatch('set-font', { font: 'system' });
    dispatch('set-theme', { theme: 'system' });
  });

  // --- Alignment switching ---

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

  // --- Focus letter renders in both modes ---

  it('focus letter renders in orp mode', async () => {
    dispatch('set-alignment', { alignment: 'orp' });
    await waitFor(async () => (await queryState()).alignment === 'orp', { timeout: 3000 });

    const state = await queryState();
    assert.ok(state.hasFocus, 'Expected focus element in ORP mode');
    assert.ok(state.wordText.length > 0, 'Expected rendered word');
  });

  it('focus letter renders in center mode', async () => {
    dispatch('set-alignment', { alignment: 'center' });
    await waitFor(async () => (await queryState()).alignment === 'center', { timeout: 3000 });

    const state = await queryState();
    assert.ok(state.hasFocus, 'Expected focus element in center mode');
    assert.ok(state.wordText.length > 0, 'Expected rendered word');
  });

  // --- Edge cases: word lengths ---

  it('single-char word renders correctly in orp mode', async () => {
    dispatch('set-alignment', { alignment: 'orp' });
    dispatch('set-font-size', { fontSize: 42 });
    await waitFor(async () => (await queryState()).alignment === 'orp', { timeout: 3000 });

    // Find a single-char word (common: "a", "I")
    const state = await findWord(s => s.wordText.length === 1);
    assert.ok(state, 'Expected to find a single-char word in article');
    assert.strictEqual(state.wordText.length, 1);
    assert.ok(state.hasFocus, 'Focus element should exist for single-char word');
  });

  it('word with trailing punctuation renders correctly in orp mode', async () => {
    dispatch('set-alignment', { alignment: 'orp' });
    await waitFor(async () => (await queryState()).alignment === 'orp', { timeout: 3000 });

    // Find a word ending with punctuation
    const state = await findWord(s => /[.,;:!?]$/.test(s.wordText));
    assert.ok(state, 'Expected to find a word with trailing punctuation');
    assert.ok(state.hasFocus, 'Focus element should exist for punctuated word');
  });

  // --- Scale-to-fit at font size extremes ---

  it('long word at 96px triggers scale-to-fit in orp mode', async () => {
    dispatch('set-font-size', { fontSize: 96 });
    dispatch('set-alignment', { alignment: 'orp' });
    await waitFor(async () => (await queryState()).fontSize === 96, { timeout: 3000 });

    const state = await findWord(
      s => s.wordText.length >= 10 && s.wordTransform && s.wordTransform.includes('scale')
    );
    assert.ok(state, 'Expected scale transform on a long word at 96px in ORP mode');
  });

  it('long word at 96px triggers scale-to-fit in center mode', async () => {
    dispatch('set-alignment', { alignment: 'center' });
    await waitFor(async () => (await queryState()).alignment === 'center', { timeout: 3000 });

    const state = await findWord(
      s => s.wordText.length >= 10 && s.wordTransform && s.wordTransform.includes('scale')
    );
    assert.ok(state, 'Expected scale transform on a long word at 96px in center mode');
  });

  it('short word at 24px does not trigger scale-to-fit', async () => {
    dispatch('set-font-size', { fontSize: 24 });
    dispatch('set-alignment', { alignment: 'orp' });
    await waitFor(async () => (await queryState()).fontSize === 24, { timeout: 3000 });

    // Find a short word (≤5 chars) — should not have a scale transform at 24px
    const state = await findWord(s => s.wordText.length <= 5 && s.wordText.length > 0);
    assert.ok(state, 'Expected to find a short word');
    assert.ok(
      !state.wordTransform || !state.wordTransform.includes('scale'),
      'Short word at 24px should not trigger scale-to-fit',
    );
  });

  // --- Both alignment modes × all 5 fonts ---

  const FONTS = ['system', 'opendyslexic', 'newYork', 'georgia', 'menlo'];

  for (const font of FONTS) {
    it(`orp mode renders with font ${font}`, async () => {
      dispatch('set-font-size', { fontSize: 42 });
      dispatch('set-alignment', { alignment: 'orp' });
      dispatch('set-font', { font });
      await waitFor(async () => {
        const s = await queryState();
        // system font removes the attribute, others set it
        return font === 'system' ? s.font === 'default' : s.font === font;
      }, { timeout: 3000 });

      const state = await queryState();
      assert.ok(state.hasFocus, `Focus should render with font ${font} in ORP mode`);
      assert.ok(state.wordText.length > 0, `Word should render with font ${font}`);
      assert.strictEqual(state.alignment, 'orp');
    });

    it(`center mode renders with font ${font}`, async () => {
      dispatch('set-alignment', { alignment: 'center' });
      await waitFor(async () => (await queryState()).alignment === 'center', { timeout: 3000 });

      const state = await queryState();
      assert.ok(state.hasFocus, `Focus should render with font ${font} in center mode`);
      assert.ok(state.wordText.length > 0, `Word should render with font ${font}`);
      assert.strictEqual(state.alignment, 'center');
    });
  }

  // --- Both alignment modes × light/dark theme ---

  const THEMES = ['light', 'dark'];

  for (const theme of THEMES) {
    it(`orp mode renders with ${theme} theme`, async () => {
      dispatch('set-alignment', { alignment: 'orp' });
      dispatch('set-theme', { theme });
      await waitFor(async () => (await queryState()).theme === theme, { timeout: 3000 });

      const state = await queryState();
      assert.ok(state.hasFocus, `Focus should render in ${theme} theme ORP mode`);
      assert.strictEqual(state.alignment, 'orp');
    });

    it(`center mode renders with ${theme} theme`, async () => {
      dispatch('set-alignment', { alignment: 'center' });
      await waitFor(async () => (await queryState()).alignment === 'center', { timeout: 3000 });

      const state = await queryState();
      assert.ok(state.hasFocus, `Focus should render in ${theme} theme center mode`);
      assert.strictEqual(state.alignment, 'center');
    });
  }
});
