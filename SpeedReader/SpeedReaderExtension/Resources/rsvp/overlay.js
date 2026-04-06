import { RSVPStateMachine } from './state-machine.js';
import { FONT_SIZE_DEFAULT, FONT_SIZE_STEP, ALIGNMENT_DEFAULT, clampWpm, clampFontSize, validateAlignment } from './settings-defaults.js';

export class RSVPOverlay {
  constructor() {
    this.state = new RSVPStateMachine();
    this.timerId = null;
    this.title = '';
    this.settings = {
      theme: 'system',
      font: 'system',
      fontSize: FONT_SIZE_DEFAULT,
      alignment: ALIGNMENT_DEFAULT,
    };
    this.host = null;
    this.shadow = null;
    this.elements = {};
    this._boundKeyHandler = null;
    this._scrubFromIndex = undefined;
  }

  open(text, title, settings = {}) {
    if (this.host) {
      this.close();
    }

    Object.assign(this.settings, settings);
    this.title = title || '';
    this.state.init(text, {
      wpm: settings.wpm,
      punctuationPause: settings.punctuationPause ?? true,
    });

    if (this.state.words.length === 0) {
      this._showPageToast('No readable content found.');
      return;
    }

    this._createDOM();
    this._bindEvents();
    this._renderWord();
    this._updateProgress();
  }

  updateSettings(settings) {
    if (typeof settings.fontSize === 'number') {
      settings.fontSize = clampFontSize(settings.fontSize);
    }
    Object.assign(this.settings, settings);

    if (this.host) {
      this._syncHostAttr('data-theme', settings.theme);
      this._syncHostAttr('data-font', settings.font);
      // Alignment bypasses _syncHostAttr intentionally: unlike theme/font,
      // alignment has no 'system' state — the attribute must always be present
      // for the CSS grid selector to match.
      if (settings.alignment !== undefined) {
        this.host.setAttribute('data-alignment', validateAlignment(settings.alignment));
      }
    }

    if (typeof settings.fontSize === 'number' && this.shadow) {
      this._syncFontSizeOverride(settings.fontSize);
      if (this.elements.fontSizeValue) {
        this.elements.fontSizeValue.textContent = settings.fontSize + 'px';
      }
    }

    // WPM and punctuationPause take effect on the next tick.
    // Update the state machine and sync the slider UI.
    if (typeof settings.wpm === 'number') {
      this.state.wpm = clampWpm(settings.wpm);
      if (this.elements.wpmLabel) {
        this.elements.wpmLabel.textContent = this.state.wpm + ' wpm';
      }
      if (this.elements.slider) {
        this.elements.slider.value = this.state.wpm;
      }
    }
    if (settings.punctuationPause !== undefined) {
      this.state.punctuationPause = settings.punctuationPause;
    }
  }

  // Set or remove a host attribute based on whether value is a non-system string.
  _syncHostAttr(attr, value) {
    if (value === undefined) return;
    if (value && value !== 'system') {
      this.host.setAttribute(attr, value);
    } else {
      this.host.removeAttribute(attr);
    }
  }

  // Apply or remove the font-size override <style> in the shadow DOM.
  // Class 'sr-font-override' is used by updateSettings() to find and replace this element.
  _syncFontSizeOverride(fontSize) {
    var existing = this.shadow.querySelector('.sr-font-override');
    if (fontSize !== FONT_SIZE_DEFAULT) {
      var css = ':host { --sr-word-size: ' + fontSize + 'px; }';
      if (existing) {
        existing.textContent = css;
      } else {
        var style = document.createElement('style');
        style.className = 'sr-font-override';
        style.textContent = css;
        this.shadow.appendChild(style);
      }
    } else if (existing) {
      existing.remove();
    }
  }

  close() {
    this.pause();
    if (this.host && this.host.parentNode) {
      this.host.parentNode.removeChild(this.host);
    }
    this.host = null;
    this.shadow = null;
    this.elements = {};
    if (this._boundKeyHandler) {
      document.removeEventListener('keydown', this._boundKeyHandler);
      this._boundKeyHandler = null;
    }
  }

  play() {
    this.state.play();
    this._updatePlayButton();
    this._hideContext();
    this._startLoop();
  }

  pause() {
    this.state.pause();
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this._updatePlayButton();
    this._showContext();
  }

  togglePlayPause() {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  prevSentence() {
    this.state.prevSentence();
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this._updatePlayButton();
    this._showContext();
    this._renderWord();
    this._updateProgress();
  }

  nextSentence() {
    this.state.nextSentence();
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this._updatePlayButton();
    this._showContext();
    this._renderWord();
    this._updateProgress();
  }

  adjustWpm(delta) {
    this.state.adjustWpm(delta);
    if (this.elements.wpmLabel) {
      this.elements.wpmLabel.textContent = this.state.wpm + ' wpm';
    }
    if (this.elements.slider) {
      this.elements.slider.value = this.state.wpm;
    }
  }

  adjustFontSize(delta) {
    var current = this.settings.fontSize || FONT_SIZE_DEFAULT;
    var newSize = clampFontSize(current + delta);
    this.settings.fontSize = newSize;
    this._syncFontSizeOverride(newSize);
    if (this.elements.fontSizeValue) {
      this.elements.fontSizeValue.textContent = newSize + 'px';
    }
    this._persistFontSize(newSize);
    this._scaleWordToFit();
  }

  // Persist to browser.storage.sync (extension's source of truth) AND relay to
  // native app via background script so the SwiftUI settings UI stays in sync.
  _persistFontSize(fontSize) {
    browser.storage.sync.set({ fontSize: fontSize }).catch(function(err) {
      console.warn('[SpeedReader] Failed to persist font size to storage:', err.message || err);
    });
    browser.runtime.sendMessage({
      action: 'save-settings',
      settings: { fontSize: fontSize },
    }).catch(function(err) {
      console.warn('[SpeedReader] Failed to save font size to native:', err.message || err);
    });
  }

  _startLoop() {
    this._renderWord();
    this._updateProgress();

    const result = this.state.tick();
    if (result.done) {
      this.pause();
      return;
    }

    this.timerId = setTimeout(() => {
      this._startLoop();
    }, result.delay);
  }

  _renderWord() {
    const parts = this.state.currentWord();
    if (this.elements.wordBefore) {
      this.elements.wordBefore.textContent = parts.before;
    }
    if (this.elements.wordFocus) {
      this.elements.wordFocus.textContent = parts.focus;
    }
    if (this.elements.wordAfter) {
      this.elements.wordAfter.textContent = parts.after;
    }
    this._scaleWordToFit();
  }

  // Scale the word container down when the text overflows the word area width.
  // Uses CSS transform so layout dimensions stay stable.
  _scaleWordToFit() {
    const container = this.elements.wordContainer;
    const area = this.elements.wordArea;
    if (!container || !area) return;

    // Reset any previous scale so measurements reflect true size.
    container.style.transform = '';
    const areaWidth = area.clientWidth;
    const textWidth = container.scrollWidth;
    if (textWidth > areaWidth) {
      const scale = Math.max(areaWidth / textWidth, 0.3);
      container.style.transform = 'scale(' + scale + ')';
    }
  }

  _formatTime(seconds) {
    var mins = Math.floor(seconds / 60);
    var secs = seconds % 60;
    return mins + ':' + (secs < 10 ? '0' : '') + secs;
  }

  _updateProgress() {
    if (this.elements.scrubber) {
      this.elements.scrubber.value = this.state.currentIndex;
    }
    if (this.elements.timeElapsed) {
      this.elements.timeElapsed.textContent = this._formatTime(this.state.timeElapsed());
    }
    if (this.elements.timeRemaining) {
      this.elements.timeRemaining.textContent = '-' + this._formatTime(this.state.timeRemaining());
    }
  }

  _updatePlayButton() {
    if (this.elements.playBtn) {
      this.elements.playBtn.textContent = this.state.isPlaying ? '⏸' : '▶';
    }
  }

  _showContext() {
    if (!this.elements.context) return;
    this.elements.context.setAttribute('data-visible', 'true');

    const contentEl = this.elements.contextContent;
    if (!contentEl) return;

    while (contentEl.firstChild) {
      contentEl.removeChild(contentEl.firstChild);
    }

    const ctx = this.state.contextSentence();
    if (ctx.words.length === 0) return;

    for (let i = 0; i < ctx.words.length; i++) {
      if (i > 0) {
        contentEl.appendChild(document.createTextNode(' '));
      }
      if (i === ctx.highlightIndex) {
        const highlight = document.createElement('span');
        highlight.className = 'sr-context-highlight';
        highlight.textContent = ctx.words[i];
        contentEl.appendChild(highlight);
      } else {
        contentEl.appendChild(document.createTextNode(ctx.words[i]));
      }
    }
  }

  _hideContext() {
    if (this.elements.context) {
      this.elements.context.setAttribute('data-visible', 'false');
    }
  }

  _showPageToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = [
      'position:fixed',
      'bottom:80px',
      'left:50%',
      'transform:translateX(-50%)',
      'background:#333',
      'color:#fff',
      'padding:12px 20px',
      'border-radius:10px',
      'font-size:14px',
      'z-index:2147483647',
      'font-family:-apple-system,system-ui,sans-serif',
    ].join(';');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 3000);
  }

  _createDOM() {
    this.host = document.createElement('speed-reader-overlay');
    this.shadow = this.host.attachShadow({ mode: 'closed' });

    // Set theme and font attributes
    this._syncHostAttr('data-theme', this.settings.theme);
    this._syncHostAttr('data-font', this.settings.font);
    // Alignment bypasses _syncHostAttr — see comment in updateSettings().
    this.host.setAttribute('data-alignment', validateAlignment(this.settings.alignment));

    // Link stylesheet
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = browser.runtime.getURL('overlay.css');
    link.onerror = () => {
      console.error('[SpeedReader] Failed to load overlay stylesheet');
      this._showPageToast('Speed Reader styles failed to load. Try reloading the page.');
    };
    this.shadow.appendChild(link);

    // Override word size if custom
    if (this.settings.fontSize && this.settings.fontSize !== FONT_SIZE_DEFAULT) {
      this._syncFontSizeOverride(this.settings.fontSize);
    }

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'sr-backdrop';
    this.elements.backdrop = backdrop;

    // Card
    const card = document.createElement('div');
    card.className = 'sr-card';

    // Header
    const header = document.createElement('div');
    header.className = 'sr-header';

    const titleEl = document.createElement('div');
    titleEl.className = 'sr-title';
    titleEl.textContent = this.title;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'sr-close';
    closeBtn.setAttribute('aria-label', 'Close reader');
    closeBtn.textContent = '✕';
    this.elements.closeBtn = closeBtn;

    header.appendChild(titleEl);
    header.appendChild(closeBtn);

    // Word area
    const wordArea = document.createElement('div');
    wordArea.className = 'sr-word-area';
    wordArea.setAttribute('role', 'status');
    wordArea.setAttribute('aria-live', 'polite');
    this.elements.wordArea = wordArea;

    const wordContainer = document.createElement('div');
    wordContainer.className = 'sr-word';

    const wordBefore = document.createElement('span');
    wordBefore.className = 'sr-word-before';
    this.elements.wordBefore = wordBefore;

    const wordFocus = document.createElement('span');
    wordFocus.className = 'sr-word-focus';
    this.elements.wordFocus = wordFocus;

    const wordAfter = document.createElement('span');
    wordAfter.className = 'sr-word-after';
    this.elements.wordAfter = wordAfter;

    wordContainer.appendChild(wordBefore);
    wordContainer.appendChild(wordFocus);
    wordContainer.appendChild(wordAfter);
    this.elements.wordContainer = wordContainer;

    wordArea.appendChild(wordContainer);

    // Context preview
    const context = document.createElement('div');
    context.className = 'sr-context';
    context.setAttribute('data-visible', 'false');
    this.elements.context = context;

    const contextLabel = document.createElement('span');
    contextLabel.className = 'sr-context-label';
    contextLabel.textContent = '▸ Paused — context:';

    const contextContent = document.createElement('div');
    this.elements.contextContent = contextContent;

    context.appendChild(contextLabel);
    context.appendChild(contextContent);

    // Controls
    const controls = document.createElement('div');
    controls.className = 'sr-controls';

    // Prev button group
    const prevGroup = document.createElement('div');
    prevGroup.className = 'sr-control-group';
    const prevBtn = document.createElement('button');
    prevBtn.className = 'sr-btn';
    prevBtn.textContent = '⏮';
    prevBtn.setAttribute('aria-label', 'Previous sentence');
    this.elements.prevBtn = prevBtn;
    const prevHint = document.createElement('div');
    prevHint.className = 'sr-shortcut-hint';
    prevHint.textContent = '← key';
    prevGroup.appendChild(prevBtn);
    prevGroup.appendChild(prevHint);

    // Play button group
    const playGroup = document.createElement('div');
    playGroup.className = 'sr-control-group';
    const playBtn = document.createElement('button');
    playBtn.className = 'sr-btn-play';
    playBtn.textContent = '▶';
    playBtn.setAttribute('aria-label', 'Play or pause');
    this.elements.playBtn = playBtn;
    const playHint = document.createElement('div');
    playHint.className = 'sr-shortcut-hint';
    playHint.textContent = 'space';
    playGroup.appendChild(playBtn);
    playGroup.appendChild(playHint);

    // Next button group
    const nextGroup = document.createElement('div');
    nextGroup.className = 'sr-control-group';
    const nextBtn = document.createElement('button');
    nextBtn.className = 'sr-btn';
    nextBtn.textContent = '⏭';
    nextBtn.setAttribute('aria-label', 'Next sentence');
    this.elements.nextBtn = nextBtn;
    const nextHint = document.createElement('div');
    nextHint.className = 'sr-shortcut-hint';
    nextHint.textContent = '→ key';
    nextGroup.appendChild(nextBtn);
    nextGroup.appendChild(nextHint);

    controls.appendChild(prevGroup);
    controls.appendChild(playGroup);
    controls.appendChild(nextGroup);

    // Slider area
    const sliderArea = document.createElement('div');
    sliderArea.className = 'sr-slider-area';

    const sliderLabels = document.createElement('div');
    sliderLabels.className = 'sr-slider-labels';

    const wpmLabel = document.createElement('span');
    wpmLabel.textContent = this.state.wpm + ' wpm';
    this.elements.wpmLabel = wpmLabel;

    const speedLabel = document.createElement('span');
    speedLabel.textContent = 'Speed';

    sliderLabels.appendChild(wpmLabel);
    sliderLabels.appendChild(speedLabel);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'sr-slider';
    slider.min = '100';
    slider.max = '600';
    slider.value = this.state.wpm;
    slider.setAttribute('aria-label', 'Words per minute');
    this.elements.slider = slider;

    sliderArea.appendChild(sliderLabels);
    sliderArea.appendChild(slider);

    // Font size stepper area
    const fontSizeArea = document.createElement('div');
    fontSizeArea.className = 'sr-font-size-area';

    const fontSizeRow = document.createElement('div');
    fontSizeRow.className = 'sr-font-size-row';

    const fontSizeLabel = document.createElement('span');
    fontSizeLabel.className = 'sr-font-size-label';
    fontSizeLabel.textContent = 'Text Size';

    const fontSizeControls = document.createElement('div');
    fontSizeControls.className = 'sr-font-size-controls';

    const fontSizeDown = document.createElement('button');
    fontSizeDown.className = 'sr-font-size-btn';
    fontSizeDown.textContent = 'A\u2212';
    fontSizeDown.setAttribute('aria-label', 'Decrease text size');
    this.elements.fontSizeDown = fontSizeDown;

    const fontSizeValue = document.createElement('span');
    fontSizeValue.className = 'sr-font-size-value';
    fontSizeValue.textContent = (this.settings.fontSize || FONT_SIZE_DEFAULT) + 'px';
    fontSizeValue.setAttribute('aria-live', 'polite');
    this.elements.fontSizeValue = fontSizeValue;

    const fontSizeUp = document.createElement('button');
    fontSizeUp.className = 'sr-font-size-btn';
    fontSizeUp.textContent = 'A+';
    fontSizeUp.setAttribute('aria-label', 'Increase text size');
    this.elements.fontSizeUp = fontSizeUp;

    fontSizeControls.appendChild(fontSizeDown);
    fontSizeControls.appendChild(fontSizeValue);
    fontSizeControls.appendChild(fontSizeUp);

    fontSizeRow.appendChild(fontSizeLabel);
    fontSizeRow.appendChild(fontSizeControls);
    fontSizeArea.appendChild(fontSizeRow);

    // Scrubber area
    const scrubberArea = document.createElement('div');
    scrubberArea.className = 'sr-scrubber-area';

    const scrubberLabels = document.createElement('div');
    scrubberLabels.className = 'sr-scrubber-labels';

    const timeElapsed = document.createElement('span');
    timeElapsed.textContent = '0:00';
    this.elements.timeElapsed = timeElapsed;

    const timeRemaining = document.createElement('span');
    timeRemaining.textContent = '-' + this._formatTime(this.state.timeRemaining());
    this.elements.timeRemaining = timeRemaining;

    scrubberLabels.appendChild(timeElapsed);
    scrubberLabels.appendChild(timeRemaining);

    const scrubber = document.createElement('input');
    scrubber.type = 'range';
    scrubber.className = 'sr-slider';
    scrubber.min = '0';
    scrubber.max = String(Math.max(0, this.state.words.length - 1));
    scrubber.value = '0';
    scrubber.setAttribute('aria-label', 'Reading position');
    this.elements.scrubber = scrubber;

    scrubberArea.appendChild(scrubberLabels);
    scrubberArea.appendChild(scrubber);

    // Assemble card
    card.appendChild(header);
    card.appendChild(wordArea);
    card.appendChild(context);
    card.appendChild(controls);
    card.appendChild(sliderArea);
    card.appendChild(fontSizeArea);
    card.appendChild(scrubberArea);

    backdrop.appendChild(card);
    this.shadow.appendChild(backdrop);

    document.body.appendChild(this.host);
  }

  _bindEvents() {
    this.elements.closeBtn.addEventListener('click', () => {
      this.close();
    });

    this.elements.wordArea.addEventListener('click', () => {
      this.togglePlayPause();
    });

    this.elements.playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePlayPause();
    });

    this.elements.prevBtn.addEventListener('click', () => {
      this.prevSentence();
    });

    this.elements.nextBtn.addEventListener('click', () => {
      this.nextSentence();
    });

    this.elements.slider.addEventListener('input', () => {
      const value = parseInt(this.elements.slider.value, 10);
      this.state.wpm = clampWpm(value);
      this.elements.wpmLabel.textContent = this.state.wpm + ' wpm';
    });

    this.elements.fontSizeDown.addEventListener('click', () => {
      this.adjustFontSize(-FONT_SIZE_STEP);
    });

    this.elements.fontSizeUp.addEventListener('click', () => {
      this.adjustFontSize(FONT_SIZE_STEP);
    });

    this.elements.scrubber.addEventListener('mousedown', () => {
      this._scrubFromIndex = this.state.currentIndex;
      if (this.state.isPlaying) {
        this.pause();
      }
    });

    this.elements.scrubber.addEventListener('touchstart', () => {
      this._scrubFromIndex = this.state.currentIndex;
      if (this.state.isPlaying) {
        this.pause();
      }
    }, { passive: true });

    this.elements.scrubber.addEventListener('input', () => {
      const index = parseInt(this.elements.scrubber.value, 10);
      this.state.seekTo(index);
      this._renderWord();
      this._updateProgress();
      this._showContext();
    });

    this.elements.scrubber.addEventListener('change', () => {
      const toIndex = this.state.currentIndex;
      const fromIndex = this._scrubFromIndex !== undefined ? this._scrubFromIndex : toIndex;
      if (fromIndex !== toIndex) {
        browser.runtime.sendMessage({
          action: 'analytics-event',
          event: 'scrub',
          data: {
            direction: toIndex < fromIndex ? 'backward' : 'forward',
            distance: Math.abs(toIndex - fromIndex),
            fromIndex: fromIndex,
            toIndex: toIndex,
            totalWords: this.state.words.length,
          },
        }).catch(function(err) {
          console.warn('[SpeedReader] Failed to send scrub analytics:', err.message || err);
        });
      }
      this._scrubFromIndex = undefined;
    });

    this.elements.backdrop.addEventListener('click', (e) => {
      if (e.target === this.elements.backdrop) {
        this.close();
      }
    });

    this._boundKeyHandler = (e) => {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          this.togglePlayPause();
          break;
        case 'Escape':
          e.preventDefault();
          this.close();
          break;
        case 'ArrowLeft':
          if (e.target === this.elements.scrubber) break;
          e.preventDefault();
          this.prevSentence();
          break;
        case 'ArrowRight':
          if (e.target === this.elements.scrubber) break;
          e.preventDefault();
          this.nextSentence();
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.adjustWpm(25);
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.adjustWpm(-25);
          break;
      }
    };
    document.addEventListener('keydown', this._boundKeyHandler);
  }
}
