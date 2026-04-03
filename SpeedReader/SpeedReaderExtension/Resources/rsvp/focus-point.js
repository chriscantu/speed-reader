/**
 * Calculates the optimal recognition point (ORP) index for a word.
 * For short words (1-3 chars), returns 0 (first character).
 * For longer words, returns the index at ~30% of the word length,
 * ignoring trailing punctuation.
 *
 * @param {string} word - The word (may include trailing punctuation)
 * @returns {number} Index of the focus character
 */
export function calculateFocusPoint(word) {
  const stripped = word.replace(/[.,!?;:]+$/, '');
  if (stripped.length <= 3) return 0;
  return Math.floor(stripped.length * 0.3);
}

/**
 * Splits a word into three parts around the focus point:
 * before (dimmer), focus (highlighted), after (dimmer).
 *
 * @param {string} word - The word to split
 * @returns {{ before: string, focus: string, after: string }}
 */
export function splitWordAtFocus(word) {
  const focusIndex = calculateFocusPoint(word);
  return {
    before: word.slice(0, focusIndex),
    focus: word[focusIndex],
    after: word.slice(focusIndex + 1),
  };
}
