/**
 * OCR Types and Interfaces for OrkaJS
 */

/**
 * Supported OCR engine types
 */
export type OCREngineType = 'tesseract' | 'openai-vision' | 'google-vision' | 'azure-form-recognizer' | 'aws-textract';

/**
 * Supported input file types
 */
export type OCRInputType = 'image' | 'pdf' | 'buffer' | 'url' | 'base64';

/**
 * Confidence level for OCR results
 */
export interface OCRConfidence {
  word: number;
  line: number;
  block: number;
  page: number;
}

/**
 * Bounding box for detected text regions
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A single word detected by OCR
 */
export interface OCRWord {
  text: string;
  confidence: number;
  boundingBox?: BoundingBox;
}

/**
 * A line of text detected by OCR
 */
export interface OCRLine {
  text: string;
  words: OCRWord[];
  confidence: number;
  boundingBox?: BoundingBox;
}

/**
 * A block/paragraph of text detected by OCR
 */
export interface OCRBlock {
  text: string;
  lines: OCRLine[];
  confidence: number;
  boundingBox?: BoundingBox;
  type?: 'text' | 'table' | 'figure' | 'header' | 'footer';
}

/**
 * A single page result from OCR
 */
export interface OCRPage {
  pageNumber: number;
  text: string;
  blocks: OCRBlock[];
  confidence: number;
  width?: number;
  height?: number;
}

/**
 * Table cell extracted from document
 */
export interface TableCell {
  text: string;
  rowIndex: number;
  columnIndex: number;
  rowSpan?: number;
  columnSpan?: number;
  confidence: number;
}

/**
 * Table extracted from document
 */
export interface ExtractedTable {
  rows: number;
  columns: number;
  cells: TableCell[];
  boundingBox?: BoundingBox;
  pageNumber: number;
}

/**
 * Key-value pair extracted from document (forms)
 */
export interface ExtractedField {
  key: string;
  value: string;
  confidence: number;
  boundingBox?: BoundingBox;
  pageNumber: number;
}

/**
 * Complete OCR result
 */
export interface OCRResult {
  /** Full extracted text */
  text: string;
  /** Per-page results */
  pages: OCRPage[];
  /** Overall confidence score (0-1) */
  confidence: number;
  /** Extracted tables (if any) */
  tables?: ExtractedTable[];
  /** Extracted form fields (if any) */
  fields?: ExtractedField[];
  /** Processing metadata */
  metadata: {
    engine: OCREngineType;
    processingTimeMs: number;
    pageCount: number;
    language?: string;
  };
}

/**
 * OCR processing options
 */
export interface OCROptions {
  /** OCR engine to use (default: tesseract) */
  engine?: OCREngineType;
  /** Language(s) for OCR (default: ['eng']) */
  languages?: string[];
  /** Extract tables from documents */
  extractTables?: boolean;
  /** Extract form fields (key-value pairs) */
  extractFields?: boolean;
  /** Specific pages to process (1-indexed, default: all) */
  pages?: number[];
  /** Image preprocessing options */
  preprocessing?: {
    /** Enhance contrast */
    enhanceContrast?: boolean;
    /** Deskew rotated images */
    deskew?: boolean;
    /** Remove noise */
    denoise?: boolean;
    /** Scale factor for image (default: 1) */
    scale?: number;
  };
  /** Minimum confidence threshold (0-1) to include results */
  minConfidence?: number;
}

/**
 * Schema field definition for structured extraction
 */
export type SchemaFieldType = 'string' | 'number' | 'date' | 'boolean' | 'array' | 'object';

export interface SchemaField {
  type: SchemaFieldType;
  description?: string;
  required?: boolean;
  format?: string;
  enum?: string[];
  items?: SchemaField;
  properties?: Record<string, SchemaField>;
}

/**
 * Extraction schema definition
 */
export type ExtractionSchema = Record<string, SchemaFieldType | SchemaField>;

/**
 * Options for structured document extraction
 */
export interface ExtractOptions {
  /** File path, URL, or buffer */
  file: string | Buffer;
  /** Schema defining fields to extract */
  schema: ExtractionSchema;
  /** OCR options */
  ocr?: OCROptions;
  /** LLM to use for extraction (required for schema extraction) */
  llm?: import('@orka-js/core').LLMAdapter;
  /** Custom extraction prompt */
  prompt?: string;
  /** Include raw OCR text in result */
  includeRawText?: boolean;
}

/**
 * Result of structured extraction
 */
export interface ExtractResult<T = Record<string, unknown>> {
  /** Extracted data matching schema */
  data: T;
  /** Confidence score for extraction */
  confidence: number;
  /** Raw OCR text (if includeRawText is true) */
  rawText?: string;
  /** Validation errors (if any) */
  errors?: Array<{
    field: string;
    message: string;
  }>;
  /** Processing metadata */
  metadata: {
    engine: OCREngineType;
    processingTimeMs: number;
    pageCount: number;
  };
}

/**
 * OCR Engine interface - implement this to add new OCR providers
 */
export interface OCREngine {
  /** Engine name */
  readonly name: OCREngineType;
  
  /** Process a file and return OCR results */
  process(input: string | Buffer, options?: OCROptions): Promise<OCRResult>;
  
  /** Check if engine is available/configured */
  isAvailable(): Promise<boolean>;
}

/**
 * Configuration for OCR engines
 */
export interface TesseractEngineConfig {
  /** Path to Tesseract worker (for browser) */
  workerPath?: string;
  /** Path to language data */
  langPath?: string;
  /** Cache workers for reuse */
  cacheWorker?: boolean;
}

export interface OpenAIVisionConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export interface GoogleVisionConfig {
  credentials: string | object;
  projectId?: string;
}

export interface AzureFormRecognizerConfig {
  endpoint: string;
  apiKey: string;
  modelId?: string;
}

export interface AWSTextractConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export type OCREngineConfig = 
  | { type: 'tesseract'; config?: TesseractEngineConfig }
  | { type: 'openai-vision'; config: OpenAIVisionConfig }
  | { type: 'google-vision'; config: GoogleVisionConfig }
  | { type: 'azure-form-recognizer'; config: AzureFormRecognizerConfig }
  | { type: 'aws-textract'; config: AWSTextractConfig };
