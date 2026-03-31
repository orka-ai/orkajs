export interface PgVectorAdapterConfig {
  /** PostgreSQL connection string: postgres://user:pass@host:5432/db */
  connectionString: string;
  /** Schema to use — defaults to 'public' */
  schema?: string;
  /** Table name prefix for collections — defaults to 'orka_vectors_' */
  tablePrefix?: string;
  /** Whether to enable pgvector extension on connect — defaults to true */
  enableExtension?: boolean;
}
