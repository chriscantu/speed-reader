// Shared settings constants — single source of truth for JS layer.
// Mirrors SettingsKeys.swift on the native side.

export const WPM_MIN = 100;
export const WPM_MAX = 600;
export const WPM_DEFAULT = 250;
export const FONT_SIZE_DEFAULT = 42;
export const FONT_SIZE_MIN = 24;
export const FONT_SIZE_MAX = 96;
export const FONT_SIZE_STEP = 2;
export const CHUNK_SIZE_DEFAULT = 1;
export const CHUNK_SIZE_MIN = 1;
export const CHUNK_SIZE_MAX = 3;
export const ALIGNMENT_DEFAULT = 'orp';
export const VALID_ALIGNMENTS = ['orp', 'center'];

export const PAPER_DEFAULT = 'cream';
export const VALID_PAPERS = ['white', 'cream', 'slate', 'black'];

export const SETTINGS_KEYS = [
  'wpm', 'font', 'paper', 'fontSize', 'punctuationPause', 'alignment', 'chunkSize',
];

export const SETTINGS_DEFAULTS = {
  wpm: WPM_DEFAULT,
  font: 'system',
  paper: PAPER_DEFAULT,
  fontSize: FONT_SIZE_DEFAULT,
  punctuationPause: true,
  alignment: ALIGNMENT_DEFAULT,
  chunkSize: CHUNK_SIZE_DEFAULT,
};

export function clampWpm(value) {
  if (typeof value !== 'number' || isNaN(value)) return WPM_DEFAULT;
  return Math.max(WPM_MIN, Math.min(WPM_MAX, value));
}

export function clampFontSize(value) {
  if (typeof value !== 'number' || isNaN(value)) return FONT_SIZE_DEFAULT;
  return Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, value));
}

export function validateAlignment(value) {
  if (typeof value === 'string' && VALID_ALIGNMENTS.includes(value)) return value;
  return ALIGNMENT_DEFAULT;
}

export function validatePaper(value) {
  if (typeof value === 'string' && VALID_PAPERS.includes(value)) return value;
  return PAPER_DEFAULT;
}

export function clampChunkSize(value) {
  if (typeof value !== 'number' || isNaN(value)) return CHUNK_SIZE_DEFAULT;
  return Math.max(CHUNK_SIZE_MIN, Math.min(CHUNK_SIZE_MAX, Math.round(value)));
}
