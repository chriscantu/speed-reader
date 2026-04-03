// Send toggle message to active tab when toolbar icon is clicked
browser.action.onClicked.addListener(async (tab) => {
  try {
    await browser.tabs.sendMessage(tab.id, { action: 'toggle-reader' });
  } catch (error) {
    console.error('[SpeedReader] Could not reach content script:', error);
    // Content script may not be injected on this page — inform user
    try {
      await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          var t = document.createElement('div');
          t.textContent = "Speed Reader can't run on this page.";
          t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:12px 20px;border-radius:10px;font-size:14px;z-index:2147483647;font-family:-apple-system,system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,0.3);';
          document.body.appendChild(t);
          setTimeout(function() { t.remove(); }, 4000);
        },
      });
    } catch (_) {
      // Truly restricted page (about:, safari-web-extension:) — nothing we can do
    }
  }
});

// Initialize default settings on install
browser.runtime.onInstalled.addListener(() => {
  browser.storage.sync.get({ wpm: null })
    .then((result) => {
      if (result.wpm === null) {
        return browser.storage.sync.set({
          wpm: 250,
          font: 'system',
          theme: 'system',
          fontSize: 42,
          punctuationPause: true,
        });
      }
    })
    .catch((error) => {
      console.error('[SpeedReader] Failed to initialize default settings:', error);
    });
});
