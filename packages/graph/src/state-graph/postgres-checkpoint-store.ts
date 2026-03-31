import type { BaseState, Checkpoint, CheckpointStore } from './types.js';

export interface PostgresCheckpointStoreConfig {
  /** PostgreSQL connection string: postgres://user:pass@host:5432/db */
  connectionString: string;
  /** Table name — defaults to 'orka_checkpoints' */
  tableName?: string;
  /** Schema — defaults to 'public' */
  schema?: string;
}

interface PgPool {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  end(): Promise<void>;
}

/**
 * PostgreSQL-backed checkpoint store for StateGraph.
 *
 * Call `initialize()` once before use to create the table and index.
 * Compatible with both direct PostgreSQL and Supabase connections.
 *
 * @example
 * const store = new PostgresCheckpointStore({ connectionString: process.env.DATABASE_URL! });
 * await store.initialize();
 */
export class PostgresCheckpointStore<S extends BaseState = BaseState>
  implements CheckpointStore<S> {

  private pool: PgPool | null = null;
  private config: Required<PostgresCheckpointStoreConfig>;

  constructor(config: PostgresCheckpointStoreConfig) {
    this.config = {
      tableName: 'orka_checkpoints',
      schema: 'public',
      ...config,
    };
  }

  private get table(): string {
    return `"${this.config.schema}"."${this.config.tableName}"`;
  }

  private async getPool(): Promise<PgPool> {
    if (!this.pool) {
      const { Pool } = await import('pg') as { Pool: new (opts: { connectionString: string }) => PgPool };
      this.pool = new Pool({ connectionString: this.config.connectionString });
    }
    return this.pool;
  }

  /**
   * Create the checkpoints table and index.
   * Must be called once before using this store.
   */
  async initialize(): Promise<void> {
    const pool = await this.getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.table} (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        state JSONB NOT NULL,
        current_node TEXT NOT NULL,
        path TEXT[] NOT NULL DEFAULT '{}',
        node_results JSONB NOT NULL DEFAULT '[]',
        timestamp BIGINT NOT NULL,
        parent_id TEXT,
        metadata JSONB DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'running',
        interrupt_reason TEXT,
        error TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "orka_ckpt_thread_idx_${this.config.tableName}"
      ON ${this.table} (thread_id, timestamp DESC)
    `);
  }

  async save(checkpoint: Checkpoint<S>): Promise<void> {
    const pool = await this.getPool();
    await pool.query(
      `INSERT INTO ${this.table}
         (id, thread_id, state, current_node, path, node_results, timestamp,
          parent_id, metadata, status, interrupt_reason, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
         state = EXCLUDED.state,
         current_node = EXCLUDED.current_node,
         path = EXCLUDED.path,
         node_results = EXCLUDED.node_results,
         timestamp = EXCLUDED.timestamp,
         status = EXCLUDED.status,
         interrupt_reason = EXCLUDED.interrupt_reason,
         error = EXCLUDED.error,
         metadata = EXCLUDED.metadata`,
      [
        checkpoint.id,
        checkpoint.threadId,
        JSON.stringify(checkpoint.state),
        checkpoint.currentNode,
        checkpoint.path,
        JSON.stringify(checkpoint.nodeResults),
        checkpoint.timestamp,
        checkpoint.parentId ?? null,
        JSON.stringify(checkpoint.metadata ?? {}),
        checkpoint.status,
        checkpoint.interruptReason ?? null,
        checkpoint.error ?? null,
      ],
    );
  }

  async load(checkpointId: string): Promise<Checkpoint<S> | null> {
    const pool = await this.getPool();
    const result = await pool.query(
      `SELECT * FROM ${this.table} WHERE id = $1`,
      [checkpointId],
    );
    if (result.rows.length === 0) return null;
    return this.rowToCheckpoint(result.rows[0]);
  }

  async loadLatest(threadId: string): Promise<Checkpoint<S> | null> {
    const pool = await this.getPool();
    const result = await pool.query(
      `SELECT * FROM ${this.table}
       WHERE thread_id = $1
       ORDER BY timestamp DESC
       LIMIT 1`,
      [threadId],
    );
    if (result.rows.length === 0) return null;
    return this.rowToCheckpoint(result.rows[0]);
  }

  async list(threadId: string): Promise<Checkpoint<S>[]> {
    const pool = await this.getPool();
    const result = await pool.query(
      `SELECT * FROM ${this.table}
       WHERE thread_id = $1
       ORDER BY timestamp ASC`,
      [threadId],
    );
    return result.rows.map(row => this.rowToCheckpoint(row));
  }

  async delete(checkpointId: string): Promise<void> {
    const pool = await this.getPool();
    await pool.query(`DELETE FROM ${this.table} WHERE id = $1`, [checkpointId]);
  }

  async deleteThread(threadId: string): Promise<void> {
    const pool = await this.getPool();
    await pool.query(`DELETE FROM ${this.table} WHERE thread_id = $1`, [threadId]);
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  private rowToCheckpoint(row: Record<string, unknown>): Checkpoint<S> {
    return {
      id: row.id as string,
      threadId: row.thread_id as string,
      state: (typeof row.state === 'string' ? JSON.parse(row.state) : row.state) as S,
      currentNode: row.current_node as string,
      path: row.path as string[],
      nodeResults: (typeof row.node_results === 'string'
        ? JSON.parse(row.node_results)
        : row.node_results) as Checkpoint<S>['nodeResults'],
      timestamp: Number(row.timestamp),
      parentId: row.parent_id as string | undefined,
      metadata: (typeof row.metadata === 'string'
        ? JSON.parse(row.metadata)
        : row.metadata) as Record<string, unknown> | undefined,
      status: row.status as Checkpoint<S>['status'],
      interruptReason: row.interrupt_reason as Checkpoint<S>['interruptReason'],
      error: row.error as string | undefined,
    };
  }
}
