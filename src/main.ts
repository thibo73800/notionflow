import { NotionAPI } from './notion';
import { showLoader, hideLoader, addUserMessage, addChatGPTMessage, updateChatGPTMessage, clearInput, handleError } from './uiux';
import { getCurrentNotionPageId, clearConversation, saveLastNotionPageId, getLastNotionPageId, getApiKeys } from './utils';
import { ChatGPT } from './chatgpt';

const sendButton = document.getElementById('send')!;
const resetButton = document.getElementById('reset')!;
const runButton = document.getElementById('run')!;
const settingsLink = document.getElementById('settings-link')!;
const overlay = document.getElementById('overlay')!;

if (sendButton) {
    sendButton.addEventListener('click', handleSendClick);
}
if (resetButton) {
    resetButton.addEventListener('click', handleResetClick);
}
if (runButton) {
    runButton.addEventListener('click', handleRunClick);
}

let chatGPT: ChatGPT;
let notionAPI: NotionAPI;
let isFirstMessage: boolean = true;

document.addEventListener('DOMContentLoaded', async function() {
    const loaderElement = document.getElementById('loader')!;
    const buttonSend = document.getElementById('send')!;
    const buttonRun = document.getElementById('run')!;

    const apiKeys = await getApiKeys();
    console.log("apiKeys", apiKeys);
    if ((!apiKeys.chatgptApiKey || !apiKeys.notionApiKey) && overlay) {
        // Show overlay if API keys are missing
        overlay.classList.remove('hidden');
        return;
    } else if (!apiKeys.chatgptApiKey || !apiKeys.notionApiKey) {
        return;
    }
    overlay.classList.add('hidden');

    chatGPT = new ChatGPT(apiKeys.chatgptApiKey);
    notionAPI = new NotionAPI(apiKeys.notionApiKey);

    const currentPageId = await getCurrentNotionPageId();
    loadConversation(async function(conversation) {
        const lastPageId = await getLastNotionPageId();
        if (currentPageId !== lastPageId) {
            await handleResetClick();
            saveLastNotionPageId(currentPageId);
        }
        initializeConversationFlow(conversation);

        const pageId = await getCurrentNotionPageId();

        showLoader(loaderElement);
        notionAPI.setPageId(pageId);
        const notionContent = await notionAPI.fetchPageContent();
        console.log("notionContent", notionContent);
        hideLoader(loaderElement);

        buttonSend.style.display = 'inline-block';

        for (let page in notionContent["context"]) {
            chatGPT.addNotionContext(page, notionContent["context"][page]);
        }

        for (let page in notionContent["prompt"]) {
            chatGPT.addNotionContext(page, notionContent["prompt"][page]);
        }
        if (notionContent["prompt"].length > 0) {
            buttonRun.style.display = 'inline-block';
        }

        chatGPT.setBotSystem(notionContent["profile"]);
    });
});

function saveConversation(conversation: any) {
    chrome.storage.local.set({ conversation: conversation }, function() {
        console.log('Conversation saved.');
    });
}

function loadConversation(callback: (conversation: any[]) => void) {

    if (typeof chrome === 'undefined' || typeof chrome.storage === 'undefined') {
        console.warn('chrome.storage is not defined. Will use the default conversation.');
        callback([]);
        return;
    }

    chrome.storage.local.get(['conversation'], function(result: { conversation?: any[] }) {
        if (result.conversation) {
            callback(result.conversation);
        } else {
            callback([]);
        }
    });
}

function addMessageToConversation(message: { sender: string; content: string }) {
    loadConversation(function(conversation) {
        conversation.push(message);
        saveConversation(conversation);
    });
}

function initializeConversationFlow(conversation: any[]) {
    if (conversation.length !== 0) {
        isFirstMessage = false;
    }

    conversation.forEach(message => {
        displayMessage(message);
        chatGPT.messages.push({
            role: message.sender === 'user' ? 'user' : 'assistant',
            content: message.content
        });
    });
}

function displayMessage(message: { sender: string; content: string }) {
    if (message.sender === 'user') {
        addUserMessage(message.content);
    } else if (message.sender === 'chatgpt') {
        addChatGPTMessage(message.content);
    }
}

async function handleSendClick() {
    runButton.style.display = 'none';
    const inputElement = document.getElementById('input') as HTMLTextAreaElement;
    const chatElement = document.getElementById('chat')!;
    const loaderElement = document.getElementById('loader')!;

    if (!inputElement) {
        console.error('Input element not found');
        return;
    }

    const userInput = inputElement.value;
    if (!userInput.trim()) return;

    addUserMessage(userInput);
    addMessageToConversation({ sender: 'user', content: userInput });
    showLoader(loaderElement);
    clearInput(inputElement);

    try {
        chatGPT.addUserInput(userInput);
        let messageID: string | null = null;
        let totalChunk: string = "";
        const chatGPTResponse = await chatGPT.getChatGPTResponse(async (chunk) => {
            if (!messageID) {
                totalChunk = chunk;
                messageID = await addChatGPTMessage(chunk);
            } else {
                totalChunk += chunk;
                updateChatGPTMessage(messageID, totalChunk);
            }
        });
        addMessageToConversation({ sender: 'chatgpt', content: chatGPTResponse });
    } catch (error) {
        handleError(error as Error, chatElement);
    } finally {
        hideLoader(loaderElement);
    }
}

async function handleRunClick() {
    runButton.style.display = 'none';
    const chatElement = document.getElementById('chat')!;
    const loaderElement = document.getElementById('loader')!;


    const userMessage: string = chatGPT.getLastInput();
    addUserMessage(userMessage);
    addMessageToConversation({ sender: 'user', content: userMessage });

    showLoader(loaderElement);
    try {
        let messageID: string | null = null;
        let totalChunk: string = "";
        const chatGPTResponse = await chatGPT.getChatGPTResponse(async (chunk) => {
            if (!messageID) {
                totalChunk = chunk;
                messageID = await addChatGPTMessage(chunk);
            } else {
                totalChunk += chunk;
                updateChatGPTMessage(messageID, totalChunk);
            }
        });
        addMessageToConversation({ sender: 'chatgpt', content: totalChunk});
    } catch (error) {
        handleError(error as Error, chatElement);
    } finally {
        hideLoader(loaderElement);
    }
}

async function handleResetClick() {
    const chatElement = document.getElementById('chat')!;
    const loaderElement = document.getElementById('loader')!;

    showLoader(loaderElement);
    try {
        await clearConversation();
        chatElement.innerHTML = '';
        chatGPT.messages = [
            {
                role: "system",
                content: "You are a helpful assistant. Always answer in markdown."
            }
        ];
        isFirstMessage = true;
    } catch (error) {
        handleError(error as Error, chatElement);
    } finally {
        hideLoader(loaderElement);
    }
}