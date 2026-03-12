import { describe, it, expect } from 'vitest';

/**
 * Module Compatibility Tests
 * 
 * These tests verify that all @orka-js/* scoped package exports
 * are properly accessible via workspace imports.
 */

describe('@orka-js/* Package Exports', () => {
  describe('@orka-js/core', () => {
    it('should export Knowledge class', async () => {
      const { Knowledge } = await import('@orka-js/core');
      expect(Knowledge).toBeDefined();
    });

    it('should export OrkaError', async () => {
      const { OrkaError, OrkaErrorCode } = await import('@orka-js/core');
      expect(OrkaError).toBeDefined();
      expect(OrkaErrorCode).toBeDefined();
    });

    it('should export chunker utilities', async () => {
      const { chunkDocument, chunkDocuments } = await import('@orka-js/core');
      expect(chunkDocument).toBeDefined();
      expect(chunkDocuments).toBeDefined();
    });

    it('should export generateId', async () => {
      const { generateId } = await import('@orka-js/core');
      expect(generateId).toBeDefined();
      expect(typeof generateId).toBe('function');
    });
  });

  describe('@orka-js/openai', () => {
    it('should export OpenAIAdapter', async () => {
      const { OpenAIAdapter } = await import('@orka-js/openai');
      expect(OpenAIAdapter).toBeDefined();
      expect(typeof OpenAIAdapter).toBe('function');
    });
  });

  describe('@orka-js/anthropic', () => {
    it('should export AnthropicAdapter', async () => {
      const { AnthropicAdapter } = await import('@orka-js/anthropic');
      expect(AnthropicAdapter).toBeDefined();
    });
  });

  describe('@orka-js/memory', () => {
    it('should export MemoryVectorAdapter', async () => {
      const { MemoryVectorAdapter } = await import('@orka-js/memory');
      expect(MemoryVectorAdapter).toBeDefined();
    });
  });

  describe('@orka-js/tools', () => {
    it('should export parsers', async () => {
      const { JSONParser, ListParser, XMLParser, CSVParser } = await import('@orka-js/tools');
      expect(JSONParser).toBeDefined();
      expect(ListParser).toBeDefined();
      expect(XMLParser).toBeDefined();
      expect(CSVParser).toBeDefined();
    });

    it('should export loaders', async () => {
      const { TextLoader, CSVLoader, JSONLoader } = await import('@orka-js/tools');
      expect(TextLoader).toBeDefined();
      expect(CSVLoader).toBeDefined();
      expect(JSONLoader).toBeDefined();
    });

    it('should export splitters', async () => {
      const { RecursiveCharacterTextSplitter, MarkdownTextSplitter } = await import('@orka-js/tools');
      expect(RecursiveCharacterTextSplitter).toBeDefined();
      expect(MarkdownTextSplitter).toBeDefined();
    });

    it('should export templates', async () => {
      const { PromptTemplate, ChatPromptTemplate } = await import('@orka-js/tools');
      expect(PromptTemplate).toBeDefined();
      expect(ChatPromptTemplate).toBeDefined();
    });

    it('should export chains', async () => {
      const { RetrievalQAChain, QAChain } = await import('@orka-js/tools');
      expect(RetrievalQAChain).toBeDefined();
      expect(QAChain).toBeDefined();
    });

    it('should export retrievers', async () => {
      const { VectorRetriever, MultiQueryRetriever, BM25Retriever } = await import('@orka-js/tools');
      expect(VectorRetriever).toBeDefined();
      expect(MultiQueryRetriever).toBeDefined();
      expect(BM25Retriever).toBeDefined();
    });
  });

  describe('@orka-js/cache', () => {
    it('should export cache classes', async () => {
      const { MemoryCache, CachedLLM, CachedEmbeddings } = await import('@orka-js/cache');
      expect(MemoryCache).toBeDefined();
      expect(CachedLLM).toBeDefined();
      expect(CachedEmbeddings).toBeDefined();
    });
  });

  describe('@orka-js/agent', () => {
    it('should export agent classes', async () => {
      const { ReActAgent, PlanAndExecuteAgent, HITLAgent } = await import('@orka-js/agent');
      expect(ReActAgent).toBeDefined();
      expect(PlanAndExecuteAgent).toBeDefined();
      expect(HITLAgent).toBeDefined();
    });
  });

  describe('@orka-js/orchestration', () => {
    it('should export orchestration classes', async () => {
      const { ConsensusLLM, RaceLLM, RouterLLM, LoadBalancerLLM } = await import('@orka-js/orchestration');
      expect(ConsensusLLM).toBeDefined();
      expect(RaceLLM).toBeDefined();
      expect(RouterLLM).toBeDefined();
      expect(LoadBalancerLLM).toBeDefined();
    });
  });

  describe('@orka-js/resilience', () => {
    it('should export resilience classes', async () => {
      const { FallbackLLM, ResilientLLM } = await import('@orka-js/resilience');
      expect(FallbackLLM).toBeDefined();
      expect(ResilientLLM).toBeDefined();
    });
  });

  describe('@orka-js/graph', () => {
    it('should export GraphWorkflow', async () => {
      const { GraphWorkflow } = await import('@orka-js/graph');
      expect(GraphWorkflow).toBeDefined();
    });
  });

  describe('@orka-js/workflow', () => {
    it('should export Workflow', async () => {
      const { Workflow } = await import('@orka-js/workflow');
      expect(Workflow).toBeDefined();
    });
  });

  describe('@orka-js/evaluation', () => {
    it('should export evaluation classes', async () => {
      const { TestRunner, Evaluator } = await import('@orka-js/evaluation');
      expect(TestRunner).toBeDefined();
      expect(Evaluator).toBeDefined();
    });
  });

  describe('@orka-js/observability', () => {
    it('should export Tracer', async () => {
      const { Tracer } = await import('@orka-js/observability');
      expect(Tracer).toBeDefined();
    });
  });

  describe('@orka-js/prompts', () => {
    it('should export PromptRegistry', async () => {
      const { PromptRegistry } = await import('@orka-js/prompts');
      expect(PromptRegistry).toBeDefined();
    });
  });

  describe('@orka-js/memory-store', () => {
    it('should export Memory and SessionMemory', async () => {
      const { Memory, SessionMemory } = await import('@orka-js/memory-store');
      expect(Memory).toBeDefined();
      expect(SessionMemory).toBeDefined();
    });
  });
});

describe('Module Instantiation', () => {
  it('should instantiate MemoryCache without errors', async () => {
    const { MemoryCache } = await import('@orka-js/cache');
    const cache = new MemoryCache();
    expect(cache).toBeDefined();
    expect(cache.name).toBe('memory-cache');
  });

  it('should instantiate MemoryVectorAdapter without errors', async () => {
    const { MemoryVectorAdapter } = await import('@orka-js/memory');
    const db = new MemoryVectorAdapter();
    expect(db).toBeDefined();
    expect(db.name).toBe('memory');
  });

  it('should instantiate JSONParser without errors', async () => {
    const { JSONParser } = await import('@orka-js/tools');
    const parser = new JSONParser();
    expect(parser).toBeDefined();
  });

  it('should instantiate PromptTemplate without errors', async () => {
    const { PromptTemplate } = await import('@orka-js/tools');
    const template = new PromptTemplate({
      template: 'Hello {{name}}',
      inputVariables: ['name'],
    });
    expect(template).toBeDefined();
  });

  it('should instantiate RecursiveCharacterTextSplitter without errors', async () => {
    const { RecursiveCharacterTextSplitter } = await import('@orka-js/tools');
    const splitter = new RecursiveCharacterTextSplitter();
    expect(splitter).toBeDefined();
  });
});
