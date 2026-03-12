import type { Document } from '@orka-js/core';
import type { DocumentLoader, GoogleDriveLoaderOptions } from './types.js';
import { generateId } from '@orka-js/core';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  webViewLink?: string;
  createdTime?: string;
  modifiedTime?: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export class GoogleDriveLoader implements DocumentLoader {
  private options: GoogleDriveLoaderOptions;
  private baseUrl = 'https://www.googleapis.com/drive/v3';
  private accessToken: string | null = null;

  private readonly EXPORTABLE_MIME_TYPES: Record<string, string> = {
    'application/vnd.google-apps.document': 'text/plain',
    'application/vnd.google-apps.spreadsheet': 'text/csv',
    'application/vnd.google-apps.presentation': 'text/plain',
  };

  private readonly TEXT_MIME_TYPES = [
    'text/plain',
    'text/markdown',
    'text/csv',
    'text/html',
    'application/json',
    'application/xml',
    'text/xml',
  ];

  constructor(options: GoogleDriveLoaderOptions) {
    if (!options.credentials?.clientId || !options.credentials?.clientSecret || !options.credentials?.refreshToken) {
      throw new Error('GoogleDriveLoader requires credentials (clientId, clientSecret, refreshToken)');
    }
    this.options = {
      recursive: true,
      maxFiles: 100,
      ...options,
    };
  }

  async load(): Promise<Document[]> {
    await this.authenticate();
    const documents: Document[] = [];

    if (this.options.fileIds?.length) {
      for (const fileId of this.options.fileIds) {
        const doc = await this.loadFile(fileId);
        if (doc) documents.push(doc);
      }
    }

    if (this.options.folderId) {
      const folderDocs = await this.loadFolder(this.options.folderId, 0);
      documents.push(...folderDocs);
    }

    return documents.slice(0, this.options.maxFiles);
  }

  private async authenticate(): Promise<void> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.options.credentials.clientId,
        client_secret: this.options.credentials.clientSecret,
        refresh_token: this.options.credentials.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error(`Google OAuth error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as TokenResponse;
    this.accessToken = data.access_token;
  }

  private async loadFolder(folderId: string, depth: number): Promise<Document[]> {
    const documents: Document[] = [];
    const maxDepth = 5;

    if (depth > maxDepth) return documents;

    try {
      const files = await this.listFiles(folderId);

      for (const file of files) {
        if (this.shouldIncludeFile(file)) {
          if (file.mimeType === 'application/vnd.google-apps.folder') {
            if (this.options.recursive) {
              const subDocs = await this.loadFolder(file.id, depth + 1);
              documents.push(...subDocs);
            }
          } else {
            const doc = await this.loadFile(file.id, file);
            if (doc) documents.push(doc);
          }
        }

        if (documents.length >= (this.options.maxFiles ?? 100)) break;
      }
    } catch (error) {
      console.warn(`Failed to load Google Drive folder ${folderId}:`, error);
    }

    return documents;
  }

  private async listFiles(folderId: string): Promise<DriveFile[]> {
    const files: DriveFile[] = [];
    let pageToken: string | undefined;

    do {
      const url = new URL(`${this.baseUrl}/files`);
      url.searchParams.set('q', `'${folderId}' in parents and trashed = false`);
      url.searchParams.set('fields', 'nextPageToken, files(id, name, mimeType, parents, webViewLink, createdTime, modifiedTime)');
      url.searchParams.set('pageSize', '100');
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const response = await fetch(url.toString(), {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Google Drive API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { files: DriveFile[]; nextPageToken?: string };
      files.push(...data.files);
      pageToken = data.nextPageToken;
    } while (pageToken);

    return files;
  }

  private async loadFile(fileId: string, fileInfo?: DriveFile): Promise<Document | null> {
    try {
      const file = fileInfo ?? await this.getFileMetadata(fileId);
      const content = await this.getFileContent(file);

      if (!content) return null;

      return {
        id: generateId(),
        content,
        metadata: {
          ...this.options.metadata,
          source: `gdrive://file/${file.id}`,
          loader: 'GoogleDriveLoader',
          driveFileId: file.id,
          fileName: file.name,
          mimeType: file.mimeType,
          webViewLink: file.webViewLink,
          createdTime: file.createdTime,
          modifiedTime: file.modifiedTime,
        },
      };
    } catch (error) {
      console.warn(`Failed to load Google Drive file ${fileId}:`, error);
      return null;
    }
  }

  private async getFileMetadata(fileId: string): Promise<DriveFile> {
    const url = new URL(`${this.baseUrl}/files/${fileId}`);
    url.searchParams.set('fields', 'id, name, mimeType, parents, webViewLink, createdTime, modifiedTime');

    const response = await fetch(url.toString(), {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Google Drive API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<DriveFile>;
  }

  private async getFileContent(file: DriveFile): Promise<string | null> {
    const exportMimeType = this.EXPORTABLE_MIME_TYPES[file.mimeType];

    if (exportMimeType) {
      return this.exportFile(file.id, exportMimeType);
    }

    if (this.isTextFile(file.mimeType)) {
      return this.downloadFile(file.id);
    }

    return null;
  }

  private async exportFile(fileId: string, mimeType: string): Promise<string> {
    const url = new URL(`${this.baseUrl}/files/${fileId}/export`);
    url.searchParams.set('mimeType', mimeType);

    const response = await fetch(url.toString(), {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Google Drive export error: ${response.status} ${response.statusText}`);
    }

    return response.text();
  }

  private async downloadFile(fileId: string): Promise<string> {
    const url = new URL(`${this.baseUrl}/files/${fileId}`);
    url.searchParams.set('alt', 'media');

    const response = await fetch(url.toString(), {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Google Drive download error: ${response.status} ${response.statusText}`);
    }

    return response.text();
  }

  private shouldIncludeFile(file: DriveFile): boolean {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      return true;
    }

    if (this.options.mimeTypes?.length) {
      return this.options.mimeTypes.includes(file.mimeType);
    }

    return this.isTextFile(file.mimeType) || !!this.EXPORTABLE_MIME_TYPES[file.mimeType];
  }

  private isTextFile(mimeType: string): boolean {
    return this.TEXT_MIME_TYPES.some(t => mimeType.startsWith(t));
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Accept': 'application/json',
    };
  }
}
