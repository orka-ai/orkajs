/**
 * OCR Module - Main entry point for document OCR processing
 */

import type {
  OCREngine,
  OCRResult,
  OCROptions,
  OCREngineType,
  OCREngineConfig,
} from './types.js';
import { TesseractEngine } from './engines/tesseract-engine.js';
import { OpenAIVisionEngine } from './engines/openai-vision-engine.js';

/**
 * OCR class - Process documents with configurable OCR engines
 * 
 * @example
 * ```typescript
 * import { OCR } from '@orka-js/ocr';
 * 
 * // Using default Tesseract engine (local)
 * const ocr = new OCR();
 * const result = await ocr.process('./document.png');
 * 
 * // Using OpenAI Vision (cloud)
 * const ocr = new OCR({
 *   type: 'openai-vision',
 *   config: { apiKey: process.env.OPENAI_API_KEY! },
 * });
 * ```
 */
export class OCR {
  private engine: OCREngine;

  constructor(engineConfig?: OCREngineConfig) {
    this.engine = this.createEngine(engineConfig);
  }

  private createEngine(config?: OCREngineConfig): OCREngine {
    if (!config) {
      return new TesseractEngine();
    }

    switch (config.type) {
      case 'tesseract':
        return new TesseractEngine(config.config);
      case 'openai-vision':
        return new OpenAIVisionEngine(config.config);
      case 'google-vision':
        throw new Error('Google Vision engine not yet implemented. Use tesseract or openai-vision.');
      case 'azure-form-recognizer':
        throw new Error('Azure Form Recognizer engine not yet implemented. Use tesseract or openai-vision.');
      case 'aws-textract':
        throw new Error('AWS Textract engine not yet implemented. Use tesseract or openai-vision.');
      default:
        return new TesseractEngine();
    }
  }

  /**
   * Process a document and extract text
   */
  async process(input: string | Buffer, options?: OCROptions): Promise<OCRResult> {
    return this.engine.process(input, options);
  }

  /**
   * Get the current engine name
   */
  get engineName(): OCREngineType {
    return this.engine.name;
  }

  /**
   * Check if the engine is available
   */
  async isAvailable(): Promise<boolean> {
    return this.engine.isAvailable();
  }

  /**
   * Switch to a different OCR engine
   */
  setEngine(engineConfig: OCREngineConfig): void {
    this.engine = this.createEngine(engineConfig);
  }
}

/**
 * Quick OCR function for simple use cases
 */
export async function processOCR(
  input: string | Buffer,
  options?: OCROptions & { engine?: OCREngineConfig }
): Promise<OCRResult> {
  const ocr = new OCR(options?.engine);
  return ocr.process(input, options);
}
