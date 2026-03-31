import type { Document } from '@orka-js/core';
import type { DocumentLoader, GitHubLoaderOptions } from './types.js';
import { generateId } from '@orka-js/core';

interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
  download_url: string | null;
  content?: string;
  encoding?: string;
}

export class GitHubLoader implements DocumentLoader {
  private options: GitHubLoaderOptions;
  private baseUrl = 'https://api.github.com';

  constructor(options: GitHubLoaderOptions) {
    if (!options.owner || !options.repo) {
      throw new Error('GitHubLoader requires owner and repo');
    }
    this.options = {
      branch: 'main',
      path: '',
      recursive: true,
      fileExtensions: ['.md', '.txt', '.ts', '.js', '.py', '.json', '.yaml', '.yml'],
      excludePaths: ['node_modules', '.git', 'dist', 'build', '__pycache__'],
      includeReadme: true,
      ...options,
    };
  }

  async load(): Promise<Document[]> {
    const documents: Document[] = [];
    const files = await this.listFiles(this.options.path ?? '');

    for (const file of files) {
      if (this.shouldIncludeFile(file)) {
        const doc = await this.loadFile(file);
        if (doc) documents.push(doc);
      }
    }

    return documents;
  }

  private async listFiles(path: string): Promise<GitHubContent[]> {
    const files: GitHubContent[] = [];

    try {
      const contents = await this.fetchContents(path);

      for (const item of contents) {
        if (item.type === 'file') {
          files.push(item);
        } else if (item.type === 'dir' && this.options.recursive) {
          if (!this.isExcludedPath(item.path)) {
            const subFiles = await this.listFiles(item.path);
            files.push(...subFiles);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to list GitHub path ${path}:`, error);
    }

    return files;
  }

  private async fetchContents(path: string): Promise<GitHubContent[]> {
    const url = new URL(`${this.baseUrl}/repos/${this.options.owner}/${this.options.repo}/contents/${path}`);
    if (this.options.branch) {
      url.searchParams.set('ref', this.options.branch);
    }

    const response = await fetch(url.toString(), {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data as GitHubContent[] : [data as GitHubContent];
  }

  private async loadFile(file: GitHubContent): Promise<Document | null> {
    try {
      let content: string;

      if (file.content && file.encoding === 'base64') {
        content = new TextDecoder().decode(Uint8Array.from(atob(file.content), c => c.charCodeAt(0)));
      } else if (file.download_url) {
        const response = await fetch(file.download_url, {
          headers: this.getHeaders(),
        });
        if (!response.ok) return null;
        content = await response.text();
      } else {
        const fileData = await this.fetchContents(file.path);
        const singleFile = Array.isArray(fileData) ? fileData[0] : fileData;
        if (singleFile.content && singleFile.encoding === 'base64') {
          content = Buffer.from(singleFile.content, 'base64').toString('utf-8');
        } else {
          return null;
        }
      }

      return {
        id: generateId(),
        content,
        metadata: {
          ...this.options.metadata,
          source: `github://${this.options.owner}/${this.options.repo}/${file.path}`,
          loader: 'GitHubLoader',
          githubOwner: this.options.owner,
          githubRepo: this.options.repo,
          githubBranch: this.options.branch,
          githubPath: file.path,
          githubSha: file.sha,
          fileName: file.name,
          fileSize: file.size,
        },
      };
    } catch (error) {
      console.warn(`Failed to load GitHub file ${file.path}:`, error);
      return null;
    }
  }

  private shouldIncludeFile(file: GitHubContent): boolean {
    if (this.isExcludedPath(file.path)) return false;

    const extensions = this.options.fileExtensions ?? [];
    if (extensions.length === 0) return true;

    const ext = this.getExtension(file.name);
    if (extensions.includes(ext)) return true;

    if (this.options.includeReadme && file.name.toLowerCase().startsWith('readme')) {
      return true;
    }

    return false;
  }

  private isExcludedPath(path: string): boolean {
    const excludePaths = this.options.excludePaths ?? [];
    return excludePaths.some(excluded => 
      path.includes(`/${excluded}/`) || 
      path.startsWith(`${excluded}/`) ||
      path === excluded
    );
  }

  private getExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot >= 0 ? filename.slice(lastDot) : '';
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'OrkaJS-GitHubLoader',
    };

    if (this.options.token) {
      headers['Authorization'] = `Bearer ${this.options.token}`;
    }

    return headers;
  }
}
