import type { AgentToolkit, SQLToolkitConfig, Tool, ToolResult } from '../types.js';

export class SQLToolkit implements AgentToolkit {
  readonly name = 'sql';
  readonly description = 'Tools for querying and analyzing SQL databases';
  readonly tools: Tool[];

  private execute: (query: string) => Promise<string>;
  private schema: string;
  private readOnly: boolean;
  private maxRows: number;

  constructor(config: SQLToolkitConfig) {
    this.execute = config.execute;
    this.schema = config.schema ?? '';
    this.readOnly = config.readOnly ?? true;
    this.maxRows = config.maxRows ?? 100;

    this.tools = [
      this.createQueryTool(),
      this.createSchemaTool(),
      this.createListTablesTool(),
    ];
  }

  private createQueryTool(): Tool {
    return {
      name: 'sql_query',
      description: `Execute a SQL query against the database. ${this.readOnly ? 'Only SELECT queries are allowed.' : 'All query types are allowed.'} Results are limited to ${this.maxRows} rows.`,
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'The SQL query to execute',
          required: true,
        },
      ],
      execute: async (input: Record<string, unknown>): Promise<ToolResult> => {
        const query = input.query as string;

        if (!query) {
          return { output: '', error: 'No query provided.' };
        }

        if (this.readOnly) {
          const sanitizeResult = this.validateReadOnlyQuery(query);
          if (sanitizeResult) {
            return { output: '', error: sanitizeResult };
          }
        }

        const limitedQuery = this.ensureLimit(query);

        try {
          const result = await this.execute(limitedQuery);
          return { output: result, metadata: { query: limitedQuery } };
        } catch (error) {
          return { output: '', error: `SQL Error: ${(error as Error).message}` };
        }
      },
    };
  }

  private createSchemaTool(): Tool {
    return {
      name: 'sql_schema',
      description: 'Get the database schema (tables, columns, types). Use this to understand the database structure before writing queries.',
      parameters: [
        {
          name: 'table',
          type: 'string',
          description: 'Optional: specific table name to get schema for. Leave empty for full schema.',
          required: false,
        },
      ],
      execute: async (input: Record<string, unknown>): Promise<ToolResult> => {
        const table = input.table as string | undefined;

        if (table && !this.isValidIdentifier(table)) {
          return { output: '', error: `Invalid table name: "${table}". Only alphanumeric characters and underscores are allowed.` };
        }

        if (this.schema) {
          if (table) {
            const escapedTable = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const tablePattern = new RegExp(`(?:CREATE TABLE|TABLE)\\s+(?:\`|")?${escapedTable}(?:\`|")?[\\s\\S]*?(?:;|\\n\\n)`, 'i');
            const match = this.schema.match(tablePattern);
            return { output: match ? match[0] : `Table "${table}" not found in schema.` };
          }
          return { output: this.schema };
        }

        try {
          const query = table
            ? `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = '${table}' ORDER BY ordinal_position`
            : `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
          const result = await this.execute(query);
          return { output: result };
        } catch (error) {
          return { output: '', error: `Schema Error: ${(error as Error).message}` };
        }
      },
    };
  }

  private createListTablesTool(): Tool {
    return {
      name: 'sql_list_tables',
      description: 'List all tables in the database.',
      parameters: [],
      execute: async (): Promise<ToolResult> => {
        if (this.schema) {
          const tables = this.schema.match(/(?:CREATE TABLE|TABLE)\s+(?:`|")?(\w+)(?:`|")?/gi);
          if (tables) {
            const names = tables.map(t => t.replace(/(?:CREATE TABLE|TABLE)\s+(?:`|")?/i, '').replace(/[`"]/g, ''));
            return { output: `Tables: ${names.join(', ')}` };
          }
        }

        try {
          const result = await this.execute(
            `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
          );
          return { output: result };
        } catch (error) {
          return { output: '', error: `Error: ${(error as Error).message}` };
        }
      },
    };
  }

  private ensureLimit(query: string): string {
    const normalized = query.trim().toUpperCase();
    if (normalized.startsWith('SELECT') && !normalized.includes('LIMIT')) {
      return `${query.trim().replace(/;$/, '')} LIMIT ${this.maxRows}`;
    }
    return query;
  }

  private validateReadOnlyQuery(query: string): string | null {
    const normalized = query.trim().toUpperCase();

    if (!normalized.startsWith('SELECT') && !normalized.startsWith('WITH') && !normalized.startsWith('EXPLAIN')) {
      return 'Only SELECT, WITH, and EXPLAIN queries are allowed in read-only mode.';
    }

    const stripped = query.replace(/;\s*$/, '');
    if (stripped.includes(';')) {
      return 'Multiple SQL statements are not allowed in read-only mode.';
    }

    const dangerousKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE'];
    for (const keyword of dangerousKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(query)) {
        return `Keyword "${keyword}" is not allowed in read-only mode.`;
      }
    }

    return null;
  }

  private isValidIdentifier(name: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
  }
}
