---
"@orka-js/ocr": minor
"orkajs": minor
---

## 🔍 OCR & Document Extraction Module

New `@orka-js/ocr` package for extracting text from images, PDFs, and scanned documents.

### Features

- **Multiple OCR Engines**
  - `TesseractEngine` - Local/self-hosted OCR (RGPD-friendly, no cloud dependency)
  - `OpenAIVisionEngine` - Cloud-based high-precision OCR using GPT-4 Vision

- **Document Extraction with Schema**
  - Extract structured data from documents using a schema definition
  - Supports nested objects, arrays, and required fields
  - LLM-powered extraction for complex documents

- **Rich Result Structure**
  - Full text extraction with confidence scores
  - Page-by-page results with blocks, lines, and words
  - Table extraction support
  - Form field extraction (key-value pairs)

### Usage

```typescript
import { OCR, DocumentExtractor } from '@orka-js/ocr';

// Basic OCR
const ocr = new OCR(); // Uses Tesseract by default
const result = await ocr.process('./document.png');

// Cloud OCR with OpenAI Vision
const ocr = new OCR({
  type: 'openai-vision',
  config: { apiKey: process.env.OPENAI_API_KEY! },
});

// Structured extraction
const extractor = new DocumentExtractor();
const data = await extractor.extract({
  file: './invoice.pdf',
  schema: {
    invoiceNumber: 'string',
    total: 'number',
    date: 'date',
  },
  llm: myLLMAdapter,
});
```

### Why OCR?

60-80% of enterprise documents are not natively text-based (scanned PDFs, images, faxes). This module enables OrkaJS to process real-world business documents for RAG and AI workflows.
