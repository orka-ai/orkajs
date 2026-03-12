/**
 * EXHAUSTIVE TEST - All @orkajs/* package imports
 * Tests every single scoped package export
 */

// ============== CORE ==============
import { Knowledge, OrkaError, OrkaErrorCode, generateId, chunkDocument, chunkDocuments } from '@orkajs/core';
import type { LLMAdapter, VectorDBAdapter, ChatMessage, LLMResult, Document, Chunk } from '@orkajs/core';

// ============== LLM ADAPTERS ==============
import { OpenAIAdapter } from '@orkajs/openai';
import { AnthropicAdapter } from '@orkajs/anthropic';
import { MistralAdapter } from '@orkajs/mistral';
import { OllamaAdapter } from '@orkajs/ollama';

// ============== VECTORDB ADAPTERS ==============
import { MemoryVectorAdapter } from '@orkajs/memory';
import { PineconeAdapter } from '@orkajs/pinecone';
import { QdrantAdapter } from '@orkajs/qdrant';
import { ChromaAdapter } from '@orkajs/chroma';

// ============== AGENT ==============
import { ReActAgent, PlanAndExecuteAgent, OpenAIFunctionsAgent, StructuredChatAgent } from '@orkajs/agent';
import { SQLToolkit, CSVToolkit, HITLAgent, MemoryCheckpointStore } from '@orkajs/agent';

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
} from '@orkajs/tools';

// ============== CACHE ==============
import { MemoryCache, RedisCache, CachedLLM, CachedEmbeddings } from '@orkajs/cache';

// ============== RESILIENCE ==============
import { FallbackLLM, ResilientLLM } from '@orkajs/resilience';

// ============== ORCHESTRATION ==============
import { ConsensusLLM, RaceLLM, RouterLLM, LoadBalancerLLM } from '@orkajs/orchestration';

// ============== WORKFLOW ==============
import { Workflow } from '@orkajs/workflow';

// ============== GRAPH ==============
import { GraphWorkflow } from '@orkajs/graph';

// ============== EVALUATION ==============
import { TestRunner, Evaluator } from '@orkajs/evaluation';

// ============== OBSERVABILITY ==============
import { Tracer } from '@orkajs/observability';

// ============== PROMPTS ==============
import { PromptRegistry, FilePromptPersistence } from '@orkajs/prompts';

// ============== MEMORY STORE ==============
import { Memory, SessionMemory } from '@orkajs/memory-store';

// ============== VERIFICATION ==============
console.log('=== EXHAUSTIVE @orkajs/* IMPORT TEST ===\n');

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
