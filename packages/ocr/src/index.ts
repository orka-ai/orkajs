/**
 * @orka-js/ocr - OCR and Document Extraction for OrkaJS
 * 
 * Extract text from images, PDFs, and scanned documents.
 * Supports local (Tesseract) and cloud (OpenAI Vision) OCR engines.
 */

// Main OCR class
export { OCR, processOCR } from './ocr.js';

// Engines
export { TesseractEngine } from './engines/tesseract-engine.js';
export { OpenAIVisionEngine } from './engines/openai-vision-engine.js';

// Document Extractor
export { DocumentExtractor, extract } from './extractors/document-extractor.js';

// Types
export type {
  // OCR types
  OCREngine,
  OCREngineType,
  OCRInputType,
  OCROptions,
  OCRResult,
  OCRPage,
  OCRBlock,
  OCRLine,
  OCRWord,
  OCRConfidence,
  BoundingBox,
  
  // Table extraction
  ExtractedTable,
  TableCell,
  ExtractedField,
  
  // Schema extraction
  ExtractionSchema,
  SchemaField,
  SchemaFieldType,
  ExtractOptions,
  ExtractResult,
  
  // Engine configs
  OCREngineConfig,
  TesseractEngineConfig,
  OpenAIVisionConfig,
  GoogleVisionConfig,
  AzureFormRecognizerConfig,
  AWSTextractConfig,
} from './types.js';
