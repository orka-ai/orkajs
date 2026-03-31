import type { VectorDBAdapter, VectorRecord, VectorSearchOptions, VectorSearchResult, CreateCollectionOptions } from '@orka-js/core';
import { OrkaError, OrkaErrorCode } from '@orka-js/core';
import type { PgVectorAdapterConfig } from './types.js';

// Types inlined to avoid requiring @types/pg at runtime
interface PgPool {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  end(): Promise<void>;
}

const COLLECTION_NAME_PATTERN = /^[a-z0-9_]+$/i;

export class PgVectorAdapter implements VectorDBAdapter {
  readonly name = 'pgvector';
  private pool: PgPool | null = null;
  private config: Required<PgVectorAdapterConfig>;

  constructor(config: PgVectorAdapterConfig) {
    this.config = {
      schema: 'public',
      tablePrefix: 'orka_vectors_',
      enableExtension: true,
      ...config,
    };
  }

  private async getPool(): Promise<PgPool> {
    if (!this.pool) {
      const { Pool } = await import('pg') as { Pool: new (opts: { connectionString: string }) => PgPool };
      this.pool = new Pool({ connectionString: this.config.connectionString });
      if (this.config.enableExtension) {
        await this.pool.query('CREATE EXTENSION IF NOT EXISTS vector');
      }
    }
    return this.pool;
  }

  private validateCollectionName(name: string): void {
    if (!COLLECTION_NAME_PATTERN.test(name)) {
      throw new OrkaError(
        `Invalid collection name "${name}". Only alphanumeric characters and underscores are allowed.`,
        OrkaErrorCode.INVALID_INPUT,
        'pgvector',
      );
    }
  }

  private tableName(collection: string): string {
    return `"${this.config.schema}"."${this.config.tablePrefix}${collection}"`;
  }

  private indexName(collection: string): string {
    return `orka_idx_${this.config.tablePrefix}${collection}`;
  }

  async createCollection(name: string, options: CreateCollectionOptions = {}): Promise<void> {
    this.validateCollectionName(name);
    const pool = await this.getPool();
    const dimension = options.dimension ?? 1536;
    const table = this.tableName(name);
    const opClass = options.metric === 'euclidean'
      ? 'vector_l2_ops'
      : options.metric === 'dotProduct'
        ? 'vector_ip_ops'
        : 'vector_cosine_ops';

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${table} (
        id TEXT PRIMARY KEY,
        vector vector(${dimension}),
        content TEXT,
        metadata JSONB DEFAULT '{}'
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS "${this.indexName(name)}"
      ON ${table} USING ivfflat (vector ${opClass})
      WITH (lists = 100)
    `);
  }

  async deleteCollection(name: string): Promise<void> {
    this.validateCollectionName(name);
    const pool = await this.getPool();
    await pool.query(`DROP TABLE IF EXISTS ${this.tableName(name)} CASCADE`);
  }

  async upsert(collection: string, vectors: VectorRecord[]): Promise<void> {
    this.validateCollectionName(collection);
    const pool = await this.getPool();
    const table = this.tableName(collection);

    for (const v of vectors) {
      const vecStr = `[${v.vector.join(',')}]`;
      await pool.query(
        `INSERT INTO ${table} (id, vector, content, metadata)
         VALUES ($1, $2::vector, $3, $4)
         ON CONFLICT (id) DO UPDATE
           SET vector = EXCLUDED.vector,
               content = EXCLUDED.content,
               metadata = EXCLUDED.metadata`,
        [v.id, vecStr, v.content ?? null, JSON.stringify(v.metadata ?? {})],
      );
    }
  }

  async search(collection: string, vector: number[], options: VectorSearchOptions = {}): Promise<VectorSearchResult[]> {
    this.validateCollectionName(collection);
    const pool = await this.getPool();
    const { topK = 5, minScore } = options;
    const table = this.tableName(collection);
    const vecStr = `[${vector.join(',')}]`;

    const result = await pool.query(
      `SELECT id, content, metadata,
              1 - (vector <=> $1::vector) AS score
       FROM ${table}
       ORDER BY vector <=> $1::vector
       LIMIT $2`,
      [vecStr, topK],
    );

    return result.rows
      .filter(row => minScore === undefined || (row.score as number) >= minScore)
      .map(row => ({
        id: row.id as string,
        score: parseFloat(row.score as string),
        content: row.content as string | undefined,
        metadata: row.metadata as Record<string, unknown> | undefined,
      }));
  }

  async delete(collection: string, ids: string[]): Promise<void> {
    this.validateCollectionName(collection);
    const pool = await this.getPool();
    await pool.query(
      `DELETE FROM ${this.tableName(collection)} WHERE id = ANY($1)`,
      [ids],
    );
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}
