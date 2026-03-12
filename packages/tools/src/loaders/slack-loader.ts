import type { Document } from '@orka-js/core';
import type { DocumentLoader, SlackLoaderOptions } from './types.js';
import { generateId } from '@orka-js/core';

interface SlackMessage {
  ts: string;
  text: string;
  user?: string;
  thread_ts?: string;
  reply_count?: number;
  files?: Array<{ name: string; url_private: string; mimetype: string }>;
}

interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_private: boolean;
}

export class SlackLoader implements DocumentLoader {
  private options: SlackLoaderOptions;
  private baseUrl = 'https://slack.com/api';

  constructor(options: SlackLoaderOptions) {
    if (!options.token) {
      throw new Error('SlackLoader requires a token');
    }
    this.options = {
      includeThreads: true,
      includeFiles: false,
      limit: 1000,
      ...options,
    };
  }

  async load(): Promise<Document[]> {
    const documents: Document[] = [];
    const channelIds = this.options.channelIds ?? await this.listChannels();

    for (const channelId of channelIds) {
      const channelDocs = await this.loadChannel(channelId);
      documents.push(...channelDocs);
    }

    return documents;
  }

  private async listChannels(): Promise<string[]> {
    const response = await this.slackRequest('conversations.list', {
      types: 'public_channel,private_channel',
      limit: '200',
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.error}`);
    }

    return (response.channels as SlackChannel[]).map(c => c.id);
  }

  private async loadChannel(channelId: string): Promise<Document[]> {
    const documents: Document[] = [];

    try {
      const channelInfo = await this.getChannelInfo(channelId);
      const messages = await this.fetchMessages(channelId);

      for (const message of messages) {
        if (!message.text) continue;

        const content = await this.buildMessageContent(message, channelId);

        documents.push({
          id: generateId(),
          content,
          metadata: {
            ...this.options.metadata,
            source: `slack://channel/${channelId}/message/${message.ts}`,
            loader: 'SlackLoader',
            slackChannelId: channelId,
            slackChannelName: channelInfo.name,
            slackMessageTs: message.ts,
            slackUserId: message.user,
            timestamp: new Date(parseFloat(message.ts) * 1000).toISOString(),
            hasThread: !!message.reply_count,
            replyCount: message.reply_count ?? 0,
          },
        });
      }
    } catch (error) {
      console.warn(`Failed to load Slack channel ${channelId}:`, error);
    }

    return documents;
  }

  private async getChannelInfo(channelId: string): Promise<SlackChannel> {
    const response = await this.slackRequest('conversations.info', {
      channel: channelId,
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.error}`);
    }

    return response.channel as SlackChannel;
  }

  private async fetchMessages(channelId: string): Promise<SlackMessage[]> {
    const messages: SlackMessage[] = [];
    let cursor: string | undefined;
    let fetched = 0;
    const limit = this.options.limit ?? 1000;

    const params: Record<string, string> = {
      channel: channelId,
      limit: '200',
    };

    if (this.options.startDate) {
      params.oldest = (this.options.startDate.getTime() / 1000).toString();
    }
    if (this.options.endDate) {
      params.latest = (this.options.endDate.getTime() / 1000).toString();
    }

    do {
      if (cursor) params.cursor = cursor;

      const response = await this.slackRequest('conversations.history', params);

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.error}`);
      }

      const batch = response.messages as SlackMessage[];
      messages.push(...batch);
      fetched += batch.length;

      const metadata = response.response_metadata as { next_cursor?: string } | undefined;
      cursor = metadata?.next_cursor;
    } while (cursor && fetched < limit);

    return messages.slice(0, limit);
  }

  private async buildMessageContent(message: SlackMessage, channelId: string): Promise<string> {
    let content = message.text;

    if (this.options.includeThreads && message.reply_count && message.reply_count > 0) {
      const replies = await this.fetchThreadReplies(channelId, message.ts);
      if (replies.length > 0) {
        content += '\n\n--- Thread Replies ---\n';
        content += replies.map(r => r.text).join('\n\n');
      }
    }

    if (this.options.includeFiles && message.files?.length) {
      content += '\n\n--- Attached Files ---\n';
      content += message.files.map(f => `[${f.name}] (${f.mimetype})`).join('\n');
    }

    return content;
  }

  private async fetchThreadReplies(channelId: string, threadTs: string): Promise<SlackMessage[]> {
    try {
      const response = await this.slackRequest('conversations.replies', {
        channel: channelId,
        ts: threadTs,
        limit: '100',
      });

      if (!response.ok) {
        return [];
      }

      const messages = response.messages as SlackMessage[];
      return messages.slice(1);
    } catch {
      return [];
    }
  }

  private async slackRequest(
    method: string,
    params: Record<string, string>
  ): Promise<{ ok: boolean; error?: string; [key: string]: unknown }> {
    const url = new URL(`${this.baseUrl}/${method}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${this.options.token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      throw new Error(`Slack HTTP error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<{ ok: boolean; error?: string; [key: string]: unknown }>;
  }
}
