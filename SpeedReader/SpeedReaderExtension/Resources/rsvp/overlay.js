import { RSVPStateMachine } from './state-machine.js';

export class RSVPOverlay {
  constructor() {
    this.state = new RSVPStateMachine();
    this.timerId = null;
    this.title = '';
    this.settings = {
      theme: 'system',
      font: 'system',
      fontSize: 42,
    };
    this.host = null;
    this.shadow = null;
    this.elements = {};
    this._boundKeyHandler = null;
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
  }

  _updateProgress() {
    const p = this.state.progress();
    if (this.elements.progressFill) {
      this.elements.progressFill.style.width = p.percent + '%';
    }
    if (this.elements.progressLabel) {
      this.elements.progressLabel.textContent = p.percent + '%';
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
    if (this.settings.theme && this.settings.theme !== 'system') {
      this.host.setAttribute('data-theme', this.settings.theme);
    }
    if (this.settings.font && this.settings.font !== 'system') {
      this.host.setAttribute('data-font', this.settings.font);
    }

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
    if (this.settings.fontSize && this.settings.fontSize !== 42) {
      const style = document.createElement('style');
      style.textContent = ':host { --sr-word-size: ' + this.settings.fontSize + 'px; }';
      this.shadow.appendChild(style);
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

    const focusMarker = document.createElement('div');
    focusMarker.className = 'sr-focus-marker';
    focusMarker.textContent = '▼';

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

    wordArea.appendChild(focusMarker);
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

    // Progress area
    const progressArea = document.createElement('div');
    progressArea.className = 'sr-progress-area';

    const progressLabels = document.createElement('div');
    progressLabels.className = 'sr-progress-labels';

    const progressLabel = document.createElement('span');
    progressLabel.textContent = '0%';
    this.elements.progressLabel = progressLabel;

    const wordsCountLabel = document.createElement('span');
    wordsCountLabel.textContent = this.state.words.length + ' words';

    progressLabels.appendChild(progressLabel);
    progressLabels.appendChild(wordsCountLabel);

    const progressTrack = document.createElement('div');
    progressTrack.className = 'sr-progress-track';

    const progressFill = document.createElement('div');
    progressFill.className = 'sr-progress-fill';
    this.elements.progressFill = progressFill;

    progressTrack.appendChild(progressFill);

    progressArea.appendChild(progressLabels);
    progressArea.appendChild(progressTrack);

    // Assemble card
    card.appendChild(header);
    card.appendChild(wordArea);
    card.appendChild(context);
    card.appendChild(controls);
    card.appendChild(sliderArea);
    card.appendChild(progressArea);

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
      this.state.wpm = Math.max(100, Math.min(600, value));
      this.elements.wpmLabel.textContent = this.state.wpm + ' wpm';
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
          e.preventDefault();
          this.prevSentence();
          break;
        case 'ArrowRight':
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
