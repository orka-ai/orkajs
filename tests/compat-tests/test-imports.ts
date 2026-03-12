/**
 * Test file to verify @orka-js/* scoped package imports
 * This file will be compiled with different moduleResolution settings
 */

// Scoped package imports
import { Knowledge, OrkaError, OrkaErrorCode } from '@orka-js/core';
import type { LLMAdapter, VectorDBAdapter, ChatMessage } from '@orka-js/core';
import { OpenAIAdapter } from '@orka-js/openai';
import { AnthropicAdapter } from '@orka-js/anthropic';
import { MemoryVectorAdapter } from '@orka-js/memory';
import { JSONParser, ListParser, PromptTemplate, ChatPromptTemplate, RecursiveCharacterTextSplitter } from '@orka-js/tools';
import { MemoryCache, CachedLLM } from '@orka-js/cache';
import { ReActAgent, PlanAndExecuteAgent } from '@orka-js/agent';
import { RetrievalQAChain } from '@orka-js/tools';

// Verify exports exist
console.log('Testing @orka-js/* imports...');
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

console.log('\nAll imports successful!');
