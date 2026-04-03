import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RSVPStateMachine } from '../../SpeedReader/SpeedReaderExtension/Resources/rsvp/state-machine.js';

describe('RSVPStateMachine', () => {

  describe('init', () => {
    it('processes text into words and resets state', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world. Goodbye world.');
      assert.strictEqual(sm.isPlaying, false);
      assert.strictEqual(sm.currentIndex, 0);
      assert.strictEqual(sm.words.length, 4);
    });

    it('clamps wpm below 100 to 100', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { wpm: 50 });
      assert.strictEqual(sm.wpm, 100);
    });

    it('clamps wpm above 600 to 600', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { wpm: 999 });
      assert.strictEqual(sm.wpm, 600);
    });

    it('accepts valid wpm', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { wpm: 300 });
      assert.strictEqual(sm.wpm, 300);
    });

    it('defaults wpm to 250', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.');
      assert.strictEqual(sm.wpm, 250);
    });

    it('returns empty words for empty text', () => {
      const sm = new RSVPStateMachine();
      sm.init('');
      assert.strictEqual(sm.words.length, 0);
    });

    it('resets state on re-init', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three.');
      sm.currentIndex = 2;
      sm.isPlaying = true;
      sm.init('New text here.');
      assert.strictEqual(sm.currentIndex, 0);
      assert.strictEqual(sm.isPlaying, false);
      assert.strictEqual(sm.words.length, 3);
    });
  });

  describe('play', () => {
    it('sets isPlaying to true', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.');
      sm.play();
      assert.strictEqual(sm.isPlaying, true);
    });

    it('resets index to 0 when at end of text', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.');
      sm.currentIndex = sm.words.length;
      sm.play();
      assert.strictEqual(sm.currentIndex, 0);
      assert.strictEqual(sm.isPlaying, true);
    });

    it('does not reset index when in the middle of text', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world again.');
      sm.currentIndex = 1;
      sm.play();
      assert.strictEqual(sm.currentIndex, 1);
    });
  });

  describe('pause', () => {
    it('sets isPlaying to false', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.');
      sm.play();
      sm.pause();
      assert.strictEqual(sm.isPlaying, false);
    });
  });

  describe('togglePlayPause', () => {
    it('plays when paused', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.');
      sm.togglePlayPause();
      assert.strictEqual(sm.isPlaying, true);
    });

    it('pauses when playing', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.');
      sm.play();
      sm.togglePlayPause();
      assert.strictEqual(sm.isPlaying, false);
    });
  });

  describe('tick', () => {
    it('advances currentIndex by 1', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world again.');
      sm.play();
      sm.tick();
      assert.strictEqual(sm.currentIndex, 1);
    });

    it('returns delay based on wpm', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { wpm: 250 });
      sm.play();
      const result = sm.tick();
      assert.strictEqual(result.delay, 240);
      assert.strictEqual(result.done, undefined);
    });

    it('returns longer delay for punctuation when enabled', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { wpm: 250, punctuationPause: true });
      sm.play();
      sm.currentIndex = 1;
      const result = sm.tick();
      assert.strictEqual(result.delay, Math.round(240 * 1.5));
    });

    it('returns uniform delay when punctuationPause is disabled', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { wpm: 250, punctuationPause: false });
      sm.play();
      sm.currentIndex = 1;
      const result = sm.tick();
      assert.strictEqual(result.delay, 240);
    });

    it('returns done when at last word', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.');
      sm.play();
      sm.currentIndex = sm.words.length - 1;
      const result = sm.tick();
      assert.strictEqual(result.done, true);
      assert.strictEqual(sm.isPlaying, false);
    });

    it('returns delay alongside done for last word', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { wpm: 250 });
      sm.play();
      sm.currentIndex = sm.words.length - 1; // "world."
      const result = sm.tick();
      assert.strictEqual(result.done, true);
      assert.strictEqual(result.delay, Math.round(240 * 1.5)); // period = 1.5x
    });

    it('returns done when not playing', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.');
      const result = sm.tick();
      assert.strictEqual(result.done, true);
    });
  });

});
