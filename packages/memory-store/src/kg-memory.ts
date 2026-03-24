import type { Message } from './memory.js';
import type { BaseLLM, Entity, Relation, KnowledgeTriple } from './types.js';

export interface KGMemoryConfig {
  llm: BaseLLM;
  maxMessages?: number;
  maxTriples?: number;
  extractionBatchSize?: number;
  preserveRecentMessages?: number;
}

interface KnowledgeGraph {
  entities: Map<string, Entity>;
  relations: Relation[];
  triples: KnowledgeTriple[];
}

const ENTITY_EXTRACTION_PROMPT = `Extract entities and their relationships from the following conversation.

Conversation:
{conversation}

Return a JSON object with the following structure:
{
  "entities": [
    { "name": "entity name", "type": "PERSON|ORGANIZATION|LOCATION|CONCEPT|PRODUCT|EVENT|OTHER", "attributes": {} }
  ],
  "relations": [
    { "subject": "entity1 name", "predicate": "relationship verb", "object": "entity2 name" }
  ]
}

Only extract clear, factual information. Be concise.

JSON:`;

const QUERY_CONTEXT_PROMPT = `Given the following knowledge graph and query, provide relevant context.

Knowledge Graph:
Entities: {entities}
Relations: {relations}

Query: {query}

Provide a brief, relevant summary of information from the knowledge graph that relates to the query:`;

export class KGMemory {
  private messages: Message[] = [];
  private graph: KnowledgeGraph = {
    entities: new Map(),
    relations: [],
    triples: [],
  };
  private config: Required<KGMemoryConfig>;
  private pendingExtraction: Message[] = [];
  private isExtracting: boolean = false;

  constructor(config: KGMemoryConfig) {
    this.config = {
      llm: config.llm,
      maxMessages: config.maxMessages ?? 100,
      maxTriples: config.maxTriples ?? 500,
      extractionBatchSize: config.extractionBatchSize ?? 5,
      preserveRecentMessages: config.preserveRecentMessages ?? 10,
    };
  }

  async addMessage(message: Message): Promise<void> {
    const storedMessage: Message = {
      ...message,
      timestamp: message.timestamp ?? Date.now(),
    };

    this.messages.push(storedMessage);
    this.pendingExtraction.push(storedMessage);

    if (this.pendingExtraction.length >= this.config.extractionBatchSize) {
      await this.extractKnowledge();
    }

    this.trimMessages();
  }

  async addMessages(messages: Message[]): Promise<void> {
    for (const message of messages) {
      const storedMessage: Message = {
        ...message,
        timestamp: message.timestamp ?? Date.now(),
      };
      this.messages.push(storedMessage);
      this.pendingExtraction.push(storedMessage);
    }

    if (this.pendingExtraction.length >= this.config.extractionBatchSize) {
      await this.extractKnowledge();
    }

    this.trimMessages();
  }

  getHistory(): Message[] {
    return [...this.messages];
  }

  getRecentMessages(count?: number): Message[] {
    const n = count ?? this.config.preserveRecentMessages;
    return this.messages.slice(-n);
  }

  getEntities(): Entity[] {
    return Array.from(this.graph.entities.values());
  }

  getRelations(): Relation[] {
    return [...this.graph.relations];
  }

  getTriples(): KnowledgeTriple[] {
    return [...this.graph.triples];
  }

  getEntity(name: string): Entity | undefined {
    return this.graph.entities.get(name.toLowerCase());
  }

  getRelationsFor(entityName: string): Relation[] {
    const normalized = entityName.toLowerCase();
    return this.graph.relations.filter(
      r => r.subject.toLowerCase() === normalized || r.object.toLowerCase() === normalized
    );
  }

  async queryKnowledge(query: string): Promise<string> {
    if (this.graph.entities.size === 0) {
      return '';
    }

    const entitiesStr = Array.from(this.graph.entities.values())
      .map(e => `${e.name} (${e.type})`)
      .join(', ');

    const relationsStr = this.graph.relations
      .slice(-50)
      .map(r => `${r.subject} ${r.predicate} ${r.object}`)
      .join('; ');

    const prompt = QUERY_CONTEXT_PROMPT
      .replace('{entities}', entitiesStr)
      .replace('{relations}', relationsStr)
      .replace('{query}', query);

    const result = await this.config.llm.generate(prompt);
    return typeof result === 'string' ? result : result.content;
  }

  async getContextForQuery(query: string): Promise<Message[]> {
    const context = await this.queryKnowledge(query);

    if (!context) {
      return this.getRecentMessages();
    }

    const contextMessage: Message = {
      role: 'system',
      content: `[Relevant context from conversation history]\n${context}`,
      timestamp: Date.now(),
      metadata: { isKGContext: true },
    };

    return [contextMessage, ...this.getRecentMessages()];
  }

  getGraphSummary(): { entityCount: number; relationCount: number; tripleCount: number } {
    return {
      entityCount: this.graph.entities.size,
      relationCount: this.graph.relations.length,
      tripleCount: this.graph.triples.length,
    };
  }

  async forceExtraction(): Promise<void> {
    if (this.pendingExtraction.length > 0) {
      await this.extractKnowledge();
    }
  }

  clear(): void {
    this.messages = [];
    this.pendingExtraction = [];
    this.graph = {
      entities: new Map(),
      relations: [],
      triples: [],
    };
  }

  clearGraph(): void {
    this.graph = {
      entities: new Map(),
      relations: [],
      triples: [],
    };
  }

  getMessageCount(): number {
    return this.messages.length;
  }

  private async extractKnowledge(): Promise<void> {
    if (this.isExtracting || this.pendingExtraction.length === 0) return;
    this.isExtracting = true;

    try {
      const messagesToProcess = [...this.pendingExtraction];
      this.pendingExtraction = [];

      const conversationText = messagesToProcess
        .filter(m => m.role !== 'system')
        .map(m => {
          const role = m.role === 'user' ? 'User' : 'Assistant';
          return `${role}: ${m.content}`;
        })
        .join('\n');

      if (!conversationText.trim()) {
        return;
      }

      const prompt = ENTITY_EXTRACTION_PROMPT.replace('{conversation}', conversationText);
      const result = await this.config.llm.generate(prompt);
      const response = typeof result === 'string' ? result : result.content;

      const extracted = this.parseExtractionResponse(response);

      for (const entity of extracted.entities) {
        const key = entity.name.toLowerCase();
        const existing = this.graph.entities.get(key);

        if (existing) {
          existing.attributes = { ...existing.attributes, ...entity.attributes };
        } else {
          this.graph.entities.set(key, entity);
        }
      }

      for (const relation of extracted.relations) {
        const exists = this.graph.relations.some(
          r =>
            r.subject.toLowerCase() === relation.subject.toLowerCase() &&
            r.predicate.toLowerCase() === relation.predicate.toLowerCase() &&
            r.object.toLowerCase() === relation.object.toLowerCase()
        );

        if (!exists) {
          this.graph.relations.push(relation);

          const subjectEntity = this.graph.entities.get(relation.subject.toLowerCase());
          const objectEntity = this.graph.entities.get(relation.object.toLowerCase());

          if (subjectEntity && objectEntity) {
            this.graph.triples.push({
              subject: subjectEntity,
              predicate: relation.predicate,
              object: objectEntity,
              timestamp: Date.now(),
              source: 'conversation',
            });
          }
        }
      }

      this.trimGraph();
    } finally {
      this.isExtracting = false;
    }
  }

  private parseExtractionResponse(response: string): { entities: Entity[]; relations: Relation[] } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { entities: [], relations: [] };
      }

      const parsed = JSON.parse(jsonMatch[0]);

      const entities: Entity[] = (parsed.entities || []).map((e: Record<string, unknown>) => ({
        name: String(e.name || ''),
        type: String(e.type || 'OTHER'),
        attributes: (e.attributes as Record<string, unknown>) || {},
      })).filter((e: Entity) => e.name);

      const relations: Relation[] = (parsed.relations || []).map((r: Record<string, unknown>) => ({
        subject: String(r.subject || ''),
        predicate: String(r.predicate || ''),
        object: String(r.object || ''),
        metadata: (r.metadata as Record<string, unknown>) || {},
      })).filter((r: Relation) => r.subject && r.predicate && r.object);

      return { entities, relations };
    } catch {
      return { entities: [], relations: [] };
    }
  }

  private trimMessages(): void {
    if (this.messages.length > this.config.maxMessages) {
      const overflow = this.messages.length - this.config.maxMessages;
      this.messages = this.messages.slice(overflow);
    }
  }

  private trimGraph(): void {
    if (this.graph.triples.length > this.config.maxTriples) {
      const overflow = this.graph.triples.length - this.config.maxTriples;
      this.graph.triples = this.graph.triples.slice(overflow);

      const activeEntities = new Set<string>();
      for (const triple of this.graph.triples) {
        activeEntities.add(triple.subject.name.toLowerCase());
        activeEntities.add(triple.object.name.toLowerCase());
      }

      for (const key of this.graph.entities.keys()) {
        if (!activeEntities.has(key)) {
          this.graph.entities.delete(key);
        }
      }

      this.graph.relations = this.graph.relations.filter(r => {
        return (
          activeEntities.has(r.subject.toLowerCase()) ||
          activeEntities.has(r.object.toLowerCase())
        );
      });
    }
  }

  toJSON(): object {
    return {
      messages: this.messages,
      graph: {
        entities: Array.from(this.graph.entities.entries()),
        relations: this.graph.relations,
        triples: this.graph.triples,
      },
      config: {
        maxMessages: this.config.maxMessages,
        maxTriples: this.config.maxTriples,
        extractionBatchSize: this.config.extractionBatchSize,
        preserveRecentMessages: this.config.preserveRecentMessages,
      },
    };
  }

  static fromJSON(
    data: {
      messages: Message[];
      graph: {
        entities: [string, Entity][];
        relations: Relation[];
        triples: KnowledgeTriple[];
      };
      config: Partial<KGMemoryConfig>;
    },
    llm: BaseLLM
  ): KGMemory {
    const memory = new KGMemory({ llm, ...data.config });
    memory.messages = data.messages;
    memory.graph = {
      entities: new Map(data.graph.entities),
      relations: data.graph.relations,
      triples: data.graph.triples,
    };
    return memory;
  }
}
