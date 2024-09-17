class MarkdownConverter {
    static convertHtmlToNotionBlocks(htmlContent: string): any[] {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const blocks: any[] = [];

        doc.body.childNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) { // Check if node is an HTMLElement
                const element = node as HTMLElement; // Type assertion
                if (element.nodeName === 'P') {
                    blocks.push(this.createParagraphBlock(element.textContent || ''));
                } else if (element.nodeName.startsWith('H')) {
                    let level = parseInt(element.nodeName.charAt(1));
                    if (!isNaN(level)) {
                        level = level > 3 ? 3 : level;
                        level = level < 1 ? 1 : level;
                        blocks.push(this.createHeadingBlock(level, element.textContent || ''));
                    }
                } else if (element.nodeName === 'UL' || element.nodeName === 'OL') {
                    blocks.push(...this.createListBlocks(element));
                } else if (element.nodeName === 'BLOCKQUOTE') {
                    blocks.push(this.createBlockquoteBlock(element.textContent || ''));
                } else if (element.nodeName === 'PRE') {
                    blocks.push(this.createCodeBlock(element.textContent || ''));
                } else if (element.nodeName === 'HR') {
                    blocks.push(this.createDividerBlock());
                } else if (element.nodeName === 'TABLE') {
                    blocks.push(...this.createTableBlocks(element));
                } else if (element.nodeName === '#text') {
                    if (element.textContent?.trim() !== '') {
                        blocks.push(this.createParagraphBlock(element.textContent || ''));
                    }
                } else {
                    console.warn('Unsupported HTML element:', element.nodeName);
                }
            }
        });

        console.log('Blocks:', blocks);

        return blocks;
    }

    static createParagraphBlock(text: string) {
        return {
            object: 'block',
            type: 'paragraph',
            paragraph: {
                rich_text: [{
                    type: 'text',
                    text: {
                        content: text
                    }
                }]
            }
        };
    }

    static createHeadingBlock(level: number, text: string) {
        return {
            object: 'block',
            type: `heading_${level}`,
            [`heading_${level}`]: {
                rich_text: [{
                    type: 'text',
                    text: {
                        content: text
                    }
                }]
            }
        };
    }

    static createListBlocks(node: HTMLElement) {
        const blocks: any[] = [];
        node.childNodes.forEach(item => {
            if (item.nodeName === 'LI') {
                blocks.push({
                    object: 'block',
                    type: 'bulleted_list_item',
                    bulleted_list_item: {
                        rich_text: [{
                            type: 'text',
                            text: {
                                content: item.textContent || ''
                            }
                        }]
                    }
                });
            }
        });
        return blocks;
    }

    static createBlockquoteBlock(text: string) {
        return {
            object: 'block',
            type: 'quote',
            quote: {
                rich_text: [{
                    type: 'text',
                    text: {
                        content: text
                    }
                }]
            }
        };
    }

    static createCodeBlock(text: string) {
        return {
            object: 'block',
            type: 'code',
            code: {
                rich_text: [{
                    type: 'text',
                    text: {
                        content: text
                    }
                }],
                language: 'plain text'
            }
        };
    }

    static createDividerBlock() {
        return {
            object: 'block',
            type: 'divider',
            divider: {}
        };
    }

    static createTableBlocks(node: HTMLElement) {
        const rows = Array.from(node.querySelectorAll('tr'));
        const tableBlocks = rows.map(row => {
            const cells = Array.from(row.querySelectorAll('th, td')).map(cell => ({
                type: 'text',
                text: {
                    content: cell.textContent || ''
                }
            }));
            return {
                object: 'block',
                type: 'table_row',
                table_row: {
                    cells: [cells]
                }
            };
        });
        return [{
            object: 'block',
            type: 'table',
            table: {
                table_width: rows[0].children.length,
                has_column_header: true,
                has_row_header: false,
                children: tableBlocks
            }
        }];
    }
}

export { MarkdownConverter };
