/**
 * Multimodal types for OrkaJS
 */

import type { LLMAdapter, ContentPart } from '@orka-js/core';

/**
 * Image input - URL, base64, or file path
 */
export type ImageInput =
  | { type: 'url'; url: string; detail?: 'auto' | 'low' | 'high' }
  | { type: 'base64'; data: string; mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' }
  | { type: 'file'; path: string };

/**
 * Audio input - URL, base64, ArrayBuffer, or Blob
 */
export type AudioInput =
  | { type: 'url'; url: string }
  | { type: 'base64'; data: string; format?: 'wav' | 'mp3' | 'ogg' | 'flac' }
  | { type: 'buffer'; data: ArrayBuffer }
  | { type: 'blob'; data: Blob };

/**
 * Vision analysis options
 */
export interface VisionAnalysisOptions {
  /** Custom prompt for analysis */
  prompt?: string;
  /** System prompt for the LLM */
  systemPrompt?: string;
  /** Detail level for image processing */
  detail?: 'auto' | 'low' | 'high';
  /** Maximum tokens for response */
  maxTokens?: number;
  /** Temperature for generation */
  temperature?: number;
}

/**
 * Vision analysis result
 */
export interface VisionAnalysisResult {
  /** Analysis text */
  analysis: string;
  /** Token usage */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Model used */
  model: string;
  /** Processing time in ms */
  latencyMs: number;
}

/**
 * Image description result
 */
export interface ImageDescription {
  /** Short description */
  description: string;
  /** Detected objects */
  objects?: string[];
  /** Detected text (if any) */
  text?: string[];
  /** Dominant colors */
  colors?: string[];
  /** Scene type */
  scene?: string;
  /** Confidence score (0-1) */
  confidence?: number;
}

/**
 * OCR result from image
 */
export interface OCRResult {
  /** Extracted text */
  text: string;
  /** Detected language */
  language?: string;
  /** Text blocks with positions */
  blocks?: Array<{
    text: string;
    confidence: number;
    boundingBox?: { x: number; y: number; width: number; height: number };
  }>;
  /** Processing time in ms */
  latencyMs: number;
}

/**
 * Audio processing options
 */
export interface AudioProcessingOptions {
  /** Language hint (ISO-639-1 code) */
  language?: string;
  /** Prompt to guide transcription */
  prompt?: string;
  /** Include word-level timestamps */
  includeTimestamps?: boolean;
  /** Temperature for transcription */
  temperature?: number;
}

/**
 * Audio processing result
 */
export interface AudioProcessingResult {
  /** Transcribed text */
  text: string;
  /** Detected language */
  language?: string;
  /** Audio duration in seconds */
  duration?: number;
  /** Word-level timestamps */
  words?: Array<{ word: string; start: number; end: number }>;
  /** Segment-level timestamps */
  segments?: Array<{ id: number; text: string; start: number; end: number }>;
  /** Processing time in ms */
  latencyMs: number;
}

/**
 * Multimodal message for agents
 */
export interface MultimodalMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentPart[];
  /** Optional image attachments */
  images?: ImageInput[];
  /** Optional audio attachments */
  audio?: AudioInput[];
}

/**
 * Cross-modal retrieval options
 */
export interface CrossModalRetrievalOptions {
  /** Query text */
  query: string;
  /** Query image (optional) */
  image?: ImageInput;
  /** Number of results */
  topK?: number;
  /** Minimum similarity score */
  minScore?: number;
  /** Filter by modality */
  modality?: 'text' | 'image' | 'audio' | 'all';
}

/**
 * Cross-modal retrieval result
 */
export interface CrossModalRetrievalResult {
  /** Retrieved items */
  results: Array<{
    id: string;
    content: string;
    modality: 'text' | 'image' | 'audio';
    score: number;
    metadata?: Record<string, unknown>;
  }>;
  /** Query processing time */
  latencyMs: number;
}

/**
 * Vision-capable LLM adapter
 */
export interface VisionLLMAdapter extends LLMAdapter {
  /** Whether the adapter supports vision */
  supportsVision?: boolean;
}

/**
 * Audio-capable adapter
 */
export interface AudioLLMAdapter {
  /** Transcribe audio to text */
  transcribe(audio: Blob | ArrayBuffer | string, options?: {
    language?: string;
    prompt?: string;
    responseFormat?: string;
    temperature?: number;
  }): Promise<{
    text: string;
    language?: string;
    duration?: number;
    words?: Array<{ word: string; start: number; end: number }>;
    segments?: Array<{ id: number; text: string; start: number; end: number }>;
  }>;
  
  /** Convert text to speech */
  textToSpeech(text: string, options?: {
    voice?: string;
    responseFormat?: string;
    speed?: number;
  }): Promise<ArrayBuffer>;
  
  /** Whether the adapter supports audio */
  supportsAudio?: boolean;
}
