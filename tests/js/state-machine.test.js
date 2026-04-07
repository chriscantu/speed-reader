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
      sm.chunkIndex = 2;
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
      sm.chunkIndex = sm.chunks.length;
      sm.play();
      assert.strictEqual(sm.currentIndex, 0);
      assert.strictEqual(sm.isPlaying, true);
    });

    it('does not reset index when in the middle of text', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world again.');
      sm.chunkIndex = 1;
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
      sm.chunkIndex = 1;
      const result = sm.tick();
      assert.strictEqual(result.delay, Math.round(240 * 1.5));
    });

    it('returns uniform delay when punctuationPause is disabled', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { wpm: 250, punctuationPause: false });
      sm.play();
      sm.chunkIndex = 1;
      const result = sm.tick();
      assert.strictEqual(result.delay, 240);
    });

    it('returns done when at last word', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.');
      sm.play();
      sm.chunkIndex = sm.chunks.length - 1;
      const result = sm.tick();
      assert.strictEqual(result.done, true);
      assert.strictEqual(sm.isPlaying, false);
    });

    it('returns delay alongside done for last word', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { wpm: 250 });
      sm.play();
      sm.chunkIndex = sm.chunks.length - 1; // "world."
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
      sm.chunkIndex = 3; // "sentence." is index 3
      sm.prevSentence();
      assert.strictEqual(sm.currentIndex, 2); // "Second" — start of 2nd sentence
      assert.strictEqual(sm.isPlaying, false);
    });

    it('moves to previous sentence when at sentence start', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.');
      sm.play();
      sm.chunkIndex = 2; // "Second" — already at sentence start
      sm.prevSentence();
      assert.strictEqual(sm.currentIndex, 0); // "First" — start of 1st sentence
    });

    it('stays at 0 when already at beginning', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.');
      sm.play();
      sm.chunkIndex = 0;
      sm.prevSentence();
      assert.strictEqual(sm.currentIndex, 0);
    });

    it('pauses playback', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.');
      sm.play();
      sm.chunkIndex = 3;
      sm.prevSentence();
      assert.strictEqual(sm.isPlaying, false);
    });
  });

  describe('nextSentence', () => {
    it('jumps to next sentence boundary', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.');
      sm.play();
      sm.chunkIndex = 0;
      sm.nextSentence();
      assert.strictEqual(sm.currentIndex, 2); // "Second"
      assert.strictEqual(sm.isPlaying, false);
    });

    it('stays put at last sentence', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.');
      sm.play();
      sm.chunkIndex = 2; // "Second" — start of last sentence
      sm.nextSentence();
      assert.strictEqual(sm.currentIndex, 2); // no next sentence, stays
    });

    it('pauses playback', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.');
      sm.play();
      sm.chunkIndex = 0;
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
      sm.chunkIndex = 0;
      const word = sm.currentWord();
      // "Reading" — ORP at floor(7*0.3) = index 2 → "Re" + "a" + "ding"
      assert.strictEqual(word.before, 'Re');
      assert.strictEqual(word.focus, 'a');
      assert.strictEqual(word.after, 'ding');
    });

    it('returns empty parts when past end', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello.');
      sm.chunkIndex = sm.chunks.length;
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
      sm.chunkIndex = 2;
      const p = sm.progress();
      assert.strictEqual(p.percent, 50);
      assert.strictEqual(p.current, 2);
      assert.strictEqual(p.total, 4);
    });

    it('returns 100% at end', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three four.');
      sm.chunkIndex = sm.chunks.length;
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

    it('accepts the last valid index without clamping', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three.');
      sm.seekTo(2); // words.length - 1
      assert.strictEqual(sm.currentIndex, 2);
    });

    it('clamps words.length to last valid index', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three.');
      sm.seekTo(3); // words.length — tick() can leave currentIndex here
      assert.strictEqual(sm.currentIndex, 2);
    });

    it('ignores NaN index without corrupting state', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three.');
      sm.chunkIndex = 1;
      sm.seekTo(NaN);
      assert.strictEqual(sm.currentIndex, 1); // unchanged
    });

    it('ignores non-integer index', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three.');
      sm.chunkIndex = 1;
      sm.seekTo(1.5);
      assert.strictEqual(sm.currentIndex, 1); // unchanged
    });

    it('leaves isPlaying false when already paused', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three.');
      sm.seekTo(1);
      assert.strictEqual(sm.isPlaying, false);
      assert.strictEqual(sm.currentIndex, 1);
    });
  });

  describe('timeElapsed and timeRemaining', () => {
    it('returns 0 elapsed and full remaining at start', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three four.', { wpm: 240 }); // 4 words, 240wpm = 4 words/sec = 1 sec total
      assert.strictEqual(sm.timeElapsed(), 0);
      assert.strictEqual(sm.timeRemaining(), 1);
    });

    it('returns correct times at midpoint', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three four five six.', { wpm: 300 }); // 6 words at 300wpm
      sm.chunkIndex = 3; // halfway
      // elapsed: ceil(3 / 300 * 60) = ceil(0.6) = 1
      assert.strictEqual(sm.timeElapsed(), 1);
      // remaining: ceil(3 / 300 * 60) = ceil(0.6) = 1
      assert.strictEqual(sm.timeRemaining(), 1);
    });

    it('returns full elapsed and 0 remaining at end', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three four.', { wpm: 240 });
      sm.chunkIndex = sm.chunks.length; // past last word
      assert.strictEqual(sm.timeRemaining(), 0);
      assert.strictEqual(sm.timeElapsed(), 1);
    });

    it('updates when wpm changes', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three four five six seven eight nine ten.', { wpm: 300 });
      // 10 words at 300wpm = 2 sec total
      assert.strictEqual(sm.timeRemaining(), 2);
      sm.wpm = 600;
      // 10 words at 600wpm = 1 sec total
      assert.strictEqual(sm.timeRemaining(), 1);
    });

    it('timeRemaining reaches 0 at end and timeElapsed equals total duration', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three four.', { wpm: 240 }); // 4 words at 240wpm = 1 sec
      sm.chunkIndex = sm.chunks.length;
      assert.strictEqual(sm.timeRemaining(), 0);
      assert.strictEqual(sm.timeElapsed(), Math.ceil((sm.words.length / sm.wpm) * 60));
    });

    it('returns 0 for both when words array is empty', () => {
      const sm = new RSVPStateMachine();
      sm.init('');
      assert.strictEqual(sm.timeElapsed(), 0);
      assert.strictEqual(sm.timeRemaining(), 0);
    });
  });

  describe('contextSentence', () => {
    it('returns words in current sentence with highlight index', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.');
      sm.chunkIndex = 3; // "sentence." in 2nd sentence
      const ctx = sm.contextSentence();
      assert.deepStrictEqual(ctx.words, ['Second', 'sentence.']);
      assert.strictEqual(ctx.highlightIndex, 1);
    });

    it('returns first sentence when at start', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.');
      sm.chunkIndex = 0;
      const ctx = sm.contextSentence();
      assert.deepStrictEqual(ctx.words, ['First', 'sentence.']);
      assert.strictEqual(ctx.highlightIndex, 0);
    });

    it('returns empty for index past end', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.');
      sm.chunkIndex = sm.chunks.length;
      const ctx = sm.contextSentence();
      assert.deepStrictEqual(ctx.words, []);
      assert.strictEqual(ctx.highlightIndex, -1);
    });
  });

});

describe('chunk mode (chunkSize > 1)', () => {

  describe('init with chunkSize', () => {
    it('builds chunks from words', () => {
      const sm = new RSVPStateMachine();
      sm.init('The quick brown fox.', { chunkSize: 2 });
      assert.strictEqual(sm.chunks.length, 2); // "The quick" + "brown fox."
      assert.strictEqual(sm.chunkIndex, 0);
    });

    it('defaults to chunkSize 1', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.');
      assert.strictEqual(sm.chunkSize, 1);
      assert.strictEqual(sm.chunks.length, 2); // one chunk per word
    });
  });

  describe('tick with chunks', () => {
    it('advances chunkIndex by 1', () => {
      const sm = new RSVPStateMachine();
      sm.init('The quick brown fox.', { wpm: 250, chunkSize: 2 });
      sm.play();
      const result = sm.tick();
      assert.strictEqual(sm.chunkIndex, 1);
      assert.strictEqual(result.done, undefined);
    });

    it('returns delay proportional to words in chunk', () => {
      const sm = new RSVPStateMachine();
      sm.init('The quick brown fox.', { wpm: 250, chunkSize: 2 });
      sm.play();
      const result = sm.tick();
      // 2-word chunk: baseDelay (240) * 2 = 480
      assert.strictEqual(result.delay, 480);
    });

    it('applies punctuation pause to last word in chunk only', () => {
      const sm = new RSVPStateMachine();
      // "Hello world." is one 2-word chunk, last word has period
      sm.init('Hello world.', { wpm: 250, chunkSize: 2, punctuationPause: true });
      sm.play();
      const result = sm.tick();
      // baseDelay=240, 2 words=480, period on last word=480*1.5=720
      assert.strictEqual(result.delay, Math.round(480 * 1.5));
    });

    it('returns done at last chunk', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { chunkSize: 2 });
      sm.play();
      // Only one chunk: "Hello world."
      const result = sm.tick();
      assert.strictEqual(result.done, true);
      assert.strictEqual(sm.isPlaying, false);
    });
  });

  describe('currentDisplay', () => {
    it('returns isChunk false with ORP split for chunkSize 1', () => {
      const sm = new RSVPStateMachine();
      sm.init('Reading.', { chunkSize: 1 });
      const d = sm.currentDisplay();
      assert.strictEqual(d.isChunk, false);
      assert.strictEqual(typeof d.before, 'string');
      assert.strictEqual(typeof d.focus, 'string');
      assert.strictEqual(typeof d.after, 'string');
    });

    it('returns isChunk true with plain text for chunkSize 2', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { chunkSize: 2 });
      const d = sm.currentDisplay();
      assert.strictEqual(d.isChunk, true);
      assert.strictEqual(d.text, 'Hello world.');
    });

    it('returns empty display past end', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hi.', { chunkSize: 2 });
      sm.chunkIndex = sm.chunks.length;
      const d = sm.currentDisplay();
      assert.strictEqual(d.isChunk, false);
      assert.strictEqual(d.before, '');
      assert.strictEqual(d.focus, '');
      assert.strictEqual(d.after, '');
    });
  });

  describe('sentence navigation with chunks', () => {
    it('prevSentence jumps to chunk containing previous sentence start', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.', { chunkSize: 2 });
      sm.play();
      // chunks: ["First sentence."], ["Second sentence."]
      sm.chunkIndex = 1;
      sm.prevSentence();
      assert.strictEqual(sm.chunkIndex, 0);
    });

    it('nextSentence jumps to chunk containing next sentence start', () => {
      const sm = new RSVPStateMachine();
      sm.init('First sentence. Second sentence.', { chunkSize: 2 });
      sm.play();
      sm.chunkIndex = 0;
      sm.nextSentence();
      assert.strictEqual(sm.chunkIndex, 1);
    });
  });

  describe('seekTo with chunks', () => {
    it('maps word index to correct chunk', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three four.', { chunkSize: 2 });
      // chunks: ["One two"], ["three four."]
      sm.seekTo(2); // word "three" is in chunk 1
      assert.strictEqual(sm.chunkIndex, 1);
    });

    it('maps word index 0 to chunk 0', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three four.', { chunkSize: 2 });
      sm.seekTo(0);
      assert.strictEqual(sm.chunkIndex, 0);
    });
  });

  describe('progress with chunks', () => {
    it('reports word-level progress not chunk-level', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three four.', { chunkSize: 2 });
      sm.chunkIndex = 1; // chunk 1 starts at word index 2
      const p = sm.progress();
      assert.strictEqual(p.current, 2); // word index, not chunk index
      assert.strictEqual(p.total, 4);
      assert.strictEqual(p.percent, 50);
    });
  });

  describe('timeElapsed and timeRemaining with chunks', () => {
    it('computes from word position not chunk position', () => {
      const sm = new RSVPStateMachine();
      sm.init('One two three four.', { wpm: 240, chunkSize: 2 });
      sm.chunkIndex = 1; // word index 2
      // elapsed: ceil(2/240*60) = ceil(0.5) = 1
      assert.strictEqual(sm.timeElapsed(), 1);
      // remaining: ceil(2/240*60) = ceil(0.5) = 1
      assert.strictEqual(sm.timeRemaining(), 1);
    });
  });

  describe('contextSentence with chunks', () => {
    it('returns highlightRange for multi-word chunk', () => {
      const sm = new RSVPStateMachine();
      sm.init('The quick brown fox.', { chunkSize: 2 });
      // chunk 0: "The quick" (words 0-1), chunk 1: "brown fox." (words 2-3)
      sm.chunkIndex = 0;
      const ctx = sm.contextSentence();
      assert.deepStrictEqual(ctx.highlightRange, { start: 0, end: 1 });
    });

    it('returns single highlightIndex for chunkSize 1', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world.', { chunkSize: 1 });
      sm.chunkIndex = 0;
      const ctx = sm.contextSentence();
      assert.strictEqual(ctx.highlightIndex, 0);
      assert.strictEqual(ctx.highlightRange, undefined);
    });
  });

  describe('backward compatibility (chunkSize 1)', () => {
    it('tick advances same as before', () => {
      const sm = new RSVPStateMachine();
      sm.init('Hello world again.', { wpm: 250, chunkSize: 1 });
      sm.play();
      const result = sm.tick();
      assert.strictEqual(sm.chunkIndex, 1);
      assert.strictEqual(result.delay, 240); // single word, baseDelay * 1
    });

    it('currentDisplay returns ORP split', () => {
      const sm = new RSVPStateMachine();
      sm.init('Reading.', { chunkSize: 1 });
      const d = sm.currentDisplay();
      assert.strictEqual(d.isChunk, false);
      assert.strictEqual(d.before, 'Re');
      assert.strictEqual(d.focus, 'a');
      assert.strictEqual(d.after, 'ding.');
    });
  });
});
