import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampFontSize, FONT_SIZE_DEFAULT, FONT_SIZE_MIN, FONT_SIZE_MAX,
  SETTINGS_KEYS, SETTINGS_DEFAULTS,
} from '../../SpeedReader/SpeedReaderExtension/Resources/rsvp/settings-defaults.js';

describe('clampFontSize', () => {
  it('returns value within range unchanged', () => {
    assert.strictEqual(clampFontSize(42), 42);
    assert.strictEqual(clampFontSize(50), 50);
  });

  it('clamps below minimum to minimum', () => {
    assert.strictEqual(clampFontSize(10), FONT_SIZE_MIN);
    assert.strictEqual(clampFontSize(0), FONT_SIZE_MIN);
    assert.strictEqual(clampFontSize(-5), FONT_SIZE_MIN);
  });

  it('clamps above maximum to maximum', () => {
    assert.strictEqual(clampFontSize(100), FONT_SIZE_MAX);
    assert.strictEqual(clampFontSize(200), FONT_SIZE_MAX);
  });

  it('accepts boundary values', () => {
    assert.strictEqual(clampFontSize(FONT_SIZE_MIN), FONT_SIZE_MIN);
    assert.strictEqual(clampFontSize(FONT_SIZE_MAX), FONT_SIZE_MAX);
  });

  it('returns default for NaN', () => {
    assert.strictEqual(clampFontSize(NaN), FONT_SIZE_DEFAULT);
  });

  it('returns default for non-number input', () => {
    assert.strictEqual(clampFontSize('big'), FONT_SIZE_DEFAULT);
    assert.strictEqual(clampFontSize(undefined), FONT_SIZE_DEFAULT);
    assert.strictEqual(clampFontSize(null), FONT_SIZE_DEFAULT);
  });
});

describe('SETTINGS_KEYS', () => {
  it('includes alignment', () => {
    assert.ok(SETTINGS_KEYS.includes('alignment'));
  });
});

describe('SETTINGS_DEFAULTS', () => {
  it('defaults alignment to orp', () => {
    assert.strictEqual(SETTINGS_DEFAULTS.alignment, 'orp');
  });
});
