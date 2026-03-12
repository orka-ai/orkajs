import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    // Loaders (each tree-shakeable independently)
    'loaders/index': 'src/loaders/index.ts',
    'loaders/text-loader': 'src/loaders/text-loader.ts',
    'loaders/csv-loader': 'src/loaders/csv-loader.ts',
    'loaders/json-loader': 'src/loaders/json-loader.ts',
    'loaders/markdown-loader': 'src/loaders/markdown-loader.ts',
    'loaders/pdf-loader': 'src/loaders/pdf-loader.ts',
    'loaders/directory-loader': 'src/loaders/directory-loader.ts',

    // Splitters
    'splitters/index': 'src/splitters/index.ts',
    'splitters/recursive-character-text-splitter': 'src/splitters/recursive-character-text-splitter.ts',
    'splitters/markdown-text-splitter': 'src/splitters/markdown-text-splitter.ts',
    'splitters/code-text-splitter': 'src/splitters/code-text-splitter.ts',
    'splitters/token-text-splitter': 'src/splitters/token-text-splitter.ts',

    // Retrievers
    'retrievers/index': 'src/retrievers/index.ts',
    'retrievers/multi-query-retriever': 'src/retrievers/multi-query-retriever.ts',
    'retrievers/contextual-compression-retriever': 'src/retrievers/contextual-compression-retriever.ts',
    'retrievers/ensemble-retriever': 'src/retrievers/ensemble-retriever.ts',
    'retrievers/vector-retriever': 'src/retrievers/vector-retriever.ts',
    'retrievers/parent-document-retriever': 'src/retrievers/parent-document-retriever.ts',
    'retrievers/self-query-retriever': 'src/retrievers/self-query-retriever.ts',
    'retrievers/bm25-retriever': 'src/retrievers/bm25-retriever.ts',

    // Parsers
    'parsers/index': 'src/parsers/index.ts',
    'parsers/json-parser': 'src/parsers/json-parser.ts',
    'parsers/structured-output-parser': 'src/parsers/structured-output-parser.ts',
    'parsers/list-parser': 'src/parsers/list-parser.ts',
    'parsers/auto-fix-parser': 'src/parsers/auto-fix-parser.ts',
    'parsers/xml-parser': 'src/parsers/xml-parser.ts',
    'parsers/csv-parser': 'src/parsers/csv-parser.ts',
    'parsers/comma-separated-list-parser': 'src/parsers/comma-separated-list-parser.ts',

    // Cache
    'cache/index': 'src/cache/index.ts',
    'cache/memory-cache': 'src/cache/memory-cache.ts',
    'cache/redis-cache': 'src/cache/redis-cache.ts',
    'cache/cached-llm': 'src/cache/cached-llm.ts',
    'cache/cached-embeddings': 'src/cache/cached-embeddings.ts',

    // Templates
    'templates/index': 'src/templates/index.ts',
    'templates/prompt-template': 'src/templates/prompt-template.ts',
    'templates/chat-prompt-template': 'src/templates/chat-prompt-template.ts',
    'templates/few-shot-prompt-template': 'src/templates/few-shot-prompt-template.ts',

    // Chains
    'chains/index': 'src/chains/index.ts',
    'chains/retrieval-qa': 'src/chains/retrieval-qa-chain.ts',
    'chains/conversational-retrieval': 'src/chains/conversational-retrieval-chain.ts',
    'chains/summarization': 'src/chains/summarization-chain.ts',
    'chains/qa': 'src/chains/qa-chain.ts',

    // Agents
    'agent/index': 'src/agent/index.ts',
    'agent/react': 'src/agent/react-agent.ts',
    'agent/plan-and-execute': 'src/agent/plan-and-execute-agent.ts',
    'agent/openai-functions': 'src/agent/openai-functions-agent.ts',
    'agent/structured-chat': 'src/agent/structured-chat-agent.ts',
    'agent/hitl': 'src/agent/hitl/index.ts',
    'agent/toolkits/sql': 'src/agent/toolkits/sql-toolkit.ts',
    'agent/toolkits/csv': 'src/agent/toolkits/csv-toolkit.ts',

    //Resilience
    'resilience/index': 'src/resilience/index.ts',
    'resilience/retry': 'src/resilience/retry.ts',
    'resilience/fallback': 'src/resilience/fallback.ts',
    'resilience/resilient-llm': 'src/resilience/resilient-llm.ts',

    //Observability
    'observability/index': 'src/observability/index.ts',
    'observability/tracer': 'src/observability/tracer.ts',

    //Memory
    'memory/index': 'src/memory/index.ts',
    'memory/memory': 'src/memory/memory.ts',
    'memory/session-memory': 'src/memory/session-memory.ts',

    //Graph
    'graph/index': 'src/graph/index.ts',
    'graph/helpers': 'src/graph/helpers.ts',
    'graph/graph-workflow': 'src/graph/graph-workflow.ts',

    //Orchestration
    'orchestration/index': 'src/orchestration/index.ts',
    'orchestration/consensus': 'src/orchestration/consensus.ts',
    'orchestration/router': 'src/orchestration/router.ts',
    'orchestration/race': 'src/orchestration/race.ts',
    'orchestration/load-balancer': 'src/orchestration/load-balancer.ts',
    
    //Core
    'core/index': 'src/core/index.ts',
    'core/orka': 'src/core/orka.ts',
    'core/chunker': 'src/core/chunker.ts',
    'core/knowledge': 'src/core/knowledge.ts',

    //Evaluation
    'evaluation/index': 'src/evaluation/index.ts',
    'evaluation/evaluator': 'src/evaluation/evaluator.ts',
    'evaluation/metrics': 'src/evaluation/metrics.ts',
    'evaluation/test-runner': 'src/evaluation/test-runner.ts',
    'evaluation/assertions': 'src/evaluation/assertions.ts',
    'evaluation/reporters': 'src/evaluation/reporters.ts',

    // Existing adapters
    'adapters/index': 'src/adapters/index.ts',
    'adapters/openai': 'src/adapters/openai/index.ts',
    'adapters/anthropic': 'src/adapters/anthropic/index.ts',
    'adapters/pinecone': 'src/adapters/pinecone/index.ts',
    'adapters/qdrant': 'src/adapters/qdrant/index.ts',
    'adapters/memory': 'src/adapters/memory/index.ts',
    'adapters/mistral': 'src/adapters/mistral/index.ts',
    'adapters/ollama': 'src/adapters/ollama/index.ts',
    'adapters/chroma': 'src/adapters/chroma/index.ts',

    //Workflow
    'workflow/index': 'src/workflow/index.ts',
    'workflow/steps': 'src/workflow/steps.ts',
    'workflow/workflow': 'src/workflow/workflow.ts',

    //Prompts
    'prompts/index': 'src/prompts/index.ts',
    'prompts/registry': 'src/prompts/registry.ts',
    'prompts/file-persistence': 'src/prompts/file-persistence.ts',
    
    //Types
    'types/index': 'src/types/index.ts',

    //Errors
    'errors/index': 'src/errors/index.ts',

    //Utils
    'utils/id': 'src/utils/id.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  treeshake: true,
  clean: true,
  sourcemap: true,
  external: [
    'openai',
    '@anthropic-ai/sdk',
    '@pinecone-database/pinecone',
    '@qdrant/js-client-rest',
    'chromadb',
    'pdf-parse',
    'redis',
  ],
});
