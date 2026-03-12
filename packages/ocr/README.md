# @orka-js/ocr

OCR and Document Extraction module for OrkaJS. Extract text from images, PDFs, and scanned documents with support for local (Tesseract) and cloud (OpenAI Vision) OCR engines.

## Installation

```bash
npm install @orka-js/ocr

# For local OCR (Tesseract)
npm install tesseract.js

# For cloud OCR (OpenAI Vision) - no additional deps needed
```

## Quick Start

### Basic OCR

```typescript
import { OCR } from '@orka-js/ocr';

// Using Tesseract (local, RGPD-friendly)
const ocr = new OCR();
const result = await ocr.process('./document.png');
console.log(result.text);

// Using OpenAI Vision (cloud, high precision)
const ocr = new OCR({
  type: 'openai-vision',
  config: { apiKey: process.env.OPENAI_API_KEY! },
});
const result = await ocr.process('./invoice.pdf');
```

### Structured Extraction

Extract structured data from documents using a schema:

```typescript
import { DocumentExtractor } from '@orka-js/ocr';
import { OpenAIAdapter } from '@orka-js/openai';

const extractor = new DocumentExtractor();

const result = await extractor.extract({
  file: './invoice.pdf',
  schema: {
    invoiceNumber: 'string',
    date: 'date',
    total: 'number',
    client: 'string',
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
  },
  llm: new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! }),
});

console.log(result.data);
// { invoiceNumber: 'INV-2024-001', date: '2024-03-15', total: 1250.00, ... }
```

## OCR Engines

### Tesseract (Local)

- ✅ Self-hosted, RGPD-friendly
- ✅ No API costs
- ✅ Supports 100+ languages
- ⚠️ Lower accuracy on complex layouts

```typescript
import { TesseractEngine } from '@orka-js/ocr';

const engine = new TesseractEngine({
  cacheWorker: true, // Reuse worker for better performance
});

const result = await engine.process('./document.png', {
  languages: ['eng', 'fra'],
});
```

### OpenAI Vision (Cloud)

- ✅ High accuracy
- ✅ Understands document structure
- ✅ Handles tables and forms
- ⚠️ API costs apply

```typescript
import { OpenAIVisionEngine } from '@orka-js/ocr';

const engine = new OpenAIVisionEngine({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o', // or 'gpt-4-vision-preview'
});

const result = await engine.process('./complex-form.pdf');
```

## API Reference

### OCR Class

```typescript
const ocr = new OCR(engineConfig?);

// Process a document
const result = await ocr.process(input, options?);

// Check engine availability
const available = await ocr.isAvailable();

// Switch engine
ocr.setEngine(newEngineConfig);
```

### DocumentExtractor Class

```typescript
const extractor = new DocumentExtractor(engineConfig?);

// Extract structured data
const result = await extractor.extract({
  file: string | Buffer,
  schema: ExtractionSchema,
  llm?: LLMAdapter,
  ocr?: OCROptions,
  includeRawText?: boolean,
});
```

### OCROptions

```typescript
interface OCROptions {
  engine?: 'tesseract' | 'openai-vision';
  languages?: string[];
  extractTables?: boolean;
  extractFields?: boolean;
  pages?: number[];
  minConfidence?: number;
  preprocessing?: {
    enhanceContrast?: boolean;
    deskew?: boolean;
    denoise?: boolean;
    scale?: number;
  };
}
```

## License

MIT
