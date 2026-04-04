// Shared settings constants — single source of truth for JS layer.
// Mirrors SettingsKeys.swift on the native side.

export const WPM_MIN = 100;
export const WPM_MAX = 600;
export const WPM_DEFAULT = 250;
export const FONT_SIZE_DEFAULT = 42;
export const FONT_SIZE_MIN = 24;
export const FONT_SIZE_MAX = 96;
export const FONT_SIZE_STEP = 2;

export const SETTINGS_KEYS = ['wpm', 'font', 'theme', 'fontSize', 'punctuationPause'];

export const SETTINGS_DEFAULTS = {
  wpm: WPM_DEFAULT,
  font: 'system',
  theme: 'system',
  fontSize: FONT_SIZE_DEFAULT,
  punctuationPause: true,
};

export function clampWpm(value) {
  if (typeof value !== 'number' || isNaN(value)) return WPM_DEFAULT;
  return Math.max(WPM_MIN, Math.min(WPM_MAX, value));
}

export function clampFontSize(value) {
  if (typeof value !== 'number' || isNaN(value)) return FONT_SIZE_DEFAULT;
  return Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, value));
}
