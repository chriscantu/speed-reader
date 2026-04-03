// Send toggle message to active tab when toolbar icon is clicked
browser.action.onClicked.addListener(async (tab) => {
  try {
    await browser.tabs.sendMessage(tab.id, { action: 'toggle-reader' });
  } catch (error) {
    console.error('[SpeedReader] Could not reach content script:', error);
  }
});

// Initialize default settings on install
browser.runtime.onInstalled.addListener(() => {
  browser.storage.sync.get({
    wpm: null,
  }).then((result) => {
    if (result.wpm === null) {
      browser.storage.sync.set({
        wpm: 250,
        font: 'system',
        theme: 'system',
        fontSize: 42,
        punctuationPause: true,
      });
    }
  });
});
