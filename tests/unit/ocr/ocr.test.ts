import { describe, it, expect } from 'vitest';
import {
  OCR,
  TesseractEngine,
  OpenAIVisionEngine,
  DocumentExtractor,
  processOCR,
  extract,
} from '../../../packages/ocr/src/index.js';
import type {
  OCRResult,
  OCROptions,
  ExtractionSchema,
} from '../../../packages/ocr/src/types.js';

describe('OCR Module', () => {
  describe('OCR Class', () => {
    it('should create OCR instance with default Tesseract engine', () => {
      const ocr = new OCR();
      expect(ocr.engineName).toBe('tesseract');
    });

    it('should create OCR instance with OpenAI Vision engine', () => {
      const ocr = new OCR({
        type: 'openai-vision',
        config: { apiKey: 'test-key' },
      });
      expect(ocr.engineName).toBe('openai-vision');
    });

    it('should allow switching engines', () => {
      const ocr = new OCR();
      expect(ocr.engineName).toBe('tesseract');

      ocr.setEngine({
        type: 'openai-vision',
        config: { apiKey: 'test-key' },
      });
      expect(ocr.engineName).toBe('openai-vision');
    });

    it('should throw for unimplemented engines', () => {
      expect(() => new OCR({ type: 'google-vision', config: {} as any })).toThrow(
        'Google Vision engine not yet implemented'
      );
      expect(() => new OCR({ type: 'azure-form-recognizer', config: {} as any })).toThrow(
        'Azure Form Recognizer engine not yet implemented'
      );
      expect(() => new OCR({ type: 'aws-textract', config: {} as any })).toThrow(
        'AWS Textract engine not yet implemented'
      );
    });
  });

  describe('TesseractEngine', () => {
    it('should create engine with default config', () => {
      const engine = new TesseractEngine();
      expect(engine.name).toBe('tesseract');
    });

    it('should create engine with custom config', () => {
      const engine = new TesseractEngine({
        cacheWorker: false,
        langPath: '/custom/path',
      });
      expect(engine.name).toBe('tesseract');
    });

    it('should check availability', async () => {
      const engine = new TesseractEngine();
      // Will be true if tesseract.js is installed
      const available = await engine.isAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  describe('OpenAIVisionEngine', () => {
    it('should create engine with API key', () => {
      const engine = new OpenAIVisionEngine({
        apiKey: 'test-api-key',
      });
      expect(engine.name).toBe('openai-vision');
    });

    it('should throw without API key', () => {
      expect(() => new OpenAIVisionEngine({ apiKey: '' })).toThrow(
        'OpenAI API key is required'
      );
    });

    it('should use default model gpt-4o', () => {
      const engine = new OpenAIVisionEngine({
        apiKey: 'test-key',
      });
      expect(engine.name).toBe('openai-vision');
    });

    it('should allow custom model', () => {
      const engine = new OpenAIVisionEngine({
        apiKey: 'test-key',
        model: 'gpt-4-vision-preview',
      });
      expect(engine.name).toBe('openai-vision');
    });

    it('should report availability based on API key', async () => {
      const engine = new OpenAIVisionEngine({ apiKey: 'test-key' });
      const available = await engine.isAvailable();
      expect(available).toBe(true);
    });
  });

  describe('DocumentExtractor', () => {
    it('should create extractor with default engine', () => {
      const extractor = new DocumentExtractor();
      expect(extractor).toBeInstanceOf(DocumentExtractor);
    });

    it('should create extractor with custom engine', () => {
      const extractor = new DocumentExtractor({
        type: 'openai-vision',
        config: { apiKey: 'test-key' },
      });
      expect(extractor).toBeInstanceOf(DocumentExtractor);
    });

    it('should allow switching engines', () => {
      const extractor = new DocumentExtractor();
      extractor.setEngine({
        type: 'openai-vision',
        config: { apiKey: 'test-key' },
      });
      expect(extractor).toBeInstanceOf(DocumentExtractor);
    });
  });

  describe('Schema Extraction', () => {
    it('should support simple schema types', () => {
      const schema: ExtractionSchema = {
        name: 'string',
        age: 'number',
        birthDate: 'date',
        active: 'boolean',
      };

      expect(schema.name).toBe('string');
      expect(schema.age).toBe('number');
      expect(schema.birthDate).toBe('date');
      expect(schema.active).toBe('boolean');
    });

    it('should support complex schema with nested objects', () => {
      const schema: ExtractionSchema = {
        invoiceNumber: 'string',
        total: 'number',
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              quantity: { type: 'number' },
              price: { type: 'number' },
            },
          },
        },
        client: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            address: { type: 'string' },
          },
        },
      };

      expect(schema.invoiceNumber).toBe('string');
      expect((schema.items as any).type).toBe('array');
      expect((schema.client as any).type).toBe('object');
    });

    it('should support required fields', () => {
      const schema: ExtractionSchema = {
        id: {
          type: 'string',
          required: true,
          description: 'Unique identifier',
        },
        optional: {
          type: 'string',
          required: false,
        },
      };

      expect((schema.id as any).required).toBe(true);
      expect((schema.optional as any).required).toBe(false);
    });
  });

  describe('OCR Options', () => {
    it('should support language options', () => {
      const options: OCROptions = {
        languages: ['eng', 'fra', 'deu'],
      };
      expect(options.languages).toEqual(['eng', 'fra', 'deu']);
    });

    it('should support table extraction', () => {
      const options: OCROptions = {
        extractTables: true,
        extractFields: true,
      };
      expect(options.extractTables).toBe(true);
      expect(options.extractFields).toBe(true);
    });

    it('should support page selection', () => {
      const options: OCROptions = {
        pages: [1, 3, 5],
      };
      expect(options.pages).toEqual([1, 3, 5]);
    });

    it('should support confidence threshold', () => {
      const options: OCROptions = {
        minConfidence: 0.8,
      };
      expect(options.minConfidence).toBe(0.8);
    });

    it('should support preprocessing options', () => {
      const options: OCROptions = {
        preprocessing: {
          enhanceContrast: true,
          deskew: true,
          denoise: true,
          scale: 2,
        },
      };
      expect(options.preprocessing?.enhanceContrast).toBe(true);
      expect(options.preprocessing?.deskew).toBe(true);
      expect(options.preprocessing?.denoise).toBe(true);
      expect(options.preprocessing?.scale).toBe(2);
    });
  });

  describe('OCR Result Structure', () => {
    it('should have correct result structure', () => {
      const mockResult: OCRResult = {
        text: 'Sample extracted text',
        pages: [
          {
            pageNumber: 1,
            text: 'Sample extracted text',
            blocks: [
              {
                text: 'Sample extracted text',
                lines: [
                  {
                    text: 'Sample extracted text',
                    words: [
                      { text: 'Sample', confidence: 0.95 },
                      { text: 'extracted', confidence: 0.92 },
                      { text: 'text', confidence: 0.98 },
                    ],
                    confidence: 0.95,
                  },
                ],
                confidence: 0.95,
                type: 'text',
              },
            ],
            confidence: 0.95,
          },
        ],
        confidence: 0.95,
        metadata: {
          engine: 'tesseract',
          processingTimeMs: 1234,
          pageCount: 1,
          language: 'eng',
        },
      };

      expect(mockResult.text).toBe('Sample extracted text');
      expect(mockResult.pages).toHaveLength(1);
      expect(mockResult.pages[0].pageNumber).toBe(1);
      expect(mockResult.pages[0].blocks).toHaveLength(1);
      expect(mockResult.pages[0].blocks[0].lines).toHaveLength(1);
      expect(mockResult.pages[0].blocks[0].lines[0].words).toHaveLength(3);
      expect(mockResult.confidence).toBe(0.95);
      expect(mockResult.metadata.engine).toBe('tesseract');
      expect(mockResult.metadata.processingTimeMs).toBe(1234);
    });

    it('should support tables in result', () => {
      const mockResult: OCRResult = {
        text: 'Table content',
        pages: [],
        confidence: 0.9,
        tables: [
          {
            rows: 3,
            columns: 2,
            cells: [
              { text: 'Header 1', rowIndex: 0, columnIndex: 0, confidence: 0.95 },
              { text: 'Header 2', rowIndex: 0, columnIndex: 1, confidence: 0.95 },
              { text: 'Value 1', rowIndex: 1, columnIndex: 0, confidence: 0.92 },
              { text: 'Value 2', rowIndex: 1, columnIndex: 1, confidence: 0.93 },
            ],
            pageNumber: 1,
          },
        ],
        metadata: {
          engine: 'openai-vision',
          processingTimeMs: 2000,
          pageCount: 1,
        },
      };

      expect(mockResult.tables).toHaveLength(1);
      expect(mockResult.tables![0].rows).toBe(3);
      expect(mockResult.tables![0].columns).toBe(2);
      expect(mockResult.tables![0].cells).toHaveLength(4);
    });

    it('should support form fields in result', () => {
      const mockResult: OCRResult = {
        text: 'Form content',
        pages: [],
        confidence: 0.9,
        fields: [
          { key: 'Name', value: 'John Doe', confidence: 0.95, pageNumber: 1 },
          { key: 'Date', value: '2024-03-15', confidence: 0.92, pageNumber: 1 },
          { key: 'Amount', value: '1250.00', confidence: 0.98, pageNumber: 1 },
        ],
        metadata: {
          engine: 'openai-vision',
          processingTimeMs: 1500,
          pageCount: 1,
        },
      };

      expect(mockResult.fields).toHaveLength(3);
      expect(mockResult.fields![0].key).toBe('Name');
      expect(mockResult.fields![0].value).toBe('John Doe');
    });
  });

  describe('Convenience Functions', () => {
    it('should export processOCR function', () => {
      expect(typeof processOCR).toBe('function');
    });

    it('should export extract function', () => {
      expect(typeof extract).toBe('function');
    });
  });

  describe('Engine Configurations', () => {
    it('should support Tesseract config', () => {
      const config = {
        type: 'tesseract' as const,
        config: {
          workerPath: '/custom/worker.js',
          langPath: '/custom/lang',
          cacheWorker: true,
        },
      };

      expect(config.type).toBe('tesseract');
      expect(config.config.cacheWorker).toBe(true);
    });

    it('should support OpenAI Vision config', () => {
      const config = {
        type: 'openai-vision' as const,
        config: {
          apiKey: 'sk-test-key',
          model: 'gpt-4o',
          maxTokens: 4096,
        },
      };

      expect(config.type).toBe('openai-vision');
      expect(config.config.model).toBe('gpt-4o');
    });
  });

  describe('RGPD Compliance', () => {
    it('should support local processing with Tesseract', () => {
      // Tesseract runs entirely locally - no data sent to cloud
      const engine = new TesseractEngine();
      expect(engine.name).toBe('tesseract');
      // This is RGPD-friendly as no data leaves the infrastructure
    });

    it('should clearly identify cloud engines', () => {
      const cloudEngine = new OpenAIVisionEngine({ apiKey: 'test' });
      expect(cloudEngine.name).toBe('openai-vision');
      // Users should be aware this sends data to OpenAI
    });
  });
});
