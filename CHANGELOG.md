# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-10-15

### Added
- Fix issue importing modules

## [1.0.1] - 2026-10-15

### Fixed
- Fixed Discord link in README

## [1.0.0] - 2026-03-02

### Added

#### Core
- `createOrka()` - Main entry point with intent-based API
- `orka.ask()` - RAG-powered Q&A with automatic context retrieval
- `orka.generate()` - Direct LLM generation
- `orka.knowledge.create()` - Knowledge base creation with automatic chunking
- `orka.knowledge.search()` - Semantic search with metadata filtering

#### LLM Adapters
- `OpenAIAdapter` - GPT-4, GPT-4o, GPT-4o-mini with multimodal support
- `AnthropicAdapter` - Claude 3.5 Sonnet, Claude 3 Opus with vision
- `MistralAdapter` - Mistral Large, Medium, Small
- `OllamaAdapter` - Local models (Llama, Mistral, etc.)

#### Vector Database Adapters
- `MemoryVectorAdapter` - In-memory for development
- `PineconeAdapter` - Pinecone cloud vector database
- `QdrantAdapter` - Qdrant vector database
- `ChromaAdapter` - Chroma vector database

#### Agents
- `orka.agent()` - Structured agents with tools and policies
- `ReActAgent` - Reasoning + Acting loop
- `PlanAndExecuteAgent` - Plan first, execute steps
- `OpenAIFunctionsAgent` - JSON function calling format
- `StructuredChatAgent` - JSON in/out with schema validation
- `SQLToolkit` - SQL database interaction tools
- `CSVToolkit` - CSV file analysis tools

#### Workflows
- `orka.workflow()` - Multi-step pipelines
- Built-in steps: `plan()`, `retrieve()`, `generate()`, `verify()`, `improve()`, `custom()`
- `orka.graph()` - Graph-based workflows with conditional branching
- Node types: `startNode`, `endNode`, `actionNode`, `conditionNode`, `llmNode`, `retrieveNode`
- Mermaid diagram export via `graph.toMermaid()`

#### Memory
- `orka.memory()` - Single conversation memory
- `orka.sessions()` - Multi-user session management with TTL
- Strategies: `sliding_window`, `buffer`, `summary`

#### Evaluation
- `orka.evaluate()` - Built-in evaluation system
- Metrics: `relevance`, `correctness`, `faithfulness`, `hallucination`, `coherence`, `conciseness`
- `TestRunner` - CI/CD integration with assertions
- Reporters: Console, JSON, JUnit

#### Orchestration
- `RouterLLM` - Route requests by condition
- `ConsensusLLM` - Best-of-N with judge
- `RaceLLM` - Fastest response wins
- `LoadBalancerLLM` - Round-robin, weighted, random distribution

#### Resilience
- `withRetry()` - Exponential backoff retry
- `FallbackLLM` - Multi-provider fallback chain
- `ResilientLLM` - Wrapper with automatic retry
- Timeout support on all adapters via `timeoutMs`

#### Caching
- `MemoryCache` - In-memory LRU cache
- `RedisCache` - Redis-backed cache with TTL
- `CachedLLM` - LLM response caching
- `CachedEmbeddings` - Embedding caching

#### Document Processing
- **Loaders**: Text, CSV, JSON, Markdown, PDF, Directory
- **Splitters**: RecursiveCharacter, Markdown, Code, Token
- **Retrievers**: Vector, MultiQuery, ContextualCompression, Ensemble, ParentDocument, SelfQuery, BM25
- **Parsers**: JSON, Structured (Zod), List, AutoFix, XML, CSV, CommaSeparatedList

#### Chains
- `RetrievalQAChain` - RAG Q&A
- `ConversationalRetrievalChain` - Chat with memory
- `SummarizationChain` - Document summarization
- `QAChain` - Simple Q&A

#### Templates
- `PromptTemplate` - Variable substitution
- `ChatPromptTemplate` - Multi-message templates
- `FewShotPromptTemplate` - Example-based prompts

#### Observability
- `Tracer` - Trace LLM calls with hooks
- Event hooks: `onTraceStart`, `onTraceEnd`, `onEvent`, `onError`
- Memory leak protection with `maxTraces` and `traceTtlMs`

#### Prompt Versioning
- `PromptRegistry` - Version control for prompts
- `FilePersistence` - File-based prompt storage
- Diff and rollback support

#### Security
- SQL injection protection in `SQLToolkit`
- SSRF protection for URL fetching
- Secure ID generation with `crypto.randomBytes()`

### Security
- All adapters support `timeoutMs` with AbortController
- SHA-256 hashing for cache keys
- Input validation on all public APIs

---

## [0.1.0] - 2026-01-15

### Added
- Initial development release
- Basic RAG functionality
- OpenAI adapter prototype
