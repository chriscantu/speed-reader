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

  describe('prevSentence', () => {
    it('moves to start of current sentence', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.');
      sm.play();
      sm.currentIndex = 3; // "sentence." is index 3
      sm.prevSentence();
      assert.strictEqual(sm.currentIndex, 2); // "Second" — start of 2nd sentence
      assert.strictEqual(sm.isPlaying, false);
    });

    it('moves to previous sentence when at sentence start', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.');
      sm.play();
      sm.currentIndex = 2; // "Second" — already at sentence start
      sm.prevSentence();
      assert.strictEqual(sm.currentIndex, 0); // "First" — start of 1st sentence
    });

    it('stays at 0 when already at beginning', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.');
      sm.play();
      sm.currentIndex = 0;
      sm.prevSentence();
      assert.strictEqual(sm.currentIndex, 0);
    });

    it('pauses playback', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.');
      sm.play();
      sm.currentIndex = 3;
      sm.prevSentence();
      assert.strictEqual(sm.isPlaying, false);
    });
  });

  describe('nextSentence', () => {
    it('jumps to next sentence boundary', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.');
      sm.play();
      sm.currentIndex = 0;
      sm.nextSentence();
      assert.strictEqual(sm.currentIndex, 2); // "Second"
      assert.strictEqual(sm.isPlaying, false);
    });

    it('stays put at last sentence', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.');
      sm.play();
      sm.currentIndex = 2; // "Second" — start of last sentence
      sm.nextSentence();
      assert.strictEqual(sm.currentIndex, 2); // no next sentence, stays
    });

    it('pauses playback', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.');
      sm.play();
      sm.currentIndex = 0;
      sm.nextSentence();
      assert.strictEqual(sm.isPlaying, false);
    });
  });

  describe('adjustWpm', () => {
    it('increments wpm by delta', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { wpm: 250 });
      const result = sm.adjustWpm(25);
      assert.strictEqual(result, 275);
      assert.strictEqual(sm.wpm, 275);
    });

    it('decrements wpm by delta', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { wpm: 250 });
      const result = sm.adjustWpm(-25);
      assert.strictEqual(result, 225);
      assert.strictEqual(sm.wpm, 225);
    });

    it('clamps at floor of 100', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { wpm: 100 });
      const result = sm.adjustWpm(-25);
      assert.strictEqual(result, 100);
    });

    it('clamps at ceiling of 600', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { wpm: 600 });
      const result = sm.adjustWpm(25);
      assert.strictEqual(result, 600);
    });
  });

  describe('currentWord', () => {
    it('returns split word at current index', () => {
      const sm = new RSVPStateMachine();
      sm.init('Reading is fun.');
      sm.currentIndex = 0;
      const word = sm.currentWord();
      // "Reading" — ORP at floor(7*0.3) = index 2 → "Re" + "a" + "ding"
      assert.strictEqual(word.before, 'Re');
      assert.strictEqual(word.focus, 'a');
      assert.strictEqual(word.after, 'ding');
    });

    it('returns empty parts when past end', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello.');
      sm.currentIndex = sm.words.length;
      const word = sm.currentWord();
      assert.strictEqual(word.before, '');
      assert.strictEqual(word.focus, '');
      assert.strictEqual(word.after, '');
    });
  });

  describe('progress', () => {
    it('returns 0% at start', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three four.');
      const p = sm.progress();
      assert.strictEqual(p.percent, 0);
      assert.strictEqual(p.current, 0);
      assert.strictEqual(p.total, 4);
    });

    it('returns 50% at midpoint', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three four.');
      sm.currentIndex = 2;
      const p = sm.progress();
      assert.strictEqual(p.percent, 50);
      assert.strictEqual(p.current, 2);
      assert.strictEqual(p.total, 4);
    });

    it('returns 100% at end', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three four.');
      sm.currentIndex = 4;
      const p = sm.progress();
      assert.strictEqual(p.percent, 100);
    });

    it('returns 0% for empty text', () => {
      const sm = new RSVPStateMachine();
      sm.init('');
      const p = sm.progress();
      assert.strictEqual(p.percent, 0);
      assert.strictEqual(p.total, 0);
    });
  });

  describe('seekTo', () => {
    it('sets currentIndex to the given value', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three four five.');
      sm.seekTo(3);
      assert.strictEqual(sm.currentIndex, 3);
    });

    it('clamps to 0 when given a negative index', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three.');
      sm.seekTo(-5);
      assert.strictEqual(sm.currentIndex, 0);
    });

    it('clamps to last valid index when given index beyond words length', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three.');
      sm.seekTo(999);
      assert.strictEqual(sm.currentIndex, 2); // 3 words, last index is 2
    });

    it('pauses playback when seeking', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three four five.');
      sm.play();
      assert.strictEqual(sm.isPlaying, true);
      sm.seekTo(2);
      assert.strictEqual(sm.isPlaying, false);
    });

    it('works correctly when words array is empty', () => {
      const sm = new RSVPStateMachine();
      sm.init('');
      sm.seekTo(5);
      assert.strictEqual(sm.currentIndex, 0);
    });
  });

  describe('contextSentence', () => {
    it('returns words in current sentence with highlight index', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.');
      sm.currentIndex = 3; // "sentence." in 2nd sentence
      const ctx = sm.contextSentence();
      assert.deepStrictEqual(ctx.words, ['Second', 'sentence.']);
      assert.strictEqual(ctx.highlightIndex, 1);
    });

    it('returns first sentence when at start', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.');
      sm.currentIndex = 0;
      const ctx = sm.contextSentence();
      assert.deepStrictEqual(ctx.words, ['First', 'sentence.']);
      assert.strictEqual(ctx.highlightIndex, 0);
    });

    it('returns empty for index past end', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.');
      sm.currentIndex = sm.words.length;
      const ctx = sm.contextSentence();
      assert.deepStrictEqual(ctx.words, []);
      assert.strictEqual(ctx.highlightIndex, -1);
    });
  });

});
