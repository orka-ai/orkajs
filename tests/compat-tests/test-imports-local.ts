/**
 * Test file to verify imports work correctly using local dist
 */

// Main entry point
import { Orka, Knowledge } from '../../dist/index.js';

// Subpath imports - Adapters
import { OpenAIAdapter } from '../../dist/adapters/openai.js';
import { AnthropicAdapter } from '../../dist/adapters/anthropic.js';
import { MemoryVectorAdapter } from '../../dist/adapters/memory.js';

// Subpath imports - Parsers
import { JSONParser } from '../../dist/parsers/json-parser.js';
import { ListParser } from '../../dist/parsers/list-parser.js';

// Subpath imports - Cache
import { MemoryCache } from '../../dist/cache/memory-cache.js';
import { CachedLLM } from '../../dist/cache/cached-llm.js';

// Subpath imports - Templates
import { PromptTemplate } from '../../dist/templates/prompt-template.js';
import { ChatPromptTemplate } from '../../dist/templates/chat-prompt-template.js';

// Subpath imports - Splitters
import { RecursiveCharacterTextSplitter } from '../../dist/splitters/recursive-character-text-splitter.js';

// Subpath imports - Agents
import { ReActAgent } from '../../dist/agent/react.js';
import { PlanAndExecuteAgent } from '../../dist/agent/plan-and-execute.js';

// Subpath imports - Chains
import { RetrievalQAChain } from '../../dist/chains/retrieval-qa.js';

// Subpath imports - Errors
import { OrkaError, OrkaErrorCode } from '../../dist/errors/index.js';

// Verify exports exist
console.log('Testing imports...');
console.log('Orka:', typeof Orka);
console.log('Knowledge:', typeof Knowledge);
console.log('OpenAIAdapter:', typeof OpenAIAdapter);
console.log('AnthropicAdapter:', typeof AnthropicAdapter);
console.log('MemoryVectorAdapter:', typeof MemoryVectorAdapter);
console.log('JSONParser:', typeof JSONParser);
console.log('ListParser:', typeof ListParser);
console.log('MemoryCache:', typeof MemoryCache);
console.log('CachedLLM:', typeof CachedLLM);
console.log('PromptTemplate:', typeof PromptTemplate);
console.log('ChatPromptTemplate:', typeof ChatPromptTemplate);
console.log('RecursiveCharacterTextSplitter:', typeof RecursiveCharacterTextSplitter);
console.log('ReActAgent:', typeof ReActAgent);
console.log('PlanAndExecuteAgent:', typeof PlanAndExecuteAgent);
console.log('RetrievalQAChain:', typeof RetrievalQAChain);
console.log('OrkaError:', typeof OrkaError);
console.log('OrkaErrorCode:', typeof OrkaErrorCode);

// Test instantiation
const cache = new MemoryCache();
console.log('MemoryCache instance:', cache.name);

const parser = new JSONParser();
console.log('JSONParser instance created');

const template = PromptTemplate.fromTemplate('Hello {{name}}');
console.log('PromptTemplate instance created');

const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 100, chunkOverlap: 20 });
console.log('RecursiveCharacterTextSplitter instance created');

console.log('\n✅ All imports successful!');
