import { RSVPOverlay } from './rsvp/overlay.js';

const overlay = new RSVPOverlay();
let pendingSelectionMode = false;

async function extractAndLaunch() {
  const selection = window.getSelection();
  if (selection && selection.toString().trim().length > 0) {
    const text = selection.toString().trim();
    overlay.open(text, document.title, await getSettings());
    pendingSelectionMode = false;
    return;
  }

  if (pendingSelectionMode) {
    showToast('Select some text on the page, then tap the extension icon again.');
    return;
  }

  try {
    const { Readability } = await import(browser.runtime.getURL('lib/Readability.js'));
    const docClone = document.cloneNode(true);
    const reader = new Readability(docClone);
    const article = reader.parse();

    if (article && article.textContent && article.textContent.trim().length > 0) {
      const settings = await getSettings();
      overlay.open(article.textContent.trim(), article.title || document.title, settings);
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
  } catch {
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
  toast.style.cssText = `
    position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
    background: #333; color: #fff; padding: 12px 20px; border-radius: 10px;
    font-size: 14px; z-index: 2147483647; font-family: -apple-system, system-ui, sans-serif;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

browser.runtime.onMessage.addListener((message) => {
  if (message.action === 'toggle-reader') {
    if (overlay.host) {
      overlay.close();
    } else {
      extractAndLaunch();
    }
  }
});
