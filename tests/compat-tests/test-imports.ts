/**
 * Test file to verify imports work correctly
 * This file will be compiled with different moduleResolution settings
 */

// Main entry point
import { Orka, Knowledge } from 'orkajs';

// Subpath imports - Adapters
import { OpenAIAdapter } from 'orkajs/adapters/openai';
import { AnthropicAdapter } from 'orkajs/adapters/anthropic';
import { MemoryVectorAdapter } from 'orkajs/adapters/memory';

// Subpath imports - Parsers
import { JSONParser } from 'orkajs/parsers/json';
import { ListParser } from 'orkajs/parsers/list';

// Subpath imports - Cache
import { MemoryCache } from 'orkajs/cache/memory';
import { CachedLLM } from 'orkajs/cache/llm';

// Subpath imports - Templates
import { PromptTemplate } from 'orkajs/templates/prompt';
import { ChatPromptTemplate } from 'orkajs/templates/chat';

// Subpath imports - Splitters
import { RecursiveCharacterTextSplitter } from 'orkajs/splitters/recursive';

// Subpath imports - Agents
import { ReActAgent } from 'orkajs/agent/react';
import { PlanAndExecuteAgent } from 'orkajs/agent/plan-and-execute';

// Subpath imports - Chains
import { RetrievalQAChain } from 'orkajs/chains/retrieval-qa';

// Subpath imports - Errors
import { OrkaError, OrkaErrorCode } from 'orkajs/errors';

// Subpath imports - Types
import type { LLMAdapter, VectorDBAdapter, ChatMessage } from 'orkajs/types';

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
