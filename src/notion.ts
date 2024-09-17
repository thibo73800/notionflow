import axios from 'axios';
import { marked } from 'marked';
import { MarkdownConverter } from './markdown';

interface PageProperties {
    [key: string]: any; // Adjust this type based on the expected structure of page properties
}

interface Pages {
    context: { [key: string]: string };
    profile: string;
    prompt: string[];
}

class NotionAPI {
    notionToken: string;
    pageId: string | null;
    headers: { [key: string]: string };
    depth2item_count: { [key: number]: number };
    apiUrl: string;

    constructor(notionToken: string) {
        this.notionToken = notionToken;
        this.pageId = null; 
        this.headers = {
            'Authorization': `Bearer ${notionToken}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
        };
        this.depth2item_count = {};
        this.apiUrl = '';
    }

    setPageId(pageId: string) {
        this.pageId = pageId;
        this.apiUrl = `https://api.notion.com/v1/blocks/${pageId}/children`;
    }

    async fetchPageContent(): Promise<Pages> {
        try {
            const content = await this._fetchPageContentRecursive(this.pageId!, "Principle Page", true) as Pages;
            return content;
        } catch (error) {
            console.error('Error fetching Notion page content on page id: ', this.pageId, error);
            throw new Error('Failed to fetch Notion page content');
        }
    }

    async _fetchPageProperties(pageId: string): Promise<PageProperties | null> {
        try {
            const response = await axios.get(`https://api.notion.com/v1/pages/${pageId}`, { headers: this.headers });
            return response.data.properties; // Return the properties of the page
        } catch (error) {
            console.error('Error fetching Notion page properties:', error);
            return null; // Return null if there's an error
        }
    }

    async _fetchPageContentRecursive(
        pageId: string,
        pageTitle: string,
        is_page = false,
        pages: Pages = { context: {}, profile: "You are a helpful assistant. Always answer in markdown.", prompt: [] },
        pages_ids: string[] = [],
        depth = 1
    ): Promise<Pages | string>  {
        if (Object.keys(pages).length === 0) {
            pages = {
                context: {},
                profile: "You are a helpful assistant. Always answer in markdown.",
                prompt: []
            };
        }

        const content: string[] = [];

        if (depth === 1) {
            this.depth2item_count = {};
        }

        let page_type = "context";
        if (is_page) {
            console.info("pageId", pageId);

            if (pages_ids.includes(pageId)) {
                console.warn("pageId already in pages_ids", pageId);
                return pages;
            }
            pages_ids.push(pageId);

            const pageProperties = await this._fetchPageProperties(pageId);
            if (pageProperties && pageProperties["FlowExtType"]) {
                console.log("FlowExtType", pageProperties["FlowExtType"]);
                if (pageProperties["FlowExtType"].rich_text.length > 0) {
                    page_type = pageProperties["FlowExtType"].rich_text[0].plain_text;
                }
            }
            console.info("page_type", page_type);
        }

        let blocks: any[] = [];
        let startCursor: string | undefined = undefined;
        let hasMore = true;
    
        while (hasMore) {
            const response: any = await axios.get(`https://api.notion.com/v1/blocks/${pageId}/children`, {
                headers: this.headers,
                params: {
                    start_cursor: startCursor,
                    page_size: 100
                }
            });
    
            blocks = blocks.concat(response.data.results);
            hasMore = response.data.has_more;
            startCursor = response.data.next_cursor;
        }
    

        for (const block of blocks) {
            if (block.type === 'table') {
                console.log("table loading", block);
                const tableContent = await this._handleTable(block);
                content.push(tableContent);
            } else if (block[block.type] && block[block.type].rich_text && Array.isArray(block[block.type].rich_text)) {
                let joined_text = await this._handleRichText(block, depth);
                content.push(joined_text);

                for (let i = 0; i < block[block.type].rich_text.length; i++) {
                    let text = block[block.type].rich_text[i];
                    if (text && text.type === 'mention' && text.href) {
                        const blockId = text.href.split('/')[text.href.split('/').length - 1];
                        pages = await this._fetchPageContentRecursive(
                            blockId, "Attached href Page : " + text.plain_text, true, pages, pages_ids, 1) as Pages;
                    }
                }

                if (block.has_children) {
                    const subBlockContent = await this._fetchPageContentRecursive(
                        block.id, "", false, pages, pages_ids, depth + 1) as string;
                    content.push(subBlockContent);
                }
            } else if (block.type === 'column_list' || block.type === 'column') {
                console.log("column_list or column", block);
            } else if (block.type === 'divider') {
                content.push('------------------------------');
            } else if (block.type === 'child_page') {
                console.info("href _fetchPageContentRecursive", block.id);
                pages = await this._fetchPageContentRecursive(
                    block.id, "Attached Page: " + block.child_page.title, true, pages, pages_ids, 1) as Pages;
            } else {
                console.warn('Unexpected block type:', block);
            }
        }

        console.log("content", content);

        if (is_page && page_type === "context") {
            pages[page_type][pageTitle] = content.join('\n');
            return pages;
        } else if (is_page && page_type === "prompt") {
            pages[page_type].push(content.join('\n'));
            return pages;
        } else if (is_page && page_type === "profile") {
            pages[page_type] = content.join('\n');
            return pages;
        } else {
            return content.join('\n');
        }
    }

    async _handleRichText(block: any, depth: number): Promise<string> {
        if (block.type === 'numbered_list_item') {
            if (!this.depth2item_count[depth]) {
                this.depth2item_count[depth] = 1;
            }
            let prefix = '-'.repeat(depth);
            if (depth === 1) {
                prefix = '';
            }
            let result = `${prefix} ${this.depth2item_count[depth]}. ${this._getRichTextContent(block)}`;
            this.depth2item_count[depth]++;
            return result;
        } else {
            this.depth2item_count[depth] = 1;
        }

        if (block.type === 'bulleted_list_item') {
            let bulletPrefix = '-'.repeat(depth);
            return `${bulletPrefix} ${this._getRichTextContent(block)}`;
        }

        switch (block.type) {
            case 'table':
                return this._handleTable(block);
            case 'heading_1':
                return `# ${this._getRichTextContent(block)}`;
            case 'heading_2':
                return `## ${this._getRichTextContent(block)}`;
            case 'heading_3':
                return `### ${this._getRichTextContent(block)}`;
            case 'paragraph':
                return this._getRichTextContent(block);
            case 'to_do':
                return `- [${block.to_do.checked ? 'x' : ' '}] ${this._getRichTextContent(block)}`;
            case 'toggle':
                return `<details><summary>${this._getRichTextContent(block)}</summary></details>`;
            case 'code':
                return `\`\`\`\n${this._getRichTextContent(block)}\n\`\`\``;
            case 'quote':
                return `> ${this._getRichTextContent(block)}`;
            case 'callout':
                return `> ${this._getRichTextContent(block)}`;
            case 'image':
                return `![Image](${block.image.file.url})`;
            case 'video':
                return `[Video](${block.video.file.url})`;
            case 'file':
                return `[File](${block.file.file.url})`;
            case 'pdf':
                return `[PDF](${block.pdf.file.url})`;
            case 'bookmark':
                return `[Bookmark](${block.bookmark.url})`;
            case 'embed':
                return `[Embed](${block.embed.url})`;
            case 'link_preview':
                return `[Link Preview](${block.link_preview.url})`;
            case 'column_list':
            case 'column':
                return ''; // Handled recursively
            case 'child_page':
            case 'child_database':
                return ''; // Ignored
            default:
                console.warn('Unexpected block type:', block);
                return '';
        }
    }

    _getRichTextContent(block: any): string {
        let joined_text = '';
        for (let i = 0; i < block[block.type].rich_text.length; i++) {
            let text = block[block.type].rich_text[i];
            if (text) {
                if (text.type === 'text' && text.text.content) {
                    joined_text += this._applyMarkdown(text.text.content, text.annotations) + ' ';
                } else if (text.type === 'mention' && text.plain_text) {
                    joined_text += this._applyMarkdown(text.plain_text, text.annotations) + ' ';
                }
            }
        }
        return joined_text.trim();
    }

    _formatTableRows(rows: any[], tableWidth: number, hasColumnHeader: boolean, hasRowHeader: boolean): string {
        let markdown = '';
        let headerRow = '';
    
        rows.forEach((row, rowIndex) => {
            if (row.type !== 'table_row') return;
    
            let rowContent = '|';
            row.table_row.cells.forEach((cell: any[], cellIndex: number) => {
                const cellContent = cell.map(textObj => textObj.plain_text).join(' ');
                rowContent += ` ${cellContent} |`;
    
                if (rowIndex === 0 && hasColumnHeader) {
                    headerRow += '| ' + '-'.repeat(cellContent.length) + ' ';
                }
            });
    
            markdown += rowContent + '\n';
    
            if (rowIndex === 0 && hasColumnHeader) {
                markdown += headerRow + '|\n';
            }
        });
    
        return markdown;
    }

    async _fetchTableRows(blockId: string): Promise<any[]> {
        try {
            const response = await axios.get(`https://api.notion.com/v1/blocks/${blockId}/children`, { headers: this.headers });
            return response.data.results;
        } catch (error) {
            console.error('Error fetching table rows:', error);
            return [];
        }
    }
    
    async _handleTable(block: any): Promise<string> {
        const tableWidth = block.table.table_width;
        const hasColumnHeader = block.table.has_column_header;
        const hasRowHeader = block.table.has_row_header;
    
        const rows = await this._fetchTableRows(block.id);
        return this._formatTableRows(rows, tableWidth, hasColumnHeader, hasRowHeader);
    }

    _applyMarkdown(content: string, annotations: any): string {
        if (annotations.bold) content = `**${content}**`;
        if (annotations.italic) content = `*${content}*`;
        if (annotations.strikethrough) content = `~~${content}~~`;
        if (annotations.underline) content = `<u>${content}</u>`;
        if (annotations.code) content = `\`${content}\``;
        return content;
    }


    async _fetchPageTitle(pageId: string): Promise<string> {
        try {
            const response = await axios.get(`https://api.notion.com/v1/pages/${pageId}`, { headers: this.headers });
            const titleProperty = response.data.properties.title;
            if (titleProperty && titleProperty.title && titleProperty.title.length > 0) {
                return titleProperty.title[0].plain_text;
            }
            return "Untitled Sub-Page";
        } catch (error) {
            console.error('Error fetching Notion page title:', error);
            return "Untitled Sub-Page";
        }
    }

    async addMarkdownBlock(markdownContent: string): Promise<string> {
        const htmlContent = marked.parse(markdownContent); // Use marked.parse
        const notionBlocks = MarkdownConverter.convertHtmlToNotionBlocks(htmlContent as string);

        try {
            const response = await axios.patch(this.apiUrl, {
                children: notionBlocks
            }, {
                headers: this.headers
            });

            console.log('Notion API response:', response.data);
            return 'Markdown content added to Notion page!';
        } catch (error) {
            console.error('Error adding block to Notion:', error as Error); // Cast error to Error type
            return 'Error writing to Notion: ' + (error instanceof Error ? error.message : 'Unknown error'); // Check if error is an instance of Error
        }
    }
}

export { NotionAPI };
