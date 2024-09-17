chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.request === 'getNotionUrl') {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
          console.log('tabs:', tabs);
          var notionUrl = tabs[0].url;
          console.log('Notion URL:', notionUrl);
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
  console.log('url.origin:', url.origin);
  console.log('NOTION_ORIGIN:', NOTION_ORIGIN);
  if (url.origin === NOTION_ORIGIN) {
    console.log('enabling side panel');
    await chrome.sidePanel.setOptions({
      tabId,
      path: 'popup.html',
      enabled: true
    });
  } else {
    console.log('disabling side panel');
    await chrome.sidePanel.setOptions({
      tabId,
      enabled: false
    });
  }
});


chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));
