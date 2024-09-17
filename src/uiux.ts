import { marked } from 'marked';
import { NotionAPI } from './notion';

async function addUserMessage(message: string):  Promise<string> {
    return addMessageToChat('user', message);
}

async function addChatGPTMessage(message: string):  Promise<string> {
    return addMessageToChat('chatgpt', message, true);
}

// await updateChatGPTMessage(messageID, totalChunk);
async function updateChatGPTMessage(messageID: string, totalChunk: string): Promise<void> {
    const messageElement = document.getElementById(messageID) as HTMLElement;
    messageElement.innerText = totalChunk;

    // Make sure the markdown is rendered
    if (typeof marked !== 'undefined') {
        messageElement.innerHTML = await marked(totalChunk);
    } else {
        console.error('marked is not defined');
        messageElement.innerText = totalChunk;
    }
}

function showLoader(loaderElement: HTMLElement): void {
    loaderElement.classList.remove('hidden');
}

function hideLoader(loaderElement: HTMLElement): void {
    loaderElement.classList.add('hidden');
}

function clearInput(inputElement: HTMLTextAreaElement): void {
    inputElement.value = '';
}

async function addMessageToChat(sender: 'user' | 'chatgpt', message: string, isMarkdown: boolean = false): Promise<string> {
    const chatElement = document.getElementById('chat') as HTMLElement;
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender);

    // Generate a unique ID for the message element
    const messageId = `message-${Date.now()}`;
    messageElement.id = messageId;

    if (isMarkdown) {
        if (typeof marked !== 'undefined') {
            messageElement.innerHTML = await marked(message); // Await the promise
        } else {
            console.error('marked is not defined');
            messageElement.innerText = message;
        }
    } else {
        messageElement.innerText = message;
    }

    chatElement.appendChild(messageElement);

    if (sender === 'chatgpt') {
        const actionContainer = document.createElement('div');
        actionContainer.classList.add('action-container');

        const insertButton = document.createElement('button');
        insertButton.classList.add('action-button');
        insertButton.innerText = 'Insert into Notion';
        insertButton.onclick = async () => {
            await addMarkdownToNotion(message);
        };

        actionContainer.appendChild(insertButton);
        chatElement.appendChild(actionContainer);
    }

    setTimeout(() => scrollToBottom(chatElement), 0);

    // Return the ID of the new message bubble
    return messageId;
}

function scrollToBottom(element: HTMLElement): void {
    element.scrollTop = element.scrollHeight;
}

async function addMarkdownToNotion(chatGPTResponse: string): Promise<void> {
    // const notionAPI = new NotionAPI(notionToken);
    // await notionAPI.addMarkdownBlock(chatGPTResponse);
}

function handleError(error: Error, chatElement: HTMLElement): void {
    console.error('Error in event listener:', error);
    //addMessageToChat('error', 'Error: ' + (error.message || 'An unknown error occurred'));
}

export { updateChatGPTMessage, addUserMessage, addChatGPTMessage, showLoader, hideLoader, clearInput, addMarkdownToNotion, handleError };