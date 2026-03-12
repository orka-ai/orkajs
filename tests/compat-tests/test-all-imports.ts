/**
 * EXHAUSTIVE TEST - All @orka-js/* package imports
 * Tests every single scoped package export
 */

// ============== CORE ==============
import { Knowledge, OrkaError, OrkaErrorCode, generateId, chunkDocument, chunkDocuments } from '@orka-js/core';
import type { LLMAdapter, VectorDBAdapter, ChatMessage, LLMResult, Document, Chunk } from '@orka-js/core';

// ============== LLM ADAPTERS ==============
import { OpenAIAdapter } from '@orka-js/openai';
import { AnthropicAdapter } from '@orka-js/anthropic';
import { MistralAdapter } from '@orka-js/mistral';
import { OllamaAdapter } from '@orka-js/ollama';

// ============== VECTORDB ADAPTERS ==============
import { MemoryVectorAdapter } from '@orka-js/memory';
import { PineconeAdapter } from '@orka-js/pinecone';
import { QdrantAdapter } from '@orka-js/qdrant';
import { ChromaAdapter } from '@orka-js/chroma';

// ============== AGENT ==============
import { ReActAgent, PlanAndExecuteAgent, OpenAIFunctionsAgent, StructuredChatAgent } from '@orka-js/agent';
import { SQLToolkit, CSVToolkit, HITLAgent, MemoryCheckpointStore } from '@orka-js/agent';

// ============== TOOLS (loaders, splitters, retrievers, parsers, chains, templates) ==============
import {
  TextLoader, CSVLoader, JSONLoader, MarkdownLoader, PDFLoader, DirectoryLoader,
  RecursiveCharacterTextSplitter, MarkdownTextSplitter, CodeTextSplitter, TokenTextSplitter,
  VectorRetriever, MultiQueryRetriever, ContextualCompressionRetriever, EnsembleRetriever,
  ParentDocumentRetriever, SelfQueryRetriever, BM25Retriever,
  JSONParser, ListParser, XMLParser, CSVParser, CommaSeparatedListParser,
  StructuredOutputParser, AutoFixParser,
  RetrievalQAChain, ConversationalRetrievalChain, SummarizationChain, QAChain,
  PromptTemplate, ChatPromptTemplate, FewShotPromptTemplate,
} from '@orka-js/tools';

// ============== CACHE ==============
import { MemoryCache, RedisCache, CachedLLM, CachedEmbeddings } from '@orka-js/cache';

// ============== RESILIENCE ==============
import { FallbackLLM, ResilientLLM } from '@orka-js/resilience';

// ============== ORCHESTRATION ==============
import { ConsensusLLM, RaceLLM, RouterLLM, LoadBalancerLLM } from '@orka-js/orchestration';

// ============== WORKFLOW ==============
import { Workflow } from '@orka-js/workflow';

// ============== GRAPH ==============
import { GraphWorkflow } from '@orka-js/graph';

// ============== EVALUATION ==============
import { TestRunner, Evaluator } from '@orka-js/evaluation';

// ============== OBSERVABILITY ==============
import { Tracer } from '@orka-js/observability';

// ============== PROMPTS ==============
import { PromptRegistry, FilePromptPersistence } from '@orka-js/prompts';

// ============== MEMORY STORE ==============
import { Memory, SessionMemory } from '@orka-js/memory-store';

// ============== VERIFICATION ==============
console.log('=== EXHAUSTIVE @orka-js/* IMPORT TEST ===\n');

const modules = {
  // Core
  Knowledge, OrkaError, OrkaErrorCode, generateId, chunkDocument, chunkDocuments,
  // LLM Adapters
  OpenAIAdapter, AnthropicAdapter, MistralAdapter, OllamaAdapter,
  // VectorDB Adapters
  MemoryVectorAdapter, PineconeAdapter, QdrantAdapter, ChromaAdapter,
  // Agent
  ReActAgent, PlanAndExecuteAgent, OpenAIFunctionsAgent, StructuredChatAgent,
  SQLToolkit, CSVToolkit, HITLAgent, MemoryCheckpointStore,
  // Tools
  TextLoader, CSVLoader, JSONLoader, MarkdownLoader, PDFLoader, DirectoryLoader,
  RecursiveCharacterTextSplitter, MarkdownTextSplitter, CodeTextSplitter, TokenTextSplitter,
  VectorRetriever, MultiQueryRetriever, ContextualCompressionRetriever, EnsembleRetriever,
  ParentDocumentRetriever, SelfQueryRetriever, BM25Retriever,
  JSONParser, ListParser, XMLParser, CSVParser, CommaSeparatedListParser,
  StructuredOutputParser, AutoFixParser,
  RetrievalQAChain, ConversationalRetrievalChain, SummarizationChain, QAChain,
  PromptTemplate, ChatPromptTemplate, FewShotPromptTemplate,
  // Cache
  MemoryCache, RedisCache, CachedLLM, CachedEmbeddings,
  // Resilience
  FallbackLLM, ResilientLLM,
  // Orchestration
  ConsensusLLM, RaceLLM, RouterLLM, LoadBalancerLLM,
  // Workflow
  Workflow,
  // Graph
  GraphWorkflow,
  // Evaluation
  TestRunner, Evaluator,
  // Observability
  Tracer,
  // Prompts
  PromptRegistry, FilePromptPersistence,
  // Memory Store
  Memory, SessionMemory,
};

let passed = 0;
let failed = 0;

for (const [name, mod] of Object.entries(modules)) {
  if (mod !== undefined) {
    console.log(`  ${name}`);
    passed++;
  } else {
    console.log(`  ${name} - UNDEFINED`);
    failed++;
  }
}

console.log(`\n=== RESULTS ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed === 0) {
  console.log('\n ALL IMPORTS SUCCESSFUL!');
} else {
  console.log('\n  SOME IMPORTS FAILED');
  process.exit(1);
}
