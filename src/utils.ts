

async function getCurrentNotionPageId(): Promise<string> {
    return new Promise((resolve, reject) => {

        if (typeof chrome === 'undefined' || typeof chrome.runtime === 'undefined') {
            console.warn('chrome.runtime is not defined. Will use the default page ID.');
            // https://www.notion.so/Plato-s-World-PA-de62e481c3a84889bd9ab5e000b360d8
            // Used the above by default
            resolve('de62e481c3a84889bd9ab5e000b360d8');
        }

        chrome.runtime.sendMessage({ request: 'getNotionUrl' }, (response) => {
            console.log('received response', response);
            if (chrome.runtime.lastError) {
                return reject(new Error(chrome.runtime.lastError.message));
            }

            const notionUrl = response.notionUrl;
            const match = notionUrl.match(/([a-f0-9]{32})/);
            if (match) {
                resolve(match[1]);
            } else {
                reject(new Error('Page ID not found in the URL'));
            }
        });
    });
}

async function clearConversation() {
    return new Promise((resolve, reject) => {

        if (typeof chrome === 'undefined' || typeof chrome.storage === 'undefined') {
            console.warn('chrome.storage is not defined. Will use the default conversation.');
            resolve(null);
        }

        chrome.storage.local.set({ conversation: [] }, function() {
            if (chrome.runtime.lastError) {
                return reject(new Error(chrome.runtime.lastError.message));
            }
            resolve(void 0);
        });
    });
}

function saveLastNotionPageId(pageId: string) {


    if (typeof chrome === 'undefined' || typeof chrome.storage === 'undefined') {
        console.warn('chrome.storage is not defined. Will use the default page ID.');
        return;
    }

    chrome.storage.local.set({ lastNotionPageId: pageId }, function() {
        console.log('Last Notion page ID saved.');
    });
}

function getLastNotionPageId() {
    return new Promise((resolve, reject) => {

        if (typeof chrome === 'undefined' || typeof chrome.storage === 'undefined') {
            console.warn('chrome.storage is not defined. Will use the default page ID.');
            resolve(null);
        }

        chrome.storage.local.get(['lastNotionPageId'], function(result) {
            if (chrome.runtime.lastError) {
                return reject(new Error(chrome.runtime.lastError.message));
            }
            resolve(result.lastNotionPageId || null);
        });
    });
}

export async function saveApiKeys(chatgptApiKey: string, notionApiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || typeof chrome.storage === 'undefined') {
      console.warn('chrome.storage is not defined. API keys not saved.');
      resolve();
      return;
    }

    chrome.storage.local.set({ chatgptApiKey, notionApiKey }, () => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      resolve();
    });
  });
}

export async function getApiKeys(): Promise<{ chatgptApiKey?: string; notionApiKey?: string }> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || typeof chrome.storage === 'undefined') {
      console.warn('chrome.storage is not defined. Using default API keys.');
      resolve({});
      return;
    }

    chrome.storage.local.get(['chatgptApiKey', 'notionApiKey'], (result) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      resolve(result);
    });
  });
}

export { getCurrentNotionPageId, clearConversation, saveLastNotionPageId, getLastNotionPageId };