import { describe, it, expect } from 'vitest';

/**
 * Module Compatibility Tests
 * 
 * These tests verify that all @orkajs/* scoped package exports
 * are properly accessible via workspace imports.
 */

describe('@orkajs/* Package Exports', () => {
  describe('@orkajs/core', () => {
    it('should export Knowledge class', async () => {
      const { Knowledge } = await import('@orkajs/core');
      expect(Knowledge).toBeDefined();
    });

    it('should export OrkaError', async () => {
      const { OrkaError, OrkaErrorCode } = await import('@orkajs/core');
      expect(OrkaError).toBeDefined();
      expect(OrkaErrorCode).toBeDefined();
    });

    it('should export chunker utilities', async () => {
      const { chunkDocument, chunkDocuments } = await import('@orkajs/core');
      expect(chunkDocument).toBeDefined();
      expect(chunkDocuments).toBeDefined();
    });

    it('should export generateId', async () => {
      const { generateId } = await import('@orkajs/core');
      expect(generateId).toBeDefined();
      expect(typeof generateId).toBe('function');
    });
  });

  describe('@orkajs/openai', () => {
    it('should export OpenAIAdapter', async () => {
      const { OpenAIAdapter } = await import('@orkajs/openai');
      expect(OpenAIAdapter).toBeDefined();
      expect(typeof OpenAIAdapter).toBe('function');
    });
  });

  describe('@orkajs/anthropic', () => {
    it('should export AnthropicAdapter', async () => {
      const { AnthropicAdapter } = await import('@orkajs/anthropic');
      expect(AnthropicAdapter).toBeDefined();
    });
  });

  describe('@orkajs/memory', () => {
    it('should export MemoryVectorAdapter', async () => {
      const { MemoryVectorAdapter } = await import('@orkajs/memory');
      expect(MemoryVectorAdapter).toBeDefined();
    });
  });

  describe('@orkajs/tools', () => {
    it('should export parsers', async () => {
      const { JSONParser, ListParser, XMLParser, CSVParser } = await import('@orkajs/tools');
      expect(JSONParser).toBeDefined();
      expect(ListParser).toBeDefined();
      expect(XMLParser).toBeDefined();
      expect(CSVParser).toBeDefined();
    });

    it('should export loaders', async () => {
      const { TextLoader, CSVLoader, JSONLoader } = await import('@orkajs/tools');
      expect(TextLoader).toBeDefined();
      expect(CSVLoader).toBeDefined();
      expect(JSONLoader).toBeDefined();
    });

    it('should export splitters', async () => {
      const { RecursiveCharacterTextSplitter, MarkdownTextSplitter } = await import('@orkajs/tools');
      expect(RecursiveCharacterTextSplitter).toBeDefined();
      expect(MarkdownTextSplitter).toBeDefined();
    });

    it('should export templates', async () => {
      const { PromptTemplate, ChatPromptTemplate } = await import('@orkajs/tools');
      expect(PromptTemplate).toBeDefined();
      expect(ChatPromptTemplate).toBeDefined();
    });

    it('should export chains', async () => {
      const { RetrievalQAChain, QAChain } = await import('@orkajs/tools');
      expect(RetrievalQAChain).toBeDefined();
      expect(QAChain).toBeDefined();
    });

    it('should export retrievers', async () => {
      const { VectorRetriever, MultiQueryRetriever, BM25Retriever } = await import('@orkajs/tools');
      expect(VectorRetriever).toBeDefined();
      expect(MultiQueryRetriever).toBeDefined();
      expect(BM25Retriever).toBeDefined();
    });
  });

  describe('@orkajs/cache', () => {
    it('should export cache classes', async () => {
      const { MemoryCache, CachedLLM, CachedEmbeddings } = await import('@orkajs/cache');
      expect(MemoryCache).toBeDefined();
      expect(CachedLLM).toBeDefined();
      expect(CachedEmbeddings).toBeDefined();
    });
  });

  describe('@orkajs/agent', () => {
    it('should export agent classes', async () => {
      const { ReActAgent, PlanAndExecuteAgent, HITLAgent } = await import('@orkajs/agent');
      expect(ReActAgent).toBeDefined();
      expect(PlanAndExecuteAgent).toBeDefined();
      expect(HITLAgent).toBeDefined();
    });
  });

  describe('@orkajs/orchestration', () => {
    it('should export orchestration classes', async () => {
      const { ConsensusLLM, RaceLLM, RouterLLM, LoadBalancerLLM } = await import('@orkajs/orchestration');
      expect(ConsensusLLM).toBeDefined();
      expect(RaceLLM).toBeDefined();
      expect(RouterLLM).toBeDefined();
      expect(LoadBalancerLLM).toBeDefined();
    });
  });

  describe('@orkajs/resilience', () => {
    it('should export resilience classes', async () => {
      const { FallbackLLM, ResilientLLM } = await import('@orkajs/resilience');
      expect(FallbackLLM).toBeDefined();
      expect(ResilientLLM).toBeDefined();
    });
  });

  describe('@orkajs/graph', () => {
    it('should export GraphWorkflow', async () => {
      const { GraphWorkflow } = await import('@orkajs/graph');
      expect(GraphWorkflow).toBeDefined();
    });
  });

  describe('@orkajs/workflow', () => {
    it('should export Workflow', async () => {
      const { Workflow } = await import('@orkajs/workflow');
      expect(Workflow).toBeDefined();
    });
  });

  describe('@orkajs/evaluation', () => {
    it('should export evaluation classes', async () => {
      const { TestRunner, Evaluator } = await import('@orkajs/evaluation');
      expect(TestRunner).toBeDefined();
      expect(Evaluator).toBeDefined();
    });
  });

  describe('@orkajs/observability', () => {
    it('should export Tracer', async () => {
      const { Tracer } = await import('@orkajs/observability');
      expect(Tracer).toBeDefined();
    });
  });

  describe('@orkajs/prompts', () => {
    it('should export PromptRegistry', async () => {
      const { PromptRegistry } = await import('@orkajs/prompts');
      expect(PromptRegistry).toBeDefined();
    });
  });

  describe('@orkajs/memory-store', () => {
    it('should export Memory and SessionMemory', async () => {
      const { Memory, SessionMemory } = await import('@orkajs/memory-store');
      expect(Memory).toBeDefined();
      expect(SessionMemory).toBeDefined();
    });
  });
});

describe('Module Instantiation', () => {
  it('should instantiate MemoryCache without errors', async () => {
    const { MemoryCache } = await import('@orkajs/cache');
    const cache = new MemoryCache();
    expect(cache).toBeDefined();
    expect(cache.name).toBe('memory-cache');
  });

  it('should instantiate MemoryVectorAdapter without errors', async () => {
    const { MemoryVectorAdapter } = await import('@orkajs/memory');
    const db = new MemoryVectorAdapter();
    expect(db).toBeDefined();
    expect(db.name).toBe('memory');
  });

  it('should instantiate JSONParser without errors', async () => {
    const { JSONParser } = await import('@orkajs/tools');
    const parser = new JSONParser();
    expect(parser).toBeDefined();
  });

  it('should instantiate PromptTemplate without errors', async () => {
    const { PromptTemplate } = await import('@orkajs/tools');
    const template = new PromptTemplate({
      template: 'Hello {{name}}',
      inputVariables: ['name'],
    });
    expect(template).toBeDefined();
  });

  it('should instantiate RecursiveCharacterTextSplitter without errors', async () => {
    const { RecursiveCharacterTextSplitter } = await import('@orkajs/tools');
    const splitter = new RecursiveCharacterTextSplitter();
    expect(splitter).toBeDefined();
  });
});
