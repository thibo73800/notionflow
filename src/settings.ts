import { saveApiKeys, getApiKeys } from './utils';

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('api-form') as HTMLFormElement;
  const statusDiv = document.getElementById('status')!;
  const backLink = document.getElementById('back-link')!;

  // Load existing API keys
  const apiKeys = await getApiKeys();
  if (apiKeys.chatgptApiKey) {
    (document.getElementById('chatgpt-api-key') as HTMLInputElement).value = apiKeys.chatgptApiKey;
  }
  if (apiKeys.notionApiKey) {
    (document.getElementById('notion-api-key') as HTMLInputElement).value = apiKeys.notionApiKey;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const chatgptApiKey = (document.getElementById('chatgpt-api-key') as HTMLInputElement).value.trim();
    const notionApiKey = (document.getElementById('notion-api-key') as HTMLInputElement).value.trim();

    if (chatgptApiKey && notionApiKey) {
      await saveApiKeys(chatgptApiKey, notionApiKey);
      statusDiv.textContent = 'API keys saved successfully!';
      setTimeout(() => {
        statusDiv.textContent = '';
        window.location.href = 'popup.html'; // Redirect to popup
      }, 2000);
    } else {
      statusDiv.textContent = 'Please fill in both API keys.';
    }
  });

  backLink.addEventListener('click', () => {
    window.location.href = 'popup.html';
  });
});