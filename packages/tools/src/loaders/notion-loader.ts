import type { Document } from '@orka-js/core';
import type { DocumentLoader, NotionLoaderOptions } from './types.js';
import { generateId } from '@orka-js/core';

interface NotionBlock {
  id: string;
  type: string;
  [key: string]: unknown;
}

interface NotionPage {
  id: string;
  properties: Record<string, unknown>;
  url?: string;
}

export class NotionLoader implements DocumentLoader {
  private options: NotionLoaderOptions;
  private baseUrl = 'https://api.notion.com/v1';

  constructor(options: NotionLoaderOptions) {
    if (!options.apiKey) {
      throw new Error('NotionLoader requires an apiKey');
    }
    this.options = {
      recursive: false,
      includeChildPages: false,
      maxDepth: 3,
      ...options,
    };
  }

  async load(): Promise<Document[]> {
    const documents: Document[] = [];

    if (this.options.pageIds?.length) {
      for (const pageId of this.options.pageIds) {
        const pageDocs = await this.loadPage(pageId, 0);
        documents.push(...pageDocs);
      }
    }

    if (this.options.databaseIds?.length) {
      for (const databaseId of this.options.databaseIds) {
        const dbDocs = await this.loadDatabase(databaseId);
        documents.push(...dbDocs);
      }
    }

    return documents;
  }

  private async loadPage(pageId: string, depth: number): Promise<Document[]> {
    const documents: Document[] = [];

    try {
      const page = await this.fetchPage(pageId);
      const blocks = await this.fetchBlocks(pageId);
      const content = this.blocksToText(blocks);
      const title = this.extractTitle(page);

      documents.push({
        id: generateId(),
        content,
        metadata: {
          ...this.options.metadata,
          source: `notion://page/${pageId}`,
          loader: 'NotionLoader',
          notionPageId: pageId,
          title,
          url: page.url,
        },
      });

      if (this.options.includeChildPages && depth < (this.options.maxDepth ?? 3)) {
        const childPages = this.extractChildPages(blocks);
        for (const childId of childPages) {
          const childDocs = await this.loadPage(childId, depth + 1);
          documents.push(...childDocs);
        }
      }
    } catch (error) {
      console.warn(`Failed to load Notion page ${pageId}:`, error);
    }

    return documents;
  }

  private async loadDatabase(databaseId: string): Promise<Document[]> {
    const documents: Document[] = [];

    try {
      const pages = await this.queryDatabase(databaseId);

      for (const page of pages) {
        const blocks = await this.fetchBlocks(page.id);
        const content = this.blocksToText(blocks);
        const title = this.extractTitle(page);
        const properties = this.extractProperties(page);

        documents.push({
          id: generateId(),
          content,
          metadata: {
            ...this.options.metadata,
            source: `notion://database/${databaseId}/page/${page.id}`,
            loader: 'NotionLoader',
            notionPageId: page.id,
            notionDatabaseId: databaseId,
            title,
            url: page.url,
            ...properties,
          },
        });
      }
    } catch (error) {
      console.warn(`Failed to load Notion database ${databaseId}:`, error);
    }

    return documents;
  }

  private async fetchPage(pageId: string): Promise<NotionPage> {
    const response = await fetch(`${this.baseUrl}/pages/${pageId}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Notion API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<NotionPage>;
  }

  private async fetchBlocks(blockId: string): Promise<NotionBlock[]> {
    const blocks: NotionBlock[] = [];
    let cursor: string | undefined;

    do {
      const url = new URL(`${this.baseUrl}/blocks/${blockId}/children`);
      if (cursor) url.searchParams.set('start_cursor', cursor);

      const response = await fetch(url.toString(), {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Notion API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { results: NotionBlock[]; next_cursor?: string; has_more: boolean };
      blocks.push(...data.results);
      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);

    return blocks;
  }

  private async queryDatabase(databaseId: string): Promise<NotionPage[]> {
    const pages: NotionPage[] = [];
    let cursor: string | undefined;

    do {
      const response = await fetch(`${this.baseUrl}/databases/${databaseId}/query`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(cursor ? { start_cursor: cursor } : {}),
      });

      if (!response.ok) {
        throw new Error(`Notion API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { results: NotionPage[]; next_cursor?: string; has_more: boolean };
      pages.push(...data.results);
      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);

    return pages;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.options.apiKey}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    };
  }

  private blocksToText(blocks: NotionBlock[]): string {
    const lines: string[] = [];

    for (const block of blocks) {
      const text = this.blockToText(block);
      if (text) lines.push(text);
    }

    return lines.join('\n\n');
  }

  private blockToText(block: NotionBlock): string {
    const type = block.type;
    const content = block[type] as Record<string, unknown> | undefined;

    if (!content) return '';

    switch (type) {
      case 'paragraph':
      case 'heading_1':
      case 'heading_2':
      case 'heading_3':
      case 'bulleted_list_item':
      case 'numbered_list_item':
      case 'quote':
      case 'callout':
      case 'toggle':
        return this.extractRichText(content.rich_text as Array<{ plain_text: string }> | undefined);

      case 'code':
        const code = this.extractRichText(content.rich_text as Array<{ plain_text: string }> | undefined);
        const language = content.language as string || '';
        return `\`\`\`${language}\n${code}\n\`\`\``;

      case 'to_do':
        const checked = content.checked ? '☑' : '☐';
        const todoText = this.extractRichText(content.rich_text as Array<{ plain_text: string }> | undefined);
        return `${checked} ${todoText}`;

      case 'divider':
        return '---';

      case 'table_of_contents':
      case 'breadcrumb':
      case 'column_list':
      case 'column':
        return '';

      default:
        return '';
    }
  }

  private extractRichText(richText: Array<{ plain_text: string }> | undefined): string {
    if (!richText || !Array.isArray(richText)) return '';
    return richText.map(t => t.plain_text).join('');
  }

  private extractTitle(page: NotionPage): string {
    const properties = page.properties || {};

    for (const [, value] of Object.entries(properties)) {
      const prop = value as { type: string; title?: Array<{ plain_text: string }> };
      if (prop.type === 'title' && prop.title) {
        return this.extractRichText(prop.title);
      }
    }

    return 'Untitled';
  }

  private extractProperties(page: NotionPage): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const properties = page.properties || {};

    for (const [key, value] of Object.entries(properties)) {
      const prop = value as { type: string; [key: string]: unknown };
      const extracted = this.extractPropertyValue(prop);
      if (extracted !== undefined) {
        result[`notion_${key}`] = extracted;
      }
    }

    return result;
  }

  private extractPropertyValue(prop: { type: string; [key: string]: unknown }): unknown {
    switch (prop.type) {
      case 'title':
      case 'rich_text':
        return this.extractRichText(prop[prop.type] as Array<{ plain_text: string }> | undefined);
      case 'number':
        return prop.number;
      case 'select':
        return (prop.select as { name: string } | null)?.name;
      case 'multi_select':
        return (prop.multi_select as Array<{ name: string }>)?.map(s => s.name);
      case 'date':
        return (prop.date as { start: string } | null)?.start;
      case 'checkbox':
        return prop.checkbox;
      case 'url':
        return prop.url;
      case 'email':
        return prop.email;
      case 'phone_number':
        return prop.phone_number;
      default:
        return undefined;
    }
  }

  private extractChildPages(blocks: NotionBlock[]): string[] {
    const childPageIds: string[] = [];

    for (const block of blocks) {
      if (block.type === 'child_page') {
        childPageIds.push(block.id);
      }
    }

    return childPageIds;
  }
}
