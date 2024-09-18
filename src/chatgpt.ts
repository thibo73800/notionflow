class ChatGPT {
    apiKey: string;
    apiUrl: string;
    messages: Array<{ role: string; content: string }>;
    maxTokens: number;
    charsPerToken: number;
    botSystem: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.apiUrl = 'https://api.openai.com/v1/chat/completions';
        this.messages = [];
        this.maxTokens = 128000; // Set the maximum number of tokens for the model
        this.charsPerToken = 4; // Approximate number of characters per token
        this.botSystem = "You are a helpful assistant that can answer questions and help with tasks. Always answer in full Markdown format.";
    }

    setBotSystem(system: string) {
        this.botSystem = system;
    }

    addNotionContext(pageTitle: string, notionContent: string) {
        this.messages.push({
            role: "user",
            content: `${pageTitle} \n${notionContent}`
        });
    }

    addUserInput(userInput: string) {
        this.messages.push({
            role: "user",
            content: `${userInput}`
        });
    }

    getLastInput(): string {
        return this.messages[this.messages.length - 1].content;
    }

    estimateTokenCount(): number {
        const allMessages = this.messages.map(msg => msg.content).join(' ');
        const charCount = allMessages.length;
        return Math.ceil(charCount / this.charsPerToken);
    }

    async getChatGPTResponse(onChunk: (chunk: string) => void): Promise<string> {
        const currentTokenCount = this.estimateTokenCount();
        const tokenUsagePercentage = (currentTokenCount / this.maxTokens) * 100;
        console.log(`Current token usage: ${currentTokenCount} tokens (${tokenUsagePercentage.toFixed(2)}% of max tokens)`);

        console.log("currentTokenCount", currentTokenCount);

        if (currentTokenCount > this.maxTokens) {
            throw new Error('Prompt exceeds the maximum token limit');
        }

        console.log("this.messages", this.botSystem);
        // prepare messages with system prompt
        let final_messages = [
            {
                role: "system",
                content: this.botSystem
            }
        ];

        console.log("final_messages", final_messages);
        final_messages = final_messages.concat(this.messages);
        console.log("final_messages", final_messages);

        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                stream: true,
                messages: final_messages
            })
        });

        if (!response.ok) {
            console.log(response);
            throw new Error('Failed to fetch ChatGPT response');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let assistantMessage = '';

        while (true) {
            const { done, value } = await reader?.read() ?? { done: true, value: undefined };
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonData = line.slice(6);
                    if (jsonData === '[DONE]') break;
                    try {
                        const parsedData = JSON.parse(jsonData);
                        const content = parsedData.choices[0]?.delta?.content;
                        if (content) {
                            assistantMessage += content;
                            onChunk(content); // Call the callback with each new chunk
                        }
                    } catch (error) {
                        console.error('Error parsing JSON:', error);
                    }
                }
            }
        }

        console.warn("assistantMessage", assistantMessage);

        this.messages.push({
            role: "assistant",
            content: assistantMessage
        });

        return assistantMessage;
    }
}

export { ChatGPT };