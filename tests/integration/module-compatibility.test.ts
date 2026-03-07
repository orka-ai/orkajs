import { describe, it, expect } from 'vitest';

/**
 * Module Compatibility Tests
 * 
 * These tests verify that all exports are properly accessible
 * and that the module structure is correct for both ESM and CJS.
 */

describe('Module Exports', () => {
  describe('Main entry point', () => {
    it('should export Orka class', async () => {
      const { Orka } = await import('../../src/index.js');
      expect(Orka).toBeDefined();
      expect(typeof Orka).toBe('function');
    });

    it('should export Knowledge class', async () => {
      const { Knowledge } = await import('../../src/index.js');
      expect(Knowledge).toBeDefined();
    });

    it('should export core types', async () => {
      const exports = await import('../../src/index.js');
      expect(exports).toHaveProperty('Orka');
    });
  });

  describe('Adapters subpath exports', () => {
    it('should export OpenAIAdapter', async () => {
      const { OpenAIAdapter } = await import('../../src/adapters/openai/index.js');
      expect(OpenAIAdapter).toBeDefined();
      expect(typeof OpenAIAdapter).toBe('function');
    });

    it('should export AnthropicAdapter', async () => {
      const { AnthropicAdapter } = await import('../../src/adapters/anthropic/index.js');
      expect(AnthropicAdapter).toBeDefined();
    });

    it('should export MemoryVectorAdapter', async () => {
      const { MemoryVectorAdapter } = await import('../../src/adapters/memory/index.js');
      expect(MemoryVectorAdapter).toBeDefined();
    });

    it('should export MistralAdapter', async () => {
      const { MistralAdapter } = await import('../../src/adapters/mistral/index.js');
      expect(MistralAdapter).toBeDefined();
    });

    it('should export OllamaAdapter', async () => {
      const { OllamaAdapter } = await import('../../src/adapters/ollama/index.js');
      expect(OllamaAdapter).toBeDefined();
    });
  });

  describe('Parsers subpath exports', () => {
    it('should export JSONParser', async () => {
      const { JSONParser } = await import('../../src/parsers/json-parser.js');
      expect(JSONParser).toBeDefined();
    });

    it('should export ListParser', async () => {
      const { ListParser } = await import('../../src/parsers/list-parser.js');
      expect(ListParser).toBeDefined();
    });

    it('should export XMLParser', async () => {
      const { XMLParser } = await import('../../src/parsers/xml-parser.js');
      expect(XMLParser).toBeDefined();
    });

    it('should export CSVParser', async () => {
      const { CSVParser } = await import('../../src/parsers/csv-parser.js');
      expect(CSVParser).toBeDefined();
    });
  });

  describe('Cache subpath exports', () => {
    it('should export MemoryCache', async () => {
      const { MemoryCache } = await import('../../src/cache/memory-cache.js');
      expect(MemoryCache).toBeDefined();
    });

    it('should export CachedLLM', async () => {
      const { CachedLLM } = await import('../../src/cache/cached-llm.js');
      expect(CachedLLM).toBeDefined();
    });
  });

  describe('Templates subpath exports', () => {
    it('should export PromptTemplate', async () => {
      const { PromptTemplate } = await import('../../src/templates/prompt-template.js');
      expect(PromptTemplate).toBeDefined();
    });

    it('should export ChatPromptTemplate', async () => {
      const { ChatPromptTemplate } = await import('../../src/templates/chat-prompt-template.js');
      expect(ChatPromptTemplate).toBeDefined();
    });

    it('should export FewShotPromptTemplate', async () => {
      const { FewShotPromptTemplate } = await import('../../src/templates/few-shot-prompt-template.js');
      expect(FewShotPromptTemplate).toBeDefined();
    });
  });

  describe('Splitters subpath exports', () => {
    it('should export RecursiveCharacterTextSplitter', async () => {
      const { RecursiveCharacterTextSplitter } = await import('../../src/splitters/recursive-character-text-splitter.js');
      expect(RecursiveCharacterTextSplitter).toBeDefined();
    });

    it('should export MarkdownTextSplitter', async () => {
      const { MarkdownTextSplitter } = await import('../../src/splitters/markdown-text-splitter.js');
      expect(MarkdownTextSplitter).toBeDefined();
    });

    it('should export CodeTextSplitter', async () => {
      const { CodeTextSplitter } = await import('../../src/splitters/code-text-splitter.js');
      expect(CodeTextSplitter).toBeDefined();
    });
  });

  describe('Loaders subpath exports', () => {
    it('should export TextLoader', async () => {
      const { TextLoader } = await import('../../src/loaders/text-loader.js');
      expect(TextLoader).toBeDefined();
    });

    it('should export CSVLoader', async () => {
      const { CSVLoader } = await import('../../src/loaders/csv-loader.js');
      expect(CSVLoader).toBeDefined();
    });

    it('should export JSONLoader', async () => {
      const { JSONLoader } = await import('../../src/loaders/json-loader.js');
      expect(JSONLoader).toBeDefined();
    });

    it('should export MarkdownLoader', async () => {
      const { MarkdownLoader } = await import('../../src/loaders/markdown-loader.js');
      expect(MarkdownLoader).toBeDefined();
    });
  });

  describe('Agents subpath exports', () => {
    it('should export ReActAgent', async () => {
      const { ReActAgent } = await import('../../src/agent/react-agent.js');
      expect(ReActAgent).toBeDefined();
    });

    it('should export PlanAndExecuteAgent', async () => {
      const { PlanAndExecuteAgent } = await import('../../src/agent/plan-and-execute-agent.js');
      expect(PlanAndExecuteAgent).toBeDefined();
    });

    it('should export OpenAIFunctionsAgent', async () => {
      const { OpenAIFunctionsAgent } = await import('../../src/agent/openai-functions-agent.js');
      expect(OpenAIFunctionsAgent).toBeDefined();
    });

    it('should export StructuredChatAgent', async () => {
      const { StructuredChatAgent } = await import('../../src/agent/structured-chat-agent.js');
      expect(StructuredChatAgent).toBeDefined();
    });
  });

  describe('Chains subpath exports', () => {
    it('should export RetrievalQAChain', async () => {
      const { RetrievalQAChain } = await import('../../src/chains/retrieval-qa-chain.js');
      expect(RetrievalQAChain).toBeDefined();
    });

    it('should export ConversationalRetrievalChain', async () => {
      const { ConversationalRetrievalChain } = await import('../../src/chains/conversational-retrieval-chain.js');
      expect(ConversationalRetrievalChain).toBeDefined();
    });

    it('should export SummarizationChain', async () => {
      const { SummarizationChain } = await import('../../src/chains/summarization-chain.js');
      expect(SummarizationChain).toBeDefined();
    });
  });

  describe('Orchestration subpath exports', () => {
    it('should export ConsensusLLM', async () => {
      const { ConsensusLLM } = await import('../../src/orchestration/consensus.js');
      expect(ConsensusLLM).toBeDefined();
    });

    it('should export RaceLLM', async () => {
      const { RaceLLM } = await import('../../src/orchestration/race.js');
      expect(RaceLLM).toBeDefined();
    });

    it('should export RouterLLM', async () => {
      const { RouterLLM } = await import('../../src/orchestration/router.js');
      expect(RouterLLM).toBeDefined();
    });

    it('should export LoadBalancerLLM', async () => {
      const { LoadBalancerLLM } = await import('../../src/orchestration/load-balancer.js');
      expect(LoadBalancerLLM).toBeDefined();
    });
  });

  describe('Resilience subpath exports', () => {
    it('should export retry utilities', async () => {
      const resilience = await import('../../src/resilience/retry.js');
      expect(resilience).toBeDefined();
    });

    it('should export FallbackLLM', async () => {
      const { FallbackLLM } = await import('../../src/resilience/fallback.js');
      expect(FallbackLLM).toBeDefined();
    });

    it('should export ResilientLLM', async () => {
      const { ResilientLLM } = await import('../../src/resilience/resilient-llm.js');
      expect(ResilientLLM).toBeDefined();
    });
  });

  describe('Graph subpath exports', () => {
    it('should export GraphWorkflow', async () => {
      const { GraphWorkflow } = await import('../../src/graph/graph-workflow.js');
      expect(GraphWorkflow).toBeDefined();
    });

    it('should export graph helpers', async () => {
      const helpers = await import('../../src/graph/helpers.js');
      expect(helpers).toBeDefined();
    });
  });

  describe('Evaluation subpath exports', () => {
    it('should export TestRunner', async () => {
      const { TestRunner } = await import('../../src/evaluation/test-runner.js');
      expect(TestRunner).toBeDefined();
    });

    it('should export metrics', async () => {
      const metrics = await import('../../src/evaluation/metrics.js');
      expect(metrics).toBeDefined();
    });

    it('should export assertions', async () => {
      const assertions = await import('../../src/evaluation/assertions.js');
      expect(assertions).toBeDefined();
    });
  });

  describe('Types subpath exports', () => {
    it('should export type definitions', async () => {
      const types = await import('../../src/types/index.js');
      expect(types).toBeDefined();
    });
  });

  describe('Errors subpath exports', () => {
    it('should export OrkaError', async () => {
      const { OrkaError } = await import('../../src/errors/index.js');
      expect(OrkaError).toBeDefined();
    });
  });
});

describe('Module Instantiation', () => {
  it('should instantiate MemoryCache without errors', async () => {
    const { MemoryCache } = await import('../../src/cache/memory-cache.js');
    const cache = new MemoryCache();
    expect(cache).toBeDefined();
    expect(cache.name).toBe('memory-cache');
  });

  it('should instantiate MemoryVectorAdapter without errors', async () => {
    const { MemoryVectorAdapter } = await import('../../src/adapters/memory/index.js');
    const db = new MemoryVectorAdapter();
    expect(db).toBeDefined();
    expect(db.name).toBe('memory');
  });

  it('should instantiate JSONParser without errors', async () => {
    const { JSONParser } = await import('../../src/parsers/json-parser.js');
    const parser = new JSONParser();
    expect(parser).toBeDefined();
  });

  it('should instantiate PromptTemplate without errors', async () => {
    const { PromptTemplate } = await import('../../src/templates/prompt-template.js');
    const template = new PromptTemplate({
      template: 'Hello {{name}}',
      inputVariables: ['name'],
    });
    expect(template).toBeDefined();
  });

  it('should instantiate RecursiveCharacterTextSplitter without errors', async () => {
    const { RecursiveCharacterTextSplitter } = await import('../../src/splitters/recursive-character-text-splitter.js');
    const splitter = new RecursiveCharacterTextSplitter();
    expect(splitter).toBeDefined();
  });
});
