import { processText, wpmToDelay } from './word-processor.js';
import { splitWordAtFocus } from './focus-point.js';
import { WPM_DEFAULT, CHUNK_SIZE_DEFAULT, clampWpm, clampChunkSize } from './settings-defaults.js';
import { buildChunks } from './chunk-builder.js';

export class RSVPStateMachine {
  constructor() {
    this.words = [];
    this.chunks = [];
    this.chunkIndex = 0;
    this.chunkSize = CHUNK_SIZE_DEFAULT;
    this.isPlaying = false;
    this.wpm = WPM_DEFAULT;
    this.punctuationPause = true;
  }

  init(text, settings = {}) {
    this.words = processText(text);
    this.chunkSize = clampChunkSize(settings.chunkSize ?? CHUNK_SIZE_DEFAULT);
    this.chunks = buildChunks(this.words, this.chunkSize);
    this.chunkIndex = 0;
    this.isPlaying = false;
    this.wpm = clampWpm(settings.wpm ?? WPM_DEFAULT);
    this.punctuationPause = settings.punctuationPause ?? true;
  }

  play() {
    if (this.chunkIndex >= this.chunks.length) {
      this.chunkIndex = 0;
    }
    this.isPlaying = true;
  }

  pause() {
    this.isPlaying = false;
  }

  togglePlayPause() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  tick() {
    if (!this.isPlaying || this.chunkIndex >= this.chunks.length) {
      if (this.chunkIndex >= this.chunks.length) {
        this.pause();
      }
      return { done: true };
    }

    const chunk = this.chunks[this.chunkIndex];
    const baseDelay = wpmToDelay(this.wpm);
    let delay = baseDelay * chunk.words.length;

    if (this.punctuationPause) {
      const lastWord = chunk.words[chunk.words.length - 1].text;
      const lastChar = lastWord[lastWord.length - 1];
      if ('.!?'.includes(lastChar)) {
        delay = Math.round(delay * 1.5);
      } else if (',:;'.includes(lastChar)) {
        delay = Math.round(delay * 1.2);
      }
    }

    this.chunkIndex++;

    if (this.chunkIndex >= this.chunks.length) {
      this.pause();
      return { done: true, delay };
    }

    return { delay };
  }

  prevSentence() {
    this.pause();
    let i = this.chunkIndex - 1;
    while (i > 0) {
      if (this.chunks[i].words[0].sentenceStart) break;
      i--;
    }
    this.chunkIndex = Math.max(0, i);
  }

  nextSentence() {
    this.pause();
    let i = this.chunkIndex + 1;
    while (i < this.chunks.length) {
      if (this.chunks[i].words[0].sentenceStart) break;
      i++;
    }
    if (i < this.chunks.length) {
      this.chunkIndex = i;
    }
  }

  // Always pauses before seeking. Callers that want to resume must call play() explicitly.
  seekTo(index) {
    this.pause();
    if (!Number.isInteger(index)) return;
    if (this.words.length === 0) {
      this.chunkIndex = 0;
      return;
    }
    const wordIndex = Math.max(0, Math.min(index, this.words.length - 1));
    for (let i = 0; i < this.chunks.length; i++) {
      if (wordIndex >= this.chunks[i].startIndex && wordIndex <= this.chunks[i].endIndex) {
        this.chunkIndex = i;
        return;
      }
    }
    this.chunkIndex = this.chunks.length - 1;
  }

  _currentWordIndex() {
    if (this.chunkIndex >= this.chunks.length) return this.words.length;
    return this.chunks[this.chunkIndex].startIndex;
  }

  get currentIndex() {
    return this._currentWordIndex();
  }

  // Returns whole seconds (ceil) of estimated elapsed reading time, always >= 0.
  timeElapsed() {
    if (this.words.length === 0) return 0;
    return Math.ceil((this._currentWordIndex() / this.wpm) * 60);
  }

  // Returns whole seconds (ceil) of estimated remaining reading time, always >= 0.
  timeRemaining() {
    if (this.words.length === 0) return 0;
    const wordsLeft = this.words.length - this._currentWordIndex();
    if (wordsLeft <= 0) return 0;
    return Math.ceil((wordsLeft / this.wpm) * 60);
  }

  adjustWpm(delta) {
    this.wpm = clampWpm(this.wpm + delta);
    return this.wpm;
  }

  currentDisplay() {
    if (this.chunkIndex >= this.chunks.length) {
      return { before: '', focus: '', after: '', isChunk: false };
    }

    const chunk = this.chunks[this.chunkIndex];
    if (this.chunkSize > 1) {
      return { text: chunk.text, isChunk: true };
    }

    const parts = splitWordAtFocus(chunk.words[0].text);
    return { before: parts.before, focus: parts.focus, after: parts.after, isChunk: false };
  }

  // Backward-compat alias — overlay still calls this until Task 5
  currentWord() {
    const d = this.currentDisplay();
    if (d.isChunk) return { before: '', focus: '', after: '' };
    return { before: d.before, focus: d.focus, after: d.after };
  }

  progress() {
    const total = this.words.length;
    const current = this._currentWordIndex();
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    return { percent, current, total };
  }

  contextSentence() {
    if (this.chunkIndex >= this.chunks.length) {
      return { words: [], highlightIndex: -1 };
    }

    const chunk = this.chunks[this.chunkIndex];
    const wordIndex = chunk.startIndex;

    let sentenceStart = wordIndex;
    while (sentenceStart > 0 && !this.words[sentenceStart].sentenceStart) {
      sentenceStart--;
    }

    let sentenceEnd = wordIndex + 1;
    while (sentenceEnd < this.words.length && !this.words[sentenceEnd].sentenceStart) {
      sentenceEnd++;
    }

    const words = [];
    for (let i = sentenceStart; i < sentenceEnd; i++) {
      words.push(this.words[i].text);
    }

    const relativeStart = chunk.startIndex - sentenceStart;
    const relativeEnd = chunk.endIndex - sentenceStart;

    if (this.chunkSize === 1) {
      return { words, highlightIndex: relativeStart };
    }

    return { words, highlightRange: { start: relativeStart, end: relativeEnd } };
  }

  rebuildChunks(newChunkSize) {
    const wordIndex = this._currentWordIndex();
    this.chunkSize = clampChunkSize(newChunkSize);
    this.chunks = buildChunks(this.words, this.chunkSize);
    this.seekTo(wordIndex);
  }
}
