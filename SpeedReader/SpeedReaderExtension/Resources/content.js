// Content script — runs as classic script (not ES module) in Safari.
// Uses dynamic import() to load ES module dependencies.

let overlay = null;
let pendingSelectionMode = false;

// Mark content script presence for test verification
document.documentElement.setAttribute('data-speedreader-loaded', 'true');

// Live-reload settings into an open overlay when they change in storage.
browser.storage.onChanged.addListener(function(changes, area) {
  if (area !== 'sync' || !overlay || !overlay.host) return;
  var updated = {};
  for (var key in changes) {
    if (changes[key].newValue !== undefined) {
      updated[key] = changes[key].newValue;
    }
  }
  if (Object.keys(updated).length === 0) return;
  try {
    overlay.updateSettings(updated);
  } catch (e) {
    console.error('[SpeedReader] Failed to apply live settings update:', e);
  }
});

// When Safari returns to foreground, sync settings from native in case
// the user changed them in the companion app while away.
// Debounced to at most once per 5 seconds to avoid overhead on tab switches.
var _lastSyncTime = 0;
document.addEventListener('visibilitychange', function() {
  var now = Date.now();
  if (document.visibilityState === 'visible' && overlay && overlay.host && now - _lastSyncTime > 5000) {
    _lastSyncTime = now;
    browser.runtime.sendMessage({ action: 'sync-settings' }).catch(function(err) {
      console.warn('[SpeedReader] Foreground sync failed:', err.message || err);
    });
  }
});

async function getOverlay() {
  if (overlay) return overlay;
  try {
    var overlayModule = await import(browser.runtime.getURL('overlay.js'));
    overlay = new overlayModule.RSVPOverlay();
    return overlay;
  } catch (e) {
    console.error('[SpeedReader] Failed to load overlay module:', e);
    showToast('Speed Reader failed to load. Try reloading the page.');
    throw e;
  }
}

async function extractAndLaunch() {
  var reader;
  try {
    reader = await getOverlay();
  } catch (_e) {
    return; // Toast already shown by getOverlay
  }

  // Check for user text selection first — narrow try/catch to selection API only
  var selectedText = null;
  try {
    var selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      selectedText = selection.toString().trim();
    }
  } catch (e) {
    console.error('[SpeedReader] Selection read failed:', e);
    showToast('Could not read your selection. Extracting full article instead.');
  }

  if (selectedText) {
    try {
      reader.open(selectedText, document.title, await getSettings());
      pendingSelectionMode = false;
      return;
    } catch (e) {
      console.error('[SpeedReader] Failed to open reader with selection:', e);
      showToast('Something went wrong. Try reloading the page.');
      return;
    }
  }

  // If we're in selection fallback mode, remind user to select text
  if (pendingSelectionMode) {
    showToast('Select some text on the page, then tap the extension icon again.');
    return;
  }

  try {
    var readabilityModule = await import(browser.runtime.getURL('Readability.js'));
    var Readability = readabilityModule.Readability;

    // Clone the document so Readability doesn't mutate the live DOM
    var docClone = document.cloneNode(true);
    var article = new Readability(docClone).parse();

    if (article && article.textContent && article.textContent.trim().length > 0) {
      var settings = await getSettings();
      reader.open(article.textContent.trim(), article.title || document.title, settings);
    } else {
      pendingSelectionMode = true;
      showToast("Couldn't extract article. Select text and tap the extension icon again.");
    }
  } catch (error) {
    console.error('[SpeedReader] Extraction failed:', error);
    pendingSelectionMode = true;
    showToast("Couldn't extract article. Select text and tap the extension icon again.");
  }
}

var settingsDefaults = {
  wpm: 250,
  font: 'system',
  theme: 'system',
  fontSize: 42,
  punctuationPause: true,
};

async function getSettings() {
  // Attempt a fresh sync from native App Group before reading storage,
  // so the overlay is likely to open with current SwiftUI settings.
  try {
    var syncResult = await browser.runtime.sendMessage({ action: 'sync-settings' });
    if (syncResult && !syncResult.ok) {
      console.warn('[SpeedReader] Native sync returned failure:', syncResult.error || 'unknown');
    }
  } catch (_e) {
    console.warn('[SpeedReader] Background script unreachable for settings sync:', _e.message || _e);
  }

  try {
    return await browser.storage.sync.get(settingsDefaults);
  } catch (e) {
    console.error('[SpeedReader] Failed to load settings:', e);
    showToast('Could not load your settings. Using defaults.');
    return settingsDefaults;
  }
}

function showToast(message) {
  var existing = document.querySelector('.speed-reader-toast');
  if (existing) existing.remove();

  var toast = document.createElement('div');
  toast.className = 'speed-reader-toast';
  toast.style.cssText =
    'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
    'background:#333;color:#fff;padding:12px 20px;border-radius:10px;' +
    'font-size:14px;z-index:2147483647;font-family:-apple-system,system-ui,sans-serif;' +
    'box-shadow:0 4px 16px rgba(0,0,0,0.3);';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 4000);
}

// Test hooks — allow osascript to drive the extension via window.postMessage.
// postMessage crosses the content script isolation boundary in Safari.
window.addEventListener('message', function(event) {
  if (!event.data || !event.data.type) return;

  if (event.data.type === 'speedreader-test-toggle') {
    getOverlay().then(function(reader) {
      if (reader.host) {
        reader.close();
      } else {
        extractAndLaunch();
      }
    }).catch(function(err) {
      console.error('[SpeedReader] test-toggle failed:', err);
    });
  }

  if (event.data.type === 'speedreader-test-query') {
    var result = { overlayOpen: false };
    if (overlay && overlay.host && overlay.shadow) {
      result.overlayOpen = true;
      result.hasShadow = true;
      result.isPlaying = overlay.state.isPlaying;
      result.wordCount = overlay.state.words.length;
      result.currentIndex = overlay.state.currentIndex;
      result.wpm = overlay.state.wpm;
      var wordEl = overlay.shadow.querySelector('.sr-word');
      result.wordText = wordEl ? wordEl.textContent.trim() : '';
      var focusEl = overlay.shadow.querySelector('.sr-word-focus');
      result.hasFocus = focusEl !== null;
      var contextEl = overlay.shadow.querySelector('.sr-context');
      result.contextText = contextEl ? contextEl.textContent.trim() : '';
      result.wpmLabel = overlay.elements.wpmLabel ? overlay.elements.wpmLabel.textContent.trim() : '';
      result.hasPlay = overlay.shadow.querySelector('.sr-btn-play') !== null;
      result.hasPrev = overlay.elements.prevBtn !== undefined;
      result.hasNext = overlay.elements.nextBtn !== undefined;
      result.hasClose = overlay.shadow.querySelector('.sr-close') !== null;
    }
    // Post result back to page context
    window.postMessage({ type: 'speedreader-test-result', data: result }, '*');
  }

  if (event.data.type === 'speedreader-test-click') {
    if (overlay && overlay.shadow) {
      var btn = overlay.shadow.querySelector(event.data.selector);
      if (btn) btn.click();
    }
  }

  if (event.data.type === 'speedreader-test-next') {
    if (overlay) overlay.nextSentence();
  }
});

// Listen for messages from background script
browser.runtime.onMessage.addListener(function(message, _sender, sendResponse) {
  if (message.action === 'toggle-reader') {
    getOverlay().then(function(reader) {
      if (reader.host) {
        reader.close();
      } else {
        extractAndLaunch();
      }
    }).catch(function(err) {
      console.error('[SpeedReader] toggle-reader failed:', err);
      showToast('Something went wrong. Try reloading the page.');
    });
  }

  if (message.action === 'get-state') {
    var state = { overlayOpen: false };
    if (overlay && overlay.host) {
      state.overlayOpen = true;
      state.isPlaying = overlay.state.isPlaying;
      state.wordCount = overlay.state.words.length;
      state.currentIndex = overlay.state.currentIndex;
      state.wpm = overlay.state.wpm;
    }
    sendResponse(state);
  }
});
