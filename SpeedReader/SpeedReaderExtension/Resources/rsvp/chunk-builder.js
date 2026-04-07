/**
 * Groups word objects into display chunks, respecting sentence boundaries.
 *
 * @param {Array<{text: string, index: number, sentenceStart: boolean}>} words
 * @param {number} chunkSize - 1, 2, or 3
 * @returns {Array<{words: Array, startIndex: number, endIndex: number, text: string}>}
 */
export function buildChunks(words, chunkSize) {
  if (words.length === 0) return [];

  const chunks = [];
  let i = 0;

  while (i < words.length) {
    const chunkWords = [words[i]];
    let j = i + 1;

    while (chunkWords.length < chunkSize && j < words.length) {
      // Stop before a sentence start — don't cross sentence boundaries
      if (words[j].sentenceStart) break;
      chunkWords.push(words[j]);
      j++;
    }

    chunks.push({
      words: chunkWords,
      startIndex: chunkWords[0].index,
      endIndex: chunkWords[chunkWords.length - 1].index,
      text: chunkWords.map(w => w.text).join(' '),
    });

    i = j;
  }

  return chunks;
}
