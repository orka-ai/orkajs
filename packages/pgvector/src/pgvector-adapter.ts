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
  private poolPromise: Promise<PgPool> | null = null;
  private metricCache = new Map<string, 'cosine' | 'euclidean' | 'dotProduct'>();
  private config: Required<PgVectorAdapterConfig>;

  constructor(config: PgVectorAdapterConfig) {
    this.config = {
      schema: 'public',
      tablePrefix: 'orka_vectors_',
      enableExtension: true,
      ...config,
    };
  }

  private getPool(): Promise<PgPool> {
    if (!this.poolPromise) {
      // Memoize the initialization so concurrent first callers share a single
      // Pool and all await CREATE EXTENSION completing. Reset on failure so a
      // later call can retry rather than caching a rejected promise forever.
      this.poolPromise = this.initPool().catch((err) => {
        this.poolPromise = null;
        throw err;
      });
    }
    return this.poolPromise;
  }

  private async initPool(): Promise<PgPool> {
    const { Pool } = await import('pg') as { Pool: new (opts: { connectionString: string }) => PgPool };
    const pool = new Pool({ connectionString: this.config.connectionString });
    if (this.config.enableExtension) {
      await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    }
    return pool;
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

  /**
   * Resolves the distance metric for a collection. The metric is immutable for
   * a collection, so it is cached; on a miss (e.g. a collection created in a
   * previous process) it is derived from the ivfflat index's operator class.
   * Falls back to 'cosine' when no metric index is found.
   */
  private async getMetric(pool: PgPool, collection: string): Promise<'cosine' | 'euclidean' | 'dotProduct'> {
    const cached = this.metricCache.get(collection);
    if (cached) {
      return cached;
    }

    const result = await pool.query(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = $1 AND indexname = $2`,
      [this.config.schema, this.indexName(collection)],
    );
    const indexdef = result.rows[0]?.indexdef as string | undefined;
    const metric: 'cosine' | 'euclidean' | 'dotProduct' = indexdef?.includes('vector_l2_ops')
      ? 'euclidean'
      : indexdef?.includes('vector_ip_ops')
        ? 'dotProduct'
        : 'cosine';

    this.metricCache.set(collection, metric);
    return metric;
  }

  async createCollection(name: string, options: CreateCollectionOptions = {}): Promise<void> {
    this.validateCollectionName(name);
    const pool = await this.getPool();
    const dimension = options.dimension ?? 1536;
    const table = this.tableName(name);
    const metric = options.metric ?? 'cosine';
    const opClass = metric === 'euclidean'
      ? 'vector_l2_ops'
      : metric === 'dotProduct'
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

    this.metricCache.set(name, metric);
  }

  async deleteCollection(name: string): Promise<void> {
    this.validateCollectionName(name);
    const pool = await this.getPool();
    await pool.query(`DROP TABLE IF EXISTS ${this.tableName(name)} CASCADE`);
    this.metricCache.delete(name);
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
    const { topK = 5, minScore, filter } = options;
    const table = this.tableName(collection);
    const vecStr = `[${vector.join(',')}]`;

    // Match the operator to the collection's metric so the ivfflat index can
    // serve the query and scores reflect the requested distance. All three
    // operators return a distance where smaller is closer, so ORDER BY ... ASC
    // yields nearest first; score is normalized so higher means more similar.
    const metric = await this.getMetric(pool, collection);
    const operator = metric === 'euclidean' ? '<->' : metric === 'dotProduct' ? '<#>' : '<=>';
    const scoreExpr = metric === 'cosine'
      ? `1 - (vector ${operator} $1::vector)`
      : `-(vector ${operator} $1::vector)`;

    const params: unknown[] = [vecStr];
    let whereClause = '';
    if (filter && Object.keys(filter).length > 0) {
      params.push(JSON.stringify(filter));
      whereClause = `WHERE metadata @> $${params.length}::jsonb`;
    }
    params.push(topK);
    const limitParam = params.length;

    const result = await pool.query(
      `SELECT id, content, metadata,
              ${scoreExpr} AS score
       FROM ${table}
       ${whereClause}
       ORDER BY vector ${operator} $1::vector
       LIMIT $${limitParam}`,
      params,
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
    if (this.poolPromise) {
      const pool = await this.poolPromise.catch(() => null);
      this.poolPromise = null;
      if (pool) {
        await pool.end();
      }
    }
  }
}
