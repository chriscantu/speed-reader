// Send toggle message to active tab when toolbar icon is clicked
browser.action.onClicked.addListener(async (tab) => {
  try {
    await browser.tabs.sendMessage(tab.id, { action: 'toggle-reader' });
  } catch (error) {
    console.error('[SpeedReader] Could not reach content script:', error);
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
    } catch (innerErr) {
      console.warn('[SpeedReader] Cannot inject toast (restricted page):', innerErr.message);
    }
  }
});

// Sync settings from native App Group UserDefaults to browser.storage.sync.
// This bridges the SwiftUI settings app with the web extension.
async function syncSettingsFromNative() {
  try {
    var response = await browser.runtime.sendNativeMessage(
      'application.id',
      { action: 'getSettings' }
    );
    if (response && response.wpm !== undefined) {
      await browser.storage.sync.set(response);
      console.log('[SpeedReader] Settings synced from native app');
    }
  } catch (error) {
    console.error('[SpeedReader] Failed to sync native settings:', error);
    // Not fatal — extension will use browser.storage.sync defaults
  }
}

// Initialize default settings on install, then sync from native
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
    .then(() => syncSettingsFromNative())
    .catch((error) => {
      console.error('[SpeedReader] Failed to initialize settings:', error);
    });
});

// Sync settings from native app whenever the service worker starts
syncSettingsFromNative();

// Test hook — allows querying overlay state from native handler
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'test-get-state') {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]) {
        return browser.tabs.sendMessage(tabs[0].id, { action: 'get-state' });
      }
      return { error: 'No active tab' };
    }).then(sendResponse).catch(() => sendResponse({ error: 'Could not reach content script' }));
    return true; // async response
  }
});
