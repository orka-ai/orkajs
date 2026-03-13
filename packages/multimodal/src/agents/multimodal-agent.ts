/**
 * MultimodalAgent - Agent that combines vision and audio capabilities
 */

import type { LLMAdapter, ContentPart } from '@orka-js/core';
import type { ImageInput, AudioInput, AudioLLMAdapter } from '../types.js';
import { isVisionCapable } from '../vision.js';
import { isAudioCapable, transcribeAudio } from '../audio.js';

export interface MultimodalAgentConfig {
  /** LLM adapter for text and vision */
  llm: LLMAdapter;
  /** Audio adapter for transcription/TTS (optional) */
  audioAdapter?: AudioLLMAdapter;
  /** Default system prompt */
  systemPrompt?: string;
  /** Default max tokens */
  maxTokens?: number;
  /** Default temperature */
  temperature?: number;
}

export interface MultimodalInput {
  /** Text input */
  text?: string;
  /** Image inputs */
  images?: ImageInput[];
  /** Audio inputs (will be transcribed) */
  audio?: AudioInput[];
}

export interface MultimodalResult {
  /** Response text */
  response: string;
  /** Transcribed audio (if any) */
  transcriptions?: string[];
  /** Token usage */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Processing time */
  latencyMs: number;
}

/**
 * MultimodalAgent - Combines vision and audio for complex multimodal tasks
 */
export class MultimodalAgent {
  private llm: LLMAdapter;
  private audioAdapter?: AudioLLMAdapter;
  private systemPrompt: string;
  private maxTokens: number;
  private temperature: number;
  
  readonly supportsVision: boolean;
  readonly supportsAudio: boolean;

  constructor(config: MultimodalAgentConfig) {
    this.llm = config.llm;
    this.audioAdapter = config.audioAdapter;
    this.systemPrompt = config.systemPrompt ?? 'You are a helpful multimodal assistant that can understand text, images, and audio.';
    this.maxTokens = config.maxTokens ?? 2048;
    this.temperature = config.temperature ?? 0.7;
    
    this.supportsVision = isVisionCapable(config.llm);
    this.supportsAudio = config.audioAdapter ? isAudioCapable(config.audioAdapter) : false;
  }

  /**
   * Process multimodal input and generate a response
   */
  async process(input: MultimodalInput): Promise<MultimodalResult> {
    const startTime = Date.now();
    const transcriptions: string[] = [];

    // Build content parts
    const contentParts: ContentPart[] = [];

    // Add text
    if (input.text) {
      contentParts.push({ type: 'text', text: input.text });
    }

    // Add images
    if (input.images && input.images.length > 0) {
      if (!this.supportsVision) {
        throw new Error('LLM adapter does not support vision');
      }
      
      for (const image of input.images) {
        contentParts.push(this.imageToContentPart(image));
      }
    }

    // Transcribe audio and add as text
    if (input.audio && input.audio.length > 0) {
      if (!this.supportsAudio || !this.audioAdapter) {
        throw new Error('Audio adapter not configured or does not support transcription');
      }

      for (const audio of input.audio) {
        const result = await transcribeAudio(this.audioAdapter, audio);
        transcriptions.push(result.text);
        contentParts.push({ 
          type: 'text', 
          text: `[Transcribed Audio]: ${result.text}` 
        });
      }
    }

    if (contentParts.length === 0) {
      throw new Error('No input provided');
    }

    // Generate response
    const result = await this.llm.generate('', {
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: contentParts },
      ],
      maxTokens: this.maxTokens,
      temperature: this.temperature,
    });

    return {
      response: result.content,
      transcriptions: transcriptions.length > 0 ? transcriptions : undefined,
      usage: result.usage,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Ask a question with multimodal context
   */
  async ask(question: string, context?: { images?: ImageInput[]; audio?: AudioInput[] }): Promise<string> {
    const result = await this.process({
      text: question,
      images: context?.images,
      audio: context?.audio,
    });
    return result.response;
  }

  /**
   * Analyze images with a question
   */
  async analyzeImages(images: ImageInput[], question: string): Promise<string> {
    const result = await this.process({
      text: question,
      images,
    });
    return result.response;
  }

  /**
   * Process audio and respond
   */
  async processAudio(audio: AudioInput[], question?: string): Promise<MultimodalResult> {
    return this.process({
      text: question ?? 'Please analyze the following audio transcription and provide insights.',
      audio,
    });
  }

  /**
   * Combined vision + audio analysis
   */
  async analyzeMultimodal(
    images: ImageInput[],
    audio: AudioInput[],
    question: string
  ): Promise<MultimodalResult> {
    return this.process({
      text: question,
      images,
      audio,
    });
  }

  private imageToContentPart(image: ImageInput): ContentPart {
    switch (image.type) {
      case 'url':
        return {
          type: 'image_url',
          image_url: { url: image.url, detail: image.detail ?? 'auto' },
        };
      case 'base64':
        return {
          type: 'image_base64',
          data: image.data,
          mimeType: image.mimeType,
        };
      case 'file':
        throw new Error('File-based images must be converted to base64 before processing');
      default:
        throw new Error('Unknown image input type');
    }
  }
}
