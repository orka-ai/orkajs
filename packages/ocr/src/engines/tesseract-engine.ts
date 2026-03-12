/**
 * Tesseract OCR Engine - Local/Open-source OCR
 * RGPD-friendly, self-hosted solution
 */

import type {
  OCREngine,
  OCRResult,
  OCROptions,
  OCRPage,
  OCRBlock,
  OCRLine,
  OCRWord,
  TesseractEngineConfig,
} from '../types.js';

/**
 * Tesseract.js OCR Engine
 * 
 * @example
 * ```typescript
 * import { TesseractEngine } from '@orka-js/ocr';
 * 
 * const engine = new TesseractEngine();
 * const result = await engine.process('./document.png', {
 *   languages: ['eng', 'fra'],
 * });
 * console.log(result.text);
 * ```
 */
export class TesseractEngine implements OCREngine {
  readonly name = 'tesseract' as const;
  private config: TesseractEngineConfig;
  private worker: unknown = null;
  private Tesseract: typeof import('tesseract.js') | null = null;

  constructor(config: TesseractEngineConfig = {}) {
    this.config = {
      cacheWorker: true,
      ...config,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.loadTesseract();
      return true;
    } catch {
      return false;
    }
  }

  async process(input: string | Buffer, options: OCROptions = {}): Promise<OCRResult> {
    const startTime = Date.now();
    const Tesseract = await this.loadTesseract();

    const languages = options.languages?.join('+') || 'eng';

    // Create or reuse worker
    const worker = await this.getWorker(Tesseract, languages);

    try {
      // Process the image
      const { data } = await worker.recognize(input);

      // Build structured result
      const pages = this.buildPages(data, options);
      const text = pages.map(p => p.text).join('\n\n');
      const confidence = data.confidence / 100;

      const result: OCRResult = {
        text,
        pages,
        confidence,
        metadata: {
          engine: 'tesseract',
          processingTimeMs: Date.now() - startTime,
          pageCount: pages.length,
          language: languages,
        },
      };

      // Cleanup worker if not caching
      if (!this.config.cacheWorker) {
        await worker.terminate();
        this.worker = null;
      }

      return result;
    } catch (error) {
      // Cleanup on error
      if (this.worker) {
        await (this.worker as { terminate: () => Promise<void> }).terminate();
        this.worker = null;
      }
      throw error;
    }
  }

  private async loadTesseract(): Promise<typeof import('tesseract.js')> {
    if (this.Tesseract) {
      return this.Tesseract;
    }

    try {
      this.Tesseract = await import('tesseract.js');
      return this.Tesseract;
    } catch {
      throw new Error(
        'tesseract.js is not installed. Install it with: npm install tesseract.js'
      );
    }
  }

  private async getWorker(
    Tesseract: typeof import('tesseract.js'),
    languages: string
  ): Promise<Tesseract.Worker> {
    if (this.worker && this.config.cacheWorker) {
      return this.worker as Tesseract.Worker;
    }

    const workerOptions: Partial<Tesseract.WorkerOptions> = {};
    
    if (this.config.workerPath) {
      workerOptions.workerPath = this.config.workerPath;
    }
    if (this.config.langPath) {
      workerOptions.langPath = this.config.langPath;
    }

    const worker = await Tesseract.createWorker(languages, 1, workerOptions);
    
    if (this.config.cacheWorker) {
      this.worker = worker;
    }

    return worker;
  }

  private buildPages(data: Tesseract.RecognizeResult['data'], options: OCROptions): OCRPage[] {
    const minConfidence = options.minConfidence ?? 0;

    // Tesseract returns flat structure, we need to build hierarchy
    const blocks: OCRBlock[] = [];
    let currentBlock: OCRBlock | null = null;
    let currentLine: OCRLine | null = null;

    for (const word of data.words || []) {
      const wordConfidence = word.confidence / 100;
      
      if (wordConfidence < minConfidence) continue;

      const ocrWord: OCRWord = {
        text: word.text,
        confidence: wordConfidence,
        boundingBox: word.bbox ? {
          x: word.bbox.x0,
          y: word.bbox.y0,
          width: word.bbox.x1 - word.bbox.x0,
          height: word.bbox.y1 - word.bbox.y0,
        } : undefined,
      };

      // Check if we need a new line (based on line_num or position)
      const lineNum = (word as unknown as { line_num?: number }).line_num ?? 0;
      const blockNum = (word as unknown as { block_num?: number }).block_num ?? 0;

      if (!currentBlock || (word as unknown as { block_num?: number }).block_num !== blockNum) {
        // New block
        if (currentLine && currentBlock) {
          currentLine.text = currentLine.words.map(w => w.text).join(' ');
          currentBlock.lines.push(currentLine);
        }
        if (currentBlock) {
          currentBlock.text = currentBlock.lines.map(l => l.text).join('\n');
          blocks.push(currentBlock);
        }
        
        currentBlock = {
          text: '',
          lines: [],
          confidence: 0,
          type: 'text',
        };
        currentLine = {
          text: '',
          words: [ocrWord],
          confidence: wordConfidence,
        };
      } else if (!currentLine || lineNum !== (currentLine as unknown as { _lineNum?: number })._lineNum) {
        // New line in same block
        if (currentLine) {
          currentLine.text = currentLine.words.map(w => w.text).join(' ');
          currentBlock.lines.push(currentLine);
        }
        currentLine = {
          text: '',
          words: [ocrWord],
          confidence: wordConfidence,
        };
        (currentLine as unknown as { _lineNum: number })._lineNum = lineNum;
      } else {
        // Same line
        currentLine.words.push(ocrWord);
        currentLine.confidence = Math.min(currentLine.confidence, wordConfidence);
      }
    }

    // Finalize last block/line
    if (currentLine && currentBlock) {
      currentLine.text = currentLine.words.map(w => w.text).join(' ');
      currentBlock.lines.push(currentLine);
    }
    if (currentBlock && currentBlock.lines.length > 0) {
      currentBlock.text = currentBlock.lines.map(l => l.text).join('\n');
      currentBlock.confidence = currentBlock.lines.reduce((sum, l) => sum + l.confidence, 0) / currentBlock.lines.length;
      blocks.push(currentBlock);
    }

    // Build page
    const page: OCRPage = {
      pageNumber: 1,
      text: data.text,
      blocks,
      confidence: data.confidence / 100,
    };

    return [page];
  }

  /**
   * Terminate the worker and release resources
   */
  async terminate(): Promise<void> {
    if (this.worker) {
      await (this.worker as { terminate: () => Promise<void> }).terminate();
      this.worker = null;
    }
  }
}
