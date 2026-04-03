// Content script — runs as classic script (not ES module) in Safari.
// Uses dynamic import() to load ES module dependencies.

let overlay = null;
let pendingSelectionMode = false;

async function getOverlay() {
  if (overlay) return overlay;
  const overlayModule = await import(browser.runtime.getURL('rsvp/overlay.js'));
  overlay = new overlayModule.RSVPOverlay();
  return overlay;
}

async function extractAndLaunch() {
  const reader = await getOverlay();

  // Check for user text selection first
  const selection = window.getSelection();
  if (selection && selection.toString().trim().length > 0) {
    const text = selection.toString().trim();
    reader.open(text, document.title, await getSettings());
    pendingSelectionMode = false;
    return;
  }

  // If we're in selection fallback mode, remind user to select text
  if (pendingSelectionMode) {
    showToast('Select some text on the page, then tap the extension icon again.');
    return;
  }

  try {
    const readabilityModule = await import(browser.runtime.getURL('lib/Readability.js'));
    const Readability = readabilityModule.Readability;

    // Clone the document so Readability doesn't mutate the live DOM
    const docClone = document.cloneNode(true);
    const article = new Readability(docClone).parse();

    if (article && article.textContent && article.textContent.trim().length > 0) {
      const settings = await getSettings();
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

async function getSettings() {
  try {
    const stored = await browser.storage.sync.get({
      wpm: 250,
      font: 'system',
      theme: 'system',
      fontSize: 42,
      punctuationPause: true,
    });
    return stored;
  } catch (e) {
    return {
      wpm: 250,
      font: 'system',
      theme: 'system',
      fontSize: 42,
      punctuationPause: true,
    };
  }
}

function showToast(message) {
  const existing = document.querySelector('.speed-reader-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
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

// Listen for messages from background script
browser.runtime.onMessage.addListener(function(message) {
  if (message.action === 'toggle-reader') {
    getOverlay().then(function(reader) {
      if (reader.host) {
        reader.close();
      } else {
        extractAndLaunch();
      }
    });
  }
});
