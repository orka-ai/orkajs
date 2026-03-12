import type { VectorSearchResult, LLMAdapter, VectorDBAdapter } from '@orka-js/core';
import type { Retriever } from './types.js';

export interface SelfQueryRetrieverOptions {
  llm: LLMAdapter;
  vectorDB: VectorDBAdapter;
  metadataFields: MetadataFieldInfo[];
  topK?: number;
  minScore?: number;
}

export interface MetadataFieldInfo {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  description: string;
  enumValues?: string[];
}

interface ParsedQuery {
  semanticQuery: string;
  filter: Record<string, unknown>;
}

export class SelfQueryRetriever implements Retriever {
  private llm: LLMAdapter;
  private vectorDB: VectorDBAdapter;
  private metadataFields: MetadataFieldInfo[];
  private topK: number;
  private minScore?: number;

  constructor(options: SelfQueryRetrieverOptions) {
    this.llm = options.llm;
    this.vectorDB = options.vectorDB;
    this.metadataFields = options.metadataFields;
    this.topK = options.topK ?? 5;
    this.minScore = options.minScore;
  }

  async retrieve(query: string, collection: string): Promise<VectorSearchResult[]> {
    // Step 1: Use LLM to extract semantic query + metadata filters
    const parsed = await this.parseQuery(query);

    // Step 2: Embed the semantic part
    const [embedding] = await this.llm.embed([parsed.semanticQuery]);

    // Step 3: Search with metadata filter
    const results = await this.vectorDB.search(collection, embedding, {
      topK: this.topK,
      minScore: this.minScore,
      filter: Object.keys(parsed.filter).length > 0 ? parsed.filter : undefined,
    });

    return results.map(r => ({
      ...r,
      metadata: {
        ...r.metadata,
        retrieverType: 'self-query',
        extractedFilter: parsed.filter,
        semanticQuery: parsed.semanticQuery,
      },
    }));
  }

  private async parseQuery(query: string): Promise<ParsedQuery> {
    const fieldsDescription = this.metadataFields
      .map(f => {
        let desc = `- "${f.name}" (${f.type}): ${f.description}`;
        if (f.enumValues) {
          desc += ` [possible values: ${f.enumValues.join(', ')}]`;
        }
        return desc;
      })
      .join('\n');

    const prompt = `Given the following user query, extract:
1. A semantic search query (the core meaning to search for)
2. Metadata filters (structured conditions on metadata fields)

Available metadata fields:
${fieldsDescription}

User query: "${query}"

Respond ONLY with a JSON object in this exact format:
{
  "semanticQuery": "the semantic part of the query",
  "filter": { "fieldName": "value" }
}

If no filters can be extracted, use an empty filter object {}.
Only include filters for fields that are clearly mentioned in the query.`;

    const result = await this.llm.generate(prompt, {
      temperature: 0,
      maxTokens: 256,
    });

    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as ParsedQuery;
        return {
          semanticQuery: parsed.semanticQuery || query,
          filter: parsed.filter || {},
        };
      }
    } catch {
      // Fallback: use original query with no filters
    }

    return { semanticQuery: query, filter: {} };
  }

  getMetadataFields(): MetadataFieldInfo[] {
    return [...this.metadataFields];
  }
}
