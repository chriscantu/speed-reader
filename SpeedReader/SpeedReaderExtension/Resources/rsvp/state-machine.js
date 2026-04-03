import { processText, calculateDelay, wpmToDelay } from './word-processor.js';

export class RSVPStateMachine {
  constructor() {
    this.words = [];
    this.currentIndex = 0;
    this.isPlaying = false;
    this.wpm = 250;
    this.punctuationPause = true;
  }

  init(text, settings = {}) {
    this.words = processText(text);
    this.currentIndex = 0;
    this.isPlaying = false;
    this.wpm = Math.max(100, Math.min(600, settings.wpm ?? 250));
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
}
