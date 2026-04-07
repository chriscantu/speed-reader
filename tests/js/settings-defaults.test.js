import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampFontSize, FONT_SIZE_DEFAULT, FONT_SIZE_MIN, FONT_SIZE_MAX,
  clampChunkSize, CHUNK_SIZE_DEFAULT, CHUNK_SIZE_MIN, CHUNK_SIZE_MAX,
  SETTINGS_KEYS, SETTINGS_DEFAULTS,
  ALIGNMENT_DEFAULT, VALID_ALIGNMENTS, validateAlignment,
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

  it('has a default for every key in SETTINGS_KEYS', () => {
    for (const key of SETTINGS_KEYS) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(SETTINGS_DEFAULTS, key),
        'SETTINGS_DEFAULTS is missing key: ' + key,
      );
    }
  });
});

describe('validateAlignment', () => {
  it('returns valid alignment values unchanged', () => {
    assert.strictEqual(validateAlignment('orp'), 'orp');
    assert.strictEqual(validateAlignment('center'), 'center');
  });

  it('returns default for invalid string', () => {
    assert.strictEqual(validateAlignment('scrambled'), ALIGNMENT_DEFAULT);
  });

  it('returns default for non-string input', () => {
    assert.strictEqual(validateAlignment(42), ALIGNMENT_DEFAULT);
    assert.strictEqual(validateAlignment(undefined), ALIGNMENT_DEFAULT);
    assert.strictEqual(validateAlignment(null), ALIGNMENT_DEFAULT);
    assert.strictEqual(validateAlignment(true), ALIGNMENT_DEFAULT);
  });

  it('returns default for empty string', () => {
    assert.strictEqual(validateAlignment(''), ALIGNMENT_DEFAULT);
  });

  it('VALID_ALIGNMENTS contains orp and center', () => {
    assert.ok(VALID_ALIGNMENTS.includes('orp'));
    assert.ok(VALID_ALIGNMENTS.includes('center'));
    assert.strictEqual(VALID_ALIGNMENTS.length, 2);
  });
});

describe('clampChunkSize', () => {
  it('returns default for non-number input', () => {
    assert.strictEqual(clampChunkSize('two'), CHUNK_SIZE_DEFAULT);
    assert.strictEqual(clampChunkSize(NaN), CHUNK_SIZE_DEFAULT);
    assert.strictEqual(clampChunkSize(undefined), CHUNK_SIZE_DEFAULT);
  });

  it('clamps below minimum to minimum', () => {
    assert.strictEqual(clampChunkSize(0), CHUNK_SIZE_MIN);
    assert.strictEqual(clampChunkSize(-1), CHUNK_SIZE_MIN);
  });

  it('clamps above maximum to maximum', () => {
    assert.strictEqual(clampChunkSize(4), CHUNK_SIZE_MAX);
    assert.strictEqual(clampChunkSize(99), CHUNK_SIZE_MAX);
  });

  it('accepts boundary values', () => {
    assert.strictEqual(clampChunkSize(CHUNK_SIZE_MIN), CHUNK_SIZE_MIN);
    assert.strictEqual(clampChunkSize(CHUNK_SIZE_MAX), CHUNK_SIZE_MAX);
  });

  it('rounds floats to nearest integer', () => {
    assert.strictEqual(clampChunkSize(1.5), 2);
    assert.strictEqual(clampChunkSize(2.7), 3);
    assert.strictEqual(clampChunkSize(0.6), 1);
  });
});
