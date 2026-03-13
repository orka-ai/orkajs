/**
 * VisionAgent - Agent specialized for image understanding tasks
 */

import type { LLMAdapter } from '@orka-js/core';
import type { ImageInput, VisionAnalysisOptions } from '../types.js';
import { analyzeImage, describeImage, extractTextFromImage, isVisionCapable } from '../vision.js';

export interface VisionAgentConfig {
  /** LLM adapter (must support vision) */
  llm: LLMAdapter;
  /** Default system prompt */
  systemPrompt?: string;
  /** Default detail level */
  detail?: 'auto' | 'low' | 'high';
  /** Default max tokens */
  maxTokens?: number;
  /** Default temperature */
  temperature?: number;
}

export interface VisionTask {
  type: 'analyze' | 'describe' | 'ocr' | 'compare' | 'custom';
  image: ImageInput;
  image2?: ImageInput; // For compare tasks
  prompt?: string;
  options?: VisionAnalysisOptions;
}

export interface VisionTaskResult {
  task: VisionTask['type'];
  result: string | object;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  latencyMs: number;
}

/**
 * VisionAgent - Specialized agent for image understanding
 */
export class VisionAgent {
  private llm: LLMAdapter;
  private systemPrompt: string;
  private detail: 'auto' | 'low' | 'high';
  private maxTokens: number;
  private temperature: number;

  constructor(config: VisionAgentConfig) {
    if (!isVisionCapable(config.llm)) {
      throw new Error(`LLM adapter "${config.llm.name}" does not support vision`);
    }

    this.llm = config.llm;
    this.systemPrompt = config.systemPrompt ?? 'You are a helpful vision assistant that analyzes images accurately and thoroughly.';
    this.detail = config.detail ?? 'auto';
    this.maxTokens = config.maxTokens ?? 1024;
    this.temperature = config.temperature ?? 0.3;
  }

  /**
   * Analyze an image with a custom prompt
   */
  async analyze(image: ImageInput, prompt?: string): Promise<VisionTaskResult> {
    const startTime = Date.now();
    const result = await analyzeImage(this.llm, image, {
      prompt,
      systemPrompt: this.systemPrompt,
      detail: this.detail,
      maxTokens: this.maxTokens,
      temperature: this.temperature,
    });

    return {
      task: 'analyze',
      result: result.analysis,
      usage: result.usage,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Get a structured description of an image
   */
  async describe(image: ImageInput): Promise<VisionTaskResult> {
    const startTime = Date.now();
    const result = await describeImage(this.llm, image, {
      systemPrompt: this.systemPrompt,
      detail: this.detail,
      maxTokens: this.maxTokens,
      temperature: this.temperature,
    });

    return {
      task: 'describe',
      result,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Extract text from an image (OCR)
   */
  async extractText(image: ImageInput): Promise<VisionTaskResult> {
    const startTime = Date.now();
    const result = await extractTextFromImage(this.llm, image, {
      systemPrompt: this.systemPrompt,
      detail: 'high', // Use high detail for OCR
      maxTokens: this.maxTokens,
      temperature: 0.1, // Low temperature for accuracy
    });

    return {
      task: 'ocr',
      result: result.text,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Run a batch of vision tasks
   */
  async runTasks(tasks: VisionTask[]): Promise<VisionTaskResult[]> {
    const results: VisionTaskResult[] = [];

    for (const task of tasks) {
      switch (task.type) {
        case 'analyze':
          results.push(await this.analyze(task.image, task.prompt));
          break;
        case 'describe':
          results.push(await this.describe(task.image));
          break;
        case 'ocr':
          results.push(await this.extractText(task.image));
          break;
        case 'custom':
          if (!task.prompt) {
            throw new Error('Custom tasks require a prompt');
          }
          results.push(await this.analyze(task.image, task.prompt));
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
    }

    return results;
  }

  /**
   * Answer a question about an image
   */
  async ask(image: ImageInput, question: string): Promise<string> {
    const result = await this.analyze(image, question);
    return result.result as string;
  }
}
