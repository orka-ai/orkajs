import type { 
  LLMAdapter, 
  VectorDBAdapter, 
  KnowledgeCreateOptions, 
  KnowledgeSource,
  Document,
  VectorSearchResult,
  OrkaDefaults
} from './types.js';
import { chunkDocuments } from './chunker.js';
import { generateId } from './utils.js';
import { OrkaError, OrkaErrorCode } from './errors.js';

export class Knowledge {
  private llm: LLMAdapter;
  private vectorDB: VectorDBAdapter;
  private defaults: OrkaDefaults;
  private collections: Map<string, { dimension: number }> = new Map();

  constructor(llm: LLMAdapter, vectorDB: VectorDBAdapter, defaults: OrkaDefaults = {}) {
    this.llm = llm;
    this.vectorDB = vectorDB;
    this.defaults = defaults;
  }

  async create(options: KnowledgeCreateOptions): Promise<{ name: string; documentCount: number; chunkCount: number }> {
    const { 
      name, 
      source, 
      chunkSize = this.defaults.chunkSize ?? 1000,
      chunkOverlap = this.defaults.chunkOverlap ?? 200,
      metadata = {}
    } = options;

    const documents = await this.sourceToDocuments(source, metadata);
    const chunks = chunkDocuments(documents, { chunkSize, chunkOverlap });

    if (chunks.length === 0) {
      throw new Error('No content to index');
    }

    const embeddings = await this.llm.embed(chunks.map(c => c.content));
    const dimension = embeddings[0].length;

    await this.vectorDB.createCollection(name, { dimension, metric: 'cosine' });
    this.collections.set(name, { dimension });

    const vectors = chunks.map((chunk, i) => ({
      id: chunk.id,
      vector: embeddings[i],
      content: chunk.content,
      metadata: {
        ...chunk.metadata,
        documentId: chunk.documentId,
        chunkIndex: chunk.index,
      },
    }));

    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      await this.vectorDB.upsert(name, vectors.slice(i, i + batchSize));
    }

    return {
      name,
      documentCount: documents.length,
      chunkCount: chunks.length,
    };
  }

  async add(name: string, source: KnowledgeSource, options: { chunkSize?: number; chunkOverlap?: number; metadata?: Record<string, unknown> } = {}): Promise<{ addedChunks: number }> {
    const { 
      chunkSize = this.defaults.chunkSize ?? 1000,
      chunkOverlap = this.defaults.chunkOverlap ?? 200,
      metadata = {}
    } = options;

    const documents = await this.sourceToDocuments(source, metadata);
    const chunks = chunkDocuments(documents, { chunkSize, chunkOverlap });

    if (chunks.length === 0) {
      return { addedChunks: 0 };
    }

    const embeddings = await this.llm.embed(chunks.map(c => c.content));

    const vectors = chunks.map((chunk, i) => ({
      id: chunk.id,
      vector: embeddings[i],
      content: chunk.content,
      metadata: {
        ...chunk.metadata,
        documentId: chunk.documentId,
        chunkIndex: chunk.index,
      },
    }));

    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      await this.vectorDB.upsert(name, vectors.slice(i, i + batchSize));
    }

    return { addedChunks: chunks.length };
  }

  async search(name: string, query: string, options: { topK?: number; minScore?: number } = {}): Promise<VectorSearchResult[]> {
    const { topK = this.defaults.topK ?? 5, minScore } = options;

    const [queryEmbedding] = await this.llm.embed([query]);
    
    return this.vectorDB.search(name, queryEmbedding, { topK, minScore });
  }

  async delete(name: string): Promise<void> {
    await this.vectorDB.deleteCollection(name);
    this.collections.delete(name);
  }

  private async sourceToDocuments(source: KnowledgeSource, baseMetadata: Record<string, unknown>): Promise<Document[]> {
    if (typeof source === 'string') {
      return [{
        id: generateId(),
        content: source,
        metadata: baseMetadata,
      }];
    }

    if (Array.isArray(source)) {
      if (source.length === 0) return [];
      
      if (typeof source[0] === 'string') {
        return (source as string[]).map(text => ({
          id: generateId(),
          content: text,
          metadata: baseMetadata,
        }));
      }

      return (source as { text: string; metadata?: Record<string, unknown> }[]).map(item => ({
        id: generateId(),
        content: item.text,
        metadata: { ...baseMetadata, ...item.metadata },
      }));
    }

    if ('path' in source) {
      const fs = await import('fs/promises');
      const path = await import('path');
      const stat = await fs.stat(source.path);
      
      if (stat.isFile()) {
        const content = await fs.readFile(source.path, 'utf-8');
        return [{
          id: generateId(),
          content,
          metadata: { ...baseMetadata, sourcePath: source.path },
        }];
      }
      
      if (stat.isDirectory()) {
        const files = await fs.readdir(source.path);
        const documents: Document[] = [];
        
        for (const file of files) {
          const filePath = path.join(source.path, file);
          const fileStat = await fs.stat(filePath);
          
          if (fileStat.isFile() && this.isTextFile(file)) {
            const content = await fs.readFile(filePath, 'utf-8');
            documents.push({
              id: generateId(),
              content,
              metadata: { ...baseMetadata, sourcePath: filePath, fileName: file },
            });
          }
        }
        
        return documents;
      }
    }

    if ('url' in source) {
      const content = await this.fetchUrlContent(source.url);
      return [{
        id: generateId(),
        content,
        metadata: { ...baseMetadata, sourceUrl: source.url },
      }];
    }

    throw new Error('Invalid source format');
  }

  private async fetchUrlContent(initialUrl: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await this.fetchWithRedirectGuard(initialUrl, controller.signal);

      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      }

      return await this.readBodyWithLimit(response, 50_000_000);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error(`URL fetch timed out after 30s: ${initialUrl}`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Follow redirects manually so every hop's resolved host is validated against
  // private/loopback/link-local ranges before a request is issued to it.
  private async fetchWithRedirectGuard(initialUrl: string, signal: AbortSignal): Promise<Response> {
    const maxRedirects = 5;
    let url = initialUrl;

    for (let hop = 0; hop <= maxRedirects; hop++) {
      await this.assertUrlAllowed(url);

      const response = await fetch(url, { signal, redirect: 'manual' });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          return response;
        }
        url = new URL(location, url).toString();
        continue;
      }

      return response;
    }

    throw new OrkaError(
      `Too many redirects while fetching URL: ${initialUrl}`,
      OrkaErrorCode.SSRF_BLOCKED,
      'core/knowledge',
    );
  }

  private async assertUrlAllowed(rawUrl: string): Promise<void> {
    const parsedUrl = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error(`Unsupported URL protocol: ${parsedUrl.protocol}. Only http and https are allowed.`);
    }

    const hostname = parsedUrl.hostname.replace(/^\[|\]$/g, '');
    const { lookup } = await import('dns/promises');

    let addresses: { address: string }[];
    try {
      addresses = await lookup(hostname, { all: true });
    } catch (error) {
      throw new OrkaError(
        `Failed to resolve host for URL: ${rawUrl}`,
        OrkaErrorCode.SSRF_BLOCKED,
        'core/knowledge',
        error as Error,
      );
    }

    for (const { address } of addresses) {
      if (isBlockedAddress(address)) {
        throw new OrkaError(
          `Blocked request to private or loopback address (${address}) for URL: ${rawUrl}`,
          OrkaErrorCode.SSRF_BLOCKED,
          'core/knowledge',
        );
      }
    }
  }

  // Enforce the byte cap by reading the stream incrementally; content-length is
  // absent for chunked transfer encoding, so it cannot be trusted alone.
  private async readBodyWithLimit(response: Response, maxBytes: number): Promise<string> {
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > maxBytes) {
      throw new Error('URL content exceeds 50MB limit');
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return response.text();
    }

    const parts: Uint8Array[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      received += value.length;
      if (received > maxBytes) {
        await reader.cancel();
        throw new Error('URL content exceeds 50MB limit');
      }
      parts.push(value);
    }

    return Buffer.concat(parts).toString('utf-8');
  }

  private isTextFile(filename: string): boolean {
    const textExtensions = ['.txt', '.md', '.json', '.csv', '.html', '.xml', '.yaml', '.yml', '.js', '.ts', '.py', '.java', '.c', '.cpp', '.h', '.css', '.scss', '.sql'];
    return textExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  }
}

function isBlockedAddress(address: string): boolean {
  // Normalize IPv4-mapped IPv6 addresses (e.g. ::ffff:169.254.169.254)
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const ip = mapped ? mapped[1] : address;

  if (ip.includes('.')) {
    return isBlockedIPv4(ip);
  }
  return isBlockedIPv6(ip);
}

function isBlockedIPv4(ip: string): boolean {
  const octets = ip.split('.').map(Number);
  if (octets.length !== 4 || octets.some(o => Number.isNaN(o) || o < 0 || o > 255)) {
    return true; // Unparseable address: block conservatively.
  }
  const [a, b] = octets;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  return false;
}

function isBlockedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true; // loopback / unspecified
  // fe80::/10 link-local spans the fe80- prefixes fe8x, fe9x, feax, febx
  if (['fe8', 'fe9', 'fea', 'feb'].some(prefix => normalized.startsWith(prefix))) return true;
  // fc00::/7 unique local addresses
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  return false;
}
