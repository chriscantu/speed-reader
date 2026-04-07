// Matches sentence-ending punctuation (.!?) optionally followed by one or more
// bracket groups [x], paren groups (x), or individual closing marks ("'»)}])
const SENTENCE_END_RE = /[.!?](\[[^\]]*\]|\([^)]*\)|["'»)}\]])*$/;

/**
 * Splits raw text into an array of word objects with metadata.
 * Each word object: { text, index, sentenceStart }
 *
 * @param {string} text - Raw text to process
 * @returns {Array<{text: string, index: number, sentenceStart: boolean}>}
 */
export function processText(text) {
  if (!text || !text.trim()) return [];

  const words = text.split(/\s+/).filter(w => w.length > 0);
  let nextIsSentenceStart = true;

  return words.map((word, index) => {
    const entry = {
      text: word,
      index,
      sentenceStart: nextIsSentenceStart,
    };

    nextIsSentenceStart = SENTENCE_END_RE.test(word);

    return entry;
  });
}

/**
 * Calculates display duration for a word based on punctuation.
 * Sentence-ending punctuation (possibly followed by closing brackets/quotes) = 1.5x,
 * comma/colon/semicolon = 1.2x.
 *
 * @param {string} word - The word text (may include trailing punctuation and closing marks)
 * @param {number} baseDelay - Base delay in ms (derived from WPM)
 * @returns {number} Adjusted delay in ms
 */
export function calculateDelay(word, baseDelay) {
  if (!word) return baseDelay;

  if (SENTENCE_END_RE.test(word)) {
    return Math.round(baseDelay * 1.5);
  }

  const lastChar = word[word.length - 1];
  if (',:;'.includes(lastChar)) {
    return Math.round(baseDelay * 1.2);
  }

  return baseDelay;
}

/**
 * Converts WPM to base delay in milliseconds.
 *
 * @param {number} wpm - Words per minute
 * @returns {number} Delay in ms per word
 */
export function wpmToDelay(wpm) {
  return Math.round(60000 / wpm);
}
