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
      const parsedUrl = new URL(source.url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error(`Unsupported URL protocol: ${parsedUrl.protocol}. Only http and https are allowed.`);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      try {
        const response = await fetch(source.url, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
        }

        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > 50_000_000) {
          throw new Error('URL content exceeds 50MB limit');
        }

        const content = await response.text();
        return [{
          id: generateId(),
          content,
          metadata: { ...baseMetadata, sourceUrl: source.url },
        }];
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          throw new Error(`URL fetch timed out after 30s: ${source.url}`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new Error('Invalid source format');
  }

  private isTextFile(filename: string): boolean {
    const textExtensions = ['.txt', '.md', '.json', '.csv', '.html', '.xml', '.yaml', '.yml', '.js', '.ts', '.py', '.java', '.c', '.cpp', '.h', '.css', '.scss', '.sql'];
    return textExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  }
}
