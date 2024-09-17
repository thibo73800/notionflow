chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.request === 'getNotionUrl') {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
          var notionUrl = tabs[0].url;
          sendResponse({ notionUrl });
      });
      return true; // Keep the message channel open for sendResponse
  }
});

const NOTION_ORIGIN = 'https://www.notion.so';

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!tab.url) return;
  const url = new URL(tab.url);
  // Enables the side panel on google.com
  if (url.origin === NOTION_ORIGIN) {
    await chrome.sidePanel.setOptions({
      tabId,
      path: 'popup.html',
      enabled: true
    });
  } else {
    await chrome.sidePanel.setOptions({
      tabId,
      enabled: false
    });
  }
});


chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));
