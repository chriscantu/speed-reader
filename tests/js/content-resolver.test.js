import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveContent } from '../../SpeedReader/SpeedReaderExtension/Resources/content-resolver.js';

// Helper — builds a default "nothing available" input set.
function baseInputs(overrides = {}) {
  return {
    selectedText: null,
    selectionError: false,
    pendingSelectionMode: false,
    article: null,
    articleError: false,
    ...overrides,
  };
}

describe('resolveContent — selection priority', () => {
  it('uses selection when text is available', () => {
    const result = resolveContent(baseInputs({ selectedText: 'Hello world' }));
    assert.strictEqual(result.action, 'use-selection');
    assert.strictEqual(result.text, 'Hello world');
  });

  it('selection takes priority over Readability article', () => {
    const result = resolveContent(baseInputs({
      selectedText: 'Selected text',
      article: { textContent: 'Article text', title: 'Title' },
    }));
    assert.strictEqual(result.action, 'use-selection');
    assert.strictEqual(result.text, 'Selected text');
  });

  it('selection takes priority even in pendingSelectionMode', () => {
    const result = resolveContent(baseInputs({
      selectedText: 'Got it',
      pendingSelectionMode: true,
    }));
    assert.strictEqual(result.action, 'use-selection');
  });
});

describe('resolveContent — selection error fallthrough', () => {
  it('falls through to Readability when selection API errors', () => {
    const result = resolveContent(baseInputs({
      selectionError: true,
      article: { textContent: 'Fallback article', title: 'Title' },
    }));
    assert.strictEqual(result.action, 'use-article');
    assert.strictEqual(result.selectionWarning, true);
  });

  it('enters selection mode when selection errors and Readability also fails', () => {
    const result = resolveContent(baseInputs({
      selectionError: true,
      articleError: true,
    }));
    assert.strictEqual(result.action, 'enter-selection-mode');
    assert.strictEqual(result.selectionWarning, true);
  });
});

describe('resolveContent — Readability fallback', () => {
  it('uses article when no selection and Readability succeeds', () => {
    const result = resolveContent(baseInputs({
      article: { textContent: '  Some article text  ', title: 'My Article' },
    }));
    assert.strictEqual(result.action, 'use-article');
    assert.strictEqual(result.text, 'Some article text');
    assert.strictEqual(result.title, 'My Article');
  });

  it('uses document title fallback when article has no title', () => {
    const result = resolveContent(baseInputs({
      article: { textContent: 'Content', title: '' },
    }));
    assert.strictEqual(result.action, 'use-article');
    assert.strictEqual(result.title, '');
  });

  it('rejects article with empty textContent', () => {
    const result = resolveContent(baseInputs({
      article: { textContent: '', title: 'Title' },
    }));
    assert.strictEqual(result.action, 'enter-selection-mode');
  });

  it('rejects article with whitespace-only textContent', () => {
    const result = resolveContent(baseInputs({
      article: { textContent: '   \n\t  ', title: 'Title' },
    }));
    assert.strictEqual(result.action, 'enter-selection-mode');
  });

  it('rejects null article', () => {
    const result = resolveContent(baseInputs({ article: null }));
    assert.strictEqual(result.action, 'enter-selection-mode');
  });

  it('rejects article when articleError is true', () => {
    const result = resolveContent(baseInputs({
      article: { textContent: 'Content', title: 'Title' },
      articleError: true,
    }));
    assert.strictEqual(result.action, 'enter-selection-mode');
  });
});

describe('resolveContent — pending selection mode', () => {
  it('prompts user when in pending selection mode with no selection', () => {
    const result = resolveContent(baseInputs({ pendingSelectionMode: true }));
    assert.strictEqual(result.action, 'prompt-selection');
  });

  it('prompts even if Readability article is available', () => {
    const result = resolveContent(baseInputs({
      pendingSelectionMode: true,
      article: { textContent: 'Content', title: 'Title' },
    }));
    assert.strictEqual(result.action, 'prompt-selection');
  });
});

describe('resolveContent — enter selection mode (last resort)', () => {
  it('enters selection mode when nothing is available', () => {
    const result = resolveContent(baseInputs());
    assert.strictEqual(result.action, 'enter-selection-mode');
  });

  it('does not set selectionWarning when selection did not error', () => {
    const result = resolveContent(baseInputs());
    assert.strictEqual(result.selectionWarning, false);
  });
});
