import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NotionLoader,
  SlackLoader,
  GitHubLoader,
  GoogleDriveLoader,
} from '@orka-js/tools';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('NotionLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw error without apiKey', () => {
    expect(() => new NotionLoader({ apiKey: '' })).toThrow('requires an apiKey');
  });

  it('should load a page successfully', async () => {
    const pageId = 'test-page-id';
    
    // Mock page fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        id: pageId,
        properties: {
          title: { type: 'title', title: [{ plain_text: 'Test Page' }] }
        },
        url: 'https://notion.so/test-page',
      }),
    });

    // Mock blocks fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        results: [
          { id: 'block-1', type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Hello World' }] } },
        ],
        has_more: false,
      }),
    });

    const loader = new NotionLoader({
      apiKey: 'test-api-key',
      pageIds: [pageId],
    });

    const docs = await loader.load();

    expect(docs).toHaveLength(1);
    expect(docs[0].content).toBe('Hello World');
    expect(docs[0].metadata.loader).toBe('NotionLoader');
    expect(docs[0].metadata.notionPageId).toBe(pageId);
    expect(docs[0].metadata.title).toBe('Test Page');
  });

  it('should load a database successfully', async () => {
    const databaseId = 'test-db-id';

    // Mock database query
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        results: [
          {
            id: 'page-1',
            properties: {
              Name: { type: 'title', title: [{ plain_text: 'Item 1' }] },
              Status: { type: 'select', select: { name: 'Done' } },
            },
            url: 'https://notion.so/page-1',
          },
        ],
        has_more: false,
      }),
    });

    // Mock blocks fetch for page
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        results: [
          { id: 'block-1', type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Content' }] } },
        ],
        has_more: false,
      }),
    });

    const loader = new NotionLoader({
      apiKey: 'test-api-key',
      databaseIds: [databaseId],
    });

    const docs = await loader.load();

    expect(docs).toHaveLength(1);
    expect(docs[0].metadata.notionDatabaseId).toBe(databaseId);
    expect(docs[0].metadata.notion_Status).toBe('Done');
  });
});

describe('SlackLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw error without token', () => {
    expect(() => new SlackLoader({ token: '' })).toThrow('requires a token');
  });

  it('should load messages from a channel', async () => {
    const channelId = 'C123456';

    // Mock channel info
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        channel: { id: channelId, name: 'general', is_channel: true, is_private: false },
      }),
    });

    // Mock messages
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        messages: [
          { ts: '1234567890.123456', text: 'Hello team!', user: 'U123' },
          { ts: '1234567891.123456', text: 'Hi everyone!', user: 'U456' },
        ],
        response_metadata: {},
      }),
    });

    const loader = new SlackLoader({
      token: 'xoxb-test-token',
      channelIds: [channelId],
    });

    const docs = await loader.load();

    expect(docs).toHaveLength(2);
    expect(docs[0].content).toBe('Hello team!');
    expect(docs[0].metadata.loader).toBe('SlackLoader');
    expect(docs[0].metadata.slackChannelId).toBe(channelId);
    expect(docs[0].metadata.slackChannelName).toBe('general');
  });

  it('should include thread replies when enabled', async () => {
    const channelId = 'C123456';

    // Mock channel info
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        channel: { id: channelId, name: 'general', is_channel: true, is_private: false },
      }),
    });

    // Mock messages with thread
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        messages: [
          { ts: '1234567890.123456', text: 'Main message', user: 'U123', reply_count: 2 },
        ],
        response_metadata: {},
      }),
    });

    // Mock thread replies
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        messages: [
          { ts: '1234567890.123456', text: 'Main message', user: 'U123' },
          { ts: '1234567890.123457', text: 'Reply 1', user: 'U456' },
          { ts: '1234567890.123458', text: 'Reply 2', user: 'U789' },
        ],
      }),
    });

    const loader = new SlackLoader({
      token: 'xoxb-test-token',
      channelIds: [channelId],
      includeThreads: true,
    });

    const docs = await loader.load();

    expect(docs).toHaveLength(1);
    expect(docs[0].content).toContain('Main message');
    expect(docs[0].content).toContain('Reply 1');
    expect(docs[0].content).toContain('Reply 2');
  });
});

describe('GitHubLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw error without owner or repo', () => {
    expect(() => new GitHubLoader({ owner: '', repo: 'test' })).toThrow('requires owner and repo');
    expect(() => new GitHubLoader({ owner: 'test', repo: '' })).toThrow('requires owner and repo');
  });

  it('should load files from a repository', async () => {
    // Mock contents listing
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([
        {
          name: 'README.md',
          path: 'README.md',
          sha: 'abc123',
          size: 100,
          type: 'file',
          download_url: 'https://raw.githubusercontent.com/owner/repo/main/README.md',
        },
        {
          name: 'src',
          path: 'src',
          sha: 'def456',
          size: 0,
          type: 'dir',
          download_url: null,
        },
      ]),
    });

    // Mock src directory
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([
        {
          name: 'index.ts',
          path: 'src/index.ts',
          sha: 'ghi789',
          size: 200,
          type: 'file',
          download_url: 'https://raw.githubusercontent.com/owner/repo/main/src/index.ts',
        },
      ]),
    });

    // Mock file downloads
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('# README\n\nThis is a test.'),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('export const hello = "world";'),
    });

    const loader = new GitHubLoader({
      owner: 'test-owner',
      repo: 'test-repo',
      branch: 'main',
    });

    const docs = await loader.load();

    expect(docs).toHaveLength(2);
    expect(docs[0].metadata.loader).toBe('GitHubLoader');
    expect(docs[0].metadata.githubOwner).toBe('test-owner');
    expect(docs[0].metadata.githubRepo).toBe('test-repo');
  });

  it('should exclude specified paths', async () => {
    // Mock contents listing
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([
        {
          name: 'README.md',
          path: 'README.md',
          sha: 'abc123',
          size: 100,
          type: 'file',
          download_url: 'https://raw.githubusercontent.com/owner/repo/main/README.md',
        },
        {
          name: 'node_modules',
          path: 'node_modules',
          sha: 'def456',
          size: 0,
          type: 'dir',
          download_url: null,
        },
      ]),
    });

    // Mock file download
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('# README'),
    });

    const loader = new GitHubLoader({
      owner: 'test-owner',
      repo: 'test-repo',
      excludePaths: ['node_modules'],
    });

    const docs = await loader.load();

    expect(docs).toHaveLength(1);
    expect(docs[0].metadata.githubPath).toBe('README.md');
  });
});

describe('GoogleDriveLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw error without credentials', () => {
    expect(() => new GoogleDriveLoader({
      credentials: { clientId: '', clientSecret: 'secret', refreshToken: 'token' },
    })).toThrow('requires credentials');

    expect(() => new GoogleDriveLoader({
      credentials: { clientId: 'id', clientSecret: '', refreshToken: 'token' },
    })).toThrow('requires credentials');

    expect(() => new GoogleDriveLoader({
      credentials: { clientId: 'id', clientSecret: 'secret', refreshToken: '' },
    })).toThrow('requires credentials');
  });

  it('should authenticate and load files', async () => {
    // Mock OAuth token refresh
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'test-access-token',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    });

    // Mock file metadata
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        id: 'file-123',
        name: 'document.txt',
        mimeType: 'text/plain',
        webViewLink: 'https://drive.google.com/file/d/file-123/view',
        createdTime: '2024-01-01T00:00:00Z',
        modifiedTime: '2024-01-02T00:00:00Z',
      }),
    });

    // Mock file download
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('File content here'),
    });

    const loader = new GoogleDriveLoader({
      credentials: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'test-refresh-token',
      },
      fileIds: ['file-123'],
    });

    const docs = await loader.load();

    expect(docs).toHaveLength(1);
    expect(docs[0].content).toBe('File content here');
    expect(docs[0].metadata.loader).toBe('GoogleDriveLoader');
    expect(docs[0].metadata.driveFileId).toBe('file-123');
    expect(docs[0].metadata.fileName).toBe('document.txt');
  });

  it('should load files from a folder', async () => {
    // Mock OAuth token refresh
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'test-access-token',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    });

    // Mock folder listing
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        files: [
          {
            id: 'file-1',
            name: 'doc1.txt',
            mimeType: 'text/plain',
          },
          {
            id: 'file-2',
            name: 'doc2.txt',
            mimeType: 'text/plain',
          },
        ],
      }),
    });

    // Mock file downloads
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('Content 1'),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('Content 2'),
    });

    const loader = new GoogleDriveLoader({
      credentials: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'test-refresh-token',
      },
      folderId: 'folder-123',
    });

    const docs = await loader.load();

    expect(docs).toHaveLength(2);
    expect(docs[0].content).toBe('Content 1');
    expect(docs[1].content).toBe('Content 2');
  });

  it('should export Google Docs as text', async () => {
    // Mock OAuth token refresh
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'test-access-token',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    });

    // Mock file metadata
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        id: 'gdoc-123',
        name: 'My Document',
        mimeType: 'application/vnd.google-apps.document',
      }),
    });

    // Mock export
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('Exported document content'),
    });

    const loader = new GoogleDriveLoader({
      credentials: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'test-refresh-token',
      },
      fileIds: ['gdoc-123'],
    });

    const docs = await loader.load();

    expect(docs).toHaveLength(1);
    expect(docs[0].content).toBe('Exported document content');
  });
});
