import type { AgentToolkit, CSVToolkitConfig, Tool, ToolResult } from '../types.js';

export class CSVToolkit implements AgentToolkit {
  readonly name = 'csv';
  readonly description = 'Tools for querying and analyzing CSV data';
  readonly tools: Tool[];

  private headers: string[];
  private rows: string[][];
  private separator: string;

  constructor(config: CSVToolkitConfig) {
    this.separator = config.separator ?? ',';
    const { headers, rows } = this.parseCSV(config.data);
    this.headers = headers;
    this.rows = rows;

    this.tools = [
      this.createInfoTool(),
      this.createSearchTool(),
      this.createFilterTool(),
      this.createAggregateTool(),
    ];
  }

  private createInfoTool(): Tool {
    return {
      name: 'csv_info',
      description: 'Get information about the CSV data: column names, row count, and sample data.',
      parameters: [],
      execute: async (): Promise<ToolResult> => {
        const sample = this.rows.slice(0, 3).map(row =>
          this.headers.map((h, i) => `${h}: ${row[i] ?? ''}`).join(', ')
        ).join('\n');

        return {
          output: `Columns: ${this.headers.join(', ')}\nTotal rows: ${this.rows.length}\n\nSample data:\n${sample}`,
        };
      },
    };
  }

  private createSearchTool(): Tool {
    return {
      name: 'csv_search',
      description: 'Search for rows containing a specific value in a given column.',
      parameters: [
        { name: 'column', type: 'string', description: 'Column name to search in', required: true },
        { name: 'value', type: 'string', description: 'Value to search for (case-insensitive partial match)', required: true },
        { name: 'limit', type: 'number', description: 'Max number of results (default: 10)', required: false },
      ],
      execute: async (input: Record<string, unknown>): Promise<ToolResult> => {
        const column = input.column as string;
        const value = (input.value as string)?.toLowerCase();
        const limit = (input.limit as number) ?? 10;

        const colIndex = this.headers.findIndex(h => h.toLowerCase() === column.toLowerCase());
        if (colIndex === -1) {
          return { output: '', error: `Column "${column}" not found. Available: ${this.headers.join(', ')}` };
        }

        const matches = this.rows
          .filter(row => (row[colIndex] ?? '').toLowerCase().includes(value))
          .slice(0, limit);

        if (matches.length === 0) {
          return { output: `No rows found matching "${value}" in column "${column}".` };
        }

        const formatted = matches.map(row =>
          this.headers.map((h, i) => `${h}: ${row[i] ?? ''}`).join(', ')
        ).join('\n');

        return { output: `Found ${matches.length} result(s):\n${formatted}` };
      },
    };
  }

  private createFilterTool(): Tool {
    return {
      name: 'csv_filter',
      description: 'Filter rows by a condition on a column. Supports operators: =, !=, >, <, >=, <=, contains.',
      parameters: [
        { name: 'column', type: 'string', description: 'Column name', required: true },
        { name: 'operator', type: 'string', description: 'Comparison operator: =, !=, >, <, >=, <=, contains', required: true },
        { name: 'value', type: 'string', description: 'Value to compare against', required: true },
        { name: 'limit', type: 'number', description: 'Max results (default: 20)', required: false },
      ],
      execute: async (input: Record<string, unknown>): Promise<ToolResult> => {
        const column = input.column as string;
        const operator = input.operator as string;
        const value = input.value as string;
        const limit = (input.limit as number) ?? 20;

        const colIndex = this.headers.findIndex(h => h.toLowerCase() === column.toLowerCase());
        if (colIndex === -1) {
          return { output: '', error: `Column "${column}" not found. Available: ${this.headers.join(', ')}` };
        }

        const matches = this.rows.filter(row => {
          const cellValue = row[colIndex] ?? '';
          const numCell = parseFloat(cellValue);
          const numValue = parseFloat(value);

          switch (operator) {
            case '=': return cellValue.toLowerCase() === value.toLowerCase();
            case '!=': return cellValue.toLowerCase() !== value.toLowerCase();
            case '>': return !isNaN(numCell) && !isNaN(numValue) && numCell > numValue;
            case '<': return !isNaN(numCell) && !isNaN(numValue) && numCell < numValue;
            case '>=': return !isNaN(numCell) && !isNaN(numValue) && numCell >= numValue;
            case '<=': return !isNaN(numCell) && !isNaN(numValue) && numCell <= numValue;
            case 'contains': return cellValue.toLowerCase().includes(value.toLowerCase());
            default: return false;
          }
        }).slice(0, limit);

        if (matches.length === 0) {
          return { output: `No rows match: ${column} ${operator} ${value}` };
        }

        const formatted = matches.map(row =>
          this.headers.map((h, i) => `${h}: ${row[i] ?? ''}`).join(', ')
        ).join('\n');

        return { output: `Found ${matches.length} result(s):\n${formatted}` };
      },
    };
  }

  private createAggregateTool(): Tool {
    return {
      name: 'csv_aggregate',
      description: 'Perform aggregation on a numeric column. Supports: count, sum, avg, min, max, distinct.',
      parameters: [
        { name: 'column', type: 'string', description: 'Column name to aggregate', required: true },
        { name: 'operation', type: 'string', description: 'Aggregation: count, sum, avg, min, max, distinct', required: true },
      ],
      execute: async (input: Record<string, unknown>): Promise<ToolResult> => {
        const column = input.column as string;
        const operation = input.operation as string;

        const colIndex = this.headers.findIndex(h => h.toLowerCase() === column.toLowerCase());
        if (colIndex === -1) {
          return { output: '', error: `Column "${column}" not found. Available: ${this.headers.join(', ')}` };
        }

        const values = this.rows.map(row => row[colIndex] ?? '').filter(v => v.length > 0);
        const numValues = values.map(parseFloat).filter(n => !isNaN(n));

        switch (operation.toLowerCase()) {
          case 'count':
            return { output: `Count of "${column}": ${values.length}` };
          case 'distinct':
            const unique = [...new Set(values)];
            return { output: `Distinct values in "${column}" (${unique.length}): ${unique.slice(0, 50).join(', ')}${unique.length > 50 ? '...' : ''}` };
          case 'sum':
            if (numValues.length === 0) return { output: '', error: `Column "${column}" has no numeric values.` };
            return { output: `Sum of "${column}": ${numValues.reduce((a, b) => a + b, 0)}` };
          case 'avg':
            if (numValues.length === 0) return { output: '', error: `Column "${column}" has no numeric values.` };
            return { output: `Average of "${column}": ${(numValues.reduce((a, b) => a + b, 0) / numValues.length).toFixed(2)}` };
          case 'min':
            if (numValues.length === 0) return { output: '', error: `Column "${column}" has no numeric values.` };
            return { output: `Min of "${column}": ${Math.min(...numValues)}` };
          case 'max':
            if (numValues.length === 0) return { output: '', error: `Column "${column}" has no numeric values.` };
            return { output: `Max of "${column}": ${Math.max(...numValues)}` };
          default:
            return { output: '', error: `Unknown operation "${operation}". Use: count, sum, avg, min, max, distinct.` };
        }
      },
    };
  }

  private parseCSV(data: string): { headers: string[]; rows: string[][] } {
    const lines = data.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

    const headers = this.parseLine(lines[0]);
    const rows = lines.slice(1).map(line => this.parseLine(line));

    return { headers, rows };
  }

  private parseLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === this.separator && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  }
}
