import { processText, calculateDelay, wpmToDelay } from './word-processor.js';
import { splitWordAtFocus } from './focus-point.js';
import { WPM_DEFAULT, clampWpm } from './settings-defaults.js';

export class RSVPStateMachine {
  constructor() {
    this.words = [];
    this.currentIndex = 0;
    this.isPlaying = false;
    this.wpm = WPM_DEFAULT;
    this.punctuationPause = true;
  }

  init(text, settings = {}) {
    this.words = processText(text);
    this.currentIndex = 0;
    this.isPlaying = false;
    this.wpm = clampWpm(settings.wpm ?? WPM_DEFAULT);
    this.punctuationPause = settings.punctuationPause ?? true;
  }

  play() {
    if (this.currentIndex >= this.words.length) {
      this.currentIndex = 0;
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
    if (!this.isPlaying || this.currentIndex >= this.words.length) {
      if (this.currentIndex >= this.words.length) {
        this.pause();
      }
      return { done: true };
    }

    const word = this.words[this.currentIndex];
    const baseDelay = wpmToDelay(this.wpm);
    const delay = this.punctuationPause
      ? calculateDelay(word.text, baseDelay)
      : baseDelay;

    this.currentIndex++;

    if (this.currentIndex >= this.words.length) {
      this.pause();
      return { done: true, delay };
    }

    return { delay };
  }

  prevSentence() {
    this.pause();
    let i = this.currentIndex - 1;
    while (i > 0) {
      if (this.words[i].sentenceStart) {
        break;
      }
      i--;
    }
    this.currentIndex = Math.max(0, i);
  }

  nextSentence() {
    this.pause();
    let i = this.currentIndex + 1;
    while (i < this.words.length) {
      if (this.words[i].sentenceStart) {
        break;
      }
      i++;
    }
    if (i < this.words.length) {
      this.currentIndex = i;
    }
  }

  adjustWpm(delta) {
    this.wpm = clampWpm(this.wpm + delta);
    return this.wpm;
  }

  currentWord() {
    if (this.currentIndex >= this.words.length) {
      return { before: '', focus: '', after: '' };
    }
    return splitWordAtFocus(this.words[this.currentIndex].text);
  }

  progress() {
    const total = this.words.length;
    const current = this.currentIndex;
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    return { percent, current, total };
  }

  contextSentence() {
    if (this.currentIndex >= this.words.length) {
      return { words: [], highlightIndex: -1 };
    }

    let sentenceStart = this.currentIndex;
    while (sentenceStart > 0 && !this.words[sentenceStart].sentenceStart) {
      sentenceStart--;
    }

    let sentenceEnd = this.currentIndex + 1;
    while (sentenceEnd < this.words.length && !this.words[sentenceEnd].sentenceStart) {
      sentenceEnd++;
    }

    const words = [];
    for (let i = sentenceStart; i < sentenceEnd; i++) {
      words.push(this.words[i].text);
    }

    return {
      words,
      highlightIndex: this.currentIndex - sentenceStart,
    };
  }
}
