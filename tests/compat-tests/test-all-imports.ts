/**
 * EXHAUSTIVE TEST - All module imports
 * Tests every single export from the dist/ folder
 */

// ============== MAIN ENTRY ==============
import { Orka, Knowledge } from '../../dist/index.js';

// ============== ADAPTERS ==============
import { OpenAIAdapter } from '../../dist/adapters/openai.js';
import { AnthropicAdapter } from '../../dist/adapters/anthropic.js';
import { MemoryVectorAdapter } from '../../dist/adapters/memory.js';
import { MistralAdapter } from '../../dist/adapters/mistral.js';
import { OllamaAdapter } from '../../dist/adapters/ollama.js';
import { PineconeAdapter } from '../../dist/adapters/pinecone.js';
import { QdrantAdapter } from '../../dist/adapters/qdrant.js';
import { ChromaAdapter } from '../../dist/adapters/chroma.js';

// ============== AGENT ==============
import { ReActAgent } from '../../dist/agent/react.js';
import { PlanAndExecuteAgent } from '../../dist/agent/plan-and-execute.js';
import { OpenAIFunctionsAgent } from '../../dist/agent/openai-functions.js';
import { StructuredChatAgent } from '../../dist/agent/structured-chat.js';
import { SQLToolkit } from '../../dist/agent/toolkits/sql.js';
import { CSVToolkit } from '../../dist/agent/toolkits/csv.js';
import { HITLAgent, MemoryCheckpointStore } from '../../dist/agent/hitl.js';

// ============== CACHE ==============
import { MemoryCache } from '../../dist/cache/memory-cache.js';
import { RedisCache } from '../../dist/cache/redis-cache.js';
import { CachedLLM } from '../../dist/cache/cached-llm.js';
import { CachedEmbeddings } from '../../dist/cache/cached-embeddings.js';

// ============== CHAINS ==============
import { RetrievalQAChain } from '../../dist/chains/retrieval-qa.js';
import { ConversationalRetrievalChain } from '../../dist/chains/conversational-retrieval.js';
import { SummarizationChain } from '../../dist/chains/summarization.js';
import { QAChain } from '../../dist/chains/qa.js';

// ============== CORE ==============
import { Orka as OrkaCore } from '../../dist/core/orka.js';
import { Knowledge as KnowledgeCore } from '../../dist/core/knowledge.js';

// ============== ERRORS ==============
import { OrkaError, OrkaErrorCode } from '../../dist/errors/index.js';

// ============== EVALUATION ==============
import { TestRunner } from '../../dist/evaluation/test-runner.js';
import { Evaluator } from '../../dist/evaluation/evaluator.js';
import * as metrics from '../../dist/evaluation/metrics.js';
import * as assertions from '../../dist/evaluation/assertions.js';
import * as reporters from '../../dist/evaluation/reporters.js';

// ============== GRAPH ==============
import { GraphWorkflow } from '../../dist/graph/graph-workflow.js';
import * as graphHelpers from '../../dist/graph/helpers.js';

// ============== LOADERS ==============
import { TextLoader } from '../../dist/loaders/text-loader.js';
import { CSVLoader } from '../../dist/loaders/csv-loader.js';
import { JSONLoader } from '../../dist/loaders/json-loader.js';
import { MarkdownLoader } from '../../dist/loaders/markdown-loader.js';
import { PDFLoader } from '../../dist/loaders/pdf-loader.js';
import { DirectoryLoader } from '../../dist/loaders/directory-loader.js';

// ============== MEMORY ==============
import { Memory } from '../../dist/memory/memory.js';
import { SessionMemory } from '../../dist/memory/session-memory.js';

// ============== OBSERVABILITY ==============
import { Tracer } from '../../dist/observability/tracer.js';

// ============== ORCHESTRATION ==============
import { ConsensusLLM } from '../../dist/orchestration/consensus.js';
import { RaceLLM } from '../../dist/orchestration/race.js';
import { RouterLLM } from '../../dist/orchestration/router.js';
import { LoadBalancerLLM } from '../../dist/orchestration/load-balancer.js';

// ============== PARSERS ==============
import { JSONParser } from '../../dist/parsers/json-parser.js';
import { ListParser } from '../../dist/parsers/list-parser.js';
import { XMLParser } from '../../dist/parsers/xml-parser.js';
import { CSVParser } from '../../dist/parsers/csv-parser.js';
import { CommaSeparatedListParser } from '../../dist/parsers/comma-separated-list-parser.js';
import { StructuredOutputParser } from '../../dist/parsers/structured-output-parser.js';
import { AutoFixParser } from '../../dist/parsers/auto-fix-parser.js';

// ============== PROMPTS ==============
import { PromptRegistry } from '../../dist/prompts/registry.js';
import { FilePromptPersistence } from '../../dist/prompts/file-persistence.js';

// ============== RESILIENCE ==============
import { FallbackLLM } from '../../dist/resilience/fallback.js';
import { ResilientLLM } from '../../dist/resilience/resilient-llm.js';
import * as retry from '../../dist/resilience/retry.js';

// ============== RETRIEVERS ==============
import { VectorRetriever } from '../../dist/retrievers/vector-retriever.js';
import { MultiQueryRetriever } from '../../dist/retrievers/multi-query-retriever.js';
import { ContextualCompressionRetriever } from '../../dist/retrievers/contextual-compression-retriever.js';
import { EnsembleRetriever } from '../../dist/retrievers/ensemble-retriever.js';
import { ParentDocumentRetriever } from '../../dist/retrievers/parent-document-retriever.js';
import { SelfQueryRetriever } from '../../dist/retrievers/self-query-retriever.js';
import { BM25Retriever } from '../../dist/retrievers/bm25-retriever.js';

// ============== SPLITTERS ==============
import { RecursiveCharacterTextSplitter } from '../../dist/splitters/recursive-character-text-splitter.js';
import { MarkdownTextSplitter } from '../../dist/splitters/markdown-text-splitter.js';
import { CodeTextSplitter } from '../../dist/splitters/code-text-splitter.js';
import { TokenTextSplitter } from '../../dist/splitters/token-text-splitter.js';

// ============== TEMPLATES ==============
import { PromptTemplate } from '../../dist/templates/prompt-template.js';
import { ChatPromptTemplate } from '../../dist/templates/chat-prompt-template.js';
import { FewShotPromptTemplate } from '../../dist/templates/few-shot-prompt-template.js';

// ============== TYPES ==============
import type { LLMAdapter, VectorDBAdapter, ChatMessage, LLMResult } from '../../dist/types/index.js';

// ============== UTILS ==============
import { generateId } from '../../dist/utils/id.js';

// ============== WORKFLOW ==============
import { Workflow } from '../../dist/workflow/workflow.js';
import * as workflowSteps from '../../dist/workflow/steps.js';

// ============== VERIFICATION ==============
console.log('=== EXHAUSTIVE IMPORT TEST ===\n');

const modules = {
  // Main
  Orka, Knowledge,
  // Adapters
  OpenAIAdapter, AnthropicAdapter, MemoryVectorAdapter, MistralAdapter,
  OllamaAdapter, PineconeAdapter, QdrantAdapter, ChromaAdapter,
  // Agent
  ReActAgent, PlanAndExecuteAgent, OpenAIFunctionsAgent, StructuredChatAgent,
  SQLToolkit, CSVToolkit, HITLAgent, MemoryCheckpointStore,
  // Cache
  MemoryCache, RedisCache, CachedLLM, CachedEmbeddings,
  // Chains
  RetrievalQAChain, ConversationalRetrievalChain, SummarizationChain, QAChain,
  // Core
  OrkaCore, KnowledgeCore,
  // Errors
  OrkaError, OrkaErrorCode,
  // Evaluation
  TestRunner, Evaluator, metrics, assertions, reporters,
  // Graph
  GraphWorkflow, graphHelpers,
  // Loaders
  TextLoader, CSVLoader, JSONLoader, MarkdownLoader, PDFLoader, DirectoryLoader,
  // Memory
  Memory, SessionMemory,
  // Observability
  Tracer,
  // Orchestration
  ConsensusLLM, RaceLLM, RouterLLM, LoadBalancerLLM,
  // Parsers
  JSONParser, ListParser, XMLParser, CSVParser, CommaSeparatedListParser,
  StructuredOutputParser, AutoFixParser,
  // Prompts
  PromptRegistry, FilePromptPersistence,
  // Resilience
  FallbackLLM, ResilientLLM, retry,
  // Retrievers
  VectorRetriever, MultiQueryRetriever, ContextualCompressionRetriever,
  EnsembleRetriever, ParentDocumentRetriever, SelfQueryRetriever, BM25Retriever,
  // Splitters
  RecursiveCharacterTextSplitter, MarkdownTextSplitter, CodeTextSplitter, TokenTextSplitter,
  // Templates
  PromptTemplate, ChatPromptTemplate, FewShotPromptTemplate,
  // Utils
  generateId,
  // Workflow
  Workflow, workflowSteps,
};

let passed = 0;
let failed = 0;

for (const [name, mod] of Object.entries(modules)) {
  if (mod !== undefined) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.log(`❌ ${name} - UNDEFINED`);
    failed++;
  }
}

console.log(`\n=== RESULTS ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed === 0) {
  console.log('\n🎉 ALL IMPORTS SUCCESSFUL!');
} else {
  console.log('\n⚠️  SOME IMPORTS FAILED');
  process.exit(1);
}
